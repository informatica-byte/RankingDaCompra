(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RDCWeeklyComparisonSafety = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const LABELS = {
    'router': 'Roteadores tradicionais', 'router-mesh': 'Sistemas Mesh',
    'repeater': 'Repetidores Wi-Fi', 'access-point': 'Access points', 'satellite': 'Internet via satélite',
    'earbuds-tws': 'Fones TWS', 'headphone': 'Headphones', 'wired-earphone': 'Fones com fio',
    'book': 'Livros', 'rc-vehicle': 'Veículos de controle remoto', 'building-blocks': 'Blocos de montar',
    'math-cubes': 'Cubos matemáticos', 'drone': 'Drones', 'notebook': 'Notebooks',
    'tablet': 'Tablets', 'smartphone': 'Celulares', 'air-fryer': 'Air fryers',
    'printer': 'Impressoras', 'body-splash': 'Body splash', 'perfume': 'Perfumes',
  };
  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function price(value) {
    const raw = String(value ?? '').replace(/R\$|\s/g, '');
    const parsed = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
    return raw && Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  function family(product) {
    // Só o tipo do próprio título decide a família. Uma ressalva mencionando
    // outro equipamento na descrição não muda a identidade deste produto.
    const title = normalize(product?.titulo || product?.title);
    if (/\b(?:suporte|capa|pelicula|carregador|adaptador)\b/.test(title)) return '';
    if (/starlink|internet.*satelite/.test(title)) return 'satellite';
    if (/repetidor|extensor.*wi.?fi/.test(title)) return 'repeater';
    if (/access point|ponto de acesso/.test(title)) return 'access-point';
    if (/roteador|router|sistema mesh/.test(title)) return /\bmesh\b/.test(title) ? 'router-mesh' : 'router';
    if (/\btws\b|true wireless|earbuds|\bbuds\b/.test(title)) return 'earbuds-tws';
    if (/headphone|headset|over.?ear|on.?ear/.test(title)) return 'headphone';
    if (/fone.*(?:com fio|p2|3[.,]5mm)/.test(title)) return 'wired-earphone';
    if (/\blivro|biblioteca/.test(title)) return 'book';
    if (/\bdrone/.test(title)) return 'drone';
    if (/(?:carro|carrinho|veiculo).*(?:controle remoto|\brc\b)/.test(title)) return 'rc-vehicle';
    if (/numberblocks|cubos? matematic/.test(title)) return 'math-cubes';
    if (/blocos? de montar|brastoy|\blego\b/.test(title)) return 'building-blocks';
    if (/\bnotebook|\bvivobook|\bmacbook/.test(title)) return 'notebook';
    if (/\btablet/.test(title)) return 'tablet';
    if (/smartphone|\bcelular|\biphone/.test(title)) return 'smartphone';
    if (/air.?fryer|fritadeira.*(?:ar|eletrica)/.test(title)) return 'air-fryer';
    if (/\bimpressora/.test(title)) return 'printer';
    if (/body splash/.test(title)) return 'body-splash';
    if (/\bperfume|eau de parfum|eau de toilette/.test(title)) return 'perfume';
    return '';
  }
  function groupCandidates(products) {
    const groups = new Map();
    for (const product of Array.isArray(products) ? products : []) {
      const key = family(product);
      const groupKey = key || 'unknown:' + String(product?.id || groups.size);
      if (!groups.has(groupKey)) groups.set(groupKey, { family: key, label: LABELS[key] || 'Tipo a confirmar', products: [] });
      groups.get(groupKey).products.push(product);
    }
    return [...groups.values()].sort((a, b) => b.products.length - a.products.length || a.label.localeCompare(b.label, 'pt-BR'));
  }
  function signature(products) {
    const entries = (Array.isArray(products) ? products : []).map(product => [
      String(product.id || ''), family(product), normalize(product.titulo || product.title),
      Math.round(price(product.preco ?? product.price ?? product.recordedPrice) * 100),
    ].join('|')).sort();
    return 'v1:' + entries.join('~');
  }
  function weekKey(now) {
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
    const date = new Date(local + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() || 7) + 1);
    return date.toISOString().slice(0, 10);
  }
  function reconcile(config, index, now = Date.now()) {
    const current = new Map((Array.isArray(index?.products) ? index.products : []).map(product => [String(product.id), product]));
    const stored = Array.isArray(config?.produtos) ? config.produtos.slice(0, 5) : [];
    const missing = [], products = [], seen = new Set();
    for (const item of stored) {
      const id = String(item?.id || '');
      const published = current.get(id);
      if (!published || seen.has(id)) { missing.push(id); continue; }
      seen.add(id);
      const checkedAt = Date.parse(published.checkedAt || '');
      const confirmed = price(published.price) > 0 && Number.isFinite(checkedAt) && now - checkedAt >= 0 && now - checkedAt <= 86400000;
      products.push({
        ...item, id, titulo: String(published.title || published.titulo || ''),
        categoria: String(published.categoryId || published.categoria || ''),
        foto: String(published.image || published.foto || ''), productUrl: String(published.url || published.productUrl || ''),
        preco: price(published.price ?? published.recordedPrice), precoConfirmado: confirmed,
        precoConferidoEm: Number.isFinite(checkedAt) ? new Date(checkedAt).toISOString() : '',
      });
    }
    const groups = groupCandidates(products);
    const comparable = products.length >= 3 && products.length <= 5 && groups.length === 1 && !!groups[0].family;
    const currentSignature = signature(products);
    const reasons = [];
    if (missing.length) reasons.push('missing-products');
    if (!comparable) reasons.push('incompatible-or-insufficient-products');
    if (products.some(product => !product.precoConfirmado)) reasons.push('awaiting-price-confirmation');
    if (String(config?.semana || '') !== weekKey(now)) reasons.push('previous-week');
    if (config?.comparabilidadeRevisada !== true) reasons.push('editorial-review-required');
    if (String(config?.assinaturaEditorial || '') !== currentSignature) reasons.push('changed-editorial-basis');
    return { products, groups, missing, comparable, signature: currentSignature, needsReview: reasons.length > 0, reasons };
  }
  return { family, groupCandidates, signature, reconcile, weekKey, price };
});
