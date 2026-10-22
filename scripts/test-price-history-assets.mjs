import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { priceHistoryAssets, buildPriceHistoryAssets } from './build-price-history-assets.mjs';
import { protectPublicHtml } from './public-privacy.mjs';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const fixture = () => ({ updatedAt: '2026-10-22T00:00:00Z', products: {
  one: { points: [['2026-10-20', 50], ['2026-10-21', 100]], observations: {'2026-10-21': {verified: true, sourceUrl: 'not-for-display'}}, archives: [{ points: [['2025-01-01', 1]] }] },
  two: { points: [['2026-10-21', 80]], observations: {'2026-10-21': {verified: false}} }
} });

test('display projection is deterministic, keeps dates/prices/verification and never modifies evidence', () => {
  const input = fixture(), before = structuredClone(input), output = priceHistoryAssets(input);
  const chunk = JSON.parse(output.files.get(output.manifest.products.one));
  assert.deepEqual(input, before);
  assert.deepEqual(chunk.points, [['2026-10-20', 50, false], ['2026-10-21', 100, true]]);
  assert.deepEqual(priceHistoryAssets(input), output);
  assert.doesNotMatch(JSON.stringify(chunk), /sourceUrl|archives|not-for-display/);
  input.updatedAt = '2026-10-23T00:00:00Z';
  assert.equal(priceHistoryAssets(input).manifest.products.one, output.manifest.products.one);
  input.products.one.points[1][1] = 101;
  const changed = priceHistoryAssets(input);
  assert.notEqual(changed.manifest.products.one, output.manifest.products.one);
  assert.equal(changed.manifest.products.two, output.manifest.products.two);
  assert.throws(() => priceHistoryAssets({products:{'../bad': {}}}));
  assert.throws(() => priceHistoryAssets({products:{x:{points:[['today', 1]]}}}));
});

test('asset builder leaves source bytes untouched and retains old chunks for open tabs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rdc-history-'));
  try {
    const bytes = JSON.stringify(fixture(), null, 2);
    await writeFile(join(dir, 'historico-precos.json'), bytes);
    await buildPriceHistoryAssets(dir);
    assert.equal(await readFile(join(dir, 'historico-precos.json'), 'utf8'), bytes);
    const changed = fixture(); changed.products.one.points[1][1] = 101;
    await writeFile(join(dir, 'historico-precos.json'), JSON.stringify(changed));
    await buildPriceHistoryAssets(dir);
    assert.equal((await readdir(join(dir, 'assets/price-history'))).length, 3);
  } finally { await rm(dir, {recursive: true, force: true}); }
});

async function loader(custom) {
  const assets = priceHistoryAssets(fixture()), calls = [];
  const data = {'/historico-precos-indice.json': assets.manifest};
  for (const [name, text] of assets.files) data['/assets/price-history/' + name] = JSON.parse(text);
  const context = vm.createContext({ window: {RDCPublicData: {json: async path => {
    calls.push(path); if (custom) return custom(path, data); if (!data[path]) throw Error('not found'); return data[path];
  }}}, console });
  vm.runInContext(await read('price-history-data.js'), context);
  return {api:context.window.RDCPriceHistoryData, calls, data, assets};
}

test('history makes no eager requests, shares simultaneous reads and loads only requested products', async () => {
  const env = await loader(); assert.deepEqual(env.calls, []);
  assert.equal(Object.keys((await env.api.load([])).products).length, 0);
  const [a, b] = await Promise.all([env.api.load(['one', 'one']), env.api.load(['one'])]);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  assert.equal(env.calls.length, 2);
  assert.ok(!env.calls.some(path => path === '/historico-precos.json'));
  assert.ok(!env.calls.some(path => path.includes(env.assets.manifest.products.two)));
  await env.api.load(['one', 'missing', '../bad']); assert.equal(env.calls.length, 2);
  await env.api.load(['two']); assert.equal(env.calls.length, 3);
});

test('history refuses external paths, wrong product and corrupted points without fabricating minimum', async () => {
  for (const kind of ['external', 'wrong-id', 'invalid-point', 'offline']) {
    const env = await loader((path, data) => {
      if (kind === 'offline') throw Error('offline');
      if (path.endsWith('indice.json') && kind === 'external') return {version:2, products:{one:'https://evil.example/a.json'}};
      if (path.includes('/assets/') && kind === 'wrong-id') return {version:2, id:'two', points:[]};
      if (path.includes('/assets/') && kind === 'invalid-point') return {version:2, id:'one', points:[['2026-10-21',1,'yes']]};
      return data[path];
    });
    assert.equal(Object.keys((await env.api.load(['one'])).products).length, 0);
    assert.ok(env.calls.every(path => path.startsWith('/')));
  }
});

test('public data allowlist accepts hashed chunks only, with immutable cache', async () => {
  const calls = [], context = vm.createContext({window:{}, fetch:async (path,options) => {
    calls.push({path,options}); return {ok:true,json:async()=>({ok:true})};
  }});
  vm.runInContext(await read('public-data.js'), context);
  const api = context.window.RDCPublicData;
  for (const path of ['/assets/price-history/../one.json', '/assets/price-history/one.json', 'https://evil.example/historico-precos.json', '/assets/price-history/one-abcdefghabcdefgh.json']) await assert.rejects(api.json(path));
  await api.json('/assets/price-history/one-0123456789abcdef.json');
  assert.equal(calls[0].options.cache, 'force-cache');
  await api.json('/historico-precos-indice.json'); assert.equal(calls[1].options.cache, 'no-cache');
});

test('generated history exactly matches every source point and verification flag', async () => {
  const master = JSON.parse(await read('historico-precos.json'));
  const manifest = JSON.parse(await read('historico-precos-indice.json'));
  assert.deepEqual(Object.keys(manifest.products).sort(), Object.keys(master.products).sort());
  for (const [id, item] of Object.entries(master.products)) {
    const chunk = JSON.parse(await read('assets/price-history/' + manifest.products[id]));
    assert.equal(chunk.id, id);
    assert.deepEqual(chunk.points.map(point => point.slice(0, 2)), item.points || []);
    assert.deepEqual(chunk.points.map(point => point[2]), (item.points || []).map(point => item.observations?.[point[0]]?.verified === true));
  }
});

test('compact history preserves verified minimum and never promotes legacy low price', async () => {
  const source = await read('growth-tools.js');
  const context = vm.createContext({state:{history:{products:{one:{points:[['2026-10-20', 1, false],['2026-10-21', 100, true]]}}}},HISTORY_DAYS:30,numberPrice:Number,Date});
  vm.runInContext(source.slice(source.indexOf('  function historySummary('), source.indexOf('  function currentPriceFromCard(')), context);
  assert.equal(context.historySummary('one', 100).minimum, 100);
  assert.equal(context.historySummary('one', 100).pendingReview, 1);
  assert.doesNotMatch(source, /ranking-price-history-cache|HISTORY_URL|RDCPublicData\.json\("\/historico-precos\.json"/);
});

test('normalization is idempotent and retains metrics versions, metadata, links and original content', () => {
  const original = '<html><head><meta name="description" content="original"></head><body><a href="/produto/one.html">Original</a><script defer src="/growth-tools.js?v=20261012-audit-4&metrics=20261021-products"></script></body></html>';
  const after = protectPublicHtml(original);
  assert.equal(protectPublicHtml(after), after);
  assert.equal((after.match(/src="\/price-history-data\.js/g) || []).length, 1);
  assert.ok(after.indexOf('price-history-data.js') < after.indexOf('growth-tools.js'));
  assert.ok(after.indexOf('public-data.js') < after.indexOf('price-history-data.js'));
  assert.match(after, /metrics=20261021-products&history=20261022-1/);
  assert.ok(after.includes('<meta name="description" content="original">'));
  assert.ok(after.includes('<a href="/produto/one.html">Original</a>'));
});

test('all existing publication paths stage derived history without adding a schedule or cloud operation', async () => {
  for (const name of ['historico-precos', 'update-sitemap', 'sync-mercadolivre']) {
    const source = await read('.github/workflows/' + name + '.yml');
    assert.match(source, /git add[^\n]+historico-precos-indice\.json assets\/price-history\//);
  }
  const builder = await read('scripts/build-price-history-assets.mjs');
  assert.doesNotMatch(builder, /fetch\(|firebase|Firestore|getToken|observations\s*=/);
});
