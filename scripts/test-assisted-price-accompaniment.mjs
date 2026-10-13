import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../painel-celular.html', import.meta.url), 'utf8');
function source(start, end) {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, start);
  return html.slice(from, to);
}
const controllerSource = source('function criarAcompanhamentoPrecoAssistido()', 'const acompanhamentoPrecos =');
const saveSource = source('async function salvarFilaPrecoAssistida', 'function separarProdutoAutomacao');
const runSource = source('function separarProdutoAutomacao', 'function iniciarAutomacaoPrecosAssistida');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function setup({ count = 55, limit = 50, review = false, query } = {}) {
  const products = Array.from({ length: count }, (_, index) => ({ id: 'item-' + index, titulo: 'Produto ' + index, preco: 100, link: 'https://produto.mercadolivre.com.br/MLB-' + (1000000 + index) }));
  const writes = [], requests = [], proposals = [], validations = [], fields = new Map();
  const c = vm.createContext({
    console, Date, Number, Promise, Set, Map,
    crypto: { randomUUID: () => 'confirmation-' + writes.length },
    filaPrecosDados: { todos: products }, filaPrecosIdAtual: '', filaPrecosSalvando: false,
    filaPrecosConferidos: new Set(), filaPrecosPulados: new Set(), filaPrecosResultados: new Map(),
    automacaoPrecosAtiva: true, automacaoPrecosPausada: false,
    automacaoPrecosVisitados: new Set(), automacaoPrecosFalhas: new Map(), automacaoPrecosIndisponiveis: new Map(),
    db: {}, doc: (_db, _collection, id) => ({ id }), serverTimestamp: () => new Date(),
    updateDoc: async (ref, patch) => { writes.push({ id: ref.id, patch }); },
    numero: value => Number(value), preco: value => Number(value), campoPrecoFila: () => 'preco', linkPrecoAssistido: product => product.link,
    $: id => { if (!fields.has(id)) fields.set(id, { disabled: false, value: 999 }); return fields.get(id); },
    msg: () => {}, guardarPosicaoFilaPrecos: () => {}, atualizarControlesAutomacaoPrecos: () => {},
    resumoAutomacaoPrecos: text => { c.lastSummary = text; }, rankingEsc: String, esperar: async () => {},
    limparPropostaRevisaoPrecos: () => { c.propostaRevisaoPrecos = null; },
    mostrarPropostaRevisaoPrecos: (product, result, round) => { c.propostaRevisaoPrecos = { produtoId: product.id, rodada: round }; proposals.push({ product, result, round }); },
    validProof: true,
  });
  c.window = {
    __RDC_BOT_PRECOS_LOCAL__: { version: '2.4.1' },
    RDCAssistedPriceSafety: { validate: (result, expected) => { validations.push({ result, expected }); return c.validProof ? '' : 'Resposta antiga: preço preservado.'; } },
    conferirPrecoNaAbaLocal: async request => {
      requests.push(request);
      return query ? query(request, requests.length) : { status: 'ok', preco: 125, fonteConsultada: request.url, evidencia: 'Preço principal', proofVersion: 3 };
    },
  };
  c.dadosFilaPrecosAssistida = () => ({ pendentes: products.filter(product => !c.filaPrecosConferidos.has(product.id)).sort((a, b) => Number(c.filaPrecosPulados.has(a.id)) - Number(c.filaPrecosPulados.has(b.id))) });
  c.renderizarFilaPrecosAssistida = () => {
    const pending = c.dadosFilaPrecosAssistida().pendentes;
    c.filaPrecosIdAtual = pending.find(product => product.id === c.filaPrecosIdAtual)?.id || pending[0]?.id || '';
  };
  vm.runInContext(controllerSource + '\nvar acompanhamentoPrecos = criarAcompanhamentoPrecoAssistido();\nvar automacaoPrecosRodada = acompanhamentoPrecos.iniciar({limite:' + limit + ',revisar:' + review + '});\n' + saveSource + runSource, c);
  return { c, writes, requests, proposals, validations, fields };
}

test('default 50 bounds unique attempts, including failed and unavailable products', async () => {
  const { c, writes, requests } = setup({ query: (request, index) => index === 1 ? { status: 'error', motivo: 'Falha' } : index === 2 ? { status: 'unavailable' } : { status: 'ok', preco: 125, fonteConsultada: request.url, proofVersion: 3 } });
  await c.executarAutomacaoPrecosAssistida();
  assert.equal(requests.length, 50);
  assert.equal(new Set(requests.map(request => request.produtoId)).size, 50);
  assert.equal(writes.length, 48);
  assert.equal(c.acompanhamentoPrecos.estado().tentados, 50);
  assert.equal(c.automacaoPrecosFalhas.size, 1);
  assert.equal(c.automacaoPrecosIndisponiveis.size, 1);
  assert.match(c.lastSummary, /Limite.*atingido/);
  assert.equal(c.filaPrecosConferidos.has('item-50'), false);
});

test('accompanied loop waits without writes; explicit approval saves proof value, not hidden input', async () => {
  const { c, writes, requests, proposals, fields } = setup({ count: 1, review: true });
  const running = c.executarAutomacaoPrecosAssistida();
  await tick();
  assert.equal(requests.length, 1);
  assert.equal(proposals.length, 1);
  assert.equal(writes.length, 0);
  c.renderizarFilaPrecosAssistida();
  await tick();
  assert.equal(writes.length, 0, 'rerender must never approve a proposal');
  fields.set('precos-valor-visto', { value: 999 });
  const { round, product } = proposals[0];
  assert.equal(c.acompanhamentoPrecos.decidir(round, product.id, true), true);
  assert.equal(c.acompanhamentoPrecos.decidir(round, product.id, true), false, 'double click is ignored');
  await running;
  assert.equal(writes.length, 1);
  assert.equal(writes[0].patch.preco, 125);
  assert.equal(c.filaPrecosResultados.get(product.id).status, 'confirmado');
});

test('skip keeps product pending and records outcome without any Firebase write', async () => {
  const { c, writes, proposals } = setup({ count: 1, review: true });
  const running = c.executarAutomacaoPrecosAssistida();
  await tick();
  const { round, product } = proposals[0];
  assert.equal(c.acompanhamentoPrecos.decidir(round, product.id, false), true);
  await running;
  assert.equal(writes.length, 0);
  assert.equal(c.filaPrecosConferidos.size, 0);
  assert.equal(c.filaPrecosResultados.get(product.id).status, 'pulado_sem_gravacao');
  assert.equal(product.preco, 100);
});

test('stop discards unresolved approval; old and wrong-product decisions cannot save', async () => {
  const { c, writes, proposals } = setup({ count: 1, review: true });
  const running = c.executarAutomacaoPrecosAssistida();
  await tick();
  const { round, product } = proposals[0];
  assert.equal(c.acompanhamentoPrecos.decidir(round, 'other-product', true), false);
  c.pararAutomacaoPrecosAssistida();
  await running;
  assert.equal(c.acompanhamentoPrecos.decidir(round, product.id, true), false);
  assert.equal(writes.length, 0);
  assert.equal(c.propostaRevisaoPrecos, null);
});

test('late response from stopped round is discarded before gate and save', async () => {
  const late = deferred();
  const { c, writes, proposals } = setup({ count: 1, review: true, query: () => late.promise });
  const running = c.executarAutomacaoPrecosAssistida();
  await tick();
  c.pararAutomacaoPrecosAssistida();
  late.resolve({ status: 'ok', preco: 125, proofVersion: 3 });
  await running;
  assert.equal(writes.length, 0);
  assert.equal(proposals.length, 0);
});

test('changed current product cannot approve or save old proposal', async () => {
  const { c, writes, proposals } = setup({ count: 2, review: true });
  const running = c.executarAutomacaoPrecosAssistida();
  await tick();
  const { round, product } = proposals[0];
  c.filaPrecosIdAtual = 'item-1';
  c.acompanhamentoPrecos.decidir(round, product.id, true);
  await running;
  assert.equal(writes.length, 0);
});

test('approval revalidates delayed proof immediately before writing', async () => {
  const { c, writes, proposals, validations } = setup({ count: 1, review: true });
  const running = c.executarAutomacaoPrecosAssistida();
  await tick();
  assert.equal(validations.length, 1);
  c.validProof = false;
  const { round, product } = proposals[0];
  c.acompanhamentoPrecos.decidir(round, product.id, true);
  await running;
  assert.equal(validations.length, 2);
  assert.equal(writes.length, 0);
  assert.equal(product.preco, 100);
});

test('CAPTCHA retry resumes frozen settings and does not consume another unique attempt', async () => {
  let blocked = false;
  const { c, writes, requests } = setup({ count: 3, limit: 2, query: request => {
    if (request.produtoId === 'item-1' && !blocked) { blocked = true; return { status: 'security' }; }
    return { status: 'ok', preco: 125, fonteConsultada: request.url, proofVersion: 3 };
  } });
  await c.executarAutomacaoPrecosAssistida();
  assert.equal(c.automacaoPrecosPausada, true);
  assert.equal(c.acompanhamentoPrecos.estado().tentados, 2);
  c.automacaoPrecosRodada = c.acompanhamentoPrecos.iniciar({ limite: 999, revisar: true }, true);
  c.automacaoPrecosAtiva = true; c.automacaoPrecosPausada = false;
  await c.executarAutomacaoPrecosAssistida();
  assert.deepEqual(requests.map(request => request.produtoId), ['item-0', 'item-1', 'item-1']);
  assert.equal(writes.length, 2);
  assert.equal(c.acompanhamentoPrecos.estado().limite, 2);
  assert.equal(c.acompanhamentoPrecos.estado().revisar, false);
  assert.equal(c.acompanhamentoPrecos.estado().tentados, 2);
});

test('visible controls default to 50; active and CAPTCHA-paused jobs freeze settings', () => {
  assert.match(html, /id="precos-auto-limite"[^>]*value="50"/);
  assert.match(html, /id="precos-auto-revisar"[^>]*type="checkbox"/);
  assert.match(html, /Revisar cada resultado antes de salvar/);
  assert.match(html, /const bloqueado = automacaoPrecosAtiva \|\| automacaoPrecosPausada/);
  assert.match(html, /\["precos-iniciar", "precos-reconferir-hoje", "precos-auto-limite", "precos-auto-revisar"\]/);
  assert.match(html, /data-decisao-preco="aprovar"/);
  assert.match(html, /data-decisao-preco="pular"/);
});
