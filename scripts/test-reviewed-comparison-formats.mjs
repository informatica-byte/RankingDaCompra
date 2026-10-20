import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import integrity from '../comparison-integrity.js';
import {comparisonData} from './product-decision.mjs';
import {groupComparisonProducts,renderIntegrityGuide} from './comparison-guides.mjs';
import {MARKETPLACE_FIELD_REVIEWS} from './marketplace-field-reviews.mjs';

const catalog=JSON.parse(readFileSync(new URL('../vitrine-publica.json',import.meta.url),'utf8')).products;
const product=id=>catalog.find(p=>p.id===id);
const indexed=id=>{const p=product(id);return {id,title:p.titulo,comparison:comparisonData(p)};};
const released=new Map([
  ['BhacwzAPIbDglRkNCoyz','earphones-open'],
  ['DlFv98xnrCPIAeFfbRFv','earbuds-tws'],
  ['FpO2EOBfcTy3F04Jk6pY','headphones-over-wireless'],
  ['kYzXt8BeErDzXsC6BlwB','earbuds-tws'],
  ['rERcfIbgG1c0uUdNlQ4o','earbuds-tws'],
  ['z507ObVuMlSEBSnK40Uc','earbuds-tws'],
]);
const uncertain=['FWRyLtto1bKeKurNikKq','goH2juydLAa3JYXzctkH','Mdyju6zRmHsKRpOYqz51','mGfjcGRX5FvusGGZMYJL','U52A4gBWWLEmfCzONtHb','xUz3eJJ8CDLhc5sW47BB','VgB90DThWdh8uyXUeE3U'];

test('os seis formatos revisados superam títulos genéricos e a antiga exceção do LP40',()=>{
  for(const [id,expected]of released)assert.equal(integrity.type(indexed(id)),expected,id);
  // No reviewed ficha means no new inference from the old LP40/HAVIT titles.
  assert.equal(integrity.type({title:product('rERcfIbgG1c0uUdNlQ4o').titulo}),'');
  assert.equal(integrity.type({title:product('kYzXt8BeErDzXsC6BlwB').titulo}),'');
});

test('formato revisado desconhecido ou contraditório impede agrupamento pelo título',()=>{
  for(const id of uncertain){
    const p=indexed(id);
    assert.equal(p.comparison.features.find(f=>f.label==='Formato').state,'unknown',id);
    assert.equal(integrity.type(p),'',id);
    assert.equal(integrity.comparable([p,indexed('BhacwzAPIbDglRkNCoyz')]),false,id);
  }
});

test('não atribui revisão a campo sem origem válida ou formato ambíguo',()=>{
  const p=indexed('rERcfIbgG1c0uUdNlQ4o');
  const change=f=>({...p,comparison:{...p.comparison,features:p.comparison.features.map(x=>x.label==='Formato'?f(x):x)}});
  for(const sourceUrl of ['', 'javascript:alert(1)','http://example.com/spec','https://user:secret@example.com/spec'])
    assert.equal(integrity.type(change(f=>({...f,sourceUrl}))), '');
  assert.equal(integrity.type(change(f=>({...f,basis:'cadastro',sourceKind:undefined}))), '');
  assert.equal(integrity.type(change(f=>({...f,value:'Open-ear ou intra-auricular; formato contraditório'}))), '');
  assert.equal(integrity.type(change(f=>({...f,value:'Formato não esclarecido'}))), '');
  assert.equal(integrity.type({...p,title:'Capa para fone Lenovo LP40'}),'');
  assert.equal(integrity.type({...p,title:'Intercomunicador fone para capacete'}),'');
});

test('a ficha revisada não mistura in-ear, open-ear, on-ear e over-ear',()=>{
  const inEar=indexed('rERcfIbgG1c0uUdNlQ4o'),otherInEar=indexed('DlFv98xnrCPIAeFfbRFv');
  assert.equal(integrity.comparable([inEar,otherInEar]),true);
  assert.equal(integrity.comparable([inEar,indexed('BhacwzAPIbDglRkNCoyz')]),false);
  assert.equal(integrity.comparable([inEar,indexed('FpO2EOBfcTy3F04Jk6pY')]),false);
  const onEar={...inEar,id:'on',title:'Fone Bluetooth modelo de teste',comparison:{features:[{label:'Formato',value:'On-ear (sobre as orelhas)',state:'yes',basis:'fabricante',sourceUrl:'https://example.com/spec'}]}};
  assert.equal(integrity.type(onEar),'headphones-on-wireless');
  assert.equal(integrity.comparable([onEar,indexed('FpO2EOBfcTy3F04Jk6pY')]),false);
});

test('revisão não duplica LP40/HAVIT por cor nem altera preços ou registros',()=>{
  const before=JSON.stringify(catalog);
  for(const id of ['rERcfIbgG1c0uUdNlQ4o','kYzXt8BeErDzXsC6BlwB']){
    const p=indexed(id),other={...p,id:'outro',title:p.title.replace(/preto/ig,'azul')};
    assert.equal(integrity.comparable([p,other]),false);
    const groups=integrity.partition([p,other]);
    assert.equal(groups.length,1);assert.equal(groups[0].items.length,1);assert.equal(groups[0].items[0].alternatives.length,1);
  }
  groupComparisonProducts(catalog);
  assert.equal(JSON.stringify(catalog),before);
});

test('gerador de guias e comparador interativo usam os mesmos formatos nas 22 fichas',()=>{
  const targets=[...MARKETPLACE_FIELD_REVIEWS.keys()].map(product);
  const rawBefore=JSON.stringify(targets);
  const groups=groupComparisonProducts(targets);
  for(const p of targets){
    const group=groups.find(g=>g.items.some(item=>[item.product,...item.alternatives].some(x=>x.id===p.id)));
    assert.equal(group.type,integrity.type(indexed(p.id)),p.id);
  }
  assert.equal(JSON.stringify(targets),rawBefore);
  const html=renderIntegrityGuide({file:'melhores-fones-de-ouvido.html',title:'Fones',products:targets,urls:new Map(targets.map(p=>[p.id,'/produto/'+p.id+'.html'])),date:'2026-10-20'});
  const sections=[...html.matchAll(/<section[^>]*data-comparison-type="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)];
  for(const id of uncertain)assert.ok(sections.find(([,type,body])=>type==='unconfirmed'&&body.includes('data-comparison-product="'+id+'"')),id);
  for(const [id,type]of released)assert.ok(sections.find(([,kind,body])=>kind===type&&body.includes('data-comparison-product="'+id+'"')),id);
});

test('o navegador executa a mesma lógica com fichas publicadas e mantém as travas de equivalência',()=>{
  const context={window:{},URL,Intl};vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../comparison-integrity.js',import.meta.url),'utf8'),context);
  vm.runInContext(readFileSync(new URL('../buyer-tools.js',import.meta.url),'utf8'),context);
  const buyer=context.window.RDCBuyerTools;
  assert.equal(buyer.comparable([indexed('rERcfIbgG1c0uUdNlQ4o'),indexed('kYzXt8BeErDzXsC6BlwB')]),true);
  assert.equal(buyer.comparable([indexed('FWRyLtto1bKeKurNikKq'),indexed('BhacwzAPIbDglRkNCoyz')]),false);
  assert.equal(buyer.comparable([indexed('rERcfIbgG1c0uUdNlQ4o'),indexed('BhacwzAPIbDglRkNCoyz')]),false);
});
