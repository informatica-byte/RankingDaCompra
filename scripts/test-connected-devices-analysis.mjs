import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CONNECTED_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {CONFIG,improveProduct} from './visibility-editorial.mjs';

test('quatro análises novas têm fontes, limites e perguntas sem métricas inventadas',()=>{
 assert.equal(CONNECTED_ANALYSES.products.length,4);assert.equal(new Set(CONNECTED_ANALYSES.products.map(p=>p.id)).size,4);
 for(const p of CONNECTED_ANALYSES.products){
  assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);assert.ok(p.questions.length>=4);assert.ok(p.advantages.length>=2);assert.ok(p.limitations.length>=2);
  assert.match(p.basis,/30\/10\/2026/);assert.ok(p.sources.every(s=>['consumer.huawei.com','www.mercusys.com.br','www.lg.com','us.amazfit.com'].includes(new URL(s.url).hostname)));
  assert.doesNotMatch(JSON.stringify(p),/R\$|"price"\s*:|"views"\s*:|"linkAfiliado"\s*:/);
 }
});

test('revisões visíveis correspondem à oferta; fonte com domínio parecido continua recusada',async()=>{
 const catalogue=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));
 for(const p of CONNECTED_ANALYSES.products){
  const html=await readFile(new URL('../produto/'+p.id+'-20260810-1.html',import.meta.url),'utf8');
  const schemas=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  const name=schemas.find(n=>n['@type']==='Article'&&n.about?.name)?.about.name;
  assert.equal(matchesPopularAnalysis(p,name,registeredOfferUrl(html)),true,p.id);
  assert.equal(matchesPopularAnalysis(p,name,'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB0000000000'),false,p.id);
  assert.ok(html.includes('data-reviewed-depth="'+p.id+'"'),p.id);for(const source of p.sources)assert.ok(html.includes(source.url),p.id);
  assert.equal(catalogue.products.find(x=>x.id===p.id)?.decisionBrief?.reviewed,true,p.id);
  assert.doesNotMatch(improveProduct(html,{...p,sources:[{url:'https://us.amazfit.com.evil.example/falso',label:'Falso'}]}),/href="https:\/\/us\.amazfit\.com\.evil\.example/);
 }
});

test('unidades erradas BE3 saem da ficha e da busca; MBR e chamadas Bluetooth mantêm suas condições',async()=>{
 const h=await readFile(new URL('../produto/mlMLB6907306094-20260810-1.html',import.meta.url),'utf8');assert.doesNotMatch(h,/450Kb\/s|71,5 m(?!m)/);
 const search=JSON.parse(await readFile(new URL('../search-index.json',import.meta.url),'utf8'));assert.doesNotMatch(search.products.find(p=>p.id==='mlMLB6907306094').summary,/450Kb\/s|71,5 m(?!m)/);
 const get=id=>CONNECTED_ANALYSES.products.find(p=>p.id===id);
 assert.match(get('XDnd73z0ZIkihILVyQhX').limitations.join(' '),/não opera com FreeSync/);
 assert.match(get('9P123IBTTYnSCMilPvXB').publicSummary,/Chamadas dependem da conexão com o celular/);
 assert.match(get('mlMLB6907306094').publicSummary,/uma porta.*três Gigabit/);
});
