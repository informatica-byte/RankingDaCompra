import test from 'node:test';
import assert from 'node:assert/strict';
import {correctProductData} from './product-title-corrections.mjs';
const rows=[{id:'fCw8R0SRDFhAWXIT2sZ0',titulo:'Controle Gamesir Nova Lite 2 Sem Fio Pc Switch Celular Hall - Branco',listing:'MLB6555831758'},{id:'jpfsQDwQMrok9k3UQ66e',titulo:'Conjunto de panelas antiaderente 10 peças Coffee cappuccino Imperial',listing:'MLB4709294547'}];
test('triagem39 somente identidade exata, sem mudar campos operacionais',()=>{
 for(const r of rows){const p={id:r.id,titulo:r.titulo,link:'https://www.mercadolivre.com.br/p/MLB12345678?wid='+r.listing,linkAfiliado:'https://meli.la/preservado',preco:'123,45',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of Object.keys(p))assert.equal(x[k],p[k]);assert.deepEqual(correctProductData(x),x);assert.equal(correctProductData({...p,comentario:'preservar',titulo:'Capa para '+r.titulo}).comentario,'preservar');assert.equal(correctProductData({...p,comentario:'preservar',link:'https://www.mercadolivre.com.br/p/MLB12345678?wid=MLB9999999999'}).comentario,'preservar');}
});
test('GameSir sem garantia antidrift, taxa universal ou autonomia inventada',()=>{
 const x=correctProductData(rows[0]);assert.match(x.comentario,/Hall Effect não é garantia/);assert.match(x.comentario,/nem comprova essa taxa em todas as conexões/);assert.match(x.comentario,/600 mAh não informa/);assert.match(x.comentario,/base de recarga é vendida separadamente/);assert.doesNotMatch(x.pros,/garant|antidrift|alta performance|lag.free/i);
});
test('Imperial não inventa material, indução ou dez panelas',()=>{
 const x=correctProductData(rows[1]);assert.match(x.comentario,/dez peças não significa necessariamente dez panelas/);assert.match(x.comentario,/Não presumimos compatibilidade com indução/);assert.doesNotMatch(x.pros,/sem grudar|fácil limpeza|segur|certificad|alumínio|cerâmic/i);
});
