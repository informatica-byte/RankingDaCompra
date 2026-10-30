import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {KITCHEN_ANALYSES,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
import {CONFIG,improveProduct} from './visibility-editorial.mjs';

test('seis fichas de cozinha usam fontes oficiais sem inventar capacidade útil ou teste de receita',()=>{
 assert.equal(KITCHEN_ANALYSES.products.length,6);assert.equal(new Set(KITCHEN_ANALYSES.products.map(p=>p.id)).size,6);
 for(const p of KITCHEN_ANALYSES.products){
  assert.equal(CONFIG.products.filter(x=>x.id===p.id).length,1);assert.ok(p.questions.length>=4);assert.ok(p.advantages.length>=2);assert.ok(p.limitations.length>=2);
  assert.match(p.basis,/30\/10\/2026/);assert.ok(p.sources.every(s=>['www.elgin.com.br','www.philco.com.br','www.mondial.com.br','suporte.britania.com.br','loja.electrolux.com.br'].includes(new URL(s.url).hostname)));
  assert.doesNotMatch(JSON.stringify(p),/R\$|"price"\s*:|"views"\s*:|"linkAfiliado"\s*:/);
 }
});

test('fontes e dúvidas aparecem nas seis fichas corretas, preservando a separação de anúncios',async()=>{
 const c=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));
 for(const p of KITCHEN_ANALYSES.products){
  const product=c.products.find(x=>x.id===p.id);const h=await readFile(new URL('..'+new URL(product.url).pathname,import.meta.url),'utf8');
  assert.equal(matchesPopularAnalysis(p,product.title,registeredOfferUrl(h)),true,p.id);
  assert.equal(matchesPopularAnalysis(p,product.title,'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB0000000000'),false,p.id);
  assert.ok(h.includes('data-reviewed-depth="'+p.id+'"'),p.id);for(const s of p.sources)assert.ok(h.includes(s.url),p.id);
  assert.equal(product.decisionBrief?.reviewed,true,p.id);
  assert.doesNotMatch(improveProduct(h,{...p,sources:[{url:'https://www.philco.com.br.evil.example/falso',label:'Falso'}]}),/href="https:\/\/www\.philco\.com\.br\.evil\.example/);
 }
});

test('cavidade e cesto, cápsulas e acessórios não se confundem; promessas antigas saem da busca',async()=>{
 const byId=new Map(KITCHEN_ANALYSES.products.map(p=>[p.id,p]));
 assert.match(byId.get('asTGBkjkQIZ4mhlc7cxX').publicSummary,/11 litros.*1,5 litro/);
 assert.match(byId.get('asTGBkjkQIZ4mhlc7cxX').questions[2][1],/lembrete/);
 assert.match(byId.get('MBhoRb0kSLsHrhutbTLN').publicSummary,/Dolce Gusto.*separadamente/);
 assert.match(byId.get('M9arBHEFyVVMelHK70ml').limitations.join(' '),/não confirmamos.*lava-louças/);
 assert.match(byId.get('oE4gHinZ6CfelSwfLDWk').questions[0][1],/Grill: Não/);
 const s=JSON.parse(await readFile(new URL('../search-index.json',import.meta.url),'utf8'));
 assert.doesNotMatch(JSON.stringify(s.products.find(x=>x.id==='M9arBHEFyVVMelHK70ml')),/Suas peças são adequadas para lava-louças/);
 assert.doesNotMatch(JSON.stringify(s.products.find(x=>x.id==='MBhoRb0kSLsHrhutbTLN')),/garantindo a extração/);
 assert.ok(!KITCHEN_ANALYSES.products.some(x=>x.id==='1OfMg1pRePuvTqXaLiV6'));
});
