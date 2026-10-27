(function(){
 'use strict';
 const core=window.RDCAffiliateLinkAudit;
 if(!core||!window.RDCInformational?.enabled)return;
 const STORAGE='rdc-affiliate-audit-report-v1';
 const labels={active_same:'Ativo e produto confirmado',unavailable:'Anúncio indisponível',different_target:'Destino diferente — revisar',identity_unconfirmed:'Identidade/disponibilidade a confirmar',security:'Verificação humana / bloqueio',login:'Login necessário',error:'Falha de comunicação / link inválido'};
 const esc=window.RDCInformational.esc;
 async function fingerprint(row){if(!crypto.subtle)return '';const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([row.productId,row.title,row.affiliateUrl,row.expectedUrl])));return [...new Uint8Array(data)].map(x=>x.toString(16).padStart(2,'0')).join('');}
 function mount(){
  const host=document.getElementById('links-afiliados');if(!host||host.dataset.mounted)return;host.dataset.mounted='true';
  let rows=[],results=new Map(),running=false,loading=false,generation=0,ready=false;
  const setStatus=text=>host.querySelector('[data-audit-status]').textContent=text;
  host.innerHTML='<h2>🔗 Conferência dos links de afiliados</h2><p>Somente disponibilidade e identidade do destino. Não altera preços, links, pausas ou cadastros. Nenhuma consulta começa sozinha.</p><p class="link-audit-note">Resultados locais neste navegador, não salvos no Firebase. CAPTCHA e login exigem sua intervenção; não são classificados como anúncio fora do ar. Link curto sem identificação original suficiente pode ficar para revisão.</p><p data-audit-robot role="status">Verificando a versão do robô...</p><a class="link-audit-install" href="/bot-links.user.js" target="_blank" rel="noopener">Atualizar robô para 2.5.0 — somente links</a><p class="mini">No Tampermonkey, o nome antigo “Bot local de preços” é mantido apenas para substituir a instalação existente. A versão 2.5.0 não devolve preços.</p><div class="link-audit-controls"><label><input type="checkbox" data-audit-paused checked> Incluir cadastros pausados, sem reativá-los</label><label><input type="checkbox" data-audit-repeat> Conferir novamente os resultados já registrados</label><label>Máximo por rodada <select data-audit-limit><option>10</option><option selected>20</option><option>50</option></select></label></div><div class="link-audit-actions"><button type="button" data-audit-load>Carregar links</button><button type="button" data-audit-start disabled>Conferir pendentes</button><button type="button" data-audit-stop disabled>Parar</button><button type="button" data-audit-download>Baixar relatório local</button></div><p data-audit-status role="status" aria-live="polite">Carregue os links quando quiser verificar. Isso reutiliza os produtos já lidos pelo painel, sem consultar visitas.</p><p data-audit-summary></p><div data-audit-results></div>';
  const el=s=>host.querySelector(s),locked=state=>{el('[data-audit-load]').disabled=state;el('[data-audit-paused]').disabled=state;el('[data-audit-repeat]').disabled=state;el('[data-audit-limit]').disabled=state;el('[data-audit-start]').disabled=state||!ready||!rows.length;el('[data-audit-stop]').disabled=!state;};
  function restore(){try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(saved?.kind!==core.KIND||saved.version!==1||!Array.isArray(saved.records))return;for(const row of saved.records.slice(0,3000)){try{const clean=core.safeResult(row);if(/^[a-f0-9]{64}$/.test(row.fingerprint||'')&&Date.now()-clean.checkedAt<core.MAX_AGE&&clean.checkedAt<=Date.now()+60000)results.set(clean.productId+':'+clean.market,{...clean,fingerprint:row.fingerprint});}catch{}}}catch{setStatus('Relatório local não pôde ser restaurado. Os cadastros não foram alterados.');}}
  const report=()=>({version:1,kind:core.KIND,scope:'somente neste navegador; sem credenciais, preços ou alterações de cadastro',exportedAt:new Date().toISOString(),records:[...results.values()]});
  function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(report()));return true;}catch{running=false;setStatus('O navegador não conseguiu preservar o relatório. Rodada parada; baixe o resultado antes de sair.');return false;}}
  function draw(){
   const current=rows.length?rows.map(row=>({...row,result:results.get(row.key)?.fingerprint===row.fingerprint?results.get(row.key):null})):[];
   const count=status=>current.filter(x=>x.result?.status===status).length;
   el('[data-audit-summary]').textContent=rows.length+' link(s) carregado(s) · '+count('active_same')+' confirmado(s) neste relatório · '+current.filter(x=>x.result&&x.result.status!=='active_same').length+' separado(s) · '+current.filter(x=>!x.result).length+' sem resultado. Não é monitoramento permanente; resultados refletem o momento da leitura.';
   const sorted=[...current.filter(x=>x.result&&x.result.status!=='active_same'),...current.filter(x=>x.result?.status==='active_same')];
   el('[data-audit-results]').innerHTML=sorted.slice(0,150).map(x=>'<article class="link-audit-result"><h3>'+esc(x.title)+'</h3><strong>'+esc(labels[x.result.status])+' · '+esc(x.market==='shopee'?'Shopee':'Mercado Livre')+'</strong><p>'+esc(x.result.reason)+'</p>'+(x.result.foundTitle?'<p>Nome lido: '+esc(x.result.foundTitle)+'</p>':'')+'<small>Verificado em '+esc(new Date(x.result.checkedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))+'</small>'+(x.result.finalUrl?'<p><a href="'+esc(x.result.finalUrl)+'" target="_blank" rel="noopener noreferrer">Abrir destino lido para revisão</a></p>':'')+'</article>').join('');
  }
  function robot(){ready=window.__RDC_BOT_LINKS_LOCAL__?.readOnly===true&&window.__RDC_BOT_LINKS_LOCAL__.version===core.VERSION&&typeof window.conferirLinkAfiliadoNaAbaLocal==='function';el('[data-audit-robot]').textContent=ready?'Robô 2.5.0 conectado — somente links; preços bloqueados.':'Atualize o robô para 2.5.0 e recarregue o painel para usar a conferência de links.';if(!running&&!loading)locked(false);}
  el('[data-audit-load]').addEventListener('click',async()=>{
   if(running||loading)return;loading=true;locked(true);setStatus('Carregando somente os dados de produtos...');
   try{if(typeof window.RDCAffiliateAuditSource!=='function')throw Error('Entre no painel e aguarde o carregamento.');const products=await window.RDCAffiliateAuditSource();const currentKeys=new Set(core.queue(products,true).map(row=>row.key));for(const key of results.keys())if(!currentKeys.has(key))results.delete(key);rows=core.queue(products,el('[data-audit-paused]').checked);for(const row of rows)row.fingerprint=row.invalid?'':await fingerprint(row);setStatus('Fila pronta. Os resultados anteriores compatíveis podem ser reaproveitados por até sete dias; marque “Conferir novamente” para testar todos de novo.');draw();}catch(e){setStatus('Não foi possível carregar: '+e.message);}finally{loading=false;locked(false);}
  });
  el('[data-audit-start]').addEventListener('click',async()=>{
   if(running||!ready)return;running=true;const mine=++generation;locked(true);
   const pending=rows.filter(row=>el('[data-audit-repeat]').checked||!row.fingerprint||results.get(row.key)?.fingerprint!==row.fingerprint||results.get(row.key)?.status!=='active_same'||Date.now()-results.get(row.key).checkedAt>=core.MAX_AGE);
   let done=0,paused=false;
   try{for(const row of pending){
    if(!running||mine!==generation||done>=Number(el('[data-audit-limit]').value))break;
    setStatus('Conferindo '+row.title+' — '+(row.market==='shopee'?'Shopee':'Mercado Livre')+'. Nenhum cadastro será modificado.');
    let value;try{value=row.invalid?{kind:core.KIND,readOnly:true,productId:row.productId,market:row.market,checkedAt:Date.now(),status:'error',reason:'Link cadastrado inválido ou com parâmetros sensíveis. Revise manualmente.',robotVersion:core.VERSION}:await window.conferirLinkAfiliadoNaAbaLocal(row);}catch(e){if(!running||mine!==generation)break;value={kind:core.KIND,readOnly:true,productId:row.productId,market:row.market,checkedAt:Date.now(),status:'error',reason:e.message,robotVersion:core.VERSION};paused=true;}
    if(!running||mine!==generation)break;results.set(row.key,{...core.safeResult(value),fingerprint:row.fingerprint});done++;if(!persist())break;draw();
    if(['security','login'].includes(value.status)){paused=true;break;}if(paused||done>=pending.length||done>=Number(el('[data-audit-limit]').value))break;
    await new Promise(r=>setTimeout(r,5000));
   }
   const remaining=rows.filter(row=>!results.has(row.key)).length,review=rows.filter(row=>results.has(row.key)&&results.get(row.key).status!=='active_same').length;
   setStatus(paused?'Rodada pausada para sua intervenção. Resolva login/verificação na loja e toque em “Conferir pendentes”. Resultados confirmados serão preservados.':running?'Rodada concluída: '+done+' link(s) verificado(s); '+remaining+' sem resultado e '+review+' para revisão. Nenhum cadastro foi alterado.':'Rodada parada. Resultados locais preservados.');
   }finally{running=false;locked(false);}
  });
  el('[data-audit-stop]').addEventListener('click',()=>{running=false;generation++;window.cancelarConferenciaLinksLocal?.();locked(false);setStatus('Parado. Nenhum cadastro foi alterado; o relatório permanece neste navegador.');});
  el('[data-audit-download]').addEventListener('click',()=>{const link=document.createElement('a'),blob=new Blob([JSON.stringify(report(),null,2)],{type:'application/json'});link.href=URL.createObjectURL(blob);link.download='conferencia-links-'+new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);});
  restore();draw();robot();setInterval(robot,3000);
 }
 function init(){
  const mobile=location.pathname==='/painel-celular.html',container=document.getElementById(mobile?'app':'admin-content');if(!container)return;
  const pricesDisabled=async()=>{throw Error('Modo informativo: o robô verifica somente links, sem consultar ou salvar preços.');};
  window.conferirPrecoNaAbaLocal=pricesDisabled;window.conferirPrecoPelaFonteLocal=pricesDisabled;
  window.__RDC_BOT_PRECOS_LOCAL__={...(window.__RDC_BOT_PRECOS_LOCAL__||{}),ready:false,linksOnly:true};
  document.body.dataset.linkAuditOnly='true';
  const host=document.createElement('section');host.id='links-afiliados';host.className=mobile?'card link-audit':'painel link-audit';container.prepend(host);
  // Hide, but do not destroy, the old price workflow/history or edit functions.
  const hideOld=()=>{for(const s of mobile?['#precos-mobile']:['#painel-precos']){const node=document.querySelector(s);if(node){node.hidden=true;node.dataset.linkAuditLegacy='true';}}};
  hideOld();const observer=new MutationObserver(hideOld);observer.observe(container,{childList:true,subtree:true});
  for(const a of document.querySelectorAll('a[href*="#precos-mobile"]')){a.href=mobile?'#links-afiliados':'painel-celular.html#links-afiliados';a.textContent='🔗 Conferir links';}
  const tab=document.getElementById('tab-precos');if(tab){tab.textContent='Links de afiliados';tab.addEventListener('click',()=>{setTimeout(hideOld,0);host.scrollIntoView({behavior:'smooth',block:'start'});});}
  mount();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
