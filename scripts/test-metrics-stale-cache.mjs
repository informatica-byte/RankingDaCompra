import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../metricas-resumo.js', import.meta.url), 'utf8');
const now = Date.parse('2026-10-14T15:00:00Z');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
const context = vm.createContext({ Date: Clock });
vm.runInContext(source, context);
const metrics = context.RankingMetricasResumo;
function render(snapshot) {
  const fields = new Map(['visitas14', 'visitas7', 'visitasHoje', 'cliques7', 'cliquesHoje', 'taxa'].map(key =>
    [key, { dataset: { metrica: key }, textContent: '', title: '' }]));
  const status = { textContent: '' };
  metrics.exibir(snapshot, { querySelectorAll: selector => selector === '[data-metrica]' ? [...fields.values()] : [status] });
  return { fields, status };
}
const cache = {
  versao: metrics.VERSION, inicio: '2026-10-01', ultimoDia: '2026-10-12', atualizadoEm: Date.parse('2026-10-12T17:48:00Z'),
  registros: [
    { dia: '2026-10-12', tipo: 'visita', quantidade: 5 },
    { dia: '2026-10-12', tipo: 'clique_oferta', produtoId: 'p', quantidade: 4 },
  ],
};

test('old-day cache reports unknown today while preserving dated historical totals in both panels', () => {
  const snapshot = metrics.instantaneo(cache, true), result = render(snapshot);
  assert.equal(snapshot.ultimoDia, '2026-10-12');
  assert.equal(result.fields.get('visitasHoje').textContent, '—');
  assert.equal(result.fields.get('cliquesHoje').textContent, '—');
  assert.equal(result.fields.get('visitas14').textContent, '5');
  assert.equal(result.fields.get('visitas7').textContent, '5');
  assert.equal(result.fields.get('cliques7').textContent, '4');
  assert.match(result.fields.get('visitas7').title, /2026-10-12/);
  assert.match(result.status.textContent, /base desatualizada/);
  assert.match(result.status.textContent, /12\/10\/2026/);
  assert.match(result.status.textContent, /7\/14 dias podem estar incompletas/);
});

test('coverage uses ultimoDia, not the cache write time; explicitly queried empty today is a real zero', () => {
  const copied = render(metrics.instantaneo({ ...cache, atualizadoEm: now }, true));
  assert.equal(copied.fields.get('visitasHoje').textContent, '—');
  const current = render(metrics.instantaneo({ ...cache, ultimoDia: '2026-10-14' }, true));
  assert.equal(current.fields.get('visitasHoje').textContent, '0');
  assert.equal(current.fields.get('cliquesHoje').textContent, '0');
  assert.equal(current.fields.get('visitas7').title, '');
  assert.doesNotMatch(current.status.textContent, /base desatualizada|incompletas/);
});

test('rendering old local cache neither queries, polls nor changes the cache; refresh remains explicit', () => {
  let queries = 0, writes = 0;
  const saved = JSON.stringify(cache);
  const reader = metrics.criarLeitor({
    armazenamento: { getItem: () => saved, setItem() { writes++; } },
    lerDocumentos() { queries++; throw Error('no automatic reads'); },
    diaAtual: () => '2026-10-14', agora: () => now,
  });
  const fromCache = reader.cache();
  render(metrics.instantaneo(fromCache, true));
  assert.equal(queries, 0);
  assert.equal(writes, 0);
  assert.equal(JSON.stringify(fromCache), saved);
});
