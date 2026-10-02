// Reformatar não pode eliminar resultados, preços ou campos desconhecidos.
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
for (const file of ['historico-precos.json', 'mlb-resolucoes.json']) {
  const original = await readFile(file, 'utf8');
  const data = JSON.parse(original);
  const compact = JSON.stringify(data) + '\n';
  assert.deepEqual(JSON.parse(compact), data);
  await writeFile(file, compact);
  console.log(`${file}: ${Buffer.byteLength(original)} -> ${Buffer.byteLength(compact)} bytes; todos os registros preservados.`);
}
