(function (root) {
  'use strict';

  function canonical(value) {
    if (value == null) return null;
    if (Array.isArray(value)) return value.map(canonical);
    if (typeof value === 'object') {
      if (typeof value.toJSON === 'function') return canonical(value.toJSON());
      return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined)
        .map(key => [key, canonical(value[key])]));
    }
    return typeof value === 'string' ? value.trim() : value;
  }

  // Capture the stored values, not form defaults or formatted prices.
  function capture(product) { return canonical(product || {}); }

  function assertUnchanged(current, baseline, changes) {
    if (!current) throw new Error('Este produto foi excluído. Recarregue a lista; o cadastro não foi recriado.');
    if (!baseline) throw new Error('Abra a edição do produto novamente antes de salvar.');
    const conflicts = Object.keys(changes).filter(key => key !== 'atualizadoEm'
      && JSON.stringify(canonical(current[key])) !== JSON.stringify(canonical(baseline[key])));
    if (conflicts.length) throw new Error('Este produto foi alterado em outra sessão nos mesmos campos. Reabra a edição antes de salvar. Campos: ' + conflicts.join(', ') + '.');
  }

  // Only a seller listing id is suitable for a unique product document. Catalog
  // ids (/p/MLB...) and affiliate short links do not identify a seller listing.
  function listingId(product) {
    if (product?.marketplace !== 'mercado_livre') return '';
    let url;
    try {
      url = new URL(String(product.link || ''));
    } catch { return ''; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || !/(^|\.)mercadolivre\.com\.br$/i.test(url.hostname)) return '';
    const ids = new Set();
    const add = value => {
      if (!value) return;
      const match = String(value).trim().match(/^MLB[-_]?(\d{6,})$/i);
      if (!match) throw new Error('O link contém um código de anúncio inválido. Copie novamente o endereço completo do produto.');
      ids.add('MLB' + match[1]);
    };
    // Offer links keep wid after #. deal:MLB... is a campaign, never a listing.
    const hash = new URL(url.origin + '/?' + url.hash.slice(1)).searchParams;
    for (const params of [url.searchParams, hash]) {
      for (const key of ['item_id', 'wid']) for (const value of params.getAll(key)) add(value);
      for (const filter of params.getAll('pdp_filters')) {
        for (const match of filter.matchAll(/(?:^|[|,])item_id:([^|,]+)/gi)) add(match[1]);
      }
    }
    if (!/\/p\/MLB\d+/i.test(url.pathname)) {
      const pathId = url.pathname.match(/\/(MLB[-_]?\d{6,})(?=[\/_-]|$)/i)?.[1];
      if (pathId) add(pathId);
    }
    if (ids.size > 1) throw new Error('O link contém códigos de anúncios diferentes. Copie novamente o endereço do anúncio escolhido.');
    return [...ids][0] || '';
  }

  function creationId(product) {
    const id = listingId(product);
    return id ? 'ml' + id : '';
  }

  function duplicateLookups(product) {
    const id = listingId(product);
    if (!id) return [];
    return [['mercadoLivreItemId', id], ['mercadoLivreItemId', id.replace('MLB', 'MLB-')], ['link', String(product.link).trim()]];
  }

  function assertNew(snapshot) {
    const exists = typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.exists;
    if (exists) throw new Error('Este anúncio já está cadastrado. Recarregue a lista e edite o cadastro existente; nenhum produto foi substituído.');
  }

  root.RDCProductSaveSafety = Object.freeze({ capture, assertUnchanged, listingId, creationId, duplicateLookups, assertNew });
})(typeof window === 'object' ? window : globalThis);
