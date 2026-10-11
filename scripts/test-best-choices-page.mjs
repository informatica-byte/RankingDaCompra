import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setImmediate} from 'node:timers/promises';
import vm from 'node:vm';
import titles from '../promotion-title.js';

const now=Date.parse('2026-10-11T12:00:00Z'),origin='https://rankingdacompra.com.br';
const product=(id,extra={})=>({id,titulo:'Fone Bluetooth '+id,foto:'https://example.com/'+id+'.jpg',preco:80,categoria:'fones',comentario:'Confira autonomia e compatibilidade.',precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:'2026-10-11T10:00:00Z',...extra});
const guide={url:'melhores-fones-de-ouvido.html',title:'Compare fones',summary:'Usos e limitações'};
const initialSchema=()=>({'@context':'https://schema.org','@graph':[
  {'@type':'ItemList',name:'Produtos selecionados para analisar',itemListElement:[]},
  {'@type':'BreadcrumbList',itemListElement:[{name:'Início'}]},
  {'@type':'ItemList',name:'Rankings e comparativos por categoria',itemListElement:[{name:'Guia estático'}]},
  {'@type':'CollectionPage',name:'Título estático',url:origin+'/melhores-escolhas.html'}
]});
const node=(textContent='')=>({textContent,innerHTML:'',outerHTML:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;}});

async function runPage({products=[product('fresh')],marker=false,optional=true,schema=initialSchema(),failures=[],statuses={},incompleteCard=false}={}) {
  const heading=node('Título estático'),productGrid=node(),guideGrid=node(),og=node(),twitter=node();
  const schemaNode=schema===null?null:node(typeof schema==='string'?schema:JSON.stringify(schema));
  const fields={'.deal-check':node('✓ Preço conferido recentemente'),'.deal-price':node('R$ 80,00'),'.deal-validity':node('Preço conferido em 11/10/2026'),'h3':node('Fone Bluetooth fresh')};
  if(incompleteCard){delete fields['.deal-check'];delete fields['.deal-validity'];}
  const link={dataset:{productId:'fresh',productTitle:'Fone Bluetooth fresh'},getAttribute:()=>'/produto/fresh-20260810-1.html'};
  fields['[data-product-id]']=link;
  const card={querySelector:selector=>fields[selector]||null};
  const button={dataset:{shareProduct:'fresh'},textContent:'Compartilhar',closest:selector=>selector==='[data-share-product]'?button:selector==='.best-product-card'?card:null};
  const listeners={},warnings=[],copied=[],calls=[];
  const selectors={'h1':heading,'[data-best-products]':productGrid};
  if(optional)Object.assign(selectors,{'.best-guide-grid':guideGrid,'meta[property="og:title"]':og,'meta[name="twitter:title"]':twitter});
  const document={title:'Título estático | Ranking da Compra',querySelector:selector=>selectors[selector]||null,querySelectorAll:selector=>selector==='[data-best-title]'?(marker?[heading]:[]):selector==='.best-product-card'?[card]:[],getElementById:id=>id==='best-schema'?schemaNode:null,addEventListener:(type,handler)=>{listeners[type]=handler;}};
  const payloads={
    '/vitrine-publica.json':{products},
    '/site-config.json':{bestChoicesTitle:'Melhores fones Bluetooth para comparar',bestChoicesProductIds:products.map(p=>p.id),bestChoicesGuideUrls:[guide.url]},
    '/mercadolivre-status.json':{products:statuses},'/best-choices-guides.json':{guides:[guide]}
  };
  class Clock extends Date {static now(){return now;}}
  const context={window:{RDCPromotionTitle:titles,RDCPublicData:{json:async path=>{calls.push(path);if(failures.includes(path))throw Error('Snapshot indisponível');return payloads[path];}}},document,location:{origin},navigator:{clipboard:{writeText:async value=>{copied.push(value);}}},URL,Date:Clock,Intl,console:{warn:(...args)=>{warnings.push(args);}}};
  vm.runInNewContext(await readFile('best-choices.js','utf8'),context);
  vm.runInNewContext(await readFile('best-choices-page.js','utf8'),context);
  await setImmediate();
  return {heading,productGrid,guideGrid,og,twitter,schemaNode,fields,link,button,listeners,warnings,copied,calls,document};
}

test('script da página executa sem marcador secundário e mantém preços recentes',async()=>{
  const page=await runPage();
  assert.equal(page.warnings.length,0);
  assert.match(page.productGrid.innerHTML,/✓ Preço conferido recentemente/);
  assert.doesNotMatch(page.productGrid.innerHTML,/Último preço registrado/);
  assert.equal(page.heading.textContent,'Melhores fones Bluetooth para comparar');
  assert.equal(page.document.title,page.heading.textContent+' | Ranking da Compra');
  assert.equal(page.og.attributes.content,page.document.title);
  assert.equal(page.twitter.attributes.content,page.heading.textContent);
  const graph=JSON.parse(page.schemaNode.textContent)['@graph'];
  assert.equal(graph.find(item=>item['@type']==='CollectionPage').name,page.heading.textContent);
  assert.equal(graph.find(item=>item.name==='Produtos selecionados para analisar').itemListElement[0].url,origin+'/produto/fresh-20260810-1.html');
  assert.equal(graph.find(item=>item.name==='Rankings e comparativos por categoria').itemListElement[0].url,origin+'/'+guide.url);
  assert.deepEqual(page.calls.sort(),['/best-choices-guides.json','/mercadolivre-status.json','/site-config.json','/vitrine-publica.json']);
});

test('preços expirados são recalculados pelo script sem estender o selo de 24 horas',async()=>{
  const page=await runPage({marker:true,products:[product('fresh'),product('expired',{precoAtualizadoManualmenteEm:'2026-10-10T11:59:59Z'})]});
  assert.equal((page.productGrid.innerHTML.match(/✓ Preço conferido recentemente/g)||[]).length,1);
  assert.equal((page.productGrid.innerHTML.match(/Preço aguardando nova conferência/g)||[]).length,1);
  assert.match(page.productGrid.innerHTML,/Último preço registrado: R\$/);
  assert.equal(page.warnings.length,0);
});

test('falha de manifesto ou JSON-LD auxiliar não desfaz conferência válida',async()=>{
  const page=await runPage({failures:['/best-choices-guides.json'],schema:'{ JSON inválido'});
  assert.match(page.productGrid.innerHTML,/✓ Preço conferido recentemente/);
  assert.equal(page.guideGrid.outerHTML,'');
  assert.equal(page.schemaNode.textContent,'{ JSON inválido');
  assert.equal(page.warnings.length,1);
  assert.equal(page.fields['.deal-check'].textContent,'✓ Preço conferido recentemente');
});

test('metadados, schema e grade de guias opcionais não impedem preços e compartilhamento',async()=>{
  const page=await runPage({optional:false,schema:null});
  assert.equal(page.warnings.length,0);
  assert.match(page.productGrid.innerHTML,/✓ Preço conferido recentemente/);
  await page.listeners.click({target:page.button});
  assert.deepEqual(page.copied,[origin+'/produto/fresh-20260810-1.html']);
  assert.equal(page.button.textContent,'Link copiado');
});

test('snapshot principal indisponível retira selo e compartilha somente análise estática conhecida',async()=>{
  const page=await runPage({failures:['/vitrine-publica.json']});
  assert.equal(page.productGrid.innerHTML,'');
  assert.equal(page.fields['.deal-check'].textContent,'Confira o preço e a disponibilidade no vendedor');
  assert.equal(page.fields['.deal-price'].textContent,'Último preço registrado: R$ 80,00');
  assert.equal(page.fields['.deal-validity'].textContent,'Último registro em 11/10/2026');
  await page.listeners.click({target:page.button});
  assert.deepEqual(page.copied,[origin+'/produto/fresh-20260810-1.html']);
  page.link.getAttribute=()=> 'https://example.com/produto/fresh-20260810-1.html';
  await page.listeners.click({target:page.button});
  assert.equal(page.copied.length,1,'um link externo não pode ser compartilhado como análise do site');
});

test('fallback tolera cartões incompletos sem uma segunda falha de atualização',async()=>{
  const page=await runPage({failures:['/site-config.json'],incompleteCard:true});
  assert.equal(page.warnings.length,1);
  assert.equal(page.fields['.deal-price'].textContent,'Último preço registrado: R$ 80,00');
});

test('gerador marca o título principal e mantém o subtítulo de categoria independente',async()=>{
  const generator=await readFile('scripts/generate-best-choices.mjs','utf8');
  assert.match(generator,/<h1 data-best-title>/);
  assert.match(generator,/<h2>Compare por categoria e necessidade<\/h2>/);
  assert.match(generator,/best-choices-page\.js\?v=20261011-1/);
  assert.match(generator,/growth-tools\.js\?v=20261011-ux/);
  const content=generator.slice(generator.indexOf('const content='),generator.indexOf('const graph='));
  assert.ok(content.indexOf('choices.productCards(')<content.indexOf('choices.guideCards('),'produtos devem aparecer antes dos cartões de categorias');
  assert.match(content,/>Rankings por categoria<\/h3>/);
  assert.match(content,/Os destaques são editoriais\. Compare pelo seu uso/);
});
