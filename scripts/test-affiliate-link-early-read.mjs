import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import core from '../affiliate-link-audit.js';
import progress from '../affiliate-link-progress.js';

const input={productId:'fixture',title:'Produto de teste',affiliateUrl:'https://meli.la/fixture',expectedUrl:'https://www.mercadolivre.com.br/p/MLB23997257?wid=MLB1234567890'};
const source=await readFile(new URL('../bot-links.user.js',import.meta.url),'utf8');
async function fixture({buyable=true,readyState='loading',monotonic=false}={}){
 let now=1200,id=0;const pending=[],events=new Map(),intervals=[];
 class Clock extends Date{static now(){return now;}}
 const command={...core.request(input),requestId:'early-read-request',session:'test-early-session',createdAt:1000};
 const values=new Map([['rdc_link_audit_command_v1',command]]),state={rdcLinkAuditSession:command.session,rdcLinkAuditNavigation:command.requestId,rdcLinkAuditNavigationAt:1100};
 const node=t=>({textContent:t,disabled:false,closest:()=>null,getClientRects:()=>[{}],getAttribute:()=>null});
 const doc={readyState,visibilityState:'visible',body:{innerText:''},defaultView:{getComputedStyle:()=>({display:'block',visibility:'visible'})},querySelectorAll:s=>s.startsWith('h1')?[node(input.title)]:buyable&&s.includes('ui-pdp-actions')?[node('Comprar agora')]:[],addEventListener:(name,fn)=>events.set(name,fn)};
 const loc={hostname:'www.mercadolivre.com.br',href:input.expectedUrl,assign:()=>assert.fail('não deve navegar em outro anúncio')};
 const context=vm.createContext({URL,URLSearchParams,Date:Clock,...(monotonic?{performance:{now:()=>now}}:{}),Math,Promise,document:doc,location:loc,unsafeWindow:{},setTimeout:(fn,ms)=>{pending.push({fn,ms});return ++id;},clearTimeout(){},setInterval:fn=>intervals.push(fn),clearInterval(){},GM_getValue:(k,d)=>values.get(k)??d,GM_setValue:(k,v)=>values.set(k,v),GM_addValueChangeListener(){},GM_removeValueChangeListener(){},GM_getTab:fn=>fn({...state}),GM_saveTab:(tab,fn)=>{Object.assign(state,tab);fn?.();}});
 const flush=async()=>{for(let n=0;n<16;n++)await Promise.resolve();};
 vm.runInContext(source,context);await flush();
 return {values,doc,loc,events,pending,command,async tick(actualMs){const timer=pending.shift();assert.ok(timer,'temporizador de leitura esperado');assert.ok(timer.ms>0&&timer.ms<=500,'intervalo máximo de observação preservado');now+=actualMs??timer.ms;timer.fn();await flush();},setBuyable:value=>buyable=value,result:()=>values.get('rdc_link_audit_result_v1')};
}

test('lê DOM ainda carregando e só confirma após três observações estáveis, sem esperar DOMContentLoaded',async()=>{
 const f=await fixture();assert.ok(f.events.has('DOMContentLoaded'));assert.equal(f.result(),undefined);
 await f.tick();assert.equal(f.result(),undefined,'uma confirmação repetida ainda não basta');
 await f.tick();const r=f.result();assert.equal(r.status,'available');assert.equal(r.timing.earlyRead,true);assert.equal(r.timing.observations,3);assert.equal(r.timing.readMs,1000);assert.equal(r.timing.startupMs,100);assert.equal(r.timing.loadMs,100);assert.equal(r.timing.workerMs,1200);
 assert.equal(f.pending.length,0);assert.equal(r.inspection,'availability');assert.equal(r.readOnly,true);
});

test('DOM parcial vazio aguarda evidência real e não usa só o título como disponibilidade',async()=>{
 const f=await fixture({buyable:false});await f.tick();assert.equal(f.result(),undefined);f.setBuyable(true);
 await f.tick();assert.equal(f.result(),undefined);await f.tick();assert.equal(f.result(),undefined);await f.tick();assert.equal(f.result().status,'available');
});

test('CAPTCHA que aparece durante a estabilização prevalece sobre o botão de compra',async()=>{
 const f=await fixture();await f.tick();f.doc.body.innerText='Não sou um robô';await f.tick();assert.equal(f.result().status,'security');assert.equal(f.result().timing.observations,3);
});

test('página sem prova continua inconclusiva ao atingir oito segundos, sem quarenta esperas',async()=>{
 const f=await fixture({buyable:false});for(let i=0;i<16;i++)await f.tick();assert.equal(f.result().status,'unverified');assert.equal(f.result().timing.readMs,8000);assert.equal(f.result().timing.observations,17);assert.equal(f.result().timing.readBudgetMs,8000);assert.equal(f.result().timing.readLimitReached,true);assert.equal(f.result().timing.readOverrunMs,0);assert.match(f.result().reason,/Limite de leitura/);assert.match(f.result().reason,/informação suficiente/);assert.equal(f.pending.length,0);
});

test('aba atrasada encerra no primeiro retorno após o prazo sem marcar indisponibilidade',async()=>{
 const f=await fixture({buyable:false});await f.tick(30000);assert.equal(f.result().status,'unverified');assert.equal(f.result().timing.observations,2);assert.equal(f.result().timing.readMs,30000);assert.equal(f.result().timing.readOverrunMs,22000);assert.equal(f.pending.length,0,'não agenda outras 38 esperas após atraso');
});

test('um botão sem confirmação estável no prazo não é declarado disponível nem indisponível',async()=>{
 const f=await fixture();await f.tick(8000);assert.equal(f.result().status,'unverified');assert.equal(f.result().timing.readLimitReached,true);assert.equal(f.result().timing.observations,2);
});

test('fim do prazo nunca encurta o intervalo de estabilidade para confirmar compra',async()=>{
 const f=await fixture({buyable:false,monotonic:true});await f.tick(7450);assert.equal(f.result(),undefined);f.setBuyable(true);await f.tick(500);assert.equal(f.result().status,'unverified');assert.equal(f.result().timing.readMs,7950);assert.equal(f.pending.length,0);
});

test('segurança tem prioridade mesmo quando o navegador retorna depois do prazo',async()=>{
 const f=await fixture();f.doc.body.innerText='Não sou um robô';await f.tick(30000);assert.equal(f.result().status,'security');assert.equal(f.result().timing.readLimitReached,false);
});

test('login tardio continua pausando e não vira limite inconclusivo',async()=>{
 const f=await fixture({buyable:false,monotonic:true});f.loc.href='https://www.mercadolivre.com.br/login/';await f.tick(9000);assert.equal(f.result().status,'login');assert.equal(f.result().timing.readLimitReached,false);
});

test('relógio monotônico mede prazo e mantém indisponibilidade explícita como evidência, não timeout',async()=>{
 const f=await fixture({buyable:false,monotonic:true});await f.tick(8100);assert.equal(f.result().status,'unverified');assert.equal(f.result().timing.readMs,8100);assert.equal(f.result().timing.readOverrunMs,100);
 const g=await fixture({buyable:false,monotonic:true}),prior=g.doc.querySelectorAll;
 g.doc.querySelectorAll=s=>s.startsWith('h1')?[{textContent:'Produto não encontrado',closest:()=>null,getClientRects:()=>[{}],getAttribute:()=>null}]:prior(s);
 await g.tick(9000);assert.equal(g.result().status,'unavailable');assert.equal(g.result().timing.readLimitReached,false,'indisponibilidade exige sinal explícito, não tempo decorrido');
});

test('cancelamento ou troca do pedido durante leitura antecipada nunca envia resultado tardio',async()=>{
 const f=await fixture();f.values.set('rdc_link_audit_command_v1',{...f.command,requestId:'another'});await f.tick();assert.equal(f.result(),undefined);
});

test('diagnóstico só aceita durações limitadas, booleanos e enumeração fixa; elimina campos extras',()=>{
 const value=core.safeTiming({version:1,startupMs:20.5,loadMs:Infinity,readMs:-1,workerMs:90000000,roundTripMs:1500,observations:3,earlyRead:true,mode:'adaptive',url:'https://secret.example',cookie:'PRIVATE',access_token:'PRIVATE',nested:{token:'PRIVATE'}});
 assert.deepEqual(value,{version:1,startupMs:21,roundTripMs:1500,observations:3,earlyRead:true,mode:'adaptive'});
 assert.equal(core.safeTiming({version:2,readMs:100}),null);assert.equal(core.safeTiming({version:1,token:'PRIVATE'}),null);
 const old=core.safeResult({...core.classify(input,{url:input.expectedUrl,buyable:true}),robotVersion:'2.5.2'});assert.equal('timing'in old,false,'relatório antigo continua aceito');
 const safe=core.safeResult({...old,timing:{version:1,readMs:1000,token:'PRIVATE'}});assert.deepEqual(safe.timing,{version:1,readMs:1000});assert.doesNotMatch(JSON.stringify(safe),/PRIVATE/);
});

test('diagnóstico e versão nova não alteram checkpoint nem impressões digitais da fila antiga',()=>{
 const old={version:1,day:'2026-10-29',limit:'all',repeat:false,queue:[{key:'done:mercado_livre',fingerprint:'a'.repeat(64)},{key:'next:mercado_livre',fingerprint:'b'.repeat(64)}],cursor:1,state:'running',reason:''};
 const p=progress.restore(old,old.day),rows=old.queue.map(x=>({...x,title:input.title}));assert.equal(p.cursor,1);assert.equal(p.repeat,false);assert.equal(progress.next(p,rows,()=>false).key,'next:mercado_livre');assert.equal(old.cursor,1);
});

test('painel mede pausa e processamento sem novas APIs de métricas ou alteração do cursor',async()=>{
 const panel=await readFile(new URL('../affiliate-link-panel.js',import.meta.url),'utf8');assert.match(panel,/data-audit-performance-summary/);assert.match(panel,/pauseBeforeMs=Math\.max\(0,Date\.now\(\)-pauseStarted\)/);assert.match(panel,/panelMs:Math\.max\(0,Date\.now\(\)-receivedAt\)/);
 assert.ok(panel.indexOf('if(blocked){paused=true;checkpoint.pause')<panel.indexOf('await quarantine.review'),'pausa de segurança persistida antes da revisão opcional');
 const bot=await readFile(new URL('../affiliate-link-bot.js',import.meta.url),'utf8');assert.match(bot,/void run\(\);if\(doc.readyState/);assert.match(bot,/stable>=2&&result.status==='available'/);assert.match(bot,/i<40/);assert.match(bot,/if\(remaining<500\)break/);assert.match(bot,/await delay\(500\)/);assert.match(bot,/READ_BUDGET_MS=8000/);assert.doesNotMatch(bot,/fetch\(|XMLHttpRequest|cookie|localStorage|\.click\(/);
});
