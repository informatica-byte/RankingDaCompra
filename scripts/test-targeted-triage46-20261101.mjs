import test from 'node:test';
import assert from 'node:assert/strict';
import {correctProductData} from './product-title-corrections.mjs';
const row={id:'xayABmLUPEj8yOPOfzA9',titulo:'Patinete Infantil Triciclo Dobrável Scooter 3 Rodas Led 70kg'};
test('patinete mantém identidade preço link e variante e rejeita acessórios/outro anúncio',()=>{
 const p={...row,preco:'99,99',linkAfiliado:'https://meli.la/preservado',variation_id:'original'},x=correctProductData(p);for(const k of Object.keys(p))assert.equal(x[k],p[k]);assert.deepEqual(correctProductData(x),x);for(const alt of [{titulo:'Capa para '+p.titulo},{link:'https://www.mercadolivre.com.br/p/MLB12345678?wid=MLB9999999999'}])assert.equal(correctProductData({...p,comentario:'preservar',...alt}).comentario,'preservar');
});
test('patinete não inventa fabricante idade certificação ou segurança',()=>{const x=correctProductData(row);assert.match(x.comentario,/sem identificar claramente um fabricante/);assert.match(x.comentario,/nem comprova adequação.*qualquer idade ou altura/);assert.match(x.comentario,/Não deduzimos estabilidade/);assert.doesNotMatch(x.pros,/segur|certific|anos|fabricante|Inmetro|ABNT|garant/i);});
