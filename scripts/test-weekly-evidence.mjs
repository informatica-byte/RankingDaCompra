import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const safety = createRequire(import.meta.url)('../weekly-comparison-safety.js');
test('ausência, instruções genéricas e repetição do título não são evidência semanal', () => {
  assert.deepEqual(safety.specificEvidence([
    'A ficha cadastrada ainda não traz pontos positivos específicos suficientes',
    'Confirme compatibilidade, garantia, frete e vendedor',
    'Configuração que exige atenção às diretrizes do fabricante',
    'Roteador Mercusys MR80X Wi-Fi 6',
  ], 'Roteador Mercusys MR80X Wi-Fi 6'), []);
});
test('características concretas são preservadas sem copiar elogios genéricos', () => {
  assert.deepEqual(safety.specificEvidence('Excelente relação custo-benefício, Possui portas Gigabit LAN e WAN, Não possui portas USB integradas'), [
    'Possui portas Gigabit LAN e WAN', 'Não possui portas USB integradas',
  ]);
});
test('uma única visita ou poucos cliques não pontuam como procura comprovada', () => {
  assert.equal(safety.demandScore(0, 1, 1), 60);
  assert.equal(safety.demandScore(0, 0, 1), 60);
  assert.equal(safety.demandScore(2, 0, 8), 60);
  assert.ok(safety.demandScore(5, 20, 40) > safety.demandScore(0, 0, 40));
});
test('amostra ponderada do conjunto ativa interesse somente a partir de 20', () => {
  assert.equal(safety.demandSample([{clicks: 2, views: 3}, {clicks: 2, views: 0}]), 19);
  assert.equal(safety.demandScore(2, 3, 11, 19), 60);
  assert.equal(safety.demandSample([{clicks: 2, views: 4}, {clicks: 2, views: 0}]), 20);
  assert.equal(safety.demandScore(2, 4, 12, 20), 100);
  assert.equal(safety.demandValue({clicks: -5, views: Infinity}), 0);
});
test('nota exige fonte HTTPS, quantidade e verificação explícita', () => {
  for (const product of [
    {nota: 4.8}, {nota: 4.8, avaliacaoVerificada: true},
    {nota: 4.8, avaliacaoVerificada: true, avaliacaoFonte: 'javascript:alert(1)', avaliacaoQuantidade: 20},
    {nota: 4.8, avaliacaoVerificada: true, avaliacaoFonte: 'https://example.org/reviews', avaliacaoQuantidade: 0},
  ]) assert.equal(safety.ratingEvidence(product).verified, false);
  assert.equal(safety.ratingEvidence({nota: 4.8, avaliacaoVerificada: true,
    avaliacaoFonte: 'https://example.org/reviews', avaliacaoQuantidade: 20}).verified, true);
});
test('comparativo não usa preço promocional vencido ou inativo', () => {
  const now = Date.parse('2026-10-12T20:00:00Z');
  const product = {preco: '109,00', precoAnterior: '109,00', precoPromocional: '99,73', promocaoValidaAte: '2026-09-16'};
  assert.equal(safety.productPrice(product, now), 109);
  assert.equal(safety.productPrice({...product, ofertaRelampagoAtiva: true}, now), 109);
  assert.equal(safety.productPrice({...product, ofertaRelampagoAtiva: true, ofertaRelampagoTerminaEm: '2026-10-13T20:00:00Z'}, now), 99.73);
  assert.equal(safety.productPrice({...product, ofertaRelampagoAtiva: true, ofertaRelampagoTerminaEm: '2026-10-13T20:00:00Z', ofertaRelampagoComecaEm: '2026-10-13T10:00:00Z'}, now), 109);
  assert.equal(safety.productPrice({...product, promocaoAtiva: true, promocaoValidaAte: '2026-10-12'}, now), 99.73);
  assert.equal(safety.productPrice({...product, promocaoAtiva: true, promocaoValidaAte: '2026-10-11'}, now), 109);
});
test('editorial recusa superlativos e promessas sem comprovação', () => {
  for (const text of ['Melhor geral', 'Melhor custo-benefício', 'Maior alcance', 'Excelente estabilidade', 'Nós testamos o produto']) {
    assert.equal(safety.editorialTextAllowed(text), false, text);
  }
  assert.equal(safety.editorialTextAllowed('Wi-Fi 6 em 5 GHz; confirme a versão no anúncio.'), true);
});

const growth = await readFile(new URL('../growth-tools.js', import.meta.url), 'utf8');
const functions = ['repairPortugueseText', 'numberPrice', 'escapeHtml', 'weeklyTextList', 'weeklyClamp',
  'weeklyScoreProducts', 'weeklyReason', 'weeklyHighlights', 'weeklyCardSummary', 'weeklyRankingCard'];
const weeklySource = functions.map(name => {
  const match = growth.match(new RegExp('  function ' + name + '\\([^]*?\\n  \\}'));
  assert.ok(match, name + ' deve existir');
  return match[0];
}).join('\n');
const weekly = vm.createContext({window: {RDCWeeklyComparisonSafety: safety},
  brl: new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'})});
vm.runInContext(weeklySource, weekly);
const routers = [
  {id: 'basic', titulo: 'Roteador TL-WR840N', preco: 99.73, nota: 4.8, clicks: 0, views: 1,
    pros: ['Possui quatro portas LAN de 100 Mbps'], cons: ['Opera apenas na banda de 2,4 GHz']},
  {id: 'ax3000', titulo: 'Roteador MR80X V4', preco: 198.75, nota: 4.8, clicks: 0, views: 0,
    pros: ['Possui portas Gigabit LAN e WAN'], cons: ['Não possui portas multigigabit']},
  {id: 'ax1500', titulo: 'Roteador EX1500', preco: 205.90, nota: 4.8, clicks: 0, views: 0,
    pros: ['Possui portas Gigabit LAN e WAN'], cons: ['Banda de 2,4 GHz com taxa nominal de 300 Mbps']},
];
test('móvel e dashboard usam a mesma pontuação e o mesmo preço efetivo', async () => {
  const mobile = await readFile(new URL('../painel-celular.html', import.meta.url), 'utf8');
  const source = ['rankingLimite', 'rankingPontuar', 'rankingPrecoProduto'].map(name => {
    const match = mobile.match(new RegExp('      function ' + name + '\\([^]*?\\n      \\}'));
    assert.ok(match, name);
    return match[0];
  }).join('\n');
  const context = vm.createContext({window: {RDCWeeklyComparisonSafety: safety}, numero: safety.price, rankingLista: value => value});
  vm.runInContext(source, context);
  const a = weekly.weeklyScoreProducts(routers).map(p=>[p.id, p.scoreTotal, p.criterios]);
  const b = context.rankingPontuar(routers).map(p=>[p.id, p.scoreTotal, p.criterios]);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(context.rankingPrecoProduto({preco: 109, precoPromocional: 99.73}), 109);
});
test('notas cadastradas sem fonte não alteram pontuação ou desempate', () => {
  const baseline = weekly.weeklyScoreProducts(routers);
  const changed = weekly.weeklyScoreProducts(routers.map((product, index) => ({...product, nota: index + 1})));
  assert.equal(JSON.stringify(baseline.map(product => [product.id, product.scoreTotal])),
    JSON.stringify(changed.map(product => [product.id, product.scoreTotal])));
  assert.ok(baseline.every(product => product.criterios.avaliacao === 5.5 && !product.avaliacaoVerificada));
  const tied = weekly.weeklyScoreProducts([{...routers[0], id: 'first', nota: 1}, {...routers[0], id: 'second', nota: 5}]);
  assert.equal(tied[0].id, 'first', 'nota não comprovada não pode desempatar');
  assert.equal(baseline.find(product => product.id === 'basic').preco, 99.73);
});
test('destaques não confundem preço com qualidade nem destacam procura com amostra escassa', () => {
  const low = weekly.weeklyHighlights(routers);
  assert.equal(low.length, 1);
  assert.equal(low[0].label, 'Menor preço registrado');
  assert.doesNotMatch(JSON.stringify(low), /melhor|qualidade|custo-benefício|mais procurado/i);
  assert.equal(weekly.weeklyHighlights([{...routers[0], views: 19}, ...routers.slice(1)]).length, 1);
  const enough = weekly.weeklyHighlights([{...routers[0], views: 10}, {...routers[1], views: 10}, routers[2]]);
  assert.match(JSON.stringify(enough), /mais interações nesta seleção/i);
});
test('cartão e motivo declaram índice cadastral, neutralidade e ausência de testes', () => {
  const product = weekly.weeklyScoreProducts(routers)[0];
  const markup = weekly.weeklyRankingCard(product);
  assert.match(markup, /Índice cadastral \(não teste\)/);
  assert.match(markup, /sem fonte: neutra/);
  assert.match(markup, /amostra insuficiente: neutro/);
  assert.match(markup, /Não realizamos testes próprios/);
  assert.doesNotMatch(markup, /4,8|º lugar|Nota comparativa|vencedor/i);
  assert.match(product.motivo, /não testes ou uma classificação de qualidade/);
  assert.equal(safety.selectionTitle('5 melhores roteadores: custo-benefício'), '5 opções de roteadores: preços e perfis');
});
