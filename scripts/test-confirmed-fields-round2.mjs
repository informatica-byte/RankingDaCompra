import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {comparisonData} from './product-decision.mjs';
import {documentedSpecifications} from './manufacturer-specifications.mjs';
import {correctProductData} from './product-title-corrections.mjs';
const catalogue=JSON.parse(readFileSync(new URL('../vitrine-publica.json',import.meta.url),'utf8')).products;
const product=id=>catalogue.find(p=>p.id===id);
const field=(p,label)=>comparisonData(p).features.find(f=>f.label===label);
const ram=comentario=>field({titulo:'Notebook',comentario},'Memória RAM');

test('RAM escrita por extenso é extraída como cadastro, sem parecer validação do fabricante',()=>{
  for(const text of ['8 GB de memória RAM','16GB de memória RAM DDR5','RAM: 8 GB','Memória RAM de 8GB','8GB DDR4']){
    assert.equal(ram(text).state,'yes',text);assert.equal(ram(text).basis,'cadastro');
    assert.equal(ram(text).sourceUrl,undefined);
  }
  for(const id of ['7evzZBujin11TlbT8hvm','h0a3vchlbGQbAnHdbujA','TEaC0vVXmdvp4s8QMqpn']){
    const p=product(id),original=JSON.stringify(p);assert.ok(p);
    assert.equal(field(p,'Memória RAM').value,'8 GB');
    assert.equal(field(p,'Memória RAM').basis,'cadastro');
    assert.equal(JSON.stringify(p),original);
  }
});
test('capacidade máxima, VRAM, SSD, perguntas e contradições não são RAM instalada',()=>{
  for(const text of ['Suporta até 32 GB de memória RAM','Memória RAM máxima: 32 GB','Expansível para 32 GB de RAM','Até 16 GB de memória RAM','GPU com 8GB DDR5','Memória de vídeo: 8GB DDR5','512 GB SSD','Notebook 8GB 512SSD','Confirme os 8 GB de memória RAM','16 GB de memória RAM a confirmar'])assert.equal(ram(text).state,'unknown',text);
  assert.equal(field({titulo:'Notebook com 8GB RAM',comentario:'16 GB de memória RAM'},'Memória RAM').state,'unknown');
  const limited={titulo:'Notebook com 8GB RAM',comentario:'Suporta até 32 GB de memória RAM'};
  assert.equal(field(limited,'Memória RAM').value,'8 GB');
});
test('TW982 não Pro usa somente a tabela oficial do próprio modelo',()=>{
  const p=correctProductData(product('kYzXt8BeErDzXsC6BlwB'));
  assert.equal(comparisonData(p).family,'fone-tws');
  assert.match(field(p,'Autonomia no fone').value,/7,5 h.*60%/);
  assert.match(field(p,'Autonomia com estojo').value,/33 h.*recargas.*60%/);
  assert.equal(field(p,'Formato').basis,'fabricante');
  assert.equal(field(p,'Cancelamento ativo de ruído').state,'unknown');
  assert.match(field(p,'Autonomia no fone').sourceUrl,/01T-_TW982_.*14\.jpg/);
  for(const titulo of ['Havit TW982 Pro','Havit TW982PRO','Havit TW981','Capa para Havit TW982']) assert.equal(documentedSpecifications({...p,titulo}),null);
  assert.equal(documentedSpecifications({...p,id:'outro'}),null);
});
test('EasyMesh V4 anunciado no Brasil não afirma certificação ou firmware da unidade',()=>{
  const p=correctProductData(product('AweCTxq7vwVQ7VmN4IIg'));
  const mesh=field(p,'Rede Mesh');assert.equal(mesh.state,'yes');
  assert.match(mesh.sourceUrl,/mercusys\.com\.br\/product\/wifi-router\/mr80x\/v4/);
  assert.match(mesh.value,/firmware.*compatíveis/);
  assert.match(p.comentario,/não obteve certificação/);
  assert.equal(documentedSpecifications({...p,titulo:'Roteador Mercusys MR80X V1'}),null);
  assert.equal(documentedSpecifications({...p,titulo:'Roteador Mercusys MR80X sem revisão'}),null);
});
test('nova revisão é idempotente, não troca título, produto, preço, foto ou links',()=>{
  for(const id of ['kYzXt8BeErDzXsC6BlwB','AweCTxq7vwVQ7VmN4IIg','SJRf3jhIFlr1BQadDNnH']){
    const p=product(id),original=JSON.stringify(p),revised=correctProductData(p);
    assert.deepEqual(correctProductData(revised),revised);
    for(const [key,value]of Object.entries(p))if(!['comentario','pros','contras','nota','notaInformada'].includes(key))assert.deepEqual(revised[key],value,key);
    assert.equal(JSON.stringify(p),original);
    assert.equal(correctProductData({...p,titulo:'Outro produto',comentario:'Preservado'}).comentario,'Preservado');
  }
});
test('SKU LOQ informado confere RAM e GPU separadas, sem completar outra configuração',()=>{
  const p=correctProductData(product('SJRf3jhIFlr1BQadDNnH'));
  assert.match(field(p,'Memória RAM').value,/^8 GB DDR5-4800/);
  assert.equal(field(p,'Memória RAM').basis,'fabricante');
  assert.match(field(p,'Memória RAM').sourceUrl,/83kh0001br/);
  assert.match(field(p,'Placa de vídeo').value,/6 GB GDDR6/);
  assert.match(field(p,'Armazenamento SSD').value,/^512 GB.*PCIe Gen4/);
  assert.match(field(p,'Tela').value,/144 Hz/);
  assert.match(p.comentario,/83KH0001BR/);
  for(const titulo of [p.titulo.replace('8GB','16GB'),p.titulo.replace('RTX 3050','RTX 4050'),p.titulo.replace('i5-13450HX','i7-13650HX'),'Lenovo LOQ 15IRX9 sem configuração','Capa para '+p.titulo])assert.equal(documentedSpecifications({...p,titulo}),null,titulo);
});
