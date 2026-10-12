import { verifyBackup } from './verify-backup.mjs';

// Read-only publication input. Never restores or writes Firestore documents.
export function publicationBackup(backup, now = Date.now()) {
  verifyBackup(backup);
  const age = now - Date.parse(backup.exportedAt);
  if (age < -300000 || age > 3600000) throw new Error('Cópia de publicação fora da janela de uma hora. Exporte uma cópia atual.');
  if (!Array.isArray(backup.configurations)) throw new Error('A publicação exige a cópia completa das configurações.');
  const convert = value => {
    if (Array.isArray(value)) return value.map(convert);
    if (value && typeof value === 'object') {
      if (value.__rdc_type === 'timestamp') {
        const date = new Date(Number(value.seconds) * 1000 + Number(value.nanoseconds || 0) / 1e6);
        if (!Number.isFinite(date.getTime())) throw new Error('Data inválida na cópia.');
        return date.toISOString();
      }
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, convert(item)]));
    }
    return value;
  };
  const records = items => items.map(item => ({ ...convert(item.data), id: item.id }));
  const config = new Map(backup.configurations.map(item => [item.id, convert(item.data)]));
  return { products: records(backup.products), categories: records(backup.categories), site: config.get('site'), weekly: config.get('ranking-semanal') || { publicado: false, produtos: [] } };
}
