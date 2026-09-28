import { readFileSync } from 'node:fs';

export function verifyBackup(backup) {
  if (backup?.format !== 'rankingdacompra-backup-v1') throw new Error('Formato de cópia desconhecido.');
  if (!Number.isFinite(Date.parse(backup.exportedAt))) throw new Error('Data de exportação inválida.');
  for (const [name, items] of [['products', backup.products], ['categories', backup.categories]]) {
    if (!Array.isArray(items) || !items.length) throw new Error(`${name}: lista vazia ou inválida.`);
    const ids = new Set();
    for (const item of items) {
      if (typeof item?.id !== 'string' || !item.id || !item.data || typeof item.data !== 'object' || Array.isArray(item.data)) {
        throw new Error(`${name}: registro sem ID ou dados válidos.`);
      }
      if (ids.has(item.id)) throw new Error(`${name}: ID duplicado: ${item.id}`);
      ids.add(item.id);
    }
  }
  if (!backup.siteConfig || typeof backup.siteConfig !== 'object' || Array.isArray(backup.siteConfig)) {
    throw new Error('Configurações do site ausentes.');
  }
  return { products: backup.products.length, categories: backup.categories.length };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  const path = process.argv[2];
  if (!path) throw new Error('Uso: node scripts/verify-backup.mjs caminho/do/backup.json');
  const counts = verifyBackup(JSON.parse(readFileSync(path, 'utf8')));
  console.log(`Cópia íntegra para revisão: ${counts.products} produtos, ${counts.categories} categorias. Nenhum dado foi restaurado.`);
}
