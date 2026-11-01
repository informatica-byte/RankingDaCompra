import test from 'node:test';
import assert from 'node:assert/strict';
import {correctProductData} from './product-title-corrections.mjs';
const row={id:'mlMLB4407094781',titulo:'Tênis Masculino Adrun Calce Fácil Esportivo Conforto Origina'};
test('Adrun mantém título identidade preços e afiliado; não aplica ficha a acessório',()=>{
 const p={...row,preco:'99,99',linkAfiliado:'https://meli.la/preservado',link:'https://www.mercadolivre.com.br/up/MLBU3708716035',variation_id:'original'},x=correctProductData(p);
 for(const k of Object.keys(p))assert.equal(x[k],p[k]);assert.deepEqual(correctProductData(x),x);assert.equal(correctProductData({...p,titulo:'Capa para '+p.titulo,comentario:'preservar'}).comentario,'preservar');
});
test('Adrun não autentica tecnologia ou promete benefício clínico e desempenho',()=>{
 const x=correctProductData(row);assert.match(x.comentario,/sem documentação técnica/);assert.match(x.comentario,/não garante ajuste ou conforto/);assert.match(x.comentario,/Não usamos os termos ortholight e goufre/);assert.match(x.comentario,/não presumimos adequação para corrida/);assert.doesNotMatch(x.pros,/maior amortecimento|estabilidade|ortopédic|autêntic|original|garant/i);
});
