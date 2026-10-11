import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import choices from '../best-choices.js';

const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const start = home.indexOf('  if (ancoraRadar) ancoraRadar.parentNode.insertBefore(secao, ancoraRadar);');
const end = home.indexOf('  if (top5Semanal.length)', start);
assert.ok(start >= 0 && end > start, 'bloco de inserção da seleção encontrado');
const insertion = home.slice(start, end);

for (const anchored of [false, true]) {
  for (const withGuides of [false, true]) {
    test(`seleção aparece com radar=${anchored} e guias=${withGuides}`, () => {
      const selection = {}, inserted = [];
      let removedGuide = false;
      const main = { prepend: node => inserted.push(node) };
      const guide = { remove: () => { removedGuide = true; } };
      const anchor = anchored ? { parentNode: { insertBefore: node => inserted.push(node) } } : null;
      vm.runInNewContext(insertion, {
        ancoraRadar: anchor, secao: selection,
        rankingsDestaque: withGuides ? [{}] : [],
        app: { querySelector: selector => selector === 'main' ? main : guide },
      });
      assert.deepEqual(inserted, [selection]);
      assert.equal(removedGuide, withGuides);
    });
  }
}

test('título permanente não recebe o fallback de achados do dia', () => {
  const daily = { checkChoices() { throw new Error('não deve validar o título padrão como oferta diária'); } };
  for (const value of [undefined, choices.DEFAULT_TITLE, 'Achados do dia: opções selecionadas']) {
    assert.equal(choices.title(value, [], daily), choices.DEFAULT_TITLE);
  }
});

test('página retirada limita a largura inclusive de recursos inseridos', async () => {
  const source = await readFile(new URL('./product-url-continuity.mjs', import.meta.url), 'utf8');
  assert.match(source, /\*\{box-sizing:border-box\}/);
  assert.match(source, /overflow-wrap:anywhere/);
  assert.match(source, /min-width:0;max-width:100%/);
});
