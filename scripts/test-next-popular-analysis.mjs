import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NEXT_POPULAR_ANALYSES,POPULAR_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {FEATURED_ANALYSES,CONFIG,resolveEditorialProduct,improveProduct} from './visibility-editorial.mjs';
import {informationalHtml,affiliateLinks,assertInformationalHtml} from './informational-site.mjs';
import {localRemovals} from './product-removals.mjs';
const root=new URL('..',import.meta.url),path=decodeURIComponent(root.pathname.replace(/^\/([A-Z]:)/,'$1'));
const read=file=>readFile(new URL(file,root),'utf8');
const normalize=html=>html.replace(/\r\n/g,'\n');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('continuação cobre quatorze produtos de seis/sete visualizações sem repetir as 28 análises anteriores',async()=>{
 const original=JSON.parse(await read('visibility-editorial.json'));
 const reviewed=new Set([...original.products,...FEATURED_ANALYSES.products,...POPULAR_ANALYSES.products].map(p=>p.id));
 assert.equal(reviewed.size,28);assert.equal(NEXT_POPULAR_ANALYSES.products.length,14);
 assert.equal(NEXT_POPULAR_ANALYSES.reviewedAt,'2026-10-27');
 assert.equal(NEXT_POPULAR_ANALYSES.priority.dateFrom,POPULAR_ANALYSES.priority.dateFrom);
 assert.equal(NEXT_POPULAR_ANALYSES.priority.dateTo,POPULAR_ANALYSES.priority.dateTo);
 assert.equal(NEXT_POPULAR_ANALYSES.priority.metric,'screen_page_views');assert.match(NEXT_POPULAR_ANALYSES.priority.method,/testes e repetições/);
 for(const p of NEXT_POPULAR_ANALYSES.products){
  assert.equal(reviewed.has(p.id),false,p.id+': não repetir');assert.ok([6,7].includes(p.views));
  assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);
  for(const field of ['basis','fit','tradeoff','check','alternative','publicSummary'])assert.ok(p[field].length>=70,p.id+': '+field);
  assert.ok(p.advantages.length>=2);assert.ok(p.limitations.length>=2);assert.ok(p.questions.length>=4);assert.ok(p.sources.length);
  assert.doesNotMatch(JSON.stringify(p),/R\$|"(?:price|preco|linkAfiliado|rating|nota)"\s*:/);
 }
});

test('novas páginas preservam afiliados, identidade e fontes; regeneração e CRLF são estáveis',async()=>{
 const deleted=new Set((await localRemovals(path)).ids),feed=JSON.parse(await read('informational-catalogue.json'));
 for(const p of NEXT_POPULAR_ANALYSES.products){
  if(deleted.has(p.id)){await assert.rejects(read('produto/'+p.id+'-20260810-1.html'),{code:'ENOENT'});continue;}
  const item=CONFIG.products.find(x=>x.id===p.id),page=await resolveEditorialProduct(path,item);if(page.inactive)continue;
  const {html,file}=page;assert.match(html,new RegExp('data-reviewed-depth="'+p.id+'"'));assert.doesNotMatch(html,/data-informational-faq/);
  assert.ok(html.includes(esc(p.publicSummary)));assert.equal((html.match(/visibility-editorial:start/g)||[]).length,1);
  assert.match(html,/27\/10\/2026/);for(const source of p.sources)assert.ok(html.includes('href="'+esc(source.url)+'"'),p.id+': fonte');
  const out=informationalHtml(improveProduct(html,page.item),{id:p.id},file);
  assert.equal(normalize(out),normalize(html));assert.deepEqual(affiliateLinks(out),affiliateLinks(html));assertInformationalHtml(out,file);
  assert.equal(registeredOfferUrl(out),registeredOfferUrl(html));
  const crlf=html.replace(/\r?\n/g,'\r\n');assert.equal(normalize(informationalHtml(improveProduct(crlf,page.item),{id:p.id},file)),normalize(html));
  const legacy=html.replace(/<script\b([^>]*type="application\/ld\+json"[^>]*)>([\s\S]*?)<\/script>/gi,(_tag,attrs,json)=>{
   const data=JSON.parse(json);for(const node of data['@graph']||[data])if(node['@type']==='Article'&&String(node.mainEntityOfPage).includes('/produto/'+p.id+'-')){node['@type']='Product';node.name=node.about.name;node.url=node.mainEntityOfPage;delete node.about;delete node.mainEntityOfPage;delete node.headline;}
   return '<script'+attrs+'>'+JSON.stringify(data)+'</script>';
  });
  const migrated=informationalHtml(improveProduct(legacy,page.item),{id:p.id},file);assert.equal(informationalHtml(improveProduct(migrated,page.item),{id:p.id},file),migrated);
  const wrong=html.replace(/name="rdc-offer-url" content="[^"]*"/,'name="rdc-offer-url" content="https://www.mercadolivre.com.br/p/MLB123?wid=MLB1234567890"');assert.equal(improveProduct(wrong,page.item),wrong,'outra oferta não recebe a análise');
  const projection=feed.products.find(x=>x.id===p.id);assert.ok(projection);assert.ok(projection.summary.startsWith(p.publicSummary.slice(0,60)));if(p.publicName)assert.equal(projection.title,p.publicName);
 }
});

test('P30i separa bateria no fone e estojo e não mascara a divergência de Bluetooth',async()=>{
 const p=NEXT_POPULAR_ANALYSES.products.find(p=>p.id==='ZVVdy8TuP0yW0XNIyiEA');
 assert.match(p.publicSummary,/10 horas/);assert.match(p.publicSummary,/45 horas no total/);assert.match(p.basis,/5\.3/);assert.match(p.basis,/5\.4/);
 const feed=JSON.parse(await read('informational-catalogue.json')),row=feed.products.find(x=>x.id===p.id);
 if(!row){
  if((await localRemovals(path)).ids.includes(p.id))await assert.rejects(read('produto/'+p.id+'-20260810-1.html'),{code:'ENOENT'});
  else assert.equal((await resolveEditorialProduct(path,CONFIG.products.find(x=>x.id===p.id))).inactive,true,'só pausa/retirada explícita permite ausência do catálogo');
  return;
 }
 assert.equal(row.comparison.family,'fone-tws');assert.deepEqual(row.comparison.features,p.comparisonFeatures);
 const features=new Map(row.comparison.features.map(x=>[x.label,x]));
 assert.match(features.get('Autonomia no fone').value,/10 h.*7 h/);assert.doesNotMatch(features.get('Autonomia no fone').value,/45/);
 assert.match(features.get('Autonomia com estojo').value,/45 h.*30 h/);assert.equal(features.get('Versão Bluetooth').state,'unknown');
});

test('alegações inconsistentes ficam sinalizadas sem criar unidade, modelo ou desempenho substitutos',()=>{
 const byId=new Map(NEXT_POPULAR_ANALYSES.products.map(p=>[p.id,p]));
 const cshock=byId.get('zLqKcRRYNyzrP6t1Erhh');assert.match(cshock.publicSummary,/50 kg/);assert.match(cshock.publicSummary,/não usamos/);assert.match(cshock.questions[0][1],/não.*50 g/);assert.doesNotMatch(cshock.advantages.join(' '),/50 kg/);
 assert.doesNotMatch(byId.get('xdMGqRvHv2lJ95LaBG9F').publicName,/mais forte/i);
 assert.match(byId.get('u3QrSb6J4YcZTM5ehgRb').publicSummary,/não deve.*nativa em 4K/);
 assert.match(byId.get('ucknzxk5UJWl0GnOXadP').publicSummary,/127\/220 V.*sem esclarecimento/);
 assert.match(byId.get('MCdK7VlagX4qYFEKn6D9').publicSummary,/não foi validado/);
 assert.match(byId.get('InsaA7npZ9l5Qf6jByiC').basis,/não a identidade exata/);
});

test('catálogo MLBU também exige caminho exato e recusa item de vendedor divergente',()=>{
 const ex=NEXT_POPULAR_ANALYSES.products.find(p=>p.id==='qZUWO8WSrcOKWVrAqTW7'),url='https://www.mercadolivre.com.br/up/MLBU4043490754';
 assert.equal(matchesPopularAnalysis(ex,'TP-Link EX1500',url),true);
 assert.equal(matchesPopularAnalysis(ex,'TP-Link EX1500',url+'?wid=MLB9999999999'),false);
 assert.equal(matchesPopularAnalysis(ex,'TP-Link EX2200',url),false);
 assert.equal(matchesPopularAnalysis(ex,'TP-Link EX1500',url+'0'),false);
});
