import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { quotaStart, metricRequest, publicUsage, collectUsage, METRIC } from './firebase-usage-metrics.mjs';
import { publishUsage, validateUsage, ROOT, BRANCH } from './publish-firebase-usage.mjs';
const { automaticSnapshot } = createRequire(import.meta.url)('../firebase-consumo.js');
const now = new Date('2026-10-23T18:00:00Z');
const payload = { timeSeries: [{ metric: { type: METRIC }, metricKind: 'DELTA', valueType: 'INT64', points: [
  { interval: { startTime: '2026-10-23T07:00:00Z', endTime: '2026-10-23T07:01:00Z' }, value: { int64Value: '123' } },
  { interval: { startTime: '2026-10-23T17:55:00Z', endTime: '2026-10-23T17:56:00Z' }, value: { int64Value: '456' } }
] }] };
test('dia da cota respeita o Pacífico inclusive dias de mudança de horário', () => {
  for (const [at, start] of [
    ['2026-10-23T18:00:00Z','2026-10-23T07:00:00.000Z'],
    ['2026-11-01T20:00:00Z','2026-11-01T07:00:00.000Z'],
    ['2026-03-08T20:00:00Z','2026-03-08T08:00:00.000Z'],
    ['2026-10-23T06:59:00Z','2026-10-22T07:00:00.000Z']
  ]) assert.equal(quotaStart(new Date(at)).toISOString(), start);
});
test('uma consulta agrega somente leituras do banco padrão, sem consultar documentos', () => {
  const request = metricRequest(now);
  assert.equal(request.origin, 'https://monitoring.googleapis.com');
  assert.match(request.searchParams.get('filter'), /database_id="\(default\)"/);
  assert.equal(request.searchParams.get('aggregation.crossSeriesReducer'), 'REDUCE_SUM');
  assert.equal(request.searchParams.get('interval.startTime'), '2026-10-23T07:00:00.000Z');
  assert.equal(request.searchParams.get('pageSize'), '2000');
});
test('saída pública soma pontos DELTA uma vez e contém apenas total e horário coberto', () => {
  assert.deepEqual(publicUsage(payload, now), { reads: 579, at: '2026-10-23T17:56:00.000Z' });
  for (const bad of [{}, { timeSeries: [] }, { ...payload, nextPageToken: 'another' }, { timeSeries: [...payload.timeSeries, ...payload.timeSeries] }])
    assert.throws(() => publicUsage(bad, now));
  const old = structuredClone(payload); old.timeSeries[0].points[0].interval.startTime = '2026-10-22T07:00:00Z';
  assert.throws(() => publicUsage(old, now));
  const repeated = structuredClone(payload); repeated.timeSeries[0].points.push(repeated.timeSeries[0].points[0]);
  assert.throws(() => publicUsage(repeated, now));
});
test('falha de autenticação/cobrança é terminal, sem repetir nem publicar zero ou corpo remoto', async () => {
  let calls = 0;
  for (const status of [401,403,429,503]) {
    await assert.rejects(collectUsage({ token: 'PRIVATE', now, request: async (url, options) => {
      calls++; assert.equal(options.headers.authorization, 'Bearer PRIVATE'); assert.equal(options.redirect, 'error');
      return Response.json({ error: { message: 'PRIVATE-BODY' } }, { status });
    } }), error => error.message.includes('HTTP ' + status) && !error.message.includes('PRIVATE'));
  }
  assert.equal(calls, 4);
});
test('medidor rejeita outro dia/futuro/campo extra e sinaliza atraso sem transformar desconhecido em zero', () => {
  const good = { reads: 42000, at: '2026-10-23T17:56:00Z' };
  assert.equal(automaticSnapshot(good, now).stale, false);
  assert.equal(automaticSnapshot({ ...good, at: '2026-10-23T16:00:00Z' }, now).stale, true);
  assert.equal(automaticSnapshot({ ...good, token: 'PRIVATE' }, now), null);
  assert.equal(automaticSnapshot({ ...good, at: '2026-10-22T17:56:00Z' }, now), null);
  assert.equal(automaticSnapshot({ ...good, at: '2026-10-23T18:01:00Z' }, now), null);
  assert.equal(automaticSnapshot(null, now), null);
});
test('publicador tem allowlist de dois campos e grava somente a branch exclusiva', async () => {
  const data = { reads: 579, at: '2026-10-23T17:56:00.000Z' }, operations = [];
  for (const extra of ['token','products','projectId','email']) assert.throws(() => validateUsage({ ...data, [extra]: 'private' }));
  await publishUsage({ data, token: 'PRIVATE', request: async (url, options) => {
    assert.ok(url.startsWith(ROOT)); operations.push([url, options]);
    if (options.method === 'GET') return Response.json({}, { status: 404 });
    if (url.endsWith('/git/refs')) return Response.json({});
    return Response.json({ sha: 'sha' });
  } });
  assert.equal(operations.length, 5);
  const tree = JSON.parse(operations.find(([url]) => url.endsWith('/git/trees'))[1].body);
  assert.equal(tree.tree.length, 1); assert.equal(tree.tree[0].path, 'firebase-consumo.json');
  const creation = JSON.parse(operations.at(-1)[1].body);
  assert.equal(creation.ref, 'refs/heads/' + BRANCH);
  for (const [, options] of operations) assert.doesNotMatch(options.body || '', /PRIVATE/);
});
test('workflow não lê Firestore, não muda IAM/cobrança e não cria chave ou artefato de credenciais', () => {
  const workflow = readFileSync('.github/workflows/firebase-consumo.yml','utf8');
  assert.doesNotMatch(workflow, /^  schedule:|^\s+-\s+cron:/m); assert.match(workflow, /auth\/monitoring\.read/);
  assert.match(workflow, /create_credentials_file: false/); assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /generate-sitemap|firestore-read-auth|credentials_json|upload-artifact|gcloud services enable|billing/);
  const gauge = readFileSync('firebase-consumo.js','utf8');
  assert.doesNotMatch(gauge, /monitoring\.googleapis|Authorization|requestAccessToken|firebase\.firestore|db\.collection/);
  assert.match(gauge, /credentials: 'omit'/);
});

test('renderização automática usa só arquivo público e apaga saldo antigo na virada da cota', async () => {
  let clock = now.getTime(), auth;
  const elements = new Map(), intervals = [], writes = [], calls = [];
  const document = { hidden: false, addEventListener() {}, getElementById(id) {
    if (!elements.has(id)) elements.set(id, { style: {}, attrs: {}, value: '', textContent: '',
      setAttribute(key, value) { this.attrs[key] = value; }, addEventListener() {}, focus() {} });
    return elements.get(id);
  } };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const window = { firebase: { auth: () => ({ onAuthStateChanged: callback => { auth = callback; } }) },
    fetch: async (url, options) => { calls.push([url, options]); return Response.json({ reads: 42000, at: '2026-10-23T17:56:00Z' }); },
    AbortSignal, setInterval: callback => intervals.push(callback), clearInterval() {}, addEventListener() {},
    localStorage: { getItem: () => '', setItem: (...args) => writes.push(args) } };
  const readySource = readFileSync('firebase-consumo.js','utf8').replace('const AUTOMATIC_ENABLED = false;', 'const AUTOMATIC_ENABLED = true;');
  runInNewContext(readySource, { window, document, Date: Clock, Intl, module: { exports: {} } });
  auth({ uid: 'owner' }); await new Promise(done => setImmediate(done));
  assert.equal(calls.length, 1); assert.equal(calls[0][1].credentials, 'omit');
  assert.equal(elements.get('consumo-leituras').textContent, '42.000 / 50.000 leituras');
  assert.match(elements.get('consumo-status').textContent, /automática/); assert.equal(writes.length, 0);
  clock = Date.parse('2026-10-24T07:30:00Z'); intervals[0](); await new Promise(done => setImmediate(done));
  assert.equal(elements.get('consumo-restante').textContent, '—');
  auth(null); assert.equal(elements.get('consumo-restante').textContent, '—');
});

test('exigência de cobrança recebe sinal terminal explícito, sem expor mensagem remota', async () => {
  await assert.rejects(collectUsage({ token: 'PRIVATE', now, request: async () => Response.json({ error: {
    message: 'private billing message', details: [{ reason: 'BILLING_DISABLED' }]
  } }, { status: 403 }) }), error => error.message.includes('BILLING_REQUIRED') && !error.message.includes('private'));
});

test('configuração publicada permanece desativada após o bloqueio de faturamento', () => {
  assert.match(readFileSync('firebase-consumo.js','utf8'), /const AUTOMATIC_ENABLED = false;/);
  assert.match(readFileSync('dashboard.html','utf8'), /id="btn-consumo-automatico" disabled/);
  assert.doesNotMatch(readFileSync('.github/workflows/firebase-consumo.yml','utf8'), /^  schedule:/m);
});
