import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {MARKETPLACE_FIELD_REVIEWS} from './marketplace-field-reviews.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const records=[
 {id:'1RCE8RtBHkc6aVkKZ6xB',titulo:'Tênis New Speed Esporte Masculino 100% Original Caminhada'},
 {id:'BhacwzAPIbDglRkNCoyz',titulo:'Fones Esportivo Bluetooth 6.0 Tradutor Ai Miniso X15pro Ipx5'},
 {id:'zpNUAIiuFr5Eo0TbkaKm',titulo:'Sérum Ghk-cu + Colágeno Bioestimulação Facial Zencial 30ml'},
];
test('triagem 27 não modifica preços, afiliados, variante ou identidade e rejeita acessórios',()=>{
 for(const raw of records){const p={...raw,preco:'123,45',link:'https://meli.la/inalterado',cor:'original',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of ['id','preco','link','cor','precoConferenciaId'])assert.equal(x[k],p[k]);assert.ok(x.titulo.length<=100);assert.deepEqual(correctProductData(x),x);assert.equal(manufacturerEvidence(x),null);assert.equal(correctProductData({...p,titulo:'Capa para '+p.titulo}).titulo,'Capa para '+p.titulo);}
});
test('não autentica New Speed, não promete efeitos do sérum e conserva revisão Miniso anterior',()=>{
 const [shoe,phones,serum]=records.map(correctProductData);assert.doesNotMatch(shoe.titulo,/100%|original/i);assert.doesNotMatch(shoe.pros,/original|garanti|amortec/i);
 const prior=MARKETPLACE_FIELD_REVIEWS.get(phones.id);assert.equal(phones.comentario,prior.summary);assert.equal(phones.pros,prior.positiveNotes.join('\n'));assert.equal(phones.contras,prior.negativeNotes.join('\n'));assert.equal(prior.reviewedAt,'2026-10-20');assert.doesNotMatch(phones.titulo,/tradutor|6\.0|ipx5/i);
 assert.doesNotMatch(serum.titulo,/bioestimula|anti-idade/i);assert.doesNotMatch(serum.pros,/rejuvenes|bioestimula|todo tipo|anti-idade/i);assert.match(serum.comentario,/Não indicamos frequência/);
});
test('três títulos em catálogo, busca e Article coerentes sem ampliar 98 análises',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 for(const raw of records){const p=c.products.find(x=>x.id===raw.id);assert.equal(p.title,correctProductData(raw).titulo);const h=await readFile(new URL('../produto/'+raw.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});assert.equal(nodes.find(x=>x['@type']==='Article').about.name,p.title);assert.equal(nodes.find(x=>x['@type']==='Article').description,s.products.find(x=>x.id===raw.id).summary);assert.equal(p.decisionBrief.reviewed,false);}
});
