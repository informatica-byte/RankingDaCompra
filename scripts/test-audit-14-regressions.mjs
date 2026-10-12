import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {usefulEditorialItems} from './published-editorial.mjs';
import {featureEvidence} from './discovery-editorial.mjs';
import {correctProductData} from './product-title-corrections.mjs';
import {headphoneFormat} from './headphone-formats.mjs';
const ctx=vm.createContext({Date,Map,Set,Intl,URL,console});
for(const name of ['flash-offer-safety.js','weekly-comparison-safety.js'])vm.runInContext(readFileSync(new URL('../'+name,import.meta.url),'utf8'),ctx);
const flash=ctx.RDCFlashOfferSafety, weekly=ctx.RDCWeeklyComparisonSafety;
const now=Date.parse('2026-10-12T15:00:00Z');
const p={id:'p',titulo:'Tablet Lenovo 128GB',preco:'300,00',precoAnterior:'400,00',precoPromocional:'300,00',ofertaRelampagoAtiva:true,ofertaRelampagoTerminaEm:new Date(now+3600000).toISOString(),precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:new Date(now-1000).toISOString()};
test('relâmpago exige preço recente, desconto real, prazo futuro e mesma oferta',()=>{
  assert.equal(flash.evaluate(p,null,now).eligible,true);
  for(const patch of [{precoAtualizadoManualmente:false},{precoAtualizadoManualmenteEm:new Date(now-86400001).toISOString()},{precoAtualizadoManualmenteEm:new Date(now+1000).toISOString()},{precoAnterior:'200,00'},{ofertaRelampagoTerminaEm:new Date(now-1).toISOString()},{anuncioSubstituidoEm:new Date(now).toISOString()}]) assert.equal(flash.evaluate({...p,...patch},null,now).eligible,false,JSON.stringify(patch));
  const api={managed:true,status:'active',available:true,checkedAt:new Date(now).toISOString(),price:350,lightningActive:true,lightningPrice:300,regularPrice:400,lightningEndsAt:p.ofertaRelampagoTerminaEm};
  assert.equal(flash.evaluate(p,api,now).reason,'price-mismatch');
});
test('data recente do preço regular não comprova outra promoção; confirmação vincula campo e valor',()=>{
  assert.equal(flash.evaluate({...p,preco:'400,00'},null,now).eligible,false);
  assert.equal(flash.evaluate({...p,preco:'400,00',precoConferenciaCampo:'precoPromocional',precoConferenciaValor:300},null,now).eligible,true);
  assert.equal(flash.evaluate({...p,preco:'400,00',precoConferenciaCampo:'precoPromocional',precoConferenciaValor:310},null,now).eligible,false);
});
test('avisos genéricos, ausência de evidência e eco de título não ganham selo',()=>{
  const product={titulo:'Fone Bluetooth Preto',pros:'Fone Bluetooth Preto; Não há pontos positivos específicos confirmados; Confira preço e frete; Bateria anunciada para até 10 horas de reprodução'};
  assert.deepEqual(usefulEditorialItems(product,'pros'),['Bateria anunciada para até 10 horas de reprodução']);
});
test('não detalhar autonomia significa desconhecido, não ausência de bateria',()=>{
  const result=featureEvidence({contras:'A ficha técnica não detalha a autonomia da bateria.'},/autonomia|bateria/i);
  assert.equal(result.state,'unknown');
});
test('superlativos, latência sem medição e CPU 6 não se tornam fatos comprovados',()=>{
  for(const [id,titulo] of [['gNcq5nSqWbfqYi1M9c23','Lanterna Mais Forte do Mundo Apfer'],['goH2juydLAa3JYXzctkH','Fone Basike TWS'],['YdPOVmrHVJ8EO7fmgyXu','Computador PC Intel I5']]){
    const corrected=correctProductData({id,titulo,preco:'50,00',link:'https://meli.la/a',nota:4.8});
    assert.equal(corrected.preco,'50,00');assert.equal(corrected.nota,'');assert.match(corrected.comentario,/confirm|não|alega/i);
  }
  assert.equal(correctProductData({id:'SJ6VQZLSc4brIArHnkRW',titulo:'Piscina Inflável Grande'}).categoria,'esporte-e-lazer');
});
test('fones abertos, TWS e headphones não são concorrentes globais',()=>{
  assert.equal(headphoneFormat({titulo:'Fone Bluetooth TWS Ear Clip Basike'}),'open-ear');
  assert.equal(headphoneFormat({titulo:'JBL Tune 520BT Bluetooth'}),'headphone');
  assert.equal(headphoneFormat({titulo:'Redmi Buds 6 Play TWS'}),'tws');
});
test('comparativo antigo ou misto vira seleção em revisão, sem inventar ranking',()=>{
  const products=[1,2,3].map(n=>({id:'r'+n,titulo:'Roteador WiFi Modelo '+n,preco:100+n}));
  const config={publicado:true,semana:'2026-10-12',comparabilidadeRevisada:true,assinaturaEditorial:weekly.signature(products),produtos:products};
  const index={products:products.map(p=>({id:p.id,title:p.titulo,price:p.preco,checkedAt:new Date(now-1000).toISOString(),url:'/produto/'+p.id+'.html'}))};
  assert.equal(weekly.reconcile(config,index,now).needsReview,false);
  assert.equal(weekly.reconcile({...config,semana:'2026-10-05'},index,now).needsReview,true);
  assert.equal(weekly.reconcile({...config,comparabilidadeRevisada:false},index,now).needsReview,true);
  index.products[2].title='Internet via satélite Starlink';
  assert.equal(weekly.reconcile(config,index,now).comparable,false);
});
test('comparativo atualiza preço por ID e rejeita item excluído do catálogo',()=>{
  const config={produtos:[{id:'a',titulo:'Livro antigo',preco:10},{id:'removido',preco:20}]};
  const result=weekly.reconcile(config,{products:[{id:'a',title:'Livro atual',price:30,checkedAt:new Date(now-1000).toISOString(),url:'/produto/a.html'}]},now);
  assert.equal(result.products.length,1);assert.equal(result.products[0].preco,30);assert.equal(result.products[0].titulo,'Livro atual');assert.equal(result.missing[0],'removido');
});
