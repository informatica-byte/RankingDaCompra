(function () {
  'use strict';
  if (window.RDCPriceHistoryData) return;
  const loaded = new Map(), pending = new Map();
  let manifest;
  async function index() {
    if (!manifest) manifest = window.RDCPublicData.json('/historico-precos-indice.json').then(data => {
      if (data?.version !== 2 || !data.products || Array.isArray(data.products)) throw Error('Índice do histórico inválido');
      return data;
    }).catch(error => { manifest = null; throw error; });
    return manifest;
  }
  async function product(id, catalogue) {
    if (loaded.has(id)) return loaded.get(id);
    if (pending.has(id)) return pending.get(id);
    const name = Object.hasOwn(catalogue.products, id) ? catalogue.products[id] : '';
    // Never follow arbitrary paths from JSON, or guess a missing product's file.
    if (typeof name !== 'string' || !name.startsWith(id + '-') || !/^[A-Za-z0-9_-]{1,100}-[a-f0-9]{16}\.json$/.test(name)) return null;
    const request = window.RDCPublicData.json('/assets/price-history/' + name).then(data => {
      if (data?.version !== 2 || data.id !== id || !Array.isArray(data.points)) throw Error('Histórico do produto inválido');
      const points = data.points.map(point => {
        if (!Array.isArray(point) || !/^\d{4}-\d{2}-\d{2}$/.test(point[0]) || !Number.isFinite(point[1]) || point[1] <= 0 || typeof point[2] !== 'boolean') throw Error('Registro de histórico inválido');
        return [point[0], point[1], point[2]];
      });
      const item = { points }; loaded.set(id, item); return item;
    }).finally(() => pending.delete(id));
    pending.set(id, request);
    return request;
  }
  async function load(ids) {
    const result = { products: {} };
    const queue = [...new Set(ids)].filter(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id));
    if (!queue.length || !window.RDCPublicData) return result;
    let catalogue;
    try { catalogue = await index(); } catch (_) { return result; }
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (next < queue.length) {
        const id = queue[next++];
        try { const item = await product(id, catalogue); if (item) result.products[id] = item; } catch (_) { /* No guessed minima or database fallback. */ }
      }
    }));
    return result;
  }
  window.RDCPriceHistoryData = { load };
})();
