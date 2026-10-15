import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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
test('publication validator accepts real tables with attributes, not lookalikes or incomplete tags', async () => {
  const pattern = /<table(?:\s[^>]*)?>[\s\S]*?<\/table>/i;
  const source = await readFile(new URL('./validate-site.mjs',import.meta.url),'utf8');
  assert.ok(source.includes('has(html, '+pattern.toString()+', "tabela de comparação rápida ausente", file)'));
  assert.ok(pattern.test('<table><tr><td>Valor</td></tr></table>'));
  assert.ok(pattern.test('<table style="min-width:680px"><tr><td>Valor</td></tr></table>'));
  assert.ok(pattern.test('<TABLE aria-label="Comparação"><tr><td>Valor</td></tr></TABLE>'));
  assert.equal(pattern.test('<tableau>Não é tabela</tableau>'),false);
  assert.equal(pattern.test('<table><tr><td>Sem fechamento'),false);
});

