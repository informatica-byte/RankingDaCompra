import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../price-publication.js', import.meta.url), 'utf8');
const context = { window: {}, Date, Map, Number, String };
vm.createContext(context); vm.runInContext(source, context);
const state = context.window.RDCPricePublication.state;
const now = Date.parse('2026-10-04T12:00:00Z');
const product = { id:'one', preco:'81,10', precoPromocional:'81,10', precoAtualizadoManualmente:true, precoAtualizadoManualmenteEm:'2026-10-04T11:00:00Z' };
test('republish is required when the public snapshot predates a real confirmation', () => {
  const stale = { ...product, precoAtualizadoManualmenteEm:'2026-10-03T11:00:00Z' };
  assert.equal(state([product], {generatedAt:'2026-10-04T11:59:00Z',products:[stale]}, now).pending, 1);
  assert.equal(state([product], {products:[{id:'one',preco:'81,10'}]}, now).pending, 1);
});
test('matching confirmation and unchanged price require no repeat verification', () => {
  const p = { ...product, precoAtualizadoManualmenteEm:{toMillis:()=>now-3600000} };
  assert.equal(state([p], {products:[product]}, now).pending, 0);
  assert.equal(state([p], {products:[product]}, now).confirmed, 1);
});
test('a new publication date alone cannot confirm or repair a wrong price', () => {
  assert.equal(state([product], {products:[{...product,preco:'91,10'}]}, now).pending, 1);
  for (const date of ['2026-10-02T11:00:00Z','2026-10-05T11:00:00Z',null]) {
    assert.equal(state([{...product,precoAtualizadoManualmenteEm:date}], {products:[product]}, now).confirmed, 0);
  }
  assert.equal(state([{...product,precoAtualizadoManualmente:false}], {products:[product]}, now).confirmed, 0);
});
test('unpublished products are separate and malformed snapshots fail closed', () => {
  const result = state([product], {products:[]}, now);
  assert.equal(result.pending, 0); assert.equal(result.outside, 1);
  assert.throws(()=>state([product], {}, now));
});
test('panels reuse existing product reads; snapshot check never queries Firestore or auto-polls', () => {
  assert.doesNotMatch(source,/firestore\.|getDocs\(|getDoc\(|setInterval\(/);
  assert.match(source,/cache: 'no-store'/);
  for (const file of ['dashboard.html','painel-celular.html']) assert.match(readFileSync(new URL('../'+file,import.meta.url),'utf8'), /price-publication\.js\?v=20261004-1/);
});
