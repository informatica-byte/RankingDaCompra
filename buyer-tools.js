(function () {
  'use strict';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(value);
  function price(product) {
    const value = Number(product.recordedPrice ?? product.price);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  function recent(product, now = Date.now()) {
    const timestamp = Date.parse(product.checkedAt || '');
    return Number.isFinite(timestamp) && now - timestamp >= 0 && now - timestamp <= 86400000 && price(product) !== null;
  }
  function group(product) {
    if (window.RDCComparisonIntegrity) return window.RDCComparisonIntegrity.label(product);
    const title = normalize(product.title);
    if (/^(?:capa|suporte|base|carregador|fonte|bateria|tela|placa[- ]mae|memoria|ssd|hd|teclado|cabo|adaptador|case|bolsa|mochila|pelicula|almofada|espuma|microfone)\b/.test(title)
      || /\b(?:capa|suporte|fonte|carregador|case|bateria|tela)\s+(?:para|de)\s+(?:notebook|laptop|roteador|fone|headphone)/.test(title)) return '';
    if (/repetidor|access point|ponto de acesso|starlink|satelite/.test(title)) return '';
    if (/roteador/.test(title)) return 'Roteadores';
    if (/^(?:notebook|laptop)\b/.test(title)) return 'Notebooks';
    if (/headset.*gamer|gamer.*headset/.test(title)) return 'Headsets gamer';
    if (/on.?ear|supra.?auricular|jbl.*tune\s*520\s*bt/.test(title)) return /bluetooth|sem fio|520\s*bt/.test(title) ? 'Fones on-ear sem fio' : 'Fones on-ear com fio';
    if (/headphone|over.?ear/.test(title)) return /bluetooth|sem fio/.test(title) ? 'Headphones sem fio' : 'Headphones com fio';
    if (/fone/.test(title) && /ear.?clip|\bows\b/.test(title)) return 'Fones abertos';
    if (/fone/.test(title) && /in.?ear|intra.?auricular|\btws\b/.test(title)) return /bluetooth|sem fio|\btws\b/.test(title) ? 'Fones intra-auriculares sem fio' : 'Fones intra-auriculares com fio';
    if (/fone|headphone|headset/.test(title)) return '';
    if (/smartwatch|relogio.*smart/.test(title)) return 'Smartwatches';
    if (/^(?:smartphone|celular|iphone)\b/.test(title)) return 'Smartphones';
    if (/power bank|carregador portatil/.test(title)) return 'Baterias portáteis';
    if (/politriz/.test(title)) return /roto.?orbital/.test(title) ? 'Politrizes roto-orbitais' : '';
    if (/mini.*compressor|compressor.*portatil/.test(title)) return 'Compressores portáteis';
    return ''; // Category alone is not evidence of equivalence.
  }
  function filterProducts(products, filters, now = Date.now()) {
    const terms = normalize(filters.query).split(/[^a-z0-9]+/).filter(Boolean);
    const budget = Number(filters.budget);
    return products.filter(product =>
      terms.every(term => normalize(product.title + ' ' + product.summary + ' ' + product.category).split(/[^a-z0-9]+/).some(word => word.startsWith(term)))
      && (!filters.category || product.category === filters.category)
      && (!(budget > 0) || (price(product) !== null && price(product) <= budget))
      && (!filters.recent || recent(product, now))
    );
  }
  function safeProductUrl(value) {
    try { const url = new URL(value, 'https://rankingdacompra.com.br/'); return url.origin === 'https://rankingdacompra.com.br' && /^\/produto\/[A-Za-z0-9_-]+\.html$/.test(url.pathname) ? url.pathname : '#'; }
    catch { return '#'; }
  }
  function dateLabel(product) {
    const date = Date.parse(product.checkedAt || '');
    return Number.isFinite(date) ? new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo'}).format(date) : 'data não informada';
  }
  function priceLabel(product) {
    return price(product) === null ? 'Preço a confirmar' : (recent(product) ? 'Conferido' : 'Registrado') + ': ' + money(price(product)) + ' · ' + dateLabel(product);
  }
  function comparable(items) {
    if (window.RDCComparisonIntegrity) return window.RDCComparisonIntegrity.comparable(items);
    return items.length >= 2 && !!group(items[0]) && items.every(item => group(item) === group(items[0]));
  }
  function comparisonFeatures(product) {
    const features = product.comparison?.features;
    if (!Array.isArray(features)) return [];
    return features.filter(feature => feature && typeof feature.label === 'string' && typeof feature.value === 'string'
      && ['yes', 'no', 'unknown'].includes(feature.state) && ['cadastro', 'fabricante'].includes(feature.basis))
      .map(feature => ({...feature, label:feature.label.slice(0, 80), value:feature.value.slice(0, 280)}));
  }
  function featureRows(products) {
    const lists = products.map(comparisonFeatures);
    // Only documented label aliases, never guessed values or equivalent IP levels.
    const key = feature => ['protecao contra agua','protecao anunciada'].includes(normalize(feature.label).trim())
      ? 'protection-announced' : 'label:' + feature.label;
    const ambiguous = new Set();
    for (const features of lists) {
      const seen = new Set();
      for (const feature of features) {
        const id = key(feature);
        if (seen.has(id)) ambiguous.add(id);
        seen.add(id);
      }
    }
    // Multiple protection fields in one record stay separate; do not discard a
    // contradiction, qualifiers or distinct sources by choosing the first one.
    const resolved = feature => ambiguous.has(key(feature)) ? 'label:' + feature.label : key(feature);
    const fields = new Map(lists.flatMap(features => features.map(feature => [resolved(feature),
      resolved(feature) === 'protection-announced' ? 'Proteção anunciada (água/poeira)' : feature.label])));
    return [...fields].map(([id,label]) => ({label, values:lists.map(features => features.find(feature => resolved(feature) === id)
      || {label, value:'Não confirmado no cadastro', state:'unknown', basis:'cadastro'})}));
  }
  function sourceUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
    catch { return ''; }
  }
  const budgetShortcuts = [100, 200, 500, 1000, 3000];
  function validBudget(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }
  function recordInteraction(action, selectedCount, budget, product) {
    // Aggregate usage only: never search terms, product URLs or Firestore writes.
    if (!['budget_shortcut', 'compare_select', 'compare_remove'].includes(action)
      || !window.RDCPrivacy?.analyticsAllowed() || typeof window.gtag !== 'function') return;
    const params = {action, selected_count:selectedCount};
    if (action === 'budget_shortcut') params.budget_limit = validBudget(budget) || 0;
    if (action !== 'budget_shortcut' && product && /^[A-Za-z0-9_-]{1,100}$/.test(String(product.id || ''))) {
      params.product_id = String(product.id);
      params.product_name = String(product.title || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0,100);
    }
    try { window.gtag('event', 'comparison_interaction', params); } catch {} // Measurement must not break filtering.
  }
  async function mount(root, initialQuery = '', searchCount = null) {
    if (!root || root.dataset.buyerMounted) return;
    root.dataset.buyerMounted = 'true';
    let catalog;
    try { catalog = await window.RDCPublicData.json('/search-index.json'); if (!Array.isArray(catalog.products)) throw Error('Catálogo inválido'); }
    catch { root.dataset.buyerMounted = ''; return; } // Keep existing search results if loading fails.
    const products = catalog.products.filter(product => safeProductUrl(product.url) !== '#');
    const chosen = new Map();
    const parameters = new URLSearchParams(window.location?.search || '');
    initialQuery = initialQuery || parameters.get('q') || '';
    const requestedId = parameters.get('produto');
    const requested = products.find(product => product.id === requestedId && group(product));
    if (requested) chosen.set(requested.id, requested);
    let limit = 24;
    const categories = [...new Set(products.map(product => product.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    root.classList.add('buyer-tools');
    root.innerHTML = '<div class="buyer-controls"><label>Produto, marca ou modelo<input data-buyer-query type="search" placeholder="Ex.: fone Bluetooth" value="' + esc(initialQuery) + '"></label><label>Categoria<select data-buyer-category><option value="">Todas as categorias</option>' + categories.map(category=>'<option>' + esc(category) + '</option>').join('') + '</select></label><label>Preço registrado máximo (R$)<input data-buyer-budget type="number" min="0" step="0.01" inputmode="decimal" placeholder="Sem limite"></label><label class="buyer-check"><input data-buyer-recent type="checkbox"> Só preços conferidos nas últimas 24 horas</label><button type="button" data-buyer-reset>Limpar filtros</button></div><p class="buyer-help">O preço registrado pode ter mudado. Confirme preço, frete e estoque na loja. Selecione até três produtos do mesmo tipo para comparar; não atribuímos vencedor sem evidência.</p><p data-buyer-status role="status" aria-live="polite"></p><div data-buyer-comparison></div><div class="buyer-grid" data-buyer-results></div>';
    const status = root.querySelector('[data-buyer-status]');
    const results = root.querySelector('[data-buyer-results]');
    const comparison = root.querySelector('[data-buyer-comparison]');
    const typeControl = document.createElement('label');
    typeControl.className = 'buyer-check buyer-same-type';
    typeControl.innerHTML = '<input data-buyer-same-type type="checkbox"' + (requested ? ' checked' : '') + '> Mostrar só alternativas do mesmo tipo selecionado';
    root.querySelector('.buyer-controls').appendChild(typeControl);
    const budgetControl = document.createElement('div');
    budgetControl.className = 'buyer-budget-shortcuts';
    budgetControl.setAttribute('role', 'group');
    budgetControl.setAttribute('aria-label', 'Atalhos de orçamento');
    budgetControl.innerHTML = '<strong>Atalhos de orçamento</strong><div>' + budgetShortcuts.map(value => '<button type="button" data-buyer-budget-shortcut="' + value + '" aria-pressed="false">Até ' + money(value) + '</button>').join('') + '<button type="button" data-buyer-budget-shortcut="" aria-pressed="true">Sem limite</button></div><small>Filtro pelo preço registrado, sem frete. Você também pode digitar outro valor no campo acima.</small>';
    root.querySelector('.buyer-controls').appendChild(budgetControl);
    const initialBudget = validBudget(parameters.get('orcamento'));
    if (initialBudget) root.querySelector('[data-buyer-budget]').value = String(initialBudget);
    const renderComparison = () => {
      const selected = [...chosen.values()];
      if (!selected.length) { comparison.innerHTML = ''; return; }
      const header = selected.map(product=>'<th scope="col">' + esc(product.title) + '<br><button type="button" data-buyer-remove="' + esc(product.id) + '">Remover</button></th>').join('');
      const features = featureRows(selected).map(row => '<tr><th scope="row">' + esc(row.label) + '</th>'
        + row.values.map(feature => '<td>' + esc(feature.value) + (feature.state !== 'unknown' ? '<small>Fonte: '
          + (feature.basis === 'fabricante' ? 'informação do fabricante' : 'informação cadastrada, não teste próprio')
          + (feature.basis === 'fabricante' && sourceUrl(feature.sourceUrl) ? ' · <a href="' + esc(sourceUrl(feature.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">Consultar fonte</a>' : '') + '</small>' : '') + '</td>').join('') + '</tr>').join('');
      comparison.innerHTML = '<section><h2>Comparação: ' + esc(group(selected[0])) + '</h2><p>' + (selected.length === 1 ? 'Produto selecionado. Marque mais uma ou duas alternativas abaixo. ' : '') + 'Comparamos informações cadastradas e do fabricante, não testes próprios. Uma característica não confirmada não é uma característica ausente.</p><div class="buyer-table-scroll" tabindex="0" aria-label="Comparação de produtos, deslize para ver todas as colunas"><table><thead><tr><th scope="col">Critério</th>' + header + '</tr></thead><tbody>' + '<tr><th scope="row">Preço e conferência</th>' + selected.map(product=>'<td>' + esc(priceLabel(product)) + '</td>').join('') + '</tr>' + features + [['Limite da confirmação',product=>comparisonFeatures(product).some(f=>f.basis==='fabricante' && sourceUrl(f.sourceUrl)) ? 'Veja as fontes de fabricante nos campos documentados. Os demais dados ainda precisam de confirmação.' : 'Sem especificações técnicas confirmadas por fonte de fabricante nesta revisão. Consulte a ficha e o vendedor.']].map(([label,value])=>'<tr><th scope="row">' + label + '</th>' + selected.map(product=>'<td>' + esc(value(product)) + '</td>').join('') + '</tr>').join('') + '<tr><th scope="row">Ficha completa e lojas</th>' + selected.map(product=>'<td><a href="' + esc(safeProductUrl(product.url)) + '">Ver análise e ofertas</a></td>').join('') + '</tr></tbody></table></div></section>';
    };
    const rememberFocus = () => {
      const active = document.activeElement;
      if (!active || !root.contains(active)) return null;
      if (active.dataset?.buyerSelect) return {kind:'select', id:active.dataset.buyerSelect};
      if (active.dataset?.buyerRemove) return {kind:'remove', id:active.dataset.buyerRemove,
        index:[...comparison.querySelectorAll('[data-buyer-remove]')].indexOf(active)};
      if (active.hasAttribute('data-buyer-more')) return {kind:'more', count:results.querySelectorAll('.buyer-card').length};
      return null; // Filter inputs are not replaced and keep their own focus.
    };
    const restoreFocus = token => {
      if (!token) return;
      let target;
      if (token.kind === 'more') target = results.querySelectorAll('.buyer-card')[token.count]?.querySelector('a')
        || results.querySelector('[data-buyer-more]');
      else if (token.kind === 'remove') {
        const buttons = [...comparison.querySelectorAll('[data-buyer-remove]')];
        target = buttons[Math.min(Math.max(token.index, 0), buttons.length - 1)];
      }
      if (!target && token.id) target = [...results.querySelectorAll('[data-buyer-select]')]
        .find(input => input.dataset.buyerSelect === token.id);
      (target || root.querySelector('[data-buyer-query]')).focus();
    };
    const render = () => {
      const focus = rememberFocus();
      const filters = {query:root.querySelector('[data-buyer-query]').value,category:root.querySelector('[data-buyer-category]').value,budget:root.querySelector('[data-buyer-budget]').value,recent:root.querySelector('[data-buyer-recent]').checked};
      const sameType = root.querySelector('[data-buyer-same-type]').checked && chosen.size ? group([...chosen.values()][0]) : '';
      const shown = filterProducts(products, filters).filter(product => !sameType || group(product) === sameType);
      for (const button of budgetControl.querySelectorAll('[data-buyer-budget-shortcut]')) button.setAttribute('aria-pressed', String((validBudget(filters.budget) || '') === (validBudget(button.dataset.buyerBudgetShortcut) || '')));
      status.textContent = shown.length + ' produtos encontrados · ' + chosen.size + ' selecionados para comparar.';
      if (searchCount) searchCount.textContent = shown.length + (shown.length === 1 ? ' produto encontrado' : ' produtos encontrados') + ' no catálogo publicado.';
      results.innerHTML = shown.slice(0, limit).map(product => '<article class="buyer-card"><a href="' + esc(safeProductUrl(product.url)) + '">' + (/^https:\/\//.test(product.image || '') ? '<img src="' + esc(product.image) + '" alt="" loading="lazy" decoding="async" width="200" height="140">' : '') + '<h3>' + esc(product.title) + '</h3></a><p>' + esc(priceLabel(product)) + '</p><a href="' + esc(safeProductUrl(product.url)) + '">Ver análise e lojas</a>' + (group(product) ? '<label class="buyer-check"><input type="checkbox" data-buyer-select="' + esc(product.id) + '"' + (chosen.has(product.id)?' checked':'') + '> Comparar · ' + esc(group(product)) + '</label>' : '<small>Sem tipo confirmado para comparação automática.</small>') + '</article>').join('') || '<p>Nenhum produto corresponde aos filtros. Tente retirar a faixa de preço ou a exigência de conferência recente.</p>';
      if (shown.length > limit) results.insertAdjacentHTML('beforeend', '<button type="button" data-buyer-more>Mostrar mais 24 produtos</button>');
      renderComparison();
      restoreFocus(focus);
    };
    root.addEventListener('input', event => { if (event.target.matches('[data-buyer-query],[data-buyer-budget]')) { limit = 24; render(); } });
    root.addEventListener('change', event => {
      const id = event.target.dataset.buyerSelect;
      if (!id) limit = 24;
      if (id) {
        const product = products.find(item=>item.id === id);
        if (!event.target.checked) chosen.delete(id);
        else if (!product || chosen.size >= 3 || (chosen.size && !comparable([...chosen.values(), product]))) {
          event.target.checked = false;
          status.textContent = chosen.size >= 3 ? 'Limite de três produtos. Remova um para escolher outro.' : 'Escolha modelos distintos do mesmo tipo. Outra cor do mesmo modelo não é uma alternativa diferente.';
          return;
        } else chosen.set(id, product);
        recordInteraction(event.target.checked ? 'compare_select' : 'compare_remove', chosen.size, undefined, product);
      }
      render();
    });
    root.addEventListener('click', event => {
      const shortcut = event.target.closest('[data-buyer-budget-shortcut]');
      if (shortcut && (shortcut.dataset.buyerBudgetShortcut === '' || budgetShortcuts.includes(Number(shortcut.dataset.buyerBudgetShortcut)))) {
        root.querySelector('[data-buyer-budget]').value = shortcut.dataset.buyerBudgetShortcut;
        limit = 24;
        render();
        recordInteraction('budget_shortcut', chosen.size, shortcut.dataset.buyerBudgetShortcut);
      }
      if (event.target.closest('[data-buyer-more]')) { limit += 24; render(); }
      const remove = event.target.closest('[data-buyer-remove]');
      if (remove) { const product = chosen.get(remove.dataset.buyerRemove); chosen.delete(remove.dataset.buyerRemove); render(); recordInteraction('compare_remove', chosen.size, undefined, product); }
      if (event.target.closest('[data-buyer-reset]')) {
        limit = 24;
        root.querySelector('[data-buyer-query]').value = '';
        root.querySelector('[data-buyer-category]').value = '';
        root.querySelector('[data-buyer-budget]').value = '';
        root.querySelector('[data-buyer-recent]').checked = false;
        root.querySelector('[data-buyer-same-type]').checked = false;
        render();
      }
    });
    render();
  }
  window.RDCBuyerTools = { filterProducts, recent, price, group, comparable, safeProductUrl, comparisonFeatures, featureRows, mount };
  if (typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = '.buyer-tools,.buyer-tools *{box-sizing:border-box}.buyer-tools{display:block!important}.buyer-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:12px;background:#eff8f3;border:1px solid #c8ded1;border-radius:14px;padding:16px}.buyer-controls label{font-weight:700}.buyer-controls input:not([type=checkbox]),.buyer-controls select{display:block;width:100%;min-height:44px;margin-top:6px;border:1px solid #9bb8a7;border-radius:8px;padding:8px;font:inherit;background:#fff}.buyer-controls button,.buyer-table-scroll button{min-height:44px;border:1px solid #147653;border-radius:8px;background:#fff;color:#116149;font:inherit;cursor:pointer}.buyer-check{display:flex;align-items:center;gap:8px;min-height:44px}.buyer-check input{width:18px;height:18px;flex:none}.buyer-help{font-size:.88rem;line-height:1.5;color:#53665b}.buyer-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:16px}.buyer-card{border:1px solid #dae7df;border-radius:12px;background:#fff;padding:16px;min-width:0}.buyer-card img{width:100%;object-fit:contain;height:140px}.buyer-card h3{font-size:1rem;line-height:1.4}.buyer-card p{font-size:.86rem;line-height:1.5;color:#345442}.buyer-card small{display:block;margin-top:12px}.buyer-table-scroll{overflow:auto;max-width:100%;margin-bottom:20px}.buyer-table-scroll table{width:100%;border-collapse:collapse;min-width:580px}.buyer-table-scroll th,.buyer-table-scroll td{padding:12px;vertical-align:top;border:1px solid #d7e4dc;min-width:150px;max-width:320px;font-size:.88rem;overflow-wrap:anywhere}.buyer-table-scroll th{background:#edf7f1}.buyer-tools :focus-visible{outline:3px solid #1769e0;outline-offset:2px}';
  document.head.appendChild(style);
  style.textContent += '.buyer-table-scroll td small{display:block;margin-top:6px;color:#53665b;font-size:.76rem}.buyer-same-type{grid-column:1/-1}';
  style.textContent += '.buyer-budget-shortcuts{grid-column:1/-1;min-width:0}.buyer-budget-shortcuts>div{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.buyer-budget-shortcuts button{padding:8px 12px}.buyer-budget-shortcuts button[aria-pressed=true]{background:#116149;color:#fff}.buyer-budget-shortcuts small{display:block;line-height:1.5}.buyer-controls{grid-template-columns:repeat(auto-fit,minmax(min(100%,185px),1fr))}';
  const start = () => {
    mount(document.querySelector('[data-buyer-catalog]'));
    const app = document.getElementById('app');
    if (!app) return;
    const query = new URLSearchParams(location.search).get('busca') || new URLSearchParams(location.search).get('q');
    const mountSearch = () => { if (query) mount(app.querySelector('.products'), query, app.querySelector('[data-search-count]')); };
    mountSearch();
    new MutationObserver(mountSearch).observe(app, { childList:true, subtree:true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
