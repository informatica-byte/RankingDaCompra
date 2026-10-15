import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const context = { URL, URLSearchParams };
for (const file of ['product-offer-replacement.js', 'product-save-safety.js', 'express-existing-product.js']) {
  runInNewContext(readFileSync(file, 'utf8'), context);
}
const api = context.RDCExpressExisting;
const product = {
  titulo: 'Controle sem fio', link: 'https://produto.mercadolivre.com.br/MLB-123456789-controle-_JM',
  linkAfiliado: 'https://meli.la/original', foto: 'https://example.com/foto.jpg',
  preco: '150,00', precoPromocional: '130,00', precoAtualizadoManualmente: true,
  ofertaRelampagoAtiva: true, promocaoAtiva: true, categoria: 'games', comentario: 'Análise original',
  historicoAnuncios: [{ link: 'anuncio-antigo' }], campoPersonalizado: 'Preservar',
};
const serial = value => JSON.parse(JSON.stringify(value));
const input = (extra = {}) => ({ titulo: product.titulo, link: product.link, linkAfiliado: product.linkAfiliado, foto: product.foto, sameProduct: false, ...extra });

test('sem edição não produz gravação nem alteração de preço', () => {
  assert.deepEqual(serial(api.buildPatch(product, input(), 'agora')), { changes: {}, sourceChanged: false });
});
test('nome/foto alteram somente campos editados e preservam a oferta', () => {
  const result = api.buildPatch(product, input({ titulo: 'Nome corrigido', foto: 'https://example.com/outra.jpg' }), 'agora');
  assert.deepEqual(serial(result.changes), { titulo: 'Nome corrigido', foto: 'https://example.com/outra.jpg' });
  assert.equal(result.sourceChanged, false);
  assert.equal(product.ofertaRelampagoAtiva, true);
});
test('alterar só afiliado exige confirmação e não desconfirma o preço do mesmo anúncio', () => {
  assert.throws(() => api.buildPatch(product, input({ linkAfiliado: 'https://meli.la/novo' }), 'agora'), /Confirme/);
  assert.deepEqual(serial(api.buildPatch(product, input({ linkAfiliado: 'https://meli.la/novo', sameProduct: true }), 'agora').changes), { linkAfiliado: 'https://meli.la/novo' });
});
test('outro anúncio do mesmo produto invalida confirmação e ofertas antigas, sem apagar preço ou análise', () => {
  const result = api.buildPatch(product, input({ link: 'https://produto.mercadolivre.com.br/MLB-987654321-controle-_JM', linkAfiliado: 'https://meli.la/novo', sameProduct: true }), 'agora');
  assert.equal(result.sourceChanged, true);
  assert.equal(result.changes.mercadoLivreItemId, 'MLB987654321');
  assert.equal(result.changes.precoAtualizadoManualmente, false);
  assert.equal(result.changes.ofertaRelampagoAtiva, false);
  assert.equal(result.changes.promocaoAtiva, false);
  assert.equal(result.changes.anuncioSubstituidoEm, 'agora');
  for (const name of ['preco', 'precoPromocional', 'categoria', 'comentario', 'historicoAnuncios', 'campoPersonalizado']) assert.equal(name in result.changes, false);
});
test('links de anúncios diferentes são rejeitados', () => {
  assert.throws(() => api.buildPatch(product, input({ link: 'https://produto.mercadolivre.com.br/MLB-987654321-controle-_JM', linkAfiliado: 'https://produto.mercadolivre.com.br/MLB-123456789-controle-_JM', sameProduct: true }), 'agora'), /anúncios diferentes/);
});
test('nome vazio, longo e foto insegura não são salvos', () => {
  assert.throws(() => api.buildPatch(product, input({ titulo: '' }), 'agora'), /nome/);
  assert.throws(() => api.buildPatch(product, input({ titulo: 'a'.repeat(181) }), 'agora'), /180/);
  for (const foto of ['javascript:alert(1)', 'http://example.com/foto.jpg', 'https://user:pass@example.com/foto.jpg']) assert.throws(() => api.buildPatch(product, input({ foto }), 'agora'), /HTTPS/);
});
test('foto legada em imagem não é apagada ao carregar sem mudança', () => {
  const legacy = { ...product, foto: '', imagem: product.foto };
  assert.deepEqual(serial(api.buildPatch(legacy, input(), 'agora').changes), {});
});

function setup(read = async () => product, save = async () => {}) {
  const nodes = new Map();
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, { value: '', checked: false, hidden: true, disabled: false, className: '', textContent: '', handlers: {}, addEventListener(event, fn) { this.handlers[event] = fn; }, focus() { this.focused = true; } });
    return nodes.get(key);
  };
  const container = { hidden: false, classList: { add() {} }, querySelector: node, handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; } };
  const editor = api.mount(container, { read, save });
  const action = name => node('[data-action=' + name + ']');
  const field = name => node('[data-field="' + name + '"]');
  return { editor, container, node, action, field };
}
test('mostrar aviso não lê Firebase; carregar faz uma leitura específica e preenche o original', async () => {
  const reads = [];
  const ui = setup(async id => { reads.push(id); return product; });
  ui.editor.show('original');
  assert.equal(reads.length, 0);
  await ui.action('load').handlers.click();
  assert.deepEqual(reads, ['original']);
  assert.equal(ui.field('titulo').value, product.titulo);
  assert.equal(ui.field('linkAfiliado').value, product.linkAfiliado);
  assert.equal(ui.node('[data-editor]').hidden, false);
});
test('salvar usa o ID original e cliques repetidos não duplicam gravação', async () => {
  const calls = [];
  let finish;
  const ui = setup(undefined, (...args) => { calls.push(args); return new Promise(resolve => { finish = resolve; }); });
  ui.editor.show('original');
  await ui.action('load').handlers.click();
  ui.field('titulo').value = 'Correção';
  const pending = ui.action('save').handlers.click();
  await ui.action('save').handlers.click();
  assert.equal(ui.editor.isBusy(), true);
  assert.equal(ui.editor.reset(), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'original');
  assert.equal(calls[0][1].titulo, product.titulo);
  finish(); await pending;
  assert.equal(ui.editor.isBusy(), false);
  assert.equal(ui.node('[data-editor]').hidden, true);
});
test('falha no salvamento preserva campos editados para tentar novamente', async () => {
  const ui = setup(undefined, async () => { throw Error('offline'); });
  ui.editor.show('original'); await ui.action('load').handlers.click();
  ui.field('titulo').value = 'Minha edição';
  await ui.action('save').handlers.click();
  assert.equal(ui.field('titulo').value, 'Minha edição');
  assert.equal(ui.node('[data-editor]').hidden, false);
  assert.match(ui.node('[data-status]').textContent, /offline/);
});
test('excluído não é recriado e cancelar não grava', async () => {
  let writes = 0;
  const ui = setup(async () => null, async () => { writes++; });
  ui.editor.show('removido'); await ui.action('load').handlers.click();
  assert.match(ui.node('[data-status]').textContent, /excluído/);
  await ui.action('save').handlers.click();
  ui.action('cancel').handlers.click();
  assert.equal(writes, 0);
});
test('Enter no editor não dispara criação pelo formulário externo', () => {
  const ui = setup(); let prevented = false;
  ui.container.handlers.keydown({ key: 'Enter', target: { matches: () => true }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
});
test('integração mantém travas, atualização transacional, histórico e três caminhos de duplicidade', () => {
  const html = readFileSync('painel-celular.html', 'utf8');
  assert.match(html, /express-existing-product\.js\?v=20261015-1/);
  assert.match(html, /cadastroExistenteExpressa\.show\(existente\.id\)/);
  assert.match(html, /cadastroExistenteExpressa\.show\(resultado\.produtoExistenteId\)/);
  assert.match(html, /cadastroExistenteExpressa\.show\(cadastroDuplicadoId\)/);
  const save = html.slice(html.indexOf('save: async (id, baseline, input)'), html.indexOf('function lista('));
  assert.match(save, /assertUnchanged/);
  assert.match(save, /transaction\.update\(ref, changes\)/);
  assert.match(save, /historicoAnuncios = arrayUnion/);
  assert.match(save, /item\.id !== id/);
  assert.doesNotMatch(save, /addDoc|deleteDoc|transaction\.set/);
});

function adapter(current = product, duplicates = []) {
  const writes = [], reads = [], lookups = [];
  const ctx = { URL, URLSearchParams, Date, Error };
  for (const file of ['product-offer-replacement.js', 'product-save-safety.js', 'express-existing-product.js']) runInNewContext(readFileSync(file, 'utf8'), ctx);
  ctx.window = { RDCExpressExisting: ctx.RDCExpressExisting, RDCOfferReplacement: ctx.RDCOfferReplacement,
    RDCProductSaveSafety: ctx.RDCProductSaveSafety, RDCPricePublication: { saved() {} } };
  Object.assign(ctx, { auth: { currentUser: {} }, db: {}, automacaoPrecosAtiva: false, filaPrecosSalvando: false,
    publicacaoExpressaEmAndamento: false, rankingDadosMovel: {}, filaPrecosDados: null,
    doc: (_db, collection, id) => ({ collection, id }), collection: () => 'produtos',
    where: (...args) => args, limit: n => n, query: (...args) => args,
    getDocs: async q => { lookups.push(q); return { docs: duplicates.map(id => ({ id })) }; },
    serverTimestamp: () => 'SERVER_TIME', arrayUnion: value => ({ arrayUnion: value }),
    guardarPosicaoFilaPrecos() {},
    runTransaction: async (_db, callback) => callback({
      get: async ref => { reads.push(ref); return { exists: () => !!current, data: () => current }; },
      update: (ref, changes) => writes.push({ ref, changes }),
    }),
  });
  for (const key of ['filaPrecosConferidos', 'filaPrecosPulados', 'filaPrecosResultados', 'automacaoPrecosIndisponiveis', 'automacaoPrecosFalhas', 'automacaoPrecosVisitados']) ctx[key] = new Set();
  const html = readFileSync('painel-celular.html', 'utf8');
  const start = html.indexOf('save: async (id, baseline, input)');
  const end = html.indexOf('\n        },\n      });', start) + '\n        }'.length;
  assert.ok(start > 0 && end > start);
  const save = runInNewContext('({' + html.slice(start, end) + '}).save', ctx);
  return { save, writes, reads, lookups, ctx };
}
test('adapter real atualiza só nome/foto no documento original, sem consulta da coleção inteira', async () => {
  const db = adapter();
  await db.save('original', product, input({ titulo: 'Correção' }));
  assert.equal(db.lookups.length, 0);
  assert.deepEqual(db.reads.map(ref => ref.id), ['original']);
  assert.deepEqual(serial(db.writes), [{ ref: { collection: 'produtos', id: 'original' }, changes: { titulo: 'Correção', atualizadoEm: 'SERVER_TIME' } }]);
});
test('adapter recusa edição concorrente e documento excluído sem sobrescrever/recriar', async () => {
  for (const current of [null, { ...product, titulo: 'Editado em outro painel' }]) {
    const db = adapter(current);
    await assert.rejects(db.save('original', product, input({ titulo: 'Minha edição' })), /excluído|outra sessão/);
    assert.equal(db.writes.length, 0);
  }
});
test('adapter arquiva anúncio anterior e mantém o ID ao substituir', async () => {
  const db = adapter();
  await db.save('original', product, input({ link: 'https://produto.mercadolivre.com.br/MLB-987654321-controle-_JM', linkAfiliado: 'https://meli.la/novo', sameProduct: true }));
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0].ref.id, 'original');
  assert.equal(db.writes[0].changes.historicoAnuncios.arrayUnion.link, product.link);
  assert.equal(db.writes[0].changes.historicoAnuncios.arrayUnion.preco, product.preco);
  assert.equal(db.writes[0].changes.ofertaRelampagoAtiva, false);
  assert.equal('preco' in db.writes[0].changes, false);
});
test('adapter recusa novo link já usado por outro cadastro', async () => {
  const db = adapter(product, ['outro-produto']);
  await assert.rejects(db.save('original', product, input({ link: 'https://produto.mercadolivre.com.br/MLB-987654321-controle-_JM', linkAfiliado: 'https://meli.la/novo', sameProduct: true })), /outro cadastro/);
  assert.equal(db.writes.length, 0);
});
test('adapter exige login e não disputa salvamento com o robô', async () => {
  for (const field of ['auth', 'automacaoPrecosAtiva', 'filaPrecosSalvando', 'publicacaoExpressaEmAndamento']) {
    const db = adapter();
    db.ctx[field] = field === 'auth' ? { currentUser: null } : true;
    await assert.rejects(db.save('original', product, input({ titulo: 'Correção' })), /Entre|pause/);
    assert.equal(db.writes.length, 0);
  }
});
