import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
const samples=[['NmI6KXBT8ibSc1r5Fwqy','Brastoy Escavadeira De Controle Remoto Escala 1:20 Amarelo Brinquedo 2x Baterias-d342'],['R1ZoQbG2PXeGXmYHQITH','Cadeira De Escritório Até 150kg Executiva Presidente Office'],['L7O3i93VZRAebbsssgJd','Cadeira De Escritorio Ergonomica Nr17 Glorious Marqs Home Giratoria Resistente Reforçada 180kg']];
test('triagem 20 é idempotente e preserva afiliados/preços sem criar fonte técnica',()=>{
 for(const [id,titulo] of samples){const raw={id,titulo,preco:'100,00',link:'https://meli.la/preservado'};const p=correctProductData(raw);assert.equal(p.link,raw.link);assert.equal(p.preco,raw.preco);assert.equal(manufacturerEvidence(raw),null);assert.deepEqual(correctProductData(p),p);const accessory={...raw,titulo:'Capa para '+titulo};assert.equal(correctProductData(accessory).titulo,accessory.titulo);if(id!==samples[0][0])assert.ok(p.titulo.length<=100);}
 const toy={id:samples[0][0],titulo:'Brastoy Casa na Árvore 504 peças'};assert.equal(correctProductData(toy).titulo,toy.titulo);assert.equal(correctProductData({...toy,titulo:samples[0][1].replace('d342','d343')}).comentario,'');assert.equal(correctProductData({...toy,titulo:samples[0][1].replace('1:20','1:18')}).comentario,'');
});
test('triagem 20 não transforma benefício, pistão ou título normativo em comprovação',()=>{
 const p=samples.map(([id,titulo])=>correctProductData({id,titulo}));assert.match(p[0].comentario,/Não avaliamos nem garantimos benefícios à coordenação motora/);assert.match(p[1].comentario,/não usamos a classe anunciada do pistão como comprovação da carga/);assert.match(p[2].titulo,/conformidade e carga a confirmar/);assert.match(p[2].comentario,/não foram verificadas nesta revisão por documentação específica/i);
});
test('três correções da triagem 20 têm busca e Article alinhados, mantendo as 98 análises',async()=>{
 const get=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
 const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(x=>x.decisionBrief?.reviewed).length,98);
 for(const [id] of samples){const p=c.products.find(x=>x.id===id),h=await readFile(new URL('../produto/'+id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});const a=nodes.find(x=>x['@type']==='Article');assert.equal(a.description,s.products.find(x=>x.id===id).summary);if(id!==samples[0][0])assert.equal(a.about.name,p.title);assert.equal(p.decisionBrief.reviewed,false);}
});
