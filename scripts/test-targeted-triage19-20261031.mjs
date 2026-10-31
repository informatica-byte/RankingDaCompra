import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
const raw={id:'mlMLB4467674377',titulo:'Bota Coturno Botina Caterpillar Couro Palmilha Promoção',comentario:'Descrição antiga',preco:'114,00',link:'https://meli.la/preservado'};
test('triagem 19 corrige só a bota promocional, sem alterar preço ou afiliado e sem autenticar marca',()=>{
 const p=correctProductData(raw);assert.equal(p.preco,raw.preco);assert.equal(p.link,raw.link);assert.doesNotMatch(p.titulo,/promoção/i);assert.match(p.titulo,/anunciada como Caterpillar/);assert.match(p.comentario,/material é descrito como couro no anúncio/);assert.equal(manufacturerEvidence(raw),null);assert.deepEqual(correctProductData(p),p);
 const accessory={...raw,titulo:'Capa para '+raw.titulo};assert.equal(correctProductData(accessory).titulo,accessory.titulo);assert.equal(correctProductData(accessory).comentario,accessory.comentario);
});
test('cinco itens triados sem mudança não recebem revisão artificial nem texto substituto',()=>{
 for(const [id,titulo] of [['ZRkf5zIEicv1a47qGXXw','Bolsa Térmica Marmita Tche Amo'],['mlMLB4987441207','Bone Flavio Bolsonaro Presidente 22 Verde Militar'],['mlMLB4614572907','Bota Adventure Trabalho Coturno Tênis Palmilha Gel Casual'],['mlMLB5022549056','Bota Caterpillar Masculina Adventure Leve Palmilha Gel 2113'],['mlMLB4960241923','Bota Coturno Adventure Couro Kit Palmilha Reforçado Pvc 3080']]){
  const x={id,titulo,comentario:'Texto existente atribuído ao cadastro',preco:'20,00',link:'https://meli.la/preservado'};const p=correctProductData(x);for(const k of ['titulo','comentario','preco','link'])assert.equal(p[k],x[k],id+':'+k);
 }
});
test('a única correção da triagem 19 está coerente na busca e no Article, mantendo 98 análises',async()=>{
 const get=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
 const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(x=>x.decisionBrief?.reviewed).length,98);
 const p=c.products.find(x=>x.id===raw.id),h=await readFile(new URL('../produto/'+raw.id+'-20260810-1.html',import.meta.url),'utf8');
 const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
 const article=nodes.find(x=>x['@type']==='Article');assert.equal(article.about.name,p.title);assert.equal(article.description,s.products.find(x=>x.id===raw.id).summary);assert.equal(p.decisionBrief.reviewed,false);
});
