import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { pendingRequests, resolutionSummary, queueQuotaRetry, queueQuotaFailure } from './localizer-queue.mjs';
import { LocalizerError, recordPageChallenge, recordNetworkFailure, resolveQueuedRequests, diagnosticTable } from './localizer-diagnostics.mjs';

const source = await readFile(new URL('./resolve-affiliate-links.mjs', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('function decode('), source.indexOf('function fitText('))
  + source.slice(source.indexOf('function candidates('), source.indexOf('function imageProbeOptions('));
const resolveSource = source.slice(source.indexOf('async function resolveRequest(request)'), source.indexOf('let payload ='));

function resolver(html) {
  const consulted = [];
  const resolve = runInNewContext(helpers + resolveSource + '\nresolveRequest;', {
    URL, LocalizerError, recordPageChallenge, recordNetworkFailure,
    dump: async () => html,
    officialDetails: async (id) => {
      consulted.push(id);
      return { titulo: 'Produto solicitado', precoAtual: 32.15, foto: 'https://http2.mlstatic.com/foto.webp' };
    },
    selectLoadableMarketplaceImage: async () => 'https://http2.mlstatic.com/foto.webp', imageProbeOptions: () => ({}),
  });
  return { resolve, consulted };
}

test('MLB explícito do anúncio vence recomendações, inclusive quando não existe link correspondente no HTML', async () => {
  const link = 'https://produto.mercadolivre.com.br/MLB-4359093019-tenis-_JM';
  const recommendation = '<a href="https://produto.mercadolivre.com.br/MLB-6677877666-outro-_JM">Recomendação</a>';
  for (const html of [recommendation, recommendation + `<a href="${link}">Tênis solicitado</a>`]) {
    const { resolve, consulted } = resolver(html);
    const result = await resolve({ link });
    assert.deepEqual(consulted, ['MLB4359093019']);
    assert.equal(result.mlb, 'MLB4359093019');
    assert.equal(result.urlProduto, link);
    assert.equal(result.linkOriginal, link);
  }
});

test('vendedor explicitado na query ou fragmento vence catálogo e links recomendados', async () => {
  const html = '<a href="https://produto.mercadolivre.com.br/MLB-6677877666-outro-_JM">Recomendação</a>';
  const catalog = 'https://www.mercadolivre.com.br/tenis/p/MLB12345678';
  for (const link of [catalog + '?wid=MLB4359093019', catalog + '#wid=MLB4359093019', catalog + '?pdp_filters=item_id%3AMLB4359093019']) {
    const { resolve, consulted } = resolver(html);
    const result = await resolve({ link });
    assert.deepEqual(consulted, ['MLB4359093019']);
    assert.equal(result.mlb, 'MLB4359093019');
    assert.equal(result.urlProduto, link);
  }
});

test('catálogo explícito não é substituído pelo primeiro anúncio relacionado', async () => {
  const link = 'https://www.mercadolivre.com.br/tenis/p/MLB12345678';
  const { resolve, consulted } = resolver('<a href="https://produto.mercadolivre.com.br/MLB-6677877666-outro-_JM">Recomendação</a>');
  assert.equal((await resolve({ link })).mlb, 'MLB12345678');
  assert.deepEqual(consulted, ['MLB12345678']);
});

test('link curto com vários produtos não escolhe o primeiro arbitrariamente', async () => {
  const html = '<a href="https://produto.mercadolivre.com.br/MLB-6677877666-outro-_JM">Um</a>'
    + '<a href="https://produto.mercadolivre.com.br/MLB-4359093019-tenis-_JM">Outro</a>';
  const { resolve, consulted } = resolver(html);
  await assert.rejects(resolve({ link: 'https://meli.la/link-curto' }), error => error.name === 'LocalizerError');
  assert.equal(consulted.length, 0);
});

test('links repetidos do mesmo anúncio não criam ambiguidade artificial', async () => {
  const html = '<a href="https://produto.mercadolivre.com.br/MLB-4359093019-tenis-_JM">Nome</a>'
    + '<a href="https://produto.mercadolivre.com.br/MLB-4359093019-tenis-_JM?utm_source=mail">Comprar</a>';
  const { resolve, consulted } = resolver(html);
  assert.equal((await resolve({ link: 'https://meli.la/link-curto' })).mlb, 'MLB4359093019');
  assert.deepEqual(consulted, ['MLB4359093019']);
});

async function runQueue({ headSucceeded = true, olderSucceeded = true, recentPending = false, readFailure, failProduct = false } = {}) {
  const priorCursor = [{ timestampValue: '2026-10-11T12:00:00Z' }, { referenceValue: 'projects/test/documents/mlbSolicitacoes/old' }];
  const payload = { resultados: { preserved: { status: 'ok', precoAtual: 99, resolvidoEm: '2026-10-10T12:00:00Z' } }, queueState: { cursor: priorCursor } };
  if (readFailure) payload.queueState.readFailure = readFailure;
  const output = new Map();
  const calls = [];
  const tail = source.slice(source.indexOf('const priorQueueState ='));
  await runInNewContext(`(async () => { ${tail} })();`, {
    payload, OUTPUT: 'memory-results.json', MAX_REQUEST_ATTEMPTS: 3,
    pendingRequests, resolutionSummary, resolveQueuedRequests, diagnosticTable, queueQuotaRetry, queueQuotaFailure,
    requests: async cursor => {
      calls.push(cursor);
      return calls.length === 1
        ? { readSucceeded: headSucceeded, http: headSucceeded ? undefined : 429, cursor: priorCursor, items: recentPending ? [{ id: 'new', status: 'pendente', link: 'https://meli.la/new', criadoEm: '2026-10-12T12:00:00Z' }] : [] }
        : { readSucceeded: olderSucceeded, http: olderSucceeded ? undefined : 429, cursor: null, items: [] };
    },
    resolveRequest: async request => {
      if (failProduct) throw new LocalizerError({ events: [{ stage: 'anuncio', http: 403 }] });
      return { status: 'ok', mlb: 'MLB4359093019', precoAtual: 32.15, linkOriginal: request.link };
    },
    writeFile: async (path, content) => output.set(path, content),
    appendFile: async (path, content) => output.set(path, (output.get(path) || '') + content),
    process: { env: { GITHUB_OUTPUT: 'memory-output', GITHUB_STEP_SUMMARY: 'memory-summary' } },
    console: { log() {}, warn() {} },
  });
  return { payload, output, calls, priorCursor };
}

test('429 da segunda página marca parcial, conserva cursor/histórico e mantém respostas recentes obtidas', async () => {
  const { payload, output, calls, priorCursor } = await runQueue({ olderSucceeded: false, recentPending: true });
  assert.equal(calls.length, 2);
  assert.deepEqual(payload.queueState.cursor, priorCursor);
  assert.deepEqual(payload.resultados.preserved, { status: 'ok', precoAtual: 99, resolvidoEm: '2026-10-10T12:00:00Z' });
  assert.equal(payload.resultados.new.status, 'ok');
  assert.match(output.get('memory-output'), /failed_count=0\nincomplete=true/);
  assert.match(output.get('memory-summary'), /Firestore retornou HTTP 429/);
  assert.match(output.get('memory-output'), /queue_status=quota/);
  assert.ok(queueQuotaRetry(payload.queueState));
  assert.ok(output.has('memory-results.json'));
});

test('fila vazia com segunda página não lida não é declarada completamente consultada', async () => {
  const { output, calls, payload, priorCursor } = await runQueue({ olderSucceeded: false });
  assert.equal(calls.length, 2);
  assert.match(output.get('memory-output'), /incomplete=true/);
  assert.equal(output.has('memory-results.json'), true, 'Persistir apenas a espera de cota, sem inventar respostas.');
  assert.deepEqual(payload.queueState.cursor, priorCursor);
  assert.deepEqual(Object.keys(payload.resultados), ['preserved']);
});

test('primeira página falhando permanece parcial sem fazer leitura adicional', async () => {
  const { output, calls } = await runQueue({ headSucceeded: false });
  assert.equal(calls.length, 1);
  assert.match(output.get('memory-output'), /incomplete=true/);
});

test('duas leituras concluídas preservam estado de sucesso e avançam o cursor', async () => {
  const { payload, output, calls } = await runQueue();
  assert.equal(calls.length, 2);
  assert.equal(payload.queueState.cursor, null);
  assert.match(output.get('memory-output'), /incomplete=false/);
  assert.doesNotMatch(output.get('memory-summary'), /não pôde ser consultada/);
});

test('espera de cota não lê Firestore, não processa produtos e não estende prazo ou cursor', async () => {
  const readFailure = queueQuotaFailure(Date.now() - 60000);
  const { payload, output, calls, priorCursor } = await runQueue({ readFailure, recentPending: true });
  assert.equal(calls.length, 0);
  assert.deepEqual(payload.queueState.cursor, priorCursor);
  assert.deepEqual(payload.queueState.readFailure, readFailure);
  assert.deepEqual(Object.keys(payload.resultados), ['preserved']);
  assert.equal(output.has('memory-results.json'), false);
  assert.match(output.get('memory-output'), /incomplete=true\nqueue_status=deferred/);
  assert.match(output.get('memory-summary'), /Nenhuma nova leitura da fila foi feita/);
  assert.doesNotMatch(output.get('memory-summary'), /fila vazia|Todos os pedidos resolvidos/);
});

test('espera expirada retoma a leitura e remove o aviso depois de sucesso', async () => {
  const readFailure = queueQuotaFailure(Date.now() - 3 * 60 * 60 * 1000);
  const { payload, output, calls } = await runQueue({ readFailure, recentPending: true });
  assert.equal(calls.length, 2);
  assert.equal(payload.queueState.readFailure, undefined);
  assert.equal(payload.resultados.new.status, 'ok');
  assert.match(output.get('memory-output'), /incomplete=false\nqueue_status=read/);
});

test('falha do anúncio continua separada da cota e não agenda espera do Firestore', async () => {
  const { payload, output } = await runQueue({ recentPending: true, failProduct: true });
  assert.match(output.get('memory-output'), /failed_count=1\nincomplete=true\nqueue_status=read/);
  assert.equal(payload.queueState.readFailure, undefined);
  assert.equal(payload.resultados.new.status, 'erro');
  assert.match(output.get('memory-summary'), /anuncio: HTTP 403/);
});

test('metadados de espera só aceitam HTTP 429 e duas horas, sem texto livre nem prazo eterno', () => {
  const now = Date.now(), failure = queueQuotaFailure(now - 1);
  assert.deepEqual(queueQuotaRetry({ readFailure: { ...failure, token: 'NEVER-PUBLISH' } }, now), failure);
  assert.equal(queueQuotaRetry({ readFailure: { ...failure, http: 403 } }, now), null);
  assert.equal(queueQuotaRetry({ readFailure: { ...failure, retryAfter: '2099-01-01T00:00:00Z' } }, now), null);
  assert.equal(queueQuotaRetry({ readFailure: queueQuotaFailure(now + 60000) }, now), null);
  assert.equal(queueQuotaRetry({ readFailure: queueQuotaFailure(now - 3 * 3600000) }, now), null);
  assert.equal(queueQuotaRetry({ readFailure: { at: 'invalid', retryAfter: 'invalid', http: 429 } }, now), null);
});

test('leitura de fila rejeita corpo inválido sem declarar que a fila está vazia', async () => {
  const requestSource = source.slice(source.indexOf('async function requests(cursor'), source.indexOf('async function dumpViaMirror'));
  for (const response of [{ error: { code: 429 } }, [{ error: { code: 403 } }], [null]]) {
    const request = runInNewContext(requestSource + '\nrequests;', {
      FIRESTORE: 'https://test.invalid', queueQuery: () => ({}), nextCursor: () => null,
      fetchFirebase: async () => ({ json: async () => response }),
      console: { warn() {} },
    });
    await assert.rejects(request(), /formato de resposta inválido/);
  }
});
