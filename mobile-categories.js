(function (root) {
  'use strict';
  // Only this select is rendered. Product fields and conference state are never reset.
  function create({ select, button, status, read, session, onCategories,
    now = Date.now, timeoutMs = 15000, cooldownMs = 30000 } = {}) {
    let owner = '', epoch = 0, pending = null, categories = [], preferred = '', lastAttempt = -Infinity;
    const doc = select.ownerDocument;
    const option = (value, label, disabled = false) => {
      const node = doc.createElement('option');
      node.value = value; node.textContent = label; node.disabled = disabled;
      return node;
    };
    function render() {
      const selected = select.value || preferred;
      const nodes = [option('', 'Selecione a categoria', true),
        ...categories.map(item => option(item.id, item.nome))];
      if (selected && !categories.some(item => item.id === selected)) {
        const old = Array.from(select.options).find(item => item.value === selected);
        nodes.push(option(selected, old?.textContent || 'Categoria anterior — recarregue para validar', true));
      }
      select.replaceChildren(...nodes);
      select.value = selected || '';
    }
    function reset() {
      epoch++; pending = null; owner = ''; categories = []; preferred = ''; lastAttempt = -Infinity;
      onCategories([]); select.replaceChildren(option('', 'Selecione a categoria', true));
      button.disabled = false; select.removeAttribute('aria-busy'); status.textContent = '';
    }
    function syncSession() {
      const uid = String(session() || '');
      if (uid !== owner) { reset(); owner = uid; }
      return uid;
    }
    function prefer(value) {
      preferred = String(value || '');
      select.value = '';
      render();
    }
    function load({ force = false } = {}) {
      const uid = syncSession();
      if (!uid) return Promise.resolve(false);
      if (pending) return pending;
      if (!force && (categories.length || now() - lastAttempt < cooldownMs)) return Promise.resolve(!!categories.length);
      lastAttempt = now();
      const generation = epoch;
      button.disabled = true; select.setAttribute('aria-busy', 'true');
      status.textContent = categories.length ? 'Atualizando categorias…' : 'Carregando categorias…';
      let timer;
      const current = () => generation === epoch && String(session() || '') === uid;
      const request = Promise.race([
        Promise.resolve().then(read),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Error('category-timeout')), timeoutMs); })
      ]).then(items => {
        if (!current()) return false;
        const unique = new Map();
        for (const item of items || []) {
          const id = String(item.id || '').trim();
          if (id) unique.set(id, { id, nome: String(item.nome || id) });
        }
        if (!unique.size) throw Error('categories-empty');
        categories = [...unique.values()]; onCategories(categories); render();
        status.textContent = select.value && !categories.some(item => item.id === select.value)
          ? 'A categoria anterior não está na lista atual. Escolha uma categoria válida; os outros campos foram mantidos.' : '';
        return true;
      }).catch(() => {
        if (current()) status.textContent = categories.length
          ? 'Não foi possível atualizar as categorias. A lista e os campos preenchidos foram mantidos. Tente novamente.'
          : 'Não foi possível carregar as categorias. Toque em “Recarregar categorias” para tentar novamente sem perder os campos preenchidos.';
        return false;
      }).finally(() => {
        clearTimeout(timer);
        if (pending === request) pending = null;
        if (current()) { button.disabled = false; select.removeAttribute('aria-busy'); }
      });
      pending = request;
      return request;
    }
    button.addEventListener('click', () => { void load({ force: true }); });
    select.addEventListener('focus', () => { void load(); });
    select.addEventListener('change', () => { preferred = select.value; });
    render();
    return { load, prefer, reset };
  }
  root.RDCMobileCategories = { create };
})(typeof window === 'undefined' ? globalThis : window);
