import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../admin-shared-listener.js';
const { subscribe, encode, decode } = globalThis.RDCAdminSharedListener;
const tick = () => new Promise(done => setImmediate(done));
function environment() {
  const channels = new Map(), slots = new Map();
  class Channel {
    constructor(name) { this.name = name; this.closed = false; if (!channels.has(name)) channels.set(name, new Set()); channels.get(name).add(this); }
    postMessage(data) { for (const peer of channels.get(this.name)) if (peer !== this)
      queueMicrotask(() => { if (!peer.closed) peer.onmessage?.({ data: structuredClone(data) }); }); }
    close() { this.closed = true; channels.get(this.name).delete(this); }
  }
  const locks = { request(name, { signal }, callback) {
    return new Promise((resolve, reject) => {
      const entry = { callback, resolve, reject, signal, active: false };
      if (!slots.has(name)) slots.set(name, []);
      const queue = slots.get(name); queue.push(entry);
      function drain() {
        const first = queue[0]; if (!first || first.active) return;
        if (first.signal.aborted) { queue.shift(); first.reject(Object.assign(Error(), { name: 'AbortError' })); drain(); return; }
        first.active = true;
        Promise.resolve().then(first.callback).then(first.resolve, first.reject).finally(() => { queue.shift(); drain(); });
      }
      signal.addEventListener('abort', () => { if (!entry.active) drain(); }, { once: true });
      drain();
    });
  } };
  return { locks, Channel };
}
function snapshot(values, changes) {
  const docs = values.map(([id, data]) => ({ id, data: () => data, metadata: { hasPendingWrites: false } }));
  return { docs, metadata: { fromCache: false, hasPendingWrites: false },
    docChanges: () => changes || docs.map((doc, newIndex) => ({ type: 'added', doc, newIndex, oldIndex: -1 })) };
}
function harness(env, uid = 'owner', collection = 'produtos') {
  const seen = [], modes = [], errors = [], subscriptions = [];
  const options = { ...env, session: () => uid, collection,
    listen: (next, error) => { const sub = { next, error, stopped: false }; subscriptions.push(sub); return () => { sub.stopped = true; }; },
    next: data => seen.push(data), error: error => errors.push(error), mode: mode => modes.push(mode),
    ref: id => ({ path: collection + '/' + id }), timestamp: (seconds, nanoseconds) => ({ seconds, nanoseconds, toDate: () => new Date(seconds * 1000) }) };
  return { options, seen, modes, errors, subscriptions, session: value => uid = value };
}

test('duas abas recebem a lista e alterações usando uma única assinatura de servidor', async () => {
  const env = environment(), first = harness(env), second = harness(env);
  const stop1 = subscribe(first.options), stop2 = subscribe(second.options);
  try {
    await tick(); assert.equal(first.subscriptions.length + second.subscriptions.length, 1);
    first.subscriptions[0].next(snapshot([['a', { titulo: 'Produto', preco: 123 }], ['b', { titulo: 'Outro', preco: 42 }]]));
    await tick(); assert.equal(second.seen.at(-1).size, 2); assert.equal(second.seen.at(-1).metadata.shared, true);
    const previous = first.seen.at(-1).docs[0];
    first.subscriptions[0].next(snapshot([['b', { titulo: 'Outro', preco: 42 }], ['a', { titulo: 'Produto', preco: 124 }]],
      [{ type: 'modified', doc: { id: 'a', data: () => ({ titulo: 'Produto', preco: 124 }) }, oldIndex: 0, newIndex: 1 }]));
    await tick(); const shared = second.seen.at(-1);
    assert.deepEqual(shared.docs.map(d => d.id), ['b', 'a']); assert.equal(shared.docs[1].data().preco, 124);
    assert.equal(shared.docs[1].ref.path, 'produtos/a'); assert.equal(shared.docChanges().length, 1);
    assert.equal(previous.data().preco, 123);
    first.subscriptions[0].next(snapshot([['a', { titulo: 'Produto', preco: 124 }]],
      [{ type: 'removed', doc: { id: 'b', data: () => ({ titulo: 'Outro', preco: 42 }) }, oldIndex: 0, newIndex: -1 }]));
    await tick(); assert.equal(second.seen.at(-1).size, 1);
    assert.equal(second.seen.at(-1).docChanges()[0].doc.data().preco, 42);
    assert.equal(second.subscriptions.length, 0);
  } finally { stop1(); stop2(); await tick(); }
});

test('aba aberta depois recebe a lista da memória; fechamento da líder transfere a assinatura', async () => {
  const env = environment(), first = harness(env), second = harness(env);
  const stop1 = subscribe(first.options); await tick();
  first.subscriptions[0].next(snapshot([['a', { preco: 9 }]]));
  const stop2 = subscribe(second.options);
  try {
    await tick(); assert.equal(second.seen.at(-1).docs[0].data().preco, 9); assert.equal(second.subscriptions.length, 0);
    stop1(); await tick(); assert.equal(first.subscriptions[0].stopped, true); assert.equal(second.subscriptions.length, 1);
    second.subscriptions[0].next(snapshot([['a', { preco: 10 }]]));
    assert.equal(second.seen.at(-1).docs[0].data().preco, 10);
  } finally { stop1(); stop2(); await tick(); }
});

test('sessões e coleções diferentes nunca compartilham listas; logout rejeita mensagens tardias', async () => {
  const env = environment(), one = harness(env), two = harness(env, 'other'), three = harness(env, 'owner', 'categorias');
  const stops = [one, two, three].map(h => subscribe(h.options));
  try {
    await tick(); assert.equal(two.subscriptions.length, 1); assert.equal(three.subscriptions.length, 1);
    one.session(''); one.subscriptions[0].next(snapshot([['secret', { preco: 9 }]])); await tick();
    assert.equal(one.seen.length + two.seen.length + three.seen.length, 0);
  } finally { stops.forEach(stop => stop()); await tick(); }
});

test('navegador sem coordenação conserva o listener normal e o erro original', () => {
  const h = harness({ locks: {}, Channel: null }); const stop = subscribe(h.options);
  const error = Error('original'); h.subscriptions[0].error(error);
  assert.equal(h.errors[0], error); assert.equal(h.modes[0], 'direct'); stop();
  assert.equal(h.subscriptions[0].stopped, true);
});

test('líder sem resposta inicial usa contingência uma única vez, sem deixar a tela vazia', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  class SilentChannel { postMessage() {} close() {} }
  const h = harness({ locks: { request: () => new Promise(() => {}) }, Channel: SilentChannel });
  const stop = subscribe(h.options);
  assert.equal(h.subscriptions.length, 0);
  t.mock.timers.tick(5999); assert.equal(h.subscriptions.length, 0);
  t.mock.timers.tick(1); assert.equal(h.subscriptions.length, 1);
  t.mock.timers.tick(60000); assert.equal(h.subscriptions.length, 1);
  h.subscriptions[0].next(snapshot([['a', { preco: 123 }]]));
  assert.equal(h.seen[0].docs[0].data().preco, 123);
  stop(); t.mock.timers.reset();
});

test('erro da líder é comunicado sem corpo sensível e encerra fila sem novas consultas', async () => {
  const env = environment(), first = harness(env), second = harness(env);
  const stops = [subscribe(first.options), subscribe(second.options)];
  await tick(); first.subscriptions[0].error(Error('private error body'));
  await tick(); assert.equal(first.errors[0].message, 'private error body');
  assert.doesNotMatch(second.errors[0].message, /private/); assert.equal(second.subscriptions.length, 0);
  stops.forEach(stop => stop()); await tick();
});

test('timestamps preservam precisão e objetos são cópias; tipos desconhecidos conservam caminho SDK', () => {
  const stamp = { seconds: 123, nanoseconds: 456, toDate() {} };
  const source = { titulo: 'Produto', data: stamp, lista: [false, null, 12] };
  const packed = encode(source), roundtrip = decode(packed, (seconds, nanoseconds) => ({ seconds, nanoseconds }));
  assert.deepEqual(roundtrip.data, { seconds: 123, nanoseconds: 456 }); assert.deepEqual(roundtrip.lista, [false, null, 12]);
  roundtrip.titulo = 'Changed'; assert.equal(decode(packed, () => {}).titulo, 'Produto');
  assert.throws(() => encode(new Date()), /não compartilhável/);
});

test('integração não modifica fila fresca, transações, dados em disco, autenticação ou cobrança', () => {
  const source = readFileSync('admin-shared-listener.js', 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|fetch\(|getToken|\b(?:db|transaction|database)\s*\.|\.collection\(/);
  const dashboard = readFileSync('dashboard.html', 'utf8'), mobile = readFileSync('painel-celular.html', 'utf8');
  assert.match(dashboard, /escutarListaAdmin\('produtos'/); assert.match(dashboard, /escutarListaAdmin\('categorias'/);
  assert.match(mobile, /getDocsFromServer\(collection\(db, 'produtos'\)\)/);
  assert.doesNotMatch(mobile, /RDCAdminSharedListener/);
  for (const html of [dashboard, mobile]) assert.match(html, /transaction\.get\(ref\)/);
});
