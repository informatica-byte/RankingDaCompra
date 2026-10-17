import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const bot=readFileSync(new URL('../bot-precos.user.js',import.meta.url),'utf8');
const commandKey='rdc_preco_command_v2',resultKey='rdc_preco_result_v2';
const session='daily-session-123';
const source='https://produto.mercadolivre.com.br/MLB-1234567890-roteador-_JM';
function fixture(panel=false,controlled=true){
 const values=new Map(),intervals=new Map(),timeouts=new Map(),listeners=new Map(),navigations=[],opens=[];
 let seq=0;
 const c=vm.createContext({URL,URLSearchParams,Date,Math,
  location:{hostname:panel?'rankingdacompra.com.br':'fixture.invalid',href:source+(controlled?'#_rdc_conferencia='+session:''),assign:url=>navigations.push(url)},
  document:{readyState:'complete'},sessionStorage:{getItem:()=>'',setItem(){}},
  unsafeWindow:{name:'',innerWidth:1200,screen:{availWidth:1400},open:(...args)=>{opens.push(args);return{focus(){}};}},
  GM_getValue:(key,fallback)=>values.get(key)??fallback,GM_setValue:(key,value)=>values.set(key,value),
  GM_addValueChangeListener:(key,fn)=>{const id=++seq;listeners.set(id,{key,fn});return id;},GM_removeValueChangeListener:id=>listeners.delete(id),
  setTimeout:fn=>{const id=++seq;timeouts.set(id,fn);return id;},clearTimeout:id=>timeouts.delete(id),
  setInterval:(fn,ms)=>{const id=++seq;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id)});
 vm.runInContext(bot.replace(/\}\)\(\);\s*$/, 'Object.assign(globalThis,{installOfferChannel});})();'),c);
 return{c,values,intervals,timeouts,listeners,navigations,opens};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
test('poll local recupera comando sem evento e não navega repetidamente no mesmo pedido',async()=>{
 const f=fixture();f.c.installOfferChannel();
 const command={requestId:'next',sessionId:session,produtoId:'next-id',titulo:'Outro produto',url:source.replace('1234567890','2345678901'),createdAt:Date.now()};
 f.values.set(commandKey,command);
 assert.equal(f.navigations.length,0);
 assert.equal(f.intervals.size,1);
 for(const {fn} of f.intervals.values())fn();
 await flush();assert.equal(f.navigations.length,1);
 for(const {fn} of f.intervals.values())fn();
 await flush();assert.equal(f.navigations.length,1);
});
test('abas comuns não recebem polling nem são tomadas pelo lote',async()=>{
 const f=fixture(false,false);f.c.installOfferChannel();
 assert.equal(f.intervals.size,0);
 f.values.set(commandKey,{requestId:'next',sessionId:session,url:source.replace('1234567890','2345678901'),createdAt:Date.now()});
 for(const {fn} of f.listeners.values())fn();
 await flush();assert.equal(f.navigations.length,0);
});
test('poll de resultado recupera resposta sem evento, rejeita pedido alheio e limpa recursos',async()=>{
 const f=fixture(true),request={produtoId:'p',titulo:'Roteador',url:source};
 const promise=f.c.unsafeWindow.conferirPrecoNaAbaLocal(request);
 const command=f.values.get(commandKey);let resolved=false;promise.then(()=>{resolved=true;});
 f.values.set(resultKey,{...command,requestedUrl:source,requestId:'wrong',status:'ok',preco:99.9});
 for(const {fn} of f.intervals.values())fn();
 await flush();assert.equal(resolved,false);
 const response={requestId:command.requestId,produtoId:'p',requestedUrl:source,status:'ok',preco:99.9};
 f.values.set(resultKey,response);for(const {fn} of [...f.intervals.values()])fn();
 assert.equal(await promise,response);assert.equal(f.intervals.size,0);assert.equal(f.timeouts.size,0);assert.equal(f.listeners.size,0);
 assert.equal(f.opens[0][1],'rdc_conferencia_'+command.sessionId);
});
test('tempo esgotado limpa polling sem fabricar confirmação',async()=>{
 const f=fixture(true),promise=f.c.unsafeWindow.conferirPrecoNaAbaLocal({produtoId:'p',titulo:'Roteador',url:source});
 const rejection=assert.rejects(promise,/45 segundos/);
 for(const fn of [...f.timeouts.values()])fn();
 await rejection;assert.equal(f.intervals.size,0);assert.equal(f.listeners.size,0);
});
