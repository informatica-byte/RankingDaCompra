import '../assisted-price-safety.js';

// Anúncio concreto + variante, não o primeiro código de catálogo no documento.
export function historyIdentity(html) {
  const source = String(html || '');
  const meta = source.match(/<meta\b[^>]*name=["']rdc-offer-url["'][^>]*content=["']([^"']+)["']/i)?.[1];
  const urls = meta ? [meta] : [...source.matchAll(/href=["'](https:\/\/[^"']*mercadolivre\.com\.br[^"']*)["']/gi)].map(match => match[1]);
  const found = urls.map(url => globalThis.RDCAssistedPriceSafety.identity(url.replace(/&amp;/g, '&'))).filter(Boolean);
  const identity = found.find(value => value.listing) || found[0];
  if (!identity) return '';
  return identity.key + (identity.variation ? ':variation=' + identity.variation : '') + (identity.attributes ? ':attributes=' + identity.attributes : '');
}
