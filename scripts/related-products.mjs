import integrity from '../comparison-integrity.js';

// Public navigation only: never changes a record, its offer, price or model.
// An unknown/contradictory format is not permission to guess a substitute.
export function selectRelatedProducts(product, candidates, limit = 4) {
  const type = integrity.type(product);
  if (!type) return [];
  const currentModel = integrity.modelKey(product);
  const seen = new Set([currentModel]);
  const related = [];
  for (const candidate of [...candidates].sort((a, b) =>
    String(a.titulo || a.title || '').localeCompare(String(b.titulo || b.title || ''), 'pt-BR'))) {
    if (candidate.id === product.id || integrity.type(candidate) !== type) continue;
    const model = integrity.modelKey(candidate);
    if (!model || seen.has(model)) continue;
    seen.add(model);
    related.push(candidate);
    if (related.length >= limit) break;
  }
  return related;
}
