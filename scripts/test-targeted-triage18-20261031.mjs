import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
const samples=[['VfMW16M9t5lgB6JcDJYp','Bicicleta Ergométrica Spinning 20kg Wct Fitness Cor Preto/Verde','esporte-e-lazer'],['PmWA6Y2vHwbiT6rEfc7l','Bicicleta Ergométrica Spinning Inércia 5kg Velocron V500 Preto'],['liYhKi9ZlLnwNTT1uvBl','Bicicleta Spinning Com Roda De Inércia De 13kg Wct Fitness Cor Preto','esporte-e-lazer'],['mlMLB7006667338','Body Splash Perfect Pear- 200ml - Wepink','perfumes'],['5ybTTfU4uFUesMEPrTMK','Bola de futebol Society Penalty 8 X Gomos Termotec Oficial Cor Amarelo'],['mlMLB7688686428',"Bold Homme Body Splash Masculino Barbour's Beauty 200ml",'perfumes']];
const titleIds=['VfMW16M9t5lgB6JcDJYp','5ybTTfU4uFUesMEPrTMK','mlMLB7688686428'];
test('triagem 18 preserva afiliados e preços, rejeita acessórios e não inventa fabricante',()=>{
 for(const [id,titulo,category] of samples){const raw={id,titulo,categoria:'casa',preco:'100,01',link:'https://meli.la/preservado'};const p=correctProductData(raw);assert.equal(p.preco,raw.preco);assert.equal(p.link,raw.link);assert.equal(manufacturerEvidence(raw),null);assert.deepEqual(correctProductData(p),p,id);if(category)assert.equal(p.categoria,category);if(titleIds.includes(id))assert.ok(p.titulo.length<=100);else assert.equal(p.titulo,titulo);const accessory={...raw,titulo:'Capa para '+titulo};assert.equal(correctProductData(accessory).titulo,accessory.titulo);assert.equal(correctProductData(accessory).categoria,'casa');}
});
test('triagem 18 qualifica carga/estatura, marca divergente e condição oficial sem inventar solução',()=>{
 const p=samples.map(([id,titulo])=>correctProductData({id,titulo}));
 assert.match(p[0].comentario,/esse valor não identifica nesta ficha o peso total/);
 assert.match(p[1].comentario,/não verificamos limite de carga ou ajuste por estatura/);
 assert.match(p[4].titulo,/homologação a confirmar/);
 assert.match(p[5].comentario,/Barbour’s Beauty.*Moon/);assert.match(p[5].comentario,/Não escolhemos uma marca/);
});
test('triagem 18 tem categorias e resumos coerentes, preservando 98 análises profundas',async()=>{
 const get=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
 const c=await get('informational-catalogue.json'),s=await get('search-index.json');assert.equal(c.products.filter(x=>x.decisionBrief?.reviewed).length,98);
 for(const [id,,category] of samples){const p=c.products.find(x=>x.id===id),h=await readFile(new URL('../produto/'+id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  if(category){const label=category==='perfumes'?'Perfumes':'Esporte e Lazer';assert.equal(p.categoryId,category);assert.equal(p.category,label);assert.ok(h.includes('<span>Categoria</span>'+label));assert.equal(nodes.find(x=>x['@type']==='BreadcrumbList').itemListElement.find(x=>x.position===2).name,label);}
  if(!['liYhKi9ZlLnwNTT1uvBl','mlMLB7006667338'].includes(id))assert.equal(nodes.find(x=>x['@type']==='Article').description,s.products.find(x=>x.id===id).summary);
  if(titleIds.includes(id))assert.equal(nodes.find(x=>x['@type']==='Article').about.name,p.title);
 }
});
