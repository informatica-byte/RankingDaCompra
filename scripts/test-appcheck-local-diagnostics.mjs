import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../appcheck-local-diagnostics.js',import.meta.url),'utf8');
class Element {
  constructor(tag, doc) {this.tagName=tag;this.ownerDocument=doc;this.dataset={};this.children=[];this.events={};this.attributes={};this.textContent='';this.hidden=false;this.value='';}
  appendChild(child) {this.children.push(child);return child;}
  setAttribute(key,value) {this.attributes[key]=value;}
  addEventListener(key,fn) {this.events[key]=fn;}
  fire(key) {return this.events[key]?.();}
}
function boot({shared=new Map(),blocked=false,clipboard=true,page='dashboard'}={}) {
  let now=Date.parse('2026-10-18T00:00:00Z');
  const writes=[],copied=[],listeners={};
  const doc={elements:[],createElement(tag){const el=new Element(tag,this);this.elements.push(el);return el;},getElementById(id){return this.elements.find(el=>el.id===id)||null;}};
  doc.head=doc.createElement('head');
  const container=doc.createElement('div');
  const storage={getItem:k=>shared.get(k)||null,setItem(k,v){writes.push(k);shared.set(k,v);},removeItem(k){writes.push(k);shared.delete(k);}};
  const win={addEventListener:(name,fn)=>{listeners[name]=fn;},navigator:clipboard?{clipboard:{writeText:async text=>{copied.push(text);}}}:{}};
  Object.defineProperty(win,'localStorage',{configurable:true,get(){if(blocked)throw Error('storage blocked');return storage;}});
  class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const context=vm.createContext({window:win,Date:Clock,Set,WeakSet,JSON,Object,Number,String,Array,Error});
  vm.runInContext(source,context);
  const api=win.RDCLocalAppCheckDiagnostics;
  api.mount(container,{page});
  const button=text=>doc.elements.find(e=>e.tagName==='button'&&e.textContent===text);
  async function exported(){await button('Copiar diagnóstico').fire('click');return JSON.parse(copied.at(-1)||doc.elements.find(e=>e.tagName==='textarea').value);}
  return {api,shared,writes,copied,doc,button,exported,listeners,context,tick:ms=>{now+=ms;},now:()=>now};
}
const error=()=>Object.assign(Error('SECRET_TOKEN nunca pode ser registrado'),{code:'appCheck/fetch-status-error',customData:{httpStatus:403,token:'SECRET_TOKEN'}});

test('diagnóstico inicia sem gravar, copiar, consultar serviços ou chamar o provedor',()=>{
  const env=boot();let calls=0;
  env.api.observeProvider({getToken(){calls++;}},'firestore');
  assert.equal(calls,0);assert.equal(env.writes.length,0);assert.equal(env.copied.length,0);
  assert.doesNotMatch(source,/\bfetch\s*\(|sendBeacon|XMLHttpRequest|setInterval|setTimeout|getToken\(true\)|\.getToken\(/);
});
test('rejeição assíncrona preserva a Promise, o erro, argumentos e this sem ler mensagens',async()=>{
  const env=boot(),failure=error();let calls=0,args;
  Object.defineProperty(failure,'message',{get(){throw Error('não pode ler mensagem');}});
  const pending=Promise.reject(failure);
  const provider={getToken(...input){assert.equal(this,provider);calls++;args=input;return pending;}};
  env.api.observeProvider(provider,'firestore');
  const result=provider.getToken(true,'argumento original');
  assert.equal(result,pending);
  await assert.rejects(result,e=>e===failure);
  assert.equal(calls,1);assert.deepEqual(args,[true,'argumento original']);
  const report=await env.exported();
  assert.equal(report.records[0].code,'appCheck/fetch-status-error');assert.equal(report.records[0].status,403);
  assert.doesNotMatch(JSON.stringify([...env.shared]),/SECRET_TOKEN|stack|customData|message|token:/);
  assert.deepEqual(Object.keys(report.records[0]).sort(),['at','code','count','lastAt','page','source','status']);
});
test('sucesso preserva resultado e não acessa nem grava token',async()=>{
  const env=boot();const result={};Object.defineProperty(result,'token',{get(){throw Error('token não pode ser lido');}});
  const pending=Promise.resolve(result),provider={getToken:()=>pending};
  env.api.observeProvider(provider,'ai-logic');
  assert.equal(provider.getToken(),pending);assert.equal(await pending,result);
  await Promise.resolve();assert.equal(env.writes.length,0);
});

test('contexto da falha é local, enumérico e não registra URLs nem dados de navegação',async()=>{
  const env=boot(); env.context.window.navigator.onLine=false;
  env.doc.visibilityState='hidden';env.doc.querySelector=selector=>selector==='script[src*="/recaptcha/enterprise.js"]'?{}:null;
  env.api.record({code:'appCheck/recaptcha-error'},'firestore');
  const first=(await env.exported()).records[0];
  assert.deepEqual(first.context,{online:false,visibility:'hidden',recaptchaScript:'present'});
  env.context.window.navigator.onLine=true;
  env.api.record({code:'appCheck/recaptcha-error'},'firestore');
  assert.equal((await env.exported()).records.length,2,'network changes must not merge into the earlier failure');
  assert.doesNotMatch(JSON.stringify([...env.shared]),/enterprise\.js|location|userAgent|cookie|token:/);
});

test('contexto persistido rejeita campos livres e mantém relatórios antigos compatíveis',async()=>{
  const at='2026-10-18T00:00:00Z';
  const shared=new Map([['rdc-appcheck-diagnostico-local-v1',JSON.stringify({version:1,records:[{at,lastAt:at,page:'dashboard',source:'firestore',code:'appCheck/recaptcha-error',context:{online:true,visibility:'SECRET_TOKEN',recaptchaScript:'https://evil.example',url:'SECRET_TOKEN'}}]})]]);
  const env=boot({shared});const report=await env.exported();
  assert.deepEqual(report.records[0].context,{online:true});
  assert.doesNotMatch(JSON.stringify([...shared]),/SECRET_TOKEN|evil\.example/);
});
test('erro síncrono é preservado; instrumentação duplicada não duplica ocorrências',()=>{
  const env=boot(),failure=error(),provider={getToken(){throw failure;}};
  env.api.observeProvider(provider,'firestore');const wrapped=provider.getToken;
  env.api.observeProvider(provider,'firestore');assert.equal(provider.getToken,wrapped);
  assert.throws(()=>provider.getToken(),e=>e===failure);
  assert.equal(JSON.parse([...env.shared.values()][0]).records[0].count,1);
});
test('provedor não gravável mantém o método original sem impedir uso',()=>{
  const env=boot(),provider=Object.freeze({getToken:()=>7});
  assert.equal(env.api.observeProvider(provider,'firestore'),provider);assert.equal(provider.getToken(),7);
});
test('apenas códigos e fontes permitidos sobrevivem; nunca texto livre ou URL',async()=>{
  const env=boot();
  env.api.record({code:'appCheck/SECRET_TOKEN',message:'password=secret',stack:'https://example.com/?token=secret',customData:{httpStatus:'403 SECRET_TOKEN'}},'user@example.com');
  const report=await env.exported(),item=report.records[0];
  assert.equal(item.code,'appCheck/unknown');assert.equal(item.source,'appcheck');assert.equal(item.status,undefined);
  assert.doesNotMatch(JSON.stringify(report),/SECRET_TOKEN|user@|example\.com|password|stack|message/);
});
test('dados de armazenamento são revalidados e campos estranhos são removidos',async()=>{
  const shared=new Map([['rdc-appcheck-diagnostico-local-v1',JSON.stringify({version:1,records:[{at:'2026-10-18T00:00:00Z',lastAt:'2026-10-18T00:00:00Z',page:'dashboard',source:'firestore',code:'appCheck/recaptcha-error',count:2,token:'SECRET_TOKEN',message:'SECRET_TOKEN'}]})]]);
  const env=boot({shared});
  assert.equal((await env.exported()).records.length,1);assert.doesNotMatch(JSON.stringify([...shared]),/SECRET_TOKEN/);
});
test('últimos 50 registros, descarte após sete dias e agrupamento de repetidos',async()=>{
  const env=boot();env.api.record(error(),'firestore');env.tick(1000);env.api.record(error(),'firestore');
  assert.equal((await env.exported()).records[0].count,2);
  for(let i=0;i<60;i++){env.tick(61000);env.api.record(error(),'firestore');}
  assert.equal((await env.exported()).records.length,50);
  env.tick(7*86400000+1);assert.equal((await env.exported()).records.length,0);assert.equal(env.shared.size,0);
});
test('armazenamento bloqueado e JSON corrompido não afetam o painel ou o erro do SDK',async()=>{
  for(const options of [{blocked:true},{shared:new Map([['rdc-appcheck-diagnostico-local-v1','not-json']])}]) {
    const env=boot(options);env.api.record(error(),'firestore');assert.equal((await env.exported()).records.length,1);
    assert.ok(env.doc.elements.some(e=>e.tagName==='p'&&e.textContent.includes('apenas enquanto esta aba')));
  }
});
test('quota de armazenamento esgotada usa memória e preserva dados de outros recursos',async()=>{
  const shared=new Map([['login','preservar'],['produtos','preservar']]);const env=boot({shared});
  Object.defineProperty(env.context.window,'localStorage',{get(){return {getItem:()=>null,setItem(){throw Error('QuotaExceededError');},removeItem(){throw Error('QuotaExceededError');}};}});
  env.api.record(error(),'firestore');assert.equal((await env.exported()).records.length,1);
  assert.equal(shared.get('login'),'preservar');assert.equal(shared.get('produtos'),'preservar');
});
test('os dois painéis usam a mesma chave local, com identificação fixa de página',async()=>{
  const shared=new Map(),desk=boot({shared}),mobile=boot({shared,page:'painel-celular'});
  desk.api.record(error(),'firestore');mobile.tick(1000);mobile.api.record({code:'appCheck/recaptcha-error'},'ai-logic');
  const report=await desk.exported();assert.deepEqual(report.records.map(e=>e.page),['dashboard','painel-celular']);
  assert.equal(shared.size,1);assert.ok(desk.writes.every(key=>key==='rdc-appcheck-diagnostico-local-v1'));
});
test('cópia é manual e tem alternativa sem permissão para área de transferência',async()=>{
  const env=boot({clipboard:false});env.api.record(error(),'firestore');
  const report=await env.exported();assert.equal(report.records.length,1);
  const textarea=env.doc.elements.find(e=>e.tagName==='textarea');assert.equal(textarea.hidden,false);assert.equal(textarea.readOnly,true);
});
test('limpeza exige confirmação e remove somente a chave exclusiva do diagnóstico',async()=>{
  const shared=new Map([['produtos','preservar'],['tema','preservar']]),env=boot({shared});env.api.record(error(),'firestore');
  await env.button('Limpar diagnóstico').fire('click');assert.equal((await env.exported()).records.length,1);
  await env.button('Confirmar limpeza local').fire('click');assert.equal((await env.exported()).records.length,0);
  assert.equal(shared.get('produtos'),'preservar');assert.equal(shared.get('tema'),'preservar');
});
test('UI utiliza texto seguro; não intercepta console, rede ou callbacks globais de erro',()=>{
  assert.doesNotMatch(source,/innerHTML|console\.|window\.(?:fetch|onerror)|unhandledrejection|setLogLevel|onLog\(/);
  const env=boot({page:'URL-com-token'});env.api.record(error(),'firestore');assert.equal(env.shared.size,0);
});
test('os dois painéis carregam e montam o diagnóstico antes de inicializar os provedores',()=>{
  for(const file of ['dashboard.html','painel-celular.html']) {
    const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    assert.ok(html.indexOf('/appcheck-local-diagnostics.js?v=20261022-1')<html.indexOf('initializeAppCheck(aiApp'));
    assert.match(html,/RDCLocalAppCheckDiagnostics\?\.mount/);
    assert.match(html,/observeProvider\(aiAppCheckProvider, 'ai-logic'\)/);
    assert.match(html,/observeProvider\(firestoreAppCheckProvider, 'firestore'\)/);
    assert.match(html,/record\((?:error|erro), 'firestore'\)/);
    assert.doesNotMatch(html,/getToken\(true\)|FIREBASE_APPCHECK_DEBUG_TOKEN/);
  }
});
