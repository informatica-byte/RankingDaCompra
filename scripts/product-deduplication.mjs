import offerReplacement from '../product-offer-replacement.js';

// A catalogue, campaign, old stored MLB field, title or short affiliate link
// alone is never proof that two records represent the same seller listing.
export function publicationIdentity(product) {
  const title = String(product?.titulo || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  let source;
  try { source = new URL(String(product?.link || '').trim()); } catch { return null; }
  if (source.protocol !== 'https:' || source.username || source.password || source.port
      || !/(?:^|\.)mercadolivre\.com\.br$/i.test(source.hostname)) return null;
  try {
    const listingId = offerReplacement.listing(source.href);
    if (!listingId || !title) return null;
    const affiliateId = offerReplacement.listing(product?.linkAfiliado);
    if (affiliateId && affiliateId !== listingId) return null;
    // A missing catalogue is compatible with a direct seller URL, but two
    // explicitly different catalogues must not be bridged by that record.
    const catalogueId = source.pathname.match(/\/(?:p|up)\/(MLBU?\d+)(?:\/|$)/i)?.[1]?.toUpperCase() || '';
    return { listingId, catalogueId, title };
  } catch { return null; } // Preserve ambiguous records separately; never guess.
}

export function samePublicationProduct(left, right) {
  return Boolean(left && right && left.listingId === right.listingId && left.title === right.title
    && (!left.catalogueId || !right.catalogueId || left.catalogueId === right.catalogueId));
}

export function publicationProductGroups(products) {
  if (!Array.isArray(products)) throw new Error('Lista de produtos inválida para consolidar páginas.');
  const ids = new Set(), groups = [], buckets = new Map();
  for (const product of products) {
    if (!product?.id || ids.has(product.id)) throw new Error('Cadastro sem identidade ou repetido; publicação recusada.');
    ids.add(product.id);
    const identity = publicationIdentity(product);
    const candidates = identity ? buckets.get(identity.listingId) || [] : [];
    // Pairwise proof avoids transitive merging through a weaker middle record.
    let group = candidates.find(candidate => candidate.identities.every(other => samePublicationProduct(other, identity)));
    if (!group) {
      group = { products: [], identities: [] };
      groups.push(group);
      if (identity) { candidates.push(group); buckets.set(identity.listingId, candidates); }
    }
    group.products.push(product);
    if (identity) group.identities.push(identity);
  }
  return groups;
}

export function sameHistoricalListing(product, itemId) {
  try {
    const url = new URL(String(product?.link || ''));
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && /(?:^|\.)mercadolivre\.com\.br$/i.test(url.hostname)
      && offerReplacement.listing(url.href) === itemId;
  } catch { return false; }
}
