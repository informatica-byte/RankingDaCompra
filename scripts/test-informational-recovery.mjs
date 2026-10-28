import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../informational-mode.js',import.meta.url),'utf8');
const buyerSource=await readFile(new URL('../buyer-tools.js',import.meta.url),'utf8');
const feed={mode:'informational',products:[],selected:[],guides:[]};
function runtime(fetch){
 const timers=new Map();let next=0;
 const window={},context=vm.createContext({window,fetch,AbortController,URL,URLSearchParams,Promise,setTimeout:(fn,ms)=>{assert.equal(ms,12000);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(source,context);return {api:window.RDCInformational,timers,window,context};
}
test('catálogo compartilha uma leitura, conserva cache em memória e não grava credenciais',async()=>{
 const calls=[],f=runtime(async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>feed};});
 const first=f.api.load(),joined=f.api.load();assert.equal(first,joined);assert.equal(await first,feed);assert.equal(await f.api.load(),feed);
 assert.equal(calls.length,1);assert.equal(calls[0].path,'/informational-catalogue.json');assert.equal(calls[0].options.credentials,'omit');assert.equal(f.timers.size,0);
 assert.doesNotMatch(source,/localStorage|sessionStorage|\.collection\(|getDoc\(/);
});
test('rede parada ou corpo JSON parado expiram e permitem nova tentativa sem resposta tardia vencer',async()=>{
 for(const stage of ['network','body']){
  let calls=0,finish,signal;
  const wait=new Promise(resolve=>{finish=resolve;});
  const f=runtime(async(_path,options)=>{signal=options.signal;if(++calls>1)return {ok:true,json:async()=>feed};return stage==='network'?wait:{ok:true,json:()=>wait};});
  const first=f.api.load(),joined=f.api.load();await new Promise(setImmediate);assert.equal(calls,1);
  [...f.timers.values()][0]();await assert.rejects(first,/demorou/);await assert.rejects(joined,/demorou/);assert.equal(signal.aborted,true);assert.equal(f.timers.size,0);
  assert.equal(await f.api.load(),feed);finish(stage==='network'?{ok:true,json:async()=>({mode:'invalid'})}:{mode:'invalid'});await new Promise(setImmediate);
  assert.equal(await f.api.load(),feed);assert.equal(calls,2);
 }
});
test('HTTP de falha e JSON inválido não ficam presos no cache nem viram catálogo vazio de sucesso',async()=>{
 for(const response of [{ok:false,json:async()=>feed},{ok:true,json:async()=>null},{ok:true,json:async()=>({mode:'informational',products:'invalid'})}]){
  let calls=0;const f=runtime(async()=>++calls===1?response:{ok:true,json:async()=>feed});await assert.rejects(f.api.load());assert.equal(f.timers.size,0);assert.equal(await f.api.load(),feed);assert.equal(calls,2);
 }
});
test('vitrine estática sobrevive à falha e recebe aviso acessível sem substituir links publicados',async()=>{
 const staticHome={},notices=[];let replaces=0,cleared=0;
 const app={dataset:{},querySelector:s=>s==='[data-info-home-static],[data-info-home-restored]'?staticHome:s==='[data-info-recovery]'?notices[0]||null:s==='.loading'?{remove(){cleared++;}}:null,append:n=>notices.push(n),replaceChildren(){replaces++;}};
 const f=runtime(async()=>({ok:false}));
 f.context.document={createElement:()=>({dataset:{},setAttribute(name,value){this[name]=value;},querySelector:()=>({addEventListener(){}})})};
 await f.api.route({app,setSeo(){}});assert.equal(replaces,0);assert.equal(notices.length,1);assert.equal(notices[0].role,'status');assert.match(notices[0].innerHTML,/seleção publicada continua disponível/);assert.equal(app.dataset.informationalRoute,undefined);assert.equal(cleared,1);
});
test('comparador oferece retentativa explícita sem substituir resultados de uma busca já existente',async()=>{
 for(const standalone of [true,false]){
  let calls=0,retry;const root={dataset:{},innerHTML:'Resultados anteriores preservados',hasAttribute:()=>standalone,querySelector:()=>({addEventListener:(_name,handler)=>{retry=handler;}})};
  const window={RDCPublicData:{json:async()=>{calls++;throw Error('offline');}}};
  const context=vm.createContext({window,URL,URLSearchParams,Intl});vm.runInContext(buyerSource,context);
  await window.RDCBuyerTools.mount(root);assert.equal(calls,1);assert.equal(root.dataset.buyerMounted,'');
  if(standalone){assert.match(root.innerHTML,/data-buyer-retry/);assert.match(root.innerHTML,/\/analises.html/);assert.equal(typeof retry,'function');}else assert.equal(root.innerHTML,'Resultados anteriores preservados');
 }
});
test('home sem JavaScript informa a alternativa estática e os botões de recuperação têm toque e foco visível',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),css=await readFile(new URL('../informational-mode.css',import.meta.url),'utf8');
 const notices=[...html.matchAll(/<noscript>([^]*?)<\/noscript>/g)].map(m=>m[1]);assert.ok(notices.length);for(const text of notices){assert.match(text,/guias e análises/);assert.doesNotMatch(text,/ative o JavaScript para consultar/);}
 assert.match(css,/\[data-info-retry\],\[data-buyer-retry\]\{min-height:44px/);assert.match(css,/\[data-info-retry\]:focus-visible/);
});
