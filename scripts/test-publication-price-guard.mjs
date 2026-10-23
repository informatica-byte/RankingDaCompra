import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPublishedPricesPreserved as guard} from './publication-price-guard.mjs';
const before={products:[{id:'a',preco:99.90,precoAnterior:120,precoPromocional:89}]};

test('proteção de publicação compara preços existentes sem editar entradas',()=>{
  const after=structuredClone(before),snapshot=JSON.stringify([before,after]);
  assert.deepEqual(guard(before,after),{checked:1,added:0});
  assert.equal(JSON.stringify([before,after]),snapshot);
});
test('proteção bloqueia divergência em cada preço e remoção do campo',()=>{
  for(const field of ['preco','precoAnterior','precoPromocional']){
    const after=structuredClone(before);after.products[0][field]=1;
    assert.throws(()=>guard(before,after),/Publicação bloqueada/);
    delete after.products[0][field];assert.throws(()=>guard(before,after),/Publicação bloqueada/);
  }
});
test('novas páginas não herdam preços de outro produto e saída da vitrine não exclui a fonte',()=>{
  const after={products:[...structuredClone(before.products),{id:'b',preco:20}]};
  assert.deepEqual(guard(before,after),{checked:1,added:1});
  assert.deepEqual(guard(before,{products:[]}),{checked:0,added:0});
  assert.equal(before.products.length,1);
});
test('proteção rejeita catálogo incompleto e identidade duplicada',()=>{
  assert.throws(()=>guard({},before),/Catálogo inválido/);
  assert.throws(()=>guard(before,{products:[{id:'a'},{id:'a'}]}),/duplicada/);
  assert.throws(()=>guard(before,{products:[{}]}),/ausente/);
});
