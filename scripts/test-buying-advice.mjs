import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BUYING_ADVICE, buyingAdvice, renderBuyingAdvice, renderGuideChecklist } from './buying-advice.mjs';
import { correctProductData } from './product-title-corrections.mjs';

test('ten unique editorial profiles cannot leak to a replaced product', () => {
  assert.equal(BUYING_ADVICE.length, 10);
  assert.equal(new Set(BUYING_ADVICE.map(x=>x.id)).size, 10);
  for (const advice of BUYING_ADVICE) {
    assert.equal(buyingAdvice({id:advice.id,titulo:'Outro produto sem relação'}), null);
    assert.equal(buyingAdvice({id:'other',titulo:'JBL Tune 520BT'}), null);
    for (const key of ['use','check','alternative']) assert.ok(advice[key].length > 45);
  }
});
test('buyer orientation never modifies price, links, image or confirmation', () => {
  const product = {id:'GjHJtzdsIhbmSINvhPeX',titulo:'JBL Tune 520BT',preco:227.05,link:'https://mercadolivre.com.br/',precoAtualizadoManualmenteEm:'2026-10-14T10:09:24Z',foto:'image'};
  const before = JSON.stringify(product);
  const html = renderBuyingAdvice(product);
  assert.match(html,/não oferece ANC/);
  assert.match(html,/não é teste prático/);
  assert.match(html,/compra e o pagamento acontecem no vendedor/);
  assert.equal(JSON.stringify(product), before);
  assert.equal(renderBuyingAdvice({id:product.id,titulo:'Produto substituído'}),'');
});
test('guides explain different needs without inventing a winner', () => {
  assert.match(renderGuideChecklist('roteador'),/WAN e LAN/);
  assert.match(renderGuideChecklist('fones-de-ouvido'),/ENC.*ANC/);
  assert.equal(renderGuideChecklist('beleza'),'');
  assert.doesNotMatch(renderGuideChecklist('fone'),/melhor de todos|garantia de resultado/i);
});
test('generation removes old advisory block before adding the current one', async () => {
  const source = await readFile(new URL('./generate-discovery.mjs',import.meta.url),'utf8');
  assert.match(source,/html = html\.replace\(\/<section class="panel" data-buying-advice/);
  assert.match(source,/const advice = renderBuyingAdvice\(product\)/);
  assert.match(source,/html\.replace\('<div class="panels">', advice \+ '<div class="panels">'\)/);
  assert.match(source,/renderGuideChecklist\(`/);
});
test('uncertain sales claims are qualified without changing price or offer identity', () => {
  const fixtures = [
    ['VzQgxGhowdzlfNshI3ZC','Power Bank 20000mah',/potência está a confirmar/],
    ['tqUaLEFDAafDWemxheMX','Pendrive 8gb Usb-c',/não foram comprovadas/],
    ['7CSQkSXeUHn9yzYR29hF','Pen Drive 64gb Usb 2.0',/não foram comprovados/],
    ['ARscPKCMZs3D8k22qltl','Redmi Buds 6 Play',/não comprova proteção contra poeira/],
  ];
  for (const [id,titulo,expected] of fixtures) {
    const original = {id,titulo,preco:91.23,link:'https://mercadolivre.com.br/oferta',foto:'image',precoAtualizadoManualmenteEm:'2026-10-14T10:00:00Z'};
    const before = JSON.stringify(original), revised = correctProductData(original);
    assert.match(revised.comentario,expected);
    for (const key of ['id','preco','link','foto','precoAtualizadoManualmenteEm']) assert.equal(revised[key],original[key]);
    assert.equal(JSON.stringify(original),before);
    assert.equal(correctProductData({...original,titulo:'Outro modelo'}).comentario,'');
  }
});
