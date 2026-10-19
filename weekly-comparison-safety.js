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
  function productPrice(product, now = Date.now()) {
    const discount = price(product?.precoPromocional);
    const flash = product?.ofertaRelampagoAtiva === true;
    const rawDeadline = flash ? product?.ofertaRelampagoTerminaEm : product?.promocaoValidaAte;
    const deadline = typeof rawDeadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDeadline)
      ? rawDeadline + 'T23:59:59.999-03:00' : rawDeadline;
    const end = deadline && typeof deadline.toMillis === 'function' ? deadline.toMillis()
      : deadline && Number.isFinite(deadline.seconds) ? deadline.seconds * 1000 : Date.parse(deadline || '');
    const startValue = product?.ofertaRelampagoComecaEm;
    const start = startValue && typeof startValue.toMillis === 'function' ? startValue.toMillis()
      : startValue && Number.isFinite(startValue.seconds) ? startValue.seconds * 1000 : Date.parse(startValue || '');
    const active = (flash ? end > now && (!startValue || (Number.isFinite(start) && start <= now))
      : product?.promocaoAtiva === true && (!deadline || end >= now))
      && price(product?.precoAnterior) > discount;
    return active && discount > 0 ? discount : price(product?.preco) || price(product?.precoAtual);
  }
  function editorialTextAllowed(value) {
    return !/(n[oó]s testamos|testamos o produto|vendas comprovadas|o mais vendido|pesquisa em toda a internet|garante resultados|melhor geral|melhor custo[- ]benef[íi]cio|maior alcance|excelente estabilidade)/i.test(String(value || ''));
  }
  function family(product) {
    // Só o tipo do próprio título decide a família. Uma ressalva mencionando
    // outro equipamento na descrição não muda a identidade deste produto.
    const title = normalize(product?.titulo || product?.title);
    if (/^(?:(?:kit|conjunto)\s+(?:de\s+)?)?(?:suporte|capa|pelicula|carregador|adaptador)\b/.test(title)) return '';
    if (/starlink|internet.*satelite/.test(title)) return 'satellite';
    if (/repetidor|extensor.*wi.?fi/.test(title)) return 'repeater';
    if (/access point|ponto de acesso/.test(title)) return 'access-point';
    if (/roteador|router|sistema mesh/.test(title)) return /\bmesh\b/.test(title) ? 'router-mesh' : 'router';
    if (/open.?ear|orelha aberta|\bows\b|ear.?clip/.test(title)) return 'open-ear';
    if (/caixa de som|speaker|soundbar/.test(title)) return '';
    if (/soundcore.*\bp30i\b/.test(title)) return 'earbuds-tws';
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
  function specificEvidence(values, title = '') {
    const list = (Array.isArray(values) ? values : [values]).flatMap(value => String(value || '').split(/\n|;|,\s+|\.(?:\s+|$)/));
    const productTitle = normalize(title);
    return [...new Set(list.map(value => value.trim()).filter(value => {
      const text = normalize(value);
      if (text.length < 18 || text === productTitle) return false;
      return !/(faltam|falta de|a confirmar|nao (?:traz|detalha|descreve)|ainda nao|sem (?:dados|informacao|evidencia)|confirm(?:e|ar)|verific(?:ar|que)|diretrizes do fabricante|compatibilidade dos dispositivos|custo.beneficio|alta performance|maior alcance|facil instalacao|excelente estabilidade)/.test(text);
    }))];
  }
  function demandValue(product) {
    const count = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    return count(product?.clicks ?? product?.cliques) * 4 + count(product?.views ?? product?.visitas);
  }
  function demandSample(products) {
    return (Array.isArray(products) ? products : []).reduce((total, product) => total + demandValue(product), 0);
  }
  function demandScore(clicks, views, maximum, sample = maximum) {
    const raw = demandValue({ clicks, views });
    // Sinais escassos são neutros: uma única visita não comprova procura.
    // O quarto argumento considera o conjunto; chamadas antigas de três argumentos continuam válidas.
    if (!(sample >= 20) || !(maximum > 0)) return 60;
    return Math.min(100, 60 + (Math.log1p(raw) / Math.log1p(maximum)) * 40);
  }
  function ratingEvidence(product) {
    const value = price(product?.nota ?? product?.rating ?? product?.avaliacao);
    const source = String(product?.avaliacaoFonte || product?.notaFonte || product?.ratingSource || '').trim();
    const count = Number(product?.avaliacaoQuantidade ?? product?.notaQuantidade ?? product?.ratingCount ?? product?.reviewCount);
    let sourceValid = false;
    try { sourceValid = new URL(source).protocol === 'https:'; } catch {}
    const verified = (product?.avaliacaoVerificada === true || product?.ratingVerified === true)
      && sourceValid && Number.isInteger(count) && count > 0 && value > 0 && value <= 5;
    return { verified, value: verified ? value : 0, source: verified ? source : '', count: verified ? count : 0 };
  }
  function selectionTitle(value) {
    return String(value || '').replace(/\bmelhores?\b/gi, 'opções de')
      .replace(/custo[- ]benef[íi]cio/gi, 'preços e perfis')
      .replace(/\b(?:ranking|top)\b/gi, 'Seleção').trim();
  }
  function signature(products) {
    const entries = (Array.isArray(products) ? products : []).map(product => [
      String(product.id || ''), family(product), normalize(product.titulo || product.title),
      Math.round(price(product.preco ?? product.price ?? product.recordedPrice) * 100),
    ].join('|')).sort();
    return 'v1:' + entries.join('~');
  }
  function modelKey(product) {
    const title = normalize(product?.titulo || product?.title);
    if (/redmi.*buds\s*6\s*play/.test(title)) return 'xiaomi-redmi-buds-6-play';
    if (/soundcore.*\bp30i\b/.test(title)) return 'soundcore-p30i';
    if (/galaxy.*buds\s*core/.test(title)) return 'samsung-galaxy-buds-core';
    return title.replace(/\b(preto|preta|branco|branca|azul|rosa|verde|black|white|blue)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function distinctModels(products) {
    const seen = new Set();
    return products.filter(product => {
      const key = modelKey(product);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  const DOCUMENTED_TWS = [
    {id:'ARscPKCMZs3D8k22qltl', model:'xiaomi-redmi-buds-6-play', name:'Redmi Buds 6 Play',
      anc:'ANC para ouvir: não confirmado nesta revisão; redução de ruído nas chamadas é outra função.',
      battery:'Até 7,5 h nos fones; até 36 h incluindo recargas no estojo, segundo a Xiaomi.',
      profile:'Para comparar um TWS com menor preço registrado nesta seleção, sem presumir ANC.',
      limit:'Conforto, áudio, chamadas e autonomia real não foram testados.',
      source:'https://www.mi.com/global/product/redmi-buds-6-play/'},
    {id:'5bQKU9inL3pq14yE8K4L', model:'soundcore-p30i', name:'soundcore P30i',
      anc:'ANC e modo transparência anunciados pela soundcore.',
      battery:'Até 10 h nos fones; até 45 h com recargas no estojo. São limites anunciados, não medições próprias; ANC e uso afetam a duração.',
      profile:'Para quem procura ANC e estojo que também funciona como apoio para o celular.',
      limit:'Não classificamos a eficácia do ANC nem a qualidade do áudio sem testes.',
      source:'https://www.soundcore.com/products/soundcore-p30i'},
    {id:'FlqPY3yHJ2xPoNgnhSTE', model:'samsung-galaxy-buds-core', name:'Galaxy Buds Core',
      anc:'ANC anunciado pela Samsung.',
      battery:'Total com estojo: até 35 h com ANC desligado ou aproximadamente 20 h com ANC ligado. Duração de uma carga dos fones não confirmada nesta revisão.',
      profile:'Para comparar ANC e integração com aparelhos Galaxy; confira recursos compatíveis com seu celular.',
      limit:'Funções Galaxy AI dependem de smartphone Galaxy compatível; os fones não traduzem de forma independente.',
      source:'https://news.samsung.com/br/samsung-anuncia-galaxy-buds-core-no-brasil-cancelamento-de-ruido-e-integracao-com-galaxy-ai-para-todos'}
  ];
  function documentedDraft(index, now = Date.now()) {
    const products = DOCUMENTED_TWS.map((fact, i) => {
      const product = (index?.products || []).find(p => p.id === fact.id);
      if (!product || modelKey(product) !== fact.model) throw Error('Modelo documentado ausente ou alterado: ' + fact.name);
      return {id:product.id, titulo:product.title, preco:price(product.price), foto:product.image || '', productUrl:product.url,
        position:i + 1, motivo:fact.profile, comparisonFamily:'earbuds-tws'};
    });
    const draft = {versao:5, modoEditorial:'documental', publicado:false, semana:weekKey(now),
      titulo:'Redmi Buds 6 Play, soundcore P30i e Galaxy Buds Core: recursos e preços',
      termo:'Fones TWS intra-auriculares', precoMaximo:'', familiaComparavel:'earbuds-tws',
      comparabilidadeRevisada:true, revisadoEm:new Date(now).toISOString(), produtos:products,
      assinaturaEditorial:signature(products)};
    const result = reconcile(draft, index, now);
    if (result.needsReview) throw Error('Revisão documental aguarda: ' + result.reasons.join(', '));
    return draft;
  }
  function documentaryMarkup(config, products) {
    return documentaryContent(config, products)
      .replace('class="weekly-ranking-grid"', 'class="weekly-ranking-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:16px"')
      .replaceAll('style="min-width:0;overflow-wrap:anywhere"', 'style="min-width:0;overflow-wrap:anywhere;border:1px solid #cfe1d8;background:#fff;padding:16px;border-radius:14px"');
  }
  function documentaryContent(config, products) {
    const esc = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const facts = products.map(p => DOCUMENTED_TWS.find(f => f.id === p.id && f.model === modelKey(p)));
    if (products.length !== 3 || facts.some(f => !f)) return '';
    const money = new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'});
    return '<div class="weekly-comparison-head"><div><small>COMPARATIVO DOCUMENTAL · SEMANA DE ' + esc(config.semana) + '</small><h2>' + esc(config.titulo) + '</h2><p>Três modelos TWS intra-auriculares distintos, sem repetir cores. Não realizamos testes de áudio, conforto ou bateria.</p></div></div>'
      + '<div class="weekly-ranking-grid">' + products.map((p,i) => '<article class="weekly-ranking-card" style="min-width:0;overflow-wrap:anywhere"><h3>' + esc(facts[i].name) + '</h3><img src="' + esc(p.foto) + '" alt="' + esc(facts[i].name) + '" loading="lazy" style="width:100%;height:150px;object-fit:contain"><p><b>' + esc(money.format(p.preco)) + '</b> · preço registrado em ' + esc(p.precoConferidoEm ? new Date(p.precoConferidoEm).toLocaleDateString('pt-BR') : config.revisadoEm?.slice(0,10)) + '</p><p><b>ANC:</b> ' + esc(facts[i].anc) + '</p><p><b>Autonomia anunciada:</b> ' + esc(facts[i].battery) + '</p><p><b>Perfil:</b> ' + esc(facts[i].profile) + '</p><p><b>Atenção:</b> ' + esc(facts[i].limit) + '</p><p><a href="' + esc(facts[i].source) + '" target="_blank" rel="noopener">Fonte do fabricante</a></p><a href="' + esc(p.productUrl) + '">Ver análise e preço atual</a></article>').join('') + '</div><p class="weekly-ranking-method">Comparação de documentação, não ranking de qualidade. Totais com estojo incluem recargas, não uso contínuo. Os fabricantes usam condições de teste diferentes; os números não comprovam superioridade em uso real. Preço, frete e estoque podem mudar. Podemos receber comissão por compras pelos links, sem custo adicional.</p>';
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
    if (new Set(products.map(modelKey)).size !== products.length) reasons.push('duplicate-model');
    if (products.some(product => !product.precoConfirmado)) reasons.push('awaiting-price-confirmation');
    if (String(config?.semana || '') !== weekKey(now)) reasons.push('previous-week');
    if (config?.comparabilidadeRevisada !== true) reasons.push('editorial-review-required');
    if (String(config?.assinaturaEditorial || '') !== currentSignature) reasons.push('changed-editorial-basis');
    return { products, groups, missing, comparable, signature: currentSignature, needsReview: reasons.length > 0, reasons };
  }
  return { family, groupCandidates, specificEvidence, demandValue, demandSample, demandScore, ratingEvidence, selectionTitle, signature, reconcile, weekKey, price, productPrice, editorialTextAllowed, modelKey, distinctModels, documentedDraft, documentaryMarkup };
});
