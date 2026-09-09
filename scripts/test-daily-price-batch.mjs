import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/sync-mercadolivre.yml", "utf8");
const sync = await readFile("scripts/sync-mercadolivre.mjs", "utf8");
const generator = await readFile("scripts/generate-sitemap.mjs", "utf8");

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
});

test("reutiliza a mesma lista na geração e publica somente no final", () => {
  assert.match(workflow, /RDC_PRODUCTS_SNAPSHOT:\s*\.price-sync-products\.json/);
  assert.match(sync, /PRODUCT_SNAPSHOT[\s\S]*writeFile/);
  assert.match(generator, /readProductSnapshot/);
  assert.equal((workflow.match(/git commit /g) || []).length, 1);
});
