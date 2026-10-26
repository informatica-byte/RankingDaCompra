import offerReplacement from '../product-offer-replacement.js';

const normalizedTitle = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Narrow, reviewed exceptions for abbreviated titles. Each entry is bound to
// explicit record IDs, their exact normalized titles, one seller listing,
// its catalogue and the same affiliate destination. A later edit invalidates
// the exception. No fuzzy matching, catalogue-only or affiliate-only fallback.
export const REVIEWED_PUBLICATION_PAIRS = [
  ['MLB2171368181','MLB18724648','https://meli.la/1wxDsG2',
    ['05S6aRd5qQ8i4L37P6qN','Colchão Casal Emma Original 138x188cm'],
    ['3yIHMxCIF9QgqjNOrSXC','Colchão Casal Emma Original 138x188cm 3 Camadas de Espuma, Embalado à Vácuo, Suporte para Coluna, Alta Respirabilidade, Capa Lavável']],
  ['MLB4812143184','MLB26796581','https://meli.la/1mHmMpu',
    ['fui9uff5MTKnVydSsaIR','Creatina Monohidratada Pura 500g Dark Lab Unidade 100%'],
    ['jABp2HpfTmQNwXsPgrYQ','Creatina Monohidratada Pura 500g Dark Lab Unidade']],
  ['MLB5761715520','MLB58579835','https://meli.la/26U7gYW',
    ['bjRcUhAfXiIDliNXbqwE','NAC 600mg - Fórmula Exclusiva com Máxima Concentração e Pureza - N'],
    ['JY36kE95u7uCT7UJWvpt','NAC 600mg - Fórmula Exclusiva com Máxima Concentração e Pureza - N-Acetil L-Cisteína - 60 Cápsulas']],
  ['MLB4228627923','MLB58353028','https://meli.la/1yWdyaS',
    ['LrJn9p8N4KF5HhsvGNL2','Smartphone Motorola Moto G06 - 128gb 4gb Ram'],
    ['uRfZSbUKT8yjArcSlGPL','Smartphone Motorola Moto G06']],
  ['MLB5105857793','MLBU4893834428','https://meli.la/2Ysb3QH',
    ['U52A4gBWWLEmfCzONtHb','Fone Ouvido Bluetooth Sem Fio Prova DAgua Wireless Tipo Light Cancelamento Ruido Celular'],
    ['WpCGzZDy0ND4DZmvKbwj','Fone Ouvido Bluetooth Compatível Com Iphone X Xr 11 12 13 14 15 16 17 Xs Pro Max Plus Samsung S20 S23 S24 Xiaomi Motorola Android Ios Sem Fio Prova DAgua Wireless Tipo Light Cancelamento Ruido Celular']],
  ['MLB4108132843','MLB47106610','https://meli.la/1w5SMxk',
    ['l7Z9wjqB0dHSHYJ6IVMA','Celular Samsung Galaxy A36 5g 256gb 8gb Ram Branco'],
    ['elvNcaWSZ5ed34Pmj8SV','Celular Samsung Galaxy A36 5g 256gb 8gb Ram Branco'],
    ['Y2LaqRfUnmllTmesIOpB','Smartphone Samsung Galaxy A36 5G 256GB 8GB RAM']],
  ['MLB7533453778','MLB40656539','https://meli.la/1BDxmV4',
    ['6mZ1ahzme9kUH1UdSkJw','Kit Starlink MINI Internet Via Satélite'],
    ['mlMLB7533453778','Starlink Mini Kit Antena Satélite com Roteador Wi-Fi']],
];

function reviewedIdentity(product, identity) {
  for (const [listingId, catalogueId, affiliate, ...records] of REVIEWED_PUBLICATION_PAIRS) {
    if (identity.listingId !== listingId || identity.catalogueId !== catalogueId
        || String(product.linkAfiliado || '').trim() !== affiliate) continue;
    if (records.some(([id,title]) => product.id === id && identity.title === normalizedTitle(title))) {
      return records.map(([id]) => id).join(':');
    }
  }
  return '';
}

// A catalogue, campaign, old stored MLB field, title or short affiliate link
// alone is never proof that two records represent the same seller listing.
export function publicationIdentity(product) {
  const title = normalizedTitle(product?.titulo);
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
    const identity = { listingId, catalogueId, title };
    const reviewed = reviewedIdentity(product, identity);
    return reviewed ? {...identity, reviewed} : identity;
  } catch { return null; } // Preserve ambiguous records separately; never guess.
}

export function samePublicationProduct(left, right) {
  return Boolean(left && right && left.listingId === right.listingId
    && (left.title === right.title || (left.reviewed && left.reviewed === right.reviewed))
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
