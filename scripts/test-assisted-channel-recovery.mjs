import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const bot=readFileSync(new URL('../bot-precos.user.js',import.meta.url),'utf8');
const commandKey='rdc_preco_command_v2',resultKey='rdc_preco_result_v2';
const session='daily-session-123';
const source='https://produto.mercadolivre.com.br/MLB-1234567890-roteador-_JM';
function fixture(panel=false,controlled=true,storage=new Map()){
 const values=new Map(),intervals=new Map(),timeouts=new Map(),listeners=new Map(),navigations=[],opens=[];
 let seq=0;
 const c=vm.createContext({URL,URLSearchParams,Date,Math,
  location:{hostname:panel?'rankingdacompra.com.br':'fixture.invalid',href:source+(controlled?'#_rdc_conferencia='+session:''),assign:url=>navigations.push(url)},
  document:{readyState:'complete'},sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
  unsafeWindow:{name:'',innerWidth:1200,screen:{availWidth:1400},open:(...args)=>{opens.push(args);return{focus(){}};}},
  GM_getValue:(key,fallback)=>values.get(key)??fallback,GM_setValue:(key,value)=>values.set(key,value),
  GM_addValueChangeListener:(key,fn)=>{const id=++seq;listeners.set(id,{key,fn});return id;},GM_removeValueChangeListener:id=>listeners.delete(id),
  setTimeout:fn=>{const id=++seq;timeouts.set(id,fn);return id;},clearTimeout:id=>timeouts.delete(id),
  setInterval:(fn,ms)=>{const id=++seq;intervals.set(id,{fn,ms});return id;},clearInterval:id=>intervals.delete(id)});
 vm.runInContext(bot.replace(/\}\)\(\);\s*$/, 'Object.assign(globalThis,{installOfferChannel,handleConferenceCommand,conferenceUrl,offerIdentity});})();'),c);
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

test('catálogo redirecionado não navega em ciclo entre recarregamentos nem inventa preço',async()=>{
 const storage=new Map(),first=fixture(false,true,storage);
 const command={requestId:'redirect-1',sessionId:session,produtoId:'wella',titulo:'Kit Wella',url:source.replace('1234567890','2345678901'),createdAt:Date.now()};
 first.values.set(commandKey,command);
 assert.equal(await first.c.handleConferenceCommand(command),true);
 assert.equal(first.navigations.length,1);
 const afterRedirect=fixture(false,true,storage);afterRedirect.values.set(commandKey,command);
 assert.equal(await afterRedirect.c.handleConferenceCommand(command),true);
 assert.equal(afterRedirect.navigations.length,0);
 const result=afterRedirect.values.get(resultKey);
 assert.equal(result.status,'error');assert.equal(result.code,'RDC_PRODUCT_REDIRECT');
 assert.equal(result.requestedUrl,command.url);assert.equal(result.requestId,command.requestId);
 assert.equal(result.produtoId,'wella');assert.equal('preco' in result,false);
 const marker=JSON.parse(storage.get('rdc_preco_navigation_v1'));
 assert.deepEqual(Object.keys(marker).sort(),['requestId','sessionId']);
 const next={...command,requestId:'next-product'};afterRedirect.values.set(commandKey,next);
 await afterRedirect.c.handleConferenceCommand(next);assert.equal(afterRedirect.navigations.length,1);
});

test('falha no armazenamento da navegação vira revisão sem novo reload nem gravação de preço',async()=>{
 const f=fixture(),command={requestId:'storage-fail',sessionId:session,produtoId:'p',titulo:'Produto',url:source.replace('1234567890','2345678901'),createdAt:Date.now()};
 f.c.sessionStorage.setItem=()=>{throw new Error('quota');};f.values.set(commandKey,command);
 await f.c.handleConferenceCommand(command);
 assert.equal(f.navigations.length,0);assert.equal(f.values.get(resultKey).code,'RDC_NAVIGATION_STORAGE');
 assert.equal('preco' in f.values.get(resultKey),false);
});

test('filtro deal é removido só da navegação sem perder anúncio, variante ou sessão',()=>{
 const f=fixture();
 for(const filter of ['deal:MLB779362-1','deal:MLB779362-1|item_id:MLB1234567890','item_id:MLB1234567890|deal:MLB779362-1']){
  const input='https://www.mercadolivre.com.br/tenis/up/MLBU4060279126?pdp_filters='+encodeURIComponent(filter)+'&searchVariation=12345#wid=MLB1234567890&attributes=COLOR:Blue';
  const clean=new URL(f.c.conferenceUrl(input,session));
  assert.doesNotMatch(clean.searchParams.get('pdp_filters')||'',/deal:/);
  if(filter.includes('item_id:'))assert.equal(clean.searchParams.get('pdp_filters'),'item_id:MLB1234567890');
  assert.equal(clean.searchParams.get('searchVariation'),'12345');
  assert.equal(new URLSearchParams(clean.hash.slice(1)).get('wid'),'MLB1234567890');
  assert.equal(new URLSearchParams(clean.hash.slice(1)).get('_rdc_conferencia'),session);
  assert.equal(f.c.offerIdentity(clean.href).key,f.c.offerIdentity(input).key);
  assert.match(input,/deal/);
 }
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

test('aba viva renova presença mesmo após concluir o comando, sem nova navegação',async()=>{
 const f=fixture();f.c.installOfferChannel();
 const command={requestId:'done',sessionId:session,produtoId:'p',titulo:'Roteador',url:source.replace('1234567890','2345678901'),createdAt:Date.now()};
 f.values.set(commandKey,command);
 for(const {fn} of f.intervals.values())fn();
 await flush();assert.equal(f.navigations.length,1);
 const now=Date.now()+100000;f.c.Date={now:()=>now};
 for(const {fn} of f.intervals.values())fn();
 await flush();assert.equal(f.navigations.length,1);
 assert.equal(f.values.get('rdc_preco_controller_v3').seenAt,now);
});

test('janela bloqueada tem código de transporte e cancela comando pendente',async()=>{
 const f=fixture(true);f.c.unsafeWindow.open=()=>null;
 await assert.rejects(f.c.unsafeWindow.conferirPrecoNaAbaLocal({produtoId:'p',titulo:'Roteador',url:source}),e=>e.code==='RDC_POPUP_BLOCKED');
 assert.equal(f.values.get(commandKey),null);assert.equal(f.timeouts.size,0);assert.equal(f.listeners.size,0);
});

test('timeout tem código global e cancela pedido para não executar após interrupção',async()=>{
 const f=fixture(true);const p=f.c.unsafeWindow.conferirPrecoNaAbaLocal({produtoId:'p',titulo:'Roteador',url:source});
 const rejected=assert.rejects(p,e=>e.code==='RDC_CHANNEL_TIMEOUT');
 for(const fn of [...f.timeouts.values()])fn();await rejected;
 assert.equal(f.values.get(commandKey),null);
});
