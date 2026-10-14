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
    try {
      const url = new URL(String(product.link || ''));
      if (url.protocol !== 'https:' || !/(^|\.)mercadolivre\.com\.br$/i.test(url.hostname)) return '';
      for (const key of ['item_id', 'wid', 'pdp_filters']) {
        const match = String(url.searchParams.get(key) || '').match(/\bMLB[-_]?(\d{6,})\b/i);
        if (match) return 'MLB' + match[1];
      }
      if (/\/p\/MLB\d+/i.test(url.pathname)) return '';
      const match = url.pathname.match(/\bMLB[-_]?(\d{6,})\b/i);
      return match ? 'MLB' + match[1] : '';
    } catch { return ''; }
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
