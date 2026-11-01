import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData} from './product-title-corrections.mjs';
import {MARKETPLACE_FIELD_REVIEWS} from './marketplace-field-reviews.mjs';
const rows=[{id:'vDQlmcCO0HZUBNi2DUxd',titulo:'Liftness Bicicleta Ergométrica Fitness SP50PTVM Para Cardio E Musculação Academia Com Base Cor Preto E Vermelho',listing:'MLB6205717194'},{id:'VzQgxGhowdzlfNshI3ZC',titulo:'Carregador Portátil Power Bank Turbo 20000mah 22.5w Universal Para iPhone Samsung Motorola Xiaomi Com Display Digital Preto ou Branco- Hardline',listing:'MLB6756757832'},{id:'WO6BdDxEWWCCjBVJ0ygB',titulo:'Fone de Ouvido Bluetooth com Ear Clip OWS Bluetooth 6.0 com Microfone e Bateria 30H Preto',listing:'MLB7213068268'}];
test('triagem45 preserva operação e rejeita acessórios e outro anúncio',()=>{
 for(const r of rows){const p={...r,preco:'99,99',linkAfiliado:'https://meli.la/preservado',variation_id:'original'},x=correctProductData(p);for(const k of Object.keys(p).filter(k=>k!=='titulo'))assert.equal(x[k],p[k]);assert.deepEqual(correctProductData(x),x);for(const alt of [{titulo:'Capa para '+r.titulo},{link:'https://www.mercadolivre.com.br/p/MLB12345678?wid=MLB9999999999'}])assert.equal(correctProductData({...p,comentario:'preservar',...alt}).comentario,'preservar');}
});
test('Liftness não promete impacto zero ou resultado de saúde',()=>{const x=correctProductData(rows[0]);assert.match(x.comentario,/não resultado de teste/);assert.match(x.comentario,/Não apresentamos.*garantia de melhora da saúde/);assert.doesNotMatch(x.pros,/sem impacto|saúde integral|garant|muscula|segur/i);});
test('Hardline e OWS não reescrevem os fatos e ressalvas anteriores',async()=>{
 const v=JSON.parse(await readFile(new URL('../vitrine-publica.json',import.meta.url),'utf8'));
 const hard=correctProductData(rows[1]),current=v.products.find(x=>x.id===rows[1].id);assert.match(hard.titulo,/a confirmar/);assert.doesNotMatch(hard.titulo,/universal|22[.,]5/i);for(const k of ['comentario','pros','contras'])assert.equal(hard[k],current[k]);
 const review=MARKETPLACE_FIELD_REVIEWS.get(rows[2].id),ows=correctProductData(rows[2]);assert.match(ows.titulo,/divergentes/);assert.doesNotMatch(ows.titulo,/30\s*h/i);assert.equal(ows.comentario,review.summary);assert.equal(ows.pros,review.positiveNotes.join('\n'));assert.equal(ows.contras,review.negativeNotes.join('\n'));
});
