(function (root) {
  'use strict';
  // Somente memória e mensagens entre abas da mesma origem. Nunca tokens ou disco.
  function encode(value) {
    if (value === null || ['string', 'boolean', 'number'].includes(typeof value)) return ['value', value];
    if (value && typeof value.toDate === 'function' && Number.isInteger(value.seconds)
        && Number.isInteger(value.nanoseconds)) return ['timestamp', value.seconds, value.nanoseconds];
    if (Array.isArray(value)) return ['array', value.map(encode)];
    if (value && Object.getPrototypeOf(value) === Object.prototype)
      return ['object', Object.entries(value).map(([key, item]) => [key, encode(item)])];
    throw Error('Tipo de documento não compartilhável.');
  }
  function decode(value, timestamp) {
    if (!Array.isArray(value)) throw Error('Mensagem inválida.');
    if (value[0] === 'value') return value[1];
    if (value[0] === 'timestamp') return timestamp(value[1], value[2]);
    if (value[0] === 'array') return value[1].map(item => decode(item, timestamp));
    if (value[0] === 'object') return Object.fromEntries(value[1].map(([key, item]) => [key, decode(item, timestamp)]));
    throw Error('Mensagem inválida.');
  }
  function subscribe({ session, collection, listen, next, error, ref, timestamp, mode = () => {},
    locks = root.navigator?.locks, Channel = root.BroadcastChannel,
    makeId = () => root.crypto.randomUUID(), Controller = root.AbortController }) {
    const uid = String(session() || '');
    if (!uid || !['produtos', 'categorias'].includes(collection)) throw Error('Sessão ou coleção inválida.');
    let closed = false, leader = false, direct = false, cancel = null, channel = null, latest = null, release = null;
    let controller, sender, fallbackTimer, currentLeader = '', sequence = 0, received = -1, records = new Map();
    const valid = () => !closed && String(session() || '') === uid;
    function stop() {
      if (closed) return;
      closed = true; latest = null; records.clear();
      root.clearTimeout(fallbackTimer);
      controller?.abort(); channel?.close(); cancel?.(); cancel = null; release?.();
    }
    function post(message) {
      if (valid() && channel) channel.postMessage({ version: 1, sender, ...message });
    }
    function fail() { if (valid()) error(Error('Não foi possível sincronizar a lista. Atualize o painel.')); stop(); }
    function fallback() {
      if (!valid() || direct) return;
      root.clearTimeout(fallbackTimer);
      direct = true; controller?.abort(); channel?.close(); channel = null; release?.();
      mode('direct');
      cancel = listen(snapshot => { if (valid()) next(snapshot); }, err => { if (valid()) error(err); });
    }
    function pack(snapshot, full, target) {
      const changes = snapshot.docChanges().map(change => ({ type: change.type, id: change.doc.id,
        data: change.type === 'removed' ? null : encode(change.doc.data()),
        oldIndex: change.oldIndex, newIndex: change.newIndex }));
      return { type: 'snapshot', target, sequence, full,
        docs: full ? snapshot.docs.map(doc => ({ id: doc.id, data: encode(doc.data()) })) : [],
        order: snapshot.docs.map(doc => doc.id), changes,
        metadata: { fromCache: Boolean(snapshot.metadata?.fromCache), hasPendingWrites: Boolean(snapshot.metadata?.hasPendingWrites) } };
    }
    function receive(message) {
      if (!valid() || direct || !message || message.version !== 1 || message.sender === sender
          || (message.target && message.target !== sender)) return;
      if (message.type === 'request' && leader && latest) {
        try { post(pack(latest, true, message.sender)); } catch (_) { post({ type: 'unsupported', target: message.sender }); }
      } else if (message.type === 'unsupported' && !leader) fallback();
      else if (message.type === 'error' && !leader) fail();
      else if (message.type === 'snapshot' && !leader) {
        if (!message.full && (currentLeader !== message.sender || received < 0)) { post({ type: 'request' }); return; }
        if (currentLeader === message.sender && message.sequence < received) return;
        try {
          const initial = message.full, previous = records;
          const updated = initial ? new Map() : new Map(records);
          for (const doc of message.docs) { decode(doc.data, timestamp); updated.set(doc.id, doc.data); }
          if (!initial) for (const change of message.changes) {
            if (change.type === 'removed') updated.delete(change.id);
            else { decode(change.data, timestamp); updated.set(change.id, change.data); }
          }
          if (message.order.length !== updated.size || new Set(message.order).size !== updated.size
              || message.order.some(id => !updated.has(id))) throw Error('Lista incompleta.');
          const document = id => ({ id, ref: ref(id), exists: true,
            metadata: { ...message.metadata }, data: () => decode(updated.get(id), timestamp) });
          const docs = message.order.map(document);
          const changes = initial ? docs.map((doc, index) => ({ type: 'added', doc, oldIndex: -1, newIndex: index }))
            : message.changes.map(change => ({ ...change, doc: change.type === 'removed'
              ? { id: change.id, ref: ref(change.id), data: () => decode(previous.get(change.id), timestamp), metadata: {} }
              : document(change.id) }));
          records = updated; currentLeader = message.sender; received = message.sequence;
          root.clearTimeout(fallbackTimer);
          mode('shared');
          next({ docs, size: docs.length, empty: !docs.length, metadata: { ...message.metadata, shared: true },
            forEach: callback => docs.forEach(callback), docChanges: () => changes });
        } catch (_) { fallback(); }
      }
    }
    if (!locks?.request || !Channel || !Controller || !root.crypto?.randomUUID) { fallback(); return stop; }
    try {
      sender = makeId(); controller = new Controller();
      channel = new Channel('rdc-admin-list-v1:' + uid + ':' + collection);
      channel.onmessage = event => receive(event.data);
      mode('waiting'); post({ type: 'request' });
      // Aba líder congelada/extensão incompatível não pode deixar a lista vazia.
      // É uma única contingência de compatibilidade, não polling do Firestore.
      fallbackTimer = root.setTimeout(() => { if (received < 0 && !leader) fallback(); }, 6000);
      // A trava é local ao navegador; não altera Firestore, regras ou App Check.
      locks.request('rdc-admin-list-v1:' + uid + ':' + collection, { signal: controller.signal }, async () => {
        if (!valid() || direct) return;
        root.clearTimeout(fallbackTimer);
        leader = true; records.clear(); mode('leader');
        const hold = new Promise(done => { release = done; });
        cancel = listen(snapshot => {
          if (!valid()) return;
          const full = !latest; latest = snapshot; sequence++;
          next(snapshot);
          try { post(pack(snapshot, full)); } catch (_) { post({ type: 'unsupported' }); }
        }, err => { if (valid()) { post({ type: 'error' }); error(err); } stop(); });
        // Um listener que falhou sincronicamente também deve ser encerrado.
        if (!valid()) { cancel?.(); release(); }
        await hold;
        cancel?.(); cancel = null; latest = null; leader = false;
      }).catch(err => { if (valid() && err?.name !== 'AbortError') fallback(); });
    } catch (_) { fallback(); }
    return stop;
  }
  root.RDCAdminSharedListener = { subscribe, encode, decode };
})(typeof window === 'undefined' ? globalThis : window);
