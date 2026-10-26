import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import removal from '../product-removal-safety.js';

const safetyContext = vm.createContext({ URL });
vm.runInContext(readFileSync(new URL('../product-save-safety.js', import.meta.url), 'utf8'), safetyContext);

const html = readFileSync(new URL('../painel-celular.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const section = (start, end) => {
  const first = html.indexOf(start), last = html.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `real panel source: ${start}`);
  return html.slice(first, last);
};
const photoSource = section('function limparFotoPrevia()', 'function instalarModoEconomicoMobile()');
const inputSource = section('$("foto").oninput =', 'document.querySelectorAll("#preview input');

function photos() {
  const fields = new Map(), timers = new Map();
  let sequence = 0;
  const field = id => {
    if (!fields.has(id)) fields.set(id, { value: '', style: {}, naturalWidth: 100, naturalHeight: 100, removeAttribute() {} });
    return fields.get(id);
  };
  const context = vm.createContext({
    fotoPreviaTentativa: 0, fotoPreviaTimer: 0, fotoPreviaDebounce: 0, fotoPreviaResolver: null,
    edicaoManual: false, $: field,
    setTimeout: callback => { const id = ++sequence; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
  });
  vm.runInContext(photoSource + '\n' + inputSource, context);
  return { context, field, timers };
}

test('a replacement photo check settles the old check and leaves only the current timer', async () => {
  const s = photos();
  let previous;
  s.context.carregarFotoPrevia('https://example.test/first.jpg').then(value => { previous = value; });
  const current = s.context.carregarFotoPrevia('https://example.test/current.jpg');
  await Promise.resolve();
  assert.equal(previous, false, 'superseded validation must not hang its caller');
  assert.equal(s.timers.size, 1);
  s.field('foto-previa').onload();
  assert.equal(await current, true);
  assert.equal(s.timers.size, 0);
});

test('clearing the preview settles a pending photo check without an error or stale handlers', async () => {
  const s = photos();
  let result;
  s.context.carregarFotoPrevia('https://example.test/first.jpg').then(value => { result = value; });
  s.context.limparFotoPrevia();
  await Promise.resolve();
  assert.equal(result, false);
  assert.equal(s.field('foto-erro').className, 'foto-erro');
  assert.equal(s.field('foto-previa').onload, null);
  assert.equal(s.timers.size, 0);
});

test('editing the photo settles active validation before scheduling its debounced replacement', async () => {
  const s = photos();
  let result;
  s.context.carregarFotoPrevia('https://example.test/first.jpg').then(value => { result = value; });
  s.field('foto').value = 'https://example.test/edited.jpg';
  s.field('foto').oninput();
  await Promise.resolve();
  assert.equal(result, false);
  assert.equal(s.timers.size, 1, 'only the new debounce timer remains');
});

const saveSource = section('async function salvarFilaPrecoAssistida(', 'function separarProdutoAutomacao(');
const deleteSource = section('async function excluirProdutoFilaPrecosAssistida(', '$("precos-pausados").addEventListener');
const controlsSource = section('function atualizarControlesAutomacaoPrecos()', 'function guardarPosicaoFilaPrecos()');
function queue(fail = false) {
  const fields = new Map(), writes = [], product = { id: 'p', titulo: 'Produto', link: 'https://example.test/p', preco: '10,00' };
  const pausedControls = ['abrir', 'reativar', 'substituir'].map(acao => ({
    dataset: { pausaAcao: acao, produtoId: 'p' }, disabled: false,
  }));
  const field = id => {
    if (!fields.has(id)) fields.set(id, { disabled: false, scrollIntoView() {} });
    return fields.get(id);
  };
  const context = vm.createContext({
    filaPrecosSalvando: false, filaPrecosDados: { todos: [product], produtos: [product] }, filaPrecosIdAtual: 'p',
    filaPrecosConferidos: new Set(), filaPrecosPulados: new Set(), filaPrecosResultados: new Map(),
    automacaoPrecosFalhas: new Map(), automacaoPrecosIndisponiveis: new Map(),
    automacaoPrecosAtiva: false, automacaoPrecosPausada: false, publicacaoExpressaEmAndamento: false,
    auth: {currentUser:{uid:'admin-test'}}, rankingDadosMovel:null, produtosRelampagoCacheMobile:null, automacaoPrecosVisitados:new Set(), economiaLeiturasMovel:{invalidate:key=>assert.equal(key,'produtos')},
    window: { RDCProductRemoval: removal, conferirPrecoNaAbaLocal() {}, RDCAssistedPriceSafety: { robotReady: () => true } },
    $: field, db: {}, crypto: { randomUUID: () => 'confirmation-id' }, confirm: () => true, prompt:()=> 'EXCLUIR p',
    linkPrecoAssistido: p => p.link, campoPrecoFila: () => 'preco',
    numero: v => Number(String(v).replace(',', '.')), preco: v => String(v), serverTimestamp: () => 'SERVER_TIMESTAMP',
    doc: (_db, collection, id) => ({ collection, id }), msg() {}, guardarPosicaoFilaPrecos() {},
    updateDoc: async (ref, patch) => { if (fail) throw Error('offline'); writes.push({ ref, patch }); },
    deleteDoc: async ref => { if (fail) throw Error('offline'); writes.push({ ref }); },
    runTransaction: async (_db,work) => {
      const pending=[];
      const result=await work({
        get:async ref=>({exists:()=>ref.collection==='produtos',data:()=>({...product})}),
        set:(ref,patch)=>pending.push({ref,patch}),delete:ref=>pending.push({ref,deleted:true})
      });
      if(fail)throw Error('offline');
      writes.push(...pending);return result;
    },
    renderizarFilaPrecosAssistida() { context.atualizarControlesAutomacaoPrecos(); },
  });
  // The replacement form is absent in this normal queue, as in the real DOM.
  context.$ = id => ['precos-substituicao', 'precos-editor'].includes(id) ? null
    : id === 'precos-pausados-lista' ? { querySelectorAll: () => pausedControls } : field(id);
  vm.runInContext(controlsSource + '\n' + saveSource + '\n' + deleteSource, context);
  return { context, field, writes, product, pausedControls };
}

for (const fail of [false, true]) {
  test(`manual queue save restores update controls after ${fail ? 'failure' : 'success'}`, async () => {
    const s = queue(fail);
    assert.equal(await s.context.salvarFilaPrecoAssistida(null), !fail);
    assert.equal(s.context.filaPrecosSalvando, false);
    assert.equal(s.field('precos-iniciar').disabled, false);
    assert.equal(s.field('precos-auto-iniciar').disabled, false);
    assert.ok(s.pausedControls.every(button => !button.disabled));
    assert.equal(s.writes.length, fail ? 0 : 1);
    if (!fail) assert.equal(s.writes[0].patch.preco, undefined, 'unchanged price is not rewritten');
  });
  test(`queue deletion restores update controls after ${fail ? 'failure' : 'success'}`, async () => {
    const s = queue(fail);
    await s.context.excluirProdutoFilaPrecosAssistida();
    assert.equal(s.context.filaPrecosSalvando, false);
    assert.equal(s.field('precos-iniciar').disabled, false);
    assert.equal(s.field('precos-auto-iniciar').disabled, false);
    assert.ok(s.pausedControls.filter(button => button.dataset.pausaAcao !== 'abrir').every(button => !button.disabled));
    assert.equal(s.writes.length, fail ? 0 : 2);
    if(!fail){assert.equal(s.writes[0].ref.id,'exclusoes-definitivas');assert.deepEqual(s.writes[0].patch.ids,['p']);assert.equal(s.writes[1].deleted,true);}
  });
}

test('permanent deletion cancellation, mistyped confirmation and busy conference never write',async()=>{
  for(const setup of [c=>c.confirm=()=>false,c=>c.prompt=()=> 'EXCLUIR outro',c=>c.automacaoPrecosAtiva=true,c=>c.automacaoPrecosPausada=true,c=>c.auth.currentUser=null]){
    const s=queue();setup(s.context);await s.context.excluirProdutoFilaPrecosAssistida();assert.equal(s.writes.length,0);
  }
});

const editSource = section('async function salvarEdicaoProdutoFilaPrecosAssistida()', 'async function excluirProdutoFilaPrecosAssistida(');
const editFinally = editSource.match(/} finally {([\s\S]*?)\n        }\n      }\s*$/)?.[1];
assert.ok(editFinally, 'real editor recovery block');

for (const fail of [false, true]) {
  test(`product editor restores all queue controls after ${fail ? 'failure' : 'success'}`, () => {
    const s = queue(false);
    s.context.filaPrecosSalvando = true;
    const ids = ['precos-iniciar', 'precos-reconferir-hoje', 'precos-auto-limite', 'precos-auto-revisar', 'precos-ed-salvar', 'precos-ed-cancelar'];
    for (const id of ids) s.field(id).disabled = true;
    vm.runInContext(`try { ${fail ? 'throw Error("offline");' : ''} } catch (_) {} finally { ${editFinally} }`, s.context);
    assert.equal(s.context.filaPrecosSalvando, false);
    for (const id of ids) assert.equal(s.field(id).disabled, false, id);
  });
}

test('editor recovery does not unlock queue options while automation is active', () => {
  const s = queue(false);
  s.context.filaPrecosSalvando = true;
  s.context.automacaoPrecosAtiva = true;
  vm.runInContext(`try {} finally { ${editFinally} }`, s.context);
  assert.equal(s.context.filaPrecosSalvando, false);
  for (const id of ['precos-iniciar', 'precos-reconferir-hoje', 'precos-auto-limite', 'precos-auto-revisar']) {
    assert.equal(s.field(id).disabled, true, id);
  }
});

const publishSource = section('$("preview").onsubmit =', '$("limpar").onclick =');
const resetSource = section('$("limpar").onclick =', '$("publicacao-abrir-produto").onclick =');
function publication({ validPhoto = true, failWrite = false } = {}) {
  const fields = new Map(), writes = [], photoWaiters = [], messages = [];
  const initial = {
    titulo: 'Produto', categoria: 'cat', atual: '10,00', anterior: '20,00', foto: 'https://example.test/photo.jpg',
    resumo: 'Descrição real '.repeat(20), pros: 'Ponto positivo real '.repeat(5), contras: 'Atenção real '.repeat(8),
    dados: ['Ficha técnica real suficientemente longa para validação.', 'Segundo dado real do produto.', 'Terceiro dado real do produto.'].join('\n'),
  };
  const field = id => {
    if (!fields.has(id)) fields.set(id, { value: initial[id] || '', disabled: false, textContent: '' });
    return fields.get(id);
  };
  const context = vm.createContext({
    resultado: { link: 'https://example.test/p', linkAfiliado: 'https://example.test/a', tipo: 'relampago', marketplace: 'mercado_livre', evidencia: 'manual' },
    publicacaoExpressaEmAndamento: false, $: field, db: {}, window: { RDCProductSaveSafety: safetyContext.RDCProductSaveSafety }, console,
    cadastroExistenteExpressa: { isBusy: () => false, show() {}, reset() {} },
    cats: [{ id: 'cat', nome: 'Categoria válida' }], categoriasMovel: { load: async () => true },
    numero: v => Number(String(v).replace(',', '.')), preco: v => String(v), hoje: () => '2026-10-14',
    mlb: () => 'MLB1234567', seg: () => 60, lista: v => v.split('\n'), serverTimestamp: () => 'SERVER_TIMESTAMP',
    collection: (_db, name) => name, msg: (...args) => messages.push(args),
    carregarFotoPrevia: () => new Promise(resolve => { photoWaiters.push(() => resolve(validPhoto)); }),
    addDoc: async (collection, data) => { if (failWrite) throw Error('offline'); writes.push({ collection, data }); return { id: 'new-product' }; },
  });
  vm.runInContext(publishSource + '\n' + resetSource, context);
  return { context, field, writes, photoWaiters, messages };
}
const submit = s => s.field('preview').onsubmit({ preventDefault() {} });

test('express publication refuses a category absent from the loaded registry without resetting fields', async () => {
  const s = publication();
  s.field('categoria').value = 'removed';
  await submit(s);
  assert.equal(s.writes.length, 0);
  assert.equal(s.photoWaiters.length, 0);
  assert.equal(s.field('titulo').value, 'Produto');
  assert.equal(s.field('atual').value, '10,00');
  assert.match(s.messages.at(-1)[1], /categoria.*campos preenchidos foram mantidos/);
});

test('express publication locks before photo validation and cannot create duplicate products', async () => {
  const s = publication();
  const first = submit(s);
  assert.equal(s.field('publicar').disabled, true, 'lock is acquired before the first await');
  assert.equal(s.field('limpar').disabled, true);
  assert.equal(s.field('analisar').disabled, true);
  const original = s.context.resultado;
  s.field('limpar').onclick();
  assert.equal(s.context.resultado, original, 'reset cannot discard the active publication');
  await submit(s);
  assert.equal(s.photoWaiters.length, 1);
  s.photoWaiters.shift()();
  await first;
  assert.equal(s.writes.length, 1);
  assert.equal(s.field('limpar').disabled, false);
  assert.equal(s.field('analisar').disabled, false);
  assert.equal(s.writes[0].collection, 'produtos');
  await submit(s);
  assert.equal(s.photoWaiters.length, 0, 'already-published review stays locked until reset');
  assert.equal(s.writes.length, 1);
});

for (const options of [{ validPhoto: false }, { failWrite: true }]) {
  test(`express publication permits retry after ${options.validPhoto === false ? 'photo validation' : 'write'} failure`, async () => {
    const s = publication(options), pending = submit(s);
    s.photoWaiters.shift()();
    await pending;
    assert.equal(s.field('publicar').disabled, false);
    assert.equal(s.context.publicacaoExpressaEmAndamento, false);
    assert.equal(s.writes.length, 0);
    assert.equal(s.messages.at(-1)[2], 'erro');
  });
}
