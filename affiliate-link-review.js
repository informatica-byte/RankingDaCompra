(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./affiliate-link-audit.js'));
 else root.RDCAffiliateLinkReview=factory(root.RDCAffiliateLinkAudit);
})(typeof window==='object'?window:globalThis,function(core){
 'use strict';
 const fields=['titulo','link','linkAfiliado','linkShopee','linkShopeeOriginal','urlShopee'];
 const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
 function baseline(current,expected){
  if(!current||current.sistema===true)throw Error('Cadastro removido ou de sistema. Nenhum produto foi criado.');
  if(!expected||fields.some(key=>String(current[key]||'').trim()!==String(expected[key]||'').trim())||Boolean(current.conferenciaPausada)!==Boolean(expected.conferenciaPausada))throw Error('O cadastro mudou em outro painel. Cancele e abra a revisão novamente.');
 }
 function links(current,input){
  if(input?.sameProduct!==true)throw Error('Confirme que os dois links são do mesmo produto, modelo e versão.');
  if(!['mercado_livre','shopee'].includes(input.market))throw Error('Loja não reconhecida.');
  const req=core.request({productId:'manual-review',title:current.titulo,expectedUrl:input.sourceUrl,affiliateUrl:input.affiliateUrl});
  const source=core.identity(req.expectedUrl),affiliate=core.identity(req.affiliateUrl);
  if(!source||source.market!==input.market||(!source.listing&&!source.catalog))throw Error('Cole o endereço completo do anúncio com código do produto, não um link curto.');
  if(req.market!==input.market)throw Error('Os dois links precisam ser da mesma loja.');
  if(source.listing&&affiliate?.listing&&source.listing!==affiliate.listing)throw Error('Os dois links apontam para anúncios diferentes. Gere o afiliado do anúncio escolhido.');
  if(source.catalog&&affiliate?.catalog&&source.catalog!==affiliate.catalog)throw Error('Os dois links apontam para catálogos diferentes.');
  if(req.expectedUrl===req.affiliateUrl)throw Error('Informe o link de afiliado gerado pela sua conta, não repita o link comum.');
  const patch=input.market==='mercado_livre'?{link:req.expectedUrl,linkAfiliado:req.affiliateUrl,mercadoLivreItemId:source.listing||''}:{linkShopee:req.affiliateUrl,linkShopeeOriginal:req.expectedUrl};
  if(input.market==='shopee'&&core.url(current.link)?.market==='shopee')Object.assign(patch,{link:req.expectedUrl,linkAfiliado:req.affiliateUrl});
  if(Object.entries(patch).every(([key,value])=>String(current[key]||'').trim()===value))throw Error('Os links continuam iguais. Cole os novos links ou cancele.');
  return patch;
 }
 function archive(current,at){return {substituidoEm:at,...Object.fromEntries(['link','linkAfiliado','linkShopee','linkShopeeOriginal','mercadoLivreItemId'].filter(key=>current[key]!==undefined).map(key=>[key,current[key]]))};}
 function create(adapter){
  const authorize=uid=>{const owner=adapter.authorize();if(!owner||uid&&owner!==uid)throw Error('A sessão mudou. Entre novamente e reabra a revisão.');return owner;};
  async function read(id){if(!validId(id))throw Error('Identificador inválido.');const uid=authorize(),current=await adapter.read(id);authorize(uid);if(!current||current.sistema===true)throw Error('Cadastro não encontrado.');return core.project(current,id);}
  async function save(id,expected,input){
   if(!validId(id))throw Error('Identificador inválido.');const uid=authorize(),patch=links(expected,input);
   const prepared=await adapter.prepare({...expected,...patch});authorize(uid);
   const saved=await adapter.transact(id,async tx=>{authorize(uid);const current=await tx.read();authorize(uid);baseline(current,expected);
    const changes=links(current,input);await tx.protect(prepared,{...current,...changes});authorize(uid);
    const stamp=adapter.timestamp();tx.update({...changes,anuncioSubstituidoEm:stamp,atualizadoEm:stamp,historicoAnuncios:adapter.append(archive(current,new Date().toISOString()))});return core.project({...current,...changes},id);
   });try{adapter.invalidate?.();}catch{}return saved;
  }
  async function pause(id,expected,paused){
   if(!validId(id)||typeof paused!=='boolean')throw Error('Pedido de revisão inválido.');const uid=authorize();
   const saved=await adapter.transact(id,async tx=>{authorize(uid);const current=await tx.read();authorize(uid);baseline(current,expected);const stamp=adapter.timestamp();tx.update(paused?{conferenciaPausada:true,conferenciaPausadaEm:stamp}:{conferenciaPausada:false,conferenciaReativadaEm:stamp});return core.project({...current,conferenciaPausada:paused},id);});try{adapter.invalidate?.();}catch{}return saved;
  }
  return {read,save,pause};
 }
 return {validId,baseline,links,archive,create};
});
