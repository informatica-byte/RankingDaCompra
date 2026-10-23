import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFirestoreReadCache } from './firestore-read-cache.mjs';
const url = 'https://firestore.googleapis.com/v1/projects/rankingdacompra/databases/(default)/documents/produtos?pageSize=300';
const payload = { documents: [{ name: 'produtos/a', fields: { preco: { doubleValue: 123.45 } } }], nextPageToken: 'next-page' };

test('resposta válida é reutilizada entre processos apenas na mesma execução, sem credenciais', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rdc-cache-test-'));
  try {
    const env = { RUNNER_TEMP: directory, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', RDC_FIRESTORE_READ_CACHE_SCOPE: '123-1' };
    let calls = 0;
    const request = async () => { calls++; return Response.json(payload); };
    const first = createFirestoreReadCache({ env, request });
    assert.deepEqual(await (await first.read(url, { headers: { Authorization: 'Bearer PRIVATE-TOKEN' } })).json(), payload);
    const retry = createFirestoreReadCache({ env, request });
    assert.deepEqual(await (await retry.read(url, {})).json(), payload); assert.equal(calls, 1);
    assert.deepEqual(retry.summary(), { requests: 0, documents: 0, reusedRequests: 1, reusedDocuments: 1, failures: 0 });
    for (const file of await readdir(join(directory, 'rdc-firestore-read-123-1'))) {
      assert.doesNotMatch(await readFile(join(directory, 'rdc-firestore-read-123-1', file), 'utf8'), /PRIVATE-TOKEN|Authorization|Bearer/);
    }
    const newRun = createFirestoreReadCache({ env: { ...env, GITHUB_RUN_ID: '124', RDC_FIRESTORE_READ_CACHE_SCOPE: '124-1' }, request });
    await newRun.read(url); assert.equal(calls, 2);
    const newAttempt = createFirestoreReadCache({ env: { ...env, GITHUB_RUN_ATTEMPT: '2', RDC_FIRESTORE_READ_CACHE_SCOPE: '123-2' }, request });
    await newAttempt.read(url); assert.equal(calls, 3);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('cache vencido, inválido, sem escopo ou fora da allowlist nunca impede leitura nova', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rdc-cache-expire-')); let calls = 0, time = 100000;
  try {
    const env = { RUNNER_TEMP: directory, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', RDC_FIRESTORE_READ_CACHE_SCOPE: '123-1' };
    const request = async () => { calls++; return Response.json(payload); };
    const one = createFirestoreReadCache({ env, request, now: () => time });
    await one.read(url); time += 900001; await one.read(url); assert.equal(calls, 2);
    const plain = createFirestoreReadCache({ env: {}, request }); await plain.read(url); await plain.read(url); assert.equal(calls, 4);
    const mismatch = createFirestoreReadCache({ env: { ...env, RDC_FIRESTORE_READ_CACHE_SCOPE: 'old-run' }, request });
    await mismatch.read(url); await mismatch.read(url); assert.equal(calls, 6);
    const queue = url.replace('/produtos?pageSize=300', ':runQuery');
    await one.read(queue, { method: 'POST' }); await one.read(queue, { method: 'POST' }); assert.equal(calls, 8);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('429, 403 e falhas de rede nunca são transformados em sucesso nem cacheados', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rdc-cache-errors-'));
  try {
    const env = { RUNNER_TEMP: directory, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', RDC_FIRESTORE_READ_CACHE_SCOPE: '123-1' };
    for (const status of [403, 429, 503]) {
      let calls = 0; const cache = createFirestoreReadCache({ env, request: async () => { calls++; return Response.json({ error: 'unchanged' }, { status }); } });
      assert.equal((await cache.read(url)).status, status); assert.equal((await cache.read(url)).status, status); assert.equal(calls, 2);
    }
    const failure = Error('network'); const cache = createFirestoreReadCache({ env, request: async () => { throw failure; } });
    await assert.rejects(cache.read(url), e => e === failure);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
