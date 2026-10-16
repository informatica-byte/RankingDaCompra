(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RDCExistingFlashOffer = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  const WORKFLOW = 'https://github.com/informatica-byte/RankingDaCompra/actions/workflows/update-sitemap.yml';
  const GUARDED_FIELDS = ['titulo', 'link', 'linkAfiliado', 'marketplace', 'foto', 'preco', 'precoAnterior', 'precoPromocional', 'promocaoAtiva', 'promocaoValidaAte', 'ofertaRelampagoAtiva', 'ofertaRelampagoComecaEm', 'ofertaRelampagoTerminaEm', 'conferenciaPausada', 'indisponivel', 'ativo', 'anuncioSubstituidoEm', 'precoAtualizadoManualmenteEm', 'precoConferenciaCampo', 'precoConferenciaValor', 'precoConferenciaId'];
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const money = value => Number(value).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  function safeUrl(value) {
    try { const url = new URL(String(value || '')); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  function duration(value) {
    const parts = String(value || '').trim().match(/^(\d{1,3}):([0-5]\d):([0-5]\d)$/);
    return parts ? Number(parts[1]) * 3600 + Number(parts[2]) * 60 + Number(parts[3]) : 0;
  }
  function remaining(end, now = Date.now()) {
    const seconds = Math.max(0, Math.floor((root.RDCFlashOfferSafety.millis(end) - now) / 1000));
    return seconds ? [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':') : '';
  }
  function assertProduct(product) {
    if (!product || product.sistema === true || !String(product.titulo || '').trim()) throw Error('O cadastro não está disponível. Escolha o produto novamente.');
    if (product.conferenciaPausada === true || product.indisponivel === true || product.ativo === false) throw Error('Este produto está pausado ou indisponível. Revise e reative o cadastro antes de criar a oferta.');
    if (!safeUrl(product.link) || !safeUrl(product.linkAfiliado)) throw Error('O cadastro precisa ter o link do produto e o link de afiliado válidos. Edite os links primeiro.');
  }
  function buildPatch(product, input, options = {}) {
    assertProduct(product);
    const now = options.now ?? Date.now();
    const current = root.RDCFlashOfferSafety.price(input.current);
    const regular = root.RDCFlashOfferSafety.price(input.regular);
    if (!(regular > current && current > 0) || Math.round((1 - current / regular) * 100) < 1) throw Error('Informe o preço da oferta e um preço anterior comprovado maior, com desconto de pelo menos 1%.');
    if (input.confirmed !== true) throw Error('Confira o anúncio e confirme os dois preços e o prazo antes de salvar.');
    let endsAt;
    if (input.keepDeadline === true && product.ofertaRelampagoAtiva === true) {
      endsAt = root.RDCFlashOfferSafety.millis(product.ofertaRelampagoTerminaEm);
      if (!Number.isFinite(endsAt) || endsAt <= now + 30000) throw Error('O prazo desta oferta venceu ou está terminando. Confira o anúncio e informe um novo tempo restante.');
    } else {
      const seconds = duration(input.duration);
      if (seconds <= 30) throw Error('Informe um tempo restante válido em HH:MM:SS, maior que 30 segundos.');
      endsAt = now + seconds * 1000;
    }
    if (!options.confirmationId || options.timestamp == null) throw Error('Não foi possível preparar a confirmação. Tente novamente.');
    return {
      precoAnterior: money(regular), precoPromocional: money(current),
      ofertaRelampagoAtiva: true, ofertaRelampagoComecaEm: new Date(now).toISOString(),
      ofertaRelampagoTerminaEm: new Date(endsAt).toISOString(),
      precoAtualizadoManualmente: true, precoAtualizadoManualmenteEm: options.timestamp,
      precoConferenciaCampo: 'precoPromocional', precoConferenciaValor: current,
      precoConferenciaId: options.confirmationId, precoConferidoPor: 'manual_oferta_relampago',
      precoConferidoPorIA: false, precoProvaVersao: 0, precoProvaAnuncio: '',
      atualizadoEm: options.timestamp,
    };
  }
  function assertCurrent(current, baseline, changes) {
    const guard = Object.fromEntries([...new Set([...GUARDED_FIELDS, ...Object.keys(changes)])].map(key => [key, changes[key]]));
    root.RDCProductSaveSafety.assertUnchanged(current, baseline, guard);
    assertProduct(current);
  }
  function search(products, term) {
    const query = normalize(term).trim();
    return (Array.isArray(products) ? products : []).filter(p => p && p.sistema !== true && p.id && String(p.titulo || '').trim())
      .filter(p => !query || normalize([p.titulo, p.id, p.mercadoLivreItemId].join(' ')).includes(query))
      .sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), 'pt-BR'));
  }
  function mount(host, hooks) {
    if (!host) return null;
    host.classList.add('rdc-existing-flash');
    host.innerHTML = '<button type="button" data-open>⚡ Usar produto já cadastrado</button><div data-drawer hidden><p>Escolha um cadastro existente. Foto, links, análise e histórico serão mantidos; nenhum produto novo será criado.</p><label>Buscar por nome ou código<input type="search" data-search placeholder="Digite o nome do produto" autocomplete="off"></label><label>Produto cadastrado<select data-products aria-label="Produto cadastrado"><option value="">Selecione um produto</option></select></label><p data-count class="rdc-ef-note"></p><div data-editor hidden><h3 data-title></h3><img data-photo alt="Foto do produto cadastrado" hidden><a data-source target="_blank" rel="noopener noreferrer">Abrir anúncio para conferir ↗</a><div class="rdc-ef-grid"><label>Preço anterior comprovado (R$)<input data-regular inputmode="decimal" placeholder="Ex.: 199,90"></label><label>Preço da oferta (R$)<input data-current inputmode="decimal" placeholder="Ex.: 159,90"></label></div><label>Tempo restante (HH:MM:SS)<input data-duration inputmode="numeric" maxlength="9" placeholder="Ex.: 03:30:00"></label><p data-deadline class="rdc-ef-note"></p><label class="rdc-ef-confirm"><input type="checkbox" data-confirm><span>Conferi no anúncio o preço da oferta, o preço anterior e o tempo restante.</span></label><button type="button" data-save>Salvar oferta neste cadastro</button></div><p data-status role="status" aria-live="polite"></p><div data-publication hidden><b>Falta atualizar a vitrine</b><p>O cadastro foi salvo. Publique a vitrine uma única vez ao terminar. São exibidas até 6 ofertas válidas, na ordem de término.</p><a data-publish target="_blank" rel="noopener noreferrer">Atualizar vitrine no GitHub ↗</a></div><button type="button" data-close class="rdc-ef-secondary">Fechar sem alterar outro cadastro</button></div>';
    const el = name => host.querySelector('[data-' + name + ']');
    el('publish').href = WORKFLOW;
    let products = [], cached = null, selected = null, selectedId = '', loading = false, saving = false, generation = 0, deadlineEdited = false;
    const status = (text, error = false) => { el('status').textContent = text; el('status').className = error ? 'rdc-ef-error' : ''; };
    function busy() { return loading || saving; }
    function disable(value) { host.querySelectorAll('button,input,select').forEach(node => { node.disabled = value; }); }
    function clearEditor() { selected = null; selectedId = ''; deadlineEdited = false; el('editor').hidden = true; el('confirm').checked = false; el('publication').hidden = true; }
    function renderList() {
      const matches = search(products, el('search').value);
      el('products').replaceChildren(new Option('Selecione um produto', ''));
      for (const product of matches) el('products').add(new Option(String(product.titulo), String(product.id)));
      el('count').textContent = matches.length + ' produto(s). A busca usa a lista carregada, sem novas consultas.';
      clearEditor();
    }
    el('open').onclick = async () => {
      if (busy()) return;
      const revision = ++generation;
      loading = true; disable(true); el('drawer').hidden = false; el('open').setAttribute('aria-expanded', 'true'); status('Carregando os produtos cadastrados...');
      try {
        cached ||= Promise.resolve().then(() => hooks.loadProducts()).catch(error => { cached = null; throw error; });
        const loaded = await cached;
        if (generation !== revision) return;
        products = Array.isArray(loaded) ? loaded : []; renderList(); status('Escolha o produto para preparar a oferta.'); el('search').focus();
      } catch (error) { if (generation === revision) status(error.message, true); }
      finally { loading = false; disable(false); }
    };
    el('search').oninput = () => { if (!busy()) { generation++; renderList(); status(''); } };
    el('products').onchange = async () => {
      if (busy()) return;
      const id = el('products').value, revision = ++generation;
      clearEditor(); if (!id) return;
      loading = true; disable(true); status('Carregando este cadastro para edição segura...');
      try {
        const product = await hooks.read(id);
        if (generation !== revision) return;
        assertProduct(product); selected = product; selectedId = id;
        el('title').textContent = String(product.titulo); el('source').href = safeUrl(product.link);
        const image = safeUrl(product.foto); el('photo').hidden = !image; if (image) el('photo').src = image;
        const live = product.ofertaRelampagoAtiva === true && root.RDCFlashOfferSafety.millis(product.ofertaRelampagoTerminaEm) > Date.now();
        el('regular').value = root.RDCFlashOfferSafety.price(product.precoAnterior) ? money(root.RDCFlashOfferSafety.price(product.precoAnterior)) : '';
        el('current').value = live || product.promocaoAtiva === true ? product.precoPromocional || product.preco || '' : product.preco || '';
        el('duration').value = live ? remaining(product.ofertaRelampagoTerminaEm) : '';
        el('deadline').textContent = live ? 'O horário final atual será preservado. Altere o tempo somente se o anúncio informar outro prazo.' : 'Copie o tempo restante real do anúncio. O contador não reinicia sozinho.';
        el('editor').hidden = false; status('Confira os preços e o prazo antes de salvar.');
      } catch (error) { if (generation === revision) status(error.message, true); }
      finally { loading = false; disable(false); }
    };
    for (const name of ['regular', 'current', 'duration']) el(name).oninput = () => { el('confirm').checked = false; el('publication').hidden = true; status(''); if (name === 'duration') deadlineEdited = true; };
    el('photo').onerror = () => { el('photo').hidden = true; };
    el('save').onclick = async () => {
      if (busy() || !selected || !selectedId) return;
      const input = { regular: el('regular').value, current: el('current').value, duration: el('duration').value, confirmed: el('confirm').checked, keepDeadline: !deadlineEdited && selected.ofertaRelampagoAtiva === true };
      try { buildPatch(selected, input, { timestamp: new Date(), confirmationId: 'validation' }); } catch (error) { status(error.message, true); return; }
      const id = selectedId, baseline = selected, revision = generation;
      saving = true; disable(true); status('Salvando a oferta no mesmo cadastro...');
      try {
        const updated = await hooks.save(id, baseline, input);
        if (generation !== revision) return;
        if (updated) selected = updated;
        el('confirm').checked = false; deadlineEdited = false;
        if (selected?.ofertaRelampagoTerminaEm) el('duration').value = remaining(selected.ofertaRelampagoTerminaEm);
        el('publication').hidden = false; status('Oferta salva no cadastro existente, sem duplicar o produto. Atualize a vitrine ao terminar.');
      } catch (error) { if (generation === revision) status(error.message, true); }
      finally { saving = false; disable(false); }
    };
    function reset() { generation++; cached = null; products = []; clearEditor(); el('search').value = ''; el('products').replaceChildren(new Option('Selecione um produto', '')); el('drawer').hidden = true; el('open').setAttribute('aria-expanded', 'false'); status(''); }
    el('close').onclick = () => { if (!busy()) reset(); };
    el('open').setAttribute('aria-expanded', 'false');
    return { reset, isBusy: busy };
  }
  return Object.freeze({ buildPatch, assertCurrent, search, duration, remaining, mount });
});
