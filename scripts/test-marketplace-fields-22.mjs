import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MARKETPLACE_FIELD_REVIEWS,listingReviewFor} from './marketplace-field-reviews.mjs';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {comparisonData} from './product-decision.mjs';
import {documentedSpecifications,renderManufacturerSpecifications} from './manufacturer-specifications.mjs';
const catalog=JSON.parse(readFileSync(new URL('../vitrine-publica.json',import.meta.url),'utf8')).products;
const product=id=>catalog.find(p=>p.id===id);
const field=(id,label)=>comparisonData(correctProductData(product(id))).features.find(f=>f.label===label);

test('22 revisões são específicas, preservam cadastros e não viram preços ou prova de fabricante',()=>{
  assert.equal(MARKETPLACE_FIELD_REVIEWS.size,22);
  for(const [id,review]of MARKETPLACE_FIELD_REVIEWS){
    const p=product(id),before=JSON.stringify(p);assert.ok(p,id);
    assert.ok(listingReviewFor(p),id);assert.ok(documentedSpecifications(p),id);
    const after=correctProductData(p);
    for(const [key,value]of Object.entries(p))if(!['comentario','pros','contras','nota','notaInformada'].includes(key))assert.deepEqual(after[key],value,id+':'+key);
    assert.equal(JSON.stringify(p),before);assert.deepEqual(correctProductData(after),after);
    assert.equal(listingReviewFor({...p,id:'outro'}),null);
    assert.equal(listingReviewFor({...p,titulo:'Produto diferente'}),null);
    assert.equal(listingReviewFor({...p,titulo:'Capa para '+p.titulo}),null);
    assert.equal(listingReviewFor({...p,link:'https://evil.example/'+review.catalog}),null);
    assert.equal(listingReviewFor({...p,link:'https://www.mercadolivre.com.br/p/MLB99999999'}),null);
    if(review.item && review.catalog!==review.item)assert.equal(listingReviewFor({...p,link:review.sourceUrl.replace(review.item,'MLB9999999999')}),null);
    for(const f of review.features){assert.equal(f.basis,'cadastro');assert.equal(f.sourceKind,'marketplace-listing');assert.equal(f.checkedAt,'2026-10-20');assert.ok(f.sourceUrl.startsWith('https://'));if(f.state==='unknown')assert.ok(f.reason);}
    if(review.summary){assert.equal(manufacturerEvidence(after),null);assert.doesNotMatch(after.comentario,/R\$|100% garantido|garantimos/i);}
    const html=renderManufacturerSpecifications(after);assert.match(html,/data-marketplace-specifications/,id);assert.match(html,/Consultar o anúncio usado como fonte/);
  }
});

test('ENC, cancelamento genérico e nome de modelo compatível não se transformam em ANC',()=>{
  for(const id of ['1tIzUpXs4udqZOZwpQX7','BhacwzAPIbDglRkNCoyz','DlFv98xnrCPIAeFfbRFv','FpO2EOBfcTy3F04Jk6pY','goH2juydLAa3JYXzctkH','kYzXt8BeErDzXsC6BlwB','Mdyju6zRmHsKRpOYqz51','mGfjcGRX5FvusGGZMYJL','rERcfIbgG1c0uUdNlQ4o','U52A4gBWWLEmfCzONtHb','WO6BdDxEWWCCjBVJ0ygB','xUz3eJJ8CDLhc5sW47BB'])assert.equal(field(id,'Cancelamento ativo de ruído').state,'unknown',id);
  for(const id of ['c9hb1oe40g3K1dP4dAsy','FWRyLtto1bKeKurNikKq','NJipazuMXMzOH9YZbxwu','VgB90DThWdh8uyXUeE3U','z507ObVuMlSEBSnK40Uc']){
    assert.equal(field(id,'Cancelamento ativo de ruído').state,'no',id);
    assert.equal(field(id,'Cancelamento ativo de ruído').basis,'cadastro');
    assert.match(field(id,'Cancelamento ativo de ruído').value,/tabela/);
  }
});

test('bateria mantém unidade, contexto, valores contraditórios e fonte por campo',()=>{
  assert.match(field('1tIzUpXs4udqZOZwpQX7','Autonomia no fone').value,/60 h.*anunciadas/);
  assert.match(field('DlFv98xnrCPIAeFfbRFv','Autonomia no fone').value,/3 a 5 h.*contínuo/);
  assert.match(field('rERcfIbgG1c0uUdNlQ4o','Autonomia no fone').value,/3 h.*por carga/);
  assert.match(field('z507ObVuMlSEBSnK40Uc','Autonomia no fone').value,/4 a 6 h.*por carga/);
  for(const id of ['BhacwzAPIbDglRkNCoyz','FWRyLtto1bKeKurNikKq','goH2juydLAa3JYXzctkH','Mdyju6zRmHsKRpOYqz51','mGfjcGRX5FvusGGZMYJL','NJipazuMXMzOH9YZbxwu','U52A4gBWWLEmfCzONtHb','WO6BdDxEWWCCjBVJ0ygB','xUz3eJJ8CDLhc5sW47BB'])assert.equal(field(id,'Autonomia no fone').state,'unknown',id);
  assert.equal(field('FlqPY3yHJ2xPoNgnhSTE','Autonomia no fone').state,'unknown');
  assert.match(field('FlqPY3yHJ2xPoNgnhSTE','Autonomia com estojo').value,/35 h.*recargas/);
  assert.match(field('WO6BdDxEWWCCjBVJ0ygB','Autonomia no fone').reason,/espera.*reprodução/);
  assert.equal(field('VgB90DThWdh8uyXUeE3U','Autonomia no fone').state,'no');
  for(const id of ['DlFv98xnrCPIAeFfbRFv','rERcfIbgG1c0uUdNlQ4o','z507ObVuMlSEBSnK40Uc'])assert.equal(field(id,'Autonomia com estojo').state,'unknown');
});

test('modelos e campos misturados não recebem a ficha de outra marca ou edição',()=>{
  const generic=correctProductData(product('FpO2EOBfcTy3F04Jk6pY'));assert.match(generic.comentario,/marca Genérica/);assert.match(generic.contras,/não apresentamos como JBL original/);
  assert.equal(field('mGfjcGRX5FvusGGZMYJL','Versão Bluetooth').state,'unknown');
  assert.equal(field('FWRyLtto1bKeKurNikKq','Formato').state,'unknown');
  assert.equal(field('FWRyLtto1bKeKurNikKq','Versão Bluetooth').state,'unknown');
  assert.equal(field('z507ObVuMlSEBSnK40Uc','Versão Bluetooth').state,'unknown');
  for(const id of ['goH2juydLAa3JYXzctkH','xUz3eJJ8CDLhc5sW47BB']){
    assert.match(correctProductData(product(id)).comentario,/BA-FON240B/);assert.equal(field(id,'Formato').state,'unknown');
  }
  assert.equal(field('5MGE98tYssH9nEfBeHoW','Armazenamento interno').basis,'cadastro');
  assert.equal(field('5MGE98tYssH9nEfBeHoW','Memória RAM').state,'unknown');
  assert.equal(field('9P123IBTTYnSCMilPvXB','Proteção IP').state,'unknown');
  assert.equal(field('2e2m7sDdRyGHq1Tzj8ra','Rede Mesh').state,'unknown');
  assert.equal(field('YuOWci2UixF5GuQE6IYS','Quantidade de portas').state,'unknown');
});

test('fontes de fabricante anteriores e anúncio novo não são misturados sob o mesmo selo',()=>{
  const fit=correctProductData(product('5MGE98tYssH9nEfBeHoW')),record=documentedSpecifications(fit),html=renderManufacturerSpecifications(fit);
  assert.equal(record.sourceKind,'mixed-specifications');
  const official=html.match(/<section[^>]*data-manufacturer-specifications[\s\S]*?<\/section>/)?.[0];
  const listing=html.match(/<section[^>]*data-marketplace-specifications[\s\S]*?<\/section>/)?.[0];
  assert.ok(official);assert.ok(listing);assert.doesNotMatch(official,/64 GB/);assert.match(listing,/64 GB.*segundo o anúncio/);
  assert.doesNotMatch(listing,/fonte oficial/);
  assert.equal(record.features.find(f=>f.label==='Tela').basis,'fabricante');
  assert.equal(record.features.find(f=>f.label==='Armazenamento interno').basis,'cadastro');
});
