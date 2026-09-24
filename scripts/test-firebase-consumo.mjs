import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { pacificDate, gaugeState, parseReads, currentSnapshot, LIMITS } = require("../firebase-consumo.js");

test("a virada da cota usa a data do Pacífico, não a data brasileira", () => {
  assert.equal(pacificDate("2026-09-23T06:30:00Z"), "2026-09-22");
  assert.equal(pacificDate("2026-09-23T07:30:00Z"), "2026-09-23");
});

test("aceita apenas totais inteiros e não negativos", () => {
  assert.equal(parseReads(" 12500 "), 12500);
  for (const value of ["", "-1", "1,5", "12.5", "abc", "9007199254740992"]) {
    assert.equal(parseReads(value), null);
  }
});

test("registro fica restrito ao dia da cota no Pacífico", () => {
  const snapshot = { day: "2026-09-23", reads: 1200, at: "2026-09-23T07:30:00.000Z" };
  assert.deepEqual(currentSnapshot(JSON.stringify(snapshot), new Date("2026-09-23T08:00:00Z")), snapshot);
  assert.equal(currentSnapshot(JSON.stringify(snapshot), new Date("2026-09-24T07:30:00Z")), null);
  assert.equal(currentSnapshot(JSON.stringify({ ...snapshot, reads: -1 }), new Date("2026-09-23T08:00:00Z")), null);
  assert.equal(currentSnapshot(JSON.stringify({ ...snapshot, at: "2026-09-23T09:00:00Z" }), new Date("2026-09-23T08:00:00Z")), null);
  assert.equal(currentSnapshot("não é JSON", new Date("2026-09-23T08:00:00Z")), null);
});

test("ponteiro indica a fração da cota sem inventar saldo acima do limite", () => {
  assert.equal(LIMITS.reads, 50000);
  assert.deepEqual(gaugeState(25000), { remaining: 25000, angle: -90, level: "normal" });
  assert.deepEqual(gaugeState(60000), { remaining: 0, angle: -180, level: "critico" });
  assert.equal(gaugeState(Number.NaN), null);
});
