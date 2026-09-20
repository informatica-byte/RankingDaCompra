import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/sync-mercadolivre.yml", "utf8");
const sync = await readFile("scripts/sync-mercadolivre.mjs", "utf8");
const generator = await readFile("scripts/generate-sitemap.mjs", "utf8");
const resolver = await readFile("scripts/resolve-affiliate-links.mjs", "utf8");
const dashboard = await readFile("dashboard.html", "utf8");
const mobile = await readFile("painel-celular.html", "utf8");
const localizerWorkflow = await readFile(".github/workflows/localizar-mlb.yml", "utf8");
const historyWorkflow = await readFile(".github/workflows/historico-precos.yml", "utf8");

test("oferece somente o lote manual e nao inicia sozinho", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^  schedule:/m);
  assert.doesNotMatch(workflow, /^  push:/m);
  assert.match(workflow, /concurrency:[\s\S]*cancel-in-progress:\s*false/);
  assert.match(dashboard, /Conferir todos os preços agora/);
  assert.match(mobile, /Conferir todos os preços agora/);
  assert.match(dashboard, /Nenhuma conferência começa sozinha/);
  assert.match(mobile, /Nenhuma conferência começa sozinha/);
});

test("serializa todos os robos que publicam no GitHub", () => {
  for (const writer of [workflow, localizerWorkflow, historyWorkflow]) {
    assert.match(writer, /group:\s*rankingdacompra-publicacao/);
    assert.match(writer, /cancel-in-progress:\s*false/);
  }
  assert.match(workflow, /for tentativa in 1 2 3 4; do[\s\S]*git pull --rebase origin main[\s\S]*git push origin HEAD:main/);
});

test("impede nova leitura integral no mesmo dia", () => {
  assert.match(sync, /shouldSkipDailyBatch/);
  assert.match(sync, /lastBatchAt:\s*batchComplete\s*\?\s*checkedAt/);
  assert.match(sync, /lastBatchAttemptAt:\s*checkedAt/);
  assert.match(sync, /batchSummary:/);
  assert.match(sync, /nenhuma leitura do Firebase foi realizada/);
  assert.match(workflow, /RDC_BATCH_SKIP_MARKER:\s*\.price-sync-skipped/);
  assert.match(workflow, /RDC_BATCH_PARTIAL_MARKER:\s*\.price-sync-partial/);
  assert.match(workflow, /-f "\$RDC_BATCH_SKIP_MARKER"[\s\S]{0,220}exit 0/);
});

test("não registra falha temporária como preço confirmado", () => {
  assert.match(sync, /lastError:[\s\S]{0,180}checkedAt:\s*relevantPrevious\.checkedAt\s*\|\|\s*""/);
  assert.match(sync, /const batchComplete = failedChecks === 0/);
  assert.match(dashboard, /Conferência parcial:/);
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

test("consulta preços em blocos oficiais com ritmo econômico", () => {
  assert.match(sync, /MAX_BULK_ITEMS\s*=\s*20/);
  assert.match(sync, /api\.mercadolibre\.com\/items\/bulk\?ids=/);
  assert.match(sync, /body\.\$\{attribute\}/);
  assert.match(sync, /RDC_ML_PARALLEL_REQUESTS\s*\|\|\s*2/);
  assert.match(sync, /RDC_ML_REQUEST_INTERVAL_MS\s*\|\|\s*350/);
  assert.match(sync, /response\.status\s*===\s*429[\s\S]{0,500}2\s*\*\*\s*attempt/);
  assert.doesNotMatch(sync, /"\/sale_price"/);
  assert.match(sync, /previousItemId[\s\S]{0,120}shouldTrustStoredItemId/);
  assert.match(sync, /MLB_RESOLUTIONS_FILE\s*=\s*resolve\("mlb-resolucoes\.json"\)/);
  assert.match(sync, /cachedResolution\.status\s*===\s*"ok"/);
  assert.match(sync, /resolveItemId\([\s\S]{0,300}oldRecord,[\s\S]{0,80}false/);
  assert.match(sync, /resolvedItemId\s*!==\s*null/);
});

test("execução manual evita repetição e publica todos os arquivos gerados", () => {
  assert.match(workflow, /description:\s*["']Repetir mesmo se o lote de hoje já terminou["'][\s\S]{0,100}default:\s*false/);
  assert.match(workflow, /git add -A mercadolivre-status\.json sitemap\.xml produto analises\.html 'melhores-\*\.html' top5-semanal\.json search-index\.json/);
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

test("localizador reduz leituras automáticas sem abandonar a fila", () => {
  assert.match(localizerWorkflow, /cron:\s*["']7,37 \* \* \* \*["']/);
  assert.doesNotMatch(localizerWorkflow, /7,22,37,52/);
});

test("painel separa preço divergente de consulta temporariamente bloqueada", () => {
  assert.match(dashboard, /tipo\s*=\s*'divergente'/);
  assert.match(dashboard, /tipo\s*\|\|\s*'nao_confirmado'/);
  assert.match(dashboard, /pendente:\s*tipo\s*===\s*'divergente'/);
  assert.match(dashboard, /diagnostico\.tipo\s*===\s*'nao_confirmado'[\s\S]{0,80}verificacoesNaoConcluidas\s*\+=\s*1/);
  assert.match(dashboard, /status\?\.itemId\s*\|\|\s*status\?\.catalogId/);
  assert.match(dashboard, /Preços realmente divergentes:/);
  assert.match(dashboard, /Verificações não concluídas:/);
  assert.match(dashboard, /grid-template-columns:\s*24px minmax\(0, 1fr\)/);
});

