(() => {
  'use strict';
  if (window.RDCLocalAppCheckDiagnostics) return;

  const KEY = 'rdc-appcheck-diagnostico-local-v1';
  const MAX = 50;
  const AGE = 7 * 24 * 60 * 60 * 1000;
  const PAGES = new Set(['dashboard', 'painel-celular']);
  const SOURCES = new Set(['firestore', 'ai-logic', 'appcheck']);
  const CODES = new Set([
    'already-initialized', 'use-before-activation', 'fetch-network-error',
    'fetch-parse-error', 'fetch-status-error', 'recaptcha-error', 'throttled',
    'initial-throttle', 'storage-open', 'storage-get', 'storage-set', 'storage-delete',
    'app-not-registered', 'invalid-argument', 'invalid-custom-provider-token',
    'unknown'
  ]);
  const watched = new WeakSet();
  const views = [];
  let page = null;
  let pageDocument = null;
  let memory = [];
  let volatile = false;

  function codeOf(error) {
    // Nunca consultar message, stack, token, URL ou o objeto inteiro.
    try {
      const raw = typeof error?.code === 'string' ? error.code : '';
      const suffix = raw.startsWith('appCheck/') ? raw.slice(9) : '';
      return 'appCheck/' + (CODES.has(suffix) ? suffix : 'unknown');
    } catch (_) { return 'appCheck/unknown'; }
  }
  function statusOf(value) {
    if ((typeof value === 'number' || typeof value === 'string') && /^[1-5]\d\d$/.test(String(value))) return Number(value);
    return null;
  }
  function cleanContext(value) {
    const context = {};
    if (typeof value?.online === 'boolean') context.online = value.online;
    if (['visible', 'hidden'].includes(value?.visibility)) context.visibility = value.visibility;
    if (['present', 'missing'].includes(value?.recaptchaScript)) context.recaptchaScript = value.recaptchaScript;
    return Object.keys(context).length ? context : null;
  }
  function contextNow() {
    // Coarse, local-only context, captured only on an existing failure. No URLs or identifiers.
    const context = {};
    try { context.online = window.navigator?.onLine; } catch (_) {}
    try { context.visibility = pageDocument?.visibilityState; } catch (_) {}
    try {
      if (typeof pageDocument?.querySelector === 'function') context.recaptchaScript = pageDocument.querySelector('script[src*="/recaptcha/enterprise.js"]') ? 'present' : 'missing';
    } catch (_) {}
    return cleanContext(context);
  }
  function clean(items) {
    const now = Date.now();
    return (Array.isArray(items) ? items : []).slice(-MAX).flatMap(item => {
      if (!item || !PAGES.has(item.page) || !SOURCES.has(item.source)) return [];
      const at = Date.parse(item.at), last = Date.parse(item.lastAt);
      if (!Number.isFinite(at) || !Number.isFinite(last) || at < now - AGE || at > now + 300000 || last < at || last > now + 300000) return [];
      const code = codeOf({code: item.code});
      const result = {at: new Date(at).toISOString(), lastAt: new Date(last).toISOString(), page: item.page,
        source: item.source, code, count: Number.isInteger(item.count) ? Math.max(1, Math.min(9999, item.count)) : 1};
      const status = statusOf(item.status);
      if (status !== null) result.status = status;
      const context = cleanContext(item.context);
      if (context) result.context = context;
      return [result];
    });
  }
  function save(items) {
    memory = clean(items);
    if (volatile) return;
    try {
      if (memory.length) window.localStorage.setItem(KEY, JSON.stringify({version: 1, records: memory}));
      else window.localStorage.removeItem(KEY);
    } catch (_) { volatile = true; }
  }
  function records() {
    if (volatile) return memory = clean(memory);
    try {
      const text = window.localStorage.getItem(KEY);
      if (!text) return memory = [];
      const parsed = JSON.parse(text);
      memory = clean(parsed?.version === 1 ? parsed.records : []);
      // Remover campos não permitidos e registros expirados apenas nesta chave.
      if (JSON.stringify({version: 1, records: memory}) !== text) save(memory);
      return memory;
    } catch (_) {
      // Armazenamento bloqueado ou corrompido nunca impede o painel de funcionar.
      volatile = true;
      return memory = clean(memory);
    }
  }
  function report() {
    return JSON.stringify({version: 1, scope: 'somente neste navegador; sem tokens', records: records()}, null, 2);
  }
  function render() {
    for (const view of views) {
      const items = records();
      view.summary.textContent = '🛠 Diagnóstico local do App Check — ' + items.length + ' registro(s)';
      view.mode.textContent = volatile
        ? 'O navegador não permitiu salvar. Estes registros duram apenas enquanto esta aba estiver aberta.'
        : 'Somente neste navegador. Até 50 registros; os mais antigos que 7 dias são descartados ao abrir ou usar o diagnóstico.';
      view.list.textContent = items.length ? items.slice().reverse().map(item =>
        item.lastAt + ' | ' + item.page + ' | ' + item.source + ' | ' + item.code +
        (item.status ? ' | HTTP ' + item.status : '') + ' | ' + item.count + ' ocorrência(s)'
        + (item.context ? ' | ' + JSON.stringify(item.context) : '')
      ).join('\n') : 'Nenhuma falha registrada por este diagnóstico. Isso não comprova que todo o tráfego do Firestore foi validado.';
      if (!view.output.hidden) view.output.value = report();
    }
  }
  function record(error, source = 'appcheck') {
    try {
      if (!PAGES.has(page)) return;
      const items = records().slice();
      const at = new Date().toISOString();
      const item = {at, lastAt: at, page, source: SOURCES.has(source) ? source : 'appcheck', code: codeOf(error), count: 1};
      let status;
      try { status = statusOf(error?.customData?.httpStatus); } catch (_) {}
      if (status !== null && status !== undefined) item.status = status;
      const context = contextNow();
      if (context) item.context = context;
      const previous = items[items.length - 1];
      if (previous && previous.page === item.page && previous.source === item.source && previous.code === item.code && previous.status === item.status && JSON.stringify(previous.context) === JSON.stringify(item.context) && Date.now() - Date.parse(previous.lastAt) >= 0 && Date.now() - Date.parse(previous.lastAt) < 60000) {
        previous.lastAt = at;
        previous.count = Math.min(9999, previous.count + 1);
      } else items.push(item);
      save(items);
      render();
    } catch (_) { /* O diagnóstico não pode afetar o fluxo do SDK. */ }
  }
  function observeProvider(provider, source) {
    // Apenas observar a chamada que o SDK já faria. Não chamar getToken aqui.
    try {
      if (!provider || watched.has(provider) || typeof provider.getToken !== 'function') return provider;
      const original = provider.getToken;
      Object.defineProperty(provider, 'getToken', {configurable: true, writable: true, value: function (...args) {
        let pending;
        try { pending = original.apply(this, args); }
        catch (error) { record(error, source); throw error; }
        // Sem callback de sucesso: nenhum token é lido ou mantido pelo diagnóstico.
        // Retorna a mesma Promise e preserva o mesmo resultado/erro para o SDK.
        try { if (pending && typeof pending.then === 'function') pending.then(undefined, error => { record(error, source); }); } catch (_) {}
        return pending;
      }});
      watched.add(provider);
    } catch (_) { /* Provedor não instrumentável: manter o comportamento original. */ }
    return provider;
  }
  function mount(container, options = {}) {
    if (!container || !PAGES.has(options.page)) return;
    page = options.page;
    if (container.dataset.rdcLocalDiagnostics) return;
    container.dataset.rdcLocalDiagnostics = '1';
    container.hidden = false;
    const doc = container.ownerDocument;
    pageDocument = doc;
    if (!doc.getElementById('rdc-local-diagnostics-style')) {
      const style = doc.createElement('style');
      style.id = 'rdc-local-diagnostics-style';
      style.textContent = '.rdc-local-diagnostics{min-width:0}.rdc-local-diagnostics summary{cursor:pointer;font-weight:800;color:#145c44;overflow-wrap:anywhere}.rdc-local-diagnostics p{font-size:12px;line-height:1.5;color:#51645c}.rdc-local-diagnostics pre{max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}.rdc-local-diagnostics-actions{display:flex;flex-wrap:wrap;gap:8px}.rdc-local-diagnostics button{width:auto;max-width:100%;border:1px solid #9dcbb6;border-radius:8px;padding:9px;background:#f3faf6;color:#145c44;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.rdc-local-diagnostics textarea{box-sizing:border-box;width:100%;min-height:160px;margin-top:10px;font:12px monospace}.rdc-local-diagnostics [hidden]{display:none!important}';
      doc.head.appendChild(style);
    }
    const make = (tag, text) => {const el = doc.createElement(tag); if (text) el.textContent = text; return el;};
    const details = make('details'); details.className = 'rdc-local-diagnostics';
    const summary = make('summary');
    const mode = make('p');
    const help = make('p', 'Registra falhas de obtenção e renovação do App Check neste painel. Não guarda tokens, mensagens completas, senhas ou dados de produtos e não envia o diagnóstico à nuvem. Não executa testes, consultas ou novas avaliações. Em uma falha, anota apenas conexão, visibilidade da aba e presença do script do reCAPTCHA; isso ajuda a investigar, mas não comprova a causa.');
    const list = make('pre');
    const actions = make('div'); actions.className = 'rdc-local-diagnostics-actions';
    const copy = make('button', 'Copiar diagnóstico'); copy.type = 'button';
    const clear = make('button', 'Limpar diagnóstico'); clear.type = 'button';
    const status = make('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const output = make('textarea'); output.readOnly = true; output.hidden = true; output.setAttribute('aria-label', 'Diagnóstico local sem credenciais');
    actions.appendChild(copy); actions.appendChild(clear);
    for (const el of [summary, mode, help, list, actions, status, output]) details.appendChild(el);
    container.appendChild(details);
    const view = {summary, mode, list, output}; views.push(view);
    copy.addEventListener('click', async () => {
      const text = report();
      try {
        if (!window.navigator?.clipboard?.writeText) throw Error('clipboard unavailable');
        await window.navigator.clipboard.writeText(text);
        status.textContent = 'Resumo copiado. Confira antes de compartilhar.';
      } catch (_) {
        output.hidden = false; output.value = text;
        status.textContent = 'Copie manualmente o resumo no campo abaixo.';
      }
    });
    let confirming = false;
    clear.addEventListener('click', () => {
      if (!confirming) {
        confirming = true; clear.textContent = 'Confirmar limpeza local';
        status.textContent = 'Clique novamente para apagar somente os registros deste diagnóstico. Produtos, login e configurações não serão alterados.';
        return;
      }
      save([]); confirming = false; clear.textContent = 'Limpar diagnóstico';
      output.hidden = true; output.value = ''; status.textContent = 'Diagnóstico local limpo.'; render();
    });
    details.addEventListener('toggle', () => {if (!details.open) {confirming = false; clear.textContent = 'Limpar diagnóstico';} render();});
    render();
  }
  window.addEventListener('storage', event => {if (event.key === KEY || event.key === null) render();});
  window.RDCLocalAppCheckDiagnostics = Object.freeze({mount, observeProvider, record});
})();
