import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import selection from '../home-selection.js';
const read=file=>readFile(new URL('../'+file,import.meta.url),'utf8');
const product=(id,titulo,extra={})=>({id,titulo,preco:100,linkAfiliado:'https://meli.la/existing-'+id,categoria:'ofertas',...extra});

test('títulos visualmente iguais ocupam uma vaga sem unir, excluir ou editar cadastros',()=>{
  const products=[product('a','Tênis Olympikus Corre 34 ao 43'),product('b','TENIS OLYMPIKUS CORRE 34 AO 43'),product('c','Fone JBL 520BT')];
  const before=JSON.stringify(products);
  const selected=selection.distinctTitles(products);
  assert.deepEqual(selected.map(p=>p.id),['a','c']);
  assert.equal(products.length,3);
  assert.strictEqual(selected[0],products[0]);
  assert.equal(JSON.stringify(products),before);
});
test('a apresentação não apaga diferenças de modelo, cor, tensão ou tamanho',()=>{
  const products=['Tênis Corre 3','Tênis Corre 4','Tênis Corre 4 azul','Tênis Corre 4 preto','Lavadora 127V','Lavadora 220V','Tênis 40','Tênis 41'].map((t,i)=>product(String(i),t));
  assert.equal(selection.distinctTitles(products).length,products.length);
});

const generator=await read('scripts/generate-sitemap.mjs');
const generatorCode=generator.slice(generator.indexOf('async function generateWeeklyTop('),generator.indexOf('function money(value)',generator.indexOf('async function generateWeeklyTop(')));
test('geração repõe a vaga repetida com outro elegível e mantém seis escolhas reais',async()=>{
  const products=[product('a','Tênis igual'),product('b','Tênis igual'),...Array.from({length:6},(_,i)=>product('other'+i,'Produto distinto '+i))];
  const before=JSON.stringify(products),writes=[];
  const context={INFORMATIONAL_SITE:false,homeSelection:selection,weeklyTopWeek:()=>({id:'week',start:'2026-10-19',end:'2026-10-25'}),readPreviousWeeklyTop:async()=>({weekStart:'2026-10-19',products:products.slice(0,6)}),editorialProduct:()=>true,weeklyTopCurrentPrice:p=>p.preco,weeklyTopFreshnessDays:()=>0,weeklyTopScore:()=>1,weeklyTopSnapshot:(p,image,position)=>({...p,position}),writeFile:async(file,data)=>writes.push(JSON.parse(data)),resolve:x=>x,console};
  vm.runInNewContext(generatorCode,context);
  const result=await context.generateWeeklyTop(products,new Map(products.map(p=>[p.id,{fileName:p.id+'.jpg'}])));
  assert.equal(result.products.length,6);
  assert.equal(new Set(result.products.map(selection.titleKey)).size,6);
  assert.ok(result.products.some(p=>p.id==='other4'),'a vaga deve ser reposta, não ficar vazia');
  assert.equal(writes.length,1);
  assert.equal(JSON.stringify(products),before);
});
test('vitrine também filtra payload antigo sem alterar os anúncios salvos',async()=>{
  const home=await read('index.html');
  const expression=home.match(/const top5Semanal = ([\s\S]*?);/)?.[1];
  assert.ok(expression);
  const products=[product('a','Tênis igual'),product('b','Tênis igual'),product('c','Fone')],before=JSON.stringify(products);
  const selected=vm.runInNewContext(expression,{window:{RDCHomeSelection:selection},top5Payload:{products},activeIds:new Set(),qualidadeHistoricoSemanal:()=>0,historicoVitrine:{}});
  assert.deepEqual(Array.from(selected,p=>p.id),['a','c']);
  assert.equal(JSON.stringify(products),before);
});
test('guias usam somente páginas publicadas e escapam os textos',()=>{
  const html=selection.guideNavigation([{url:'melhores-fones-de-ouvido.html',title:'Fones & chamadas'},{url:'javascript:alert(1)',title:'Inseguro'},{url:'//example.com',title:'Externo'}]);
  assert.match(html,/Fones &amp; chamadas/);
  assert.doesNotMatch(html,/javascript|Inseguro|Externo/);
  assert.match(html,/aria-label="Guias para escolher por necessidade"/);
});
test('seleção em revisão não aparece como recomendação nem altera a configuração',async()=>{
  const source=await read('growth-tools.js');
  const code=source.slice(source.indexOf('  async function renderWeeklyComparison('),source.indexOf('  async function weeklyAdminData('));
  let rendered=false;
  const config={publicado:true,produtos:[product('a','Fone')],semana:'2026-10-19'},before=JSON.stringify(config);
  const context={document:{querySelector:()=>null,createElement(){rendered=true;throw Error('não pode renderizar recomendação pendente');}},location:{pathname:'/'},window:{RDCPublicData:{json:async()=>({products:[]})},RDCWeeklyComparisonSafety:{reconcile:()=>({needsReview:true,products:config.produtos})}}};
  vm.runInNewContext(code,context);
  await context.renderWeeklyComparison(config);
  assert.equal(rendered,false);
  assert.equal(JSON.stringify(config),before);
});
test('home estática e dinâmica têm uma entrada de guias sem o bloco repetido',async()=>{
  const home=await read('index.html');
  const staticHome=home.split('<!-- static-home-products:start -->')[1].split('<!-- static-home-products:end -->')[0];
  assert.equal((staticHome.match(/id="guias-inicio"/g)||[]).length,1);
  assert.ok(staticHome.includes('id="guias-inicio"'));
  assert.ok(staticHome.indexOf('data-best-products')<staticHome.indexOf('id="comparativos-inicio"'),'vitrine informativa exibe produtos antes do diretório completo');
  assert.doesNotMatch(staticHome,/class="best-guide-grid"|class="static-guide-grid"/);
  const growth=await read('growth-tools.js');
  assert.match(growth,/const videoAnchor = document.getElementById\('ranking-da-semana'\) \|\| document.getElementById\('top5-semanal'\)/);
});
