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
