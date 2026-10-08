import test from 'node:test';
import assert from 'node:assert/strict';
import { correctProductData, manufacturerEvidence, hasDocumentedEditorialRating } from './product-title-corrections.mjs';

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

test('NAC não promete efeitos clínicos e preserva preço, links e conferência', () => {
  const p = {id:'JY36kE95u7uCT7UJWvpt',titulo:'NAC 600mg 60 cápsulas',nota:4.8,preco:49,link:'https://produto.mercadolivre.com.br/MLB-123',foto:'https://example.com/foto.jpg',precoAtualizadoManualmenteEm:'2026-10-08T10:00:00Z'};
  const fixed = correctProductData(p);
  assert.match(fixed.comentario, /não comprova efeitos/);
  assert.doesNotMatch(fixed.comentario, /blindar|rejuvenesce|fortalece sua imunidade/i);
  for (const key of ['id','preco','link','foto','precoAtualizadoManualmenteEm']) assert.equal(fixed[key], p[key]);
  assert.equal(fixed.nota, '');
  assert.equal(fixed.notaInformada, 4.8);
});
test('Brastoy desconhecido não escolhe entre 100 e 504 peças', () => {
  const fixed = correctProductData({id:'dsddqlXmq1JumgBMwtm0',titulo:'Blocos de Montar Brastoy, Magnéticos, com 504 Peças | Bloco magnetico',comentario:'Conjunto de 100 peças'});
  assert.match(fixed.titulo, /Quantidade a confirmar/);
  assert.doesNotMatch([fixed.titulo,fixed.comentario,fixed.pros].join(' '), /100|504/);
});
test('número no cadastro não comprova origem; documentação exige responsável, fonte, critérios e data', () => {
  const p = {nota:4.8};
  assert.equal(hasDocumentedEditorialRating(p), false);
  assert.equal(correctProductData(p).nota, '');
  const evidence = {...p,avaliacaoEditorial:{criterios:'Comparação documental de autonomia anunciada, preço e limitações.',responsavel:'Revisor identificado',fonte:'https://example.com/ficha',revisadoEm:'2026-10-01'}};
  assert.equal(hasDocumentedEditorialRating(evidence), true);
  assert.equal(correctProductData(evidence).nota, 4.8);
  assert.equal(hasDocumentedEditorialRating({...evidence,avaliacaoEditorial:{...evidence.avaliacaoEditorial,revisadoEm:'2999-01-01'}}), false);
});
