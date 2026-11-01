import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const printer={id:'r2AJAqnKZR0UvB1V4MRz',titulo:'Impressora Térmica Bluetooth USB 110mm Código De Barras E Etiquetas + 2 Rolo De Etiqueta Adesivas Portátil'};
const scooter={id:'UxB7AJhrBhm36FCTachh',titulo:'Patinete Infantil 3 Rodas Com Luz Led Menino Menina 40 Kg',categoria:'patineteelétrico'};
test('triagem 26 preserva dados operacionais e não aplica ficha a outro produto',()=>{
 for(const raw of [printer,scooter]){const p={...raw,preco:'123,45',precoAnterior:'180',link:'https://meli.la/preservado',cor:'Preto',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of ['id','preco','precoAnterior','link','cor','precoConferenciaId'])assert.equal(x[k],p[k]);assert.ok(x.titulo.length<=100);assert.deepEqual(correctProductData(x),x);assert.equal(manufacturerEvidence(x),null);assert.equal(correctProductData({...p,titulo:'Capa para '+p.titulo}).titulo,'Capa para '+p.titulo);}
});
test('impressora mantém limites de compatibilidade; patinete não garante motor, idade ou carga',()=>{
 const p=correctProductData(printer);assert.match(p.comentario,/não há garantia de compatibilidade universal/);assert.doesNotMatch(p.titulo,/2 Rolo|compatível com todos/i);
 const s=correctProductData(scooter);assert.equal(s.categoria,'brinquedos');assert.match(s.comentario,/sem afirmar que o modelo tem ou não motor/);assert.doesNotMatch(s.pros,/40|segur|estável|elétrico|anos/i);assert.doesNotMatch(s.titulo,/40|elétrico|anos/i);
});
test('duas correções alinhadas em busca, Article e categoria; 98 análises preservadas',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 for(const raw of [printer,scooter]){const p=c.products.find(x=>x.id===raw.id);assert.equal(p.title,correctProductData(raw).titulo);const h=await readFile(new URL('../produto/'+raw.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});assert.equal(nodes.find(x=>x['@type']==='Article').about.name,p.title);assert.equal(nodes.find(x=>x['@type']==='Article').description,s.products.find(x=>x.id===raw.id).summary);assert.equal(p.decisionBrief.reviewed,false);if(raw.id===scooter.id){assert.equal(p.categoryId,'brinquedos');assert.equal(p.category,'Brinquedos');assert.match(h,/analises\.html#brinquedos/);}}
});
