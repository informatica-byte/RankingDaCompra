(function () {
  'use strict';
  const pending = new Map(), memory = new Map(), TTL = 5 * 60 * 1000;
  // Public JSON only: shared by home, history and shopping tools. No database fallback.
  function json(path) {
    const key = String(path).split('?')[0];
    const rootResource = /^\/?(?:historico-precos(?:-indice)?|search-index|vitrine-publica|site-config|top5-semanal|best-choices-guides|mercadolivre-status)\.json$/.test(key.replace(/^\.\//, ''));
    const historyChunk = /^\/assets\/price-history\/[A-Za-z0-9_-]{1,100}-[a-f0-9]{16}\.json$/.test(key);
    if (!rootResource && !historyChunk) return Promise.reject(new Error('Recurso público inválido'));
    const now = Date.now(), stored = memory.get(key);
    if (stored && now - stored.at >= 0 && now - stored.at < TTL) return Promise.resolve(stored.data);
    if (pending.has(key)) return pending.get(key);
    const request = fetch(key, { cache: historyChunk ? 'force-cache' : 'no-cache' }).then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(data => {
      if (!data || typeof data !== 'object') throw new Error('Arquivo público inválido');
      memory.set(key, { at: Date.now(), data });
      return data;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  }
  window.RDCPublicData = { json };
})();
