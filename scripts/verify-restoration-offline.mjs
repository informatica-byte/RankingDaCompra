import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { restoreMissing } from './restore-backup.mjs';

export async function verifyRestorationOffline(backup) {
  const records = new Map();
  class Timestamp {
    constructor(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  }
  const serialize = value => {
    if (value instanceof Timestamp) return { __rdc_type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
    if (value instanceof Date) return { __rdc_type: 'date', iso: value.toISOString() };
    if (Array.isArray(value)) return value.map(serialize);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,serialize(v)]));
    return value;
  };
  const mock = { collection: name => ({ doc: id => ({ create: async data => {
    const key = `${name}/${id}`;
    if (records.has(key)) throw Object.assign(new Error('Existe'), { code: 6 });
    records.set(key, data);
  } }) }) };
  const first = await restoreMissing(mock, backup, Timestamp);
  for (const [name, items] of [['produtos',backup.products],['categorias',backup.categories],
    ['configuracoes',backup.configurations || [{id:'site',data:backup.siteConfig}]]]) {
    for (const item of items) assert.deepEqual(serialize(records.get(`${name}/${item.id}`)), item.data);
  }
  const second = await restoreMissing(mock, backup, Timestamp);
  assert.equal(second.existingSkipped, records.size);
  assert.equal(second.productsCreated + second.categoriesCreated + second.configurationsCreated, 0);
  return { first, second, roundTrip: 'all fields equal', productionWrites: 0,
    scope: backup.configurations ? 'products,categories,configuration documents' : 'products,categories,public site configuration only (legacy backup)',
    excluded: ['Authentication users','secrets','external accounts','visitas','mlbSolicitacoes'] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Uso: node scripts/verify-restoration-offline.mjs copia-privada.json');
  const bytes = readFileSync(process.argv[2]);
  const result = await verifyRestorationOffline(JSON.parse(bytes.toString('utf8')));
  console.log(JSON.stringify({ backupSha256: createHash('sha256').update(bytes).digest('hex'), ...result }, null, 2));
}
