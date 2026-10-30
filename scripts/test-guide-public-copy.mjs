import test from 'node:test';
import assert from 'node:assert/strict';
import {guideEditorialCopy} from './guide-public-copy.mjs';
test('guia genérico ganha intenção clara sem preços ou garantias',()=>{
  const copy=guideEditorialCopy('melhores-notebook.html','Notebook: compare por tipo e informações disponíveis');
  assert.match(copy.title,/configuração/);
  assert.match(copy.description,/código da variante/);
  assert.doesNotMatch(copy.description,/R\$|melhor preço|testamos/);
});
test('revisão editorial específica não é sobrescrita por padrão de categoria',()=>{
  const copy=guideEditorialCopy('melhores-notebook.html','Guia revisado para um uso específico','Texto documentado');
  assert.equal(copy.title,'Guia revisado para um uso específico');
  assert.equal(copy.description,'Texto documentado');
});
test('endereço desconhecido não ganha conteúdo inventado',()=>{
  assert.deepEqual(guideEditorialCopy('nao-existe.html','Título','Resumo'),{title:'Título',description:'Resumo'});
});
