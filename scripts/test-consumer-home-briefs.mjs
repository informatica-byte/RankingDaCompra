import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import homeSelection from '../home-selection.js';
import choices from '../best-choices.js';
import {quickSummary,applyQuickSummary} from './product-quick-summary.mjs';
import {correctProductData} from './product-title-corrections.mjs';
const catalog=JSON.parse(readFileSync(new URL('../vitrine-publica.json',import.meta.url),'utf8')).products;
const ids=['ARscPKCMZs3D8k22qltl','GjHJtzdsIhbmSINvhPeX','48oRcQNlH00KgNLHkvsG','O6e0R2WtiZfyyf2MJe5Y','UvxFn4gfaexb8TvcaT5e','huCYMmOsGPKJ8jOiJ1gR'];
const p=id=>catalog.find(p=>p.id===id);
const html=p=>'<html><head><title>Ficha</title></head><body><article><div class="top"><div><h1>'+p.titulo+'</h1><p class="summary">Análise completa preservada, com limites e informações da oferta.</p><div class="offer"><b>R$ 87,00</b><a href="https://meli.la/teste">Ver preço</a></div></div></div><div class="panels">Detalhes e fontes</div></article></body></html>';

test('home prioriza seis modelos já selecionados sem alterar cadastros, preços ou configuração',()=>{
  const products=[p('mlMLB4952988337'),...ids.toReversed().map(p)],before=JSON.stringify(products);
  const config={bestChoicesProductIds:products.map(p=>p.id)},saved=JSON.stringify(config);
  assert.deepEqual(homeSelection.consumerSelection(choices.selectProducts(products,config)).map(p=>p.id),ids);
  assert.equal(choices.selectProducts(products,config).length,7);
  assert.equal(JSON.stringify(products),before);assert.equal(JSON.stringify(config),saved);
  assert.deepEqual(homeSelection.consumerSelection([]),[]);
  assert.deepEqual(homeSelection.consumerSelection([p(ids[4])]).map(p=>p.id),[ids[4]]);
});

test('ordem editorial não injeta produtos fora da seleção nem usa um ID reaproveitado como prova de modelo',()=>{
  const changed={...p(ids[0]),titulo:'Produto substituído sem relação'};
  const result=homeSelection.consumerSelection([changed,p(ids[1])]);
  assert.equal(result[0].id,ids[1]);assert.equal(result[1],changed);
  assert.equal(result.length,2);
});

test('home estática e dinâmica usam a mesma seleção; página completa mantém todos os produtos',()=>{
  const generator=readFileSync(new URL('./generate-best-choices.mjs',import.meta.url),'utf8');
  const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(index,/promocoes = window.RDCHomeSelection.consumerSelection\(window.RDCBestChoices.selectProducts\(todos,siteConfig\)\)/);
  const start=generator.indexOf('const homeProducts='),end=generator.indexOf('const staticBlock=',start);
  assert.ok(start>0&&end>start);
  const products=[p('mlMLB4952988337'),...ids.map(p)];
  const content='<section><div class="deal-grid" data-best-products>'+choices.productCards(products)+'</div><h3 class="best-products-heading">Rankings por categoria</h3><nav class="best-guide-grid">Guias</nav><p class="best-explanation">Seleção sem prazo de encerramento.</p></section>';
  const context={content,products,choices,homeSelection,status:{products:{}}};
  vm.runInNewContext(generator.slice(start,end)+';globalThis.result=homeProducts;',context);
  assert.equal((context.result.match(/class="deal-card best-product-card"/g)||[]).length,6);
  assert.doesNotMatch(context.result,/data-product-id="mlMLB4952988337"/);
  assert.match(content,/data-product-id="mlMLB4952988337"/);
});

test('seis resumos curtos têm modelo e fonte, sem inventar informação ou mudar objeto de origem',()=>{
  for(const id of ids){
    const product=p(id),before=JSON.stringify(product),brief=quickSummary(product);
    assert.ok(brief,id);assert.match(brief.sourceUrl,/^https:\/\//);
    for(const key of ['fit','limit','check'])assert.ok(brief[key].length<150,id+key);
    assert.equal(quickSummary({...product,id:'outro'}),null);
    assert.equal(quickSummary({...product,titulo:'Outro produto'}),null);
    assert.equal(JSON.stringify(product),before);
  }
  assert.match(quickSummary(p(ids[3])).limit,/não acompanha Windows/);
  assert.equal(quickSummary(p(ids[3])).sourceKind,'marketplace-listing');
  assert.equal(quickSummary({...p(ids[3]),link:'https://www.mercadolivre.com.br/p/MLB99999999'}),null);
});

test('ficha destaca decisão e mantém análise completa, preço, oferta e fontes, sem duplicar na regeneração',()=>{
  for(const id of ids){
    const product=p(id),source=html(product),output=applyQuickSummary(source,product);
    assert.match(output,/Em poucas palavras/);assert.match(output,/Principal limitação/);
    assert.match(output,/<details data-full-product-summary><summary>Ler a análise completa<\/summary><p class="summary">Análise completa preservada/);
    assert.ok(output.includes('<div class="offer"><b>R$ 87,00</b><a href="https://meli.la/teste">Ver preço</a></div>'));
    assert.ok(output.includes('<div class="panels">Detalhes e fontes</div>'));
    assert.equal(applyQuickSummary(output,product),output);
    assert.equal((output.match(/data-quick-product-summary aria-label/g)||[]).length,1);
    assert.equal(applyQuickSummary(output,{...product,titulo:'Outro produto'}),source);
    assert.equal(applyQuickSummary(source.replace('<h1>'+product.titulo+'</h1>','<h1>Outro produto</h1>'),product).includes('Em poucas palavras'),false);
  }
});

test('fonte do vendedor não ganha selo de fabricante e os resumos se encaixam no layout móvel',()=>{
  const output=applyQuickSummary(html(p(ids[3])),p(ids[3]));
  assert.match(output,/Informações do anúncio, sem validação independente/);
  assert.doesNotMatch(output,/Informações do fabricante, não teste próprio/);
  assert.match(output,/@media\(max-width:700px\)/);assert.match(output,/order:6;width:100%;min-width:0/);
  assert.match(output,/overflow-wrap:anywhere/);
  const generator=readFileSync(new URL('./generate-discovery.mjs',import.meta.url),'utf8');
  assert.match(generator,/html = applyQuickSummary\(html, product\)/);
});

test('unidade divergente do conversor vira ressalva, sem converter capacidade em desempenho comprovado',()=>{
  const product={...p('mlMLB4952988337'),comentario:'Taxa de transferência de dados: 1000 MB/s.'};
  const before=JSON.stringify(product),revised=correctProductData(product);
  assert.match(revised.comentario,/título anuncia Ethernet RJ45 10\/100\/1000 Mbps/);
  assert.match(revised.comentario,/unidades diferentes/);assert.match(revised.comentario,/Não medimos/);
  assert.doesNotMatch(revised.comentario,/Taxa de transferência de dados: 1000 MB\/s|anúncio oficial/);
  for(const key of Object.keys(product).filter(k=>!['comentario','pros','contras','nota','notaInformada'].includes(k)))assert.deepEqual(revised[key],product[key],key);
  assert.equal(JSON.stringify(product),before);assert.deepEqual(correctProductData(revised),revised);
  assert.equal(correctProductData({...product,titulo:'Outro produto'}).comentario,product.comentario);
  assert.equal(quickSummary(product),null);
});
