import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HOME_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {CONFIG,improveProduct} from './visibility-editorial.mjs';

test('cinco revisões de casa têm fontes, limites e dúvidas sem valores ou métricas inventadas',()=>{
 assert.equal(HOME_ANALYSES.products.length,5);assert.equal(new Set(HOME_ANALYSES.products.map(p=>p.id)).size,5);
 for(const p of HOME_ANALYSES.products){
  assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);
  assert.ok(p.questions.length>=4);assert.ok(p.limitations.length>=2);assert.ok(p.advantages.length>=2);
  assert.match(p.basis,/30\/10\/2026/);
  assert.ok(p.sources.every(s=>['www.mondial.com.br','manuais.emondial.com','loja.electrolux.com.br'].includes(new URL(s.url).hostname)));
  assert.doesNotMatch(JSON.stringify(p),/R\$|"price"\s*:|"views"\s*:|"linkAfiliado"\s*:/);
 }
});

test('as cinco fichas têm revisão e fontes visíveis, com correspondência estrita da oferta',async()=>{
 const catalogue=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));
 for(const p of HOME_ANALYSES.products){
  const html=await readFile(new URL('../produto/'+p.id+'-20260810-1.html',import.meta.url),'utf8');
  const schemas=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  const name=schemas.find(n=>n['@type']==='Article'&&n.about?.name)?.about.name;
  assert.equal(matchesPopularAnalysis(p,name,registeredOfferUrl(html)),true,p.id);
  assert.equal(matchesPopularAnalysis(p,name,'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB0000000000'),false,p.id);
  assert.ok(html.includes('data-reviewed-depth="'+p.id+'"'),p.id);
  for(const source of p.sources)assert.ok(html.includes(source.url),p.id+': fonte publicada');
  assert.equal(catalogue.products.find(x=>x.id===p.id)?.decisionBrief?.reviewed,true,p.id);
  assert.doesNotMatch(improveProduct(html,{...p,sources:[{url:'https://www.mondial.com.br.evil.example/falso',label:'Falso'}]}),/href="https:\/\/www\.mondial\.com\.br\.evil\.example/);
 }
});

test('capacidade útil, potência por tensão e variante sem ruído medido ficam diferenciadas',()=>{
 const get=id=>HOME_ANALYSES.products.find(p=>p.id===id);
 assert.match(get('DNqszoYPu5LLhotuYNKp').publicSummary,/3 litros.*5 litros/);
 assert.match(get('nsOTlMwVIdo8dNOdpShY').publicSummary,/2\.000 W em 127 V.*2\.200 W em 220 V/);
 assert.match(get('Ng9qQNFdPCPMTgUYzfEJ').publicSummary,/não comprova ausência de ruído/);
 assert.match(get('wyofwkDoOxUtpmtG9uhf').basis,/potência inconsistente/);
});
