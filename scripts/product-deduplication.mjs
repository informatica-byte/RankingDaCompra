import offerReplacement from '../product-offer-replacement.js';

const normalizedTitle = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Narrow, reviewed exceptions for abbreviated titles. Each entry is bound to
// explicit record IDs, their exact normalized titles, one seller listing,
// its catalogue and the same affiliate destination. A later edit invalidates
// the exception. No fuzzy matching, catalogue-only or affiliate-only fallback.
export const REVIEWED_PUBLICATION_PAIRS = Object.freeze([
  ['MLB4587377807','MLB24117280','https://meli.la/2K1ekie',
    ['NJipazuMXMzOH9YZbxwu','Headphone Dapon H02D Bluetooth 5.1 — autonomia e porta de recarga divergentes','Fone De Ouvido Headphone Dapon H02D Bluetooth 5.1 Over-ear 22h Preto'],
    ['JuHTAByi0pSeuxzlBCy4','Fone De Ouvido Headphone Dapon H02D Bluetooth 5.1 Over-ear 22h Preto'],
    ['Y6Ty2gcU1ktmmGyznDWs','Fone De Ouvido Headphone Dapon H02D Bluetooth 5.1 Over-ear 22h Preto']],
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
    ['U52A4gBWWLEmfCzONtHb','Fone Ouvido Bluetooth Sem Fio Prova DAgua Wireless Tipo Light Cancelamento Ruido Celular','Fone PRO PHONE SEE TWS — Bluetooth 5.3 anunciado; proteção e ANC a confirmar'],
    ['WpCGzZDy0ND4DZmvKbwj','Fone Ouvido Bluetooth Compatível Com Iphone X Xr 11 12 13 14 15 16 17 Xs Pro Max Plus Samsung S20 S23 S24 Xiaomi Motorola Android Ios Sem Fio Prova DAgua Wireless Tipo Light Cancelamento Ruido Celular']],
  ['MLB4108132843','MLB47106610','https://meli.la/1w5SMxk',
    ['l7Z9wjqB0dHSHYJ6IVMA','Celular Samsung Galaxy A36 5g 256gb 8gb Ram Branco'],
    ['elvNcaWSZ5ed34Pmj8SV','Celular Samsung Galaxy A36 5g 256gb 8gb Ram Branco'],
    ['Y2LaqRfUnmllTmesIOpB','Smartphone Samsung Galaxy A36 5G 256GB 8GB RAM']],
  ['MLB7533453778','MLB40656539','https://meli.la/1BDxmV4',
    ['6mZ1ahzme9kUH1UdSkJw','Kit Starlink MINI Internet Via Satélite'],
    ['mlMLB7533453778','Starlink Mini Kit Antena Satélite com Roteador Wi-Fi']],
  ['MLB6797156948','MLB57490176','https://meli.la/32aiNcb',
    ['XRKv9OGoKrBbcDP0GxER','Kit de dois refletores LED — 6500 K, bivolt e IP67 anunciados',"Kit 2 Refletor Super Led 400w Ip67 Holofote Bivolt Prova D'água Branco Frio 6500k Preto"],
    ['eb6zL5KD6hGwH5SdE6Ua',"Kit 2 Refletor Super Led 400w Ip67 Holofote Bivolt Prova D'água Branco Frio 6500k Preto"]],
].map(group => Object.freeze(group.map(value => Array.isArray(value) ? Object.freeze(value) : value))));

// Exact records from the current backup, with explicit seller variations.
// A shared affiliate is allowed only within this reviewed same-listing set.
// Unknown/missing/changed proof still blocks; no generic variant exemption.
const REVIEWED_VARIATIONS = [
  ['1RCE8RtBHkc6aVkKZ6xB','MLB5157546240','207161735289','https://meli.la/33X4bbf',
    'Tênis New Speed Esporte Masculino 100% Original Caminhada','Tênis masculino anunciado como New Speed — caminhada'],
  ['B3HTtYZQAYonACif4tW1','MLB5157546240','187320292345','https://meli.la/1CVi5wv',
    'Tênis New Speed Esporte Masculino 100% Original Caminhada'],
  ['CO1tCKBzr6q79BOpdBZW','MLB5532075156','200557607865','https://meli.la/1ipvXiB','Tênis Kappa Pulse Rx Unissex Corrida Conforto'],
  ['d31e9yty1t0dekViXbAi','MLB5532075156','184470902110','https://meli.la/1ipvXiB','Tênis Kappa Pulse Rx Unissex Corrida Conforto'],
  ['mWlmlmg15okWqGyIc5bh','MLB5532075156','200557607873','https://meli.la/1ipvXiB','Tênis Kappa Pulse Rx Unissex Corrida Conforto'],
  ['8NEAHWVWDbRD0jFU4YSn','MLB4359093019','201545712649','https://meli.la/2zzQqEV','Tênis Masculino Casual Aramis Daily Slip Confortável Moderno'],
  ['UqO48Rj9I0f8SpOqabpv','MLB4359093019','201545712661','https://meli.la/2zzQqEV','Tênis Masculino Casual Aramis Daily Slip Confortável Moderno'],
];
export function explicitPublicationVariation(value) {
  const u=new URL(value),values=[];
  for(const params of [u.searchParams,new URLSearchParams(u.hash.slice(1))])for(const key of ['searchVariation','variation_id'])values.push(...params.getAll(key));
  if(!values.length)return '';
  if(values.some(v=>!/^\d{1,30}$/.test(v)||/^0+$/.test(v))||new Set(values).size!==1)throw Error('Variação de anúncio ambígua; publicação recusada.');
  return values[0];
}
export function reviewedPublicationVariation(product) {
  try {
    const identity=publicationIdentity(product);if(!identity)return null;
    const row=REVIEWED_VARIATIONS.find(([id,listing,variation,affiliate,...titles])=>product.id===id&&identity.listingId===listing&&identity.variationId===variation&&String(product.linkAfiliado||'').trim()===affiliate&&titles.some(t=>normalizedTitle(t)===identity.title));
    return row?{id:row[0],listingId:identity.listingId,variationId:row[2]}:null;
  } catch {return null;}
}
export function distinctReviewedPublicationVariations(left,right) {
  const valid=p=>p&&REVIEWED_VARIATIONS.some(([id,listing,variation])=>p.id===id&&p.listingId===listing&&p.variationId===variation);
  return Boolean(valid(left)&&valid(right)&&left.listingId===right.listingId&&left.id!==right.id&&left.variationId!==right.variationId);
}

function reviewedIdentity(product, identity) {
  for (const [listingId, catalogueId, affiliate, ...records] of REVIEWED_PUBLICATION_PAIRS) {
    if (identity.listingId !== listingId || identity.catalogueId !== catalogueId
        || String(product.linkAfiliado || '').trim() !== affiliate) continue;
    if (records.some(([id,...titles]) => product.id === id && titles.some(title=>identity.title===normalizedTitle(title)))) {
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
    const identity = { listingId, catalogueId, title, variationId:explicitPublicationVariation(source.href) };
    const reviewed = reviewedIdentity(product, identity);
    return reviewed ? {...identity, reviewed} : identity;
  } catch { return null; } // Preserve ambiguous records separately; never guess.
}

export function samePublicationProduct(left, right) {
  return Boolean(left && right && left.listingId === right.listingId
    && (left.variationId||'') === (right.variationId||'')
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
  // Preserve the established reviewed page, but only inside a proven group.
  for(const group of groups)if(group.identities.length>1&&group.identities.every(i=>i.reviewed&&i.reviewed===group.identities[0].reviewed))group.preferredId=['U52A4gBWWLEmfCzONtHb','XRKv9OGoKrBbcDP0GxER','NJipazuMXMzOH9YZbxwu'].find(id=>group.products.some(p=>p.id===id));
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
