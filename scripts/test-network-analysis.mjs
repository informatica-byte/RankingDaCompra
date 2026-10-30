import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NETWORK_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {improveProduct,CONFIG} from './visibility-editorial.mjs';

test('cinco revisões de rede têm fontes oficiais, limitações e dúvidas sem preço nem popularidade inventada',()=>{
 assert.equal(NETWORK_ANALYSES.products.length,5);
 assert.equal(new Set(NETWORK_ANALYSES.products.map(p=>p.id)).size,5);
 const hosts=['consumer.huawei.com','www.mercusys.com.br','backend.intelbras.com','www.tendacn.com','www.tp-link.com'];
 for(const p of NETWORK_ANALYSES.products){
  assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);
  assert.ok(p.questions.length>=4);assert.ok(p.limitations.length>=2);assert.ok(p.advantages.length>=2);
  assert.match(p.basis,/30\/10\/2026/);assert.ok(p.sources.every(s=>hosts.includes(new URL(s.url).hostname)));
  assert.doesNotMatch(JSON.stringify(p),/R\$|"price"\s*:|"views"\s*:|"linkAfiliado"\s*:/);
 }
});

test('análises correspondem ao modelo e à oferta registrada; fontes não são descartadas',async()=>{
 const catalogue=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));
 for(const p of NETWORK_ANALYSES.products){
  const html=await readFile(new URL('../produto/'+p.id+'-20260810-1.html',import.meta.url),'utf8');
  const schemas=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  const name=schemas.find(n=>n['@type']==='Article'&&n.about?.name)?.about.name;
  assert.equal(matchesPopularAnalysis(p,name,registeredOfferUrl(html)),true,p.id);
  assert.equal(matchesPopularAnalysis(p,name,'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB0000000000'),false,p.id);
  assert.ok(html.includes('data-reviewed-depth="'+p.id+'"'),p.id);
  for(const s of p.sources)assert.ok(html.includes(s.url),p.id+': fonte visível');
  assert.equal(catalogue.products.find(x=>x.id===p.id)?.decisionBrief?.reviewed,true,p.id);
  const poisoned={...p,sources:[{url:'https://backend.intelbras.com.evil.example/leak',label:'Falso'}]};
  assert.doesNotMatch(improveProduct(html,poisoned),/href="https:\/\/backend\.intelbras\.com\.evil\.example/);
 }
});

test('contradição do AX2S e fonte estrangeira Tenda permanecem explícitas; módulo não vira kit',()=>{
 const byId=new Map(NETWORK_ANALYSES.products.map(p=>[p.id,p]));
 assert.match(byId.get('YuOWci2UixF5GuQE6IYS').publicSummary,/portas.*contraditória/);
 assert.match(byId.get('mlMLB4801704305').basis,/France|regional/);
 assert.match(byId.get('sMCnNBstxTrJqaF6jp2O').publicSummary,/Uma unidade não equivale/);
 assert.match(byId.get('LUsq533hX6lTuHwnZbhz').publicSummary,/1-pack/);
});
