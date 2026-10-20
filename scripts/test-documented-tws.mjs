import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {publicWeeklyComparison} from './public-site-config.mjs';
import {correctProductData} from './product-title-corrections.mjs';
const safety = createRequire(import.meta.url)('../weekly-comparison-safety.js');
const now = Date.parse('2026-10-19T14:00:00Z');
const products = [
  ['ARscPKCMZs3D8k22qltl','Fone Xiaomi Redmi Buds 6 Play M2420E1 Preto',99.90],
  ['5bQKU9inL3pq14yE8K4L','Fone Bluetooth soundcore P30i da Anker com cancelamento de ruído adaptativo '+ 'detalhe '.repeat(20),196.50],
  ['FlqPY3yHJ2xPoNgnhSTE','Fone Samsung Galaxy Buds Core Preto',224.72],
].map(([id,title,price])=>({id,title,price,checkedAt:'2026-10-19T11:00:00Z',url:'/produto/'+id+'.html',image:'https://example.com/photo.jpg'}));

test('seleção documental sobrevive à publicação sem truncar identidade ou perder método',()=>{
  const draft=safety.documentedDraft({products},now);
  assert.ok(draft.assinaturaEditorial.length>300);
  const published=publicWeeklyComparison({...draft,publicado:true,secret:'not public'});
  assert.equal(published.assinaturaEditorial,draft.assinaturaEditorial);
  assert.equal(published.versao,5);
  assert.equal(publicWeeklyComparison({...draft,versao:'5'}).versao,5);
  assert.equal(publicWeeklyComparison({...draft,versao:'5junk'}).versao,undefined);
  assert.equal(published.modoEditorial,'documental');
  assert.equal(published.secret,undefined);
  assert.equal(safety.reconcile(published,{products},now).needsReview,false);
  const repriced=safety.reconcile(published,{products:products.map(p=>({...p,price:p.price+1}))},now);
  assert.equal(repriced.needsReview,false);
  assert.equal(repriced.products[2].preco,225.72);
});

test('assinatura antiga preserva aprovação somente da mesma identidade, com preço atual',()=>{
  const draft=safety.documentedDraft({products},now);
  draft.assinaturaEditorial='v1:'+draft.produtos.map(p=>[p.id,safety.family(p),p.titulo.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim(),Math.round(p.preco*100)].join('|')).sort().join('~');
  const current={products:products.map(p=>({...p,price:p.price+10}))};
  assert.equal(safety.reconcile(draft,current,now).needsReview,false);
  assert.ok(safety.reconcile({...draft,assinaturaEditorial:draft.assinaturaEditorial+'tampered'},current,now).reasons.includes('changed-editorial-basis'));
  const changed={products:current.products.map((p,i)=>i===2?{...p,title:'Samsung Galaxy Buds FE TWS'}:p)};
  assert.ok(safety.reconcile(draft,changed,now).reasons.includes('changed-editorial-basis'));
  assert.ok(safety.reconcile(draft,{products:current.products.map(p=>({...p,checkedAt:'2026-10-15'}))},now).reasons.includes('awaiting-price-confirmation'));
  assert.ok(safety.reconcile({...draft,comparabilidadeRevisada:false},current,now).reasons.includes('editorial-review-required'));
});

test('categoria corrigida da lavadora não altera preço, prazo ou links nem outro produto',()=>{
  const original={id:'mlMLB4644707253',titulo:'Lavadora Alta Pressão Compacta 1400w, 1600psi, 300l/h',categoria:'caixadesom',preco:'283,49',precoPromocional:'288,57',ofertaRelampagoTerminaEm:'2026-10-20T15:03:55.474Z',link:'https://produto.mercadolivre.com.br/MLB-4644707253',linkAfiliado:'https://meli.la/exemplo'};
  const revised=correctProductData(original);
  assert.equal(revised.categoria,'ferramentas');
  for(const key of ['preco','precoPromocional','ofertaRelampagoTerminaEm','link','linkAfiliado'])assert.equal(revised[key],original[key]);
  assert.equal(original.categoria,'caixadesom');
  assert.equal(correctProductData({...original,titulo:'Caixa de Som Bluetooth'}).categoria,'caixadesom');
});
test('não confunde open-ear ou caixa TWS com intra-auricular e não repete modelo por cor',()=>{
  assert.equal(safety.family({title:'Fone TWS OWS Open Ear ForeStory X5'}),'open-ear');
  assert.equal(safety.family({title:'Caixa de som TWS Bluetooth'}),'');
  assert.equal(safety.family(products[1]),'earbuds-tws');
  assert.equal(safety.family({title:'Fone de Ouvido soundcore P30i estojo com suporte para celular'}),'earbuds-tws');
  assert.equal(safety.family({title:'Suporte para fone TWS'}),'');
  const pair=[products[0],{...products[0],id:'blue',title:'Fone Xiaomi Redmi Buds 6 Play Azul'}];
  assert.equal(safety.distinctModels(pair).length,1);
  const draft=safety.documentedDraft({products},now);
  draft.produtos[2]={...draft.produtos[0],id:'blue'};
  assert.ok(safety.reconcile(draft,{products:[...products,pair[1]]},now).reasons.includes('duplicate-model'));
});
test('recusa modelo trocado, preços vencidos e seleção documental incompleta',()=>{
  assert.throws(()=>safety.documentedDraft({products:products.slice(0,2)},now),/ausente/);
  assert.throws(()=>safety.documentedDraft({products:products.map(p=>({...p,checkedAt:'2026-10-15'}))},now),/aguarda/);
  assert.throws(()=>safety.documentedDraft({products:products.map(p=>p.id===products[1].id?{...p,title:'Fone soundcore P3i'}:p)},now),/alterado/);
});
test('comparativo documental usa fontes, separa estojo e não mostra pontuação matemática',()=>{
  const draft=safety.documentedDraft({products},now);
  const markup=safety.documentaryMarkup(draft,draft.produtos);
  assert.equal((markup.match(/<article /g)||[]).length,3);
  assert.equal((markup.match(/Fonte do fabricante/g)||[]).length,3);
  assert.match(markup,/não são uma sessão|não uso contínuo/);
  assert.doesNotMatch(markup,/score|\/10|35%|mais vendido/);
  assert.match(markup,/não confirmado/);
  assert.equal(safety.documentaryMarkup(draft,draft.produtos.slice(0,2)),'');
});
test('fichas corrigidas preservam preço e link e não prometem bateria contínua com estojo',()=>{
  for(const p of products.slice(1)){
    const revised=correctProductData({id:p.id,titulo:p.title,preco:p.price,linkAfiliado:'https://meli.la/exemplo'});
    assert.equal(revised.preco,p.price);
    assert.equal(revised.linkAfiliado,'https://meli.la/exemplo');
    assert.match(revised.comentario,/recargas/);
    assert.match(revised.contras,/não foram testados|não foram testad/);
  }
});
test('ambos os painéis oferecem a mesma revisão documental antes de salvar',async()=>{
  for(const file of ['growth-tools.js','painel-celular.html']){
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
    assert.match(source,/Carregar comparativo TWS documentado/);
    assert.match(source,/RDCWeeklyComparisonSafety.documentedDraft\(index\)/);
    assert.match(source,/RDCWeeklyComparisonSafety.documentaryMarkup/);
  }
});
test('a seleção documental funciona com os títulos completos do catálogo publicado',async()=>{
  const index=JSON.parse(await readFile(new URL('../search-index.json',import.meta.url),'utf8'));
  const at=Math.max(...index.products.filter(p=>products.some(q=>q.id===p.id)).map(p=>Date.parse(p.checkedAt)))+1000;
  const draft=safety.documentedDraft(index,at);
  assert.equal(draft.produtos.length,3);
});
