import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HOUSEHOLD_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {CONFIG,improveProduct} from './visibility-editorial.mjs';

test('oito fichas de casa usam fontes oficiais e limites explícitos, sem métricas inventadas',()=>{
 assert.equal(HOUSEHOLD_ANALYSES.products.length,8);assert.equal(new Set(HOUSEHOLD_ANALYSES.products.map(p=>p.id)).size,8);
 for(const p of HOUSEHOLD_ANALYSES.products){
  assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);assert.ok(p.questions.length>=4);assert.ok(p.advantages.length>=2);assert.ok(p.limitations.length>=2);
  assert.match(p.basis,/30\/10\/2026/);assert.ok(p.sources.every(s=>['loja.wap.ind.br','mais.conteudo.wap.ind.br','www.oster.com.br','www.tramontina.com.br'].includes(new URL(s.url).hostname)));
  assert.doesNotMatch(JSON.stringify(p),/R\$|"price"\s*:|"views"\s*:|"linkAfiliado"\s*:/);
 }
});

test('fontes, dúvidas e análises dos oito produtos aparecem na mesma ficha, sem aceitar outra oferta',async()=>{
 const catalogue=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));
 for(const p of HOUSEHOLD_ANALYSES.products){
  const product=catalogue.products.find(x=>x.id===p.id);
  const html=await readFile(new URL('..'+new URL(product.url).pathname,import.meta.url),'utf8');
  assert.equal(matchesPopularAnalysis(p,product.title,registeredOfferUrl(html)),true,p.id);
  assert.equal(matchesPopularAnalysis(p,product.title,'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB0000000000'),false,p.id);
  assert.ok(html.includes('data-reviewed-depth="'+p.id+'"'),p.id);for(const s of p.sources)assert.ok(html.includes(s.url),p.id);
  assert.equal(product.decisionBrief?.reviewed,true,p.id);
  assert.doesNotMatch(improveProduct(html,{...p,sources:[{url:'https://www.oster.com.br.evil.example/falso',label:'Falso'}]}),/href="https:\/\/www\.oster\.com\.br\.evil\.example/);
 }
});

test('capacidade útil, automação, modelos e quantidade de peças não são inflados',()=>{
 const byId=new Map(HOUSEHOLD_ANALYSES.products.map(p=>[p.id,p]));
 assert.match(byId.get('w7DR6QTHjF5FdGZyQTYX').publicSummary,/7 litros.*3,4 litros/);
 assert.match(byId.get('2V7q6nC2mg54DN9anaYi').publicSummary,/não tem aplicativo, controle remoto ou base/);
 assert.match(byId.get('31Lco0eFCDaomsks3iM3').check,/CI10.*FW012310\/FW012311/);
 assert.match(byId.get('fOI4O124KZd2vLCx8Fmj').publicSummary,/não serviço completo para 24 pessoas/);
 assert.match(byId.get('oO9KBr39gclvEu1LfKEj').limitations.join(' '),/Não declaramos 3,2 litros como limite útil/);
});
