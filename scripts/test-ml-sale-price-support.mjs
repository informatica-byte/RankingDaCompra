import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diagnoseSupportSalePrice } from './sync-mercadolivre.mjs';

const id = 'MLB2171368181';
const endpoint = 'https://api.mercadolibre.com/items/MLB2171368181/sale_price';

test('suporte consulta uma única vez exatamente sale_price, preservando status e JSON inteiro', async () => {
  const calls = [];
  const body = { message: 'forbidden', error: 'access_denied', status: 403, cause: [{ code: 'policy', message: 'Resource not authorized', data: { restriction: 'example' } }], extra: ['a', { b: 2 }] };
  const report = await diagnoseSupportSalePrice(id, { headers: { Authorization: 'Bearer example-test-token' },
    request: async (url, options) => { calls.push({ url, options }); return { status: 403, text: async () => JSON.stringify(body) }; } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, endpoint);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer example-test-token');
  assert.equal(report.httpStatus, 403);
  assert.equal(report.endpoint, endpoint);
  assert.deepEqual(report.json, body);
  assert.ok(!JSON.stringify(report).includes('example-test-token'));
});
test('resposta 200 é preservada sem alterar preços ou cadastros', async () => {
  const body = { amount: 159.90, currency_id: 'BRL', regular_amount: 299, metadata: { price_type: 'promotion' } };
  const report = await diagnoseSupportSalePrice(id, { request: async () => ({ status: 200, text: async () => JSON.stringify(body) }) });
  assert.equal(report.httpStatus, 200);
  assert.deepEqual(report.json, body);
});
test('credenciais são removidas também dentro de cause, arrays e texto', async () => {
  const body = { message: 'denied example-secret', error: 'forbidden', cause: [{ access_token: 'example-access', details: 'Bearer abc.def', refresh_token: 'example-refresh', client_secret: 'example-secret' }] };
  const report = await diagnoseSupportSalePrice(id, { secrets: ['example-secret', 'example-access', 'example-refresh'],
    request: async () => ({ status: 403, text: async () => JSON.stringify(body) }) });
  const output = JSON.stringify(report);
  for (const value of ['example-secret', 'example-access', 'example-refresh', 'abc.def']) assert.ok(!output.includes(value));
  assert.equal(report.json.error, 'forbidden');
  assert.equal(report.json.cause.length, 1);
  assert.equal(report.json.cause[0].access_token, '[REDACTED]');
});
test('corpo não JSON e status real não são descartados', async () => {
  const report = await diagnoseSupportSalePrice(id, { request: async () => ({ status: 502, text: async () => '<html>temporary failure</html>' }) });
  assert.equal(report.httpStatus, 502);
  assert.deepEqual(report.json, { nonJsonBody: '<html>temporary failure</html>' });
});
test('erro de rede não inventa status HTTP, não repete chamada e remove segredo', async () => {
  let count = 0;
  const report = await diagnoseSupportSalePrice(id, { secrets: ['example-secret'], request: async () => { count++; throw Error('offline example-secret'); } });
  assert.equal(count, 1);
  assert.equal(report.httpStatus, null);
  assert.equal(report.error, 'offline [REDACTED]');
  assert.equal('json' in report, false);
});
test('código inválido não permite endpoint arbitrário nem chamada alguma', async () => {
  for (const invalid of ['MLB2171368181/sale_price', '../users/me', 'https://example.com/', 'MLB779362', '']) {
    let count = 0;
    await assert.rejects(diagnoseSupportSalePrice(invalid, { request: async () => { count++; } }), /MLB válido/);
    assert.equal(count, 0);
  }
});
test('modo manual retorna antes de carregar catálogo ou Firebase e recusa modos misturados', () => {
  const source = readFileSync('scripts/sync-mercadolivre.mjs', 'utf8');
  const start = source.indexOf('if (PREFLIGHT_ONLY && supportSalePrice)');
  const finish = source.indexOf('if (PREFLIGHT_ONLY && supportItemId)', start);
  assert.ok(start > 0 && finish > start && finish < source.indexOf('let previous = await readPrevious();', start));
  const branch = source.slice(start, finish);
  assert.match(branch, /await diagnoseSupportSalePrice/);
  assert.match(branch, /return;/);
  assert.doesNotMatch(branch, /fetchFirestoreRead|runQuery|fetchItems|readPrevious|writeFile|sale_price\?context/);
  assert.match(source, /Escolha somente sale_price ou dados da aplicação/);
  const workflow = readFileSync('.github/workflows/testar-acesso-mercadolivre.yml', 'utf8');
  assert.match(workflow, /support_sale_price:[\s\S]*?default: false/);
  assert.match(workflow, /RDC_ML_SUPPORT_SALE_PRICE: \$\{\{ inputs.support_sale_price \}\}/);
});
