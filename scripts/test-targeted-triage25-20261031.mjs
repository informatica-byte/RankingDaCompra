import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
import {MARKETPLACE_FIELD_REVIEWS} from './marketplace-field-reviews.mjs';
const watch={id:'M0Zj2K84Q8PX0YTQMIHz',titulo:'Smartwatch Relógio Inteligente Gps Chamadas Bluetooth Novante Masculino Feminino Ipx8',comentario:'Texto anterior preservado',pros:'Origem preservada',contras:'Limitações preservadas'};
const shoe={id:'Q89e0KvH53UoCpELiwiW',titulo:'Tênis Asics Trabuco Terra 3 Trilha Feminino Escalada'};
test('triagem 25 preserva identificação operacional, variantes e afiliados',()=>{
 for(const raw of [watch,shoe]){const p={...raw,preco:'222,22',link:'https://meli.la/sem-alterar',cor:'cor original',tamanho:'38'};const x=correctProductData(p);for(const k of ['id','preco','link','cor','tamanho'])assert.equal(x[k],p[k]);assert.ok(x.titulo.length<=100);assert.deepEqual(correctProductData(x),x);assert.equal(correctProductData({...p,titulo:'Capa para '+p.titulo}).titulo,'Capa para '+p.titulo);}
});
test('Novante só encurta título; Asics não promete escalada ou autenticação',()=>{
 const w=correctProductData(watch),prior=MARKETPLACE_FIELD_REVIEWS.get(watch.id);assert.equal(w.comentario,prior.summary);assert.equal(w.pros,prior.positiveNotes.join('\n'));assert.equal(w.contras,prior.negativeNotes.join('\n'));assert.equal(prior.reviewedAt,'2026-10-22');assert.doesNotMatch(w.titulo,/ipx8|480|gps|água/i);
 const s=correctProductData(shoe);assert.doesNotMatch(s.titulo,/escalada/i);assert.match(s.comentario,/não autentica/);assert.doesNotMatch(s.pros,/seguran|proteção|aderência|amortecimento/i);assert.equal(manufacturerEvidence(shoe),null);
});
test('dois títulos alinhados no Article e busca sem ampliar as 98 análises',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 for(const raw of [watch,shoe]){const p=c.products.find(x=>x.id===raw.id);assert.equal(p.title,correctProductData(raw).titulo);const html=await readFile(new URL('../produto/'+raw.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});assert.equal(nodes.find(x=>x['@type']==='Article').about.name,p.title);assert.equal(nodes.find(x=>x['@type']==='Article').description,s.products.find(x=>x.id===raw.id).summary);assert.equal(p.decisionBrief.reviewed,false);}
});
