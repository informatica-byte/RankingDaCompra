import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import choices from '../best-choices.js';
import { correctProductData, correctGeneratedProductTitles, manufacturerEvidence } from './product-title-corrections.mjs';
const source = f => readFile(new URL('../' + f, import.meta.url), 'utf8');
const growth = await source('growth-tools.js');
const decorator = growth.slice(growth.indexOf('  function decorateProductCard('), growth.indexOf('  function decorateVisibleProducts('));
function decorateFixture({page = false, nested = false} = {}) {
  const output = [], ids = [], anchor = {classList:{contains:()=>false},insertAdjacentHTML:(where,html)=>output.push({where,html,anchor:true})};
  const target = {closest:()=>nested?anchor:null,classList:{contains:()=>true},insertAdjacentHTML:(where,html)=>output.push({where,html,anchor:false})};
  const card = {matches:()=>false,contains:()=>true,querySelector:selector => selector==='[data-offer-proof]' ? null : selector==='h1' ? page?{}:null : selector.includes('href') ? {href:'https://rankingdacompra.com.br/produto/related-20260810-1.html'} : target};
  const context = {state:{decorated:new WeakSet(),history:{products:{own:{},related:{}}}},location:{pathname:page?'/produto/own-20260810-1.html':'/',href:'https://rankingdacompra.com.br/produto/own-20260810-1.html'},productIdFromUrl:url=>new URL(url).pathname.split('/').pop().split('-')[0],historySummary:id=>{ids.push(id);return {};},currentPriceFromCard:()=>258,cardHasConfirmedPrice:()=>true,proofMarkup:()=>'<details data-offer-proof></details>',escapeHtml:String};
  vm.createContext(context);vm.runInContext(decorator,context);context.decorateProductCard(card);context.decorateProductCard(card);
  return {output,ids};
}
test('main product history belongs to current page, never the first related link',()=>{
  const {output,ids}=decorateFixture({page:true});assert.deepEqual(ids,['own']);assert.match(output[0].html,/data-price-history-product="own"/);assert.equal(output.length,1);
});
test('listing histories retain the linked product and expand outside navigation anchors',()=>{
  const {output,ids}=decorateFixture({nested:true});assert.deepEqual(ids,['related']);assert.equal(output[0].anchor,true);assert.equal(output[0].where,'afterend');
});
test('new cached admin products are selectable, live fields win without mutating catalogue',()=>{
  const base={id:'one',titulo:'Produto',foto:'https://example.com/a.jpg',preco:10,ativo:true};
  const p=choices.mergeCatalogues([base],[{...base,preco:20},{...base,id:'new'}]);assert.equal(p.length,2);assert.equal(p.find(x=>x.id==='one').preco,20);assert.equal(base.preco,10);
});
test('manufacturer correction removes ANC claim and preserves daily price, links and identity',()=>{
  const p={id:'GjHJtzdsIhbmSINvhPeX',titulo:'JBL Tune 520BT',preco:258,link:'https://meli.la/example',precoAtualizadoManualmenteEm:'2026-10-05T15:55:13Z',comentario:'Cancelamento de ruído para experiência imersiva'};
  const result=correctProductData(p);assert.match(result.comentario,/Não possui cancelamento ativo/);assert.match(result.contras,/Sem cancelamento ativo/);
  for(const key of ['id','preco','link','precoAtualizadoManualmenteEm'])assert.equal(result[key],p[key]);
});
test('MatePad SE 11 uses manufacturer screen and charging data, not another model',()=>{
  const result=correctProductData({id:'dvJusdTpbTVn5ID62YpK',titulo:'MatePad SE 11'});
  assert.match(result.pros,/1920 × 1200/);assert.match(result.titulo,/22,5 W/);assert.doesNotMatch(result.pros,/120 Hz|11,5|2,2K|10 horas/);assert.match(result.titulo,/^Tablet HUAWEI/);assert.deepEqual(correctProductData(result),result);
});
test('verified HTML corrections are repeatable, retain offer and expose sources',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'rdc-editorial-'));try{
    await mkdir(join(dir,'produto'));const file=join(dir,'produto/GjHJtzdsIhbmSINvhPeX-20260810-1.html');
    const html='<meta name="description" content="old"><script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'JBL Tune 520BT',description:'old',offers:{price:258},review:{reviewBody:'old'}})+'</script><p class="summary">old</p><p class="fine source">Anúncio</p>';
    await writeFile(file,html);assert.equal(await correctGeneratedProductTitles(dir),1);assert.equal(await correctGeneratedProductTitles(dir),0);
    const fixed=await readFile(file,'utf8');assert.match(fixed,/data-verified-manufacturer/);assert.match(fixed,/"price":258/);assert.doesNotMatch(fixed,/content="old"|reviewBody":"old/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('old product ID does not apply manufacturer specifications to a different model',async()=>{
  const changed={id:'GjHJtzdsIhbmSINvhPeX',titulo:'JBL Tune 770NC',comentario:'Texto cadastrado',preco:300};
  assert.equal(correctProductData(changed).comentario,changed.comentario);
  assert.equal(manufacturerEvidence(changed),null);
  const dir=await mkdtemp(join(tmpdir(),'rdc-model-guard-'));try{
    await mkdir(join(dir,'produto'));const file=join(dir,'produto/GjHJtzdsIhbmSINvhPeX-20260810-1.html');
    const html='<h1>JBL Tune 770NC</h1><p class="summary">Texto cadastrado</p><p class="fine source">Anúncio</p>';
    await writeFile(file,html);await correctGeneratedProductTitles(dir);assert.equal(await readFile(file,'utf8'),html);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('Quad Fry and EX1500 use announced specifications, not measured performance claims',()=>{
  const fryer=correctProductData({id:'c3K3tq0esVOpmKeSLd9a',titulo:'Air fryer Elgin Quad Fry',comentario:'2 litros para aquecimento rápido',preco:180});
  assert.match(fryer.comentario,/4,2 litros/);assert.doesNotMatch(fryer.comentario,/(?<![\d,.])2 litros|aquecimento rápido/);assert.equal(fryer.preco,180);
  const router=correctProductData({id:'qZUWO8WSrcOKWVrAqTW7',titulo:'Roteador EX1500',comentario:'Excelente estabilidade de sinal'});
  assert.match(router.comentario,/Não medimos/);assert.match(router.pros,/EasyMesh/);assert.match(manufacturerEvidence(router).sourceUrl,/tp-link/);
});
test('Epson yield is qualified and unverified cosmetic claims do not receive a manufacturer seal',()=>{
  const printer=correctProductData({id:'EmrdwlcDgCCM5suoz8dB',titulo:'Epson EcoTank L3250'});
  assert.match(printer.pros,/rendimento real varia/);assert.doesNotMatch(printer.pros,/Alexa|Siri/);
  const cosmetic=correctProductData({id:'TLWfr8q21DK8xDKMh01u',titulo:'Celimax Retinal Shot Tightening Booster 15 ml para Todos os Tipos de Pele'});
  assert.equal(cosmetic.titulo,'Celimax Retinal Shot Tightening Booster 15 ml');assert.equal(manufacturerEvidence(cosmetic),null);
  assert.match(cosmetic.comentario,/Não tratamos/);assert.deepEqual(correctProductData(cosmetic),cosmetic);
});
test('seasonal promotion and WhatsApp subscription do not precede buyer content',()=>{
  const seasonal=growth.slice(growth.indexOf('  function renderSeasonalTheme('),growth.indexOf('  function renderSeasonalTheme(')+2600);
  const club=growth.slice(growth.indexOf('  function renderClub('),growth.indexOf('  async function renderAdmin('));
  assert.match(seasonal,/footer\.insertAdjacentElement\("beforebegin", banner\)/);assert.match(club,/footer\.insertAdjacentElement\("beforebegin", section\)/);
});
test('methodology distinguishes categories, weekly ranking and editorial selection',async()=>{
  const html=await source('como-avaliamos.html');for(const text of ['Comparativos por categoria','Ranking inteligente semanal','até 5 pontos','Não significa o melhor de todo o mercado','Não garantimos que toda análise'])assert.ok(html.includes(text));
});
test('JBL on-ear is not silently mixed with over-ear or unknown formats',async()=>{
  const context={window:{},Intl,URL};vm.createContext(context);vm.runInContext(await source('buyer-tools.js'),context);const api=context.window.RDCBuyerTools;
  assert.equal(api.group({title:'Fone JBL Tune 520BT Bluetooth 5.3'}),'Fones on-ear sem fio');assert.equal(api.comparable([{title:'Fone JBL Tune 520BT Bluetooth'},{title:'Headphone over-ear Bluetooth'}]),false);
});
test('legacy public product and category routes reuse published snapshots without Firestore',async()=>{
  const home=await source('index.html'),code=home.slice(home.indexOf('async function publishedRoute('),home.indexOf('let q=new URLSearchParams',home.indexOf('async function publishedRoute(')));
  const destinations=[],context={URL,SITE_URL:'https://rankingdacompra.com.br/',window:{RDCPublicData:{json:async()=>({products:[{id:'one',url:'https://rankingdacompra.com.br/produto/one-20260810-1.html'}],categories:[{id:'fones-de-ouvido'}]})}},idCategoriaPublica:x=>x,location:{replace:x=>destinations.push(x)},setSeo:()=>{},app:{innerHTML:''}};
  vm.createContext(context);vm.runInContext(code,context);await context.publishedRoute('product','one');await context.publishedRoute('category','fonesdeouvido');
  assert.deepEqual(destinations,['/produto/one-20260810-1.html','/analises.html#fones-de-ouvido']);assert.doesNotMatch(code,/collection\(|firebase|db\./i);
  await context.publishedRoute('product','missing');assert.match(context.app.innerHTML,/Conteúdo não encontrado/);assert.equal(destinations.length,2);
});
