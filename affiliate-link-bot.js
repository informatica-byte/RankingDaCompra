(function(root,factory){const api=factory(root.RDCAffiliateLinkAudit);if(typeof module==='object'&&module.exports)module.exports=api;else root.RDCAffiliateLinkBot=api;})(typeof globalThis!=='undefined'?globalThis:this,function(core){
 'use strict';
 const COMMAND='rdc_link_audit_command_v1',RESULT='rdc_link_audit_result_v1',HEARTBEAT='rdc_link_audit_worker_v1';
 function install(env){
  const {root,document:doc,location:loc,get,set,listen,unlisten,getTab,saveTab}=env;
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const random=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  if(loc.hostname==='rankingdacompra.com.br'){
   // Same userscript identity replaces the price bot. No legacy price protocol
   // is accepted or returned, even if an old panel button survives a reload.
   root.__RDC_BOT_PRECOS_LOCAL__={version:core.VERSION,ready:false,linksOnly:true};
   const disabled=async()=>{throw Object.assign(Error('Este robô verifica somente links. Preços não são consultados ou salvos.'),{code:'RDC_LINKS_ONLY'});};
   root.conferirPrecoNaAbaLocal=disabled;root.conferirPrecoPelaFonteLocal=disabled;
   root.__RDC_BOT_LINKS_LOCAL__={version:core.VERSION,ready:true,readOnly:true,marketScope:'mercado_livre'};
   let session=random(),active=null,renew=false;
   root.cancelarConferenciaLinksLocal=()=>{if(active&&get(COMMAND)?.requestId===active)set(COMMAND,null);};
   root.conferirLinkAfiliadoNaAbaLocal=input=>new Promise((resolve,reject)=>{
    let req;try{req=core.request(input);if(req.market!=='mercado_livre')throw Error('Este robô confere somente anúncios do Mercado Livre.');}catch(e){reject(e);return;}
    const prior=get(COMMAND);if(active||(prior&&Date.now()-prior.createdAt<90000)){reject(Object.assign(Error('Já existe uma consulta de links em outra aba. Aguarde ou pare o outro lote.'),{code:'RDC_AUDIT_BUSY'}));return;}
    if(renew){session=random();renew=false;}
    const requestId=random();active=requestId;let listener,timer,poll;
    const clear=()=>{clearTimeout(timer);clearInterval(poll);if(listener!==undefined)unlisten(listener);if(get(COMMAND)?.requestId===requestId)set(COMMAND,null);if(get(RESULT)?.requestId===requestId)set(RESULT,null);active=null;};
    const accept=value=>{if(!value||value.requestId!==requestId||value.session!==session||value.affiliateUrl!==req.affiliateUrl||value.checkUrl!==req.checkUrl||value.productId!==req.productId||value.robotVersion!==core.VERSION||value.inspection!=='availability')return;
     try{const result=core.safeResult(value);clear();resolve(result);}catch{} };
    listener=listen(RESULT,(_k,_old,value)=>accept(value));poll=setInterval(()=>{if(get(COMMAND)?.requestId!==requestId){clear();reject(Object.assign(Error('Consulta interrompida; nenhum cadastro foi alterado.'),{code:'RDC_AUDIT_STOPPED'}));return;}accept(get(RESULT));},500);
    timer=setTimeout(()=>{clear();renew=true;reject(Object.assign(Error('Não houve resposta em 60 segundos. O resultado fica pendente, não indisponível.'),{code:'RDC_AUDIT_TIMEOUT'}));},60000);
    set(COMMAND,{...req,requestId,session,createdAt:Date.now()});
    const worker=get(HEARTBEAT),live=worker?.session===session&&worker.version===core.VERSION&&Date.now()-worker.at<15000;
    if(!live){const home='https://www.mercadolivre.com.br/';
     const opened=root.open(home+'#_rdc_link_audit='+session,'rdc_link_audit_'+session,root.innerWidth>=900?'popup=yes,width=640,height=850':'');
     if(!opened){clear();reject(Object.assign(Error('Permita a abertura da aba da loja e tente iniciar novamente.'),{code:'RDC_POPUP_BLOCKED'}));return;}
     try{opened.focus();}catch{}
    }
   });return;
  }
  let session='',navigation='',processing='',completed='';
  const tabRead=()=>new Promise(r=>{try{getTab(t=>r(t||{}));}catch{r({});}});
  const persist=async()=>{const tab=await tabRead();await new Promise(r=>{try{saveTab({...tab,rdcLinkAuditSession:session,rdcLinkAuditNavigation:navigation},r);}catch{r();}});};
  const send=(command,result)=>{if(get(COMMAND)?.requestId!==command.requestId)return;set(RESULT,{...core.safeResult(result),requestId:command.requestId,session,affiliateUrl:command.affiliateUrl,checkUrl:command.checkUrl});};
  async function run(){const c=get(COMMAND);if(!session)return;if(c?.session===session)set(HEARTBEAT,{session,version:core.VERSION,at:Date.now()});
   if(!c||c.kind!==core.KIND||c.readOnly!==true||c.session!==session||!c.requestId||Date.now()-c.createdAt>90000||processing===c.requestId||completed===c.requestId)return;
   let req;try{req=core.request(c);if(req.market!=='mercado_livre'||c.checkUrl!==req.checkUrl||c.inspection!=='availability')return;}catch{return;}
   processing=c.requestId;
   try{
    if(navigation!==c.requestId){navigation=c.requestId;await persist();if(get(COMMAND)?.requestId!==c.requestId)return;loc.assign(req.checkUrl);return;}
    let last='',stable=0,result;
    for(let i=0;i<40;i++){
     if(get(COMMAND)?.requestId!==c.requestId)return;
     result=core.classify(c,core.evidence(doc,loc.href));
     if(['security','login','unavailable'].includes(result.status))break;
     const signature=JSON.stringify([result.status,result.finalUrl,result.foundTitle]);stable=signature===last?stable+1:0;last=signature;
     if(stable>=2&&result.status==='available')break;
     await delay(500);
    }
    if(result){send(c,result);completed=c.requestId;}
   }finally{processing='';}
  }
  void(async()=>{const tab=await tabRead(),marker=new URLSearchParams(new URL(loc.href).hash.slice(1)).get('_rdc_link_audit');
   session=/^[a-z0-9-]{8,100}$/i.test(marker||'')?marker:tab.rdcLinkAuditSession||'';navigation=tab.rdcLinkAuditNavigation||'';
   if(!/^[a-z0-9-]{8,100}$/i.test(session))return;await persist();
   if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>void run(),{once:true});else void run();
   listen(COMMAND,()=>void run());setInterval(()=>void run(),1500);
  })();
 }
 return {COMMAND,RESULT,HEARTBEAT,install};
});
