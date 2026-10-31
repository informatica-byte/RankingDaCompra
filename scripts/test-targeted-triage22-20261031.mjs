import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
const raw={id:'CqcFkZIu8ozeDLwRHAEG',titulo:'Caixa De Som Portatil Inova Caixinha Com Rgb Tws Recarregável',preco:'76,62',link:'https://meli.la/preservado'};
test('triagem 22 só qualifica Inova sem fonte falsa e preserva afiliado e preço',()=>{
 const p=correctProductData(raw);assert.equal(p.preco,raw.preco);assert.equal(p.link,raw.link);assert.equal(manufacturerEvidence(raw),null);assert.match(p.titulo,/modelo a confirmar/);assert.ok(p.titulo.length<=100);assert.deepEqual(correctProductData(p),p);const accessory={...raw,titulo:'Capa para '+raw.titulo};assert.equal(correctProductData(accessory).titulo,accessory.titulo);assert.equal(correctProductData({...raw,titulo:'Caixa de som de outra marca'}).comentario,'');
});
test('campos de proteção, flutuação e autonomia não viram vantagens confirmadas da Inova',()=>{
 const p=correctProductData(raw);assert.match(p.comentario,/não são apresentados como recursos verificados/);assert.match(p.comentario,/Não copiamos especificações de outra caixa/);assert.doesNotMatch(p.pros,/IP67|flutu|12 horas|25 m|127/);
});
test('Inova alinhada em busca e Article sem ampliar as 98 análises ou alterar outra ficha',async()=>{
 const get=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
 const c=await get('informational-catalogue.json'),s=await get('search-index.json');assert.equal(c.products.length,551);assert.equal(c.products.filter(x=>x.decisionBrief?.reviewed).length,98);
 const p=c.products.find(x=>x.id===raw.id),h=await readFile(new URL('../produto/'+raw.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});const a=nodes.find(x=>x['@type']==='Article');assert.equal(a.about.name,p.title);assert.equal(a.description,s.products.find(x=>x.id===raw.id).summary);assert.equal(p.decisionBrief.reviewed,false);
});
