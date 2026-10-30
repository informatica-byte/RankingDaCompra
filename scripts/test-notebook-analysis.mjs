import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NOTEBOOK_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {CONFIG,improveProduct} from './visibility-editorial.mjs';

test('três notebooks usam código e fontes oficiais, com dúvidas e limites sem métricas inventadas',()=>{
 assert.equal(NOTEBOOK_ANALYSES.products.length,3);assert.equal(new Set(NOTEBOOK_ANALYSES.products.map(p=>p.id)).size,3);
 for(const p of NOTEBOOK_ANALYSES.products){
  assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);assert.ok(p.questions.length>=4);assert.ok(p.advantages.length>=2);assert.ok(p.limitations.length>=2);
  assert.match(p.basis,/30\/10\/2026/);assert.ok(p.sources.every(s=>['br.store.asus.com','psref.lenovo.com'].includes(new URL(s.url).hostname)));
  assert.doesNotMatch(JSON.stringify(p),/R\$|"price"\s*:|"views"\s*:|"linkAfiliado"\s*:/);
 }
});

test('revisões e fontes estão visíveis para o mesmo produto e recusam outra oferta',async()=>{
 const catalogue=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));
 for(const p of NOTEBOOK_ANALYSES.products){
  const html=await readFile(new URL('../produto/'+p.id+'-20260810-1.html',import.meta.url),'utf8');
  const schemas=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  const name=schemas.find(n=>n['@type']==='Article'&&n.about?.name)?.about.name;
  assert.equal(matchesPopularAnalysis(p,name,registeredOfferUrl(html)),true,p.id);
  assert.equal(matchesPopularAnalysis(p,name,'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB0000000000'),false,p.id);
  assert.ok(html.includes('data-reviewed-depth="'+p.id+'"'),p.id);for(const s of p.sources)assert.ok(html.includes(s.url),p.id);
  assert.equal(catalogue.products.find(x=>x.id===p.id)?.decisionBrief?.reviewed,true,p.id);
  assert.doesNotMatch(improveProduct(html,{...p,sources:[{url:'https://psref.lenovo.com.evil.example/falso',label:'Falso'}]}),/href="https:\/\/psref\.lenovo\.com\.evil\.example/);
 }
});

test('processador divergente permanece incerto; código e RAM instalada não viram máximo da plataforma',async()=>{
 const html=await readFile(new URL('../produto/a77W30LAOCEPjWdkcAlU-20260810-1.html',import.meta.url),'utf8');assert.match(html,/<h1[^>]*>[^<]*processador a confirmar/);
 const search=JSON.parse(await readFile(new URL('../search-index.json',import.meta.url),'utf8'));assert.match(search.products.find(p=>p.id==='a77W30LAOCEPjWdkcAlU').title,/processador a confirmar/);
 const go=NOTEBOOK_ANALYSES.products.find(p=>p.id==='a77W30LAOCEPjWdkcAlU');assert.match(go.publicSummary,/7520U.*Ryzen 5 40/);
 const lenovo=NOTEBOOK_ANALYSES.products.find(p=>p.id==='OJulxennkkhusiTWA3Wt');assert.match(lenovo.publicSummary,/8 GB DDR5 soldados/);assert.match(lenovo.limitations.join(' '),/máxima.*RAM instalada/);
});
