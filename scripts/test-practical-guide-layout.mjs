import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPracticalSection} from './discovery-editorial.mjs';

test('practical tables scroll within their container in every guide template', () => {
  for (const category of ['fone','roteador','smartwatch']) {
    const product = {id:'sample',titulo:'Modelo cadastrado',comentario:'Microfone informado'};
    const before = JSON.stringify(product);
    const html = renderPracticalSection(category,[product],new Map([['sample','/produto/sample.html']]));
    assert.match(html,/class="table-wrap"[^>]*tabindex="0"[^>]*role="region"/);
    assert.match(html,/aria-label="Tabela de recursos anunciados/);
    assert.match(html,/style="overflow-x:auto;max-width:100%;overscroll-behavior-x:contain"/);
    assert.match(html,/<table style="width:100%;min-width:680px;border-collapse:collapse">/);
    assert.match(html,/Deslize a tabela para ver todas as colunas/);
    assert.equal((html.match(/<table /g)||[]).length,1);
    assert.equal(JSON.stringify(product),before);
  }
});
test('unrelated categories do not acquire an empty comparison table', () => {
  assert.equal(renderPracticalSection('beleza',[],new Map()),'');
});

