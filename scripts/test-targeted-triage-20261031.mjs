import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
const samples=[['iAFknp54AGEJMCkVkbtP','Auxiliar Partida Bateria Compressor Ar Automotivo Vigomot'],['WcV6iy1IS12dL74uflws','Auxiliar Partida Bateria Portátil Rápido Para Carro Moto'],['ZcFzy9nXCVEZCsuz9SB3','Auxiliar Partida Portátil Veicular Compressor Ar Emergência'],['JaEIKKAz742WyLDV6Oqr','Balança De Bioimpedância 8 Sensores Relaxmedic Digital Preto']];
test('triagem 31/10 é restrita ao modelo e conserva preços e afiliados',()=>{
 for(const [id,titulo] of samples){
  const raw={id,titulo,link:'https://meli.la/preservado',preco:'123,45',categoria:'casa'};
  const p=correctProductData(raw);assert.equal(p.preco,raw.preco);assert.equal(p.link,raw.link);assert.equal(p.titulo,titulo);
  assert.equal(manufacturerEvidence(raw),null);
  assert.equal(correctProductData({...raw,titulo:'Produto completamente diferente'}).comentario,'');
  assert.deepEqual(correctProductData(p),p,'idempotent '+id);
 }
 assert.equal(correctProductData({id:samples[2][0],titulo:samples[2][1],categoria:'casa'}).categoria,'carro');
});
test('triagem corrige pressão, retira garantias e não inventa alimentação da balança',()=>{
 const p=samples.map(([id,titulo])=>correctProductData({id,titulo}));
 assert.match(p[0].comentario,/PSI é uma unidade de pressão, não de vazão/);
 assert.doesNotMatch(p[1].comentario,/ideal para o uso|baixa e média cilindrada/);
 assert.match(p[3].comentario,/não afirmamos alimentação 127\/220 V nem indicação/);
 assert.match(p[3].comentario,/código exato do modelo, a alimentação e a aplicação por faixa etária não foram confirmados/i);
});
test('quatro fichas publicáveis coerentes em catálogo, busca, metadados e categoria',async()=>{
 const get=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
 const c=await get('informational-catalogue.json'),s=await get('search-index.json');
 assert.equal(c.products.filter(x=>x.decisionBrief?.reviewed).length,98);
 for(const [id] of samples){
  const h=await readFile(new URL('../produto/'+id+'-20260810-1.html',import.meta.url),'utf8');
  const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  const a=nodes.find(x=>x['@type']==='Article');
  assert.equal(a.description,s.products.find(x=>x.id===id).summary,id);
  assert.equal(c.products.find(x=>x.id===id).decisionBrief.reviewed,false);
  if(id===samples[2][0]){
   const p=c.products.find(x=>x.id===id);assert.equal(p.categoryId,'carro');assert.equal(p.category,'Carro');
   assert.match(h,/<span>Categoria<\/span>Carro/);
   const crumb=nodes.find(x=>x['@type']==='BreadcrumbList');assert.equal(crumb.itemListElement.find(x=>x.position===2).name,'Carro');
  }
 }
});
