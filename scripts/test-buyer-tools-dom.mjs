import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const sample=(id,title,extra={})=>({id,title,category:'Informática',summary:'Confira os critérios e limitações.',url:'/produto/'+id+'-20260810-1.html',recordedPrice:100,checkedAt:'2026-10-11T12:00:00Z',...extra});
const makeElement=()=>({dataset:{},value:'',checked:false,innerHTML:'',textContent:'',insertAdjacentHTML(_where,html){this.innerHTML+=html;}});

async function page(products,search='',initialQuery='') {
  const selectors=Object.fromEntries(['query','category','budget','recent','same-type','status','results','comparison'].map(key=>['[data-buyer-'+key+']',makeElement()]));
  selectors['[data-buyer-query]'].value=initialQuery;
  const events={},root={dataset:{},classList:{add(){}},innerHTML:'',querySelector:selector=>selectors[selector]||null,contains:element=>element?.owner===root,addEventListener:(name,handler)=>{events[name]=handler;}};
  const controls=makeElement();
  controls.appendChild=element=>{selectors['[data-buyer-same-type]'].checked=/ checked/.test(element.innerHTML);};
  selectors['.buyer-controls']=controls;
  const document={activeElement:null,head:{appendChild(){}},readyState:'loading',createElement:()=>makeElement(),addEventListener(){}};
  const control=(dataset={})=>({owner:root,dataset,checked:false,focus(){document.activeElement=this;},hasAttribute:name=>name==='data-buyer-more'&&Object.hasOwn(dataset,'buyerMore'),closest(selector){return selector==='[data-buyer-remove]'&&dataset.buyerRemove||selector==='[data-buyer-more]'&&Object.hasOwn(dataset,'buyerMore')?this:null;}});
  for(const element of Object.values(selectors)){element.owner=root;element.hasAttribute=()=>false;element.focus=()=>{document.activeElement=element;};}
  for(const key of ['results','comparison']){
    const container=selectors['[data-buyer-'+key+']'];let html='';
    container.nodes={};
    Object.defineProperty(container,'innerHTML',{get:()=>html,set:value=>{
      html=value;
      if(document.activeElement?.container===container)document.activeElement=null;
      const make=dataset=>Object.assign(control(dataset),{container});
      if(key==='comparison')container.nodes['[data-buyer-remove]']=[...html.matchAll(/data-buyer-remove="([^"]+)"/g)].map(match=>make({buyerRemove:match[1]}));
      else {
        container.nodes['[data-buyer-select]']=[...html.matchAll(/data-buyer-select="([^"]+)"/g)].map(match=>make({buyerSelect:match[1]}));
        container.nodes['[data-buyer-more]']=html.includes('data-buyer-more')?[make({buyerMore:''})]:[];
        container.nodes['.buyer-card']=[...html.matchAll(/<article class="buyer-card">([\s\S]*?)<\/article>/g)].map(match=>{const link=make({}),url=match[1].match(/href="([^"]+)"/)?.[1];link.href=url;return {querySelector:selector=>selector==='a'?link:null};});
      }
    }});
    container.querySelectorAll=selector=>container.nodes[selector]||[];
    container.querySelector=selector=>container.querySelectorAll(selector)[0]||null;
  }
  const context={window:{location:{search},RDCPublicData:{json:async path=>{assert.equal(path,'/search-index.json');return {products};}}},document,location:{search},URL,URLSearchParams,Intl};
  vm.runInNewContext(await readFile(new URL('../buyer-tools.js',import.meta.url),'utf8'),context);
  await context.window.RDCBuyerTools.mount(root,initialQuery);
  const select=(id,checked=true)=>{
    const target=selectors['[data-buyer-results]'].querySelectorAll('[data-buyer-select]').find(input=>input.dataset.buyerSelect===id)||{dataset:{buyerSelect:id}};
    target.checked=checked;events.change({target});return target;
  };
  return {root,selectors,events,select,document,tools:context.window.RDCBuyerTools};
}

test('teclado mantém seleção, segue remoções e entra nos novos resultados sem perder foco',async()=>{
  const result=await page(Array.from({length:30},(_,index)=>sample(String(index+1),'Roteador Wi-Fi '+(index+1))));
  const results=result.selectors['[data-buyer-results]'],comparison=result.selectors['[data-buyer-comparison]'];
  const first=results.querySelectorAll('[data-buyer-select]')[0];first.focus();result.select('1');
  assert.notEqual(result.document.activeElement,first,'o checkbox antigo foi substituído');
  assert.equal(result.document.activeElement.dataset.buyerSelect,'1');
  result.select('2');
  let remove=comparison.querySelectorAll('[data-buyer-remove]')[0];remove.focus();result.events.click({target:remove});
  assert.equal(result.document.activeElement.dataset.buyerRemove,'2');
  remove=comparison.querySelectorAll('[data-buyer-remove]')[0];remove.focus();result.events.click({target:remove});
  assert.equal(result.document.activeElement.dataset.buyerSelect,'2','última remoção volta ao checkbox do produto');
  const more=results.querySelector('[data-buyer-more]');more.focus();result.events.click({target:more});
  assert.equal(result.document.activeElement.href,'/produto/25-20260810-1.html','mais resultados começa no primeiro cartão novo');
  const query=result.selectors['[data-buyer-query]'];query.focus();query.value='roteador';result.events.input({target:{matches:()=>true}});
  assert.equal(result.document.activeElement,query,'digitar filtros mantém foco no campo original');
});

test('deep-link de produto seleciona a ficha e mostra apenas alternativas do mesmo tipo',async()=>{
  const items=[sample('one','Roteador Wi-Fi AX1500'),sample('two','Roteador Wi-Fi AX1800'),sample('other','Notebook Asus')];
  const result=await page(items,'?produto=one');
  assert.equal(result.selectors['[data-buyer-same-type]'].checked,true);
  assert.match(result.selectors['[data-buyer-status]'].textContent,/2 produtos encontrados · 1 selecionados/);
  assert.match(result.selectors['[data-buyer-comparison]'].innerHTML,/Produto selecionado/);
  assert.match(result.selectors['[data-buyer-comparison]'].innerHTML,/Roteador Wi-Fi AX1500/);
  assert.doesNotMatch(result.selectors['[data-buyer-results]'].innerHTML,/Notebook Asus/);
  result.select('two');
  assert.match(result.selectors['[data-buyer-status]'].textContent,/2 selecionados/);
  const incompatible=result.select('other');
  assert.equal(incompatible.checked,false);
  assert.match(result.selectors['[data-buyer-status]'].textContent,/mesmo tipo/);
  assert.doesNotMatch(result.selectors['[data-buyer-comparison]'].innerHTML,/Notebook Asus/);
});

test('deep-link desconhecido ou sem tipo confirmado não produz seleção falsa',async()=>{
  const items=[sample('one','Roteador Wi-Fi'),sample('unknown','Fone de ouvido genérico')];
  for(const id of ['ausente','unknown']){
    const result=await page(items,'?produto='+id);
    assert.equal(result.selectors['[data-buyer-same-type]'].checked,false);
    assert.match(result.selectors['[data-buyer-status]'].textContent,/0 selecionados/);
    assert.equal(result.selectors['[data-buyer-comparison]'].innerHTML,'');
  }
});

test('montagem escapa HTML e apresenta ausência confirmada separada de informação desconhecida',async()=>{
  const result=await page([
    sample('one','Roteador "A" <script>alert(1)</script>',{comparison:{features:[
      {label:'Mesh',value:'Não possui Mesh <img onerror=alert(1)>',state:'no',basis:'fabricante',sourceUrl:'https://example.com/especificacoes'},
      {label:'Bluetooth',value:'Não possui',state:'no',basis:'fabricante',sourceUrl:'javascript:alert(3)'},
      {label:'Portas',value:'4 portas',state:'yes',basis:'fabricante',sourceUrl:'https://user:password@example.com/fonte'}
    ]}}),
    sample('two','Roteador B',{comparison:{features:[]}}),
    sample('unsafe','Roteador inseguro',{url:'javascript:alert(1)'})
  ],'?produto=one','<script>alert(2)</script>');
  assert.match(result.root.innerHTML,/value="&lt;script&gt;alert\(2\)&lt;\/script&gt;"/);
  result.select('two');
  const html=result.selectors['[data-buyer-comparison]'].innerHTML;
  assert.match(html,/Não possui Mesh &lt;img onerror=alert\(1\)&gt;/);
  assert.match(html,/Não confirmado no cadastro/);
  assert.match(html,/rel="noopener noreferrer"/);
  assert.doesNotMatch(html,/<script>|<img onerror|javascript:|user:password/);
  assert.doesNotMatch(result.selectors['[data-buyer-results]'].innerHTML,/Roteador inseguro/);
});

test('limite de três é aplicado no evento change e remoção permite nova escolha',async()=>{
  const result=await page([1,2,3,4].map(id=>sample(String(id),'Roteador Wi-Fi '+id)),'?produto=1');
  result.select('2');result.select('3');
  assert.equal(result.select('4').checked,false);
  assert.match(result.selectors['[data-buyer-status]'].textContent,/Limite de três/);
  result.events.click({target:{closest:selector=>selector==='[data-buyer-remove]'?{dataset:{buyerRemove:'2'}}:null}});
  assert.equal(result.select('4').checked,true);
  assert.match(result.selectors['[data-buyer-comparison]'].innerHTML,/Roteador Wi-Fi 4/);
  assert.doesNotMatch(result.selectors['[data-buyer-comparison]'].innerHTML,/Roteador Wi-Fi 2/);
});

test('acessórios não disputam comparação com notebooks ou roteadores',async()=>{
  const result=await page([]);
  for(const title of ['Capa para notebook','Suporte de notebook','Carregador para laptop','Fonte para roteador','Placa-mãe de notebook'])assert.equal(result.tools.group({title}),'',title);
  assert.equal(result.tools.group({title:'Notebook Asus Ryzen 5 16GB SSD 512GB'}),'Notebooks');
  assert.equal(result.tools.group({title:'Roteador TP-Link Wi-Fi 6 4 portas gigabit'}),'Roteadores');
});
