(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.RDCAnalyticsAudience=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>api.init(root),{once:true});else api.init(root);}
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const SCOPE='https://www.googleapis.com/auth/analytics.readonly';
 const REFRESH_MS=15*60*1000,MIN_REFRESH_MS=60000;
 const METRICS=['sessions','totalUsers','screenPageViews'];
 const RANGE_KEYS=['today','7d','14d'];
 const ENDPOINT='https://analyticsdata.googleapis.com/v1beta/properties/';
 function config(value){
  if(!value||String(value.propertyId)!=='545546219')throw Error('configuration');
  const clientId=String(value.clientId||'');
  if(clientId&&!/^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(clientId))throw Error('configuration');
  if(value.timeZone!=='America/Sao_Paulo')throw Error('configuration');
  return {propertyId:'545546219',clientId,timeZone:'America/Sao_Paulo'};
 }
 function day(now=Date.now(),zone='America/Sao_Paulo'){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));}
 function start(end,n){const date=new Date(end+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-n+1);return date.toISOString().slice(0,10);}
 function ranges(now,zone){const end=day(now,zone);return [1,7,14].map((n,i)=>({key:RANGE_KEYS[i],start:start(end,n),end}));}
 function requestBody(now,zone){
  return {requests:ranges(now,zone).map(r=>({dateRanges:[{startDate:r.start,endDate:r.end}],metrics:METRICS.map(name=>({name})),dimensionFilter:{andGroup:{expressions:[{filter:{fieldName:'hostName',inListFilter:{values:['rankingdacompra.com.br','www.rankingdacompra.com.br'],caseSensitive:false}}},{filter:{fieldName:'pagePath',inListFilter:{values:['/','/index.html'],caseSensitive:true}}}]}},limit:'1',keepEmptyRows:true,returnPropertyQuota:true}))};
 }
 function integer(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>1e12)throw Error('invalid_report');return n;}
 function parseReports(result,cfg,at){
  if(!Array.isArray(result?.reports)||result.reports.length!==3)throw Error('invalid_report');
  const dates=ranges(at,cfg.timeZone);
  const items=result.reports.map((report,i)=>{
   if(JSON.stringify(report.metricHeaders?.map(h=>h.name))!==JSON.stringify(METRICS))throw Error('invalid_report');
   if((report.rows||[]).length>1||Number(report.rowCount||0)>1)throw Error('invalid_report');
   const values=report.rows?.[0]?.metricValues;
   if(values&&values.length!==3)throw Error('invalid_report');
   return {...dates[i],sessions:values?integer(values[0].value):0,users:values?integer(values[1].value):0,views:values?integer(values[2].value):0};
  });
  return {version:1,propertyId:cfg.propertyId,scope:'homepage',at,day:dates[0].end,timeZone:cfg.timeZone,ranges:items};
 }
 function snapshot(value,cfg,now){
  if(value?.version!==1||value.propertyId!==cfg.propertyId||value.scope!=='homepage'||value.timeZone!==cfg.timeZone||!Number.isSafeInteger(value.at)||value.at<=0||value.at>now+60000||now-value.at>14*86400000||value.day!==day(value.at,cfg.timeZone))return null;
  try{
   const expected=ranges(value.at,cfg.timeZone);
   if(!Array.isArray(value.ranges)||value.ranges.length!==3)return null;
   const clean=expected.map((r,i)=>{const v=value.ranges[i];if(v.key!==r.key||v.start!==r.start||v.end!==r.end)throw Error('invalid');return {...r,sessions:integer(v.sessions),users:integer(v.users),views:integer(v.views)};});
   return {version:1,propertyId:cfg.propertyId,scope:'homepage',at:value.at,day:value.day,timeZone:cfg.timeZone,ranges:clean};
  }catch{return null;}
 }
 function errorCode(status,result){
  const reasons=(result?.error?.details||[]).map(d=>String(d.reason||'')).join(' ');
  if(/BILLING|PAYMENT/i.test(reasons))return 'billing';
  if(status===401)return 'expired';if(status===429)return 'quota';
  if(status===403)return /SERVICE_DISABLED|API_DISABLED/i.test(reasons)?'configuration':'permission';
  return status>=500?'network':'invalid_report';
 }
 function createReader({settings,userId,storage,fetch:send,now=Date.now,onChange=()=>{}}){
  const cfg=config(settings);if(!/^[a-zA-Z0-9_-]{1,128}$/.test(userId||''))throw Error('session');
  const key='rdc-ga4-audience-v1:'+userId+':'+cfg.propertyId;
  let accessToken='',expiresAt=0,closed=false,pending=null,lastAttempt=0,abort=null,generation=0;
  let state={connected:false,loading:false,status:'disconnected',snapshot:null};
  const emit=()=>{if(!closed)onChange({...state});};
  function stored(){try{return snapshot(JSON.parse(storage.getItem(key)||'null'),cfg,now());}catch{return null;}}
  function acceptCache(){const latest=stored();if(latest&&(!state.snapshot||latest.at>state.snapshot.at)){state.snapshot=latest;emit();}}
  function authorize(response){
   if(closed)return false;
   const scopes=String(response?.scope||'').split(/\s+/).filter(Boolean);
   generation++;abort?.abort();pending=null;abort=null;state.loading=false;lastAttempt=0;
   if(response?.error||!scopes.includes(SCOPE)||scopes.some(s=>s!==SCOPE)||typeof response.access_token!=='string'||!response.access_token||!Number.isFinite(Number(response.expires_in))){failure('permission');emit();return false;}
   accessToken=response.access_token;expiresAt=now()+Math.min(3600,Math.max(0,Number(response.expires_in)))*1000-30000;
   state.connected=expiresAt>now();state.status=state.connected?'ready':'expired';emit();return state.connected;
  }
  function failure(code){state.status=code;state.connected=false;accessToken='';expiresAt=0;}
  async function refresh(manual=false){
   if(closed||pending)return pending;
   if(!accessToken||now()>=expiresAt){failure('expired');emit();return;}
   acceptCache();
   if(state.snapshot&&state.snapshot.day===day(now(),cfg.timeZone)&&now()-state.snapshot.at<(manual?MIN_REFRESH_MS:REFRESH_MS)){state.status='ready';emit();return;}
   if(lastAttempt&&now()-lastAttempt<MIN_REFRESH_MS)return;
   lastAttempt=now();state.loading=true;state.status='refreshing';emit();
   const requestedAt=now(),currentGeneration=generation;abort=new AbortController();
   const controller=abort,timeout=setTimeout(()=>controller.abort(),20000);
   pending=(async()=>{
    try{
     const response=await send(ENDPOINT+cfg.propertyId+':batchRunReports',{method:'POST',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Authorization':'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify(requestBody(requestedAt,cfg.timeZone)),signal:abort.signal});
     const result=await response.json();if(closed||currentGeneration!==generation)return;
     if(!response.ok)throw Error(errorCode(response.status,result));
     const clean=parseReports(result,cfg,requestedAt);
     state.snapshot=clean;state.status='ready';
     // Aggregates only. Never persist a token, response body, user profile or URL.
     try{storage.setItem(key,JSON.stringify(clean));}catch{state.status='local_unavailable';}
    }catch(error){if(!closed&&currentGeneration===generation)failure(['billing','permission','expired','configuration','quota','invalid_report'].includes(error.message)?error.message:'network');}
    finally{clearTimeout(timeout);if(currentGeneration===generation){pending=null;abort=null;state.loading=false;emit();}}
   })();return pending;
  }
  function disconnect(){generation++;abort?.abort();abort=null;pending=null;state.loading=false;failure('disconnected');emit();}
  function close(){generation++;closed=true;accessToken='';expiresAt=0;abort?.abort();}
  function readState(){if(state.connected&&now()>=expiresAt)failure('expired');return {...state};}
  acceptCache();
  return {key,authorize,refresh,acceptCache,disconnect,close,readState};
 }
 function init(root){
  if(!/^\/(?:dashboard|painel-celular)\.html$/.test(root.location.pathname))return;
  const hosts=[...root.document.querySelectorAll('[data-ga4-audience]')];if(!hosts.length)return;
  let reader=null,uid='',settings=null,client=null,loadingConfig=null;
  const messages={disconnected:'Não conectado ao GA4. Nenhum valor atual foi consultado.',ready:'Conectado somente para leitura. Atualização automática a cada 15 minutos enquanto este painel estiver visível e a autorização for válida.',refreshing:'Consultando relatórios do Google Analytics…',expired:'A autorização expirou ou não foi iniciada. Use Conectar Google Analytics para atualizar.',permission:'O Google não concedeu a leitura desta propriedade. Confira a conta e a autorização. Nenhum valor foi substituído por zero.',configuration:'A integração OAuth/API ainda precisa ser configurada no projeto Google. Não ative cobrança.',quota:'O Google limitou as consultas. Atualização automática pausada; não aumente cotas nem contrate serviços.',billing:'O Google indicou exigência de faturamento. Integração pausada: não ative cobrança.',network:'Consulta indisponível. O último resumo foi preservado; reconecte para tentar novamente.',invalid_report:'A resposta do GA4 não pôde ser validada. Os números anteriores foram preservados.',local_unavailable:'Dados consultados, mas o navegador não permitiu compartilhar o resumo local com a outra aba.'};
  function paint(state){
   for(const host of hosts){
    host.querySelector('[data-ga4-status]').textContent=state.status==='disconnected'&&state.snapshot?'Não conectado nesta aba. Exibindo o último resumo do GA4 compartilhado neste navegador; conecte para manter a atualização automática.':messages[state.status]||messages.disconnected;
    const connect=host.querySelector('[data-ga4-connect]');connect.disabled=!uid||!client||state.loading;connect.textContent=state.connected?'Reconectar Google Analytics':'Conectar Google Analytics';
    host.querySelector('[data-ga4-refresh]').disabled=!state.connected||state.loading;
    host.querySelector('[data-ga4-disconnect]').disabled=!state.connected;
    const saved=state.snapshot,old=saved&&saved.day!==day(Date.now(),settings.timeZone);
    host.querySelector('[data-ga4-date]').textContent=saved?'Última consulta: '+new Intl.DateTimeFormat('pt-BR',{timeZone:settings.timeZone,dateStyle:'short',timeStyle:'short'}).format(new Date(saved.at))+' — período até '+saved.day.split('-').reverse().join('/')+'.'+(old?' Resumo de outro dia: “hoje” não foi consultado.':' Hoje é parcial e pode haver atraso no processamento do GA4.'):'Sem dados consultados. “—” não significa zero visitantes.';
    for(const key of RANGE_KEYS){const r=saved?.ranges.find(r=>r.key===key);for(const metric of ['sessions','users','views'])host.querySelector('[data-ga4-value="'+key+':'+metric+'"]').textContent=r&&!(old&&key==='today')?r[metric].toLocaleString('pt-BR'):'—';}
   }
  }
  for(const host of hosts){
   host.innerHTML='<h2>📊 Audiência atual — Google Analytics</h2><p>Propriedade Ranking da Compra. Somente a página inicial: / e /index.html. Sessões, usuários e visualizações são medidas diferentes, não vendas.</p><div class="ga4-periods">'+[['today','Hoje — parcial'],['7d','Últimos 7 dias do resumo'],['14d','Últimos 14 dias do resumo']].map(([key,title])=>'<section><h3>'+title+'</h3><dl>'+[['sessions','Sessões'],['users','Usuários (GA4)'],['views','Visualizações da página inicial']].map(([metric,label])=>'<div><dt>'+label+'</dt><dd data-ga4-value="'+key+':'+metric+'">—</dd></div>').join('')+'</dl></section>').join('')+'</div><p data-ga4-status role="status">Aguardando login do painel.</p><p data-ga4-date>Sem dados consultados. “—” não significa zero visitantes.</p><div class="ga4-actions"><button type="button" data-ga4-connect disabled>Conectar Google Analytics</button><button type="button" data-ga4-refresh disabled>Atualizar agora</button><button type="button" data-ga4-disconnect disabled>Desconectar nesta aba</button><a href="https://analytics.google.com/analytics/web/#/a393666764p545546219/reports/intelligenthome" target="_blank" rel="noopener noreferrer">Abrir o Analytics ↗</a></div><p class="ga4-note">Leitura direta do GA4, sem consultas ao Firebase. O token fica somente na memória desta aba; apenas totais e datas podem ser compartilhados localmente entre os painéis deste navegador. Ao expirar, confirme novamente no Google. Os dados podem incluir seus próprios acessos e testes; não são pessoas ou vendas comprovadas. Não some estes números ao contador antigo nem aos cliques das ofertas.</p>';
   host.querySelector('[data-ga4-connect]').onclick=()=>{if(client&&uid){try{client.requestAccessToken({prompt:''});}catch{paint({...reader.readState(),status:'permission'});}}};
   host.querySelector('[data-ga4-refresh]').onclick=()=>void reader?.refresh(true);
   host.querySelector('[data-ga4-disconnect]').onclick=()=>reader?.disconnect();
  }
  function sdk(){return new Promise((resolve,reject)=>{
   if(root.google?.accounts?.oauth2)return resolve();
   let script=root.document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
   if(!script){script=root.document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;root.document.head.append(script);}
   const timeout=root.setTimeout(()=>reject(Error('configuration')),15000);
   script.addEventListener('load',()=>{root.clearTimeout(timeout);root.google?.accounts?.oauth2?resolve():reject(Error('configuration'));},{once:true});
   script.addEventListener('error',()=>{root.clearTimeout(timeout);reject(Error('configuration'));},{once:true});
  });}
  async function session(){
   const next=String(root.RDCAnalyticsUserId?.()||'');if(next===uid)return;
   reader?.close();reader=null;client=null;uid=next;
   paint({connected:false,status:'disconnected',snapshot:null});if(!uid)return;
   const expected=uid;
   try{
    loadingConfig||=(root.fetch('/analytics-audience-config.json',{cache:'no-cache',credentials:'omit'}).then(r=>{if(!r.ok)throw Error('configuration');return r.json();}).then(config));
    settings=await loadingConfig;if(uid!==expected)return;
    reader=createReader({settings,userId:uid,storage:root.localStorage,fetch:root.fetch.bind(root),onChange:paint});paint(reader.readState());
    if(!settings.clientId)throw Error('configuration');
    await sdk();if(uid!==expected)return;
    client=root.google.accounts.oauth2.initTokenClient({client_id:settings.clientId,scope:SCOPE,include_granted_scopes:false,callback:response=>{if(uid!==expected)return;if(reader.authorize(response))void reader.refresh();},error_callback:()=>{if(uid===expected)paint({...reader.readState(),status:'permission'});}});
    paint(reader.readState());
   }catch{if(uid===expected)paint({connected:false,status:'configuration',snapshot:reader?.readState().snapshot||null});}
  }
  root.addEventListener('rdc-admin-auth',()=>void session());
  root.addEventListener('storage',event=>{if(reader&&event.key===reader.key)reader.acceptCache();});
  root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden&&reader?.readState().connected)void reader.refresh();});
  root.setInterval(()=>{if(reader&&client){const state=reader.readState();paint(state);if(!root.document.hidden&&state.connected)void reader.refresh();}},60000);
  void session();
 }
 return {SCOPE,REFRESH_MS,config,day,start,ranges,requestBody,parseReports,snapshot,errorCode,createReader,init};
});
