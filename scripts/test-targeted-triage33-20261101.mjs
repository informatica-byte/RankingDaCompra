import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const id='sZGVRAGBdFaBYSOQbSO8',title='Teclado mecânico ABNT2 anunciado com switch red — iluminação a conferir';
const raw={id,titulo:'Teclado Gamer Mecanico Abnt2 Rgb Switch Red Silenciosoimpermeavel Teclado Para Pc Portugues Brasil'};
test('triagem 33 preserva dados operacionais e não aplica ficha do teclado a acessórios ou outro switch',()=>{
 const p={...raw,preco:'214,34',precoAnterior:'382,42',link:'https://meli.la/preservado',cor:'original',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of ['id','preco','precoAnterior','link','cor','precoConferenciaId'])assert.equal(x[k],p[k]);assert.equal(x.titulo,title);assert.ok(x.titulo.length<=100);assert.deepEqual(correctProductData(x),x);assert.equal(manufacturerEvidence(x),null);
 for(const titulo of ['Capa para '+raw.titulo,'Teclado mecânico ABNT2 switch blue'])assert.equal(correctProductData({...p,titulo,comentario:'Preservado'}).comentario,'Preservado');
});
test('não transforma red em silêncio garantido nem Rainbow em RGB confirmado',()=>{
 const x=correctProductData(raw);assert.match(x.comentario,/título menciona RGB, enquanto a descrição usa Rainbow/);assert.match(x.comentario,/não confirmamos o tipo de iluminação/);assert.match(x.comentario,/Não presumimos funcionamento sem ruído ou resistência a líquidos/);assert.match(x.contras,/não comprovados/);assert.doesNotMatch(x.pros,/imperme[aá]vel|silencioso|IP\d|hot.?swap|anti.?ghost/i);
});
test('catálogo, busca e Article coerentes, sem ampliar 98 análises anteriores',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 const p=c.products.find(p=>p.id===id);assert.equal(p.title,title);assert.equal(s.products.find(p=>p.id===id).title,title);
 const h=await readFile(new URL('../produto/'+id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});const a=nodes.find(n=>n['@type']==='Article');assert.equal(a.about.name,title);assert.equal(a.description,s.products.find(p=>p.id===id).summary);
 const rex=c.products.find(p=>p.id==='W309Bngb9vy88pxNSAn5');assert.match(rex.summary,/duas unidades.*58 g/);assert.match(correctProductData({id:rex.id,titulo:rex.title}).comentario,/não garante duração/);
});
