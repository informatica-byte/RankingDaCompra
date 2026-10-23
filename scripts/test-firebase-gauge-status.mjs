import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const { localGaugeStatus } = createRequire(import.meta.url)('../firebase-consumo.js');
const source = readFileSync(new URL('../firebase-consumo.js', import.meta.url), 'utf8');

test('indicador não confunde ausência, espera, pausa, leitura antiga e leitura recebida', () => {
  assert.equal(localGaugeStatus().state, 'absent');
  assert.equal(localGaugeStatus({ present: true }).state, 'waiting');
  assert.equal(localGaugeStatus({ present: true, paused: true, reading: true }).state, 'paused');
  assert.equal(localGaugeStatus({ present: true, reading: true, stale: true }).state, 'stale');
  assert.deepEqual(localGaugeStatus({ present: true, reading: true }), {
    state: 'active', label: 'Tanque via Tampermonkey ativo — leitura recebida', level: 'ativo'
  });
});

function harness() {
  let auth, mutation, note = null, requests = 0, writes = 0, disconnected = false;
  const now = new Date('2026-10-23T20:47:00Z'), intervals = [], events = {}, elements = new Map();
  for (const id of ['consumo-form', 'consumo-leituras-informadas', 'btn-consumo-salvar', 'consumo-local-status', 'consumo-status', 'consumo-hora', 'consumo-leituras', 'consumo-restante', 'consumo-ponteiro', 'consumo-medidor', 'btn-consumo-automatico']) {
    elements.set(id, { textContent: '', style: {}, attrs: {}, className: '', value: '',
      setAttribute(k,v) { this.attrs[k] = v; }, addEventListener(k,fn) { this[k] = fn; }, focus() {} });
  }
  const container = {};
  const document = { hidden: false, getElementById: id => id === 'rdc-tanque-local' ? note : elements.get(id),
    querySelector: selector => selector === '.painel-consumo' ? container : null, addEventListener(k,fn) { events[k] = fn; } };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now.getTime()])); } static now() { return now.getTime(); } }
  const window = {
    firebase: { auth: () => ({ onAuthStateChanged: fn => { auth = fn; } }) },
    fetch: () => { requests++; throw Error('Não deve haver rede'); },
    localStorage: { getItem: () => JSON.stringify({ day: '2026-10-23', reads: 32000, at: '2026-10-23T20:37:00Z' }), setItem: () => { writes++; } },
    MutationObserver: class { constructor(fn) { mutation = fn; } observe(target, options) {
      assert.equal(target, container); assert.deepEqual(JSON.parse(JSON.stringify(options)), { childList: true, characterData: true, subtree: true });
    } disconnect() { disconnected = true; } },
    setInterval: fn => intervals.push(fn), clearInterval() {}, addEventListener(k,fn) { events[k] = fn; }
  };
  runInNewContext(source, { document, window, Date: Clock, Intl, module: { exports: {} } });
  return { elements, intervals, events, login: () => auth({}), mutation: () => mutation(),
    setNote(message, action = 'Pausar tanque local') { note = { querySelector: selector => ({ textContent: selector === 'button' ? action : message }) }; },
    clearNote() { note = null; }, counters: () => ({ requests, writes, disconnected }) };
}

test('observador do DOM atualiza apenas o indicador e mantém o campo manual, sem requisições', () => {
  const h = harness(); h.login();
  const badge = h.elements.get('consumo-local-status');
  assert.equal(badge.attrs['data-state'], 'absent');
  h.setNote('Aguardando leitura válida do período atual da cota no console do Firebase.'); h.mutation();
  assert.equal(badge.attrs['data-state'], 'waiting');
  h.setNote('Total arredondado pelo Google. Tela lida em 23/10/2026, 17:47. Dia da cota no Pacífico: 2026-10-23. Isto não é o horário de atualização do Google.'); h.mutation();
  assert.equal(badge.attrs['data-state'], 'active'); assert.match(badge.className, /ativo/);
  // Só o userscript pode atualizar o ponteiro a partir do seu agregado privado.
  assert.equal(h.elements.get('consumo-leituras-informadas').value, '32000');
  assert.equal(h.elements.get('consumo-leituras').textContent, '32.000 / 50.000 leituras');
  h.mutation(); h.intervals[0]();
  assert.deepEqual(h.counters(), { requests: 0, writes: 0, disconnected: false });
  h.events.beforeunload(); assert.equal(h.counters().disconnected, true);
});

test('pausa, outro dia e leitura antiga nunca viram um indicador verde de leitura atual', () => {
  const h = harness(); h.login(); const badge = h.elements.get('consumo-local-status');
  h.setNote('Tanque local pausado.', 'Retomar tanque local'); h.mutation(); assert.equal(badge.attrs['data-state'], 'paused');
  h.setNote('Tela lida em 22/10/2026, 17:47. Dia da cota no Pacífico: 2026-10-22.'); h.mutation(); assert.equal(badge.attrs['data-state'], 'waiting');
  h.setNote('Leitura antiga — confira/atualize o console pessoalmente. Tela lida em 23/10/2026, 16:00. Dia da cota no Pacífico: 2026-10-23.'); h.mutation();
  assert.equal(badge.attrs['data-state'], 'stale'); assert.doesNotMatch(badge.className, /ativo/);
  h.clearNote(); h.mutation(); assert.equal(badge.attrs['data-state'], 'absent');
  assert.deepEqual(h.counters(), { requests: 0, writes: 0, disconnected: false });
});

test('HTML remove o aviso ambíguo, separa nuvem desligada e preserva controle antigo desativado', () => {
  const html = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /Automático não ativado|Não há atualização automática em execução/);
  assert.match(html, /id="consumo-local-status"/);
  assert.match(html, /id="consumo-nuvem-status"[^>]*>Modo em nuvem desligado/);
  assert.match(html, /id="btn-consumo-automatico" disabled hidden/);
  assert.match(html, /<details class="consumo-manual"><summary>Registro manual \(opcional\)<\/summary>\s*<form id="consumo-form"/);
  assert.match(html, /firebase-consumo\.js\?v=20261023-local-status1/);
  assert.match(source, /const AUTOMATIC_ENABLED = false;/);
});
