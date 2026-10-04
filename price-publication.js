(function () {
  'use strict';
  const WORKFLOW = 'https://github.com/informatica-byte/RankingDaCompra/actions/workflows/update-sitemap.yml';
  function millis(value) {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && typeof value.toDate === 'function') return value.toDate().getTime();
    if (value && typeof value === 'object' && Number.isFinite(value.seconds)) return value.seconds * 1000 + (Number(value.nanoseconds) || 0) / 1e6;
    const time = value instanceof Date ? value.getTime() : Date.parse(value || '');
    return Number.isFinite(time) ? time : 0;
  }
  function price(value) {
    const raw = String(value ?? '').replace(/R\$|\s/g, '');
    const number = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
    return raw && Number.isFinite(number) && number > 0 ? number : 0;
  }
  function state(products, catalogue, now = Date.now()) {
    if (!Array.isArray(products) || !Array.isArray(catalogue?.products)) throw new Error('Publicação não pôde ser verificada.');
    const published = new Map(catalogue.products.map(p => [String(p.id), p]));
    const confirmed = products.filter(p => {
      const publicProduct = published.get(String(p.id));
      const sameRevision = p._rdcPendingConfirmationId && publicProduct?.precoConferenciaId === p._rdcPendingConfirmationId;
      const age = now - millis(sameRevision ? publicProduct.precoAtualizadoManualmenteEm : p.precoAtualizadoManualmenteEm);
      return p.precoAtualizadoManualmente === true && age >= 0 && age <= 86400000;
    });
    const visible = confirmed.filter(p => published.has(String(p.id)));
    const pending = visible.filter(p => {
      const publicProduct = published.get(String(p.id));
      return publicProduct.precoAtualizadoManualmente !== true
        || (p._rdcPendingConfirmationId
          ? publicProduct.precoConferenciaId !== p._rdcPendingConfirmationId
          : millis(publicProduct.precoAtualizadoManualmenteEm) < millis(p.precoAtualizadoManualmenteEm))
        || ['preco', 'precoPromocional'].some(field => price(publicProduct[field]) !== price(p[field]));
    });
    return { confirmed: visible.length, pending: pending.length, outside: confirmed.length - visible.length, generatedAt: catalogue.generatedAt || '' };
  }
  function mount(container, getProducts, id) {
    if (!container || document.getElementById(id)) return;
    const box = document.createElement('section');
    box.id = id;
    box.style.cssText = 'margin:14px 0;padding:14px;border:1px solid #d4dfdd;border-radius:10px;background:#f0faf6;color:#145a43;line-height:1.5';
    box.innerHTML = '<strong>📣 Publicar a conferência na vitrine</strong><p data-publication-status role="status" aria-live="polite">Salvar a conferência no painel não atualiza imediatamente a vitrine. Após terminar, publique uma única vez.</p><a data-publication-link target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px;background:#087f5b;color:white;border-radius:8px;font-weight:700;text-decoration:none">Atualizar vitrine após conferência ↗</a> <button type="button" data-publication-check style="padding:10px;border:1px solid #aacbbc;border-radius:8px;background:white;color:#145a43;cursor:pointer">Verificar se já foi publicado</button><small style="display:block;margin-top:8px">No GitHub, escolha main e toque em “Run workflow” / “Executar fluxo de trabalho”. Aguarde a geração e a implantação. Esta verificação lê só o arquivo público, sem consultar o Firebase.</small>';
    box.querySelector('[data-publication-link]').href = WORKFLOW;
    const button = box.querySelector('[data-publication-check]');
    button.addEventListener('click', async () => {
      const status = box.querySelector('[data-publication-status]');
      const products = getProducts();
      if (!Array.isArray(products) || !products.length) {
        status.textContent = 'Carregue primeiro os produtos no painel para comparar com a vitrine.';
        return;
      }
      button.disabled = true;
      status.textContent = 'Comparando a conferência salva com a publicação pública...';
      try {
        const response = await fetch('/vitrine-publica.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const result = state(products, await response.json());
        const outside = result.outside ? ' ' + result.outside + ' produto(s) conferido(s) ainda não fazem parte desta vitrine; confira a publicação ou revisão do cadastro.' : '';
        status.textContent = result.pending
          ? result.pending + ' conferência(s) salva(s) ainda não chegaram à vitrine. Não refaça a conferência: use “Atualizar vitrine após conferência”.' + outside
          : result.confirmed
            ? '✅ As ' + result.confirmed + ' conferências recentes dos produtos desta vitrine já estão publicadas.' + outside
            : 'Não há conferências manuais recentes dos produtos desta vitrine para comparar.' + outside;
      } catch {
        status.textContent = 'Não foi possível confirmar a publicação. Seus dados salvos foram preservados. Tente verificar novamente depois da implantação.';
      } finally { button.disabled = false; }
    });
    container.append(box);
  }
  function saved(id, complete = false) {
    const box = document.getElementById(id);
    if (box) box.querySelector('[data-publication-status]').textContent = complete
      ? '✅ Conferência de hoje concluída no painel. Falta publicar ou verificar a vitrine; não é necessário conferir os preços novamente.'
      : 'Conferências salvas no painel. Ao terminar, atualize a vitrine uma única vez e verifique a publicação.';
  }
  window.RDCPricePublication = { state, mount, saved };
})();
