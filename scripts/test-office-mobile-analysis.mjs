import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OFFICE_MOBILE_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {CONFIG,improveProduct} from './visibility-editorial.mjs';

test('seis novas fichas têm fontes oficiais, dúvidas específicas e limites sem inventar métricas',()=>{
 const products=OFFICE_MOBILE_ANALYSES.products;
 assert.equal(products.length,6);assert.equal(new Set(products.map(p=>p.id)).size,6);
 for(const p of products){
  assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);
  assert.ok(p.questions.length>=4);assert.ok(p.limitations.length>=2);assert.ok(p.advantages.length>=2);
  assert.match(p.basis,/30\/10\/2026/);
  assert.ok(p.sources.every(s=>['news.samsung.com','www.samsung.com','shop.samsung.com','epson.com.br','www.logitechg.com'].includes(new URL(s.url).hostname)));
  assert.doesNotMatch(JSON.stringify(p),/R\$|"price"\s*:|"views"\s*:|"linkAfiliado"\s*:/);
 }
});

test('identidade, fonte e resumo público das seis revisões correspondem ao cadastro, sem aceitar outra oferta',async()=>{
 const catalogue=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));
 for(const p of OFFICE_MOBILE_ANALYSES.products){
  const html=await readFile(new URL('../produto/'+p.id+'-20260810-1.html',import.meta.url),'utf8');
  const schemas=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  const name=schemas.find(n=>n['@type']==='Article'&&n.about?.name)?.about.name;
  assert.equal(matchesPopularAnalysis(p,name,registeredOfferUrl(html)),true,p.id);
  assert.equal(matchesPopularAnalysis(p,name,'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB0000000000'),false,p.id);
  assert.ok(html.includes('data-reviewed-depth="'+p.id+'"'),p.id);
  for(const source of p.sources)assert.ok(html.includes(source.url),p.id+': fonte visível');
  assert.equal(catalogue.products.find(x=>x.id===p.id)?.decisionBrief?.reviewed,true,p.id);
  const poisoned={...p,sources:[{url:'https://epson.com.br.evil.example/falso',label:'Falso'}]};
  assert.doesNotMatch(improveProduct(html,poisoned),/href="https:\/\/epson\.com\.br\.evil\.example/);
 }
});

test('duplex, autonomia com estojo e pacote de acessórios não são confundidos',()=>{
 const get=id=>OFFICE_MOBILE_ANALYSES.products.find(p=>p.id===id);
 assert.match(get('EmrdwlcDgCCM5suoz8dB').publicSummary,/manualmente/);
 assert.match(get('rcwXY2aQWUN6dbCVzvsB').publicSummary,/não comprova.*digitalização/);
 assert.match(get('FlqPY3yHJ2xPoNgnhSTE').publicSummary,/recargas.*estojo/);
 assert.match(get('LASwiEy13CerUN6q3pKn').publicSummary,/não.*presuma câmbio/i);
 assert.match(get('35hImqo3QJm6moaV4OzO').publicSummary,/não.*comprova carregador/i);
});
