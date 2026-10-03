import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { observationFromHtml, addObservation } from './price-observation.mjs';
import { productSeoName, productSeoTitle } from './product-seo-titles.mjs';
import { queueQuery, nextCursor, pendingRequests } from './localizer-queue.mjs';

test('histórico usa a data da observação, não a execução; ignora futuro e preço diferente', () => {
  const html = '<meta name="rdc-manual-price" content="99"><meta name="rdc-manual-checked-at" content="2026-09-01T14:00:00Z">';
  assert.equal(observationFromHtml(html, 99, Date.parse('2026-10-02')).date, '2026-09-01');
  assert.equal(observationFromHtml(html, 100, Date.parse('2026-10-02')), null);
  assert.equal(observationFromHtml(html, 99, Date.parse('2026-08-02')), null);
  assert.equal(observationFromHtml('', 99), null);
});

test('histórico mantém pontos legados e não duplica o dia ou regride a observação', () => {
  const original = { title: 'Produto', points: [['2026-01-01', 50]], custom: true };
  const observation = { date: '2026-10-02', checkedAt: '2026-10-02T15:00:00Z', source: 'manual', price: 99 };
  const result = addObservation(original, observation);
  assert.equal(result.points.length, 2);
  assert.equal(result.custom, true);
  assert.deepEqual(addObservation(result, observation), result);
  assert.deepEqual(addObservation(result, { ...observation, checkedAt: '2026-10-02T10:00:00Z', price: 30 }), result);
  assert.deepEqual(original.points, [['2026-01-01', 50]]);
});

test('gerador preserva histórico inválido em vez de substituí-lo silenciosamente', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rdc-history-test-'));
  const file = path.join(root, 'historico-precos.json');
  await fs.mkdir(path.join(root, 'produto'));
  await fs.writeFile(file, '{dados corrompidos');
  assert.throws(() => execFileSync(process.execPath, [path.resolve('scripts/update-price-history.mjs')], { cwd: root, stdio: 'pipe' }));
  assert.equal(await fs.readFile(file, 'utf8'), '{dados corrompidos');
  assert.ok(path.resolve(await fs.realpath(root)).startsWith(path.resolve(os.tmpdir()) + path.sep));
  await fs.rm(root, { recursive: true }); // Caminho temporário resolvido e validado acima.
});

test('títulos não terminam em conectores; variantes e anúncios não são inventados', () => {
  assert.equal(productSeoName('Um produto com'), 'Um produto');
  for (const word of ['de', 'em', 'para', 'com', 'e', 'do', 'da', 'o', 'a']) assert.equal(productSeoName(`Produto ${word}`), 'Produto');
  assert.notEqual(productSeoTitle('soundcore P30i da Anker Verde'), productSeoTitle('soundcore P30i da Anker Preto'));
  const title = 'Liquidificador Turbo Power Mondial 550W - L-99 FB';
  assert.notEqual(productSeoTitle(title, '?wid=MLB4297760749'), productSeoTitle(title, '?wid=MLB1793491599'));
  assert.doesNotMatch(productSeoTitle(title), /127V|220V|anúncio/);
});

test('fila lê primeiro os dez pedidos mais recentes, filtra pendentes e pagina sem perder tentativas', () => {
  const firstQuery = queueQuery().structuredQuery;
  assert.equal(firstQuery.limit, 10);
  assert.equal(firstQuery.orderBy[0].field.fieldPath, 'criadoEm');
  assert.equal(firstQuery.orderBy[0].direction, 'DESCENDING');
  assert.equal('startAt' in firstQuery, false);
  const documents = Array.from({ length: 10 }, (_, index) => ({ name: `projects/x/databases/(default)/documents/mlbSolicitacoes/${index}`, fields: { criadoEm: { timestampValue: `2026-10-02T10:0${index}:00Z` } } }));
  const cursor = nextCursor(documents);
  assert.equal(queueQuery(cursor).structuredQuery.limit, 10);
  assert.deepEqual(queueQuery(cursor).structuredQuery.startAt.values, cursor);
  assert.equal(queueQuery(cursor).structuredQuery.startAt.before, false);
  assert.equal(nextCursor([]), null);
  const requests = Array.from({ length: 11 }, (_, index) => ({ id: String(index), criadoEm: String(index).padStart(2, '0'), status: 'pendente', link: 'https://meli.la/test' }));
  requests[0].status = 'concluido';
  requests[1].link = '';
  const results = Object.fromEntries(requests.slice(0, 10).map(item => [item.id, { status: 'ok' }]));
  assert.equal(pendingRequests(requests, results)[0].id, '10');
  results['10'] = { status: 'erro', tentativas: 3 };
  assert.equal(pendingRequests(requests, results).length, 0);
});

async function configFixture(record, published, remote = null) {
  const source = await fs.readFile('growth-tools.js', 'utf8');
  const start = source.indexOf('  function persistConfigCache(value)');
  const end = source.indexOf('  function validWhatsAppUrl(value)');
  let saved = JSON.stringify(record), reads = 0, fetches = 0;
  const context = { state: { config: null, configCache: { savedAt: 0, published: null, overrides: {} } }, CONFIG_CACHE_KEY: 'test', CONFIG_CACHE_TTL: 12 * 3600000, CONFIG_COLLECTION: 'configuracoes', CONFIG_DOC: 'site', Date, console,
    localStorage: { getItem: () => saved, setItem: (_, value) => { saved = value; } },
    fetch: async () => { fetches++; return { ok: true, json: async () => published }; },
  };
  if (remote) context.db = { collection: () => ({ doc: id => ({ get: async () => { reads++; return { exists: true, data: () => id === 'site' ? remote : {} }; } }) }) };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const [config] = await Promise.all([context.loadConfig(), context.loadConfig()]);
  return { config, record: JSON.parse(saved), reads, fetches, context };
}

test('cache invalida campo publicado novo sem TTL deslizante ou perder vídeos remotos', async () => {
  const savedAt = Date.now() - 11 * 3600000;
  const result = await configFixture({ savedAt, value: { promotionSeoTitle: 'Antigo', youtubeShowcaseEnabled: true }, published: { promotionSeoTitle: 'Antigo', youtubeShowcaseEnabled: false } }, { promotionSeoTitle: 'Novo', youtubeShowcaseEnabled: false });
  assert.equal(result.config.promotionSeoTitle, 'Novo');
  assert.equal(result.config.youtubeShowcaseEnabled, true);
  assert.equal(result.record.savedAt, savedAt);
  assert.equal(result.fetches, 1);
  assert.equal(result.reads, 0);
});

test('cache preserva alteração administrativa ainda não publicada e migra versão legada uma vez', async () => {
  const fixture = await configFixture({ savedAt: Date.now(), value: { promotionSeoTitle: 'Velho' } }, { promotionSeoTitle: 'Padrão' }, { promotionSeoTitle: 'Salvo no painel', youtubeShowcaseEnabled: true });
  assert.equal(fixture.config.promotionSeoTitle, 'Salvo no painel');
  assert.equal(fixture.reads, 2);
  fixture.context.updateCachedConfig({ promotionSeoTitle: 'Título recém salvo' });
  assert.equal(fixture.context.state.configCache.overrides.promotionSeoTitle, 'Título recém salvo');
  const second = await configFixture({ savedAt: Date.now(), value: { promotionSeoTitle: 'Título recém salvo' }, published: { promotionSeoTitle: 'Padrão' }, overrides: { promotionSeoTitle: 'Título recém salvo' } }, { promotionSeoTitle: 'Publicado antes do salvamento' });
  assert.equal(second.config.promotionSeoTitle, 'Título recém salvo');
});

test('cache expirado não perde configuração remota durante falta de acesso ao Firebase', async () => {
  const savedAt = Date.now() - 13 * 3600000;
  const fixture = await configFixture({ savedAt, value: { youtubeShowcaseEnabled: true }, published: { youtubeShowcaseEnabled: false } }, { youtubeShowcaseEnabled: false });
  assert.equal(fixture.config.youtubeShowcaseEnabled, true);
  assert.equal(fixture.record.savedAt, savedAt);
});

test('todos os publicadores de páginas validam antes do push e categorias são escapadas', async () => {
  for (const file of ['historico-precos', 'sync-mercadolivre', 'update-sitemap']) {
    const source = await fs.readFile(`.github/workflows/${file}.yml`, 'utf8');
    assert.ok(source.indexOf('node scripts/validate-site.mjs') < source.indexOf('git push'));
    assert.ok(source.includes('node scripts/validate-site.mjs'));
  }
  const mobile = await fs.readFile('painel-celular.html', 'utf8');
  assert.match(mobile, /rankingEsc\(c\.id\)[^\n]*rankingEsc\(c\.nome\)/);
});

test('aviso da vitrine reconhece revisão manual mesmo se o lote automático está parcial', async () => {
  const home = await fs.readFile('index.html', 'utf8');
  const fn = home.match(/^function rotuloAtualizacao[^\n]+/m)?.[0];
  const context = { Date, Intl, mercadoLivreLoteCompleto: false, mercadoLivreAtualizadoEm: '2026-09-22', fontePrecoSeguro: p => p };
  vm.createContext(context); vm.runInContext(fn, context);
  const label = context.rotuloAtualizacao([{ confirmado: true, origem: 'manual' }, { confirmado: true, origem: 'manual' }]);
  assert.match(label, /2 de 2 preços/);
  assert.match(label, /2 manualmente/);
  assert.doesNotMatch(label, /aguardam|automático concluído/);
});
