import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import affiliateReview from '../affiliate-link-review.js';

const source = readFileSync('admin-read-economy.js', 'utf8');
const dashboard = readFileSync('dashboard.html', 'utf8');
const mobile = readFileSync('painel-celular.html', 'utf8');
const growth = readFileSync('growth-tools.js', 'utf8');
const serial = value => JSON.parse(JSON.stringify(value));
const snapshot = n => ({ docs: Array.from({ length: n }, (_, id) => ({ id: String(id), data: () => ({ titulo: 'Produto', preco: 25 }) })), metadata: { fromCache: false } });
function boot() {
  const ctx = { window: {} }; runInNewContext(source, ctx);
  let uid = 'PRIVATE-USER-ID', now = 1000;
  const api = ctx.window.RDCAdminReadEconomy.create({ session: () => uid, now: () => now });
  return { api, session: value => uid = value, tick: value => now += value };
}

test('montar/coordenar não executa consultas, armazena dados nem instala polling', () => {
  const { api } = boot(); assert.deepEqual(serial(api.summary()), {});
  assert.doesNotMatch(source, /\bfetch\s*\(|localStorage|sessionStorage|indexedDB|sendBeacon|getToken|setInterval|setTimeout|console\./);
});

test('duas consultas simultâneas à mesma coleção retornam uma única leitura completa', async () => {
  const { api } = boot(); let calls = 0, resolve;
  const data = snapshot(562), pending = new Promise(done => resolve = done);
  const read = () => { calls++; return pending; };
  const a = api.read('produtos', read, { fresh: true });
  const b = api.read('produtos', read, { fresh: true });
  await Promise.resolve(); assert.equal(calls, 1); resolve(data);
  assert.equal(await a, data); assert.equal(await b, data);
  assert.deepEqual(serial(api.summary()), { produtos: { queries: 1, documents: 562, reused: 1, failures: 0 } });
  assert.equal(data.docs[0].data().preco, 25);
});

test('cache auxiliar dura no máximo um minuto; fila explícita ignora uma resposta concluída', async () => {
  const { api, tick } = boot(); let calls = 0;
  const read = async () => { calls++; return snapshot(calls); };
  await api.read('produtos', read, { ttl: 60000 });
  assert.equal((await api.read('produtos', read, { ttl: 60000 })).docs.length, 1);
  assert.equal(calls, 1);
  assert.equal((await api.read('produtos', read, { fresh: true, ttl: 60000 })).docs.length, 2);
  tick(60001); await api.read('produtos', read, { ttl: Infinity }); assert.equal(calls, 3);
  await api.read('produtos', read, { ttl: 0 }); assert.equal(calls, 4);
});

test('erro de atualização da fila continua erro, sem devolver preço antigo como consulta atual', async () => {
  const { api } = boot(); const data = snapshot(3);
  await api.read('produtos', async () => data, { ttl: 60000 });
  const error = Error('NETWORK-ERROR-SECRET-NOT-RECORDED');
  await assert.rejects(api.read('produtos', async () => { throw error; }, { fresh: true }), e => e === error);
  assert.doesNotMatch(JSON.stringify(api.summary()), /SECRET|PRIVATE|preco|titulo|25/);
  assert.equal((await api.read('produtos', async () => { throw Error('unneeded'); }, { ttl: 60000 })), data);
});

test('troca de usuário ou logout não reaproveita snapshots de outra sessão', async () => {
  const { api, session } = boot(); let calls = 0;
  const read = async () => { calls++; return snapshot(calls); };
  await api.read('produtos', read, { ttl: 60000 });
  session('OTHER-PRIVATE-USER');
  assert.equal((await api.read('produtos', read, { ttl: 60000 })).docs.length, 2);
  session(''); await assert.rejects(api.read('produtos', read), /Entre novamente/);
  assert.equal(calls, 2); assert.deepEqual(serial(api.summary()), {});
});

test('resposta tardia de sessão encerrada não preenche cache nem remove a nova leitura', async () => {
  const { api, session } = boot(); let finishOld, finishNew;
  const old = api.read('produtos', () => new Promise(done => finishOld = done));
  await Promise.resolve(); session('new');
  const next = api.read('produtos', () => new Promise(done => finishNew = done));
  await Promise.resolve(); finishOld(snapshot(1));
  await assert.rejects(old, /sessão mudou/);
  const joined = api.read('produtos', () => { throw Error('não duplicar'); });
  finishNew(snapshot(2)); assert.equal((await next).docs.length, 2); assert.equal((await joined).docs.length, 2);
});

test('listeners contam mudanças recebidas, não o tamanho inteiro a cada alteração; cache local fica separado', () => {
  const { api } = boot(); api.watch('produtos');
  const data = snapshot(562);
  api.observe('produtos', { ...data, docChanges: () => data.docs.map(doc => ({ doc })) }, true);
  api.observe('produtos', { ...data, docChanges: () => [{ doc: data.docs[0] }] }, true);
  api.observe('produtos', { ...data, metadata: { fromCache: true } }, true);
  api.observe('produtos', { ...data, docChanges: () => [{ doc: { metadata: { hasPendingWrites: true } } }] }, true);
  assert.equal(api.summary().produtos.documents, 563);
  assert.equal(api.summary().produtos.queries, 1);
  assert.equal(JSON.stringify(api.summary()).includes('PRIVATE'), false);
});

test('leitor móvel usa atualização explícita na fila e coalescência nos módulos auxiliares', async () => {
  const { api } = boot(); let calls = 0;
  const context = { economiaLeiturasMovel: api, db: {}, collection: () => ({}), getDocsFromServer: async () => { calls++; return snapshot(562); } };
  const start = mobile.indexOf('      function lerProdutosParaModulosMovel('), end = mobile.indexOf('      let cats =', start);
  runInNewContext(mobile.slice(start, end), context);
  await Promise.all([context.lerProdutosParaModulosMovel(), context.lerProdutosParaModulosMovel()]);
  assert.equal(calls, 1);
  await context.lerProdutosParaModulosMovel(); assert.equal(calls, 1);
  await context.lerProdutosParaModulosMovel(true); assert.equal(calls, 2);
  assert.match(mobile, /if \(rankingDadosMovel && !somentePrecos\)/);
  assert.match(mobile, /lerProdutosParaModulosMovel\(somentePrecos\)/);
  assert.match(mobile, /getDocsFromServer\(collection\(db, 'produtos'\)\)/);
  assert.match(mobile, /filaPrecosDados = await rankingCarregarDados\(true\)/);
});

test('comparativo do dashboard reutiliza lista viva/categorias e resumo, limitado aos sete dias', async () => {
  const { api } = boot(); let broadReads = 0, configReads = 0;
  const metrics = { docs: [{ data: () => ({ dia: '2026-10-15', tipo: 'clique_oferta', produtoId: 'p' }) }, { data: () => ({ dia: '2026-10-23', tipo: 'clique_oferta', produtoId: 'p' }) }] };
  const products = snapshot(562), categories = snapshot(27);
  products.forEach = cb => products.docs.forEach(cb); categories.forEach = cb => categories.docs.forEach(cb);
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-23T12:00:00Z'])); } }
  const context = { window: { RDCAffiliateLinkReview: affiliateReview }, Date: Clock, Intl, auth: { currentUser: { uid: 'owner' } }, economiaLeiturasDashboard: api,
    snapshotProdutosBackup: products, snapshotCategoriasBackup: categories, obterMetricasPainel: async () => metrics,
    db: { collection: name => {
      if (name !== 'configuracoes') { broadReads++; throw Error('coleção não deve ser relida'); }
      return { doc: () => ({ get: async () => { configReads++; return { exists: false }; } }) };
    } }, CONFIG_COLLECTION: 'configuracoes', WEEKLY_COMPARISON_DOC: 'ranking-semanal',
    weeklyProductEligible: () => true, weeklyUniqueMetrics: values => values };
  const start = dashboard.indexOf('        window.RDCAdminReadAccess ='), end = dashboard.indexOf('        async function carregarMetricasVisitas', start);
  runInNewContext(dashboard.slice(start, end), context);
  const weeklyStart = growth.indexOf('  async function weeklyAdminData('), weeklyEnd = growth.indexOf('  function weeklyChooseTheme(', weeklyStart);
  runInNewContext(growth.slice(weeklyStart, weeklyEnd), context);
  const data = await context.weeklyAdminData();
  assert.equal(data.products.length, 562); assert.equal(data.metrics.length, 1); assert.equal(data.metrics[0].dia, '2026-10-23');
  assert.equal(broadReads, 0); assert.equal(configReads, 1);
  assert.equal(api.summary().produtos.reused, 1); assert.equal(api.summary().categorias.reused, 1);
});

test('integração mantém transações de segurança, não habilita persistência ou novos serviços', () => {
  for (const [html,version] of [[mobile,'20261026-delete'],[dashboard,'20261023-1']]) {
    assert.ok(html.includes('admin-read-economy.js?v='+version));
    assert.match(html, /transaction\.get\(ref\)/);
    assert.match(html, /RDCExistingFlashOffer\.assertCurrent/);
    assert.doesNotMatch(html, /enablePersistence|persistentLocalCache|FIREBASE_APPCHECK_DEBUG_TOKEN/);
  }
  assert.match(dashboard, /if \(pararProdutosAdmin\) return;/);
  assert.match(dashboard, /read.*20261023-1/);
});

test('snapshot compartilhado entre abas não é contado como documento relido do servidor', () => {
  const { api } = boot();
  api.observe('produtos', { ...snapshot(579), metadata: { shared: true, fromCache: false } }, true);
  assert.equal(api.summary().produtos.documents, 0);
  assert.equal(api.summary().produtos.reused, 1);
  assert.equal(api.summary().produtos.queries, 0);
});

test('excluir invalida somente produtos, sem nova leitura, sem zerar diagnóstico e sem resposta antiga voltar ao cache',async()=>{
 const {api}=boot();let calls=0,finish;
 await api.read('categorias',async()=>snapshot(2),{ttl:60000});
 const pending=api.read('produtos',()=>{calls++;return new Promise(resolve=>finish=resolve);},{ttl:60000});
 await Promise.resolve();api.invalidate('produtos');assert.equal(calls,1);assert.equal(api.summary().categorias.documents,2);
 finish(snapshot(5));await assert.rejects(pending,/cadastros mudaram/);
 const current=await api.read('produtos',async()=>{calls++;return snapshot(1);},{ttl:60000});assert.equal(current.docs.length,1);assert.equal(calls,2);
 await api.read('categorias',async()=>{throw Error('não reler');},{ttl:60000});
 assert.equal(api.summary().categorias.queries,1);assert.equal(api.summary().produtos.queries,2);
});
