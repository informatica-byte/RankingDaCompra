import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {refreshLedger} from './site-improvement-ledger.mjs';

test('triagem pontual não converte alegações sem prova em evidência de fabricante',()=>{
 for(const [id,titulo] of [['jGYvacocpYFsksmL0eAG','50km/h 4x4 Carro Controle Remoto Off Road Alta Velocidade'],['5FQyewGiYpron6Bn32d1','85cm Escorredor De Louça Pratos Organizador De Pia Cozinha'],['CXMWhCkfWah2EmRBTFtF','Attracione Men perfume Masculino Com Feromônios Ativados 25 mL']]){
  const raw={id,titulo,link:'https://meli.la/preservado',preco:123};const p=correctProductData(raw);
  assert.equal(p.link,raw.link);assert.equal(p.preco,raw.preco);assert.equal(manufacturerEvidence(raw),null);
  assert.match(p.comentario,/Não (?:testamos|medimos)|não verificamos/);
  assert.equal(correctProductData({...raw,titulo:'Produto de outro tipo'}).titulo,'Produto de outro tipo');
 }
});

test('mangueira tem título legível dentro do limite, sem reescrever sua ficha; fone deixa de prometer autonomia',async()=>{
 const raw={id:'MWjfkNgY4oXJD8NhCOQn',titulo:'angueira Jardim 20m Metros Com Esguicho Trançada Reforçada Flexível 7/16 Anti Dobra Irrigação Quintal Poço Lavagem Durável Marqs Home',comentario:'Descrição existente',pros:'Pontos existentes',contras:'Cuidados existentes'};
 const p=correctProductData(raw);assert.equal(p.titulo,'Mangueira de jardim Marqs Home 20 m com esguicho 7/16');assert.ok(p.titulo.length<=100);assert.equal(p.comentario,raw.comentario);assert.equal(p.pros,raw.pros);assert.equal(p.contras,raw.contras);
 const c=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));const f=c.products.find(x=>x.id==='Mdyju6zRmHsKRpOYqz51');assert.match(f.title,/marca e autonomia a confirmar/);assert.doesNotMatch(f.title,/40\s*h/i);assert.equal(f.decisionBrief.reviewed,false);
});

test('as correções pontuais estão na busca sem transformar cinco ajustes em novas análises profundas',async()=>{
 const s=JSON.parse(await readFile(new URL('../search-index.json',import.meta.url),'utf8'));const c=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));
 assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 assert.match(s.products.find(p=>p.id==='MWjfkNgY4oXJD8NhCOQn').title,/^Mangueira/);
 assert.match(s.products.find(p=>p.id==='jGYvacocpYFsksmL0eAG').title,/velocidade anunciada não testada/);
 assert.doesNotMatch(s.products.find(p=>p.id==='5FQyewGiYpron6Bn32d1').summary,/Excelente capacidade|suportando até 20kg/);
 assert.match(s.products.find(p=>p.id==='CXMWhCkfWah2EmRBTFtF').summary,/não verificamos a composição nem comprovamos qualquer efeito de atração/);
 for(const id of ['Mdyju6zRmHsKRpOYqz51','MWjfkNgY4oXJD8NhCOQn','jGYvacocpYFsksmL0eAG','5FQyewGiYpron6Bn32d1','CXMWhCkfWah2EmRBTFtF']){
  const h=await readFile(new URL('../produto/'+id+'-20260810-1.html',import.meta.url),'utf8');
  const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  const a=nodes.find(n=>n['@type']==='Article');assert.equal(a.about.name,c.products.find(p=>p.id===id).title);
  if(id!=='MWjfkNgY4oXJD8NhCOQn')assert.equal(a.description,s.products.find(p=>p.id===id).summary);
 }
});

test('triagem sem mudança e pendência de fonte não voltam à fila sem alteração real do conteúdo',()=>{
 const c={generatedAt:'2026-10-30',products:[{id:'x',title:'Existente',summary:'Informação limitada',decisionBrief:{reviewed:false},comparison:null}]};
 for(const status of ['screened_no_change','needs_source','targeted_correction_complete']){
  const first=refreshLedger(c);first.items[0].status=status;const second=refreshLedger(c,first);
  assert.equal(second.items[0].status,status);assert.equal(second.counts[status],1);
  const changed=refreshLedger({...c,products:[{...c.products[0],summary:'Nova informação'}]},second);
  assert.equal(changed.items[0].status,'pending');assert.equal(changed.items[0].previousState,status);
 }
});
