(function(root){
 'use strict';
 const safety=typeof module==='object'&&module.exports?require('./product-save-safety.js'):root.RDCProductSaveSafety;
 const DOCUMENT='identidades-produtos-v1',MAX_ENTRIES=6000;
 const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);
 const duplicate=id=>Object.assign(Error('Este anúncio ou link já está cadastrado. Use o cadastro existente para publicar uma nova oferta, sem duplicá-lo.'),{existingId:id,code:'product/duplicate'});
 function url(value){
  const result=new URL(String(value||'').trim());
  if(result.protocol!=='https:'||result.username||result.password||result.port||result.href.length>4000)throw Error('Confira o link HTTPS completo do produto.');
  const host=result.hostname.toLowerCase();
  if(!/(^|\.)(mercadolivre\.com\.br|mercadolibre\.com|meli\.la|shopee\.com\.br)$/.test(host))throw Error('Use um link de produto do Mercado Livre ou da Shopee.');
  return result;
 }
 function canonical(value){
  const result=url(value);result.hash='';
  for(const key of [...result.searchParams.keys()])if(/^(utm_|matt_|tracking_|reco_|polycard_|deal_print_id$|position$|sid$|source$|c_id$|c_uid$|share_|uls_trackid$|gads_t_sig$|mmp_pid$|exp_group$)/i.test(key))result.searchParams.delete(key);
  result.searchParams.sort();result.pathname=result.pathname.replace(/\/$/,'')||'/';return result.href;
 }
 function identify(product,{strict=true}={}){
  const source=url(product?.link||product?.linkAfiliado),keys=new Set();let listing='',catalogue='';
  for(const [field,value]of [['link',source.href],['linkAfiliado',product?.linkAfiliado],['linkShopee',product?.linkShopee]]){
   if(!String(value||'').trim())continue;
   let current;try{current=url(value);}catch(error){if(strict||field==='link')throw error;continue;}const host=current.hostname.toLowerCase();
   if(/(^|\.)mercadolivre\.com\.br$/.test(host)){
    const item=safety.listingId({marketplace:'mercado_livre',link:current.href});
    if(item){if(strict&&field!=='linkShopee'&&listing&&listing!==item)throw Error('Os links contêm anúncios diferentes; confira o endereço e o afiliado.');listing=listing||item;keys.add('listing:'+item);}
    const cat=current.pathname.match(/\/(?:p|up)\/(MLBU?\d+)(?:\/|$)/i)?.[1]?.toUpperCase();
    if(cat){if(strict&&catalogue&&catalogue!==cat)throw Error('Os links contêm catálogos diferentes; confira o produto.');catalogue=catalogue||cat;keys.add('catalogue:'+cat);}
   }
   if(/(^|\.)shopee\.com\.br$/.test(host)){
    const pair=current.pathname.match(/\/product\/(\d+)\/(\d+)(?:\/|$)/i)||current.pathname.match(/-i\.(\d+)\.(\d+)(?:\/|$)/i);
    if(pair)keys.add('shopee:'+pair[1].replace(/^0+(?=\d)/,'')+':'+pair[2].replace(/^0+(?=\d)/,''));
   }
   keys.add('url:'+canonical(current.href));
  }
  if(!keys.size)throw Error('Não foi possível identificar o link. Nenhum cadastro foi criado.');
  return {listing,catalogue,keys:[...keys].sort()};
 }
 function conflicts(left,right){
  const a=identify(left),b=identify(right,{strict:false});
  return a.keys.some(key=>b.keys.includes(key)&&(!key.startsWith('catalogue:')||!a.listing||!b.listing||a.listing===b.listing));
 }
 async function hash(value){
  if(!globalThis.crypto?.subtle)throw Error('A proteção de duplicados não pôde iniciar. Atualize o navegador antes de cadastrar.');
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
 }
 function registry(value){
  if(value==null)return {version:1,entries:{}};
  if(value.version!==1||!value.entries||typeof value.entries!=='object'||Array.isArray(value.entries)||Object.keys(value).some(k=>!['version','entries','updatedAt','generatedAt','complete'].includes(k)))throw Error('Índice de duplicados inválido; salvamento bloqueado.');
  const entries=Object.entries(value.entries);
  if(entries.length>MAX_ENTRIES||JSON.stringify(value).length>700000||entries.some(([key,ids])=>!/^([a-f0-9]{64})$/.test(key)||!Array.isArray(ids)||ids.length>100||ids.some(id=>!validId(id))))throw Error('Índice de duplicados inválido ou acima do limite; solicite revisão.');
  return {version:1,entries:Object.fromEntries(entries.map(([key,ids])=>[key,[...new Set(ids)].sort()]))};
 }
 async function prepare(product,loadIndex){
  const identity=identify(product),keys=await Promise.all(identity.keys.map(hash));
  const source=url(product.link);
  const complete=/mercadolivre\.com\.br$/.test(source.hostname)&&(safety.listingId({marketplace:'mercado_livre',link:source.href})||/\/(?:p|up)\/MLBU?\d+(?:\/|$)/i.test(source.pathname))
    || /shopee\.com\.br$/.test(source.hostname)&&(/\/product\/\d+\/\d+(?:\/|$)/i.test(source.pathname)||/-i\.\d+\.\d+(?:\/|$)/i.test(source.pathname));
  if(!complete)throw Error('Para evitar duplicados, cole o link completo do produto com o código MLB ou o endereço do produto na Shopee. O afiliado curto fica no campo de afiliado.');
  const index=registry(await loadIndex());
  const primary=identity.listing?'ml'+identity.listing:'p'+await hash('primary:'+canonical(product.link));
  return {product:{...product},identity,keys,index,id:primary};
 }
 async function claim(prepared,stored,readProduct,id,actual=prepared.product){
  if(!validId(id)||JSON.stringify(identify(actual))!==JSON.stringify(prepared.identity))throw Error('Os links mudaram durante o salvamento. Abra a edição novamente.');
  const current=registry(stored),candidates=new Set(prepared.keys.flatMap(key=>[...(prepared.index.entries[key]||[]),...(current.entries[key]||[])]).filter(other=>other!==id));
  if(candidates.size>100)throw Error('Há muitos cadastros relacionados; revise os links antes de salvar.');
  const snapshots=await Promise.all([...candidates].map(async candidate=>[candidate,await readProduct(candidate)]));
  for(const [other,data]of snapshots)if(data&&conflicts(actual,data))throw duplicate(other);
  const entries=Object.fromEntries(Object.entries(current.entries).map(([key,ids])=>[key,ids.filter(other=>other!==id&&(!candidates.has(other)||snapshots.some(([candidate,data])=>candidate===other&&data))) ]).filter(([,ids])=>ids.length));
  for(const key of prepared.keys)entries[key]=[...new Set([...(entries[key]||[]),id])].sort();
  return registry({version:1,entries});
 }
 async function loadIndex(fetcher=globalThis.fetch){
  const response=await fetcher('/product-identities.json',{cache:'no-store'});
  if(!response.ok)throw Error('A lista de proteção contra duplicados ainda não carregou. Tente novamente; nenhum cadastro foi criado.');
  const data=await response.json();if(!data||data.complete!==true||typeof data.generatedAt!=='string'||!Number.isFinite(Date.parse(data.generatedAt)))throw Error('A proteção ainda está sendo preparada. Aguarde a publicação completa do sitemap antes de cadastrar.');
  return registry(data);
 }
 function linksChanged(patch){return ['link','linkAfiliado','linkShopee','marketplace'].some(key=>Object.hasOwn(patch,key));}
 async function acquire(adapter,prepared,id,actual,creating=false){
  const stored=await adapter.readRegistry();
  if(creating){const removed=await adapter.readRemoved();if(removed&&(!Array.isArray(removed.ids)||removed.version!==1||removed.ids.length>4000||removed.ids.some(other=>!validId(other))||Object.keys(removed).some(key=>!['version','ids','updatedAt'].includes(key))))throw Error('Registro de exclusões inválido; cadastro bloqueado.');if(removed?.ids.includes(id))throw Error('Esse identificador foi excluído definitivamente. Reutilize o cadastro que você manteve ou solicite revisão; nada foi recriado.');}
  const next=await claim(prepared,stored,adapter.readProduct,id,actual);
  adapter.saveRegistry({...next,updatedAt:adapter.timestamp()});
 }
 const api=Object.freeze({DOCUMENT,validId,canonical,identify,conflicts,hash,registry,prepare,claim,loadIndex,linksChanged,acquire});
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.RDCProductUniqueness=api;
})(typeof window==='object'?window:globalThis);
