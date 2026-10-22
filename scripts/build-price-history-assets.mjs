import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Display-only projection. Never records observations or modifies the source history.
export function priceHistoryAssets(history) {
  if (!history || typeof history.products !== 'object' || Array.isArray(history.products)) throw Error('Histórico inválido; projeção não gerada.');
  const manifest = { version: 2, days: 30, updatedAt: history.updatedAt || null, products: {} };
  const files = new Map();
  for (const [id, item] of Object.entries(history.products).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw Error('Identificador inválido no histórico.');
    const points = (Array.isArray(item?.points) ? item.points : []).map(point => {
      const [date, price] = point;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(price) || price <= 0) throw Error('Ponto inválido no histórico de ' + id);
      return [date, price, item.observations?.[date]?.verified === true];
    });
    const json = JSON.stringify({ version: 2, id, points }) + '\n';
    const hash = createHash('sha256').update(json).digest('hex').slice(0, 16);
    const name = id + '-' + hash + '.json';
    manifest.products[id] = name;
    files.set(name, json);
  }
  return { manifest, files };
}

export async function buildPriceHistoryAssets(root = process.cwd()) {
  const history = JSON.parse(await readFile(resolve(root, 'historico-precos.json'), 'utf8'));
  const { manifest, files } = priceHistoryAssets(history);
  const directory = resolve(root, 'assets/price-history');
  await mkdir(directory, { recursive: true });
  // Retain older content-addressed files so open tabs are not broken during publication.
  for (const [name, content] of files) await writeFile(resolve(directory, name), content);
  await writeFile(resolve(root, 'historico-precos-indice.json'), JSON.stringify(manifest) + '\n');
  return { products: files.size, bytes: [...files.values()].reduce((sum, value) => sum + Buffer.byteLength(value), 0), indexBytes: Buffer.byteLength(JSON.stringify(manifest) + '\n') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(await buildPriceHistoryAssets()));
