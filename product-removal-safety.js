(function(root){
  'use strict';
  const REGISTRY='exclusoes-definitivas';
  function validId(id){return typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);}
  function registry(data){
    if(data==null)return {version:1,ids:[]};
    if(Number(data.version)!==1||!Array.isArray(data.ids)||data.ids.length>4000||data.ids.some(id=>!validId(id))||Object.keys(data).some(k=>!['version','ids','updatedAt'].includes(k)))throw Error('Registro de exclusões inválido; operação bloqueada.');
    return {version:1,ids:[...new Set(data.ids)].sort()};
  }
  function merged(left,right){const ids=[...new Set([...registry(left).ids,...registry(right).ids])].sort();if(ids.length>4000)throw Error('Limite do registro de exclusões atingido.');return {version:1,ids};}
  function identity(p){return JSON.stringify(['titulo','link','linkAfiliado','foto'].map(k=>String(p?.[k]||'').normalize('NFC').trim()));}
  async function remove(adapter,expected,uid){
    if(!validId(expected?.id)||!uid||adapter.session()!==uid)throw Error('Sessão ou cadastro inválido. Nenhuma exclusão autorizada.');
    return adapter.transaction(async tx=>{
      const [product,stored]=await Promise.all([tx.product(),tx.registry()]);
      if(!product)throw Error('Cadastro já ausente; atualize a fila antes de continuar.');
      if(identity(product)!==identity(expected))throw Error('O produto foi alterado em outro painel. A exclusão foi bloqueada.');
      const next=merged(stored,{version:1,ids:[expected.id]});
      if(adapter.session()!==uid)throw Error('A sessão mudou durante a exclusão.');
      tx.saveRegistry({...next,updatedAt:adapter.timestamp()});
      tx.removeProduct();
      return {id:expected.id,cleanupPending:true};
    });
  }
  const api={REGISTRY,validId,registry,merged,identity,remove};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RDCProductRemoval=api;
})(typeof window!=='undefined'?window:null);
