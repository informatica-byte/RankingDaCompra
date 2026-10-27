import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import core from '../affiliate-link-audit.js';
import quarantine from '../product-quarantine.js';
import {buildLinkAuditBot} from './build-link-audit-bot.mjs';
const req={productId:'jbl',title:'Fone JBL Tune 520BT Preto',affiliateUrl:'https://meli.la/abc',expectedUrl:'https://www.mercadolivre.com.br/fone/p/MLB23997257?wid=MLB1234567890'};
const ok={url:'https://www.mercadolivre.com.br/fone/p/MLB23997257?wid=MLB1234567890&matt_tracing_id=not-a-secret',title:'JBL Tune 520BT Fone sem fio',listingIds:['MLB1234567890'],buyable:true};

test('confirma disponibilidade sem comparar nome, identidade ou preço',()=>{
 const result=core.classify(req,ok);assert.equal(result.status,'available');assert.equal(result.kind,core.KIND);assert.equal(result.readOnly,true);assert.equal(result.inspection,'availability');
 assert.equal(result.finalUrl,'https://www.mercadolivre.com.br/fone/p/MLB23997257?wid=MLB1234567890');
 assert.doesNotMatch(JSON.stringify(result),/preco|price|currency|matt_tracing/);
 assert.equal(core.classify(req,{...ok,buyable:false}).status,'unverified');
 assert.equal(core.classify(req,{...ok,title:''}).status,'available');
});
test('troca de nome ou código não é critério de indisponibilidade; loja inválida permanece não verificada',()=>{
 for(const e of [{...ok,url:ok.url.replace('MLB1234567890','MLB9999999999'),listingIds:['MLB9999999999']},{...ok,listingIds:['MLB9999999999']},{...ok,title:'JBL Tune 720BT Fone sem fio'}])assert.equal(core.classify(req,e).status,'available');
 assert.equal(core.classify(req,{...ok,url:'https://shopee.com.br/product/123/456'}).status,'unverified');
 assert.equal(core.classify(req,{...ok,listingIds:['MLB1234567890','MLB9999999999']}).status,'available');
 assert.equal(core.identity(req.expectedUrl+'#wid=MLB9999999999'),null);
});
test('catálogo com compra habilitada basta para disponibilidade, sem exigir wid ou nome',()=>{
 const noWid={...ok,url:'https://www.mercadolivre.com.br/fone/p/MLB23997257',listingIds:[]};
 assert.equal(core.classify(req,noWid).status,'available');
 assert.equal(core.classify(req,{...noWid,title:'Outro nome',listingIds:['MLB1234567890']}).status,'available');
});
test('capacidade, modelos e edições contraditórios não viram o mesmo produto',()=>{
 for(const [a,b]of [['Samsung Galaxy A55 256 GB','Samsung Galaxy A55 128 GB'],['Apple iPhone 15 Pro 256 GB','Apple iPhone 15 256 GB'],['Sony PS5 Slim Disk com leitor','Sony PS5 Slim Digital 825 GB'],['Fone JBL Tune 520BT','Fone JBL Tune 720BT']])assert.equal(core.titleMatch(a,b),'different',a);
 assert.equal(core.titleMatch('Fone JBL Tune 520BT Preto','JBL Tune 520BT Branco'),'compatible');
});
test('CAPTCHA/login e falhas não são anúncio indisponível; não há prova baseada em preço',()=>{
 assert.equal(core.classify(req,{...ok,security:true,unavailable:true,primaryNotice:true}).status,'security');
 assert.equal(core.classify(req,{...ok,login:true}).status,'login');
 assert.equal(core.classify(req,{...ok,unavailable:true,primaryNotice:false}).status,'available');
 assert.equal(core.classify(req,{...ok,unavailable:true,primaryNotice:true,buyable:false}).status,'unavailable');
 for(const path of ['/','/social/afiliado','/social/afiliado/lists','/social/afiliado?wid=MLB1234567890','/ofertas','/search'])assert.equal(core.classify(req,{...ok,url:'https://www.mercadolivre.com.br'+path,listingIds:[],unavailable:true,primaryNotice:true}).status,'unverified');
});
test('Shopee confirma disponibilidade sem exigir original ou comparar shop/item',()=>{
 const shopee={productId:'fone',title:'Fone Soundcore P30i Anker',affiliateUrl:'https://s.shopee.com.br/example',expectedUrl:'https://shopee.com.br/product/1776344676/58264946714'};
 const e={url:'https://shopee.com.br/fone-i.1776344676.58264946714?utm_source=affiliate',title:'Fone Anker Soundcore P30i',buyable:true};
 assert.equal(core.classify(shopee,e).status,'available');
 assert.equal(core.classify({...shopee,expectedUrl:''},e).status,'available');
 assert.equal(core.classify(shopee,{...e,url:e.url.replace('58264946714','12345678901')}).status,'available');
 assert.throws(()=>core.request({...shopee,expectedUrl:req.expectedUrl}));
});
test('URLs enganosas, credenciais, domínios externos e protocolos inseguros são recusados',()=>{
 for(const link of ['http://meli.la/abc','javascript:alert(1)','https://meli.la.evil.example/abc','https://user:password@meli.la/abc','https://meli.la:443/abc?access_token=secret','https://www.mercadolivre.com.br/p/MLB23997257?client_secret=secret','https://shopee.com.br/product/1/2?code=secret'])assert.equal(core.url(link),null,link);
 const row=core.safeResult({...core.classify(req,ok),preco:123,token:'secret',foundTitle:'Fone access_token=SUPERSECRET',reason:'Authorization: Bearer SUPERSECRET',finalUrl:ok.url+'&access_token=SUPERSECRET'});
 assert.doesNotMatch(JSON.stringify(row),/SUPERSECRET|"token"|"preco"|"price"/);assert.equal(row.finalUrl,'');
});
test('fila não modifica produtos, usa afiliado de verdade e inclui pausados só por escolha',()=>{
 const p=Object.freeze({id:'p',titulo:req.title,preco:123,link:req.expectedUrl,linkAfiliado:req.affiliateUrl,linkShopee:'https://s.shopee.com.br/example',conferenciaPausada:true});
 const rows=core.queue([p,p]);assert.equal(rows.length,1);assert.equal(rows[0].affiliateUrl,req.affiliateUrl);assert.equal(rows[0].expectedUrl,req.expectedUrl);assert.equal(core.queue([p],false).length,0);assert.equal(p.preco,123);assert.equal(p.linkShopee,'https://s.shopee.com.br/example');
 assert.doesNotMatch(JSON.stringify(core.project(p)),/preco|price/);assert.equal(core.queue([{...p,linkAfiliado:'https://meli.la/abc?access_token=SECRET'}])[0].invalid,true);
});
test('pedido não navega diretamente para conta, carrinho, pagamento ou página genérica',()=>{
 for(const affiliateUrl of ['https://www.mercadolivre.com.br/cart/','https://shopee.com.br/checkout/','https://www.mercadolivre.com.br/login/','https://www.mercadolivre.com.br/'])assert.throws(()=>core.request({...req,expectedUrl:'',affiliateUrl}));
});

test('prefere anúncio original e registra explicitamente a alternativa quando só existe afiliado',()=>{
 const original=core.request(req);assert.equal(original.checkUrl,req.expectedUrl);assert.equal(original.checkedVia,'original_product');assert.equal(original.inspection,'availability');
 const fallback=core.request({...req,expectedUrl:''});assert.equal(fallback.checkUrl,req.affiliateUrl);assert.equal(fallback.checkedVia,'affiliate_fallback');
 const p={id:'p',titulo:'Modelo apenas na Shopee',link:'https://shopee.com.br/product/123/456',linkAfiliado:'https://s.shopee.com.br/test',linkShopee:'https://s.shopee.com.br/test'};
 assert.equal(core.queue([p]).length,0,'cadastros apenas na Shopee não entram na conferência');
 const originalOnly=core.queue([{id:'original-only',titulo:req.title,link:req.expectedUrl}]);assert.equal(originalOnly.length,1);assert.equal(originalOnly[0].checkUrl,req.expectedUrl);
});
test('evidência de página ignora recomendações e não procura valores monetários',()=>{
 const node=(textContent,excluded=false)=>({textContent,disabled:false,closest:()=>excluded?{}:null,getClientRects:()=>[{}],getAttribute:()=>null});
 const h=node('JBL Tune 520BT Fone sem fio'),b=node('Comprar agora'),bad=node('Produto indisponível',true),code=node('Anúncio #1234567890');
 const doc={body:{innerText:'Fone JBL Tune 520BT R$ 99,90'},defaultView:{getComputedStyle:()=>({display:'block',visibility:'visible'})},querySelectorAll:s=>{if(/price|money|currency/i.test(s))throw Error('não ler preço');return s.startsWith('h1')?[h]:s.includes('ui-pdp-message')?[bad]:s.includes('ui-pdp-actions')?[b]:s.includes('denounce')?[code]:[];}};
 assert.equal(core.classify(req,core.evidence(doc,ok.url)).status,'available');
 assert.equal(core.evidence({...doc,body:{innerText:'Não sou um robô'}},ok.url).security,true);
 assert.equal(core.evidence(doc,'https://shopee.com.br/buyer/login?state=sensitive').login,true);
});

async function bridge(){
 const values=new Map(),listeners=new Map(),timers=new Map(),intervals=new Map(),opens=[];let id=0;
 const env={URL,URLSearchParams,Date,Math,Promise,location:{hostname:'rankingdacompra.com.br'},document:{},unsafeWindow:{innerWidth:1200,open:(...args)=>{opens.push(args);return {focus(){}};}},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:i=>timers.delete(i),setInterval:fn=>{intervals.set(++id,fn);return id;},clearInterval:i=>intervals.delete(i),GM_getValue:(key,fallback)=>values.get(key)??fallback,GM_setValue:(key,value)=>values.set(key,value),GM_addValueChangeListener:(key,fn)=>{listeners.set(++id,{key,fn});return id;},GM_removeValueChangeListener:i=>listeners.delete(i),GM_getTab:fn=>fn({}),GM_saveTab:(_tab,fn)=>fn?.()};
 const c=vm.createContext(env);vm.runInContext(await readFile(new URL('../bot-links.user.js',import.meta.url),'utf8'),c);
 const respond=value=>{values.set('rdc_link_audit_result_v1',value);for(const {fn}of [...listeners.values()])fn('rdc_link_audit_result_v1',null,value);};
 return {values,listeners,timers,intervals,opens,panel:env.unsafeWindow,respond};
}

test('robô recusa pedidos da Shopee antes de abrir aba ou gravar comando',async()=>{
 const f=await bridge();await assert.rejects(f.panel.conferirLinkAfiliadoNaAbaLocal({productId:'s',title:'Modelo da Shopee',affiliateUrl:'https://s.shopee.com.br/test',expectedUrl:'https://shopee.com.br/product/123/456'}),/somente anúncios do Mercado Livre/);assert.equal(f.opens.length,0);assert.equal(f.values.has('rdc_link_audit_command_v1'),false);assert.equal(f.panel.__RDC_BOT_LINKS_LOCAL__.marketScope,'mercado_livre');
});

test('estoque principal disponível basta sem escolher tamanho/cor; aviso oculto ou de outro vendedor não basta',()=>{
 const node=(value,excluded=false)=>({textContent:value,disabled:true,closest:()=>excluded?{}:null,getClientRects:()=>[{}],getAttribute:()=>null});
 for(const [value,excluded,want]of [['Estoque disponível',false,'available'],['Estoque disponível',true,'unverified'],['Estoque indisponível',false,'unverified']]){
  const n=node(value,excluded),doc={body:{innerText:''},defaultView:{getComputedStyle:()=>({display:'block',visibility:'visible'})},querySelectorAll:s=>s==='.ui-pdp-stock-information,[data-testid="stock-information"]'?[n]:[]};assert.equal(core.classify(req,core.evidence(doc,ok.url)).status,want);
 }
});
test('nova instalação bloqueia chamadas de preço e exige novo protocolo vinculado ao produto/pedido/sessão',async()=>{
 const f=await bridge();assert.equal(f.panel.__RDC_BOT_PRECOS_LOCAL__.ready,false);assert.equal(f.panel.__RDC_BOT_LINKS_LOCAL__.readOnly,true);
 await assert.rejects(f.panel.conferirPrecoNaAbaLocal(req),/somente links/);
 const waiting=f.panel.conferirLinkAfiliadoNaAbaLocal(req),command=f.values.get('rdc_link_audit_command_v1');assert.ok(command);assert.equal(f.opens.length,1);assert.match(f.opens[0][0],/mercadolivre.com.br\/#_rdc_link_audit=/);
 const result={...core.classify(req,ok),requestId:command.requestId,session:command.session,affiliateUrl:command.affiliateUrl,checkUrl:command.checkUrl};let resolved=false;waiting.then(()=>resolved=true);
 f.respond({...result,requestId:'old'});f.respond({...result,productId:'other'});f.respond({...result,session:'other'});f.respond({...result,checkUrl:'https://meli.la/wrong'});f.respond({...result,robotVersion:'2.5.0'});await Promise.resolve();assert.equal(resolved,false);
 f.respond({...result,preco:999,token:'DO-NOT-COPY'});const out=await waiting;assert.equal(out.status,'available');assert.equal('preco'in out,false);assert.equal('token'in out,false);assert.equal(f.values.get('rdc_link_audit_command_v1'),null);assert.equal(f.values.get('rdc_link_audit_result_v1'),null);assert.equal(f.listeners.size,0);
});
test('consulta concorrente, cancelamento e timeout não alteram dados ou confundem sessão',async()=>{
 const f=await bridge(),first=f.panel.conferirLinkAfiliadoNaAbaLocal(req);
 await assert.rejects(f.panel.conferirLinkAfiliadoNaAbaLocal(req),/consulta de links/);
 f.panel.cancelarConferenciaLinksLocal();for(const fn of [...f.intervals.values()])fn();await assert.rejects(first,/interrompida/);
 const second=f.panel.conferirLinkAfiliadoNaAbaLocal(req);for(const fn of [...f.timers.values()])fn();await assert.rejects(second,/60 segundos/);assert.equal(f.listeners.size,0);
});
test('pacote gerado é reproduzível e substitui identidade antiga sem permissões de API/cookies',async()=>{
 const before=await readFile(new URL('../bot-links.user.js',import.meta.url),'utf8'),built=await buildLinkAuditBot(undefined,false);assert.equal(before.replace(/\r\n/g,'\n'),built);
 const old=await readFile(new URL('../bot-precos.user.js',import.meta.url),'utf8');for(const field of ['name','namespace'])assert.equal(built.match(new RegExp('^// @'+field+'\\s+(.+)$','m'))?.[1],old.match(new RegExp('^// @'+field+'\\s+(.+)$','m'))?.[1]);
 assert.match(built,/@version\s+2\.5\.2/);assert.doesNotMatch(built,/GM_xmlhttpRequest|GM_cookie|parsePrice|updateDoc|setDoc|runTransaction|\.submit\(|\.click\(/);assert.doesNotMatch(built,/^\/\/ @match\s+.*(?:shopee|shope\.ee)/m);
});

async function worker(state,href,values,body=''){
 const navigations=[],intervals=[];const node=t=>({textContent:t,disabled:false,getClientRects:()=>[{}],getAttribute:()=>null,closest:()=>null});
 const doc={readyState:'complete',body:{innerText:body},defaultView:{getComputedStyle:()=>({display:'block',visibility:'visible'})},querySelectorAll:s=>s.startsWith('h1')?[node(req.title)]:s.includes('ui-pdp-actions')?[node('Comprar agora')]:s.includes('denounce')?[node('Anúncio #1234567890')]:[],addEventListener(){}};
 const context=vm.createContext({URL,URLSearchParams,Date,Math,Promise,document:doc,location:{href,hostname:new URL(href).hostname,assign:u=>navigations.push(u)},unsafeWindow:{},setTimeout:fn=>setImmediate(fn),clearTimeout:clearImmediate,setInterval:fn=>intervals.push(fn),clearInterval(){},GM_getValue:(k,d)=>values.get(k)??d,GM_setValue:(k,v)=>values.set(k,v),GM_addValueChangeListener(){},GM_removeValueChangeListener(){},GM_getTab:fn=>fn({...state}),GM_saveTab:(tab,fn)=>{Object.assign(state,tab);fn?.();}});
 vm.runInContext(await readFile(new URL('../bot-links.user.js',import.meta.url),'utf8'),context);
 for(let i=0;i<20;i++)await new Promise(setImmediate);return {navigations,intervals,context};
}
test('worker visita anúncio original em vez do perfil afiliado, preservando vínculo após redirecionar',async()=>{
 const session='test-link-worker-session',command={...core.request(req),requestId:'request-worker',session,createdAt:Date.now()},values=new Map([['rdc_link_audit_command_v1',command]]),state={};
 const common=await worker({},ok.url,values);assert.equal(common.navigations.length,0);assert.equal(common.intervals.length,0);
 const first=await worker(state,'https://www.mercadolivre.com.br/#_rdc_link_audit='+session,values);
 assert.equal(first.navigations[0],req.expectedUrl);assert.equal(state.rdcLinkAuditNavigation,command.requestId);
 const second=await worker(state,ok.url,values);assert.equal(second.navigations.length,0);
 const result=values.get('rdc_link_audit_result_v1');assert.equal(result.status,'available');assert.equal(result.checkUrl,req.expectedUrl);assert.equal(result.session,session);assert.equal(result.requestId,command.requestId);assert.equal('preco'in result,false);
});
test('worker pausa no CAPTCHA, ignora protocolo antigo e sessão antiga não sobrescreve heartbeat atual',async()=>{
 const session='test-link-security-session',command={...core.request(req),requestId:'request-security',session,createdAt:Date.now()},values=new Map([['rdc_link_audit_command_v1',command]]),state={rdcLinkAuditSession:session,rdcLinkAuditNavigation:command.requestId};
 await worker(state,ok.url,values,'Não sou um robô');assert.equal(values.get('rdc_link_audit_result_v1').status,'security');
 values.delete('rdc_link_audit_result_v1');values.set('rdc_link_audit_command_v1',{...command,session:'new-session-123',kind:'old_price_command'});values.set('rdc_link_audit_worker_v1',{session:'new-session-123',at:Date.now()});
 await worker(state,ok.url,values);assert.equal(values.has('rdc_link_audit_result_v1'),false);assert.equal(values.get('rdc_link_audit_worker_v1').session,'new-session-123');
});
test('fontes dos dois painéis exigem a mesma sessão e expõem apenas projeção mínima sem releitura por item',async()=>{
 for(const file of ['dashboard.html','painel-celular.html']){
  const html=await readFile(new URL('../'+file,import.meta.url),'utf8');const source=html.match(/window\.RDCAffiliateAuditSource = async \(\) => \{[\s\S]*?\n\s*\};/)?.[0];assert.ok(source,file);
  const auth={currentUser:{uid:'admin'}},record={...core.project({id:'p',titulo:req.title,link:req.expectedUrl,linkAfiliado:req.affiliateUrl}),preco:999,token:'DO-NOT-COPY'},snapshot={docs:[{id:'p',data:()=>record}]};let calls=0;
  const read=async()=>{calls++;return snapshot;};const c=vm.createContext({window:{RDCAffiliateLinkAudit:core,RDCProductQuarantine:quarantine,RDCAdminReadAccess:{products:read}},auth,lerProdutosParaModulosMovel:read});vm.runInContext(source,c);
  const rows=await c.window.RDCAffiliateAuditSource();assert.equal(calls,1);assert.equal(rows.length,1);assert.equal('preco'in rows[0],false);assert.equal('token'in rows[0],false);
  auth.currentUser=null;await assert.rejects(c.window.RDCAffiliateAuditSource(),/Entre novamente/);assert.equal(calls,1);
  auth.currentUser={uid:'admin'};const changed=async()=>{auth.currentUser={uid:'other'};return snapshot;};c.window.RDCAdminReadAccess.products=changed;c.lerProdutosParaModulosMovel=changed;await assert.rejects(c.window.RDCAffiliateAuditSource(),/sessão mudou/);
 }
});
