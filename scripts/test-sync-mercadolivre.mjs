import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import {
  diagnoseSupportItem,
  sanitizeSupportPayload,
  bulkItemAttributes,
  bulkItemFromEntry,
  canProceedWithPriceBatch,
  catalogRecordFromPayload,
  extractCatalogIdFromUrl,
  extractItemIdFromUrl,
  isMercadoLivreProduct,
  isEncryptedTokenEnvelope,
  validateMarketplaceItem,
  deriveRecord,
  repairLegacyHiddenRecords,
  selectPreflightItemIds,
  shouldRetryBulkOutcome,
  summarizeBatchChecks,
  shouldTrustStoredItemId,
} from "./sync-mercadolivre.mjs";

test('resposta 200 incompleta ou de outro anúncio nunca comprova preço ou indisponibilidade', async () => {
  const source = await readFile(new URL('./sync-mercadolivre.mjs', import.meta.url), 'utf8');
  const functionSource = source.slice(source.indexOf('async function checkProduct('), source.indexOf('// Application support diagnostic:'));
  const itemSource = source.slice(source.indexOf('async function fetchMarketplaceItem('), source.indexOf('function lightningFields('));
  const check = runInNewContext(itemSource + functionSource + '\ncheckProduct;', {
    extractCatalogIdFromUrl, deriveRecord, bulkItemFromEntry, validateMarketplaceItem, accessToken: '',
    fetchJson: async () => { throw new Error('Nenhuma consulta externa permitida no teste'); },
  });
  const id = 'MLB1234567890';
  const active = { id, status: 'active', price: 125, currency_id: 'BRL', available_quantity: 1 };
  const prior = { itemId: id, managed: true, status: 'active', available: true, visible: true,
    price: 125, regularPrice: 150, unavailableChecks: 0, checkedAt: '2026-10-10T00:00:00Z' };
  for (const body of [{ id }, { id, status: 'active' }, { id, status: 'active', price: true },
    { id, status: 'active', price: [125] }, { id, status: 'unknown', price: 125 },
    { ...active, id: 'MLB9876543210' },
    { ...active, currency_id: undefined }, { ...active, currency_id: 'USD' },
    ...[undefined, null, '', '1', true, -1, NaN, Infinity].map(available_quantity => ({ ...active, available_quantity }))]) {
    const outcome = bulkItemFromEntry({ id, status_code: 200, body }, id);
    assert.ok(outcome.error);
    assert.equal(outcome.item, null);
    let record = prior;
    for (const at of ['2026-10-14T10:00:00Z', '2026-10-14T11:00:00Z']) {
      record = await check({ id: 'fixture' }, record, at, id, outcome);
      for (const field of ['status', 'available', 'visible', 'price', 'regularPrice', 'unavailableChecks', 'checkedAt']) {
        assert.equal(record[field], prior[field], field);
      }
      assert.equal(record.lastAttemptAt, at);
      assert.ok(record.lastError);
      const summary = summarizeBatchChecks([['fixture', record]]);
      assert.equal(summary.failed, 1);
      assert.equal(summary.confirmed, 0);
      assert.equal(summary.complete, false);
    }
  }
});

test('resposta válida conserva confirmações reais de anúncio ativo ou pausado', () => {
  const id = 'MLB1234567890';
  for (const available_quantity of [0, 1]) {
    assert.equal(bulkItemFromEntry({ status_code: 200, body: { id, status: 'active', price: 125, currency_id: 'BRL', available_quantity } }, id).error, null);
  }
  for (const status of ['paused', 'closed']) {
    const unavailable = bulkItemFromEntry({ status_code: 200, body: { id, status } }, id);
    assert.equal(unavailable.error, null);
    const first = deriveRecord({}, { itemId: id, status: unavailable.item.status, available: false, price: null }, '2026-10-14T10:00:00Z');
    assert.equal(deriveRecord(first, { itemId: id, status, available: false, price: null }, '2026-10-14T11:00:00Z').visible, false);
  }
  const wrongNotFound = bulkItemFromEntry({ id: 'MLB9876543210', status_code: 404 }, id);
  assert.ok(wrongNotFound.error);
  assert.equal(wrongNotFound.notFound, undefined);
});

test('preservação OAuth aceita apenas envelope AES-GCM válido, sem descriptografar', () => {
  const envelope = { version: 1, iv: Buffer.alloc(12).toString('base64'), tag: Buffer.alloc(16).toString('base64'), data: Buffer.alloc(24).toString('base64') };
  assert.equal(isEncryptedTokenEnvelope(envelope), true);
  for (const invalid of [null, {}, { ...envelope, data: '' }, { ...envelope, iv: Buffer.alloc(16).toString('base64') },
    { ...envelope, tag: 'token-em-texto' }, { ...envelope, version: 2 }, { ...envelope, accessToken: 'não aceitar texto aberto' }]) {
    assert.equal(isEncryptedTokenEnvelope(invalid), false);
  }
});

test('workflow preserva somente a autorização alterada e válida mesmo se a consulta falhar', async () => {
  const workflow = await readFile(new URL('../.github/workflows/sync-mercadolivre.yml', import.meta.url), 'utf8');
  const preservation = workflow.slice(workflow.indexOf('      - name: Preservar autorização criptografada após falha posterior'), workflow.indexOf('      - name: Sinalizar conferência parcial'));
  assert.match(preservation, /if: always\(\) && steps\.marketplace-query\.outcome != 'skipped'/);
  assert.match(preservation, /! -f "\$RDC_OAUTH_PRESERVATION_MARKER"/);
  assert.match(preservation, /git diff --quiet origin\/main -- \.mercadolivre-token\.enc/);
  assert.match(preservation, /isEncryptedTokenEnvelope\(JSON\.parse/);
  assert.match(preservation, /git worktree add --detach "\$oauth_worktree" origin\/main/);
  assert.match(preservation, /git -C "\$oauth_worktree" commit --only[^\n]+-- \.mercadolivre-token\.enc/);
  assert.match(preservation, /git -C "\$oauth_worktree" pull --rebase origin main/);
  assert.match(preservation, /git -C "\$oauth_worktree" push origin HEAD:main/);
  assert.doesNotMatch(preservation, /git add -A|git add mercadolivre-status|console\.log\(.*payload/);
});

test('renovação OAuth deixa marcador sem credenciais antes de uma falha posterior', async () => {
  const source = await readFile(new URL('./sync-mercadolivre.mjs', import.meta.url), 'utf8');
  const saveSource = source.slice(source.indexOf('async function saveOAuthToken('), source.indexOf('async function prepareAccessToken('));
  const writes = new Map();
  const save = runInNewContext(saveSource + '\nsaveOAuthToken;', {
    TOKEN_FILE: 'memory-encrypted', OAUTH_PRESERVATION_MARKER: 'memory-marker', resolve: value => value,
    encryptTokenSession: () => 'encrypted-fixture', writeFile: async (path, value) => writes.set(path, value),
  });
  await save({ access_token: 'fixture-only', refresh_token: 'fixture-refresh', expires_in: 21600 });
  assert.equal(writes.get('memory-marker'), 'refreshed\n');
  assert.equal(writes.get('memory-encrypted'), 'encrypted-fixture\n');
  assert.doesNotMatch(writes.get('memory-marker'), /fixture/);
  await assert.rejects((async () => { throw new Error('HTTP 403 after refresh'); })());
  assert.equal(writes.get('memory-marker'), 'refreshed\n');
});

test("diagnóstico só libera confiança quando preço e anúncio são acessíveis", () => {
  assert.equal(canProceedWithPriceBatch({ item: true, salePrice: true }), true);
  assert.equal(canProceedWithPriceBatch({ bulk: true, salePrice: true }), true);
  assert.equal(canProceedWithPriceBatch({ salePrice: true }), false);
  assert.equal(canProceedWithPriceBatch({ item: true }), false);
  assert.equal(canProceedWithPriceBatch({ bulk: true }), false);
});

test("preflight usa somente anúncios antes bloqueados, sem repetir IDs", () => {
  assert.deepEqual(selectPreflightItemIds({ products: {
    a: { managed: true, itemId: "MLB1234567890", lastError: "Mercado Livre: HTTP 403" },
    b: { managed: true, itemId: "MLB1234567890", lastError: "Mercado Livre: HTTP 401" },
    c: { managed: true, itemId: "MLB2345678901", lastError: "Mercado Livre: HTTP 403" },
    d: { managed: false, itemId: "MLB3456789012", lastError: "Mercado Livre: HTTP 403" },
    e: { managed: true, itemId: "MLB4567890123", lastError: "" },
  } }), ["MLB1234567890", "MLB2345678901"]);
});

test("solicita somente campos body no filtro oficial do endpoint bulk", () => {
  const attributes = bulkItemAttributes().split(",");
  assert.equal(attributes.length, 7);
  assert.equal(attributes.every((attribute) => attribute.startsWith("body.")), true);
  assert.equal(attributes.includes("id"), false);
  assert.equal(attributes.includes("status_code"), false);
});

test("interpreta a resposta oficial do novo endpoint bulk", () => {
  assert.deepEqual(bulkItemFromEntry({
    id: "MLB1234567890",
    status_code: 200,
    body: { id: "MLB1234567890", price: 199.9, status: "active", currency_id: "BRL", available_quantity: 1 },
  }), {
    item: { id: "MLB1234567890", price: 199.9, status: "active", currency_id: "BRL", available_quantity: 1 },
    error: null,
  });
  assert.deepEqual(bulkItemFromEntry({
    body: { id: "MLB1234567890", price: 199.9, status: "active", currency_id: "BRL", available_quantity: 1 },
  }), {
    item: { id: "MLB1234567890", price: 199.9, status: "active", currency_id: "BRL", available_quantity: 1 },
    error: null,
  }, "aceita o body válido quando a seleção de campos omite status_code");
  assert.deepEqual(bulkItemFromEntry({ status_code: 404 }), {
    item: null,
    error: null,
    notFound: true,
  });
  const denied = bulkItemFromEntry({ status_code: 403, body: { message: "forbidden" } });
  assert.equal(denied.item, null);
  assert.equal(denied.error.httpStatus, 403);
});

test("recupera somente falhas temporarias do endpoint bulk", () => {
  const badGateway = bulkItemFromEntry({
    id: "MLB1234567890",
    status_code: 502,
    body: { message: "bad_gateway" },
  });
  const limited = bulkItemFromEntry({ status_code: 429 });
  const forbidden = bulkItemFromEntry({ status_code: 403 });
  assert.equal(shouldRetryBulkOutcome(badGateway), true);
  assert.equal(shouldRetryBulkOutcome(limited), true);
  assert.equal(shouldRetryBulkOutcome(forbidden), false);
  assert.equal(shouldRetryBulkOutcome({ item: { id: "MLB1234567890" }, error: null }), false);
});

test("lote com bloqueio de acesso nunca aparece como conferência completa", () => {
  const checks = summarizeBatchChecks([
    ["ok", { managed: true, price: 100 }],
    ["bloqueado", { managed: true, lastError: "Mercado Livre: HTTP 403 - policy UNAUTHORIZED" }],
    ["semCodigo", { managed: false }],
  ]);
  assert.deepEqual(checks, {
    confirmed: 1,
    failed: 1,
    unmanaged: 1,
    blocked: 1,
    complete: false,
    reason: "marketplace_access_denied",
  });
});

test("mantem produtos antigos no lote MLB e ignora produtos Shopee", () => {
  assert.equal(isMercadoLivreProduct({ link: "https://www.mercadolivre.com.br/produto" }), true);
  assert.equal(isMercadoLivreProduct({ marketplace: "mercado_livre" }), true);
  assert.equal(isMercadoLivreProduct({ marketplace: "shopee", link: "https://shopee.com.br/produto" }), false);
  assert.equal(isMercadoLivreProduct({ linkAfiliado: "https://s.shopee.com.br/exemplo" }), false);
});

test("usa o catálogo oficial quando o anúncio individual é recusado", () => {
  const url = "https://www.mercadolivre.com.br/liquidificador/p/MLB15699907?wid=MLB3306024289";
  assert.equal(extractCatalogIdFromUrl(url), "MLB15699907");
  assert.deepEqual(catalogRecordFromPayload("MLB15699907", {
    id: "MLB15699907",
    buy_box_winner: {
      item_id: "MLB3306024289",
      price: 179.9,
      original_price: 219.9,
      currency_id: "BRL",
    },
  }), {
    itemId: "MLB3306024289",
    catalogId: "MLB15699907",
    status: "active",
    available: true,
    price: 179.9,
    regularPrice: 219.9,
    currencyId: "BRL",
    source: "catalog_api",
  });
});

test("prioriza o wid real em uma pagina de catalogo", () => {
  const url = "https://www.mercadolivre.com.br/notebook/p/MLB35715045"
    + "?pdp_filters=deal%3AMLB779362-1&wid=MLB4604524838";
  assert.equal(extractItemIdFromUrl(url), "MLB4604524838");
});

test("nao trata codigo de catalogo como anuncio indisponivel", () => {
  const product = {
    link: "https://www.mercadolivre.com.br/notebook/p/MLB35715045",
    linkAfiliado: "https://meli.la/exemplo",
  };
  assert.equal(shouldTrustStoredItemId("MLB35715045", product), false);
  assert.equal(shouldTrustStoredItemId("MLB779362", product), false);
  assert.equal(shouldTrustStoredItemId("MLB4604524838", product), true);
});

test("mantem codigo explicito quando nao ha endereco para conferir", () => {
  assert.equal(shouldTrustStoredItemId("MLB1234567", {}), true);
});

test("reativa somente falsos indisponiveis antigos com codigo de catalogo", () => {
  const previous = {
    version: 1,
    products: {
      catalogo: {
        itemId: "MLB779362",
        status: "not_found",
        visible: false,
        available: false,
        managed: true,
        unavailableChecks: 2,
      },
      anuncioReal: {
        itemId: "MLB4671364943",
        status: "inactive",
        visible: false,
        available: false,
        managed: true,
        unavailableChecks: 2,
      },
    },
  };
  const { repaired, payload } = repairLegacyHiddenRecords(previous, "2026-09-09T15:00:00.000Z");
  assert.equal(repaired, 1);
  assert.equal(payload.products.catalogo.visible, true);
  assert.equal(payload.products.catalogo.status, "missing_item_id");
  assert.equal(payload.products.catalogo.itemId, "");
  assert.equal(payload.products.catalogo.unavailableChecks, 0);
  assert.deepEqual(payload.products.anuncioReal, previous.products.anuncioReal);
});


test("suporte faz apenas uma chamada ao item solicitado e uma à identidade, sem repetir 403", async () => {
  const calls = [];
  const payload = { message: "At least one policy returned UNAUTHORIZED.", error: "forbidden",
    code: "PA_UNAUTHORIZED_RESULT_FROM_POLICIES", blocked_by: "PolicyAgent",
    cause: [{ code: "denied", message: "keep complete" }], extra: { access_token: "secret", note: "echo secret" } };
  const report = await diagnoseSupportItem("MLB2171368181", {
    headers: { Authorization: "Bearer secret" }, secrets: ["secret"],
    request: async (url, options) => {
      calls.push({ url, options });
      return url.endsWith("/users/me")
        ? { status: 200, ok: true, json: async () => ({ id: 123456, email: "private@example.test" }) }
        : { status: 403, ok: false, text: async () => JSON.stringify(payload) };
    },
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(c => c.url), ["https://api.mercadolibre.com/users/me", "https://api.mercadolibre.com/items/MLB2171368181"]);
  assert.equal(calls.every(c => c.options.method === "GET"), true);
  assert.deepEqual(report.identity, { httpStatus: 200, user_id: 123456 });
  assert.equal(report.item.httpStatus, 403);
  assert.deepEqual(report.item.json.cause, payload.cause);
  assert.equal(report.item.json.extra.access_token, "[REDACTED]");
  assert.equal(report.item.json.extra.note, "echo [REDACTED]");
  assert.equal(JSON.stringify(report).includes("private@example.test"), false);
  assert.equal(JSON.stringify(report).includes("secret"), false);
});

test("suporte preserva JSON inteiro e remove credenciais também em arrays e strings", () => {
  assert.deepEqual(sanitizeSupportPayload({ cause: [{ message: "Bearer abc", refresh_token: "r" }], untouched: 42 }),
    { cause: [{ message: "Bearer [REDACTED]", refresh_token: "[REDACTED]" }], untouched: 42 });
});

test("suporte não usa endpoint arbitrário nem repete chamada após falha de rede", async () => {
  let calls = 0;
  await assert.rejects(diagnoseSupportItem("https://evil.test", { request: async () => calls++ }));
  assert.equal(calls, 0);
  const report = await diagnoseSupportItem("MLB2171368181", {
    request: async () => { calls++; throw new Error("network fail"); },
  });
  assert.equal(calls, 2);
  assert.equal(report.item.httpStatus, null);
});

test("suporte mantém os campos de sucesso sem atualizar catálogo ou preços", async () => {
  const report = await diagnoseSupportItem("MLB2171368181", {
    request: async url => url.endsWith("/users/me")
      ? { status: 403, ok: false, json: async () => ({ message: "denied", id: 1 }) }
      : { status: 200, ok: true, text: async () => '{"id":"MLB2171368181","price":123,"status":"active"}' },
  });
  assert.equal(report.identity.user_id, null);
  assert.deepEqual(report.item.json, { id: "MLB2171368181", price: 123, status: "active" });
});
