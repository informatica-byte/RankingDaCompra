import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/sync-mercadolivre.yml", "utf8");
const sync = await readFile("scripts/sync-mercadolivre.mjs", "utf8");
const generator = await readFile("scripts/generate-sitemap.mjs", "utf8");
const resolver = await readFile("scripts/resolve-affiliate-links.mjs", "utf8");
const dashboard = await readFile("dashboard.html", "utf8");

test("agenda somente um lote completo por dia", () => {
  assert.equal((workflow.match(/\bcron:/g) || []).length, 1);
  assert.match(workflow, /cron:\s*["']30 12 \* \* \*["']/);
  assert.match(workflow, /concurrency:[\s\S]*cancel-in-progress:\s*false/);
});

test("impede nova leitura integral no mesmo dia", () => {
  assert.match(sync, /shouldSkipDailyBatch/);
  assert.match(sync, /lastBatchAt:\s*checkedAt/);
  assert.match(sync, /nenhuma leitura do Firebase foi realizada/);
  assert.match(workflow, /RDC_BATCH_SKIP_MARKER:\s*\.price-sync-skipped/);
  assert.match(workflow, /-f "\$RDC_BATCH_SKIP_MARKER"[\s\S]{0,220}exit 0/);
});

test("bloqueia de verdade uma segunda execução na mesma data de São Paulo", async () => {
  process.env.RDC_DAILY_BATCH = "true";
  process.env.RDC_FORCE_BATCH = "false";
  const { shouldSkipDailyBatch } = await import("./sync-mercadolivre.mjs?daily-batch-test");
  assert.equal(shouldSkipDailyBatch(
    { lastBatchAt: "2026-09-08T11:45:00.000Z" },
    new Date("2026-09-08T20:00:00.000Z"),
  ), true);
  assert.equal(shouldSkipDailyBatch(
    { lastBatchAt: "2026-09-07T11:45:00.000Z" },
    new Date("2026-09-08T20:00:00.000Z"),
  ), false);
  assert.equal(shouldSkipDailyBatch(
    {},
    new Date("2026-09-08T20:00:00.000Z"),
  ), false, "a ausência de lastBatchAt deve executar o primeiro lote");
  assert.equal(shouldSkipDailyBatch(
    { lastBatchAt: "" },
    new Date("2026-09-08T20:00:00.000Z"),
  ), false, "lastBatchAt vazio não pode ser interpretado como hoje");
});

test("reutiliza a mesma lista na geração e publica somente no final", () => {
  assert.match(workflow, /RDC_PRODUCTS_SNAPSHOT:\s*\.price-sync-products\.json/);
  assert.match(sync, /PRODUCT_SNAPSHOT[\s\S]*writeFile/);
  assert.match(generator, /readProductSnapshot/);
  assert.equal((workflow.match(/git commit /g) || []).length, 1);
});

test("execução manual força o lote e publica todos os arquivos gerados", () => {
  assert.match(workflow, /description:\s*["']Repetir mesmo se o lote de hoje já terminou["'][\s\S]{0,100}default:\s*true/);
  assert.match(workflow, /git add -A mercadolivre-status\.json sitemap\.xml produto analises\.html top5-semanal\.json search-index\.json/);
});

test("localizador reutiliza e renova a autorização criptografada", () => {
  assert.match(resolver, /session\?\.accessToken\s*\|\|\s*session\?\.access_token/);
  assert.match(resolver, /session\?\.refreshToken\s*\|\|\s*session\?\.refresh_token/);
  assert.match(resolver, /async function accessToken\(forceRefresh = false\)/);
  assert.match(resolver, /\[401, 403\]\.includes\(response\.status\)[\s\S]{0,160}accessToken\(true\)/);
  assert.match(resolver, /MAX_REQUEST_ATTEMPTS\s*=\s*3/);
  assert.match(resolver, /previous\.status\s*===\s*"erro"[\s\S]{0,160}previous\.tentativas[\s\S]{0,100}MAX_REQUEST_ATTEMPTS/);
  assert.match(resolver, /tentativas:\s*previousAttempts\s*\+\s*1/);
  assert.match(resolver, /officialCatalogDetails\(catalogId/);
  assert.match(resolver, /api\.mercadolibre\.com\/products\/[^\n]+catalogId/);
  assert.match(sync, /rejectedAccessTokenRefreshPromise/);
  assert.match(sync, /fetchMarketplaceCatalog\(catalogId\)/);
  assert.match(sync, /\[401, 403\]\.includes\(error\.httpStatus\)[\s\S]{0,180}refreshRejectedAccessToken\(\)/);
});

test("painel separa preço divergente de consulta temporariamente bloqueada", () => {
  assert.match(dashboard, /tipo\s*=\s*'divergente'/);
  assert.match(dashboard, /tipo\s*\|\|\s*'nao_confirmado'/);
  assert.match(dashboard, /status\?\.itemId\s*\|\|\s*status\?\.catalogId/);
  assert.match(dashboard, /Preços realmente divergentes:/);
  assert.match(dashboard, /Verificações não concluídas:/);
  assert.match(dashboard, /grid-template-columns:\s*24px minmax\(0, 1fr\)/);
});

