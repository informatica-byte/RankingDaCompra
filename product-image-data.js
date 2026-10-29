(function(root){
 'use strict';
 const SITE='https://rankingdacompra.com.br',MAX_BYTES=100*1024,MAX_EDGE=1200,QUEUE_PREFIX='imagem-produto-';
 const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);
 const validHash=hash=>typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash);
 function queueId(id){if(!validId(id))throw Error('Identificador de produto inválido.');return QUEUE_PREFIX+id;}
 function fileName(id,hash){if(!validId(id)||!validHash(hash))throw Error('Identificador de imagem inválido.');return `${id}-local-${hash}.jpg`;}
 const urlFor=(id,hash)=>SITE+'/produto/imagens/'+fileName(id,hash);
 function descriptor(product){
  const value=String(product?.foto||'');let url;try{url=new URL(value);}catch{return null;}
  if(url.origin!==SITE||!url.pathname.startsWith('/produto/imagens/')||!/-local-[a-f0-9]{64}\.jpg$/.test(url.pathname))return null;
  if(url.search||url.hash||url.username||url.password||url.port)throw Error('Endereço de imagem local inválido.');
  const name=url.pathname.slice('/produto/imagens/'.length),match=name.match(/^([A-Za-z0-9_-]{1,100})-local-([a-f0-9]{64})\.jpg$/);
  if(!match||match[1]!==product.id)throw Error('A imagem local não pertence a este cadastro.');
  return {id:product.id,hash:match[2],fileName:name,url:url.href,queueId:queueId(product.id)};
 }
 function dimensions(bytes){
  if(!(bytes instanceof Uint8Array)||bytes.length<30||bytes.length>MAX_BYTES||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw Error('Arquivo JPEG otimizado inválido.');
  let offset=2,frame=null;
  while(offset<bytes.length-2){
   if(bytes[offset++]!==255)throw Error('Estrutura JPEG inválida.');
   while(bytes[offset]===255)offset++;const marker=bytes[offset++];
   if(marker===217)break;
   const length=(bytes[offset]<<8)|bytes[offset+1];if(length<2||offset+length>bytes.length)throw Error('Segmento JPEG inválido.');
   if(marker===225||marker===254)throw Error('A imagem contém metadados não permitidos. Reprocesse a foto no painel.');
   if(marker===192||marker===194){
    const height=(bytes[offset+3]<<8)|bytes[offset+4],width=(bytes[offset+5]<<8)|bytes[offset+6];
    if(!width||!height||width>MAX_EDGE||height>MAX_EDGE||bytes[offset+2]!==8)throw Error('Dimensões da foto fora do limite.');
    frame={width,height};
   }
   if(marker===218){if(!frame)throw Error('Imagem sem dimensões válidas.');return frame;}
   offset+=length;
  }
  throw Error('Arquivo JPEG incompleto.');
 }
 function decode(data){
  if(typeof data!=='string'||data.length>Math.ceil(MAX_BYTES/3)*4||data.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))throw Error('Dados da foto inválidos ou grandes demais.');
  const binary=root.atob(data);return Uint8Array.from(binary,c=>c.charCodeAt(0));
 }
 async function digest(bytes){return [...new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
 function integer(value){if(typeof value==='number'&&Number.isSafeInteger(value))return value;if(typeof value==='string'&&/^\d{1,8}$/.test(value))return Number(value);return NaN;}
 async function validate(record,id){
  if(!record||integer(record.version)!==1||record.productId!==id||record.mime!=='image/jpeg'||!validHash(record.hash))throw Error('Registro da foto inválido.');
  const bytes=decode(record.data),size=dimensions(bytes);
  if(bytes.length!==integer(record.bytes)||size.width!==integer(record.width)||size.height!==integer(record.height)||await digest(bytes)!==record.hash)throw Error('A foto não passou na verificação de integridade.');
  return {bytes,...size,hash:record.hash,fileName:fileName(id,record.hash),url:urlFor(id,record.hash)};
 }
 const api={SITE,MAX_BYTES,MAX_EDGE,QUEUE_PREFIX,queueId,fileName,urlFor,descriptor,dimensions,decode,digest,validate};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.RDCProductImageData=api;
})(typeof window==='object'?window:globalThis);
