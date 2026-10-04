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
    const title = normalize(product.title);
    if (/repetidor|access point|ponto de acesso|starlink|satelite/.test(title)) return '';
    if (/roteador/.test(title)) return 'Roteadores';
    if (/headset.*gamer|gamer.*headset/.test(title)) return 'Headsets gamer';
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
    const terms = normalize(filters.query).split(/\s+/).filter(Boolean);
    const budget = Number(filters.budget);
    return products.filter(product =>
      terms.every(term => normalize(product.title + ' ' + product.summary + ' ' + product.category).includes(term))
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
    return items.length >= 2 && !!group(items[0]) && items.every(item => group(item) === group(items[0]));
  }
  async function mount(root, initialQuery = '') {
    if (!root || root.dataset.buyerMounted) return;
    root.dataset.buyerMounted = 'true';
    let catalog;
    try { catalog = await window.RDCPublicData.json('/search-index.json'); if (!Array.isArray(catalog.products)) throw Error('Catálogo inválido'); }
    catch { root.dataset.buyerMounted = ''; return; } // Keep existing search results if loading fails.
    const products = catalog.products.filter(product => safeProductUrl(product.url) !== '#');
    const chosen = new Map();
    let limit = 24;
    const categories = [...new Set(products.map(product => product.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    root.classList.add('buyer-tools');
    root.innerHTML = '<div class="buyer-controls"><label>Produto, marca ou modelo<input data-buyer-query type="search" placeholder="Ex.: fone Bluetooth" value="' + esc(initialQuery) + '"></label><label>Categoria<select data-buyer-category><option value="">Todas as categorias</option>' + categories.map(category=>'<option>' + esc(category) + '</option>').join('') + '</select></label><label>Preço registrado máximo (R$)<input data-buyer-budget type="number" min="0" step="0.01" inputmode="decimal" placeholder="Sem limite"></label><label class="buyer-check"><input data-buyer-recent type="checkbox"> Só preços conferidos nas últimas 24 horas</label><button type="button" data-buyer-reset>Limpar filtros</button></div><p class="buyer-help">O preço registrado pode ter mudado. Confirme preço, frete e estoque na loja. Selecione até três produtos do mesmo tipo para comparar; não atribuímos vencedor sem evidência.</p><p data-buyer-status role="status" aria-live="polite"></p><div data-buyer-comparison></div><div class="buyer-grid" data-buyer-results></div>';
    const status = root.querySelector('[data-buyer-status]');
    const results = root.querySelector('[data-buyer-results]');
    const comparison = root.querySelector('[data-buyer-comparison]');
    const renderComparison = () => {
      const selected = [...chosen.values()];
      if (!selected.length) { comparison.innerHTML = ''; return; }
      const header = selected.map(product=>'<th scope="col">' + esc(product.title) + '<br><button type="button" data-buyer-remove="' + esc(product.id) + '">Remover</button></th>').join('');
      comparison.innerHTML = '<section><h2>Comparação: ' + esc(group(selected[0])) + '</h2><p>Compare o mesmo uso e confirme as diferenças de modelo na ficha. Notas editoriais não equivalem a testes.</p><div class="buyer-table-scroll" tabindex="0" aria-label="Comparação de produtos, deslize para ver todas as colunas"><table><thead><tr><th scope="col">Critério</th>' + header + '</tr></thead><tbody>' + [['Preço e conferência',product=>priceLabel(product)],['Informações cadastradas',product=>product.summary || 'Não informado'],['Avaliação editorial',product=>Number(product.rating)>0 ? product.rating + '/5; veja os critérios na análise' : 'Não informada']].map(([label,value])=>'<tr><th scope="row">' + label + '</th>' + selected.map(product=>'<td>' + esc(value(product)) + '</td>').join('') + '</tr>').join('') + '<tr><th scope="row">Ficha completa e lojas</th>' + selected.map(product=>'<td><a href="' + esc(safeProductUrl(product.url)) + '">Ver análise e ofertas</a></td>').join('') + '</tr></tbody></table></div></section>';
    };
    const render = () => {
      const filters = {query:root.querySelector('[data-buyer-query]').value,category:root.querySelector('[data-buyer-category]').value,budget:root.querySelector('[data-buyer-budget]').value,recent:root.querySelector('[data-buyer-recent]').checked};
      const shown = filterProducts(products, filters);
      status.textContent = shown.length + ' produtos encontrados · ' + chosen.size + ' selecionados para comparar.';
      results.innerHTML = shown.slice(0, limit).map(product => '<article class="buyer-card"><a href="' + esc(safeProductUrl(product.url)) + '">' + (/^https:\/\//.test(product.image || '') ? '<img src="' + esc(product.image) + '" alt="" loading="lazy" decoding="async" width="200" height="140">' : '') + '<h3>' + esc(product.title) + '</h3></a><p>' + esc(priceLabel(product)) + '</p><a href="' + esc(safeProductUrl(product.url)) + '">Ver análise e lojas</a>' + (group(product) ? '<label class="buyer-check"><input type="checkbox" data-buyer-select="' + esc(product.id) + '"' + (chosen.has(product.id)?' checked':'') + '> Comparar · ' + esc(group(product)) + '</label>' : '<small>Sem tipo confirmado para comparação automática.</small>') + '</article>').join('') || '<p>Nenhum produto corresponde aos filtros. Tente retirar a faixa de preço ou a exigência de conferência recente.</p>';
      if (shown.length > limit) results.insertAdjacentHTML('beforeend', '<button type="button" data-buyer-more>Mostrar mais 24 produtos</button>');
      renderComparison();
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
          status.textContent = chosen.size >= 3 ? 'Limite de três produtos. Remova um para escolher outro.' : 'Escolha produtos do mesmo tipo; itens diferentes não devem disputar a mesma comparação.';
          return;
        } else chosen.set(id, product);
      }
      render();
    });
    root.addEventListener('click', event => {
      if (event.target.closest('[data-buyer-more]')) { limit += 24; render(); }
      const remove = event.target.closest('[data-buyer-remove]');
      if (remove) { chosen.delete(remove.dataset.buyerRemove); render(); }
      if (event.target.closest('[data-buyer-reset]')) {
        limit = 24;
        root.querySelector('[data-buyer-query]').value = '';
        root.querySelector('[data-buyer-category]').value = '';
        root.querySelector('[data-buyer-budget]').value = '';
        root.querySelector('[data-buyer-recent]').checked = false;
        render();
      }
    });
    render();
  }
  window.RDCBuyerTools = { filterProducts, recent, price, group, comparable, safeProductUrl, mount };
  if (typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = '.buyer-tools,.buyer-tools *{box-sizing:border-box}.buyer-tools{display:block!important}.buyer-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:12px;background:#eff8f3;border:1px solid #c8ded1;border-radius:14px;padding:16px}.buyer-controls label{font-weight:700}.buyer-controls input:not([type=checkbox]),.buyer-controls select{display:block;width:100%;min-height:44px;margin-top:6px;border:1px solid #9bb8a7;border-radius:8px;padding:8px;font:inherit;background:#fff}.buyer-controls button,.buyer-table-scroll button{min-height:44px;border:1px solid #147653;border-radius:8px;background:#fff;color:#116149;font:inherit;cursor:pointer}.buyer-check{display:flex;align-items:center;gap:8px;min-height:44px}.buyer-check input{width:18px;height:18px;flex:none}.buyer-help{font-size:.88rem;line-height:1.5;color:#53665b}.buyer-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:16px}.buyer-card{border:1px solid #dae7df;border-radius:12px;background:#fff;padding:16px;min-width:0}.buyer-card img{width:100%;object-fit:contain;height:140px}.buyer-card h3{font-size:1rem;line-height:1.4}.buyer-card p{font-size:.86rem;line-height:1.5;color:#345442}.buyer-card small{display:block;margin-top:12px}.buyer-table-scroll{overflow:auto;max-width:100%;margin-bottom:20px}.buyer-table-scroll table{width:100%;border-collapse:collapse;min-width:580px}.buyer-table-scroll th,.buyer-table-scroll td{padding:12px;vertical-align:top;border:1px solid #d7e4dc;min-width:150px;max-width:320px;font-size:.88rem;overflow-wrap:anywhere}.buyer-table-scroll th{background:#edf7f1}.buyer-tools :focus-visible{outline:3px solid #1769e0;outline-offset:2px}';
  document.head.appendChild(style);
  const start = () => {
    mount(document.querySelector('[data-buyer-catalog]'));
    const app = document.getElementById('app');
    if (!app) return;
    const query = new URLSearchParams(location.search).get('busca') || new URLSearchParams(location.search).get('q');
    const mountSearch = () => { if (query) mount(app.querySelector('.products'), query); };
    mountSearch();
    new MutationObserver(mountSearch).observe(app, { childList:true, subtree:true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
