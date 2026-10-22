import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {EXISTING_OFFER_REVIEWS, matchesExistingOffer} from './existing-offer-reviews.mjs';
import {correctProductData, correctGeneratedProductTitles, manufacturerEvidence} from './product-title-corrections.mjs';
import {productSeoTitle} from './product-seo-titles.mjs';
import {decisionData} from './product-decision.mjs';
import home from '../home-selection.js';
import integrity from '../comparison-integrity.js';
const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const titles = {
  rMsMd9YWawi1darKVapn:'Tênis Flyer Runner Mesh Feminino Puma',
  TaSttysuiLO2i5Rrb9hV:'Tênis Flyer Runner Mesh Feminino Puma',
  UkgpEmnU2nSDUmOujW6W:'Relógio Inteligente Smartwatch Alexa Chamadas NOVANTE Masculino Feminino Esportivo IP68 Bluetooth',
  Znhr4d5uhDKsj5poLEmZ:'Relógio Inteligente Smartwatch Alexa Chamadas NOVANTE Masculino Feminino Esportivo IP68 Bluetooth',
};

test('duplicate titles identify existing offers without changing identity, prices, links or evidence', () => {
  const found = [];
  for (const [id, correction] of EXISTING_OFFER_REVIEWS) {
    const input = {id,titulo:titles[id],preco:'199,99',precoPromocional:'184,00',precoAnterior:'249,99',
      link:'https://www.mercadolivre.com.br/p/MLB123456?wid='+correction.expectedListing,
      linkAfiliado:'https://meli.la/unchanged',precoAtualizadoManualmenteEm:'2026-10-22T10:00:00Z',precoConferenciaValor:199.99,
      historicoAnuncios:[{original:'preserve'}],dadosTecnicos:'Dado original',avaliacaoEditorial:null};
    const result = correctProductData(input);
    for (const key of ['id','preco','precoPromocional','precoAnterior','link','linkAfiliado','precoAtualizadoManualmenteEm','precoConferenciaValor','historicoAnuncios','dadosTecnicos']) assert.deepEqual(result[key],input[key],key);
    assert.match(result.titulo,new RegExp(correction.expectedListing+'$'));
    assert.deepEqual(correctProductData(result),result);
    assert.equal(manufacturerEvidence(result),null,'existing record is not a manufacturer source');
    assert.doesNotMatch(result.pros,/excelente|testado|ECG|natação/i);
    assert.doesNotMatch(result.titulo,/azul|branco|preto|GPS|tamanho/i);
    found.push(productSeoTitle(result.titulo,result));
  }
  assert.equal(new Set(found).size,4);
  for (const title of found) assert.match(title,/anúncio MLB\d+ \| Ranking da Compra$/);
});

test('changed product, link or explicit item never inherits the old offer title', () => {
  const id = 'rMsMd9YWawi1darKVapn', titulo = titles[id];
  for (const link of ['https://www.mercadolivre.com.br/p/MLB65637634?wid=MLB9999999999',
    'https://www.mercadolivre.com.br/p/MLB65637634?pdp_filters=item_id%3AMLB9999999999#x=1&wid=MLB6254967576',
    'https://evil.example/?wid=MLB6254967576','https://user:pass@www.mercadolivre.com.br/p/MLB65637634?wid=MLB6254967576','not-a-url']) {
    assert.equal(correctProductData({id,titulo,link}).titulo,titulo);
  }
  assert.equal(correctProductData({id,titulo:'Tênis de outro modelo'}).titulo,'Tênis de outro modelo');
  assert.equal(correctProductData({id,titulo:'Tênis Puma Flyer Runner Mesh masculino'}).titulo,'Tênis Puma Flyer Runner Mesh masculino');
  assert.equal(correctProductData({id:'UkgpEmnU2nSDUmOujW6W',titulo:'Smartwatch NOVANTE GPS Outro modelo'}).titulo,'Smartwatch NOVANTE GPS Outro modelo');
  assert.ok(matchesExistingOffer({link:'https://produto.mercadolivre.com.br/MLB-4091855423-tenis-_JM'},'MLB4091855423'));
});

test('offer suffix does not create fake distinct models in showcases or comparison', () => {
  const rows=[...EXISTING_OFFER_REVIEWS].map(([id])=>correctProductData({id,titulo:titles[id]}));
  assert.equal(home.distinctTitles(rows).length,2);
  assert.equal(integrity.modelKey(rows[0]),integrity.modelKey(rows[1]));
  assert.equal(integrity.modelKey(rows[2]),integrity.modelKey(rows[3]));
  assert.equal(integrity.comparable(rows.slice(0,2)),false);
  assert.equal(integrity.comparable(rows.slice(2)),false);
  assert.notEqual(home.titleKey({titulo:'Produto 220 V — anúncio MLB1234567890'}),home.titleKey({titulo:'Produto 127 V — anúncio MLB1234567891'}));
});

test('editorial titles do not split the history of these same products', async () => {
  const source = await read('scripts/update-price-history.mjs');
  const code = source.slice(source.indexOf('function normalizedTitle('),source.indexOf('function findProduct('));
  const context = vm.createContext({}); vm.runInContext(code,context);
  for (const [id, correction] of EXISTING_OFFER_REVIEWS) assert.equal(context.sameProductTitle(titles[id],correction.correct),true,id);
});

test('known Bluetooth version or wired absence answers the summary without duplicate contradictory rows', () => {
  for (const input of [
    {id:'c9hb1oe40g3K1dP4dAsy',titulo:'Fone JBL Quantum 100M2 Gamer Com Fio'},
    {id:'VgB90DThWdh8uyXUeE3U',titulo:'Headset Gamer Com Fio Mageon Vermelho Com Microfone Ajustável'},
    {id:'ARscPKCMZs3D8k22qltl',titulo:'Xiaomi Redmi Buds 6 Play M2420E1 Preto'},
  ]) {
    const data = decisionData(input), connection = data.criteria.find(row=>row.label==='Bluetooth');
    assert.ok(connection); assert.notEqual(connection.state,'unknown');
    assert.equal(data.criteria.filter(row=>['Bluetooth','Versão Bluetooth'].includes(row.label)).length,1);
    if (input.titulo.includes('Com Fio')) { assert.equal(connection.state,'no'); assert.match(connection.value,/fio|Não possui/i); }
    else { assert.equal(connection.state,'yes'); assert.match(connection.value,/5\.4/); }
  }
  const unknown = decisionData({titulo:'Fone Bluetooth sem versão informada'});
  assert.equal(unknown.criteria.find(row=>row.label==='Versão Bluetooth').state,'unknown');
  assert.equal(unknown.criteria.find(row=>row.label==='Bluetooth').state,'yes');
});

test('HTML patch preserves offers and never applies an old offer review to a reused page', async () => {
  const directory = await mkdtemp(join(tmpdir(),'rdc-offer-review-'));
  try {
    await mkdir(join(directory,'produto'));
    const id='UkgpEmnU2nSDUmOujW6W', file=join(directory,'produto',id+'-20260810-1.html');
    const html='<head><title>'+titles[id]+'</title><meta name="rdc-offer-url" content="https://www.mercadolivre.com.br/p/MLB64244402?wid=MLB9999999999"></head><h1>'+titles[id]+'</h1><p class="summary">Original</p><a id="affiliate-offer" href="https://meli.la/unchanged">Comprar</a><script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:titles[id],offers:{price:146.4,url:'https://meli.la/unchanged'}})+'</script>';
    await writeFile(file,html); await correctGeneratedProductTitles(directory);
    assert.equal(await readFile(file,'utf8'),html);
    await writeFile(file,html.replace('MLB9999999999','MLB6162191874')); await correctGeneratedProductTitles(directory);
    const after = await readFile(file,'utf8');
    assert.match(after,/anúncio MLB6162191874/); assert.match(after,/"price":146\.4/); assert.match(after,/https:\/\/meli.la\/unchanged/);
    assert.doesNotMatch(after,/data-verified-manufacturer/);
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('duplicate validator checks the own offer but never a recommended product title', async () => {
  const source=await read('scripts/validate-site.mjs'),context=vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('function productIdentityKeys('),source.indexOf('const homeHtml =')),context);
  const html='<meta name="rdc-offer-url" content="https://www.mercadolivre.com.br/p/MLB64244402?wid=MLB6162191874"><a href="https://meli.la/OwnLink">Comprar</a><section class="related-discovery"><a href="/produto/other.html">Smartwatch NOVANTE — anúncio MLB4460735385</a></section>';
  const keys=Array.from(context.productIdentityKeys(html));
  assert.ok(keys.includes('mlb:6162191874'));assert.ok(keys.includes('affiliate:https://meli.la/ownlink'));
  assert.ok(!keys.includes('mlb:4460735385'));
  assert.ok(Array.from(context.productIdentityKeys(html+'<p>Outro código na própria ficha MLB4460735385</p>')).includes('mlb:4460735385'));
});
