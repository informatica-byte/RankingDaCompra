import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { pacificDate, sumForPacificDay, gaugeState, LIMITS, METRICS } = require("../firebase-consumo.js");

test("a virada da cota usa a data do Pacífico, não a data brasileira", () => {
  assert.equal(pacificDate("2026-09-23T06:30:00Z"), "2026-09-22");
  assert.equal(pacificDate("2026-09-23T07:30:00Z"), "2026-09-23");
});

test("soma séries e exclui o dia anterior e outros bancos", () => {
  const point = (start, end, value) => ({ interval: { startTime: start, endTime: end }, value: { int64Value: String(value) } });
  const series = [
    { resource: { labels: { database_id: "(default)" } }, points: [
      point("2026-09-23T07:01:00Z", "2026-09-23T07:02:00Z", 8),
      point("2026-09-23T06:58:00Z", "2026-09-23T06:59:00Z", 300)
    ] },
    { resource: { labels: { database_id: "(default)" } }, points: [point("2026-09-23T07:02:00Z", "2026-09-23T07:03:00Z", 12)] },
    { resource: { labels: { database_id: "outro" } }, points: [point("2026-09-23T07:02:00Z", "2026-09-23T07:03:00Z", 999)] }
  ];
  assert.deepEqual(sumForPacificDay(series, "2026-09-23"), { count: 20, points: 2 });
});

test("ponteiro indica a fração da cota sem inventar saldo acima do limite", () => {
  assert.equal(LIMITS.reads, 50000);
  assert.equal(METRICS.reads, "firestore.googleapis.com/document/read_ops_count");
  assert.deepEqual(gaugeState(25000), { remaining: 25000, angle: -90, level: "normal" });
  assert.deepEqual(gaugeState(60000), { remaining: 0, angle: -180, level: "critico" });
  assert.equal(gaugeState(Number.NaN), null);
});
