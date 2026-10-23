import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewedProducts,reviewedProduct} from './fixtures/reviewed-marketplace-products.mjs';
import {listingReviewFor} from './marketplace-field-reviews.mjs';
import {correctProductData} from './product-title-corrections.mjs';
import {comparisonData} from './product-decision.mjs';
import {groupComparisonProducts} from './comparison-guides.mjs';

test('produto ausente da vitrine não apaga regressões históricas nem é reinserido na publicação',()=>{
  const id='WO6BdDxEWWCCjBVJ0ygB';
  const active=reviewedProducts().filter(p=>p.id!==id),before=JSON.stringify(active);
  groupComparisonProducts(active);
  assert.equal(JSON.stringify(active),before);
  assert.equal(active.some(p=>p.id===id),false);
  const historical=reviewedProduct(id);
  assert.ok(listingReviewFor(historical));
  assert.match(comparisonData(historical).features.find(f=>f.label==='Autonomia no fone').reason,/espera.*reprodução/);
  assert.equal(listingReviewFor({...historical,titulo:'Outro produto'}),null);
  assert.equal(listingReviewFor({...historical,link:'https://www.mercadolivre.com.br/p/MLB99999999'}),null);
});

test('fixtures são isoladas e IDs não registrados falham explicitamente',()=>{
  const p=reviewedProduct('WO6BdDxEWWCCjBVJ0ygB');p.titulo='Alterado';
  assert.notEqual(reviewedProduct(p.id).titulo,p.titulo);
  assert.throws(()=>reviewedProduct('inexistente'),/Fixture de revisão ausente/);
});

test('catálogo público real mantém identidade, preço e ausência de mutações na revisão editorial',()=>{
  const products=JSON.parse(readFileSync(new URL('../vitrine-publica.json',import.meta.url),'utf8')).products;
  const before=JSON.stringify(products);
  for(const p of products){
    const corrected=correctProductData(p);
    for(const key of ['id','categoria','preco','precoAnterior','precoPromocional','precoConferenciaId','precoConferenciaValor','link','linkAfiliado'])
      assert.deepEqual(corrected[key],p[key],p.id+':'+key);
    const review=listingReviewFor(p);
    if(review){
      assert.equal(listingReviewFor({...p,titulo:'Produto diferente'}),null,p.id);
      assert.equal(listingReviewFor({...p,link:'https://evil.example/'+review.catalog}),null,p.id);
      assert.equal(listingReviewFor({...p,link:'https://www.mercadolivre.com.br/p/MLB99999999'}),null,p.id);
    }
  }
  groupComparisonProducts(products);
  assert.equal(JSON.stringify(products),before);
});
