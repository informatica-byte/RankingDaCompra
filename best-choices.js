(function () {
  'use strict';
  const DEFAULT_TITLE = 'Melhores escolhas e rankings de produtos';
  const PAGE = 'melhores-escolhas.html', MAX_PRODUCTS = 12, MAX_GUIDES = 6;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function money(value) {
    const raw = String(value ?? '').replace(/R\$|\s/g,'');
    const number = Number(raw.includes(',') ? raw.replace(/\./g,'').replace(',','.') : raw);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }
  function millis(value) {
    if (value?.toMillis) return value.toMillis();
    if (value?.seconds) return Number(value.seconds)*1000;
    return Date.parse(value || '');
  }
  function eligible(product) {
    return product && /^[A-Za-z0-9_-]+$/.test(String(product.id || '')) && product.sistema !== true
      && product.ativo !== false && product.indisponivel !== true && product.status !== 'indisponivel'
      && String(product.titulo || '').trim() && /^https:\/\//.test(String(product.foto || ''));
  }
  function legacyIds(products) {
    return products.filter(p => eligible(p) && p.promocaoAtiva === true && p.ofertaRelampagoAtiva !== true)
      .sort((a,b) => String(b.promocaoValidaAte || '').localeCompare(String(a.promocaoValidaAte || ''))
        || Number(a.ranking || 9999)-Number(b.ranking || 9999) || String(a.id).localeCompare(String(b.id)))
      .slice(0,6).map(p=>String(p.id));
  }
  function selectProducts(products = [], config = {}) {
    const available = new Map(products.filter(eligible).map(p=>[String(p.id),p]));
    const ids = Array.isArray(config.bestChoicesProductIds) ? config.bestChoicesProductIds : legacyIds(products);
    return [...new Set(ids)].slice(0,MAX_PRODUCTS).map(id=>available.get(String(id))).filter(Boolean);
  }
  function selectGuides(guides = [], config = {}) {
    const available = new Map(guides.filter(g=>/^melhores-[a-z0-9-]+\.html$/.test(g.url) && g.url !== PAGE).map(g=>[g.url,g]));
    const urls = Array.isArray(config.bestChoicesGuideUrls) ? config.bestChoicesGuideUrls : guides.slice(0,3).map(g=>g.url);
    return [...new Set(urls)].slice(0,MAX_GUIDES).map(url=>available.get(url)).filter(Boolean);
  }
  function seedConfig(config, products, guides) {
    return {...config,
      bestChoicesTitle: typeof config.bestChoicesTitle === 'string' ? config.bestChoicesTitle : DEFAULT_TITLE,
      bestChoicesProductIds: Array.isArray(config.bestChoicesProductIds) ? config.bestChoicesProductIds : legacyIds(products),
      bestChoicesGuideUrls: Array.isArray(config.bestChoicesGuideUrls) ? config.bestChoicesGuideUrls : guides.slice(0,3).map(g=>g.url)};
  }
  function priceState(product, status = {}, now = Date.now()) {
    if (product.anuncioSubstituidoEm && !(millis(status?.checkedAt) > millis(product.anuncioSubstituidoEm))) status = {};
    status=status || {};
    const flash = product.ofertaRelampagoAtiva === true && Date.parse(product.ofertaRelampagoTerminaEm || '') > now;
    const end = product.promocaoValidaAte ? Date.parse(String(product.promocaoValidaAte).slice(0,10)+'T23:59:59-03:00') : Infinity;
    const promo = product.promocaoAtiva === true && end >= now;
    const manualPrice = money((flash || promo) && money(product.precoAnterior)>money(product.precoPromocional) ? product.precoPromocional : product.preco);
    const manualAt = millis(product.precoAtualizadoManualmenteEm), apiAt = millis(status.checkedAt), apiPrice = money(status.price);
    const recent = time => Number.isFinite(time) && now-time >= 0 && now-time <= 86400000;
    const manualOk = product.precoAtualizadoManualmente === true && manualPrice>0 && recent(manualAt);
    const apiOk = status.managed === true && status.status === 'active' && status.available === true && status.visible !== false && !status.lastError && apiPrice>0 && recent(apiAt);
    if (manualOk && (!apiOk || manualAt>=apiAt)) return {value:manualPrice,at:manualAt,confirmed:true,source:'manual'};
    if (apiOk) return {value:apiPrice,at:apiAt,confirmed:true,source:'api'};
    if (product.precoAtualizadoManualmente === true && manualPrice>0 && Number.isFinite(manualAt) && manualAt<=now && (!Number.isFinite(apiAt)||manualAt>=apiAt))
      return {value:manualPrice,at:manualAt,confirmed:false,source:'manual'};
    if (apiPrice>0 && Number.isFinite(apiAt) && apiAt<=now) return {value:apiPrice,at:apiAt,confirmed:false,source:'api'};
    return {value:money(product.preco),at:null,confirmed:false,source:'cadastro'};
  }
  function title(value, products = [], validator, statuses = {}, now = Date.now()) {
    return validator?.checkChoices ? validator.checkChoices(value,products.map(p=>{
      const price=priceState(p,statuses[String(p.id)],now);
      return {titulo:p.titulo,preco:price.confirmed?price.value:0};
    })).title : DEFAULT_TITLE;
  }
  function productUrl(product) {
    return '/produto/'+encodeURIComponent(product.id)+'-20260810-1.html';
  }
  function guideCards(guides) {
    return '<nav class="best-guide-grid" aria-label="Rankings e comparativos por categoria">'+guides.map(g=>'<a class="best-guide-card" href="/'+esc(g.url)+'"><span>Comparativo da categoria</span><h3>'+esc(g.title)+'</h3><p>'+esc(g.summary)+'</p><strong>Ver critérios, diferenças e limitações →</strong></a>').join('')+'</nav>';
  }
  function productCards(products, statuses = {}, now = Date.now()) {
    return products.map(p=>{
      const state=priceState(p,statuses[String(p.id)],now), date=state.at ? new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(state.at) : '';
      const amount=state.value>0 ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(state.value) : '';
      const label=state.confirmed ? amount : amount ? 'Último preço '+(date?'registrado':'cadastrado')+': '+amount : 'Confira o preço no vendedor';
      const summary=String(p.comentario || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
      const excerpt=summary.length>175 ? summary.slice(0,172).replace(/\s+\S*$/,'')+'…' : summary;
      return '<article class="deal-card best-product-card"><img loading="lazy" decoding="async" width="260" height="154" src="'+esc(p.foto)+'" alt="'+esc(p.titulo)+'"><div class="deal-check">'+(state.confirmed?'✓ Preço conferido recentemente':'Preço aguardando nova conferência')+'</div><h3>'+esc(p.titulo)+'</h3><p class="best-product-summary">'+esc(excerpt)+'</p><div class="deal-prices"><span class="deal-price">'+esc(label)+'</span></div><p class="deal-validity">'+esc(date?(state.confirmed?'Preço conferido em ':'Último registro em ')+date:'Confirme preço e disponibilidade no vendedor')+'</p><div class="deal-actions"><a class="button offer-button" href="'+productUrl(p)+'" data-promo-id="'+esc(p.id)+'" data-product-id="'+esc(p.id)+'" data-product-title="'+esc(p.titulo)+'" data-product-category="'+esc(p.categoria)+'">Ver análise e conferir preço</a><div class="deal-secondary-actions"><button class="share-deal-button" type="button" data-share-product="'+esc(p.id)+'" aria-label="Compartilhar análise de '+esc(p.titulo)+'">↗ Compartilhar</button></div></div></article>';
    }).join('');
  }
  function mergeCatalogues(published = [], live = []) {
    const combined = new Map(published.map(p => [String(p.id), {...p}]));
    for (const p of live) combined.set(String(p.id), {...combined.get(String(p.id)), ...p});
    return [...combined.values()].filter(eligible).sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), 'pt-BR'));
  }
  const api={DEFAULT_TITLE,PAGE,MAX_PRODUCTS,MAX_GUIDES,esc,normalize,money,eligible,legacyIds,selectProducts,selectGuides,seedConfig,priceState,title,productUrl,guideCards,productCards,mergeCatalogues};
  if (typeof module!=='undefined'&&module.exports) module.exports=api; else window.RDCBestChoices=api;
})();
