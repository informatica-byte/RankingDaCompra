import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const ctx = { URL };
runInNewContext(readFileSync('product-save-safety.js', 'utf8'), ctx);
const safety = ctx.RDCProductSaveSafety;
const control = 'https://www.mercadolivre.com.br/controle-joystick-wireless-compativel-c-pc-android-nswitch/up/MLBU3461479224?pdp_filters=deal%3AMLB779362-1#polycard_client=offers&deal_print_id=d8609c2f-97b3-4684-beb9-7ceb070b456a&position=7&tracking_id=034dca0e-5f21-486e-b4fc-d6ad1c23ca9b&wid=MLB4231915505&sid=offers';
const product = link => ({ marketplace: 'mercado_livre', link });

test('regressão real: controle usa wid do anúncio, não o código da campanha deal', () => {
  assert.equal(safety.listingId(product(control)), 'MLB4231915505');
  assert.equal(safety.creationId(product(control)), 'mlMLB4231915505');
  const searches = safety.duplicateLookups(product(control));
  assert.equal(searches[0][1], 'MLB4231915505');
  assert.ok(searches.every(([, value]) => value !== 'MLB779362' && value !== 'MLB-779362'));
});
test('produtos diferentes na mesma campanha não colidem no cadastro da maquininha', () => {
  const terminal = control.replace('wid=MLB4231915505', 'wid=MLB9999999999');
  assert.notEqual(safety.creationId(product(control)), safety.creationId(product(terminal)));
  const legacy = { mercadoLivreItemId: 'MLB779362', link: terminal };
  assert.equal(safety.duplicateLookups(product(control)).some(([field, value]) => legacy[field] === value), false);
});
test('código de campanha sem anúncio real não cria um id de produto', () => {
  for (const tail of ['?pdp_filters=deal%3AMLB779362-1', '?tracking=MLB779362', '#deal=MLB779362']) {
    assert.equal(safety.listingId(product('https://www.mercadolivre.com.br/controle/up/MLBU3461479224' + tail)), '');
  }
});
test('link limpo, item_id no filtro e wid no fragmento convergem ao mesmo anúncio', () => {
  const links = [
    'https://www.mercadolivre.com.br/controle/up/MLBU3461479224?wid=MLB4231915505',
    'https://www.mercadolivre.com.br/controle/up/MLBU3461479224?pdp_filters=deal%3AMLB779362-1%7Citem_id%3AMLB4231915505',
    'https://www.mercadolivre.com.br/controle/up/MLBU3461479224#item_id=MLB-4231915505',
    'https://produto.mercadolivre.com.br/MLB-4231915505-controle-_JM?pdp_filters=deal%3AMLB779362-1',
  ];
  for (const link of links) assert.equal(safety.creationId(product(link)), 'mlMLB4231915505');
});
test('códigos reais contraditórios bloqueiam criação em vez de escolher o primeiro', () => {
  for (const link of [
    'https://produto.mercadolivre.com.br/MLB-4231915505-controle-_JM?wid=MLB9999999999',
    'https://www.mercadolivre.com.br/controle/up/MLBU3461479224?wid=MLB4231915505#wid=MLB9999999999',
    'https://www.mercadolivre.com.br/controle/up/MLBU3461479224?wid=MLB4231915505&wid=MLB9999999999',
    'https://www.mercadolivre.com.br/controle/up/MLBU3461479224?pdp_filters=item_id%3AMLB9999999999#wid=MLB4231915505',
  ]) assert.throws(() => safety.creationId(product(link)), /anúncios diferentes/);
});
test('links com código de anúncio inválido, credenciais ou host parecido não são aceitos como item', () => {
  assert.throws(() => safety.listingId(product('https://www.mercadolivre.com.br/controle?wid=MLBabc')), /inválido/);
  assert.equal(safety.listingId(product('https://user:pass@www.mercadolivre.com.br/MLB-4231915505-_JM')), '');
  assert.equal(safety.listingId(product('https://mercadolivre.com.br.evil.test/MLB-4231915505-_JM')), '');
});
test('os extratores reais dos dois painéis usam o mesmo código correto', () => {
  for (const [file, start, end, name] of [
    ['painel-celular.html', 'function mlb(v)', 'function marketplaceAtual()', 'mlb'],
    ['dashboard.html', 'function extrairIdMercadoLivreCadastro(valor)', 'function atualizarMarketplaceCadastro()', 'extrairIdMercadoLivreCadastro'],
  ]) {
    const html = readFileSync(file, 'utf8');
    const from = html.indexOf(start), until = html.indexOf(end, from);
    const runtime = { window: { RDCProductSaveSafety: safety } };
    runInNewContext(html.slice(from, until), runtime);
    assert.equal(runtime[name](control), 'MLB4231915505');
    assert.equal(runtime[name]('MLB-4231915505'), 'MLB4231915505');
    assert.equal(runtime[name]('deal:MLB779362-1'), '');
    assert.match(html, /product-save-safety\.js\?v=20261026-unique/);
  }
});
