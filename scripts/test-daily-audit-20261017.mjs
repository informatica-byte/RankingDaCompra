import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bot=read('bot-precos.user.js'),panel=read('painel-celular.html'),safety=read('assisted-price-safety.js');
const commandKey='rdc_preco_command_v2',controllerKey='rdc_preco_controller_v3',resultKey='rdc_preco_result_v2';
const baseUrl='https://produto.mercadolivre.com.br/MLB-1234567890-roteador-_JM';
function botFixture({href=baseUrl,storedSession='',name=''}={}){
 const values=new Map(),writes=[],navigations=[],storage=new Map();if(storedSession)storage.set(controllerKey,storedSession);
 const c=vm.createContext({URL,URLSearchParams,Date,Math,location:{hostname:'fixture.invalid',href,assign:url=>navigations.push(url)},unsafeWindow:{name},sessionStorage:{getItem:k=>storage.get(k)||'',setItem:(k,v)=>storage.set(k,v)},GM_getValue:(k,fallback)=>values.get(k)??fallback,GM_setValue:(key,value)=>{writes.push({key,value});values.set(key,value);},setTimeout:fn=>queueMicrotask(fn),document:{}});
 vm.runInContext(bot.replace(/\}\)\(\);\s*$/, 'Object.assign(globalThis,{conferenceUrl,controllerSession,handleConferenceCommand,offerIdentity,sameOffer});})();'),c);
 return{c,values,writes,navigations,storage};
}
test('a própria aba controlada navega no novo pedido, sem WindowProxy e sem gravar preço antigo',async()=>{
 const sessionId='daily-session-123',f=botFixture({href:baseUrl+'#_rdc_conferencia='+sessionId});
 const command={sessionId,requestId:'next',produtoId:'next-id',titulo:'Fone JBL Tune 520BT',url:'https://www.mercadolivre.com.br/fone/p/MLB98765432?wid=MLB2345678901',createdAt:Date.now()};
 f.values.set(commandKey,command);await f.c.handleConferenceCommand(command);
 assert.equal(f.navigations.length,1);assert.equal(f.c.sameOffer(command.url,f.navigations[0]),true);
 assert.equal(new URLSearchParams(new URL(f.navigations[0]).hash.slice(1)).get('_rdc_conferencia'),sessionId);
 assert.equal(f.values.get(controllerKey).requestId,'next');assert.equal(f.writes.some(x=>x.key===resultKey),false);
});
test('abas comuns, outra sessão e comandos antigos não são navegados ou aproveitados',async()=>{
 for(const href of [baseUrl,baseUrl+'#_rdc_conferencia=another-session']){
  const f=botFixture({href}),command={sessionId:'daily-session-123',requestId:'next',produtoId:'x',titulo:'Outro produto',url:baseUrl.replace('1234567890','2345678901'),createdAt:Date.now()};
  f.values.set(commandKey,command);await f.c.handleConferenceCommand(command);assert.equal(f.navigations.length,0);assert.equal(f.writes.length,0);
 }
 const session='daily-session-123',f=botFixture({href:baseUrl+'#_rdc_conferencia='+session}),old={sessionId:session,requestId:'old',createdAt:Date.now()};f.values.set(commandKey,{requestId:'new'});await f.c.handleConferenceCommand(old);assert.equal(f.navigations.length,0);
});
test('marcador preserva wid no fragmento, não modifica link cadastrado e não aceita outro host',()=>{
 const f=botFixture(),url='https://www.mercadolivre.com.br/produto/up/MLBU3461479224#position=7&wid=MLB4231915505',session='daily-session-123';
 const marked=f.c.conferenceUrl(url,session),hash=new URLSearchParams(new URL(marked).hash.slice(1));
 assert.equal(hash.get('wid'),'MLB4231915505');assert.equal(hash.get('position'),'7');assert.equal(f.c.sameOffer(url,marked),true);
 assert.throws(()=>f.c.conferenceUrl('https://mercadolivre.com.br.evil.invalid/test',session));
 assert.throws(()=>f.c.conferenceUrl(url,'javascript:alert(1)'));
});
test('URL de catálogo MLBU usa identidade do produto e tolera slug de apresentação diferente',()=>{
 const f=botFixture();vm.runInContext(safety,f.c);
 const one='https://www.mercadolivre.com.br/controle/up/MLBU3461479224?wid=MLB4231915505',two='https://www.mercadolivre.com.br/controle-wireless/up/MLBU3461479224?wid=MLB4231915505';
 assert.equal(f.c.offerIdentity(one).catalog,'MLBU3461479224');assert.equal(f.c.sameOffer(one,two),true);assert.equal(f.c.RDCAssistedPriceSafety.sameProductSource(one,two),true);assert.equal(f.c.sameOffer(one,two.replace('MLBU3461479224','MLBU9999999999').replace('MLB4231915505','MLB9999999999')),false);
});
test('painel só abre janela no primeiro pedido; confirmação da aba permite o próximo sem popup',async()=>{
 const values=new Map(),listeners=new Map(),timers=new Map(),calls=[];let seq=0;
 const c=vm.createContext({URL,URLSearchParams,Date,Math,location:{hostname:'rankingdacompra.com.br'},unsafeWindow:{innerWidth:1200,screen:{availWidth:1400},open:(...args)=>{calls.push(args);return{focus(){}};}},GM_getValue:(key,fallback)=>values.get(key)??fallback,GM_setValue:(key,value)=>values.set(key,value),GM_addValueChangeListener:(key,fn)=>{const id=++seq;listeners.set(id,{key,fn});return id;},GM_removeValueChangeListener:id=>listeners.delete(id),setTimeout:fn=>{const id=++seq;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(bot,c);
 for(const id of ['first','second']){
  const promise=c.unsafeWindow.conferirPrecoNaAbaLocal({produtoId:id,titulo:'Produto '+id,url:baseUrl.replace('1234567890',id==='first'?'1234567890':'2345678901')});
  const cmd=values.get(commandKey);values.set(controllerKey,{sessionId:cmd.sessionId,requestId:cmd.requestId,seenAt:Date.now()});
  const result={requestId:cmd.requestId,produtoId:id,requestedUrl:cmd.url,status:'ok',preco:99.9};for(const {key,fn} of [...listeners.values()])if(key===resultKey)fn(key,null,result);
  assert.equal(await promise,result);
 }
 assert.equal(calls.length,1);assert.equal(listeners.size,0);assert.equal(timers.size,0);
});

function promotionFixture(fail=false){
 const fields=new Map(),writes=[],product={id:'p',titulo:'Roteador TP-Link TL-WR840N',link:baseUrl,preco:'100,00',precoAnterior:'100,00',precoPromocional:'80,00',promocaoAtiva:true,ofertaRelampagoAtiva:true,ofertaRelampagoTerminaEm:'2030-01-01T00:00:00Z',historicoAnuncios:[{titulo:'Referência preservada'}]};
 const $=id=>{if(!fields.has(id))fields.set(id,{disabled:false,scrollIntoView(){}});return fields.get(id);};
 const c=vm.createContext({URL,URLSearchParams,Date,window:{},filaPrecosSalvando:false,filaPrecosDados:{todos:[product]},filaPrecosIdAtual:'p',automacaoPrecosAtiva:true,automacaoPrecosRodada:1,acompanhamentoPrecos:{vigente:()=>true},filaPrecosConferidos:new Set(),filaPrecosPulados:new Set(),filaPrecosResultados:new Map(),automacaoPrecosFalhas:new Map(),automacaoPrecosIndisponiveis:new Map(),$: $,campoPrecoFila:()=> 'precoPromocional',linkPrecoAssistido:p=>p.link,numero:v=>Number(String(v).replace(',','.')),preco:v=>Number(v).toFixed(2).replace('.',','),crypto:{randomUUID:()=> 'confirmation-new'},serverTimestamp:()=> 'SERVER_TIMESTAMP',db:{},doc:(_db,collection,id)=>({collection,id}),updateDoc:async(ref,changes)=>{if(fail)throw Error('offline');writes.push({ref,changes});},guardarPosicaoFilaPrecos(){},renderizarFilaPrecosAssistida(){},atualizarControlesAutomacaoPrecos(){},msg(){}});
 vm.runInContext(safety,c);const start=panel.indexOf('async function salvarFilaPrecoAssistida('),end=panel.indexOf('function separarProdutoAutomacao(',start);vm.runInContext(panel.slice(start,end),c);
 const proof=price=>({status:'ok',robotVersion:'2.4.6',proofVersion:3,comparisonPolicy:'name_price',priceBasis:'highlighted_total',preco:price,mainPrice:price,currency:'BRL',priceSelector:'.ui-pdp-price__second-line .andes-money-amount',requestId:'request-new',produtoId:'p',requestedUrl:baseUrl,fonteConsultada:baseUrl,tituloEncontrado:product.titulo,offerKey:'MLB1234567890',variantProof:{verified:true,expectedTitle:product.titulo,listingId:'MLB1234567890'},checkedAt:Date.now(),evidencia:'Preço total em destaque no anúncio'});
 return{c,writes,product,proof};
}
test('promoção terminada grava preço total comprovado como normal, sem desconto falso',async()=>{
 const f=promotionFixture(),beforeHistory=f.product.historicoAnuncios;
 assert.equal(await f.c.salvarFilaPrecoAssistida(120,{automatico:true,produtoId:'p',rodada:1,resultado:f.proof(120)}),true);
 assert.equal(f.writes.length,1);const patch=f.writes[0].changes;assert.equal(patch.preco,'120,00');assert.equal(patch.precoPromocional,'');assert.equal(patch.promocaoAtiva,false);assert.equal(patch.ofertaRelampagoAtiva,false);assert.equal(patch.precoConferenciaCampo,'preco');assert.equal(patch.precoConferenciaValor,120);assert.equal(f.product.preco,'120,00');assert.equal(f.product.precoConferenciaValor,120);assert.equal(f.product.historicoAnuncios,beforeHistory);assert.equal(f.c.filaPrecosConferidos.has('p'),true);
});
test('promoção ainda válida conserva desconto e preço confirmado em memória e no banco',async()=>{
 const f=promotionFixture();assert.equal(await f.c.salvarFilaPrecoAssistida(90,{automatico:true,produtoId:'p',rodada:1,resultado:f.proof(90)}),true);assert.equal(f.writes[0].changes.precoPromocional,'90,00');assert.equal(f.writes[0].changes.promocaoAtiva,undefined);assert.equal(f.product.promocaoAtiva,true);assert.equal(f.product.precoConferenciaCampo,'precoPromocional');assert.equal(f.product.precoConferenciaValor,90);
});
test('preço sem prova ou falha de gravação nunca encerra promoção nem marca conferência',async()=>{
 for(const fail of [false,true]){const f=promotionFixture(fail),before=JSON.stringify(f.product);const result=f.proof(120);if(!fail)result.mainPrice=1;assert.equal(await f.c.salvarFilaPrecoAssistida(120,{automatico:true,produtoId:'p',rodada:1,resultado:result}),false);assert.equal(f.writes.length,0);assert.equal(JSON.stringify(f.product),before);assert.equal(f.c.filaPrecosConferidos.size,0);}
});
test('conferir todos usa somente a quantidade de pendentes e não relê o Firebase',()=>{
 const start=panel.indexOf('$("precos-auto-todos")?.addEventListener('),end=panel.indexOf('$("precos-auto-iniciar").addEventListener(',start);assert.ok(start>0&&end>start);const code=panel.slice(start,end),fields={'precos-auto-todos':{addEventListener:(_event,fn)=>{fields.click=fn;}},'precos-auto-limite':{value:'50'}};let starts=0;
 const c=vm.createContext({$:id=>fields[id],automacaoPrecosAtiva:false,automacaoPrecosPausada:false,filaPrecosSalvando:false,filaPrecosDados:{},dadosFilaPrecosAssistida:()=>({pendentes:Array(517).fill({})}),iniciarAutomacaoPrecosAssistida:()=>{starts++;},msg(){}});vm.runInContext(code,c);fields.click();assert.equal(fields['precos-auto-limite'].value,'517');assert.equal(starts,1);assert.doesNotMatch(code,/getDocs|updateDoc|deleteDoc/);
});

test('falha temporária repete no máximo uma vez; indisponível e CAPTCHA não são repetidos nem gravados',async()=>{
 const start=panel.indexOf('async function executarAutomacaoPrecosAssistida('),end=panel.indexOf('function iniciarAutomacaoPrecosAssistida(',start),source=panel.slice(start,end);
 for(const scenario of [
  {responses:[new Error('O anúncio demorou mais de 45 segundos'),{status:'unavailable'}],calls:2,unavailable:1,paused:0},
  {responses:[{status:'error',motivo:'Preço principal não estabilizou'}],calls:2,unavailable:0,paused:0},
  {responses:[{status:'unavailable'}],calls:1,unavailable:1,paused:0},
  {responses:[{status:'security'}],calls:1,unavailable:0,paused:1},
 ]){
  const product={id:'p',titulo:'Roteador'},counts={calls:0,saves:0,attempts:0,paused:0,unavailable:0};let done=false;
  const context=vm.createContext({automacaoPrecosRodada:1,automacaoPrecosAtiva:true,automacaoPrecosPausada:false,filaPrecosIdAtual:'p',automacaoPrecosVisitados:new Set(),automacaoPrecosFalhas:new Map(),automacaoPrecosIndisponiveis:new Map(),dadosFilaPrecosAssistida:()=>({pendentes:done?[]:[product]}),acompanhamentoPrecos:{tentar:()=>{counts.attempts++;return true;}},linkPrecoAssistido:()=>baseUrl,rankingEsc:v=>v,numero:Number,resumoAutomacaoPrecos(){},renderizarFilaPrecosAssistida(){},esperar:async()=>{},pararAutomacaoPrecosAssistida:()=>{context.automacaoPrecosAtiva=false;},pausarAutomacaoPrecosAssistida:()=>{counts.paused++;context.automacaoPrecosPausada=true;},separarProdutoAutomacao:(_p,destination)=>{if(destination===context.automacaoPrecosIndisponiveis)counts.unavailable++;done=true;},salvarFilaPrecoAssistida:async()=>{counts.saves++;return true;},window:{conferirPrecoNaAbaLocal:async()=>{const value=scenario.responses[Math.min(counts.calls++,scenario.responses.length-1)];if(value instanceof Error)throw value;return value;}}});
  vm.runInContext(source,context);await context.executarAutomacaoPrecosAssistida(1);
  assert.equal(counts.calls,scenario.calls);assert.equal(counts.attempts,1);assert.equal(counts.saves,0);assert.equal(counts.paused,scenario.paused);assert.equal(counts.unavailable,scenario.unavailable);
 }
});
