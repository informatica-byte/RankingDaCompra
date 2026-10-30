import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DOCUMENTED_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {CONFIG} from './visibility-editorial.mjs';

test('novo lote tem oito modelos únicos, fontes oficiais, limites e perguntas específicas',()=>{
 const products=DOCUMENTED_ANALYSES.products;
 assert.equal(products.length,8);assert.equal(new Set(products.map(p=>p.id)).size,8);
 for(const p of products){
  assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);
  assert.ok(p.questions.length>=4);assert.ok(p.limitations.length>=2);assert.ok(p.advantages.length>=2);
  assert.match(p.basis,/30\/10\/2026/);
  assert.ok(p.sources.every(s=>['www.logitech.com','www.tp-link.com','www.jbl.com.br'].includes(new URL(s.url).hostname)));
  assert.doesNotMatch(JSON.stringify(p),/R\$|"price"\s*:|"linkAfiliado"\s*:|"views"\s*:/);
  assert.equal(matchesPopularAnalysis(p,p.publicName||p.guard.replaceAll('.*',' '),'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB0000000000'),false);
 }
});

test('oito revisões correspondem à identidade registrada e estão visíveis no HTML',async()=>{
 for(const p of DOCUMENTED_ANALYSES.products){
  const html=await readFile(new URL('../produto/'+p.id+'-20260810-1.html',import.meta.url),'utf8');
  const schemas=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  const name=schemas.find(n=>n['@type']==='Article'&&n.about?.name)?.about.name;
  assert.equal(matchesPopularAnalysis(p,name,registeredOfferUrl(html)),true,p.id);
  assert.equal(matchesPopularAnalysis(p,name,'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB0000000000'),false,p.id+': vendedor diferente deve ser rejeitado');
  assert.ok(html.includes('data-reviewed-depth="'+p.id+'"'),p.id);
  for(const source of p.sources)assert.ok(html.includes(source.url),p.id+': fonte publicada');
 }
});

test('Go 4 corrige IP67 e C500 mantém explícita a revisão ainda não confirmada',async()=>{
 const go=DOCUMENTED_ANALYSES.products.find(p=>p.id==='jXr2Y2GPpfN57sjqnpfV');
 assert.match(go.publicSummary,/IP67/);assert.doesNotMatch(go.publicSummary,/IPX7/);
 const c=DOCUMENTED_ANALYSES.products.find(p=>p.id==='VaxspecNzGrFQjieZlq0');
 assert.match(c.publicName,/revisão a confirmar/);assert.match(c.publicSummary,/V1/);assert.match(c.publicSummary,/V2\.80/);
 const catalogue=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));
 for(const review of DOCUMENTED_ANALYSES.products)assert.equal(catalogue.products.find(p=>p.id===review.id)?.decisionBrief?.reviewed,true,review.id);
});
