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

const fallbackStart = home.indexOf('function restaurarSelecaoPublicada(selecao){');
const fallbackEnd = home.indexOf('async function homeComPromocoes(){', fallbackStart);
assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart);
const fallbackCode = home.slice(fallbackStart, fallbackEnd);

test('falha de rede mantém a seleção publicada sem criar preços ou consultar Firebase', () => {
  const snapshot = { prices: ['R$ 59,00 em 11/10/2026'], querySelectorAll() { return []; }, prepend(note) { this.note = note; } };
  let restored;
  const context = {
    app: { querySelector: () => ({ replaceWith(node) { restored = node; } }) },
    document: { createElement: () => ({ setAttribute(name, value) { this[name] = value; } }) },
  };
  vm.runInNewContext(fallbackCode, context);
  assert.equal(context.restaurarSelecaoPublicada(snapshot), true);
  assert.equal(restored, snapshot);
  assert.deepEqual(snapshot.prices, ['R$ 59,00 em 11/10/2026']);
  assert.equal(snapshot.note.role, 'status');
  assert.match(snapshot.note.textContent, /preços e datas abaixo são registros/);
  assert.doesNotMatch(fallbackCode, /fetch\(|RDCPublicData|db\./);
});

test('sem snapshot a recuperação não remove o conteúdo existente', () => {
  let replaced = false;
  const context = { app: { querySelector: () => ({ replaceWith() { replaced = true; } }) } };
  vm.runInNewContext(fallbackCode, context);
  assert.equal(context.restaurarSelecaoPublicada(null), false);
  assert.equal(replaced, false);
});

test('reserva não mantém selo de preço recente ou compartilhamento incompleto', () => {
  let removed = 0;
  const date = { textContent: 'Preço conferido em 11/10/2026' };
  const snapshot = {
    querySelectorAll(selector) {
      if (selector === '.deal-validity') return [date];
      assert.equal(selector, '.deal-check, [data-share-product]');
      return [{ remove() { removed++; } }, { remove() { removed++; } }];
    },
    prepend() {},
  };
  const context = {
    app: { querySelector: () => ({ replaceWith() {} }) },
    document: { createElement: () => ({ setAttribute() {} }) },
  };
  vm.runInNewContext(fallbackCode, context);
  assert.equal(context.restaurarSelecaoPublicada(snapshot), true);
  assert.equal(removed, 2);
  assert.equal(date.textContent, 'Registro de preço de 11/10/2026');
});

test('snapshot é guardado antes da renderização e restaurado somente se o catálogo falhar', () => {
  const body = home.slice(fallbackEnd);
  assert.ok(body.indexOf("document.querySelector('.static-home')") < body.indexOf('await home();'));
  assert.match(body, /catalogoCarregado = true;/);
  assert.match(body, /if \(!catalogoCarregado && restaurarSelecaoPublicada\(selecaoPublicada\)\) return;/);
});
