import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData} from './product-title-corrections.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const id='kYzXt8BeErDzXsC6BlwB', title='Fone Havit TW982 ENC Bluetooth 5.4 preto';
test('triagem 31 alinha Bluetooth sem alterar dados operacionais ou confundir TW982 Pro',()=>{
 const p={id,titulo:'Fone De Ouvido Sem Fio Havit Tw982 Enc Bluetooth 5.3 Cor Preto',preco:'72,65',link:'https://meli.la/preservado',cor:'preto',precoConferenciaId:'anterior'};
 const x=correctProductData(p);assert.equal(x.titulo,title);for(const k of ['id','preco','link','cor','precoConferenciaId'])assert.equal(x[k],p[k]);assert.deepEqual(correctProductData(x),x);
 for(const t of ['Capa para Havit TW982','Fone Havit TW982 Pro','Fone Havit TW982 Plus'])assert.equal(correctProductData({...p,titulo:t}).titulo,t);
 assert.match(x.comentario,/ENC anunciado para chamadas não comprova ANC/);
});
test('Matteo não recebe reescrita nem informações de outro calçado',()=>{
 const p={id:'mlMLB4513080577',titulo:'Tênis Em Couro Sneaker Masculino Casual Matteo Classic Ease',comentario:'Dados do anúncio',pros:'',contras:'',link:'https://meli.la/preservado'};const x=correctProductData(p);for(const k of Object.keys(p))assert.deepEqual(x[k],p[k]);
});
test('Havit mantém título coerente no catálogo, busca e Article, sem ampliar análises profundas',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 assert.equal(c.products.find(p=>p.id===id).title,title);assert.equal(s.products.find(p=>p.id===id).title,title);
 const h=await readFile(new URL('../produto/'+id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});assert.equal(nodes.find(x=>x['@type']==='Article').about.name,title);
});
