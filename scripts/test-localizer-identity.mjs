import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { pendingRequests, resolutionSummary } from './localizer-queue.mjs';
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

async function runQueue({ headSucceeded = true, olderSucceeded = true, recentPending = false } = {}) {
  const priorCursor = [{ timestampValue: '2026-10-11T12:00:00Z' }, { referenceValue: 'projects/test/documents/mlbSolicitacoes/old' }];
  const payload = { resultados: { preserved: { status: 'ok', precoAtual: 99, resolvidoEm: '2026-10-10T12:00:00Z' } }, queueState: { cursor: priorCursor } };
  const output = new Map();
  const calls = [];
  const tail = source.slice(source.indexOf('const priorQueueState ='));
  await runInNewContext(`(async () => { ${tail} })();`, {
    payload, OUTPUT: 'memory-results.json', MAX_REQUEST_ATTEMPTS: 3,
    pendingRequests, resolutionSummary, resolveQueuedRequests, diagnosticTable,
    requests: async cursor => {
      calls.push(cursor);
      return calls.length === 1
        ? { readSucceeded: headSucceeded, cursor: priorCursor, items: recentPending ? [{ id: 'new', status: 'pendente', link: 'https://meli.la/new', criadoEm: '2026-10-12T12:00:00Z' }] : [] }
        : { readSucceeded: olderSucceeded, cursor: null, items: [] };
    },
    resolveRequest: async request => ({ status: 'ok', mlb: 'MLB4359093019', precoAtual: 32.15, linkOriginal: request.link }),
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
  assert.match(output.get('memory-summary'), /não pôde ser consultada por completo/);
  assert.ok(output.has('memory-results.json'));
});

test('fila vazia com segunda página não lida não é declarada completamente consultada', async () => {
  const { output, calls } = await runQueue({ olderSucceeded: false });
  assert.equal(calls.length, 2);
  assert.match(output.get('memory-output'), /incomplete=true/);
  assert.equal(output.has('memory-results.json'), false);
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
