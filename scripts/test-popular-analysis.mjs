import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {POPULAR_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {FEATURED_ANALYSES,CONFIG,improveProduct,resolveEditorialProduct} from './visibility-editorial.mjs';
import {affiliateLinks,assertInformationalHtml,informationalHtml} from './informational-site.mjs';
import {localRemovals} from './product-removals.mjs';
const root=new URL('..',import.meta.url),rootPath=decodeURIComponent(root.pathname.replace(/^\/([A-Z]:)/,'$1'));
const read=path=>readFile(new URL(path,root),'utf8');

test('lote prioriza treze páginas por visualizações, sem apresentar vendas ou repetir os sete destaques',()=>{
 const {priority,products}=POPULAR_ANALYSES;
 assert.equal(priority.dateFrom,'2026-09-28');assert.equal(priority.dateTo,'2026-10-25');
 assert.equal(priority.metric,'screen_page_views');assert.match(priority.method,/testes e repetições/);
 assert.equal(products.length,13);assert.equal(new Set(products.map(p=>p.id)).size,13);
 const previous=new Set(FEATURED_ANALYSES.products.map(p=>p.id));
 for(const p of products){
  assert.ok(p.views>=8);assert.equal(previous.has(p.id),false);assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);
  for(const field of ['fit','tradeoff','basis','check','alternative','publicSummary'])assert.ok(p[field]?.length>=70,p.id+': '+field);
  assert.ok(p.questions.length>=4);assert.ok(p.advantages.length>=2);assert.ok(p.limitations.length>=2);assert.ok(p.sources.length);
  assert.doesNotMatch(JSON.stringify(p),/R\$|"(?:price|preco|linkAfiliado|rating|nota)"\s*:/);
  for(const [q,a]of p.questions){assert.ok(q.length>12);assert.ok(a.length>40);}
 }
});

test('identidade exige todos os códigos de vendedor compatíveis, sem usar código de catálogo como anúncio',()=>{
 const hp=POPULAR_ANALYSES.products.find(p=>p.id==='hokaCwafFsMcmt9QPBdX');
 const base='https://www.mercadolivre.com.br/p/MLB28305243';
 assert.equal(matchesPopularAnalysis(hp,'HP 135a',base+'?pdp_filters=item_id%3AMLB4218581805'),true);
 assert.equal(matchesPopularAnalysis(hp,'HP 135a',base+'#wid=MLB4218581805'),true);
 for(const link of [base,base+'?wid=MLB9999999999',base+'?wid=MLB4218581805#wid=MLB9999999999',base+'?pdp_filters=item_id:MLB4218581805|item_id:MLB9999999999','https://meli.la/test','https://www.mercadolivre.com.br.evil.example/p/x?wid=MLB4218581805','https://user:secret@www.mercadolivre.com.br/p/x?wid=MLB4218581805'])assert.equal(matchesPopularAnalysis(hp,'HP 135a',link),false,link);
 assert.equal(matchesPopularAnalysis(hp,'HP 135w',base+'?wid=MLB4218581805'),false);
 const scooter=POPULAR_ANALYSES.products.find(p=>p.expectedCatalogue==='MLB54428983');
 assert.equal(matchesPopularAnalysis(scooter,'Xplore 48 V/12 Ah/500 W','https://www.mercadolivre.com.br/p/MLB54428983'),true);
 assert.equal(matchesPopularAnalysis(scooter,'Xplore 48 V/12 Ah/500 W','https://www.mercadolivre.com.br/p/MLB54428983?wid=MLB9999999999'),false);
});

test('perguntas enfrentam limitações específicas sem garantir medicina, dispensa de CNH ou compatibilidade universal',()=>{
 const byId=new Map(POPULAR_ANALYSES.products.map(p=>[p.id,p]));
 const scooter=byId.get('oVBbvfcldF36EbyYex8y');assert.doesNotMatch(scooter.publicName,/sem CNH/i);assert.match(scooter.publicSummary,/não é uma conclusão/);
 assert.match(byId.get('gmzJCKnbLsVLIZilQGSe').publicSummary,/não comprovam indicação terapêutica/);
 assert.match(byId.get('hokaCwafFsMcmt9QPBdX').publicSummary,/não Wi-Fi/);
 assert.match(byId.get('2e2m7sDdRyGHq1Tzj8ra').publicSummary,/não uma garantia/);
 assert.match(byId.get('9Y8FuG1gZwVywVcUHPCg').publicSummary,/unidade externa/);
 assert.match(byId.get('UkgpEmnU2nSDUmOujW6W').basis,/22\/10\/2026/);
 assert.match(byId.get('N1cKmru7WcRrMBSj4ut7').limitations.join(' '),/não permite concluir/);
});

test('páginas, FAQ e projeção pública usam a revisão sem modificar afiliados, canonical ou cadastros',async()=>{
 const feed=JSON.parse(await read('informational-catalogue.json')),deleted=new Set((await localRemovals(rootPath)).ids);
 for(const entry of POPULAR_ANALYSES.products){
  if(deleted.has(entry.id)){await assert.rejects(read('produto/'+entry.id+'-20260810-1.html'),{code:'ENOENT'});continue;}
  const item=CONFIG.products.find(p=>p.id===entry.id),page=await resolveEditorialProduct(rootPath,item);
  if(page.inactive){assert.doesNotMatch(page.html,/data-reviewed-depth=/);continue;}
  const html=page.html;
  assert.ok(html.includes('data-reviewed-depth="'+entry.id+'"'),entry.id);
  assert.equal((html.match(/visibility-editorial:start/g)||[]).length,1);
  const out=informationalHtml(improveProduct(html,page.item),{id:entry.id},page.file);
  assert.equal(out,html,entry.id+': idempotência');assert.deepEqual(affiliateLinks(out),affiliateLinks(html));assertInformationalHtml(out,page.file);
  assert.equal(registeredOfferUrl(out),registeredOfferUrl(html));assert.doesNotMatch(html,/data-informational-faq/);
  assert.match(html,new RegExp(entry.publicSummary.slice(0,35).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  const projection=feed.products.find(p=>p.id===entry.id);assert.ok(projection);assert.ok(projection.summary.startsWith(entry.publicSummary.slice(0,50)));
  if(entry.publicName)assert.equal(projection.title,entry.publicName);
  const wrong=html.replace(/name="rdc-offer-url" content="[^"]*"/,'name="rdc-offer-url" content="https://www.mercadolivre.com.br/p/MLB123?wid=MLB1234567890"');
  assert.equal(improveProduct(wrong,page.item),wrong,'não limpar ou substituir análise quando outro anúncio estiver na página');
  for(const source of entry.sources)assert.ok(html.includes('href="'+source.url.replace(/&/g,'&amp;')+'"'),'fonte acessível: '+source.url);
 }
});

test('resumo e listas são escapados; nomes públicos mantêm o modelo e URLs externas continuam restritas',async()=>{
 const item=CONFIG.products.find(p=>p.id==='gmzJCKnbLsVLIZilQGSe');
 if((await localRemovals(rootPath)).ids.includes(item.id)){await assert.rejects(read('produto/'+item.id+'-20260810-1.html'),{code:'ENOENT'});return;}
 const page=await resolveEditorialProduct(rootPath,item);
 if(page.inactive)return;
 const out=improveProduct(page.html,{...item,publicSummary:'<svg onload="alert(1)">',advantages:['<img src=x onerror=1>'],limitations:['<script>x</script>'],publicName:'<iframe src="javascript:1">',sources:[{url:'https://support.hp.com.evil.example/',label:'falsa'}]});
 assert.ok(out.includes('&lt;svg'));assert.ok(out.includes('&lt;iframe'));assert.ok(out.includes('&lt;img'));assert.doesNotMatch(out,/<svg onload|<iframe src="javascript|href="https:\/\/support\.hp\.com\.evil/);
});
