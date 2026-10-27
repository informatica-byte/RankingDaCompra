(function(root){
 'use strict';
 const q=root.RDCProductQuarantine;if(!q)return;
 function mount({host,product,result,busy,adopt,remove,status}){
  const el=s=>host.querySelector(s),option=document.createElement('option');option.value='quarantine';option.textContent='Quarentena — prazo de 40 dias';el('[data-audit-filter]').append(option);
  const note=document.createElement('p');note.className='link-audit-note';note.textContent='Quarentena opcional de 40 dias: só entra com sua confirmação. Se o mesmo anúncio voltar, sai da quarentena. Após o prazo, uma nova leitura confirmando o mesmo MLB indisponível permite excluir cadastro e histórico. CAPTCHA, login, redirecionamento e erro não autorizam exclusão. Funciona durante a conferência com painel aberto e logado; a limpeza das páginas ocorre na publicação seguinte.';el('[data-audit-results]').before(note);
  let mutating=false;
  function decorate(){
   host.querySelectorAll('[data-audit-row]').forEach(card=>{
    const key=card.dataset.auditRow,id=key.split(':')[0],p=product(id);if(!p)return;const s=q.state(p),box=card.querySelector('.link-audit-result-actions');if(!box)return;
    let info=card.querySelector('[data-quarantine-info]');if(!info){info=document.createElement('p');info.dataset.quarantineInfo='';box.before(info);}
    const text=s.active?(s.valid?'⏳ Quarentena: '+s.remainingDays+' dia(s) restante(s). Prazo: '+new Date(s.deadline).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+(s.due?'. Aguardando nova confirmação segura do mesmo anúncio antes de excluir.':''): '⚠ Quarentena inválida: somente revisão manual, sem exclusão automática.'):'';
    if(info.textContent!==text)info.textContent=text;
    let button=box.querySelector('[data-quarantine]');const allowed=s.active||result(key)?.status==='unavailable';
    if(allowed&&!button){button=document.createElement('button');button.type='button';button.dataset.quarantine=key;box.append(button);}
    if(button){button.hidden=!allowed;button.disabled=busy()||mutating;const label=s.active?'Cancelar quarentena':'⏳ Colocar em quarentena por 40 dias';if(button.textContent!==label)button.textContent=label;}
   });
  }
  host.addEventListener('click',async event=>{
   const button=event.target.closest('[data-quarantine]');if(!button||button.disabled||busy()||mutating)return;
   const key=button.dataset.quarantine,id=key.split(':')[0],api=root.RDCProductQuarantineAccess;if(!api)return status('Entre no painel para administrar a quarentena.');
   mutating=true;root.dispatchEvent(new Event('rdc-quarantine-busy'));decorate();
   try{
    const p=await api.read(id);let saved;
    if(!product(id)||root.RDCProductRemoval.identity(p)!==root.RDCProductRemoval.identity(product(id)))throw Error('O cadastro mudou desde a leitura. Carregue a fila novamente antes de decidir.');
    if(q.state(p).active){if(!confirm('Cancelar a quarentena de “'+p.titulo+'”? A exclusão futura será cancelada. Uma pausa manual anterior será preservada.'))return;saved=await api.cancel(id,p);}
    else{
     if(result(key)?.status!=='unavailable')throw Error('Confira o anúncio indisponível antes de colocar em quarentena.');
     if(!confirm('Colocar “'+p.titulo+'” em quarentena por 40 dias? Confirme que o anúncio está indisponível agora.\n\nVocê autoriza excluir definitivamente ESTE cadastro e seu histórico depois do prazo, somente após nova leitura do mesmo MLB ainda indisponível. Se voltar, a quarentena será cancelada. CAPTCHA ou falha não autorizam exclusão.\n\nA limpeza pública depende da publicação. Não apaga Git, backups, estatísticas históricas ou caches externos. Um registro técnico só com o ID impede recriação.'))return;
     const consent=prompt('Para autorizar a quarentena e a exclusão futura do cadastro E histórico, digite: QUARENTENA 40 '+id);if(consent!=='QUARENTENA 40 '+id)return;
     saved=await api.enter(id,p,consent);
    }
    await adopt(saved);status(q.state(saved).active?'Quarentena de 40 dias salva. Nada foi excluído. Publique a vitrine para ocultar a oferta.':'Quarentena cancelada; nenhuma exclusão será feita por esse prazo. Publique a vitrine para atualizar a exibição.');
   }catch(e){status('Quarentena não alterada: '+String(e.message||e));}
   finally{mutating=false;root.dispatchEvent(new Event('rdc-quarantine-busy'));decorate();}
  });
  const observer=new MutationObserver(decorate);observer.observe(el('[data-audit-results]'),{childList:true,subtree:true});
  async function review(row,checked,guard){
   const p=product(row.productId);if(!q.state(p).active)return '';
   const api=root.RDCProductQuarantineAccess;if(!api)return 'Quarentena preservada: sessão de gravação indisponível.';
   try{const out=await api.review(p,row,checked,guard);if(out.action==='deleted'){await remove(out.id);return 'Cadastro excluído após 40 dias e nova confirmação de indisponibilidade. Limpeza pública pendente da publicação.';}if(out.action==='returned'){await adopt(out.product);return 'Anúncio voltou: quarentena cancelada. Publique para atualizar a vitrine.';}return out.reason||'';}
   catch(e){return 'Quarentena preservada para revisão: '+String(e.message||e);}
  }
  return {decorate,review,isBusy:()=>mutating};
 }
 root.RDCProductQuarantinePanel={mount};
})(window);
