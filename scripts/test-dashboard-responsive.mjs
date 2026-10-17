import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');

test('relatório comercial pode encolher as colunas no celular sem cortar dados', () => {
  assert.match(css, /\.central-relatorio-grid\s*>\s*\*\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)[^\n]*\.central-relatorio-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /\.central-relatorio-grid\s+\.tabela-central\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/);
  assert.match(css, /\.tabela-central\{overflow:auto\}/);
  assert.doesNotMatch(css, /(?:body|html)\s*\{[^}]*overflow-x:\s*hidden/);
});
