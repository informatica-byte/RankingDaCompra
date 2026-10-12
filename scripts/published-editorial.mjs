// A análise visível é independente de Review/nota numérica no JSON-LD.
function plain(value) {
  return String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
      const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    }).replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

export function publishedEditorialNotes(html, sectionClass, structuredNotes) {
  const blocks = [...String(html || '').matchAll(/<section\b[^>]*class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/section>/gi)];
  const section = blocks.find(([, classes]) => classes.split(/\s+/).includes('panel')
    && classes.split(/\s+/).includes(sectionClass));
  const list = section?.[2].match(/<ul\b[^>]*>([\s\S]*?)<\/ul>/i)?.[1] || '';
  const visible = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(([, item]) => plain(item)).filter(Boolean);
  return visible.length ? visible : (structuredNotes?.itemListElement || [])
    .map(item => plain(item?.name)).filter(Boolean);
}

export function editorialItems(value) {
  return (Array.isArray(value) ? value : String(value || '').split(/\s*;\s*|\n+/))
    .map(item => plain(item)).filter(Boolean);
}

function normalized(value) {
  return plain(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Warnings and an empty evidence record are useful disclosures, not product
// advantages/limitations that can earn points or qualify a value badge.
export function usefulEditorialItems(product, field) {
  const title = normalized(product?.titulo);
  const seen = new Set();
  return editorialItems(product?.[field]).filter(item => {
    const text = normalized(item);
    if (text.length < 18 || seen.has(text) || text === title || (title && text.startsWith(title + ' '))) return false;
    if (/^(?:confira|confirme|verifique|verificar|conferir|consulte|antes de comprar)\b/.test(text)) return false;
    if (/(?:nao|ainda nao|sem).{0,30}(?:pontos? positivos?|vantagens?|limitacoes?|dados? tecnicos?|evidencias?).{0,35}(?:especific|suficient|confirmad|documentad)|(?:vantagem|limitacao|detalhe).{0,25}(?:a confirmar|ainda nao confirmad)/.test(text)) return false;
    if (/(caracteristicas confirmadas no anuncio|codigo do catalogo|confira medidas|confira ficha tecnica|verificar garantia|conferir condicoes de garantia|excelente relacao custo beneficio|produto identificado no anuncio|recurso tecnico confirmado|compatibilidade informada|uso adequado a categoria)/.test(text)) return false;
    // A shortened/reworded sales title is not an analysis of a benefit.
    const words = text.split(' ').filter(word => word.length > 2);
    if (words.length && words.every(word => title.split(' ').includes(word))) return false;
    seen.add(text);
    return true;
  });
}
