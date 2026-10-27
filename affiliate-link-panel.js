(function(){
 'use strict';
 const core=window.RDCAffiliateLinkAudit;
 if(!core||!window.RDCInformational?.enabled)return;
 const STORAGE='rdc-affiliate-audit-report-v1';
 const labels={available:'Disponível',unavailable:'Indisponível',unverified:'Não foi possível verificar',active_same:'Disponível na leitura anterior',different_target:'Resultado anterior — verificar disponibilidade',identity_unconfirmed:'Resultado anterior — verificar disponibilidade',security:'Não foi possível verificar — bloqueio',login:'Não foi possível verificar — login',error:'Não foi possível verificar — comunicação/link'};
 const esc=window.RDCInformational.esc;
 const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 async function fingerprint(row){if(!crypto.subtle)return '';const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([row.productId,row.title,row.affiliateUrl,row.expectedUrl])));return [...new Uint8Array(data)].map(x=>x.toString(16).padStart(2,'0')).join('');}
 function mount(){
  const host=document.getElementById('links-afiliados');if(!host||host.dataset.mounted)return;host.dataset.mounted='true';
  let products=[],rows=[],results=new Map(),running=false,loading=false,editing=false,saving=false,generation=0,ready=false,visibleCount=50;
  const el=s=>host.querySelector(s),setStatus=text=>el('[data-audit-status]').textContent=text;
  host.innerHTML='<h2>🔗 Conferência dos anúncios — sem preços</h2><p>O robô verifica apenas se o anúncio está disponível ou indisponível. Usa o link original quando cadastrado; não compara nome, modelo, cor, tamanho, voltagem ou preço. Não altera cadastros sozinho.</p><p class="link-audit-note">Carregue a fila de hoje e confira os pendentes. A disponibilidade do anúncio não comprova que o link de afiliado abre o mesmo produto. Você pode substituir os links do produto e de afiliado usando “Salvar novos links”, sem criar outro cadastro. CAPTCHA, login e falha de comunicação não significam anúncio indisponível.</p><p data-audit-robot role="status">Verificando a versão do robô...</p><a class="link-audit-install" href="/bot-links.user.js" target="_blank" rel="noopener">Atualizar robô para 2.5.1 — somente links</a><p class="mini">O nome antigo “Bot local de preços” identifica a instalação no Tampermonkey. A versão 2.5.1 não devolve preços.</p><div class="link-audit-controls"><label><input type="checkbox" data-audit-paused checked> Incluir cadastros pausados, sem reativá-los</label><label><input type="checkbox" data-audit-repeat> Revisar também os links já confirmados hoje</label><label>Máximo por rodada <select data-audit-limit><option>10</option><option selected>20</option><option>50</option><option>100</option><option value="all">Todos os pendentes</option></select></label></div><div class="link-audit-actions"><button type="button" data-audit-load>Carregar fila de hoje</button><button type="button" data-audit-start disabled>Conferir pendentes</button><button type="button" data-audit-stop disabled>Parar</button><button type="button" data-audit-download>Baixar relatório local</button></div><p data-audit-status role="status" aria-live="polite">Nenhuma conferência começa sozinha. Os resultados ficam neste navegador, sem gravar preços ou consultar visitas.</p><p data-audit-summary></p><label class="link-audit-filter">Mostrar <select data-audit-filter><option value="all">Todos os itens</option><option value="review">Não verificados / revisão</option><option value="active">Disponíveis confirmados hoje</option><option value="unavailable">Indisponíveis</option><option value="untested">Ainda não conferidos hoje</option><option value="paused">Cadastros pausados</option></select></label><div data-audit-editor hidden></div><div data-audit-results></div><button type="button" data-audit-more hidden>Mostrar mais itens</button><details class="link-audit-publication"><summary>Depois de substituir os links, como publicar?</summary><p>Conferir atividade não exige publicar. Se você salvar novos links, atualize a vitrine pelo fluxo habitual do GitHub, uma vez ao terminar. Não é necessário conferir preços.</p><a href="https://github.com/informatica-byte/RankingDaCompra/actions/workflows/update-sitemap.yml" target="_blank" rel="noopener noreferrer">Abrir publicação da vitrine ↗</a><p>Os resultados da conferência são locais deste navegador. Editar links ou pausar um cadastro só grava quando você confirma a ação.</p></details>';
  function locked(state){
   const busy=state||editing||saving;for(const s of ['[data-audit-load]','[data-audit-paused]','[data-audit-repeat]','[data-audit-limit]'])el(s).disabled=busy;
   el('[data-audit-start]').disabled=busy||!ready||!rows.length;el('[data-audit-stop]').disabled=!running;
   host.querySelectorAll('[data-audit-edit],[data-audit-pause]').forEach(b=>b.disabled=busy);
  }
  function restore(){try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(saved?.kind!==core.KIND||saved.version!==1||!Array.isArray(saved.records))return;for(const row of saved.records.slice(0,3000)){try{const clean=core.safeResult(row);if(/^[a-f0-9]{64}$/.test(row.fingerprint||'')&&Date.now()-clean.checkedAt<core.MAX_AGE&&clean.checkedAt<=Date.now()+60000)results.set(clean.productId+':'+clean.market,{...clean,fingerprint:row.fingerprint});}catch{}}}catch{setStatus('Relatório local não pôde ser restaurado. Os cadastros não foram alterados.');}}
  const report=()=>({version:1,kind:core.KIND,scope:'resultados locais; sem credenciais, preços ou alterações automáticas de cadastro',exportedAt:new Date().toISOString(),records:[...results.values()]});
  function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(report()));return true;}catch{running=false;setStatus('O navegador não conseguiu preservar o relatório. Rodada parada; baixe o resultado antes de sair.');return false;}}
  const resultFor=row=>results.get(row.key)?.fingerprint===row.fingerprint?results.get(row.key):null;
  const isAvailable=r=>['available','active_same'].includes(r?.status);
  const confirmed=row=>{const r=resultFor(row);return isAvailable(r)&&r.checkedAt<=Date.now()+60000&&day(r.checkedAt)===day(Date.now());};
  async function rebuild(){
   rows=core.queue(products,el('[data-audit-paused]').checked);for(const row of rows)row.fingerprint=row.invalid?'':await fingerprint(row);
   visibleCount=50;draw();
  }
  function draw(){
   const current=rows.map(row=>({...row,result:resultFor(row),confirmed:confirmed(row)})),count=status=>current.filter(x=>x.result?.status===status).length;
   el('[data-audit-summary]').textContent=rows.length+' link(s) carregado(s) · '+current.filter(x=>x.confirmed).length+' confirmado(s) hoje · '+count('unavailable')+' indisponível(is) · '+current.filter(x=>x.result&&!isAvailable(x.result)&&x.result.status!=='unavailable').length+' para revisão · '+current.filter(x=>!x.result||isAvailable(x.result)&&!x.confirmed).length+' sem confirmação hoje. Resultado pontual, não garantia de estoque futuro.';
   const filter=el('[data-audit-filter]').value;
   const subset=current.filter(x=>filter==='all'||filter==='review'&&x.result&&!x.confirmed||filter==='active'&&x.confirmed||filter==='unavailable'&&x.result?.status==='unavailable'||filter==='untested'&&(!x.result||isAvailable(x.result)&&!x.confirmed)||filter==='paused'&&x.paused);
   const sorted=[...subset.filter(x=>x.result&&!x.confirmed),...subset.filter(x=>!x.result),...subset.filter(x=>x.confirmed)];
   el('[data-audit-results]').innerHTML=sorted.slice(0,visibleCount).map(x=>'<article class="link-audit-result" data-audit-row="'+esc(x.key)+'"><h3>'+esc(x.title)+'</h3><strong>'+esc(x.result?(isAvailable(x.result)&&!x.confirmed?'Disponível na última leitura; conferir hoje':labels[x.result.status]):'A conferir')+' · '+esc(x.market==='shopee'?'Shopee':'Mercado Livre')+'</strong>'+(x.paused?'<p>⏸ Cadastro separado para revisão manual.</p>':'')+'<p>'+esc(x.result?.reason||'Ainda não há resultado para este link nesta fila.')+'</p>'+(x.result?.foundTitle?'<p>Página lida: '+esc(x.result.foundTitle)+'</p>':'')+(x.result?'<small>Última leitura: '+esc(new Date(x.result.checkedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))+'</small>':'')+'<div class="link-audit-result-actions">'+(core.url(x.checkUrl)?'<a href="'+esc(x.checkUrl)+'" target="_blank" rel="noopener noreferrer">Abrir anúncio ↗</a>':'')+(x.result?.finalUrl?'<a href="'+esc(x.result.finalUrl)+'" target="_blank" rel="noopener noreferrer">Ver destino lido ↗</a>':'')+'<button type="button" data-audit-edit="'+esc(x.key)+'">🔄 Substituir links do produto e de afiliado</button><button type="button" data-audit-pause="'+esc(x.key)+'">'+(x.paused?'▶ Reativar para conferir':'⏸ Separar para revisão manual')+'</button></div></article>').join('')||'<p>Nenhum item neste filtro.</p>';
   el('[data-audit-more]').hidden=sorted.length<=visibleCount;locked(running||loading);
  }
  function robot(){ready=window.__RDC_BOT_LINKS_LOCAL__?.readOnly===true&&window.__RDC_BOT_LINKS_LOCAL__.version===core.VERSION&&typeof window.conferirLinkAfiliadoNaAbaLocal==='function';el('[data-audit-robot]').textContent=ready?'Robô 2.5.1 conectado — somente disponibilidade; sem comparação ou preços.':'Atualize o robô para 2.5.1 e recarregue o painel para conferir os anúncios.';if(!running&&!loading)locked(false);}
  async function adopt(product,reset=false){
   products=products.map(p=>p.id===product.id?core.project(product):p);await rebuild();
   for(const row of rows.filter(r=>r.productId===product.id))if(reset||results.get(row.key)?.fingerprint!==row.fingerprint)results.delete(row.key);
   persist();draw();
  }
  function closeEditor(){if(saving)return;editing=false;el('[data-audit-editor]').hidden=true;el('[data-audit-editor]').replaceChildren();locked(false);}
  host.addEventListener('click',async event=>{
   const edit=event.target.closest('[data-audit-edit]'),pause=event.target.closest('[data-audit-pause]');
   if(!edit&&!pause)return;if(running||loading||editing||saving)return;
   const row=rows.find(r=>r.key===(edit?.dataset.auditEdit||pause?.dataset.auditPause));if(!row)return;
   const api=window.RDCAffiliateAuditReview;if(!api){setStatus('Entre no painel e aguarde os controles de edição carregarem.');return;}
   editing=true;locked(true);const box=el('[data-audit-editor]');box.hidden=false;box.textContent='Abrindo o cadastro atual, sem consultar preços...';
   try{
    const baseline=await api.read(row.productId);
    if(pause){
     const paused=!baseline.conferenciaPausada;if(!confirm(paused?'Separar este cadastro para revisão manual, sem excluir nem alterar preços?':'Reativar este cadastro para conferir o anúncio, sem marcar automaticamente como ativo?')){closeEditor();return;}
     saving=true;const product=await api.pause(row.productId,baseline,paused);saving=false;await adopt(product,true);closeEditor();setStatus(paused?'Cadastro separado para revisão manual. Nada foi excluído.':'Cadastro reativado para conferir. O robô ainda precisa verificar o link.');return;
    }
    const source=row.market==='mercado_livre'?baseline.link:baseline.linkShopeeOriginal||baseline.urlShopee||(core.url(baseline.link)?.market==='shopee'?baseline.link:'');
    const affiliate=row.market==='mercado_livre'?baseline.linkAfiliado:baseline.linkShopee||baseline.linkAfiliado;
    box.innerHTML='<form data-audit-edit-form><h3>🔄 Substituir anúncio sem duplicar o cadastro</h3><p>'+esc(baseline.titulo)+'</p><p>Troque apenas por outro anúncio do mesmo produto, modelo e versão. A ficha, a página e os preços históricos ficam preservados.</p><label for="link-audit-source">Link completo do produto — '+(row.market==='shopee'?'Shopee':'Mercado Livre')+'</label><input id="link-audit-source" name="source" type="url" maxlength="4000" required><label for="link-audit-affiliate">Link de afiliado correspondente</label><input id="link-audit-affiliate" name="affiliate" type="url" maxlength="4000" required><label class="link-audit-same"><input name="same" type="checkbox" required> Conferi que os dois links são do mesmo produto, modelo e versão deste cadastro.</label><p>O robô não escolhe nem substitui anúncios sozinho. Depois de salvar, o novo link ficará pendente de conferência.</p><div class="link-audit-result-actions"><button type="submit">💾 Salvar novos links</button><button type="button" data-audit-cancel>Cancelar</button></div><p data-audit-edit-status role="status" aria-live="polite"></p></form>';
    const form=box.querySelector('form');form.elements.source.value=source||'';form.elements.affiliate.value=affiliate||'';
    box.querySelector('[data-audit-cancel]').addEventListener('click',closeEditor);
    form.addEventListener('submit',async e=>{
     e.preventDefault();if(saving||running)return;saving=true;locked(true);form.querySelectorAll('input,button').forEach(x=>x.disabled=true);const status=box.querySelector('[data-audit-edit-status]');status.textContent='Salvando apenas os links do cadastro escolhido...';
     try{const product=await api.save(row.productId,baseline,{market:row.market,sourceUrl:form.elements.source.value.trim(),affiliateUrl:form.elements.affiliate.value.trim(),sameProduct:form.elements.same.checked});await adopt(product);saving=false;closeEditor();setStatus('Novos links salvos no mesmo cadastro, sem alterar preços. Confira o novo link e depois publique a vitrine pelo fluxo habitual.');}
     catch(error){status.textContent='Não foi possível salvar: '+String(error.message||error);}
     finally{saving=false;form.querySelectorAll('input,button').forEach(x=>x.disabled=false);locked(false);}
    });
    box.scrollIntoView({behavior:'smooth',block:'start'});form.elements.source.focus();
   }catch(error){saving=false;closeEditor();setStatus('Não foi possível abrir a revisão: '+String(error.message||error));}
  });
  el('[data-audit-load]').addEventListener('click',async()=>{
   if(running||loading||editing)return;loading=true;locked(true);setStatus('Carregando a fila de hoje, sem consultar visitas...');
   try{if(typeof window.RDCAffiliateAuditSource!=='function')throw Error('Entre no painel e aguarde o carregamento.');products=(await window.RDCAffiliateAuditSource()).map(p=>core.project(p));const keys=new Set(core.queue(products,true).map(r=>r.key));for(const key of results.keys())if(!keys.has(key))results.delete(key);await rebuild();setStatus('Fila pronta. Os links já confirmados hoje não serão repetidos. Resultados de dias anteriores ficam no relatório, mas voltam à conferência de hoje.');}catch(e){setStatus('Não foi possível carregar: '+e.message);}finally{loading=false;locked(false);}
  });
  el('[data-audit-paused]').addEventListener('change',()=>{if(!running&&!editing)void rebuild();});
  el('[data-audit-filter]').addEventListener('change',()=>{visibleCount=50;draw();});
  el('[data-audit-more]').addEventListener('click',()=>{visibleCount+=50;draw();});
  el('[data-audit-start]').addEventListener('click',async()=>{
   if(running||!ready||editing||saving)return;running=true;const mine=++generation;locked(true);
   const pending=rows.filter(row=>el('[data-audit-repeat]').checked||!row.fingerprint||!confirmed(row));
   const selectedLimit=el('[data-audit-limit]').value,roundLimit=selectedLimit==='all'?pending.length:([10,20,50,100].includes(Number(selectedLimit))?Number(selectedLimit):20);
   let done=0,paused=false;
   try{for(const row of pending){
    if(!running||mine!==generation||done>=roundLimit)break;
    setStatus('Conferindo '+(done+1)+' de '+Math.min(pending.length,roundLimit)+': '+row.title+' — '+(row.market==='shopee'?'Shopee':'Mercado Livre')+'. Somente atividade; sem preços.');
    let value;try{value=row.invalid?{kind:core.KIND,readOnly:true,productId:row.productId,market:row.market,checkedAt:Date.now(),status:'error',reason:'Link cadastrado inválido ou com parâmetros sensíveis. Use Substituir links para revisar.',robotVersion:core.VERSION}:await window.conferirLinkAfiliadoNaAbaLocal(row);}catch(e){if(!running||mine!==generation)break;value={kind:core.KIND,readOnly:true,productId:row.productId,market:row.market,checkedAt:Date.now(),status:'error',reason:e.message,robotVersion:core.VERSION};paused=true;}
    if(!running||mine!==generation)break;results.set(row.key,{...core.safeResult(value),fingerprint:row.fingerprint});done++;if(!persist())break;draw();
    if(['security','login'].includes(value.status)){paused=true;break;}if(paused||done>=pending.length||done>=roundLimit)break;
    await new Promise(r=>setTimeout(r,5000));
   }
   const remaining=rows.filter(row=>!resultFor(row)||isAvailable(resultFor(row))&&!confirmed(row)).length,review=rows.filter(row=>resultFor(row)&&!isAvailable(resultFor(row))).length;
   setStatus(paused?'Rodada pausada para sua intervenção. Resolva login/verificação na loja e toque em “Conferir pendentes”. Os confirmados de hoje não serão repetidos.':running?'Rodada concluída: '+done+' link(s) verificado(s); '+remaining+' sem resultado de hoje e '+review+' para revisão. Nenhum cadastro foi alterado automaticamente.':'Rodada parada. Resultados locais preservados.');
   }finally{running=false;locked(false);}
  });
  el('[data-audit-stop]').addEventListener('click',()=>{running=false;generation++;window.cancelarConferenciaLinksLocal?.();locked(false);setStatus('Parado. Nenhum cadastro foi alterado automaticamente; o relatório permanece neste navegador.');});
  el('[data-audit-download]').addEventListener('click',()=>{const link=document.createElement('a'),blob=new Blob([JSON.stringify(report(),null,2)],{type:'application/json'});link.href=URL.createObjectURL(blob);link.download='conferencia-links-'+day(Date.now())+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);});
  restore();draw();robot();setInterval(robot,3000);
 }
 function init(){
  const mobile=location.pathname==='/painel-celular.html',container=document.getElementById(mobile?'app':'admin-content');if(!container)return;
  const pricesDisabled=async()=>{throw Error('Modo informativo: o robô verifica somente links, sem consultar ou salvar preços.');};
  window.conferirPrecoNaAbaLocal=pricesDisabled;window.conferirPrecoPelaFonteLocal=pricesDisabled;
  window.__RDC_BOT_PRECOS_LOCAL__={...(window.__RDC_BOT_PRECOS_LOCAL__||{}),ready:false,linksOnly:true};
  document.body.dataset.linkAuditOnly='true';
  const host=document.createElement('section');host.id='links-afiliados';host.className=mobile?'card link-audit':'painel link-audit';container.prepend(host);
  const hideOld=()=>{for(const s of mobile?['#precos-mobile']:['#painel-precos']){const node=document.querySelector(s);if(node){node.hidden=true;node.dataset.linkAuditLegacy='true';}}};
  hideOld();const observer=new MutationObserver(hideOld);observer.observe(container,{childList:true,subtree:true});
  for(const a of document.querySelectorAll('a[href*="#precos-mobile"]')){a.href=mobile?'#links-afiliados':'painel-celular.html#links-afiliados';a.textContent='🔗 Conferir anúncios';}
  const tab=document.getElementById('tab-precos');if(tab){tab.textContent='Conferência dos anúncios';tab.addEventListener('click',()=>{setTimeout(hideOld,0);host.scrollIntoView({behavior:'smooth',block:'start'});});}
  mount();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
