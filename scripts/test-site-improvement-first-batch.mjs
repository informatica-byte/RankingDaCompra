import test from 'node:test';
import assert from 'node:assert/strict';
import {selectRelatedProducts} from './related-products.mjs';
import {informationalGuideSummary} from './informational-site.mjs';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {refreshLedger} from './site-improvement-ledger.mjs';
import {publishedDiscoverySummary,publishedArticleProduct} from './published-discovery-summary.mjs';

test('relacionados não misturam secador com balança, pasta de dentes ou aparador', () => {
  const p={id:'p',titulo:'Secador de Cabelos Mondial SCN-01'};
  const alternatives=[
    p,{id:'b',titulo:'Balança de bioimpedância'},
    {id:'c',titulo:'Creme Dental'}, {id:'d',titulo:'Philips OneBlade'},
    {id:'e',titulo:'Secador de Cabelos Philco PSC3500'}
  ];
  const before=JSON.stringify(alternatives);
  assert.deepEqual(selectRelatedProducts(p,alternatives).map(p=>p.id),['e']);
  assert.equal(JSON.stringify(alternatives),before);
});

test('tipo desconhecido não ganha alternativas presumidas', () => {
  assert.deepEqual(selectRelatedProducts({id:'x',titulo:'Produto sem identificação'},
    [{id:'y',titulo:'Notebook Lenovo'}]),[]);
});

test('relacionados não repetem cor do modelo nem acessam preço', () => {
  const p={id:'p',titulo:'Fone JBL Tune 520BT Preto'};
  const same={id:'a',titulo:'Fone JBL Tune 520BT Branco'};
  const other={id:'b',titulo:'Fone JBL Tune 510BT Bluetooth'};
  Object.defineProperty(other,'preco',{get(){throw Error('Preço não deve ser consultado');}});
  assert.deepEqual(selectRelatedProducts(p,[p,same,other]).map(p=>p.id),['b']);
});

test('dados com formato contraditório não recebem relacionados de formato presumido', () => {
  const p={id:'x',titulo:'Fone Bluetooth open ear intra auricular'};
  assert.deepEqual(selectRelatedProducts(p,[{id:'y',titulo:'Fone Bluetooth open ear'}]),[]);
});

test('resumo do catálogo informativo não promete preços nem repete fontes', () => {
  const summary=informationalGuideSummary('Guia: Casa. Consulte modelos por tipo, fontes e preços com data. Confirme condições no vendedor.');
  assert.doesNotMatch(summary,/preços com data|fontes e informações com fontes/);
  assert.match(summary,/informações com fontes/);
  assert.equal(informationalGuideSummary(summary),summary);
});

test('câmera contraditória sinaliza dúvida sem escolher resolução nem alterar campos comerciais', () => {
  const p={id:'mlMLB4330065589',titulo:'Câmera de Segurança Wi-Fi 8MP PTZ com Dupla Lente',comentario:'Resolução 6MP 4K',preco:'39,90',linkAfiliado:'https://meli.la/existente',foto:'https://example.com/foto.jpg',precoConferenciaId:'preservado'};
  const next=correctProductData(p);
  assert.match(next.titulo,/resolução a confirmar/);
  assert.match(next.comentario,/contraditórias/);
  for(const key of ['id','preco','linkAfiliado','foto','precoConferenciaId'])assert.equal(next[key],p[key]);
  assert.equal(manufacturerEvidence(p),null);
  assert.deepEqual(correctProductData(next),next);
  const reused={...p,titulo:'Câmera Intelbras iM3'};
  assert.equal(correctProductData(reused).titulo,reused.titulo);
  assert.equal(correctProductData(reused).comentario,reused.comentario);
});

test('registro de retomada não reabre concluídos sem mudança de conteúdo', () => {
  const catalogue={generatedAt:'2026-10-30',products:[{id:'a',title:'Modelo A',summary:'Dados',decisionBrief:{reviewed:false}}]};
  const first=refreshLedger(catalogue);
  first.items[0].status='completed';
  first.items[0].lastCompletedAt='2026-10-30';
  const second=refreshLedger(catalogue,first);
  assert.equal(second.items[0].status,'completed');
  catalogue.products[0].summary='Nova informação';
  const third=refreshLedger(catalogue,second);
  assert.equal(third.items[0].status,'pending');
  assert.equal(third.items[0].previousState,'completed');
  assert.equal(third.items[0].changedSinceCheckpoint,true);
});

test('contingência reutiliza resumo publicado somente com ID, identidade e URL correspondentes', () => {
  const current={id:'a',title:'Modelo A 8 GB',summary:'Resumo curto',canonical:'https://rankingdacompra.com.br/produto/a.html',expectedUrl:'https://rankingdacompra.com.br/produto/a.html'};
  const old={id:'a',title:'Modelo A 8 GB',summary:'Resumo original publicado com dados do cadastro.'};
  assert.equal(publishedDiscoverySummary(current,old),old.summary);
  assert.equal(publishedDiscoverySummary(current,{...old,id:'b'}),current.summary);
  assert.equal(publishedDiscoverySummary(current,{...old,title:'Modelo A 16 GB'}),current.summary);
  assert.equal(publishedDiscoverySummary({...current,canonical:'https://evil.example/a.html'},old),current.summary);
});

test('contingência lê identidade completa de Article, sem reintroduzir ofertas ou preços', () => {
  const article={'@type':'Article',headline:'Nome curto',about:{'@type':'Thing',name:'Modelo completo 8 GB 512 GB'},description:'Descrição publicada',offers:{price:123}};
  assert.equal(publishedArticleProduct(article).name,article.about.name);
  assert.equal(publishedArticleProduct(article).offers,undefined);
  assert.equal(publishedArticleProduct({'@type':'Article',headline:'Blog genérico'}),null);
  const p={id:'x',title:'Tênis On Running Cloud Promoção -',summary:'Curto',canonical:'https://rankingdacompra.com.br/produto/x.html',expectedUrl:'https://rankingdacompra.com.br/produto/x.html'};
  assert.equal(publishedDiscoverySummary(p,{id:'x',title:'Tênis On Running Cloud Promoção -70% Off',summary:'Resumo preservado'}),'Resumo preservado');
});
