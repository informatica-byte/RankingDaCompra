(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./affiliate-link-audit.js'),require('./product-removal-safety.js'));
 else root.RDCProductQuarantine=factory(root.RDCAffiliateLinkAudit,root.RDCProductRemoval);
})(typeof window==='object'?window:globalThis,function(core,removal){
 'use strict';
 const DAYS=40,DAY=86400000,POLICY='excluir-cadastro-e-historico-40-dias';
 async function serverNow(send,now=Date.now){
  const response=await send('/product-quarantine.js?clock='+now(),{method:'HEAD',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  const at=Date.parse(response.headers.get('date')||'');if(!response.ok||!Number.isFinite(at)||Math.abs(at-now())>300000)throw Error('Não foi possível confirmar o horário do servidor. Confira o relógio do aparelho; nenhuma exclusão autorizada.');return at;
 }
 function metadata(p){
  const q=p?.quarentenaAnuncio;
  if(!q||q.version!==1||q.policy!==POLICY||q.days!==DAYS||!Number.isSafeInteger(q.startedAt)||q.startedAt<=0||typeof q.identity!=='string'||q.identity.length>12000||typeof q.previousPaused!=='boolean')return null;
  return {version:1,policy:POLICY,days:DAYS,startedAt:q.startedAt,identity:q.identity,previousPaused:q.previousPaused};
 }
 function project(p,id=p?.id){const out={...core.project(p,id),foto:p?.foto||''};if(p?.quarentenaAnuncio)out.quarentenaAnuncio=metadata(p)||{invalid:true};return out;}
 function state(p,now=Date.now()){
  const q=metadata(p),active=!!p?.quarentenaAnuncio;
  return {active,valid:!!q,deadline:q?q.startedAt+DAYS*DAY:null,remainingDays:q?Math.max(0,Math.ceil((q.startedAt+DAYS*DAY-now)/DAY)):null,due:!!q&&now>=q.startedAt+DAYS*DAY};
 }
 function same(current,expected){
  if(!current||current.sistema===true||removal.identity(current)!==removal.identity(expected)||JSON.stringify(metadata(current))!==JSON.stringify(metadata(expected))||Boolean(current.quarentenaAnuncio)!==Boolean(expected.quarentenaAnuncio)||Boolean(current.conferenciaPausada)!==Boolean(expected.conferenciaPausada))throw Error('O cadastro ou a quarentena mudou em outro painel. Recarregue a fila; nada foi excluído.');
 }
 function evidence(p,row,result,now){
  if(row?.productId!==p.id||row.market!=='mercado_livre'||result?.productId!==p.id||result.market!=='mercado_livre'||result.readOnly!==true||result.inspection!=='availability'||result.robotVersion!==core.VERSION||!['available','unavailable'].includes(result.status))return false;
  if(!Number.isFinite(result.checkedAt)||result.checkedAt>now+5000||now-result.checkedAt>120000)return false;
  try{
   const expected=core.request({productId:p.id,title:p.titulo,expectedUrl:p.link,affiliateUrl:p.linkAfiliado||p.link}),source=core.identity(expected.checkUrl),actual=core.identity(result.finalUrl);
   return expected.checkedVia==='original_product'&&row.checkUrl===expected.checkUrl&&row.affiliateUrl===expected.affiliateUrl&&!!source?.listing&&actual?.market==='mercado_livre'&&actual.listing===source.listing;
  }catch{return false;}
 }
 function create(adapter){
  const authorize=uid=>{const current=adapter.authorize();if(!current||uid&&current!==uid)throw Error('A sessão mudou. Entre novamente; nenhum produto foi excluído.');return current;};
  const now=adapter.now||Date.now;
  async function read(id){if(!removal.validId(id))throw Error('Identificador inválido.');const uid=authorize(),p=await adapter.read(id);authorize(uid);if(!p||p.sistema===true)throw Error('Cadastro não encontrado.');return project(p,id);}
  async function enter(id,expected,consent){
   if(!removal.validId(id)||expected?.id!==id||consent!=='QUARENTENA 40 '+id)throw Error('Confirme expressamente a quarentena e a exclusão futura do cadastro e histórico.');
   const uid=authorize(),official=await adapter.serverNow();authorize(uid);if(!Number.isSafeInteger(official)||Math.abs(official-now())>300000)throw Error('Horário não confirmado; quarentena não iniciada.');const at=Math.max(official,now());
   const saved=await adapter.transact(id,async tx=>{
    const p=await tx.read();authorize(uid);same(p,expected);if(state(p,at).active)throw Error('Este produto já está em quarentena; o prazo não será reiniciado.');
    const req=core.request({productId:id,title:p.titulo,expectedUrl:p.link,affiliateUrl:p.linkAfiliado||p.link});if(req.market!=='mercado_livre'||req.checkedVia!=='original_product'||!core.identity(req.checkUrl)?.listing)throw Error('A quarentena automática precisa do link original com o código MLB do anúncio. Revise o link antes de continuar.');
    const q={version:1,policy:POLICY,days:DAYS,startedAt:at,identity:removal.identity(p),previousPaused:p.conferenciaPausada===true};
    const patch={quarentenaAnuncio:q,conferenciaPausada:true,conferenciaPausadaEm:adapter.timestamp()};authorize(uid);tx.update(patch);return project({...p,...patch},id);
   });adapter.invalidate?.();return saved;
  }
  async function cancel(id,expected){
   if(!removal.validId(id)||expected?.id!==id)throw Error('Identificador inválido.');const uid=authorize();
   const saved=await adapter.transact(id,async tx=>{const p=await tx.read();authorize(uid);same(p,expected);if(!state(p).active)throw Error('Este cadastro não está em quarentena.');
    const q=metadata(p),patch={quarentenaAnuncio:null,conferenciaPausada:q?q.previousPaused:true,conferenciaReativadaEm:adapter.timestamp()};authorize(uid);tx.update(patch);return project({...p,...patch},id);
   });adapter.invalidate?.();return saved;
  }
  async function review(expected,row,result,guard=()=>true){
   if(!removal.validId(expected?.id))throw Error('Identificador inválido.');
   const at=now(),s=state(expected,at),q=metadata(expected);
   if(!s.active)return {action:'none'};
   if(!s.valid||expected.conferenciaPausada!==true||q.identity!==removal.identity(expected))return {action:'held',reason:'Quarentena inconsistente, reativada ou links alterados: revise manualmente; nenhuma exclusão foi feita.'};
   if(!evidence(expected,row,result,at))return {action:'held',reason:'Sem confirmação recente do mesmo código MLB: quarentena preservada, sem excluir.'};
   if(result.status==='unavailable'&&(!s.due||result.checkedAt<s.deadline))return {action:'waiting'};
   const uid=authorize(),id=expected.id,check=()=>{authorize(uid);if(!guard())throw Error('A conferência foi parada; nenhuma exclusão autorizada.');};check();
   if(result.status==='unavailable'){const official=await adapter.serverNow();check();if(!Number.isSafeInteger(official)||Math.abs(official-now())>300000||official<s.deadline)return {action:'held',reason:'Prazo de 40 dias ainda não confirmado pelo servidor; cadastro preservado.'};}
   const out=await adapter.transact(id,async tx=>{
    const p=await tx.read();check();same(p,expected);const actual={...p,id},current=state(actual,now());
    if(!current.valid||actual.conferenciaPausada!==true||metadata(actual).identity!==removal.identity(actual)||!evidence(actual,row,result,now()))throw Error('A confirmação da quarentena não é mais válida; nada foi excluído.');
    if(result.status==='available'){
     const patch={quarentenaAnuncio:null,conferenciaPausada:metadata(actual).previousPaused,conferenciaReativadaEm:adapter.timestamp()};check();tx.update(patch);return {action:'returned',product:project({...actual,...patch},id)};
    }
    if(!current.due||result.checkedAt<current.deadline)throw Error('O prazo de 40 dias não foi cumprido; nenhuma exclusão autorizada.');
    const stored=await tx.registry(),next=removal.merged(stored,{version:1,ids:[id]});check();
    tx.saveRegistry({...next,updatedAt:adapter.timestamp()});tx.removeProduct();return {action:'deleted',id,cleanupPending:true};
   });adapter.invalidate?.();return out;
  }
  return {read,enter,cancel,review};
 }
 return {DAYS,DAY,POLICY,serverNow,metadata,project,state,evidence,create};
});
