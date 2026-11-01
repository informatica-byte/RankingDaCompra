import test from 'node:test';
import assert from 'node:assert/strict';
import {correctProductData} from './product-title-corrections.mjs';
const rows=[{id:'sinwoGjrsJl5UMA13pES',titulo:'Power Bank Basike 20000mAh para Notebook e Celular com Cabo USB-C 65W',listing:'MLB6204416228'},{id:'sX3K2gzcggu9lkVSke0Q',titulo:'Heaven Extraordinary Collection 100ml - Wepink'}];
test('triagem44 não muda identidade preços variantes ou afiliados e rejeita acessórios',()=>{
 for(const r of rows){const p={...r,preco:'99,99',linkAfiliado:'https://meli.la/preservado',variation_id:'original'},x=correctProductData(p);for(const k of Object.keys(p))assert.equal(x[k],p[k]);assert.deepEqual(correctProductData(x),x);assert.equal(correctProductData({...p,titulo:'Capa para '+r.titulo,comentario:'preservar'}).comentario,'preservar');if(r.listing)assert.equal(correctProductData({...p,link:'https://www.mercadolivre.com.br/p/MLB12345678?wid=MLB9999999999',comentario:'preservar'}).comentario,'preservar');}
});
test('Basike não promete desempenho de 65 W universal nem aceitação sem fonte',()=>{const x=correctProductData(rows[0]);assert.match(x.comentario,/não comprova compatibilidade com todo computador/);assert.match(x.comentario,/Não confirmamos 65 W em todas as saídas/);assert.match(x.comentario,/nem dispomos de avaliações verificadas/);assert.doesNotMatch(x.pros,/excelente|ótimo|exigentes|garant|rápid/i);});
test('Heaven não inventa pirâmide olfativa concentração fixação ou rendimento',()=>{const x=correctProductData(rows[1]);assert.match(x.comentario,/não atribuímos notas, concentração/);assert.match(x.comentario,/não comprova bom rendimento/);assert.doesNotMatch(x.pros,/fixação|rendimento|sofistica|eau de parfum|oud|baunilha|garant/i);});
