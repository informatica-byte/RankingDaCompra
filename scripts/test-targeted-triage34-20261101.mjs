import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const id='w4grNjrGMy69omEzW0QP',raw={id,titulo:'Perfume Árabe Maison Salem Nayef Masculino Edp - 100ml'};
test('triagem 34 preserva título e dados operacionais e não transfere ficha a kit ou outra fragrância',()=>{
 const p={...raw,preco:'253,66',precoAnterior:'289,90',link:'https://meli.la/preservado',lote:'original',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of Object.keys(p))assert.equal(x[k],p[k]);assert.deepEqual(correctProductData(x),x);assert.equal(manufacturerEvidence(x),null);
 for(const titulo of ['Kit '+raw.titulo,'Capa para '+raw.titulo,'Perfume Maison Salem Elyah'])assert.equal(correctProductData({...p,titulo,comentario:'Preservado'}).comentario,'Preservado');
});
test('Nayef distingue descrição de marca de fórmula, duração garantida e autenticidade',()=>{
 const x=correctProductData(raw);assert.match(x.comentario,/apresentado pela marca/);assert.match(x.comentario,/não uma análise laboratorial/);assert.match(x.comentario,/não aparecem nessa pirâmide/);assert.match(x.comentario,/não autenticamos/);assert.doesNotMatch(x.comentario,/6.*8 horas|15.*20%|garantimos|R\$/);assert.doesNotMatch(x.pros,/Prada|fixação|projeção|Íris|Néroli/i);
});
test('catálogo, busca e Article coerentes, referência contextual e 98 análises preservadas',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 const p=c.products.find(p=>p.id===id);assert.equal(p.title,raw.titulo);assert.match(p.summary,/Eau de Parfum.*100 ml/);
 const h=await readFile(new URL('../produto/'+id+'-20260810-1.html',import.meta.url),'utf8');assert.match(h,/data-editorial-context/);assert.ok(h.includes('href="https://maisonsalem.com.br/produtos/perfume-maison-salem-nayef-edp-100ml"'));const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});const a=nodes.find(n=>n['@type']==='Article');assert.equal(a.about.name,raw.titulo);assert.equal(a.description,s.products.find(p=>p.id===id).summary);
 const pc=c.products.find(p=>p.id==='YdPOVmrHVJ8EO7fmgyXu');assert.match(pc.summary,/anunciados no cadastro/);assert.match(pc.summary,/código exato do processador está a confirmar/);
});
