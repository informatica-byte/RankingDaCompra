import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MANUFACTURER_SPECIFICATIONS,documentedSpecifications,renderManufacturerSpecifications} from './manufacturer-specifications.mjs';
import {comparisonData,renderProductDecision} from './product-decision.mjs';
import {renderIntegrityGuide} from './comparison-guides.mjs';
const catalogue=JSON.parse(await readFile(new URL('../vitrine-publica.json',import.meta.url),'utf8')).products;
const product=id=>catalogue.find(p=>p.id===id);
const feature=(id,label)=>comparisonData(product(id)).features.find(f=>f.label===label);

test('as revisões usam modelo exato e não mudam cadastros, preço ou prova de conferência',()=>{
  assert.equal(MANUFACTURER_SPECIFICATIONS.size,22);
  for(const [id] of MANUFACTURER_SPECIFICATIONS){
    const p=product(id);assert.ok(p,id);const before=JSON.stringify(p);
    const record=documentedSpecifications(p);assert.ok(record,id);
    assert.ok(record.features.some(f=>f.basis==='fabricante'));
    for(const f of record.features.filter(f=>f.basis==='fabricante')){
      const url=new URL(f.sourceUrl);assert.equal(url.protocol,'https:');
      assert.match(url.hostname,/(?:mi\.com|jbl\.com\.br|logitech\.com|wap\.ind\.br|amd\.com|asus\.com|amazfit\.com|soundcore\.com|samsung\.com|tp-link\.com|huawei\.com|mercusys\.com(?:\.br)?|intelbras\.com|lenovo\.com|shopify\.com)$/);
      assert.equal(f.checkedAt,record.checkedAt);
    }
    assert.equal(documentedSpecifications({...p,titulo:'Produto completamente diferente',title:''}),null);
    assert.equal(documentedSpecifications({...p,titulo:'Capa para '+p.titulo}),null);
    renderManufacturerSpecifications(p);comparisonData(p);
    assert.equal(JSON.stringify(p),before);
  }
});
test('documentação de outro modelo, versão ou cadastro nunca completa por semelhança',()=>{
  for(const [id,titulo] of [['ARscPKCMZs3D8k22qltl','Redmi Buds 6 Active'],['GjHJtzdsIhbmSINvhPeX','JBL Tune 530BT'],['48oRcQNlH00KgNLHkvsG','Xiaomi Smart Band 9 Pro'],['5bQKU9inL3pq14yE8K4L','soundcore P40i']]) assert.equal(documentedSpecifications({id,titulo}),null);
  assert.equal(documentedSpecifications({id:'outro',titulo:product('GjHJtzdsIhbmSINvhPeX').titulo}),null);
  const copy=documentedSpecifications(product('GjHJtzdsIhbmSINvhPeX'));copy.features[0].value='Alterado';
  assert.notEqual(documentedSpecifications(product('GjHJtzdsIhbmSINvhPeX')).features[0].value,'Alterado');
});
test('ausência de ANC tem prova explícita; microfone não significa desempenho testado',()=>{
  for(const id of ['ARscPKCMZs3D8k22qltl','4eal5Q0HLTcrspjkUwee']){
    assert.equal(feature(id,'Cancelamento ativo de ruído').state,'no');
    assert.match(feature(id,'Cancelamento ativo de ruído').sourceUrl,/KA-309446/);
    assert.equal(feature(id,'Microfone').state,'yes');
    assert.match(feature(id,'Autonomia com estojo').value,/36 h.*recargas/);
  }
  assert.equal(feature('GjHJtzdsIhbmSINvhPeX','Microfone').basis,'fabricante');
  assert.match(renderManufacturerSpecifications(product('GjHJtzdsIhbmSINvhPeX')),/não significa qualidade de chamada testada/);
});
test('bateria dos TWS é separada por sessão e estojo, sem transplantar números de outro modelo',()=>{
  assert.match(feature('5bQKU9inL3pq14yE8K4L','Autonomia no fone').value,/10 h/);
  assert.match(feature('5bQKU9inL3pq14yE8K4L','Autonomia com estojo').value,/45 h.*recargas/);
  assert.equal(feature('FlqPY3yHJ2xPoNgnhSTE','Autonomia no fone').state,'unknown');
  assert.match(feature('FlqPY3yHJ2xPoNgnhSTE','Autonomia com estojo').value,/35 h.*desligado.*20 h.*ligado/);
  assert.equal(comparisonData(product('FlqPY3yHJ2xPoNgnhSTE')).family,'fone-tws');
});
test('divergências oficiais e configuração desconhecida permanecem a confirmar',()=>{
  const ports=feature('YuOWci2UixF5GuQE6IYS','Quantidade de portas');assert.equal(ports.state,'unknown');assert.match(ports.reason,/três.*quatro/);
  assert.match(feature('qZUWO8WSrcOKWVrAqTW7','Quantidade de portas').value,/1 porta WAN \+ 3 portas LAN/);
  assert.match(feature('LUsq533hX6lTuHwnZbhz','Quantidade de portas').value,/2 portas.*por unidade/);
  assert.equal(feature('O6e0R2WtiZfyyf2MJe5Y','Processador').state,'unknown');
  assert.match(feature('O6e0R2WtiZfyyf2MJe5Y','Processador').reason,/7520U.*Ryzen 5 40/);
  assert.match(feature('O6e0R2WtiZfyyf2MJe5Y','Memória RAM').value,/16 GB LPDDR5/);
  assert.match(feature('O6e0R2WtiZfyyf2MJe5Y','Armazenamento SSD').value,/512 GB SSD NVMe/);
  assert.match(renderManufacturerSpecifications(product('O6e0R2WtiZfyyf2MJe5Y')),/20\/10\/2026/);
});
test('destaques sem perfil antigo também ganham dados documentados e limites',()=>{
  for(const id of ['48oRcQNlH00KgNLHkvsG','UvxFn4gfaexb8TvcaT5e','huCYMmOsGPKJ8jOiJ1gR']){
    assert.ok(comparisonData(product(id)).features.length>=6);
    const html=renderManufacturerSpecifications(product(id));assert.match(html,/data-manufacturer-specifications/);assert.match(html,/não altera a data da conferência do preço/);
  }
  assert.match(feature('huCYMmOsGPKJ8jOiJ1gR','Vazão nominal máxima').value,/270 L/);
  assert.match(feature('huCYMmOsGPKJ8jOiJ1gR','Vazão máxima da bomba').value,/360 L/);
});
test('guias exibem fontes por campo e razões das pendências de forma indexável',()=>{
  const p=product('YuOWci2UixF5GuQE6IYS');
  const html=renderIntegrityGuide({file:'melhores-roteador.html',title:'Roteadores',products:[p],urls:new Map([[p.id,'https://rankingdacompra.com.br/produto/'+p.id+'-20260810-1.html']]),date:'2026-10-19'});
  assert.match(html,/Por que estes dados continuam a confirmar/);assert.match(html,/visão geral oficial informa três/);assert.match(html,/fonte oficial/);
});
test('microfone numa webcam ou brinquedo não cria ficha e pendências de fone',()=>{
  for(const titulo of ['Webcam GoodVision USB com Microfone','Guitarra E Microfone Infantil Instrumento Brinquedo Musical']){
    assert.equal(comparisonData({titulo}),null);assert.equal(renderProductDecision({titulo}),'');
  }
  assert.equal(comparisonData({titulo:'Fone de ouvido TWS'}).family,'fone-tws');
});
test('notebooks Lenovo com códigos diferentes não compartilham a configuração de SSD',()=>{
  assert.match(feature('mlMLB5212483469','Armazenamento SSD').value,/^256 GB/);
  assert.match(feature('XCp2wV9P76JfBz2zuUTX','Armazenamento SSD').value,/^512 GB/);
  assert.match(feature('mlMLB5212483469','Processador').sourceUrl,/83NS0003BR/);
  assert.equal(documentedSpecifications({...product('mlMLB5212483469'),titulo:product('XCp2wV9P76JfBz2zuUTX').titulo}),null);
});
