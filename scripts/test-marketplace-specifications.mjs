import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {documentedSpecifications,renderManufacturerSpecifications,MANUFACTURER_SPECIFICATIONS} from './manufacturer-specifications.mjs';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {comparisonData,renderProductDecision} from './product-decision.mjs';
import {renderIntegrityGuide} from './comparison-guides.mjs';
const id='O6e0R2WtiZfyyf2MJe5Y';
import {deletionRegressionProduct} from './fixtures/deletion-regression.mjs';
const raw=deletionRegressionProduct(id);
const url='https://www.mercadolivre.com.br/p/MLB43417665?pdp_filters=item_id%3AMLB3914161563';

test('ASUS reproduz dados vistos no anúncio sem atribuí-los ao fabricante',()=>{
  const p=correctProductData(raw),record=documentedSpecifications(p);
  assert.equal(MANUFACTURER_SPECIFICATIONS.has(id),false);
  assert.equal(record.sourceKind,'marketplace-listing');
  assert.equal(manufacturerEvidence(p),null);
  for(const f of record.features){assert.equal(f.basis,'cadastro');assert.equal(f.sourceKind,'marketplace-listing');assert.equal(f.sourceUrl,url);}
  const fields=comparisonData(p).features;
  assert.match(fields.find(f=>f.label==='Processador').value,/Ryzen 5 7520U.*segundo o anúncio/);
  assert.match(fields.find(f=>f.label==='Placa de vídeo').value,/Radeon 610M/);
  assert.match(fields.find(f=>f.label==='Sistema operacional anunciado').value,/KeepOS.*não acompanha Windows/);
  assert.match(p.comentario,/dados da oferta.*não uma validação independente/);
  assert.doesNotMatch(p.comentario+p.contras,/Part Number|confirm[aã].*ASUS|Ryzen 5 40/);
});

test('ficha e guia separam anúncio de validação independente, inclusive na regeneração',()=>{
  const p=correctProductData(raw),html=renderManufacturerSpecifications(p);
  assert.match(html,/data-marketplace-specifications/);
  assert.match(html,/Ficha informada no anúncio do Mercado Livre/);
  assert.match(html,/MLB3914161563/);
  assert.match(html,/Não altera a data da conferência do preço/);
  assert.doesNotMatch(html,/fonte oficial|Ficha conferida em fontes do fabricante|data-manufacturer-specifications/);
  const guide=renderIntegrityGuide({file:'melhores-notebook.html',title:'Notebooks',products:[p],urls:new Map([[id,'https://rankingdacompra.com.br/produto/'+id+'-20260810-1.html']]),date:'2026-10-20'});
  assert.match(guide,/Informações do anúncio do vendedor/);
  assert.match(guide,/7520U.*segundo o anúncio/);
  assert.doesNotMatch(guide,/Documentado pelo fabricante|Fonte do fabricante e condições/);
  assert.doesNotMatch(renderProductDecision(p),/Fonte: especificação anunciada pelo fabricante/);
  const source=readFileSync(new URL('./generate-discovery.mjs',import.meta.url),'utf8');
  assert.match(source,/manufacturer\|marketplace/,'regeneração remove seção anterior para não acumular dados antigos');
});

test('editorial não muda valores, datas, links, fotos ou identidade e é idempotente',()=>{
  const p={...raw,link:url,linkAfiliado:'https://meli.la/exemplo',precoProvaAnuncio:'MLB3914161563'};
  const before=JSON.stringify(p),next=correctProductData(p);
  for(const [key,value]of Object.entries(p))if(!['titulo','comentario','pros','contras','nota','notaInformada'].includes(key))assert.deepEqual(next[key],value,key);
  assert.equal(next.titulo,p.titulo);
  assert.equal(JSON.stringify(p),before);
  assert.deepEqual(correctProductData(next),next);
  for(const changed of [{...p,id:'outro'},{...p,titulo:'Outro produto'},{...p,titulo:p.titulo.replace('16 GB','8 GB')},{...p,link:'https://www.mercadolivre.com.br/p/MLB43417665?pdp_filters=item_id%3AMLB9999999999'},{...p,link:'https://example.com/MLB43417665'},{...p,titulo:'Notebook Asus Vivobook E1504FA-NJ1288 Ryzen 5 7530U 16 GB 512 GB SSD'}])assert.equal(documentedSpecifications(changed),null);
});
