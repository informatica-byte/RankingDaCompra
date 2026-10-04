import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

test('publicação sincroniza o histórico depois das páginas e inclui o arquivo no commit', async () => {
  for (const workflow of ['update-sitemap', 'sync-mercadolivre']) {
    const source = await fs.readFile(`.github/workflows/${workflow}.yml`, 'utf8');
    assert.ok(source.indexOf('node scripts/generate-sitemap.mjs') < source.indexOf('node scripts/update-price-history.mjs'));
    assert.ok(source.indexOf('node scripts/update-price-history.mjs') < source.indexOf('node scripts/validate-site.mjs'));
    assert.match(source, /git status --porcelain --[^\n]+historico-precos\.json/);
    assert.match(source, /git add -A[^\n]+historico-precos\.json/);
    // O caminho parcial continua saindo antes de registrar novas observações.
    assert.ok(source.indexOf('.ranking-generation-partial') < source.indexOf('node scripts/update-price-history.mjs'));
  }
  const historian = await fs.readFile('scripts/update-price-history.mjs', 'utf8');
  assert.doesNotMatch(historian, /fetch\(|firebase|firestore/i);
});

test('histórico compacto mantém as informações, data verdadeira e controle nativo acessível', async () => {
  const source = await fs.readFile('growth-tools.js', 'utf8');
  const fn = source.slice(source.indexOf('  function proofMarkup('), source.indexOf('  function decorateProductCard('));
  const context = { HISTORY_DAYS: 30, brl: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), dateBr: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }), Date,
    escapeHtml: value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]) };
  vm.createContext(context); vm.runInContext(fn, context);
  const summary = { points: [['2026-10-02', 58.73]], latest: { date: '2026-10-02' }, minimum: 58.73, currentPrice: 58.73 };
  const html = context.proofMarkup(summary);
  assert.match(html, /^<details\b/);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
  assert.match(html, /<summary><strong>Menor preço em até 30 dias:/);
  assert.match(html, /02\/10\/2026/);
  assert.match(html, /não é cotação atual/);
  assert.match(context.proofMarkup(summary, true), /comparar com o preço conferido acima/);
  assert.equal(context.proofMarkup({ points: [], currentPrice: 0 }), '');
});

test('home estática usa a data comprovada do preço, não a semana ou o dia da geração', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rdc-home-presentation-'));
  try {
    await fs.mkdir(path.join(root, 'produto'));
    await fs.writeFile(path.join(root, 'index.html'), '<main class="wrap"><p class="loading">Carregando</p></main>');
    const product = { id: 'fixture', titulo: 'Produto <teste>', foto: 'https://example.org/foto.jpg', productUrl: 'https://rankingdacompra.com.br/produto/fixture.html', preco: '99,90', categoria: 'casa' };
    await fs.writeFile(path.join(root, 'top5-semanal.json'), JSON.stringify({ weekStart: '2026-09-28', products: [product] }));
    await fs.writeFile(path.join(root, 'search-index.json'), JSON.stringify({ categories: [] }));
    await fs.writeFile(path.join(root, 'produto/fixture.html'), '<meta name="rdc-price-checked-at" content="2026-10-02T15:00:00Z"><meta name="rdc-price-source" content="manual">');
    execFileSync(process.execPath, [path.resolve('scripts/generate-home-static.mjs')], { cwd: root, stdio: 'pipe' });
    const home = await fs.readFile(path.join(root, 'index.html'), 'utf8');
    assert.match(home, /Registrado em 02\/10\/2026/);
    assert.match(home, /Seleção da semana de 28\/09\/2026/);
    assert.match(home, /Produto &lt;teste&gt;/);
    assert.doesNotMatch(home, /Conteúdo disponível diretamente no HTML|Preço conferido hoje/);
    await fs.writeFile(path.join(root, 'produto/fixture.html'), '<html>Sem observação comprovada</html>');
    execFileSync(process.execPath, [path.resolve('scripts/generate-home-static.mjs')], { cwd: root, stdio: 'pipe' });
    const unknown = await fs.readFile(path.join(root, 'index.html'), 'utf8');
    assert.match(unknown, /Preço informado/);
    assert.doesNotMatch(unknown, /Registrado em/);
  } finally {
    // Só remove o diretório temporário, após validar o destino absoluto.
    assert.ok((await fs.realpath(root)).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(root, { recursive: true });
  }
});

test('histórico reconhece confirmação na oferta diária, semanal e página individual', async () => {
  const source = await fs.readFile('growth-tools.js', 'utf8');
  const fn = source.slice(source.indexOf('  function cardHasConfirmedPrice('), source.indexOf('  function decorateProductCard('));
  const context = {};
  vm.createContext(context); vm.runInContext(fn, context);
  for (const text of ['Preço conferido em 03/10/2026: R$ 58,73', '✓ Preço conferido recentemente', 'Preço conferido em 03/10/2026']) {
    assert.equal(context.cardHasConfirmedPrice({ querySelectorAll: () => [{ textContent: text }] }), true);
  }
  assert.equal(context.cardHasConfirmedPrice({ querySelectorAll: () => [{ textContent: 'Último preço registrado: R$ 58,73' }] }), false);
  assert.match(source, /\.deal-card \.offer-proof\{grid-column:1\/-1;min-width:0\}/);
});
