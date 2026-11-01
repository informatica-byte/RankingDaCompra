import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const phone={id:'hC5H8O2mjGMYXFMH5jic',titulo:'Celular Positivo S675 4GB RAM 128GB ROM Smartphone 4G Tela HD+ 6,75 Câmera 50MP NFC Bateria 5000mAh',comentario:'Resumo anterior',pros:'Dados anteriores',contras:'Limites anteriores'};
const projector={id:'kiQqRnm6rDj50U2HaOb3',titulo:'Projetor HY320 Mini Portátil Hardline Smart TV Android WiFi 6 390 ANSI Lumens Full HD',categoria:'smarttv'};
test('triagem 30 não troca dados operacionais, variantes ou afiliados nem aplica a acessórios',()=>{
 for(const raw of [phone,projector]){const p={...raw,preco:'123,45',precoAnterior:'180',link:'https://meli.la/preservado',cor:'original',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of ['id','preco','precoAnterior','link','cor','precoConferenciaId'])assert.equal(x[k],p[k]);assert.ok(x.titulo.length<=100);assert.deepEqual(correctProductData(x),x);assert.equal(manufacturerEvidence(x),null);assert.equal(correctProductData({...p,titulo:'Capa para '+p.titulo}).titulo,'Capa para '+p.titulo);}
});
test('Positivo só encurta título; HY320 não escolhe resolução nem herda outra marca',()=>{
 const p=correctProductData(phone);for(const k of ['comentario','pros','contras'])assert.equal(p[k],phone[k]);assert.match(p.titulo,/4 GB.*128 GB anunciados/);
 const x=correctProductData(projector);assert.equal(x.categoria,'informatica');assert.doesNotMatch(x.titulo,/390|Full HD|Smart TV|4K|1080/i);assert.match(x.comentario,/Não escolhemos uma resolução/);assert.match(x.comentario,/Não usamos a ficha de outro HY320/);assert.doesNotMatch(x.pros,/390|1080|4K|Full HD|Netflix|garant/i);
});
test('busca e Article coerentes e projetor fora de Smart TVs, sem ampliar 98 análises',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 for(const raw of [phone,projector]){const p=c.products.find(x=>x.id===raw.id);assert.equal(p.title,correctProductData(raw).titulo);const h=await readFile(new URL('../produto/'+raw.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});assert.equal(nodes.find(x=>x['@type']==='Article').about.name,p.title);assert.equal(nodes.find(x=>x['@type']==='Article').description,s.products.find(x=>x.id===raw.id).summary);assert.equal(p.decisionBrief.reviewed,false);if(raw.id===projector.id){assert.equal(p.categoryId,'informatica');assert.equal(p.category,'Informática');assert.match(h,/analises\.html#informatica/);}}
});
