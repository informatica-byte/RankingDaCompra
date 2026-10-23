(function (root) {
  'use strict';
  const LABELS = { produtos: 'Produtos', categorias: 'Categorias', metricas: 'Visitas e cliques' };
  function create({ session, now = Date.now, container } = {}) {
    const cache = new Map(), pending = new Map();
    let owner = '', generation = 0, stats = {};
    let output;
    if (container) {
      const doc = container.ownerDocument;
      const details = doc.createElement('details'), title = doc.createElement('summary');
      title.textContent = '📉 Leituras deste painel — diagnóstico local';
      const help = doc.createElement('p');
      help.textContent = 'Conta somente as consultas instrumentadas nesta aba. Documentos retornados pelo SDK não são a cobrança exata: cache, regras e índices podem alterar a contabilização. Sem tokens, dados de produtos, envio à nuvem ou novas consultas. Reabrir a página zera este resumo.';
      output = doc.createElement('pre');
      output.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px';
      details.appendChild(title); details.appendChild(help); details.appendChild(output);
      container.appendChild(details);
    }
    function render() {
      if (output) output.textContent = Object.keys(LABELS).map(key => {
        const value = stats[key] || {};
        return LABELS[key] + ': ' + (value.queries || 0) + ' consulta(s), ' + (value.documents || 0)
          + ' documento(s) de resposta não local, ' + (value.reused || 0) + ' reaproveitamento(s), '
          + (value.failures || 0) + ' falha(s).';
      }).join('\n');
    }
    function reset() { cache.clear(); pending.clear(); generation++; stats = {}; render(); }
    function checkSession() {
      const current = String(session?.() || '');
      if (owner !== current) { reset(); owner = current; }
      if (!current) throw Error('Entre novamente no painel.');
      return current;
    }
    function entry(key) {
      if (!Object.hasOwn(LABELS, key)) throw Error('Consulta administrativa não reconhecida.');
      return stats[key] ||= { queries: 0, documents: 0, reused: 0, failures: 0 };
    }
    function observe(key, snapshot, listener = false) {
      const value = entry(key);
      try {
        if (!snapshot?.metadata?.fromCache) {
          const docs = listener && typeof snapshot?.docChanges === 'function'
            ? snapshot.docChanges().map(change => change.doc) : snapshot?.docs || [];
          value.documents += docs.filter(doc => !doc.metadata?.hasPendingWrites).length;
        }
      } catch (_) { /* Métrica ausente não pode impedir leitura ou conferência. */ }
      render();
    }
    function reuse(key, value) { checkSession(); entry(key).reused++; render(); return value; }
    async function read(key, reader, { fresh = false, ttl = 0 } = {}) {
      const uid = checkSession(), epoch = generation, value = entry(key), stored = cache.get(key);
      // Mesmo a atualização explícita compartilha uma leitura já em andamento.
      // Uma leitura concluída só é reutilizada por até um minuto, em usos auxiliares.
      if (pending.has(key)) { value.reused++; render(); return pending.get(key); }
      const age = now() - Number(stored?.at);
      if (!fresh && stored && age >= 0 && age < Math.min(Math.max(Number(ttl) || 0, 0), 60000)) {
        value.reused++; render(); return stored.data;
      }
      value.queries++; render();
      const request = Promise.resolve().then(reader).then(snapshot => {
        if (generation !== epoch || String(session?.() || '') !== uid) throw Error('A sessão mudou. Carregue novamente o painel.');
        observe(key, snapshot);
        cache.set(key, { at: now(), data: snapshot });
        return snapshot;
      }).catch(error => { if (generation === epoch) { value.failures++; render(); } throw error; })
        .finally(() => { if (pending.get(key) === request) pending.delete(key); });
      pending.set(key, request);
      return request;
    }
    render();
    function watch(key) { checkSession(); entry(key).queries++; render(); }
    return { read, reuse, observe, watch, reset, summary: () => JSON.parse(JSON.stringify(stats)) };
  }
  root.RDCAdminReadEconomy = { create };
})(typeof window === 'undefined' ? globalThis : window);
