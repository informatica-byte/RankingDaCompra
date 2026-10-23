import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../tanque-firebase-local.user.js', import.meta.url), 'utf8');
const h = require('../tanque-firebase-local.user.js');
const now = new Date('2026-10-23T20:00:00Z');
const href = 'https://console.firebase.google.com/u/1/project/rankingdacompra/firestore/databases/-default-/usage/last-24h';
const good = { reads: 43000, rounded: true, day: '2026-10-23', at: now.toISOString() };

function fixture({ type = 'console', label = 'Current quota period', range = 'out. 23 - out. 24 (GMT-7)', reads = '43\u00a0mil' } = {}) {
  const ids = new Map(), selectors = new Map(), queryLog = [];
  const doc = {
    documentElement: { lang: 'pt-BR' },
    defaultView: { getComputedStyle: element => ({ display: element.hidden ? 'none' : 'block', visibility: 'visible' }) },
    getElementById: id => ids.get(id) || null,
    querySelector: selector => { queryLog.push(selector); return selectors.get(selector) || null; },
    querySelectorAll: selector => { queryLog.push(selector); const v = selectors.get(selector); return Array.isArray(v) ? v : v ? [v] : []; },
    createElement: tag => element(tag)
  };
  function element(tag = 'div', value = '') {
    return { tagName: tag.toUpperCase(), ownerDocument: doc, textContent: value, style: {}, hidden: false, disabled: false,
      children: [], attrs: {}, listeners: {}, isConnected: true, value: '',
      append(...items) { this.children.push(...items); }, prepend(item) { this.children.unshift(item); },
      setAttribute(key, v) { this.attrs[key] = v; }, removeAttribute(key) { delete this.attrs[key]; },
      getClientRects() { return this.hidden ? [] : [{}]; },
      addEventListener(key, callback) { this.listeners[key] = callback; },
      querySelector() { return null; }, querySelectorAll() { return []; },
      requestSubmit() { throw Error('O script não deve enviar formulários'); }
    };
  }
  const host = element('section');
  const picker = element('fire-date-range-picker-button');
  const selected = element('selected-value', label), selectedRange = element('selected-range', range);
  picker.querySelector = selector => selector === 'selected-value' ? selected : selector === 'selected-range' ? selectedRange : null;
  selectors.set('fire-date-range-picker-button', [picker]);
  const metric = element(), metricLabel = element('div', 'Leituras');
  const number = element('div', reads), total = element('div', 'total'), card = element('mat-card');
  metric.querySelector = selector => selector === '.metric-label' ? metricLabel : null;
  metric.querySelectorAll = selector => selector === '.metric-value' ? [number] : selector === '.metric-aggregation-label' ? [total] : [];
  metric.closest = selector => selector === 'mat-card' ? card : null;
  selectors.set('fire-c13g-multi-time-series-selector .metric-toggle', [metric]);
  selectors.set('main,[role="main"]', host);
  selectors.set('.painel-consumo', host);
  selectors.set('.painel-consumo .consumo-subtitulo', element('p', 'Modo manual'));
  for (const id of ['app', 'admin-content', 'btn-consumo-salvar', 'consumo-status', 'consumo-hora', 'consumo-leituras', 'consumo-restante', 'consumo-ponteiro', 'consumo-medidor', 'consumo-leituras-informadas']) ids.set(id, element());
  ids.get('consumo-leituras-informadas').value = '123';
  return { doc, ids, host, picker, selected, selectedRange, metric, metricLabel, number, total, card, selectors, queryLog,
    href: type === 'console' ? href : `https://rankingdacompra.com.br/${type === 'mobile' ? 'painel-celular' : 'dashboard'}.html` };
}

test('escopo exato rejeita outros projetos, bancos, páginas e domínios', () => {
  assert.equal(h.route(href), 'console');
  assert.equal(h.route(href.replace('/u/1', '')), 'console');
  assert.equal(h.route('https://rankingdacompra.com.br/dashboard.html?foo=1#abc'), 'dashboard');
  assert.equal(h.route('https://rankingdacompra.com.br/painel-celular.html#precos-mobile'), 'mobile');
  for (const bad of [href.replace('rankingdacompra', 'outro'), href.replace('-default-', 'outro'), href.replace('/usage/last-24h', '/data'), 'http://rankingdacompra.com.br/dashboard.html', 'https://rankingdacompra.com.br.evil.invalid/dashboard.html', 'https://rankingdacompra.com.br/dashboard.html.old']) assert.equal(h.route(bad), '');
});

test('regressão 1.0.1 reconhece /reads sem ampliar projeto, banco ou subrotas', () => {
  for (const url of [href + '/reads', href + '/reads/', href.replace('/u/1', '') + '/reads', href + '/reads?hl=pt-BR#main']) assert.equal(h.route(url), 'console');
  for (const url of [href + '/writes', href + '/reads/data', href.replace('-default-', 'outro') + '/reads', href.replace('rankingdacompra', 'outro') + '/reads']) assert.equal(h.route(url), '');
  assert.match(source, /^\/\/ @version\s+1\.0\.1\r?$/m);
  assert.match(source, /^\/\/ @namespace\s+rankingdacompra\.tanque-local\r?$/m);
});

test('converte número exibido sem esconder o arredondamento e sem inventar zero', () => {
  for (const [raw, count, rounded] of [['43 mil', 43000, true], ['43,1 mil', 43100, true], ['43,117k', 43117, true], ['1,5 mi', 1500000, true], ['43.117', 43117, false], ['0', 0, false], ['627', 627, false]]) assert.deepEqual(h.counter(raw), { reads: count, rounded });
  assert.deepEqual(h.counter('1,234', 'en'), { reads: 1234, rounded: false });
  assert.deepEqual(h.counter('43.1k', 'en'), { reads: 43100, rounded: true });
  assert.equal(h.counter('1,234k', 'en'), null);
  assert.equal(h.counter('1.234 mil', 'pt'), null);
  for (const bad of ['', '—', '-', 'Sem dados', '43 mil total', '-1', '1,5', '1.2.3k', '0,0001k', '9007199254740992', '<script>']) assert.equal(h.counter(bad), null);
});

test('exige período atual real e rejeita uma tela de ontem à meia-noite', () => {
  assert.equal(h.correctRange('Current quota period', 'out. 23 - out. 24 (GMT-7)', now), true);
  assert.equal(h.correctRange('Período atual da cota', 'Oct 23 – Oct 24 (GMT-7)', now), true);
  for (const [label, range] of [['Last 24 hours','out. 23 - out. 24 (GMT-7)'], ['Current quota period','out. 22 - out. 23 (GMT-7)'], ['Current quota period','out. 23 - out. 24 (GMT-3)'], ['Current quota period','']]) assert.equal(h.correctRange(label, range, now), false);
  assert.equal(h.correctRange('Current quota period','out. 23 - out. 24 (GMT-7)',new Date('2026-10-24T07:01:00Z')), false);
  assert.equal(h.correctRange('Current quota period','dez. 31 - jan. 1 (GMT-8)',new Date('2027-01-01T06:00:00Z')), true);
  assert.equal(h.quotaDay('2026-10-23T06:59:00Z'), '2026-10-22');
  assert.equal(h.quotaDay('2026-11-01T08:30:00Z'), '2026-11-01');
});

test('fixture do DOM observado no console lê SOMENTE a métrica Leituras e seu período', () => {
  const f = fixture();
  assert.deepEqual(h.readScreen(f.doc, href, now), { day: '2026-10-23', reads: 43000, rounded: true });
  assert.deepEqual(f.queryLog, ['fire-date-range-picker-button', 'fire-c13g-multi-time-series-selector .metric-toggle']);
  f.metricLabel.textContent = 'Gravações'; assert.equal(h.readScreen(f.doc, href, now), null);
});

test('tela ambígua, oculta, carregando ou com formato desconhecido não publica nada', () => {
  const mutations = [f => f.picker.hidden = true, f => f.selected.textContent = 'Last 24 hours', f => f.number.textContent = 'Sem dados', f => f.total.textContent = 'valor selecionado', f => f.selectors.set('fire-date-range-picker-button', [f.picker, f.picker]), f => f.selectors.set('fire-c13g-multi-time-series-selector .metric-toggle', [f.metric, f.metric]), f => f.card.querySelectorAll = () => [f.number]];
  for (const change of mutations) { const f = fixture(); change(f); assert.equal(h.readScreen(f.doc, href, now), null); }
});

test('/reads ainda exige período seguro e recusa dados desconhecidos em vez de publicar zero', () => {
  const f = fixture({ reads: '49 mil' });
  assert.deepEqual(h.readScreen(f.doc, href + '/reads', now), { day: '2026-10-23', reads: 49000, rounded: true });
  f.selected.textContent = 'Last 24 hours'; assert.equal(h.readScreen(f.doc, href + '/reads', now), null);
  f.selected.textContent = 'Current quota period'; f.number.textContent = 'Sem dados'; assert.equal(h.readScreen(f.doc, href + '/reads', now), null);
});

test('allowlist impede guardar campos extras, datas futuras, outro dia ou valores inválidos', () => {
  assert.deepEqual(h.snapshot(good, now), good);
  for (const bad of [null, {}, { ...good, token: 'NO' }, { ...good, day: '2026-10-22' }, { ...good, reads: -1 }, { ...good, reads: 0.5 }, { ...good, reads: '43000' }, { ...good, rounded: 'yes' }, { ...good, at: '2026-10-23T21:00:00Z' }, { ...good, at: '2026-10-22T20:00:00Z' }]) assert.equal(h.snapshot(bad, now), null);
});

test('varreduras iguais não renovam o horário e leituras menores não sobrescrevem total', () => {
  const later = new Date('2026-10-23T21:00:00Z');
  const reading = { reads: 43000, rounded: true, day: '2026-10-23' };
  assert.deepEqual(h.nextSnapshot(good, reading, later), good);
  assert.equal(h.nextSnapshot(good, { ...reading, reads: 42000 }, later), null);
  assert.equal(h.nextSnapshot(good, null, later), null);
  assert.equal(h.nextSnapshot(good, reading, later, true).at, later.toISOString());
  assert.equal(h.model(good, later).stale, true);
  assert.equal(h.model(good, new Date('2026-10-24T07:01:00Z')), null);
  assert.equal(h.model({ ...good, reads: 51000 }, now).remaining, 0);
});

function runtime(f, bus, clock) {
  const timers = [], events = [];
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock.at])); } static now() { return clock.at; } }
  const context = { document: f.doc, location: { href: f.href }, URL, Intl, Date: Clock,
    GM_getValue: (key, fallback) => bus.values.has(key) ? structuredClone(bus.values.get(key)) : fallback,
    GM_setValue: (key, value) => { const previous = bus.values.get(key); bus.values.set(key, structuredClone(value)); bus.writes.push([key, structuredClone(value)]); for (const listener of bus.listeners.get(key) || []) listener(key, previous, structuredClone(value), true); },
    GM_addValueChangeListener: (key, callback) => bus.listeners.set(key, [...(bus.listeners.get(key) || []), callback]),
    setInterval: callback => { timers.push(callback); return timers.length; }, clearInterval() {}, addEventListener: (...args) => events.push(args),
    fetch() { throw Error('Rede proibida'); }, XMLHttpRequest() { throw Error('Rede proibida'); }
  };
  runInNewContext(source, context);
  return { timers, events };
}

test('integração simulada transmite agregado entre abas e atualiza tanque sem submeter formulário', () => {
  const bus = { values: new Map(), writes: [], listeners: new Map() }, clock = { at: now.getTime() };
  const dashboard = fixture({ type: 'dashboard' }), mobile = fixture({ type: 'mobile' }), consoleView = fixture();
  const dash = runtime(dashboard, bus, clock); runtime(mobile, bus, clock); const reader = runtime(consoleView, bus, clock);
  assert.equal(bus.writes.length, 1);
  assert.deepEqual(Object.keys(bus.writes[0][1]).sort(), ['at','day','reads','rounded']);
  assert.equal(dashboard.ids.get('consumo-leituras').textContent, '≈ 43.000 / 50.000 leituras');
  assert.equal(dashboard.ids.get('consumo-restante').textContent, '≈ 7.000');
  assert.equal(dashboard.ids.get('consumo-leituras-informadas').value, '123');
  assert.match(mobile.ids.get('app').children[0].children.find(e => /leituras;/.test(e.textContent))?.textContent, /43.000/);
  clock.at += 15000; reader.timers[0](); assert.equal(bus.writes.length, 1);
  consoleView.number.textContent = '44 mil'; reader.timers[0]();
  assert.equal(bus.writes.length, 2);
  assert.equal(dashboard.ids.get('consumo-restante').textContent, '≈ 6.000');
  clock.at += 46 * 60 * 1000; dash.timers[0]();
  assert.match(dashboard.ids.get('consumo-status').textContent, /antiga/);
  clock.at = Date.parse('2026-10-24T07:01:00Z'); reader.timers[0](); dash.timers[0]();
  assert.equal(bus.writes.length, 2); assert.equal(dashboard.ids.get('consumo-restante').textContent, '—');
});

test('pausa interrompe captura sem afetar login, preços ou formularios; painel sem login não recebe total', () => {
  const bus = { values: new Map(), writes: [], listeners: new Map() }, clock = { at: now.getTime() };
  const consoleView = fixture(), dashboard = fixture({ type: 'dashboard' });
  dashboard.ids.get('admin-content').hidden = true;
  const dash = runtime(dashboard, bus, clock); const reader = runtime(consoleView, bus, clock);
  assert.equal(dashboard.ids.get('consumo-leituras').textContent, '');
  const pauseButton = consoleView.host.children[0].children.find(e => e.tagName === 'BUTTON');
  pauseButton.listeners.click();
  const n = bus.writes.length; consoleView.number.textContent = '45 mil'; reader.timers[0]();
  assert.equal(bus.writes.length, n);
  assert.equal(bus.values.get('rdc-tanque-local-leitura-v1').reads, 43000);
  pauseButton.listeners.click(); dashboard.ids.get('admin-content').hidden = false; dash.timers[0]();
  assert.equal(dashboard.ids.get('consumo-leituras').textContent, '≈ 45.000 / 50.000 leituras');
});

test('inicialização direta em /reads envia o total ao painel, preservando o registro manual e o formulário', () => {
  const bus = { values: new Map(), writes: [], listeners: new Map() }, clock = { at: now.getTime() };
  const dashboard = fixture({ type: 'dashboard' }), consoleView = fixture({ reads: '49 mil' });
  consoleView.href = href.replace('/u/1', '') + '/reads';
  dashboard.ids.get('consumo-leituras').textContent = '32.000 / 50.000 leituras';
  runtime(dashboard, bus, clock); runtime(consoleView, bus, clock);
  assert.equal(bus.writes.length, 1);
  assert.equal(dashboard.ids.get('consumo-leituras').textContent, '≈ 49.000 / 50.000 leituras');
  assert.equal(dashboard.ids.get('consumo-restante').textContent, '≈ 1.000');
  assert.equal(dashboard.ids.get('consumo-leituras-informadas').value, '123');
  assert.deepEqual(Object.keys(bus.writes[0][1]).sort(), ['at','day','reads','rounded']);
});

test('sem período seguro o runtime não grava nem publica um total padrão', () => {
  const bus = { values: new Map(), writes: [], listeners: new Map() }, clock = { at: now.getTime() };
  const f = fixture({ label: 'Last 24 hours', reads: '66 mil' });
  runtime(f, bus, clock);
  assert.equal(bus.writes.length, 0);
  assert.match(f.host.children[0].children[1].textContent, /Sem leitura segura/);
});

test('uma leitura manual explícita renova somente a hora de observação e não consulta a rede', () => {
  const bus = { values: new Map(), writes: [], listeners: new Map() }, clock = { at: now.getTime() };
  const f = fixture(); runtime(f, bus, clock);
  clock.at += 3600000;
  const button = f.host.children[0].children.find(e => /^Ler esta tela/.test(e.textContent));
  button.listeners.click();
  assert.equal(bus.writes.length, 2);
  assert.equal(bus.writes[1][1].at, new Date(clock.at).toISOString());
  assert.equal(bus.writes[1][1].reads, 43000);
});

test('metadados e fonte não contêm chamadas de rede, credenciais, acesso ao site storage ou submissão', () => {
  assert.deepEqual([...source.matchAll(/^\/\/ @grant\s+(\S+)/gm)].map(m => m[1]).sort(), ['GM_addValueChangeListener','GM_getValue','GM_setValue']);
  for (const forbidden of [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bGM_xmlhttpRequest\b/, /\bWebSocket\b/, /\bsendBeacon\b/, /\bunsafeWindow\b/, /document\.cookie/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bindexedDB\b/, /\bAuthorization\b/, /firebase\.(auth|firestore)/, /\.submit\s*\(/, /requestSubmit\s*\(/, /location\.(reload|assign|replace)\s*\(/, /\.click\s*\(/, /@require\s+/, /@connect\s+/, /innerHTML\s*=/, /bot-precos\.user\.js/]) assert.doesNotMatch(source, forbidden);
  assert.match(source, /@updateURL\s+none/); assert.match(source, /@noframes/);
});

test('página de instalação é estática e não instala ou executa nada sem ação do usuário', () => {
  const html = readFileSync(new URL('../instalar-tanque-firebase.html', import.meta.url), 'utf8');
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.match(html, /class="install" href="\/tanque-firebase-local\.user\.js"/);
  assert.match(html, /não recarregue essa aba/);
  assert.doesNotMatch(html, /<script\b|<iframe\b|<form\b|\bonclick\s*=|http-equiv="refresh"/i);
  const workflow = readFileSync(new URL('../.github/workflows/update-sitemap.yml', import.meta.url), 'utf8');
  const selectivePaths = workflow.split('  schedule:')[0];
  assert.doesNotMatch(selectivePaths, /tanque-firebase-local|instalar-tanque-firebase/);
  const gauge = readFileSync(new URL('../firebase-consumo.js', import.meta.url), 'utf8');
  assert.match(gauge, /const AUTOMATIC_ENABLED = false;/);
});
