import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyGuideDecisionSupport,decisionGuideFiles} from './guide-decision-support.mjs';
test('vinte guias recebem perguntas específicas sem escolher produtos',()=>{
 assert.equal(decisionGuideFiles.length,20);
 for(const file of decisionGuideFiles){
  const original='<main><h1>Guia preservado</h1><p>Introdução</p><nav aria-label="Tipos de produto"></nav><a id="affiliate-offer" href="https://meli.la/intacto">Loja</a></main>';
  const result=applyGuideDecisionSupport(original,file);
  assert.ok(result.includes('<h1>Guia preservado</h1>'));
  assert.ok(result.includes('href="https://meli.la/intacto"'));
  assert.equal((result.match(/<details>/g)||[]).length,3);
  assert.ok(result.indexOf('data-guide-decision')<result.indexOf('<nav'));
  assert.equal(applyGuideDecisionSupport(result,file),result);
  assert.doesNotMatch(result,/R\$|fetch\(|firebase|gtag\(|testamos|melhor geral/i);
 }
});
test('não altera fichas nem guias fora do escopo',()=>{
 assert.equal(applyGuideDecisionSupport('<main>Preservado</main>','produto/a.html'),'<main>Preservado</main>');
 assert.equal(applyGuideDecisionSupport('sem main','melhores-notebook.html'),'sem main');
});
test('alterações do roteiro acionam a publicação pelo gerador',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/update-sitemap.yml',import.meta.url),'utf8');
 assert.ok(workflow.includes('- "scripts/guide-decision-support.mjs"'));
});
