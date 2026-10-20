import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const bot=readFileSync(new URL('../bot-precos.user.js',import.meta.url),'utf8');
const source='https://produto.mercadolivre.com.br/MLB-7776080994-tenis-_JM';
const target='https://www.mercadolivre.com.br/fone/p/MLB23997257';
const sessionId='session-cross-domain-123';
const commandKey='rdc_preco_command_v2',resultKey='rdc_preco_result_v2';

function fixture(tabState,href,values,text=''){
  const navigations=[],storage=new Map();
  const c=vm.createContext({URL,URLSearchParams,Date,Math,
    location:{hostname:'fixture.invalid',href,assign:url=>navigations.push(url)},
    unsafeWindow:{name:''},document:{body:{innerText:text},readyState:'loading',addEventListener(){}},
    sessionStorage:{getItem:key=>storage.get(key)||'',setItem:(key,value)=>storage.set(key,value)},
    GM_getValue:(key,fallback)=>values.get(key)??fallback,GM_setValue:(key,value)=>values.set(key,value),
    GM_getTab:callback=>callback({...tabState}),GM_saveTab:(tab,callback)=>{Object.assign(tabState,tab);callback?.();},
    GM_addValueChangeListener(){},
  });
  vm.runInContext(bot.replace(/\}\)\(\);\s*$/,'Object.assign(globalThis,{restoreControllerTab,persistControllerTab,controllerSession,handleConferenceCommand,initializeOfferChannel});})();'),c);
  return {c,navigations,storage};
}

test('vínculo e pedido sobrevivem ao redirecionamento entre subdomínios sem aceitar preço da lista',async()=>{
  const tabState={},values=new Map(),command={sessionId,requestId:'next',produtoId:'fone',titulo:'JBL Tune 520BT',url:target,createdAt:Date.now()};
  const first=fixture(tabState,source+'#_rdc_conferencia='+sessionId,values);
  values.set(commandKey,command);await first.c.handleConferenceCommand(command);
  assert.equal(first.navigations.length,1);assert.equal(tabState.rdcPriceSession,sessionId);
  const redirected=fixture(tabState,'https://lista.mercadolivre.com.br/tenis/#redirectedFromVip',values);
  assert.equal(redirected.c.controllerSession(),'');
  await redirected.c.restoreControllerTab();assert.equal(redirected.c.controllerSession(),sessionId);
  await redirected.c.handleConferenceCommand(command);
  const result=values.get(resultKey);assert.equal(result.code,'RDC_PRODUCT_REDIRECT');assert.equal(result.status,'error');
  assert.equal(result.produtoId,'fone');assert.equal(result.requestedUrl,target);assert.equal('preco' in result,false);
  assert.equal(redirected.navigations.length,0);
  values.set(commandKey,{...command,requestId:'following',url:source});
  await redirected.c.handleConferenceCommand(values.get(commandKey));assert.equal(redirected.navigations.length,1);
});

test('metadados de outra aba e comando de outra sessão não tomam abas comuns',async()=>{
  const values=new Map([[commandKey,{sessionId,requestId:'other',url:target,createdAt:Date.now()}]]);
  for(const state of [{},{rdcPriceSession:'different-session-123'}]){
    const f=fixture(state,source,values);await f.c.restoreControllerTab();
    assert.equal(await f.c.handleConferenceCommand(values.get(commandKey)),false);
    assert.equal(f.navigations.length,0);assert.equal(values.has(resultKey),false);
  }
});

test('CAPTCHA depois de redirecionar pausa para a pessoa e nunca vira preço ou indisponibilidade',async()=>{
  const command={sessionId,requestId:'captcha',produtoId:'tenis',titulo:'Tênis Fila',url:source,createdAt:Date.now()};
  const values=new Map([[commandKey,command]]),state={rdcPriceSession:sessionId,rdcPriceNavigation:{sessionId,requestId:command.requestId}};
  // New rendered origin with the same tab metadata, but no URL marker/name/storage.
  const security=fixture(state,'https://www.mercadolivre.com.br/security/',values,'Complete esta etapa: Não sou um robô');
  await security.c.restoreControllerTab();await security.c.handleConferenceCommand(command);
  assert.equal(values.get(resultKey).status,'security');assert.equal('preco' in values.get(resultKey),false);
  assert.equal(security.navigations.length,0);
});

test('primeira abertura registra a navegação antes do redirecionamento inicial',async()=>{
  const command={sessionId,requestId:'initial-open',produtoId:'tenis',titulo:'Tênis Fila',url:source,createdAt:Date.now()};
  const values=new Map([[commandKey,command]]),state={};
  const first=fixture(state,source+'#_rdc_conferencia='+sessionId,values);
  await first.c.initializeOfferChannel();assert.equal(state.rdcPriceSession,sessionId);
  assert.equal(state.rdcPriceNavigation.requestId,'initial-open');
  const redirect=fixture(state,'https://lista.mercadolivre.com.br/tenis/#redirectedFromVip',values);
  await redirect.c.restoreControllerTab();await redirect.c.handleConferenceCommand(command);
  assert.equal(values.get(resultKey).code,'RDC_PRODUCT_REDIRECT');assert.equal(redirect.navigations.length,0);
});

test('entrada na página inicial vincula a aba antes de um redirecionamento HTTP do anúncio',async()=>{
  const command={sessionId,requestId:'first-http-redirect',produtoId:'tenis',titulo:'Tênis Fila',url:source,createdAt:Date.now()};
  const values=new Map([[commandKey,command]]),state={};
  const home=fixture(state,'https://www.mercadolivre.com.br/#_rdc_conferencia='+sessionId,values);
  await home.c.initializeOfferChannel();assert.equal(state.rdcPriceSession,sessionId);
  await home.c.handleConferenceCommand(command);assert.equal(home.navigations.length,1);
  assert.equal(new URL(home.navigations[0]).hostname,'produto.mercadolivre.com.br');
  assert.equal(state.rdcPriceNavigation.requestId,command.requestId);
  const redirect=fixture(state,'https://lista.mercadolivre.com.br/tenis/#redirectedFromVip',values);
  await redirect.c.restoreControllerTab();await redirect.c.handleConferenceCommand(command);
  assert.equal(values.get(resultKey).code,'RDC_PRODUCT_REDIRECT');assert.equal('preco' in values.get(resultKey),false);
  assert.equal(redirect.navigations.length,0);
});

test('pedido cancelado durante a persistência não navega depois',async()=>{
  const command={sessionId,requestId:'cancelled',url:target,createdAt:Date.now()},values=new Map([[commandKey,command]]);
  const f=fixture({},source+'#_rdc_conferencia='+sessionId,values);
  f.c.GM_saveTab=(_tab,callback)=>{values.set(commandKey,null);callback();};
  assert.equal(await f.c.handleConferenceCommand(command),false);assert.equal(f.navigations.length,0);
});
