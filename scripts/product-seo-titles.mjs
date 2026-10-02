const CONNECTORS = /(?:\s|^)(?:de|do|da|dos|das|em|com|para|e|o|a|os|as|um|uma|por|ao|à)$/i;

export function productSeoName(value, max = 74) {
  const full = String(value || '').replace(/\s+/g, ' ').replace(/[…]+$/g, '').trim();
  let title = full.length <= max ? full : full.slice(0, max + 1).replace(/\s+\S*$/, '').trim();
  while (CONNECTORS.test(title)) title = title.replace(CONNECTORS, '').trim();
  return title.replace(/[,:;\-–]+$/, '').trim() || 'Produto: análise e condições da oferta';
}

// Variantes já comprovadas nos nomes cadastrados; não infere cor/voltagem.
export function productSeoTitle(value, source = '') {
  const full = String(value || '');
  const variant = /\bsoundcore P30i\b/i.test(full) ? full.match(/\b(Verde|Preto|Branco)\s*$/i)?.[1] : '';
  const url = typeof source === 'object' ? String(source.urlProduto || source.mlb || '') : String(source);
  const offer = /Liquidificador Turbo Power Mondial 550W.*L-99 FB/i.test(full) ? (url.match(/(?:wid=|item_id(?:%3A|:))(MLB\d+)/i)?.[1] || url.match(/\bMLB-?(\d{8,})\b/i)?.[0]?.replace('-', '')) : '';
  const suffix = variant ? ` — ${variant}` : offer ? ` — anúncio ${offer}` : '';
  return `${productSeoName(full, suffix ? Math.max(44, 74 - suffix.length) : 74)}${suffix} | Ranking da Compra`;
}
