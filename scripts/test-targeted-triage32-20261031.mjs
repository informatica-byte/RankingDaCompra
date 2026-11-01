import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const id='SFcayTGVGtzWrkpt4uFw',raw={id,titulo:'Tênis Rbd Game Low Puma'};
test('triagem 32 preserva identidade e dados operacionais, sem corrigir acessórios ou edições diferentes',()=>{
 const p={...raw,preco:'284,99',link:'https://meli.la/preservado',cor:'original',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of Object.keys(p))assert.equal(x[k],p[k]);assert.deepEqual(correctProductData(x),x);assert.equal(manufacturerEvidence(x),null);
 for(const titulo of ['Capa para Tênis Rbd Game Low Puma','Tênis Rbd Game Low Retro Club Puma','Tênis Puma RBD Game'])assert.equal(correctProductData({...p,titulo,comentario:'Preservado'}).comentario,'Preservado');
});
test('Puma fornece contexto casual sem herdar materiais e tecnologias da variante oficial',()=>{
 const x=correctProductData(raw);assert.match(x.comentario,/casual/);assert.match(x.comentario,/não comprova adequação a jogos ou corrida/);assert.match(x.comentario,/391759_07/);assert.match(x.comentario,/não confirmamos que esse é o código/);assert.doesNotMatch(x.pros,/SoftFoam|reciclado|couro|borracha|garant/i);assert.doesNotMatch(x.comentario,/R\$/);
});
test('catálogo, busca e Article coerentes, fonte contextual visível e 98 análises profundas preservadas',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 const p=c.products.find(p=>p.id===id);assert.equal(p.title,raw.titulo);assert.match(p.summary,/casual/);
 const h=await readFile(new URL('../produto/'+id+'-20260810-1.html',import.meta.url),'utf8');assert.match(h,/data-editorial-context/);assert.ok(h.includes('href="https://br.puma.com/pd/tenis-rbd-game-low/391759.html"'));const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});const a=nodes.find(n=>n['@type']==='Article');assert.equal(a.about.name,raw.titulo);assert.equal(a.description,s.products.find(p=>p.id===id).summary);
 const lp=c.products.find(p=>p.id==='rERcfIbgG1c0uUdNlQ4o');assert.match(lp.comparison.features.find(f=>f.label==='Autonomia com estojo').reason,/300 mAh/);assert.equal(lp.comparison.features.find(f=>f.label==='Cancelamento ativo de ruído').state,'unknown');
});
