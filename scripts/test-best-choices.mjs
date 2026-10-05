import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import choices from '../best-choices.js';
import titles from '../promotion-title.js';
import {publicSiteConfig} from './public-site-config.mjs';
const now=Date.parse('2026-10-05T12:00:00Z');
const product=(id,extra={})=>({id,titulo:'Fone Bluetooth '+id,foto:'https://example.com/'+id+'.jpg',preco:80,categoria:'fones',comentario:'Confira autonomia e compatibilidade no anúncio.',...extra});
const guides=Array.from({length:8},(_,i)=>({url:'melhores-categoria-'+i+'.html',title:'Compare categoria '+i,summary:'Usos e limitações'}));

test('scripts novos compõem JavaScript válido antes da publicação',async()=>{
  for(const file of ['best-choices.js','best-choices-admin.js','best-choices-page.js','promotion-title.js','public-data.js']){
    const source=await readFile(file,'utf8');assert.doesNotThrow(()=>new vm.Script(source),file);
  }
});

test('seleção permanente conserva ordem, não vence e aceita esvaziamento explícito',()=>{
  const products=[product('a',{promocaoAtiva:false,promocaoValidaAte:'2020-01-01'}),product('b')];
  assert.deepEqual(choices.selectProducts(products,{bestChoicesProductIds:['b','a','b']}).map(p=>p.id),['b','a']);
  assert.deepEqual(choices.selectProducts(products,{bestChoicesProductIds:[]}),[]);
  const config={bestChoicesProductIds:['a']};
  assert.equal(choices.selectProducts([product('a',{indisponivel:true})],config).length,0);
  assert.deepEqual(config.bestChoicesProductIds,['a']);
});

test('cache público admite somente os novos snapshots e mantém deduplicação econômica',async()=>{
  let calls=0;
  const context={window:{},fetch:async()=>{calls++;return {ok:true,json:async()=>({guides:[]})};},Map,Date,Promise,Error};
  vm.runInNewContext(await readFile('public-data.js','utf8'),context);
  const reader=context.window.RDCPublicData;
  await Promise.all([reader.json('/best-choices-guides.json'),reader.json('/best-choices-guides.json')]);
  assert.equal(calls,1);
  await reader.json('/mercadolivre-status.json');assert.equal(calls,2);
  await assert.rejects(reader.json('/configuracoes-privadas.json'));
  await assert.rejects(reader.json('https://example.com/site-config.json'));
});
test('migração aproveita seis promoções recentes uma vez e mantém vídeos e temas',()=>{
  const products=Array.from({length:9},(_,i)=>product('p'+i,{promocaoAtiva:true,promocaoValidaAte:'2026-10-04'}));
  const original={youtubeShowcaseEnabled:true,youtubeShowcaseLinks:['https://youtu.be/abcdefghijk'],seasonalThemeMode:'auto'};
  const seeded=choices.seedConfig(original,products,guides);
  assert.equal(seeded.bestChoicesProductIds.length,6);assert.equal(seeded.bestChoicesGuideUrls.length,3);
  assert.equal(seeded.youtubeShowcaseLinks,original.youtubeShowcaseLinks);
  assert.equal(seeded.seasonalThemeMode,'auto');assert.equal(original.bestChoicesProductIds,undefined);
  assert.deepEqual(choices.seedConfig(seeded,[],guides).bestChoicesProductIds,seeded.bestChoicesProductIds);
});
test('limites são doze produtos e seis guias existentes, sem autorreferência',()=>{
  const products=Array.from({length:20},(_,i)=>product('p'+i));
  assert.equal(choices.selectProducts(products,{bestChoicesProductIds:products.map(p=>p.id)}).length,12);
  assert.equal(choices.selectGuides(guides,{bestChoicesGuideUrls:guides.map(g=>g.url)}).length,6);
  assert.equal(choices.selectGuides([{url:choices.PAGE},{url:'https://example.com/melhores-x.html'}],{bestChoicesGuideUrls:[choices.PAGE,'https://example.com/melhores-x.html']}).length,0);
});
test('conferência manual recente prevalece sobre bloqueio da API sem ampliar 24 horas',()=>{
  const p=product('a',{precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:'2026-10-05T10:00:00Z'});
  const blocked={managed:true,status:'blocked',available:false,price:70,checkedAt:'2026-10-05T11:00:00Z'};
  assert.equal(choices.priceState(p,blocked,now).confirmed,true);assert.equal(choices.priceState(p,blocked,now).value,80);
  assert.equal(choices.priceState(p,{},now+86400000).confirmed,false);
  assert.equal(choices.priceState({...p,precoAtualizadoManualmenteEm:'2026-10-06T10:00:00Z'},{},now).confirmed,false);
  assert.equal(choices.priceState(product('a'),{},now).confirmed,false);
});
test('API precisa de observação válida e vence manual somente quando mais recente',()=>{
  const p=product('a',{precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:'2026-10-05T10:00:00Z'});
  const api={managed:true,status:'active',available:true,price:90,checkedAt:'2026-10-05T11:00:00Z'};
  assert.equal(choices.priceState(p,api,now).source,'api');assert.equal(choices.priceState(p,api,now).value,90);
  assert.equal(choices.priceState(p,{...api,checkedAt:'2026-10-05T09:00:00Z'},now).source,'manual');
  assert.equal(choices.priceState(product('a'),{...api,checkedAt:'2026-10-06T09:00:00Z'},now).confirmed,false);
  assert.equal(choices.priceState(product('a'),{...api,price:0},now).confirmed,false);
});
test('preço promocional vencido não é apresentado como promoção vigente',()=>{
  const p=product('a',{promocaoAtiva:true,promocaoValidaAte:'2026-10-04',precoAnterior:100,precoPromocional:20,precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:'2026-10-05T10:00:00Z'});
  assert.equal(choices.priceState(p,{},now).value,80);
  assert.equal(choices.priceState({...p,promocaoValidaAte:'2026-10-05'}, {},now).value,20);
});
test('título permanente não promete hoje, categoria falsa ou teto sem preço recente',()=>{
  assert.equal(titles.checkChoices('Melhores escolhas de hoje: fones Bluetooth',[product('a')]).valid,false);
  assert.equal(titles.checkChoices('Melhores fones Bluetooth para comparar',[product('a'),product('b',{titulo:'Roteador Wi-Fi'})]).valid,false);
  const candidate='Melhores fones Bluetooth até R$ 100';
  assert.equal(choices.title(candidate,[product('a')],titles,{},now),choices.DEFAULT_TITLE);
  const checked=product('a',{precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:'2026-10-05T10:00:00Z'});
  assert.equal(choices.title(candidate,[checked],titles,{},now),candidate);
  assert.equal(choices.title(candidate,[checked],titles,{},now+86400000),choices.DEFAULT_TITLE);
});
test('cartões escapam conteúdo e não atribuem posição ou vitória entre categorias',()=>{
  const html=choices.productCards([product('a',{titulo:'Fone <script>alert(1)</script> "A"',comentario:'<b>Autonomia</b> & conforto'})],{},now);
  assert.doesNotMatch(html,/<script>|onclick=|#1|Melhor geral/);assert.match(html,/&lt;script&gt;/);assert.match(html,/Autonomia &amp; conforto/);assert.match(html,/Último preço cadastrado/);
  assert.match(choices.guideCards([{url:'melhores-fones.html',title:'Fones & usos',summary:'<imagem>'}]),/Fones &amp; usos/);
});
test('publicação preserva seleção vazia, configuração antiga e rejeita IDs/URLs inseguros',()=>{
  const original={promotionSeoTitle:'Título anterior preservado',youtubeShowcaseEnabled:false,bestChoicesProductIds:['a'],bestChoicesGuideUrls:[guides[0].url]};
  const updated=publicSiteConfig(original,{bestChoicesProductIds:[],bestChoicesTitle:choices.DEFAULT_TITLE});
  assert.deepEqual(updated.bestChoicesProductIds,[]);assert.equal(updated.promotionSeoTitle,original.promotionSeoTitle);assert.equal(updated.youtubeShowcaseEnabled,false);
  assert.throws(()=>publicSiteConfig({}, {bestChoicesProductIds:['../../x']}));
  assert.throws(()=>publicSiteConfig({}, {bestChoicesGuideUrls:[choices.PAGE]}));
  assert.throws(()=>publicSiteConfig({}, {bestChoicesProductIds:Array(13).fill('a')}));
});
test('publicadores reconstroem seleção estática após preços sem nova consulta do Firebase',async()=>{
  for(const workflow of ['update-sitemap','sync-mercadolivre']) {
    const source=await readFile('.github/workflows/'+workflow+'.yml','utf8');
    assert.ok(source.indexOf('node scripts/generate-home-static.mjs')<source.indexOf('node scripts/generate-best-choices.mjs'));
    assert.match(source,/git add[^\n]+best-choices-guides\.json/);
  }
  for(const file of ['best-choices.js','best-choices-page.js','scripts/generate-best-choices.mjs'])assert.doesNotMatch(await readFile(file,'utf8'),/getDocs|db\.collection|firebase\.firestore/);
  const home=await readFile('index.html','utf8');assert.match(home,/todos\.filter\(ofertaRelampagoValida\)[\s\S]{0,230}\.slice\(0, 3\)/);
  const mobile=await readFile('painel-celular.html','utf8');assert.match(mobile,/const salvo = await addDoc/);assert.match(mobile,/bestChoicesProductIds:\[\.\.\.new Set\(\[salvo\.id,\.\.\.ids\]\)\]/);
});
test('página permanente tem HTML rastreável, canônico, categorias e sitemap sem Offer inventado',async()=>{
  const html=await readFile(choices.PAGE,'utf8'),sitemap=await readFile('sitemap.xml','utf8');
  assert.match(html,/<h1>[^<]+<\/h1>/);assert.match(html,/data-best-choices="true"/);
  assert.match(html,/<link rel="canonical" href="https:\/\/rankingdacompra\.com\.br\/melhores-escolhas\.html">/);
  assert.match(html,/CollectionPage/);assert.doesNotMatch(html,/"@type":"Offer"/);assert.match(html,/best-guide-card/);assert.match(html,/og-ranking-da-compra\.png/);
  assert.equal((sitemap.match(/<loc>https:\/\/rankingdacompra\.com\.br\/melhores-escolhas\.html<\/loc>/g)||[]).length,1);
});
