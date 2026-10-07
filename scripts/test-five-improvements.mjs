import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { publicCatalogue } from './public-catalogue.mjs';
import { decisionData, renderProductDecision } from './product-decision.mjs';
const source = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const buyerContext = {window:{},URL,Intl,console};
vm.createContext(buyerContext);
vm.runInContext(await source('buyer-tools.js'), buyerContext);
const buyer = buyerContext.window.RDCBuyerTools;
test('published pages may retain the previous known asset version during generation, not arbitrary versions', async () => {
  const validator = await source('scripts/validate-site.mjs');
  const line = validator.split('\n').find(line => line.includes('versão visual desconhecida carregada'));
  assert.ok(line.includes('|20260929-presentes|20261003-five|20261004-repairs|20261005-choices|20261005-ux|20261006-audit|20261007-counters)'));
  assert.ok(!line.includes('unknown-version'));
});
test('public loader shares concurrent reads, caches success and retries errors without database fallback', async () => {
  let calls=0, fail=false;
  const context = {window:{},Map,Date,Promise,fetch:async()=>{calls++;return {ok:!fail,status:503,json:async()=>({products:[]})};}};
  vm.createContext(context);
  vm.runInContext(await source('public-data.js'),context);
  const json=context.window.RDCPublicData.json;
  const [a,b]=await Promise.all([json('/historico-precos.json?dia=1'),json('/historico-precos.json?dia=2')]);
  assert.equal(calls,1);assert.equal(a,b);
  await json('/historico-precos.json');assert.equal(calls,1);
  fail=true;await assert.rejects(json('/search-index.json'));
  fail=false;await json('/search-index.json');assert.equal(calls,3);
  await assert.rejects(json('https://bad.example/data.json'));
});
test('public catalogue preserves price timestamps and excludes private fields', () => {
  const p={id:'one',titulo:'Produto',preco:'99,00',precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:'2026-10-02T18:00:00Z',token:'SECRET',email:'private@example.org',notaInterna:'private'};
  const output=publicCatalogue([p],'2026-10-03T19:00:00Z');
  assert.equal(output.products[0].precoAtualizadoManualmenteEm,p.precoAtualizadoManualmenteEm);
  assert.doesNotMatch(JSON.stringify(output),/SECRET|private/);
  assert.throws(()=>publicCatalogue(null));
});
test('buyer budget and recent confirmation reject absent, old and future observations', () => {
  const now=Date.parse('2026-10-03T18:00:00Z');
  const products=[{id:'fresh',title:'Fone',category:'Áudio',price:99,checkedAt:'2026-10-03T17:00:00Z'},{id:'old',title:'Fone',category:'Áudio',price:89,checkedAt:'2026-10-01T17:00:00Z'},{id:'future',title:'Fone',price:90,checkedAt:'2026-10-04T17:00:00Z'},{id:'unknown',title:'Fone'}];
  assert.equal(buyer.filterProducts(products,{query:'fone',budget:100,recent:true},now).length,1);
  assert.equal(buyer.recent(products[2],now),false);
  assert.equal(buyer.price(products[3]),null);
  assert.equal(buyer.filterProducts(products,{category:'Áudio',budget:100},now).length,2);
});
test('comparison permits only known equivalent product types and safe local destinations', () => {
  assert.equal(buyer.comparable([{title:'Roteador AX1800'},{title:'Roteador AC1200'}]),true);
  for (const title of ['Repetidor roteador WiFi','Access point','Internet Starlink','Relógio digital']) assert.equal(buyer.group({title}), '');
  assert.equal(buyer.comparable([{title:'Smartwatch'},{title:'Relógio digital'}]),false);
  assert.equal(buyer.comparable([{title:'Headphone Bluetooth'},{title:'Fone TWS Bluetooth'}]),false);
  assert.equal(buyer.group({title:'Fone Bluetooth Wireless Para Celular'}),'');
  assert.equal(buyer.group({title:'Capa para celular Samsung'}),'');
  assert.equal(buyer.group({title:'Fones de ouvido intra-auriculares Bluetooth'}),'Fones intra-auriculares sem fio');
  assert.equal(buyer.safeProductUrl('https://evil.example/produto/a.html'),'#');
  assert.equal(buyer.safeProductUrl('javascript:alert(1)'),'#');
  assert.equal(buyer.safeProductUrl('https://rankingdacompra.com.br/produto/a-20260810-1.html'),'/produto/a-20260810-1.html');
});
test('decision explains facts without promoting absent or unverified features', () => {
  const d=decisionData({titulo:'Roteador Wi-Fi 6',comentario:'Sem portas Gigabit; Mesh não confirmado.'});
  assert.equal(d.criteria.find(item=>item.label==='Portas Gigabit').state,'no');
  assert.equal(d.criteria.find(item=>item.label==='Rede Mesh').state,'unknown');
  const html=renderProductDecision({titulo:'Roteador <script>Wi-Fi 6</script>'});
  assert.match(html,/não teste prático/);assert.doesNotMatch(html,/<script>/);
  assert.equal(renderProductDecision({titulo:'Produto sem tipo definido'}),'');
});
test('SEO freshness uses supplied export date, preserves unknown provenance and distinguishes store clicks', async () => {
  const context={window:{},URL,console};vm.createContext(context);
  const js=await source('seo-opportunities.js');vm.runInContext(js,context);
  const rows=context.window.RankingSEOOpportunities.parseSearchConsoleCsv('Top pages,Clicks,Impressions,CTR,Position\nhttps://rankingdacompra.com.br/analises.html,1,100,1%,9');
  const report=context.window.RankingSEOOpportunities.analyzeRows(rows,{sourceDate:'2026-09-30',period:'Últimos 3 meses'});
  assert.equal(report.sourceDate,'2026-09-30');assert.equal(report.period,'Últimos 3 meses');
  assert.equal(context.window.RankingSEOOpportunities.analyzeRows(rows).sourceDate,null);
  assert.match(js,/Cliques para lojas não comprovam vendas/);
});
test('home uses published catalogue; video requests wait for intersection or explicit action', async () => {
  const home=await source('index.html'),growth=await source('growth-tools.js');
  const fn=home.slice(home.indexOf('async function homeComPromocoes'),home.indexOf('async function home(){'));
  assert.doesNotMatch(fn,/db\.collection/);
  assert.match(fn,/RDCBestChoices\.selectProducts\(todos,siteConfig\)/);
  const video=growth.slice(growth.indexOf('  async function renderVideoShowcase'),growth.indexOf('  async function loadPublishedConfig'));
  assert.match(video,/<iframe data-src=/);assert.doesNotMatch(video,/<iframe src=/);
  assert.ok(video.indexOf('new IntersectionObserver') < video.indexOf('loadYoutubePlayerApi().then'));
  for (const workflow of ['update-sitemap','sync-mercadolivre']) assert.match(await source('.github/workflows/'+workflow+'.yml'),/git add[^\n]+vitrine-publica\.json/);
});
