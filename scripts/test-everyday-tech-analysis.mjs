import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EVERYDAY_TECH_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {CONFIG,improveProduct} from './visibility-editorial.mjs';

test('sete fichas de casa, TV e celular usam modelos e fontes oficiais sem desempenho inventado',()=>{
 assert.equal(EVERYDAY_TECH_ANALYSES.products.length,7);assert.equal(new Set(EVERYDAY_TECH_ANALYSES.products.map(p=>p.id)).size,7);
 for(const p of EVERYDAY_TECH_ANALYSES.products){
  assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);assert.ok(p.questions.length>=4);assert.ok(p.advantages.length>=2);assert.ok(p.limitations.length>=2);
  assert.match(p.basis,/30\/10\/2026/);assert.ok(p.sources.every(s=>['backend.intelbras.com','www.arno.com.br','www.mondial.com.br','www.lg.com','www.samsung.com','www.mi.com'].includes(new URL(s.url).hostname)));
  assert.doesNotMatch(JSON.stringify(p),/R\$|"price"\s*:|"views"\s*:|"linkAfiliado"\s*:/);
 }
});

test('análises e fontes dos sete modelos ficam na ficha certa e recusam outra oferta',async()=>{
 const c=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));
 for(const p of EVERYDAY_TECH_ANALYSES.products){
  const product=c.products.find(x=>x.id===p.id);const h=await readFile(new URL('..'+new URL(product.url).pathname,import.meta.url),'utf8');
  assert.equal(matchesPopularAnalysis(p,product.title,registeredOfferUrl(h)),true,p.id);
  assert.equal(matchesPopularAnalysis(p,product.title,'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB0000000000'),false,p.id);
  assert.ok(h.includes('data-reviewed-depth="'+p.id+'"'),p.id);for(const s of p.sources)assert.ok(h.includes(s.url),p.id);
  assert.equal(product.decisionBrief?.reviewed,true,p.id);
  assert.doesNotMatch(improveProduct(h,{...p,sources:[{url:'https://www.arno.com.br.evil.example/falso',label:'Falso'}]}),/href="https:\/\/www\.arno\.com\.br\.evil\.example/);
 }
});

test('potência divergente permanece incerta e versões de tela, memória e alimentação são separadas',async()=>{
 const s=JSON.parse(await readFile(new URL('../search-index.json',import.meta.url),'utf8'));
 const v=s.products.find(x=>x.id==='PfU3x9udsDbmj7DXjaCk');assert.match(v.title,/potência a confirmar/);assert.match(v.summary,/55 W.*60 W/);
 const ar=s.products.find(x=>x.id==='NUNROG3VOfMVViIW5Rtk');assert.match(ar.summary,/850 W.*127 V.*700 W.*220 V/);
 const byId=new Map(EVERYDAY_TECH_ANALYSES.products.map(p=>[p.id,p]));
 assert.match(byId.get('dMbluI9x5kQ0Gwxg8fOU').publicSummary,/Smart Magic.*controle incluído/);
 assert.match(byId.get('UlgA45nNx2rsEykMbv67').publicSummary,/60 Hz/);
 assert.match(byId.get('UNQtBcYJ9obcCPWURmeq').publicSummary,/Não copiamos.*5G/);
 assert.match(byId.get('NQAtVQKwZQtKxXtEn21Q').limitations.join(' '),/120 Hz.*quadros/);
 assert.match(byId.get('uN0To7b1oG7xjWib5gLN').questions[0][1],/receptor.*rede elétrica/);
 assert.ok(!EVERYDAY_TECH_ANALYSES.products.some(x=>x.id==='hLiaQWog1dogQ2OpMDSt'));
});
