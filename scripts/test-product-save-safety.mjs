import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { observedProductAliases } from './product-url-continuity.mjs';
import uniqueness from '../product-uniqueness.js';
import imageData from '../product-image-data.js';
const guard={...uniqueness,loadIndex:async()=>({version:1,entries:{}})};

const context = vm.createContext({ URL });
vm.runInContext(readFileSync(new URL('../product-save-safety.js', import.meta.url), 'utf8'), context);
const safety = context.RDCProductSaveSafety;
const dashboard = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const mobile = readFileSync(new URL('../painel-celular.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const serial = value => JSON.parse(JSON.stringify(value));
const listing = { marketplace: 'mercado_livre', link: 'https://produto.mercadolivre.com.br/MLB-1234567890-produto-_JM' };

test('a baseline is detached from mutable fields and canonicalizes stored objects', () => {
  const original = { titulo: 'Produto', nested: { z: 1, a: ['first'] }, updated: { toJSON: () => ({ seconds: 100, nanoseconds: 0 }) } };
  const baseline = safety.capture(original);
  original.nested.a.push('second');
  assert.deepEqual(serial(baseline.nested), { a: ['first'], z: 1 });
  assert.deepEqual(serial(baseline.updated), { nanoseconds: 0, seconds: 100 });
});

test('unrelated concurrent price, pause, link and date updates are preserved', () => {
  const old = { titulo: 'Produto', comentario: 'Resumo antigo', preco: '99,00', link: 'original', conferenciaPausada: false };
  const patch = { comentario: 'Resumo corrigido', atualizadoEm: 'SERVER_TIMESTAMP' };
  const latest = { ...old, preco: '80,00', link: 'novo', conferenciaPausada: true, precoAtualizadoManualmenteEm: '2026-10-14T10:00:00Z' };
  safety.assertUnchanged(latest, safety.capture(old), patch);
  const result = { ...latest, ...patch };
  for (const key of ['preco', 'link', 'conferenciaPausada', 'precoAtualizadoManualmenteEm']) assert.equal(result[key], latest[key]);
});

test('the same changed field conflicts without using unrelated timestamps', () => {
  const old = { comentario: 'A', atualizadoEm: 'yesterday' };
  assert.throws(() => safety.assertUnchanged({ comentario: 'B' }, safety.capture(old), { comentario: 'C', atualizadoEm: 'SERVER_TIMESTAMP' }), /mesmos campos.*comentario/);
  assert.doesNotThrow(() => safety.assertUnchanged({ ...old, atualizadoEm: 'just now' }, safety.capture(old), { comentario: 'C', atualizadoEm: 'SERVER_TIMESTAMP' }));
});

test('missing product or missing baseline never permits recreating an edited record', () => {
  assert.throws(() => safety.assertUnchanged(null, { titulo: 'A' }, { titulo: 'B' }), /excluído.*não foi recriado/);
  assert.throws(() => safety.assertUnchanged({ titulo: 'A' }, null, { titulo: 'B' }), /Abra a edição/);
});

test('stored baseline does not use formatted price or default photo', () => {
  const old = { precoAnterior: 123.45, imagem: 'fallback.jpg' };
  assert.doesNotThrow(() => safety.assertUnchanged(old, safety.capture(old), { precoAnterior: '120,00', foto: 'new.jpg' }));
  assert.throws(() => safety.assertUnchanged({ ...old, precoAnterior: 130 }, safety.capture(old), { precoAnterior: '120,00' }), /precoAnterior/);
});

test('seller item links converge to one new id across tracking variants and forms', () => {
  const variants = [listing.link, 'https://produto.mercadolivre.com.br/MLB1234567890-other-_JM?tracking=1',
    'https://www.mercadolivre.com.br/catalogo/p/MLB99999999?wid=MLB1234567890',
    'https://www.mercadolivre.com.br/catalogo/p/MLB99999999?pdp_filters=item_id%3AMLB-1234567890'];
  for (const link of variants) assert.equal(safety.creationId({ ...listing, link }), 'mlMLB1234567890');
});

test('new ids round-trip through actual generator, share links and legacy route lookup', () => {
  const product = { ...listing, id: safety.creationId(listing) };
  assert.match(product.id, /^[A-Za-z0-9]+$/);
  const catalogue = vm.createContext({ window: {} });
  vm.runInContext(readFileSync(new URL('../best-choices.js', import.meta.url), 'utf8'), catalogue);
  const sharePath = catalogue.window.RDCBestChoices.productUrl(product);
  assert.equal(sharePath, '/produto/mlMLB1234567890-20260810-1.html');
  const generator = readFileSync(new URL('./generate-sitemap.mjs', import.meta.url), 'utf8');
  const generateUrl = section(generator, 'function productDetailUrl(product)', 'function shareDay()');
  const generated = vm.createContext({ SITE: 'https://rankingdacompra.com.br/', SHARE_VERSION: '20260810-1', product });
  vm.runInContext(generateUrl, generated);
  assert.equal(generated.productDetailUrl(product), 'https://rankingdacompra.com.br' + sharePath);
  const filename = sharePath.slice('/produto/'.length);
  assert.equal(observedProductAliases([filename], [product]).get(filename).id, product.id);
});

test('catalog ids, short links, other marketplaces and lookalike hosts do not become seller ids', () => {
  for (const link of ['https://www.mercadolivre.com.br/catalogo/p/MLB1234567890', 'https://meli.la/test',
    'https://mercadolivre.com.br.evil.test/MLB1234567890', 'http://produto.mercadolivre.com.br/MLB1234567890', 'invalid']) {
    assert.equal(safety.creationId({ ...listing, link }), '');
    assert.deepEqual(serial(safety.duplicateLookups({ ...listing, link })), []);
  }
  assert.equal(safety.creationId({ ...listing, marketplace: 'shopee' }), '');
});

test('legacy ids are queried without migrating or rewriting them', () => {
  assert.deepEqual(serial(safety.duplicateLookups(listing)), [
    ['mercadoLivreItemId', 'MLB1234567890'], ['mercadoLivreItemId', 'MLB-1234567890'], ['link', listing.link],
  ]);
  assert.throws(() => safety.assertNew({ exists: true }), /já está cadastrado.*nenhum produto foi substituído/);
  assert.throws(() => safety.assertNew({ exists: () => true }), /já está cadastrado/);
  assert.doesNotThrow(() => safety.assertNew({ exists: false }));
  assert.doesNotThrow(() => safety.assertNew({ exists: () => false }));
});

function section(html, start, end) {
  const from = html.indexOf(start), until = html.indexOf(end, from);
  assert.ok(from >= 0 && until > from, start);
  return html.slice(from, until);
}

function memoryDatabase(initial = {}) {
  const docs = new Map(Object.entries(initial)), versions = new Map(), writes = [];
  const ref = id => ({ id });
  const transaction = async callback => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const reads = new Map(), pending = [];
      const tx = {
        get: async target => { reads.set(target.id, versions.get(target.id) || 0); const data = docs.get(target.id); return { exists: data != null, data: () => data }; },
        update: (target, patch) => pending.push({ kind: 'update', target, data: patch }),
        set: (target, data) => pending.push({ kind: 'set', target, data }),
      };
      await callback(tx);
      await Promise.resolve();
      if ([...reads].some(([id, version]) => version !== (versions.get(id) || 0))) continue;
      for (const op of pending) {
        docs.set(op.target.id, op.kind === 'update' ? { ...docs.get(op.target.id), ...op.data } : op.data);
        versions.set(op.target.id, (versions.get(op.target.id) || 0) + 1);
        writes.push(op);
      }
      return;
    }
    throw Error('too many retries');
  };
  return { docs, writes, ref, transaction };
}

const dashEdit = section(dashboard, 'const ref = db.collection("produtos").doc(idEdicao);', '\n                } else {');

test('dashboard production edit block rechecks latest fields and writes only a patch', async () => {
  const original = { titulo: 'A', preco: '10,00', comentario: 'old', precoAtualizadoManualmenteEm: 'old date' };
  const db = memoryDatabase({ oldRandomId: { ...original, preco: '9,00', precoAtualizadoManualmenteEm: 'today' } });
  const c = vm.createContext({ imagemLocal:null,idEdicao: 'oldRandomId', baseConcorrencia: safety.capture(original), camposEdicao: { comentario: 'new' },
    dadosProduto: { atualizadoEm: 'SERVER_TIMESTAMP' }, identidade:null, window: { RDCProductSaveSafety: safety },
    db: { collection: () => ({ doc: db.ref }), runTransaction: db.transaction } });
  await vm.runInContext('(async () => {' + dashEdit + '})()', c);
  assert.equal(db.docs.get('oldRandomId').comentario, 'new');
  assert.equal(db.docs.get('oldRandomId').preco, '9,00');
  assert.equal(db.docs.get('oldRandomId').precoAtualizadoManualmenteEm, 'today');
  assert.deepEqual(Object.keys(db.writes[0].data).sort(), ['atualizadoEm', 'comentario']);
});

test('dashboard production edit block refuses same-field conflicts and deleted records', async () => {
  for (const initial of [{ oldRandomId: { comentario: 'concurrent' } }, {}]) {
    const db = memoryDatabase(initial);
    const c = vm.createContext({ idEdicao: 'oldRandomId', baseConcorrencia: { comentario: 'old' }, camposEdicao: { comentario: 'new' },
      dadosProduto: { atualizadoEm: 'SERVER_TIMESTAMP' }, identidade:null, window: { RDCProductSaveSafety: safety },
      db: { collection: () => ({ doc: db.ref }), runTransaction: db.transaction } });
    await assert.rejects(vm.runInContext('(async () => {' + dashEdit + '})()', c), /mesmos campos|excluído/);
    assert.equal(db.writes.length, 0);
  }
});

test('mobile editor captures raw baseline and checks it inside the production transaction', async () => {
  assert.match(mobile, /baseConcorrencia = JSON\.stringify\(window\.RDCProductSaveSafety\.capture\(produto\)\)/);
  const editor = section(mobile, 'async function salvarEdicaoProdutoFilaPrecosAssistida()', 'async function excluirProdutoFilaPrecosAssistida(');
  const source = section(editor, 'const ref = doc(db, "produtos", id);\n          await runTransaction', '\n          const locais =');
  const original = { titulo: 'A', preco: '10,00' }, current = { ...original, preco: '9,00' };
  const db = memoryDatabase({ mobileId: current });
  const c = vm.createContext({ id: 'mobileId', baseConcorrencia: safety.capture(original), alterados: { titulo: 'B', atualizadoEm: 'SERVER_TIMESTAMP' },
    db: {}, identidade:null, doc: (_db, _name, id) => db.ref(id), window: { RDCProductSaveSafety: safety },
    runTransaction: (_db, callback) => db.transaction(async tx => callback({ ...tx, get: async ref => { const snap = await tx.get(ref); return { ...snap, exists: () => snap.exists }; } })) });
  await vm.runInContext('(async () => {' + source + '})()', c);
  assert.equal(db.docs.get('mobileId').preco, '9,00');
  assert.equal(db.docs.get('mobileId').titulo, 'B');
});

test('simultaneous creation retries cannot overwrite the first product', async () => {
  const db = memoryDatabase(), id = safety.creationId(listing);
  const create = data => db.transaction(async tx => {
    const target = db.ref(id);
    safety.assertNew(await tx.get(target));
    tx.set(target, data);
  });
  const results = await Promise.allSettled([create({ titulo: 'first' }), create({ titulo: 'second' })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal(db.docs.size, 1);
  assert.equal(db.writes.length, 1);
});

const dashCreate = section(dashboard, 'const identidade = await window.RDCProductUniqueness.prepare(dadosProduto,', '\n                }\n                resetarFormProduto();');
const mobileCreate = section(mobile, 'const identidade = await window.RDCProductUniqueness.prepare(d,', '\n          publicado = true;');
function productionCreation(db, { queryFailure = false, image = null } = {}) {
  const picker={urlFor:(value,id)=>imageData.urlFor(id,value.hash),queueRecord:(value,id)=>({...value,version:1,productId:id,mime:'image/jpeg'}),committed(){}};
  const queryExisting = async (field, value) => {
    if (queryFailure) throw Error('permission-denied');
    const matches = [...db.docs.entries()].filter(([, product]) => product[field] === value);
    return { empty: matches.length === 0, docs: matches.map(([id]) => ({ id })) };
  };
  const dashCollection = {
    doc: db.ref,
    where: (field, _operator, value) => ({ limit: () => ({ get: () => queryExisting(field, value) }) }),
    add: () => { throw Error('identified item must not use random add'); },
  };
  const dashboardCreate = product => {
    const c = vm.createContext({ imagemLocal:image,imagemProdutoDashboard:picker,dadosProduto: product, window: { RDCProductSaveSafety: safety,RDCProductUniqueness:guard,RDCProductImageData:imageData },
      firebase:{firestore:{FieldValue:{serverTimestamp:()=> 'TIME'}}},
      db: { collection: name => name==='produtos'?dashCollection:{doc:id=>db.ref('config:'+id)}, runTransaction: db.transaction } });
    vm.runInContext(section(dashboard,'async function protegerIdentidadeDashboard(', 'function autorizarOfertaExistenteDashboard('),c);
    return vm.runInContext('(async () => {' + dashCreate + '})()', c);
  };
  const mobileCreateProduct = product => {
    const c = vm.createContext({ imagemLocal:image,imagemProdutoMovel:picker,d: product, window: { RDCProductSaveSafety: safety,RDCProductUniqueness:guard,RDCProductImageData:imageData }, db: {},serverTimestamp:()=> 'TIME',
      collection: (_db, name) => name, where: (field, _operator, value) => ({ field, value }), limit: () => 1,
      query: (_collection, predicate) => predicate, getDocs: predicate => queryExisting(predicate.field, predicate.value),
      doc: (_db, name, id) => db.ref(name==='produtos'?id:'config:'+id), addDoc: () => { throw Error('identified item must not use random add'); },
      runTransaction: (_db, callback) => db.transaction(async tx => callback({ ...tx, get: async ref => { const snap = await tx.get(ref); return { ...snap, exists: () => snap.exists }; } })) });
    vm.runInContext(section(mobile,'async function protegerIdentidadeMovel(', 'let cats ='),c);
    return vm.runInContext('(async () => {' + mobileCreate + '})()', c);
  };
  return { dashboardCreate, mobileCreateProduct };
}

test('real creation blocks in both panels share the same unique item during a cross-device race', async () => {
  const db = memoryDatabase(), adapters = productionCreation(db);
  const results = await Promise.allSettled([
    adapters.dashboardCreate({ ...listing, titulo: 'dashboard' }), adapters.mobileCreateProduct({ ...listing, titulo: 'mobile' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal(db.writes.length, 2,'one product plus the atomic identity registry');
  assert.equal(db.docs.size, 2);
  assert.ok(db.docs.has('mlMLB1234567890'));
});

test('real creation blocks preserve old random ids and refuse a known legacy listing', async () => {
  const existing = { ...listing, mercadoLivreItemId: 'MLB-1234567890', titulo: 'original', preco: '9,00' };
  for (const name of ['dashboardCreate', 'mobileCreateProduct']) {
    const db = memoryDatabase({ oldRandomId: existing }), adapters = productionCreation(db);
    await assert.rejects(adapters[name]({ ...listing, titulo: 'new' }), /já está cadastrado/);
    assert.equal(db.writes.length, 0);
    assert.equal(db.docs.get('oldRandomId'), existing);
    assert.equal(db.docs.size, 1);
  }
});

test('legacy lookup failure fails closed instead of creating another product', async () => {
  for (const name of ['dashboardCreate', 'mobileCreateProduct']) {
    const db = memoryDatabase(), adapters = productionCreation(db, { queryFailure: true });
    await assert.rejects(adapters[name](listing), /permission-denied/);
    assert.equal(db.writes.length, 0);
  }
});

test('both panels use the guarded creation without a random-id fallback', () => {
  for (const html of [dashboard, mobile]) {
    assert.match(html, /src="\/product-save-safety\.js\?v=20261026-unique"/);
    assert.match(html, /RDCProductUniqueness\.prepare\(/);
    assert.match(html, /protegerIdentidade(?:Dashboard|Movel)\(transaction, identidade, idNovo/);
    assert.doesNotMatch(html,/else salvo = await addDoc|else await db\.collection\("produtos"\)\.add/);
    assert.match(html, /RDCProductSaveSafety\.duplicateLookups\(/);
    assert.match(html, /RDCProductSaveSafety\.assertNew\(await transaction\.get\(/);
    assert.match(html, /transaction\.set\(/);
  }
});
test('criação real com foto local grava somente URL no produto e imagem na fila, de forma atômica',async()=>{
 const image={hash:'a'.repeat(64),data:'QUJD',bytes:3,width:100,height:100};
 for(const name of ['dashboardCreate','mobileCreateProduct']){
  const db=memoryDatabase(),adapters=productionCreation(db,{image});await adapters[name]({...listing,preco:'9,00',linkAfiliado:'https://meli.la/preservado'});
  const id='mlMLB1234567890',product=db.docs.get(id),queue=db.docs.get('config:'+imageData.queueId(id));
  assert.equal(product.foto,imageData.urlFor(id,image.hash));assert.equal(product.preco,'9,00');assert.equal(product.linkAfiliado,'https://meli.la/preservado');assert.equal(product.data,undefined);assert.equal(product.hash,undefined);
  assert.equal(queue.data,image.data);assert.equal(queue.productId,id);assert.equal(db.writes.length,3);
 }
 const existing={...listing,titulo:'existente'},db=memoryDatabase({oldRandomId:existing}),adapters=productionCreation(db,{image});await assert.rejects(adapters.dashboardCreate({...listing}),/já está cadastrado/);assert.equal(db.writes.length,0,'nenhuma foto órfã quando o produto é duplicado');
});
