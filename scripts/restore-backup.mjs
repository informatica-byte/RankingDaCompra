import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { verifyBackup } from './verify-backup.mjs';

export function restoreValue(value, Timestamp) {
  if (Array.isArray(value)) return value.map(item => restoreValue(item, Timestamp));
  if (value && typeof value === 'object') {
    if (value.__rdc_type === 'timestamp') {
      if (!Number.isInteger(value.seconds) || !Number.isInteger(value.nanoseconds) || value.nanoseconds < 0 || value.nanoseconds >= 1e9) {
        throw new Error('Data do Firestore inválida na cópia.');
      }
      return new Timestamp(value.seconds, value.nanoseconds);
    }
    if (value.__rdc_type === 'date') {
      const date = new Date(value.iso);
      if (Number.isNaN(date.getTime())) throw new Error('Data inválida na cópia.');
      return date;
    }
    if (Object.hasOwn(value, '__rdc_type')) throw new Error('Tipo de dado desconhecido na cópia.');
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restoreValue(item, Timestamp)]));
  }
  return value;
}

export async function restoreMissing(firestore, backup, Timestamp) {
  verifyBackup(backup);
  // Valide toda a cópia antes da primeira gravação: datas inválidas não deixam
  // uma restauração parcial. create() tem precondição atômica de inexistência.
  const prepared = [
    ['categorias', backup.categories, 'categoriesCreated'],
    ['produtos', backup.products, 'productsCreated'],
    ['configuracoes', backup.configurations || [{ id: 'site', data: backup.siteConfig }], 'configurationsCreated'],
  ].map(([collection, items, counter]) => [collection,
    items.map(item => ({ id: item.id, data: restoreValue(item.data, Timestamp) })), counter]);
  const summary = { categoriesCreated: 0, productsCreated: 0, configurationsCreated: 0, existingSkipped: 0 };
  for (const [collection, items, counter] of prepared) {
    for (const item of items) {
      const reference = firestore.collection(collection).doc(item.id);
      try {
        await reference.create(item.data);
        summary[counter] += 1;
      } catch (error) {
        if (![6, '6', 'already-exists', 'ALREADY_EXISTS'].includes(error?.code)) throw error;
        summary.existingSkipped += 1;
      }
    }
  }
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) throw new Error('Uso: node scripts/restore-backup.mjs arquivo.json [--apply --project=ID]');
  const backup = JSON.parse(readFileSync(path, 'utf8'));
  const counts = verifyBackup(backup);
  const apply = process.argv.includes('--apply');
  console.log(`Cópia validada: ${counts.categories} categorias, ${counts.products} produtos.`);
  if (!apply) {
    console.log('Simulação concluída. Nenhum cadastro foi alterado.');
  } else {
    const project = process.argv.find(arg => arg.startsWith('--project='))?.split('=')[1];
    if (project !== 'rankingdacompra') throw new Error('Informe --project=rankingdacompra para aplicar a recuperação.');
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('Defina GOOGLE_APPLICATION_CREDENTIALS com uma credencial administrativa válida.');
    const admin = (await import('firebase-admin')).default;
    const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: project });
    const result = await restoreMissing(getFirestore(), backup, Timestamp);
    console.log(`Recuperação concluída: ${result.categoriesCreated} categorias, ${result.productsCreated} produtos e ${result.configurationsCreated} configuração criados; ${result.existingSkipped} registros existentes preservados.`);
  }
}
