import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {listingReviewFor} from './marketplace-field-reviews.mjs';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {comparisonData,decisionData} from './product-decision.mjs';
import {renderManufacturerSpecifications} from './manufacturer-specifications.mjs';
const products=JSON.parse(readFileSync(new URL('../vitrine-publica.json',import.meta.url),'utf8')).products;
const get=id=>products.find(p=>p.id===id);
const fact=(id,label)=>comparisonData(correctProductData(get(id))).features.find(f=>f.label===label);

test('complementos do anúncio não alteram preços, links, cadastros ou prova da conferência',()=>{
  const ids=['C5b5fKstKDUgNDUxnQkP','zev1LogqUFpJ3cLlIXyy','BcfEuX1oed02O8pYXKyg','cSmjEdmFugRGDdJHkMcR','wYxgVNIJeeWmGhcToFLP','M0Zj2K84Q8PX0YTQMIHz','UkgpEmnU2nSDUmOujW6W','Znhr4d5uhDKsj5poLEmZ','mlMLB4474695467','FWRyLtto1bKeKurNikKq'];
  for(const id of ids){
    const p={...get(id),preco:123,precoAnterior:456,precoPromocional:99,linkAfiliado:'https://meli.la/preservar',precoConferenciaId:'preservar',precoConferenciaValor:123},before=JSON.stringify(p),out=correctProductData(p);
    for(const key of Object.keys(p))if(!['titulo','comentario','pros','contras','nota','notaInformada'].includes(key))assert.deepEqual(out[key],p[key],id+':'+key);
    assert.equal(JSON.stringify(p),before);assert.deepEqual(correctProductData(out),out);
    assert.equal(manufacturerEvidence(out),null,'a fonte é a oferta, não o fabricante');
    const review=listingReviewFor(p);assert.equal(review.reviewedAt,'2026-10-22');
    assert.equal(listingReviewFor({...p,id:'outro'}),null);
    const html=renderManufacturerSpecifications(out);assert.match(html,/data-marketplace-specifications/);assert.doesNotMatch(html,/data-manufacturer-specifications/);
    assert.equal(listingReviewFor({...p,link:'https://www.mercadolivre.com.br/p/MLB99999999'}),null);
  }
});

test('USB não vira USB-C e potência do compressor não vira potência de carga rápida',()=>{
  assert.equal(fact('C5b5fKstKDUgNDUxnQkP','USB-C').state,'yes');
  assert.match(fact('C5b5fKstKDUgNDUxnQkP','USB-C').value,/entrada e saída/);
  assert.equal(fact('zev1LogqUFpJ3cLlIXyy','USB-C').state,'yes');
  assert.equal(fact('zev1LogqUFpJ3cLlIXyy','Carga rápida').state,'unknown');
  assert.match(fact('zev1LogqUFpJ3cLlIXyy','Carga rápida').reason,/120 W.*não foram atribuídos/);
  assert.equal(fact('BcfEuX1oed02O8pYXKyg','USB-C').state,'unknown');
  assert.equal(fact('BcfEuX1oed02O8pYXKyg','Carga rápida').state,'unknown');
  assert.equal(fact('BcfEuX1oed02O8pYXKyg','Carregamento USB').state,'yes');
  assert.match(fact('wYxgVNIJeeWmGhcToFLP','Carga rápida').value,/até 22,5 W.*não detalhados/);
});

test('relógios distinguem GPS independente de conectado e IP declarado de uso submerso garantido',()=>{
  assert.equal(fact('cSmjEdmFugRGDdJHkMcR','GPS integrado').state,'no');
  assert.match(fact('cSmjEdmFugRGDdJHkMcR','Modelo anunciado').value,/BW0223/);
  assert.equal(fact('cSmjEdmFugRGDdJHkMcR','Chamadas Bluetooth').state,'yes');
  assert.match(fact('cSmjEdmFugRGDdJHkMcR','Proteção IP').value,/IP67.*não nadar/);
  assert.equal(fact('M0Zj2K84Q8PX0YTQMIHz','GPS integrado').state,'yes');
  assert.match(fact('M0Zj2K84Q8PX0YTQMIHz','Modelo anunciado').value,/OCEAN GT.*HT-1289/);
  assert.match(fact('M0Zj2K84Q8PX0YTQMIHz','Proteção IP').value,/IPX8.*não confirmadas/);
  for(const id of ['UkgpEmnU2nSDUmOujW6W','Znhr4d5uhDKsj5poLEmZ']){
    assert.equal(fact(id,'GPS integrado').state,'no');assert.match(fact(id,'Proteção IP').value,/IP68.*não confirmadas/);
  }
  assert.notEqual(fact('UkgpEmnU2nSDUmOujW6W','Modelo anunciado').value,fact('Znhr4d5uhDKsj5poLEmZ','Modelo anunciado').value);
  assert.equal(fact('mlMLB4474695467','GPS integrado').state,'unknown');
  assert.equal(fact('mlMLB4474695467','GPS conectado').state,'yes');
  assert.equal(fact('mlMLB4474695467','Chamadas Bluetooth').state,'yes');
  assert.equal(fact('mlMLB4474695467','Proteção IP').state,'unknown');
  const row=decisionData(correctProductData(get('cSmjEdmFugRGDdJHkMcR'))).criteria.find(f=>f.label==='GPS integrado');assert.equal(row.state,'no');
});

test('FORESTORY usa Bluetooth 5.3 atual sem escolher uma das baterias ou formatos contraditórios',()=>{
  const id='FWRyLtto1bKeKurNikKq',p=correctProductData(get(id));
  assert.match(p.titulo,/Bluetooth 5\.3/);assert.doesNotMatch(p.titulo,/Bluetooth 5\.4/);
  assert.match(fact(id,'Versão Bluetooth').value,/5\.3/);
  for(const label of ['Formato','Autonomia no fone','Autonomia com estojo'])assert.equal(fact(id,label).state,'unknown');
  assert.equal(fact(id,'Cancelamento ativo de ruído').state,'no');
  const changed={...get(id),link:'https://www.mercadolivre.com.br/p/MLB68085605?pdp_filters=item_id%3AMLB9999999999'};
  assert.equal(correctProductData(changed).titulo,changed.titulo,'não atualiza outra oferta por ID reutilizado');
});
