import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const loader = readFileSync('public-data.js', 'utf8');
const home = readFileSync('index.html', 'utf8');

test('vitrine conserva seleção publicada enquanto a atualização ainda não respondeu', async () => {
  let finish, current, restored = 0;
  const status = new Promise(resolve => { finish = resolve; });
  const published = { price: 'R$ 123,45', cloneNode() { return { ...this }; } };
  const dynamic = { id: 'loading' };
  const context = vm.createContext({
    document: { querySelector: selector => selector === '.static-home' ? published : null, createElement: () => ({}) },
    app: { querySelector: selector => selector === 'main' ? current : selector.includes('.hero-actions') ? {} : null },
    home: async () => { current = dynamic; },
    restaurarSelecaoPublicada: selection => { restored++; current = selection; },
    mercadoLivreStatusPronto: status
  });
  const start = home.indexOf('async function homeComPromocoes(){');
  const stop = home.indexOf('  await mercadoLivreStatusPronto;', start);
  assert.ok(start > 0 && stop > start);
  const pending = vm.runInContext(home.slice(start, stop) + 'await mercadoLivreStatusPronto;} homeComPromocoes();', context);
  await new Promise(setImmediate);
  assert.equal(restored, 1);
  assert.notEqual(current, dynamic);
  assert.equal(current.price, 'R$ 123,45');
  finish(); await pending;
});

test('resposta pública sem fim expira, libera a tentativa e não consulta banco', async () => {
  let calls = 0, deadline;
  const context = vm.createContext({ window: {}, Date, Map, Promise,
    AbortSignal: { timeout(ms) {
      deadline = ms;
      const controller = new AbortController();
      setTimeout(() => controller.abort(Error('simulated-timeout')), 5);
      return controller.signal;
    } },
    fetch: async (_path, options) => {
      if (++calls > 1) return { ok: true, json: async () => ({ products: [] }) };
      return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
    }
  });
  vm.runInContext(loader, context);
  const json = context.window.RDCPublicData.json;
  const first = json('/vitrine-publica.json'), joined = json('/vitrine-publica.json');
  await assert.rejects(first, /simulated-timeout/);
  await assert.rejects(joined, /simulated-timeout/);
  assert.equal(calls, 1); assert.equal(deadline, 12000);
  await json('/vitrine-publica.json'); assert.equal(calls, 2);
  assert.doesNotMatch(loader, /firestore|\.collection\(|localStorage|sessionStorage/);
});

test('seleção temporária só sai quando dados necessários já estão prontos', () => {
  const start = home.indexOf('async function homeComPromocoes(){');
  const body = home.slice(start, home.indexOf('async function home(){', start));
  assert.ok(body.indexOf('const mainDinamico') < body.indexOf('await mercadoLivreStatusPronto;'));
  assert.ok(body.indexOf('selecaoDuranteCarga.replaceWith(mainDinamico)') > body.indexOf('await Promise.all('));
  assert.ok(body.indexOf('selecaoDuranteCarga.replaceWith(mainDinamico)') < body.indexOf('const ancoraRadar'));
  assert.match(body, /!catalogoCarregado && restaurarSelecaoPublicada\(selecaoPublicada\)/);
  assert.match(home, /mercadolivre-status\.json'[^\n]*AbortSignal\.timeout\(12000\)/);
  assert.match(home, /top5-semanal\.json\?[^\n]*AbortSignal\.timeout\(12000\)/);
});
