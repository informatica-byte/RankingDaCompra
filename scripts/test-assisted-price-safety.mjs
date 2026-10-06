import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const bot = readFileSync(new URL('../bot-precos.user.js', import.meta.url), 'utf8');
const safetyCode = readFileSync(new URL('../assisted-price-safety.js', import.meta.url), 'utf8');
const url = 'https://produto.mercadolivre.com.br/MLB-2926671021-tenis-_JM?searchVariation=175705466645';
const title = 'Tênis Nike Court Legacy Lift Feminino';
function money(value, options = {}) {
  const [fraction, cents] = String(value).split('.');
  return {
    closest: () => options.excluded ? {} : null,
    getClientRects: () => options.hidden ? [] : [{}],
    getAttribute: () => options.label || '',
    querySelector: selector => ({ textContent: selector.endsWith('__fraction') ? fraction : selector.endsWith('__cents') ? cents || '00' : options.currency || 'R$' }),
  };
}
function page({ prices = [money(358.79)], structured = [], foundTitle = title, text = '' } = {}) {
  return {
    body: { innerText: text }, defaultView: { getComputedStyle: () => ({ display: 'inline', visibility: 'visible' }) },
    querySelector: selector => selector.startsWith('h1') ? { textContent: foundTitle } : null,
    querySelectorAll: selector => selector.includes('ld+json') ? structured.map(value => ({ textContent: JSON.stringify(value) })) : selector.startsWith('.ui-pdp-price__second-line') ? prices : [],
  };
}
function setup(doc = page()) {
  const writes = []; let current;
  const context = vm.createContext({ URL, document: doc, location: { hostname: 'test.invalid', href: url }, unsafeWindow: {},
    Date, setTimeout: callback => queueMicrotask(callback), GM_setValue: (key, value) => writes.push(value), GM_getValue: () => current,
  });
  vm.runInContext(bot.replace(/\}\)\(\);\s*$/, 'Object.assign(globalThis, {parsePrice, matchingProduct, sameOffer, extractDocumentOffer, publishCurrentPageResult}); })();'), context);
  vm.runInContext(safetyCode, context);
  return { context, writes, setCommand: value => { current = value; } };
}
const structuredOffer = (price, name = title, offerUrl = url, type = 'Offer') => ({ '@type': 'Product', name, offers: { '@type': type, priceCurrency: 'BRL', price, lowPrice: 85.40, url: offerUrl } });

test('preço principal não é parcela, cashback, preço riscado ou oferta recomendada', () => {
  const { context } = setup(page({ prices: [money(649.99, { excluded: true }), money(358.79), money(6.95, { excluded: true })],
    structured: [structuredOffer(85.40, 'Tênis Nike Downshifter Feminino', 'https://produto.mercadolivre.com.br/MLB-1111111111-tenis-_JM'), structuredOffer(358.79)] }));
  const result = context.extractDocumentOffer(context.document, title, url);
  assert.equal(result.preco, 358.79);
  assert.equal(result.offerKey, 'MLB2926671021');
  assert.equal(result.robotVersion, '2.1.0');
});
test('números monetários rejeitam parcelas e intervalos em vez de concatená-los', () => {
  const { context: c } = setup();
  for (const [input, output] of [['R$ 1.299,90',1299.90], ['1299.9',1299.9], ['85,40',85.40], ['1.299',1299], ['12x 85,40',null], ['de 10 até 20',null], ['85,40 90,00',null], ['-1',null], ['0',null]]) assert.equal(c.parsePrice(input), output, input);
});
test('AggregateOffer lowPrice e metadados isolados nunca substituem o preço principal', () => {
  const { context: c } = setup(page({ prices: [], structured: [structuredOffer(85.40, title, url, 'AggregateOffer')] }));
  assert.equal(c.extractDocumentOffer(c.document, title, url).status, 'loading');
});
test('preço estruturado divergente, duas ofertas visíveis ou moeda diferente requerem revisão', () => {
  for (const doc of [page({structured:[structuredOffer(85.40)]}), page({prices:[money(358.79),money(349.90)]}), page({prices:[money(358.79,{currency:'US$'})]})]) {
    const { context: c } = setup(doc); assert.equal(c.extractDocumentOffer(doc, title, url).status, 'loading');
  }
});
test('anúncio não renderizado e preço oculto não comprovam uma cotação', () => {
  const detached = page(); detached.defaultView = null;
  for (const doc of [detached, page({prices:[money(358.79,{hidden:true})]})]) {
    const { context:c }=setup(doc); assert.equal(c.extractDocumentOffer(doc,title,url).status,'loading');
  }
});
test('modelo diferente não passa por duas palavras genéricas em comum', () => {
  const { context:c }=setup();
  assert.equal(c.matchingProduct('Fone JBL Tune 520BT Preto Bluetooth','Fone JBL Tune 720BT Preto Bluetooth'),false);
  assert.equal(c.sameOffer(url,'https://produto.mercadolivre.com.br/MLB-1111111111-tenis-_JM'),false);
  assert.equal(c.sameOffer(url,url.replace('175705466645','175705466646')),false);
  assert.equal(c.sameOffer(url,'https://mercadolivre.com.br.evil.invalid/MLB-2926671021'),false);
});
test('aba antiga não responde a novo pedido mesmo com título idêntico', async () => {
  const {context:c,writes,setCommand}=setup();
  const command={requestId:'next',produtoId:'outro',titulo:title,url:url.replace('2926671021','1111111111'),createdAt:Date.now()};
  setCommand(command); await c.publishCurrentPageResult(command); assert.equal(writes.length,0);
});
test('pedido cancelado durante a estabilização não publica resultado tardio', async () => {
  const {context:c,writes,setCommand}=setup();
  const command={requestId:'old',produtoId:'a',titulo:title,url,createdAt:Date.now()};
  setCommand(command); c.setTimeout=callback=>{setCommand({...command,requestId:'new'});queueMicrotask(callback)};
  await c.publishCurrentPageResult(command); assert.equal(writes.length,0);
});
test('resultado estável carrega evidência, produto, pedido e URL para validação anterior à escrita', async () => {
  const {context:c,writes,setCommand}=setup();
  const command={requestId:'now',produtoId:'a',titulo:title,url,createdAt:Date.now()};
  setCommand(command); await c.publishCurrentPageResult(command);
  assert.equal(writes.length,1);
  assert.equal(c.RDCAssistedPriceSafety.validate(writes[0],{produtoId:'a',url,previousPrice:358.79}), '');
});
test('preço que oscila até o prazo acabar não é publicado como confirmado', async () => {
  const doc=page();const {context:c,writes,setCommand}=setup(doc);
  let now=Date.now(), toggle=false;c.Date={now:()=>now};
  c.setTimeout=callback=>{now+=500;toggle=!toggle;doc.querySelectorAll=selector=>selector.startsWith('.ui-pdp-price__second-line')?[money(toggle ? 350 : 358.79)]:[];queueMicrotask(callback)};
  const command={requestId:'changing',produtoId:'a',titulo:title,url,createdAt:now};
  setCommand(command);await c.publishCurrentPageResult(command);
  assert.equal(writes.length,1);assert.equal(writes[0].status,'error');
});
test('validador recusa robô antigo, produto trocado, resposta antiga e queda ou aumento grande', async () => {
  const {context:c,writes,setCommand}=setup();
  const command={requestId:'now',produtoId:'a',titulo:title,url,createdAt:Date.now()};
  setCommand(command); await c.publishCurrentPageResult(command);
  for (const result of [{...writes[0],robotVersion:'2.0.0'},{...writes[0],produtoId:'b'},{...writes[0],requestedUrl:'https://example.com/'},{...writes[0],checkedAt:Date.now()-125000},{...writes[0],mainPrice:85.40}]) assert.ok(c.RDCAssistedPriceSafety.validate(result,{produtoId:'a',url,previousPrice:358.79}));
  assert.match(c.RDCAssistedPriceSafety.validate(writes[0],{produtoId:'a',url,previousPrice:85.40}),/35%/);
});
test('os dois painéis validam antes de escrever no Firebase e preservam conferência manual', () => {
  const mobile=readFileSync(new URL('../painel-celular.html',import.meta.url),'utf8');
  const dashboard=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
  for(const html of [mobile,dashboard]) assert.match(html,/assisted-price-safety.js\?v=20261006-1/);
  const save=mobile.slice(mobile.indexOf('async function salvarFilaPrecoAssistida'),mobile.indexOf('function separarProdutoAutomacao'));
  assert.ok(save.indexOf('RDCAssistedPriceSafety.validate')<save.indexOf('await updateDoc'));
  assert.match(save,/if \(opcoes.automatico\)/);
  assert.match(mobile,/if \(!automacaoPrecosAtiva \|\| rodada !== automacaoPrecosRodada\) return/);
  const batch=dashboard.slice(dashboard.indexOf('async function salvarPrecoConferidoEmLote'),dashboard.indexOf('async function iniciarConferenciaPrecosIAEmLote'));
  assert.ok(batch.indexOf('RDCAssistedPriceSafety.validate')<batch.indexOf("await db.collection"));
});
