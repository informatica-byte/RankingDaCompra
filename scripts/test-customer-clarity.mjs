import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HIGHLIGHT_EDITORIAL} from './highlight-editorial.mjs';
import {correctProductData} from './product-title-corrections.mjs';
import {comparisonData} from './product-decision.mjs';

const ports = product => comparisonData({titulo:'Roteador', ...product}).features.find(f=>f.label==='Quantidade de portas');
test('portas por extenso e funções não se perdem ou viram contagem total inventada',()=>{
  assert.equal(ports({comentario:'Tem quatro portas LAN de 100 Mbps.'}).value,'4 portas LAN anunciadas');
  assert.equal(ports({comentario:'Três portas Gigabit Ethernet com adaptação WAN e LAN.'}).value,'3 portas anunciadas');
  assert.equal(ports({comentario:'4 portas LAN; 1 porta WAN.'}).value,'4 portas LAN + 1 porta WAN anunciadas');
  assert.equal(ports({comentario:'Quatro portas LAN.',pros:'4 portas LAN.'}).state,'yes');
  assert.equal(ports({comentario:'Quatro portas LAN.',pros:'3 portas LAN.'}).state,'unknown');
  for (const comentario of ['Compare outros modelos com quatro portas LAN.','Confirme se tem quatro portas LAN.','Quantidade de portas a confirmar.','Sem confirmação de quatro portas LAN.']) assert.equal(ports({comentario}).state,'unknown');
});
test('os seis destaques têm análise específica, modelo protegido e dados operacionais intactos',async()=>{
  const catalogue=JSON.parse(await readFile(new URL('../vitrine-publica.json',import.meta.url),'utf8'));
  for(const [id,review] of HIGHLIGHT_EDITORIAL){
    const original=catalogue.products.find(p=>p.id===id);
    assert.ok(original && review.model.test(original.titulo),id);
    const revised=correctProductData(original);
    assert.ok(revised.pros.split('\n').length>=2);
    assert.ok(revised.contras.split('\n').length>=2);
    for(const [key,value] of Object.entries(original)) if(!['comentario','pros','contras','nota','notaInformada'].includes(key)) assert.deepEqual(revised[key],value,key);
    assert.equal(correctProductData({...original,titulo:'Produto completamente diferente',comentario:'Preservado'}).comentario,'Preservado');
    assert.deepEqual(correctProductData(revised),revised);
  }
});
test('limitações verificáveis permanecem e números ambíguos do notebook não viram RAM/SSD',()=>{
  const asus=correctProductData({id:'O6e0R2WtiZfyyf2MJe5Y',titulo:'Notebook Asus Vivobook Go 15 Ryzen 5 7520u 16gb 512ssd'});
  const data=comparisonData(asus);
  for(const label of ['Memória RAM','Armazenamento SSD']) assert.equal(data.features.find(f=>f.label===label).state,'unknown');
  assert.match(asus.contras,/Keep OS/);
  const band=HIGHLIGHT_EDITORIAL.get('48oRcQNlH00KgNLHkvsG');
  assert.match(band.summary,/não para diagnóstico/);
  assert.match(HIGHLIGHT_EDITORIAL.get('huCYMmOsGPKJ8jOiJ1gR').summary,/nominal de 1.015 PSI/);
});
test('celular mantém privacidade acessível no fluxo e remove botões sobre cartões',async()=>{
  const source=await readFile(new URL('../privacy-controls.js',import.meta.url),'utf8');
  assert.match(source,/rdc-privacy-settings\{position:static/);
  assert.match(source,/club-floating,\.club-floating-close\{display:none!important/);
  assert.match(source,/weekly-card \.weekly-discount\{position:static/);
  assert.match(source,/settings.addEventListener\('click'/);
});
