import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const kit={id:'DjihMK3g3rkBHHTPbOwp',titulo:'Principia Kit Limpeza E Hidratação Ch-01 + Ol-01 + Gl-02 Todo Tipo De Pele Dia/noite'};
const shoe={id:'gpeMPTTE5kt9e7kYc0MC',titulo:'Tênis Torx Ultra Max Corrida Placa Propulsão 220g Laranja'};
test('triagem 29 conserva preços, afiliados e variante e exige mesma identidade/oferta',()=>{
 for(const raw of [kit,shoe]){const p={...raw,preco:'123,45',link:'https://www.mercadolivre.com.br/p/MLB59774342?wid=MLB4247892213',linkAfiliado:'https://meli.la/preservado',cor:'original',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of ['id','preco','link','linkAfiliado','cor','precoConferenciaId'])assert.equal(x[k],p[k]);assert.ok(x.titulo.length<=110);assert.deepEqual(correctProductData(x),x);assert.equal(manufacturerEvidence(x),null);assert.equal(correctProductData({...p,titulo:'Capa para '+p.titulo}).titulo,'Capa para '+p.titulo);}
 assert.equal(correctProductData({...kit,link:'https://www.mercadolivre.com.br/p/MLB59774342?wid=MLB9999999999'}).comentario,'');
});
test('contexto de catálogo não vira orientação individual ou confirmação de peso/desempenho',()=>{
 const k=correctProductData(kit),s=correctProductData(shoe);assert.match(k.comentario,/não são usadas aqui como orientação individual/);assert.doesNotMatch(k.pros,/14|todo tipo|garant|dia\/noite/i);assert.doesNotMatch(s.titulo,/220|propulsão/i);assert.match(s.comentario,/não foi confirmado/);assert.doesNotMatch(s.pros,/garant|velocidade|220|carbono/i);
});
test('referências contextuais visíveis sem falso fabricante da unidade, com busca/Article alinhados',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 for(const raw of [kit,shoe]){const p=c.products.find(x=>x.id===raw.id);const h=await readFile(new URL('../produto/'+raw.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});assert.equal(nodes.find(x=>x['@type']==='Article').about.name,p.title);assert.equal(nodes.find(x=>x['@type']==='Article').description,s.products.find(x=>x.id===raw.id).summary);assert.match(h,/data-editorial-context/);assert.equal((h.match(/data-editorial-context/g)||[]).length,1);assert.doesNotMatch(h,/data-verified-manufacturer/);assert.equal(p.decisionBrief.reviewed,false);}
 assert.match(c.products.find(p=>p.id===kit.id).title,/MLB4247892213/);
});
