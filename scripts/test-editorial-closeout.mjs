import test from 'node:test';
import assert from 'node:assert/strict';
import { correctProductData, manufacturerEvidence } from './product-title-corrections.mjs';

test('revisão remove laudos não comprovados e conserva campos operacionais', () => {
  const p={id:'CFEyN1hdeMSM6BS89h5o',titulo:'Creatina Dark Lab',preco:'79,00',linkAfiliado:'https://meli.la/a',precoAtualizadoManualmenteEm:'2026-10-06',comentario:'Pureza comprovada 98,1%; R$ 39,90'};
  const corrected=correctProductData(p);
  for(const key of ['id','preco','linkAfiliado','precoAtualizadoManualmenteEm'])assert.equal(corrected[key],p[key]);
  assert.doesNotMatch(corrected.comentario,/98,1|39,90/);
  assert.match(corrected.comentario,/não verificou laudos/);
  assert.equal(manufacturerEvidence(p),null);
});
test('iPhone e WAP distinguem especificação oficial de desempenho não medido', () => {
  const iphone=correctProductData({id:'MHUka27wtlYZaI8FiHWi',titulo:'Phone 17 Pro Max 256GB - Laranja-cósmico - Distribuidor Autorizado'});
  assert.equal(iphone.titulo,'iPhone 17 Pro Max 256GB — Laranja-cósmico');
  assert.match(iphone.comentario,/não comprova/);
  assert.doesNotMatch(iphone.comentario,/12GB|escolha definitiva|elimina qualquer/);
  const wap=correctProductData({id:'31Lco0eFCDaomsks3iM3',titulo:'Wap Power Speed Max'});
  assert.match(wap.comentario,/não é prova de benefício clínico/);
  assert.equal(manufacturerEvidence(wap).independentTest,false);
});
test('reutilizar ID não transfere revisão de outra marca ou modelo', () => {
  const next=correctProductData({id:'CFEyN1hdeMSM6BS89h5o',titulo:'Notebook novo',comentario:'Texto original'});
  assert.equal(next.comentario,'Texto original');
});
