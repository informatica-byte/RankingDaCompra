import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('flash-offers-layout.css', 'utf8');
const from = html.indexOf('function relampagoCard(');
const until = html.indexOf('let intervaloRelampago=', from);
assert.ok(from > 0 && until > from);

test('a home carrega a correção depois dos estilos genéricos', () => {
  const link = html.indexOf('<link rel="stylesheet" href="/flash-offers-layout.css?v=20261016-6">');
  assert.ok(link > html.indexOf('</style>'));
  assert.match(css, /\.flash-card,\s*\.flash-card h3\s*\{[^}]*color:\s*var\(--ink/);
});
test('layout móvel da oferta não herda as duas colunas dos cartões comuns', () => {
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /\.flash-deals \.flash-card\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/);
  assert.match(css, /\.flash-card > \*\s*\{[^}]*grid-column:\s*auto;[^}]*grid-row:\s*auto/);
  assert.match(css, /\.flash-card::before\s*\{[^}]*position:\s*static/);
  assert.match(css, /\.flash-card \.deal-tag\s*\{[^}]*position:\s*static/);
});
test('nome completo, histórico, contador e ação têm espaço próprio', () => {
  assert.match(css, /\.flash-card h3\s*\{[^}]*display:\s*block;[^}]*overflow:\s*visible;[^}]*-webkit-line-clamp:\s*unset/);
  assert.match(css, /\.flash-card \.flash-timer\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.flash-card \.offer-proof,\s*\.flash-card \.flash-timer,\s*\.flash-card \.deal-actions\s*\{\s*width:\s*100%/);
  assert.match(css, /\.flash-card \.deal-actions\s*\{[^}]*margin-top:\s*12px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
test('cartão continua mostrando preço e destino originais, sem mudar a regra da oferta', () => {
  const product = { id: 'controle', titulo: 'Controle Joystick Wireless Compatível com PC Android e N-Switch', foto: 'https://example.com/controle.jpg' };
  const ctx = {
    fimOfertaRelampago: () => new Date('2030-10-15T23:00:00Z'),
    precosOfertaRelampago: () => ({ anterior: 299, atual: 159.90 }),
    precoConfirmadoRecente: () => true, descontoOfertaRelampago: () => 47,
    produtosParaCompartilhar: new Map(), esc: value => String(value), safe: value => String(value),
    moeda: value => 'R$ ' + value.toFixed(2), urlProduto: id => '/produto/' + id + '.html',
  };
  runInNewContext(html.slice(from, until), ctx);
  const card = ctx.relampagoCard(product);
  assert.ok(card.includes(product.titulo));
  assert.ok(card.includes('R$ 159.90'));
  assert.match(card, /data-flash-countdown data-flash-end="2030-10-15T23:00:00.000Z"/);
  assert.match(card, /href="\/produto\/controle.html"/);
  assert.match(card, /data-share-product="controle"/);
  assert.ok(card.indexOf('flash-timer') < card.indexOf('deal-actions'));
});
