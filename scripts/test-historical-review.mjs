import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {legacyProductAliases,productAliasPage} from './product-url-continuity.mjs';
import {correctProductData} from './product-title-corrections.mjs';
import {documentedSpecifications,renderManufacturerSpecifications} from './manufacturer-specifications.mjs';
import {comparisonData} from './product-decision.mjs';

import {reviewCatalogue as catalogue,reviewProduct as product} from './fixtures/review-products.mjs';
const registry=JSON.parse(readFileSync(new URL('../product-url-aliases.json',import.meta.url),'utf8'));
const oldOffers=[
  ['PIogVXjZBCR03LoHIPLE','VzQgxGhowdzlfNshI3ZC','MLB6756757832'],
  ['L9Vdxx2fNGSSaTR0d7Iu','CFEyN1hdeMSM6BS89h5o','MLB3817089255'],
  ['eLIzAkv4GxeN7eIPOKEx','Th1cm6hi9QYlLqUWQKgq','MLB3371578831'],
  ['aNbistjKOWFkFjMw9PYJ','Th1cm6hi9QYlLqUWQKgq','MLB3371578831'],
];
test('quatro URLs históricas dependem do mesmo anúncio e modelo, não só de um ID reutilizável',()=>{
  for(const [old,id,itemId] of oldOffers){
    const file=old+'-20260810-1.html',p={...product(id),link:'https://www.mercadolivre.com.br/p/MLB12345678?pdp_filters=item_id%3A'+itemId};
    assert.ok(product(id),id);assert.equal(registry[file].itemId,itemId);
    assert.equal(legacyProductAliases(registry,[p]).get(file),p);
    for(const changed of [{...p,titulo:'Outro produto'}, {...p,link:'https://www.mercadolivre.com.br/p/MLB99999999'}, {...p,link:'https://evil.example/MLB'+itemId.slice(3)}, {...p,link:''}]) assert.equal(legacyProductAliases(registry,[changed]).has(file),false);
    assert.equal(legacyProductAliases(registry,[]).has(file),false);
    const html=productAliasPage(p.titulo,'https://rankingdacompra.com.br/produto/'+id+'-20260810-1.html');
    assert.match(html,/noindex,follow/);assert.doesNotMatch(html,/R\$\s*\d/);
  }
  assert.equal(legacyProductAliases(registry,catalogue).has('retirado-desconhecido.html'),false);
});
test('provas incompletas não autorizam um redirecionamento histórico',()=>{
  for(const proof of [{id:'x',itemId:'MLB123456',modelWords:[]},{id:'x',itemId:'MLB123456',modelWords:['.*']},{id:'x',itemId:'MLBU123456',modelWords:['fone']}]) assert.throws(()=>legacyProductAliases({'old.html':proof},[]),/inválida/);
});
test('cadastro deduplicado usa apenas o canônico do mesmo anúncio e modelo; ausência não autoriza destino',()=>{
  const file='eLIzAkv4GxeN7eIPOKEx-20260810-1.html';
  const original=product('Th1cm6hi9QYlLqUWQKgq');
  const canonical={...original,id:'canonical-fixture',link:'https://www.mercadolivre.com.br/p/MLB12345678?pdp_filters=item_id%3AMLB3371578831'};
  const duplicates=new Map([[original.id,canonical]]);
  assert.equal(legacyProductAliases(registry,[canonical],duplicates).get(file),canonical);
  assert.equal(legacyProductAliases(registry,[],duplicates).has(file),false);
  for(const changed of [{...canonical,titulo:'Produto diferente'},{...canonical,link:'https://www.mercadolivre.com.br/p/MLB99999999'}]) {
    assert.equal(legacyProductAliases(registry,[changed],new Map([[original.id,changed]])).has(file),false);
  }
});
test('testes de identidade não exigem que o catálogo publicado contenha os cadastros históricos',()=>{
  for(const name of ['test-historical-review.mjs','test-manufacturer-specifications.mjs']) {
    const source=readFileSync(new URL('./'+name,import.meta.url),'utf8');
    assert.doesNotMatch(source,/new URL\(['"]\.\.\/vitrine-publica\.json/);
    assert.match(source,/fixtures\/review-products\.mjs/);
  }
  assert.throws(()=>product('cadastro-inexistente'),/Identidade de teste ausente/);
  const first=product('XCp2wV9P76JfBz2zuUTX');first.titulo='Alterado';
  assert.match(product(first.id).titulo,/83NS0002BR/);
});
test('revisões preservam todos os dados operacionais, são idempotentes e não se aplicam a outro modelo',()=>{
  for(const id of ['O6e0R2WtiZfyyf2MJe5Y','9P123IBTTYnSCMilPvXB','5MGE98tYssH9nEfBeHoW']){
    const original=product(id),before=JSON.stringify(original),revised=correctProductData(original);
    for(const [key,value] of Object.entries(original))if(!['titulo','comentario','pros','contras','nota','notaInformada'].includes(key))assert.deepEqual(revised[key],value,key);
    assert.deepEqual(correctProductData(revised),revised);assert.equal(JSON.stringify(original),before);
    assert.equal(correctProductData({...original,titulo:'Outro produto',comentario:'Preservado'}).comentario,'Preservado');
    assert.ok(documentedSpecifications(revised));
  }
  for(const [id,titulo] of [['9P123IBTTYnSCMilPvXB','Amazfit Bip 6 Pro'],['5MGE98tYssH9nEfBeHoW','HUAWEI WATCH FIT 5 Pro'],['5MGE98tYssH9nEfBeHoW','HUAWEI WATCH FIT 4'],['O6e0R2WtiZfyyf2MJe5Y','Notebook Asus Vivobook Go 15 7520u 8GB 256GB SSD']])assert.equal(documentedSpecifications({id,titulo}),null);
});
test('relógios separam IP e ATM e removem apenas alegações não comprovadas',()=>{
  const bip=correctProductData(product('9P123IBTTYnSCMilPvXB'));
  assert.equal(comparisonData(bip).family,'watch-smart');
  assert.doesNotMatch(bip.titulo,/Alexa/i);
  const b=comparisonData(bip).features;
  assert.equal(b.find(f=>f.label==='Proteção IP').state,'unknown');
  assert.match(b.find(f=>f.label==='Resistência à água').value,/5 ATM/);
  assert.equal(b.find(f=>f.label==='Chamadas Bluetooth').basis,'fabricante');
  const fit=correctProductData(product('5MGE98tYssH9nEfBeHoW'));
  assert.equal(comparisonData(fit).family,'watch-smart');
  assert.doesNotMatch(fit.titulo,/64\s*gb|182"/i);assert.match(fit.titulo,/1,82/);
  const f=comparisonData(fit).features;
  assert.match(f.find(x=>x.label==='Proteção IP').value,/IP6X.*poeira/);
  assert.equal(f.find(x=>x.label==='Armazenamento interno').state,'yes');
  assert.equal(f.find(x=>x.label==='Armazenamento interno').basis,'cadastro');
  assert.match(f.find(x=>x.label==='Armazenamento interno').value,/64 GB.*vendedor.*segundo o anúncio/);
  assert.equal(f.find(x=>x.label==='Memória RAM').state,'unknown','não copia o armazenamento como RAM');
  assert.doesNotMatch(renderManufacturerSpecifications(product('GjHJtzdsIhbmSINvhPeX')),/20\/10\/2026/,'revisar outro modelo não renova datas antigas');
});
