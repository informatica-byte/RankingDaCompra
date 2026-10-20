import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const bot = readFileSync(new URL('../bot-precos.user.js', import.meta.url), 'utf8');
const safety = readFileSync(new URL('../assisted-price-safety.js', import.meta.url), 'utf8');
function setup(open = null) {
  const calls = [], commands = [], listeners = new Map(), timers = new Map();
  let sequence = 0, forbiddenHandleReads = 0;
  const worker = { focus() {} };
  for (const property of ['location', 'closed']) Object.defineProperty(worker, property, { get() { forbiddenHandleReads++; throw new Error('Old cross-origin handle must not be inspected'); } });
  const panel = { innerWidth: 1200, screen: { availWidth: 1600 }, open: (url, name, features) => { calls.push({ url, name, features }); return open ? open(url, name, features) : worker; } };
  const c = vm.createContext({ URL, URLSearchParams, Date, Math, location: { hostname: 'rankingdacompra.com.br' }, unsafeWindow: panel,
    setTimeout: callback => { const id = ++sequence; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id),
    GM_setValue: (key, value) => commands.push({ key, value }),
    GM_addValueChangeListener: (key, callback) => { const id = ++sequence; listeners.set(id, { key, callback }); return id; },
    GM_removeValueChangeListener: id => listeners.delete(id),
  });
  vm.runInContext(bot, c);
  vm.runInContext(safety, c);
  const respond = value => { for (const { key, callback } of [...listeners.values()]) callback(key, null, value); };
  return { c, panel, calls, commands, listeners, timers, respond, forbiddenHandleReads: () => forbiddenHandleReads };
}
function proof(c, command) {
  return { status: 'ok', robotVersion: '2.4.4', proofVersion: 3, comparisonPolicy: 'name_price', priceBasis: 'highlighted_total', requestId: command.requestId, produtoId: command.produtoId,
    requestedUrl: command.url, fonteConsultada: command.url, tituloEncontrado: command.titulo,
    offerKey: c.RDCAssistedPriceSafety.identity(command.url).key,
    variantProof: { verified: true, expectedTitle: command.titulo, listingId: c.RDCAssistedPriceSafety.identity(command.url).listing, attributes: [] },
    preco: 92.03, mainPrice: 92.03, currency: 'BRL', priceSelector: '.ui-pdp-price__second-line .andes-money-amount', evidencia: 'Preço principal visível', checkedAt: Date.now(),
  };
}

test('current bot asks browser to reuse named worker for every product, never old cross-origin handle', async () => {
  const s = setup();
  const requests = [
    { produtoId: 'notebook', titulo: 'Notebook Asus Vivobook Go Ryzen 5', url: 'https://www.mercadolivre.com.br/notebook/p/MLB43417665?wid=MLB3914161563' },
    { produtoId: 'mouse', titulo: 'Mouse Logitech Bluetooth Preto', url: 'https://produto.mercadolivre.com.br/MLB-5288561749-mouse-_JM?searchVariation=178912345678' },
    { produtoId: 'phone', titulo: 'Smartphone Samsung Galaxy A55 Preto', url: 'https://www.mercadolivre.com.br/smartphone/p/MLB98765432#position=3&wid=MLB4463477029' },
  ];
  for (const request of requests) {
    const pending = s.panel.conferirPrecoNaAbaLocal(request);
    const command = s.commands.at(-1).value;
    const result = proof(s.c, command);
    s.respond(result);
    assert.equal(await pending, result);
    assert.equal(s.c.RDCAssistedPriceSafety.validate(result, request), '');
    assert.equal(s.listeners.size, 0);
    assert.equal(s.timers.size, 0);
  }
  assert.deepEqual(s.calls.map(call => {
    const url = new URL(call.url), hash = new URLSearchParams(url.hash.slice(1));
    assert.ok(hash.get('_rdc_conferencia'));
    hash.delete('_rdc_conferencia'); url.hash = hash.toString(); return url.href;
  }), requests.map(request => request.url));
  assert.equal(s.calls.length, 3);
  assert.equal(new Set(s.calls.map(call => call.name)).size, 1);
  assert.match(s.calls[0].name, /^rdc_conferencia_[a-z0-9-]+$/i);
  assert.equal(new Set(s.calls.map(call => call.features)).size, 1);
  assert.match(s.calls[0].features, /popup=yes/);
  assert.equal(s.forbiddenHandleReads(), 0);
  assert.equal(s.panel.__RDC_BOT_PRECOS_LOCAL__.version, '2.4.11');
});

test('reused worker ignores old request, different product and altered requested variant', async () => {
  const s = setup();
  const request = { produtoId: 'mouse', titulo: 'Mouse Logitech Bluetooth Preto', url: 'https://produto.mercadolivre.com.br/MLB-5288561749-mouse-_JM?searchVariation=123456' };
  const pending = s.panel.conferirPrecoNaAbaLocal(request);
  const command = s.commands.at(-1).value, result = proof(s.c, command);
  let resolved = false;
  pending.then(() => { resolved = true; });
  for (const wrong of [{ ...result, requestId: 'old-request' }, { ...result, produtoId: 'notebook' }, { ...result, requestedUrl: request.url.replace('123456', '654321') }]) s.respond(wrong);
  await Promise.resolve();
  assert.equal(resolved, false);
  assert.equal(s.listeners.size, 1);
  s.respond(result);
  assert.equal(await pending, result);
  for (const wrong of [
    { ...result, fonteConsultada: 'https://produto.mercadolivre.com.br/MLB-4091855423-old-product-_JM' },
  ]) assert.match(s.c.RDCAssistedPriceSafety.validate(wrong, request), /anúncio não corresponde/);
  assert.equal(s.c.RDCAssistedPriceSafety.validate({ ...result, fonteConsultada: request.url.replace('123456', '654321') }, request), '');
});

test('blocked or throwing window.open rejects and removes timer/listener without weakening proof', async () => {
  const request = { produtoId: 'mouse', titulo: 'Mouse Logitech Bluetooth Preto', url: 'https://produto.mercadolivre.com.br/MLB-5288561749-mouse-_JM' };
  for (const [open, message] of [[() => null, /bloqueou a janela/], [() => { throw new Error('navigation denied'); }, /navigation denied/]]) {
    const s = setup(open);
    await assert.rejects(s.panel.conferirPrecoNaAbaLocal(request), message);
    assert.equal(s.listeners.size, 0);
    assert.equal(s.timers.size, 0);
    assert.equal(s.forbiddenHandleReads(), 0);
  }
});
