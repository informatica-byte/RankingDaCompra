import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync('mobile-categories.js', 'utf8');
const html = readFileSync('painel-celular.html', 'utf8');
const cats = [{ id: 'cameras', nome: 'Câmeras de Segurança' }, { id: 'casa', nome: 'Casa' }];
function boot(read, options = {}) {
  const listeners = {};
  const select = {
    options: [], value: '', attrs: {},
    ownerDocument: { createElement: () => ({}) },
    replaceChildren(...nodes) { this.options = nodes; this.value = nodes[0]?.value || ''; },
    addEventListener(name, cb) { listeners[name] = cb; },
    setAttribute(name, value) { this.attrs[name] = value; },
    removeAttribute(name) { delete this.attrs[name]; }
  };
  const button = { disabled: false, addEventListener(name, cb) { listeners['button-' + name] = cb; } };
  const status = { textContent: '' }, context = { window: {}, setTimeout, clearTimeout };
  runInNewContext(source, context);
  let uid = 'first', time = 0, loaded = [];
  const api = context.window.RDCMobileCategories.create({ select, button, status, read,
    session: () => uid, now: () => time, onCategories: items => { loaded = items; }, ...options });
  return { api, select, button, status, listeners, loaded: () => loaded,
    session: value => { uid = value; }, tick: amount => { time += amount; } };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('falha inicial é recuperável na mesma aba sem recarregar a página', async () => {
  let calls = 0;
  const t = boot(async () => { if (++calls === 1) throw Error('network'); return cats; });
  assert.equal(await t.api.load(), false);
  assert.match(t.status.textContent, /sem perder os campos/);
  assert.equal(t.button.disabled, false);
  assert.equal(await t.api.load(), false); assert.equal(calls, 1);
  t.tick(30000); assert.equal(await t.api.load(), true);
  assert.deepEqual(plain(t.loaded()), cats);
  await t.api.load(); assert.equal(calls, 2); // foco/retorno não relê uma lista válida
});

test('snapshot vazio não vira estado final; botão permite nova consulta imediata', async () => {
  let calls = 0;
  const t = boot(async () => ++calls === 1 ? [] : cats);
  assert.equal(await t.api.load(), false);
  assert.match(t.status.textContent, /Não foi possível carregar/);
  assert.equal(await t.api.load({ force: true }), true);
  assert.equal(calls, 2);
});

test('eventos concorrentes e cliques compartilham a consulta em andamento', async () => {
  let calls = 0, finish;
  const t = boot(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const a = t.api.load(), b = t.api.load({ force: true });
  await Promise.resolve(); assert.equal(calls, 1); assert.equal(t.button.disabled, true);
  finish(cats); assert.equal(await a, true); assert.equal(await b, true);
  assert.equal(t.button.disabled, false);
});

test('categoria do cadastro antes da resposta e escolha durante atualização são preservadas', async () => {
  let finish, calls = 0;
  const t = boot(() => ++calls === 1 ? Promise.resolve(cats) : new Promise(resolve => { finish = resolve; }));
  const initial = t.api.load(); t.api.prefer('cameras');
  await initial; assert.equal(t.select.value, 'cameras');
  const update = t.api.load({ force: true }); await Promise.resolve();
  t.select.value = 'casa'; t.listeners.change(); finish([...cats].reverse()); await update;
  assert.equal(t.select.value, 'casa');
});

test('erro ou lista vazia em atualização conserva opções e seleção anterior', async () => {
  let calls = 0;
  const t = boot(async () => ++calls === 1 ? cats : []);
  await t.api.load(); t.select.value = 'cameras';
  assert.equal(await t.api.load({ force: true }), false);
  assert.equal(t.select.value, 'cameras');
  assert.deepEqual(plain(t.loaded()), cats);
  assert.match(t.status.textContent, /lista e os campos preenchidos foram mantidos/);
});

test('categoria removida não é trocada silenciosamente por outra nem validada como existente', async () => {
  let calls = 0;
  const t = boot(async () => ++calls === 1 ? cats : [cats[1]]);
  await t.api.load(); t.select.value = 'cameras'; await t.api.load({ force: true });
  assert.equal(t.select.value, 'cameras');
  assert.equal(t.select.options.find(item => item.value === 'cameras').disabled, true);
  assert.equal(t.loaded().some(item => item.id === 'cameras'), false);
  assert.match(t.status.textContent, /categoria anterior não está/);
});

test('nomes e IDs de categorias não são interpretados como HTML', async () => {
  const id = '\"><img src=x onerror=alert(1)>', nome = '<script>alert(1)</script>';
  const t = boot(async () => [{ id, nome }]);
  await t.api.load();
  assert.equal(t.select.options[1].value, id);
  assert.equal(t.select.options[1].textContent, nome);
  assert.equal(t.select.options[1].innerHTML, undefined);
});

test('logout e troca de conta descartam resposta tardia sem apagar a nova consulta', async () => {
  let finishOld, finishNew, calls = 0;
  const t = boot(() => new Promise(resolve => { if (++calls === 1) finishOld = resolve; else finishNew = resolve; }));
  const old = t.api.load(); await Promise.resolve();
  t.session('second'); const next = t.api.load(); await Promise.resolve();
  finishOld([{ id: 'private-old' }]); assert.equal(await old, false);
  assert.equal(t.button.disabled, true); assert.equal(t.loaded().length, 0);
  finishNew(cats); assert.equal(await next, true);
  t.session(''); t.api.reset(); await t.api.load();
  assert.equal(t.loaded().length, 0); assert.equal(calls, 2);
});

test('timeout liberta o botão e resposta atrasada não altera a seleção recuperada', async () => {
  let calls = 0, finish;
  const t = boot(() => ++calls === 1 ? new Promise(resolve => { finish = resolve; }) : cats, { timeoutMs: 5 });
  assert.equal(await t.api.load(), false); assert.equal(t.button.disabled, false);
  assert.equal(await t.api.load({ force: true }), true);
  finish([{ id: 'late' }]); await Promise.resolve();
  assert.deepEqual(plain(t.loaded()), cats);
});

test('integração limita recuperação a categorias, mantém formulários e valida seleção', () => {
  assert.match(html, /mobile-categories\.js\?v=20261025-1/);
  assert.match(html, /getDocsFromServer\(query\(collection\(db, "categorias"\)/);
  assert.match(html, /categoriasMovel\.prefer\(existente\.categoria\)/);
  assert.match(html, /if \(!cats\.some\(cat => cat\.id === \$\("categoria"\)\.value\)\)/);
  assert.match(html, /window\.addEventListener\("online"/);
  assert.match(html, /document\.visibilityState === "visible"/);
  assert.doesNotMatch(source, /location|reload\(|localStorage|sessionStorage|fetch\(|setInterval|innerHTML|form\.reset/);
  const recovery = html.slice(html.indexOf('      const categoriasMovel ='), html.indexOf('      window.RDCBestChoicesAdmin.mount'));
  assert.doesNotMatch(recovery, /carregarFila|\.value\s*=|setDoc|updateDoc|deleteDoc/);
});
