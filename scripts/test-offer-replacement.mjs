import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import replacement from '../product-offer-replacement.js';
import choices from '../best-choices.js';
import { publicCatalogue } from './public-catalogue.mjs';

const html = readFileSync(new URL('../painel-celular.html', import.meta.url), 'utf8');
const product = { id: 'p', titulo: 'Fone modelo X preto', link: 'https://produto.mercadolivre.com.br/MLB-123456789-fone-_JM', linkAfiliado: 'https://meli.la/antigo',
  categoria: 'fones', preco: '99,90', precoPromocional: '89,90', precoAnterior: '119,90', promocaoAtiva: true, ofertaRelampagoAtiva: true,
  precoAtualizadoManualmente: true, precoAtualizadoManualmenteEm: '2026-10-06T10:00:00Z', precoConferenciaId: 'old-proof',
  precoConferidoPor: 'manual', precoProvaAnuncio: 'MLB123456789', comentario: 'Análise preservada', productUrl: '/produto/p.html',
  foto: 'https://cdn.example/fone.jpg', youtubeVideoId: 'video', linkShopee: 'https://shopee.com.br/fone', historicoAnuncios: [{ link: 'anterior' }] };
const input = { link: 'https://produto.mercadolivre.com.br/MLB-987654321-fone-_JM', linkAfiliado: 'https://meli.la/novo', sameProduct: true };
const when = '2026-10-06T12:00:00Z';

test('same product replacement changes links and listing without changing identity, content, prices or other stores', () => {
  const patch = replacement.buildPatch(product, input, when), result = { ...product, ...patch };
  assert.equal(result.mercadoLivreItemId, 'MLB987654321');
  for (const field of ['id','titulo','categoria','preco','precoPromocional','precoAnterior','comentario','productUrl','foto','youtubeVideoId','linkShopee','historicoAnuncios']) assert.deepEqual(result[field], product[field], field);
  assert.equal(result.precoAtualizadoManualmente, false);
  assert.equal(result.precoAtualizadoManualmenteEm, null);
  assert.equal(result.precoConferenciaId, '');
  assert.equal(result.promocaoAtiva, false);
  assert.equal(result.ofertaRelampagoAtiva, false);
  assert.equal(product.precoAtualizadoManualmente, true, 'input object is not mutated');
});
test('archive preserves previous links, confirmation proof and prices', () => {
  const archived = replacement.previousOffer(product, when);
  for (const field of ['link','linkAfiliado','preco','precoAtualizadoManualmenteEm','precoConferenciaId','precoProvaAnuncio']) assert.equal(archived[field], product[field]);
  assert.equal(archived.substituidoEm, when);
});
test('different products and unchanged links require a new registration or cancel', () => {
  assert.throws(() => replacement.validate(product, { ...input, sameProduct: false }), /novo cadastro/);
  assert.throws(() => replacement.validate(product, { ...product, sameProduct: true }), /iguais/);
});
test('rejects malicious URLs, non-HTTPS, URL credentials and shortened original announcements', () => {
  for (const link of ['javascript:alert(1)','http://produto.mercadolivre.com.br/x','https://mercadolivre.com.br.evil.test/x','https://user:pass@www.mercadolivre.com.br/x','https://www.mercadolivre.com.br:444/x','https://meli.la/curto','https://shopee.com.br/x']) {
    assert.throws(() => replacement.validate(product, { ...input, link }), /completo HTTPS/);
  }
  assert.throws(() => replacement.validate(product, { ...input, linkAfiliado: 'https://evil.test/x' }), /afiliado HTTPS/);
  assert.throws(() => replacement.validate(product, { ...input, linkAfiliado: input.link }), /link comum/);
});
test('known listing mismatch is rejected; short affiliate link still requires human confirmation', () => {
  assert.throws(() => replacement.validate(product, { ...input, linkAfiliado: product.link }), /anúncios diferentes/);
  assert.equal(replacement.validate(product, input).linkAfiliado, input.linkAfiliado);
});
test('catalog ID is not confused with seller listing and supports item_id, wid and variations', () => {
  assert.equal(replacement.listing('https://www.mercadolivre.com.br/p/MLB12345678'), '');
  assert.equal(replacement.listing('https://www.mercadolivre.com.br/p/MLB12345678?pdp_filters=item_id:MLB987654321'), 'MLB987654321');
  assert.equal(replacement.listing('https://www.mercadolivre.com.br/p/MLB12345678#wid=MLB987654321'), 'MLB987654321');
  assert.throws(() => replacement.listing(input.link + '?wid=MLB222222222'), /códigos/);
});
test('old unavailable or price statuses cannot affect the new offer', () => {
  const changed = { ...product, ...replacement.buildPatch(product, input, when) };
  const old = { managed: true, status: 'active', available: true, visible: true, price: 90, checkedAt: '2026-10-06T11:00:00Z' };
  assert.equal(replacement.statusFor(changed, old), null);
  assert.equal(replacement.statusFor(changed, { ...old, visible: false }), null);
  assert.equal(replacement.statusFor(changed, { ...old, checkedAt: when }), null);
  const recent = { ...old, checkedAt: '2026-10-06T12:01:00Z' };
  assert.equal(replacement.statusFor(changed, recent), recent);
  assert.equal(replacement.statusFor(product, old), old, 'legacy products unchanged');
  assert.equal(choices.priceState(changed, old, Date.parse('2026-10-06T12:05:00Z')).confirmed, false);
  assert.equal(choices.priceState(changed, recent, Date.parse('2026-10-06T12:05:00Z')).confirmed, true);
  assert.equal(replacement.statusFor({ anuncioSubstituidoEm: { toMillis: () => Date.parse(when) } }, old), null);
});
test('public catalogue publishes cutoff timestamp but never internal archive', () => {
  const result = publicCatalogue([{ ...product, anuncioSubstituidoEm: when }]).products[0];
  assert.equal(result.anuncioSubstituidoEm, when);
  assert.equal('historicoAnuncios' in result, false);
});

const saveCode = html.slice(html.indexOf('async function salvarSubstituicaoAnuncioFilaPrecosAssistida()'), html.indexOf('const camposEdicaoFila ='));
function setup({ server = product, denied = false } = {}) {
  const fields = new Map();
  const field = id => {
    if (!fields.has(id)) fields.set(id, { value: '', checked: false, disabled: false, dataset: {}, remove() { fields.delete(id); } });
    return fields.get(id);
  };
  field('precos-substituicao').dataset = { produtoId: 'p', linkOriginal: product.link, afiliadoOriginal: product.linkAfiliado };
  field('precos-sub-link').value = input.link; field('precos-sub-afiliado').value = input.linkAfiliado; field('precos-sub-mesmo').checked = true;
  for (const id of ['precos-sub-salvar', 'precos-sub-cancelar', 'precos-iniciar']) field(id);
  const writes = [], messages = [], confirmed = new Set(['p']), skipped = new Set(['p']), results = new Map([['p', { status: 'confirmado' }]]);
  const local = structuredClone(product);
  const context = vm.createContext({ Date, Error, Boolean, String, Object, db: {},
    filaPrecosSalvando: false, automacaoPrecosAtiva: false, filaPrecosIdAtual: 'p', filaPrecosDados: { todos: [local], produtos: [local] },
    filaPrecosConferidos: confirmed, filaPrecosPulados: skipped, filaPrecosResultados: results,
    automacaoPrecosIndisponiveis: new Map([['p', {}]]), automacaoPrecosFalhas: new Map([['p', {}]]), automacaoPrecosVisitados: new Set(['p']),
    $: id => fields.get(id) || null, window: { RDCOfferReplacement: replacement, RDCPricePublication: { saved() {} } },
    serverTimestamp: () => 'SERVER_TIMESTAMP', arrayUnion: value => ({ union: value }), doc: (_db, collection, id) => ({ collection, id }),
    runTransaction: async (_db, callback) => {
      if (denied) throw Error('permission-denied');
      return callback({ get: async () => ({ exists: () => Boolean(server), data: () => server }), update: (ref, data) => writes.push({ ref, data }) });
    },
    msg: (...args) => messages.push(args), atualizarControlesAutomacaoPrecos() {}, guardarPosicaoFilaPrecos() {}, renderizarFilaPrecosAssistida() {}, resumoAutomacaoPrecos() {},
  });
  vm.runInContext(saveCode, context);
  return { context, fields, writes, messages, confirmed, local, results };
}
test('save is atomic, archives proof, writes only target and returns confirmed product to queue', async () => {
  const c = setup(); await c.context.salvarSubstituicaoAnuncioFilaPrecosAssistida();
  assert.equal(c.writes.length, 1); assert.equal(c.writes[0].ref.id, 'p');
  assert.equal(c.writes[0].data.historicoAnuncios.union.link, product.link);
  assert.equal(c.writes[0].data.historicoAnuncios.union.precoConferenciaId, product.precoConferenciaId);
  assert.equal(c.writes[0].data.preco, undefined, 'current prices are never rewritten');
  assert.equal(c.confirmed.has('p'), false); assert.equal(c.results.has('p'), false);
  assert.equal(c.local.link, input.link); assert.equal(c.local.precoAtualizadoManualmenteEm, null);
});
test('concurrent change, deleted product and permission errors preserve original local data and queue', async () => {
  for (const options of [{ server: { ...product, link: 'https://www.mercadolivre.com.br/changed' } }, { server: null }, { denied: true }]) {
    const c = setup(options); await c.context.salvarSubstituicaoAnuncioFilaPrecosAssistida();
    assert.equal(c.writes.length, 0); assert.equal(c.local.link, product.link); assert.equal(c.confirmed.has('p'), true);
    assert.equal(c.fields.get('precos-sub-salvar').disabled, false);
    assert.match(c.messages.at(-1)[1], /Não foi possível substituir/);
  }
});
test('invalid or unconfirmed input causes no database reads or writes', async () => {
  const c = setup(); c.fields.get('precos-sub-mesmo').checked = false;
  await c.context.salvarSubstituicaoAnuncioFilaPrecosAssistida();
  assert.equal(c.writes.length, 0); assert.equal(c.confirmed.has('p'), true);
  assert.match(c.messages.at(-1)[1], /Confirme/);
});
test('cancel keeps links and has no Firestore mutation', () => {
  const start = html.indexOf('function cancelarSubstituicaoAnuncioFilaPrecosAssistida()'), end = html.indexOf('async function salvarSubstituicaoAnuncioFilaPrecosAssistida()');
  const c = setup(); vm.runInContext(html.slice(start, end), c.context);
  c.context.cancelarSubstituicaoAnuncioFilaPrecosAssistida();
  assert.equal(c.writes.length, 0); assert.equal(c.local.link, product.link); assert.equal(c.fields.has('precos-substituicao'), false);
});
test('UI exposes two separate fields, same-product check and unavailable list action', () => {
  for (const id of ['precos-substituir', 'precos-sub-link', 'precos-sub-afiliado', 'precos-sub-mesmo', 'precos-sub-cancelar']) assert.ok(html.includes(id));
  assert.match(html, /data-substituir-anuncio/);
  assert.match(html, /runTransaction\(db/);
  const dashboard = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
  assert.match(dashboard, /painel-celular\.html\?substituirAnuncio=/);
});
test('generators invalidate previous-offer status before selection and weekly cards retain cutoff', () => {
  const generator = readFileSync(new URL('./generate-sitemap.mjs', import.meta.url), 'utf8');
  assert.ok(generator.indexOf('offerReplacement.statusFor(product, marketplaceProducts[product.id])') < generator.indexOf('const rawShareProducts'));
  assert.match(generator, /anuncioSubstituidoEm: product\.anuncioSubstituidoEm/);
  const discovery = readFileSync(new URL('./generate-discovery.mjs', import.meta.url), 'utf8');
  assert.ok(discovery.indexOf('offerReplacement.statusFor(product, marketplaceProducts[product.id])') < discovery.indexOf('const candidateProducts'));
  const sync = readFileSync(new URL('./sync-mercadolivre.mjs', import.meta.url), 'utf8');
  assert.match(sync, /oldRecord = offerReplacement\.statusFor\(product, previous\.products\?\.\[product\.id\]\)/);
  assert.match(sync, /cachedResolution\.status === "ok" && !product\.anuncioSubstituidoEm/);
});
test('home price presentation ignores old offer but accepts later confirmation', () => {
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const names = ['statusMercadoLivre', 'millisConferenciaManual', 'precoManualProduto', 'fontePrecoSeguro'];
  const code = names.map(name => home.split('\n').find(line => line.startsWith(`function ${name}(`))).join('\n');
  const old = { managed: true, available: true, status: 'active', price: 90, checkedAt: new Date(Date.now()-60000).toISOString() };
  const c = vm.createContext({ Date, mercadoLivreStatus: { p: old }, numeroPreco: value => Number(String(value).replace(',','.')), promocaoValida: () => false });
  vm.runInContext(code,c);
  const p = { ...product, ...replacement.buildPatch(product, input, new Date().toISOString()) };
  assert.equal(c.fontePrecoSeguro(p), null);
  p.precoAtualizadoManualmente = true; p.precoAtualizadoManualmenteEm = new Date().toISOString();
  assert.equal(c.fontePrecoSeguro(p).origem, 'manual');
});
