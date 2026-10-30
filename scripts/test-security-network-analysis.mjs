import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SECURITY_NETWORK_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {CONFIG,improveProduct} from './visibility-editorial.mjs';

test('sete fichas de segurança e rede usam modelos e fontes exatos, sem métricas inventadas',()=>{
 assert.equal(SECURITY_NETWORK_ANALYSES.products.length,7);assert.equal(new Set(SECURITY_NETWORK_ANALYSES.products.map(p=>p.id)).size,7);
 for(const p of SECURITY_NETWORK_ANALYSES.products){
  assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);assert.ok(p.questions.length>=4);assert.ok(p.advantages.length>=2);assert.ok(p.limitations.length>=2);
  assert.match(p.basis,/30\/10\/2026/);assert.ok(p.sources.every(s=>['www.grandstream.com','documentation.grandstream.com','backend.intelbras.com','www.intelbras.com','loja.intelbras.com.br','elsys.com','storage.elsys.com.br'].includes(new URL(s.url).hostname)));
  assert.doesNotMatch(JSON.stringify(p),/R\$|"price"\s*:|"views"\s*:|"linkAfiliado"\s*:/);
 }
});

test('as sete análises estão na mesma ficha com fontes visíveis e recusam outro anúncio',async()=>{
 const c=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));
 for(const p of SECURITY_NETWORK_ANALYSES.products){
  const product=c.products.find(x=>x.id===p.id);const h=await readFile(new URL('..'+new URL(product.url).pathname,import.meta.url),'utf8');
  assert.equal(matchesPopularAnalysis(p,product.title,registeredOfferUrl(h)),true,p.id);
  assert.equal(matchesPopularAnalysis(p,product.title,'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB0000000000'),false,p.id);
  assert.ok(h.includes('data-reviewed-depth="'+p.id+'"'),p.id);for(const s of p.sources)assert.ok(h.includes(s.url),p.id);
  assert.equal(product.decisionBrief?.reviewed,true,p.id);
  assert.doesNotMatch(improveProduct(h,{...p,sources:[{url:'https://www.intelbras.com.evil.example/falso',label:'Falso'}]}),/href="https:\/\/www\.intelbras\.com\.evil\.example/);
 }
});

test('zoom não confirmado e peso divergente não reaparecem na busca; versões não compartilham recursos',async()=>{
 const s=JSON.parse(await readFile(new URL('../search-index.json',import.meta.url),'utf8'));
 const el=s.products.find(x=>x.id==='cq6GYICiBnjXrygHzhaO');assert.doesNotMatch(JSON.stringify(el),/Zoom óptico de 3x/);assert.match(JSON.stringify(el),/zoom óptico não foi comprovada/i);
 const im=s.products.find(x=>x.id==='mWdbAKSL36ZpIPwUTbdv');assert.match(JSON.stringify(im),/565 g/);
 const byId=new Map(SECURITY_NETWORK_ANALYSES.products.map(p=>[p.id,p]));assert.match(byId.get('37zRkLVqUxzOjxBLGhO1').questions[0][1],/sem conversa bidirecional/);
 assert.match(byId.get('Gcz9OSyGgHGMKYfG87IS').publicSummary,/Não usamos a ficha antiga/);
 assert.match(byId.get('uIZQISdVd0NEyClG29Qv').limitations.join(' '),/Não presumimos injetor PoE/);
});
