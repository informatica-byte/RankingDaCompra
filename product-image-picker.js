(function(root){
 'use strict';
 const data=root.RDCProductImageData,KEY='rdc-pending-product-images-v1',controllers=new WeakMap();
 function pending(){try{return JSON.parse(localStorage.getItem(KEY)||'[]').filter(item=>{const expected=data.descriptor({id:item.id,foto:item.url});return expected&&expected.hash===item.hash;}).slice(-100);}catch{return [];}}
 function remember(item){try{localStorage.setItem(KEY,JSON.stringify([...pending().filter(p=>p.id!==item.id),item].slice(-100)));}catch{}}
 function forget(item){try{localStorage.setItem(KEY,JSON.stringify(pending().filter(p=>p.id!==item.id||p.hash!==item.hash)));}catch{}}
 function mount(input,{cleanup=async()=>false,session=()=>''}={}){
  if(!input||!data)throw Error('Seletor de imagem indisponível.');
  if(controllers.has(input))return controllers.get(input);
  const required=input.required,container=document.createElement('section');container.dataset.localProductImage='true';
  container.innerHTML='<style>[data-local-product-image]{min-width:0;max-width:100%;margin:10px 0;padding:12px;border:1px solid #b8d4c6;border-radius:10px;background:#f4faf6}[data-local-product-image] label{display:block;margin:8px 0}[data-local-product-image] input[type=radio],[data-local-product-image] input[type=checkbox]{width:auto!important;min-height:0;margin-right:8px}[data-local-product-image] input[type=file]{box-sizing:border-box;width:100%;max-width:100%;font:inherit}[data-local-product-image] button{min-height:44px;white-space:normal}[data-local-product-image] img{display:block;max-width:100%;height:200px;object-fit:contain;margin:10px auto}[data-local-product-image] [hidden]{display:none!important}[data-local-product-image] p{overflow-wrap:anywhere}</style>'
   +'<strong>Foto do produto</strong><label><input type="radio" data-image-source="url" checked> Usar o link da imagem do site</label><label><input type="radio" data-image-source="local"> Escolher uma imagem deste computador ou celular</label>'
   +'<div data-local-fields hidden><input type="file" data-image-file accept="image/jpeg,image/png,image/webp"><p>JPG, PNG ou WebP, até 8 MB. A imagem será reduzida, convertida para JPEG e terá os metadados removidos. Transparência terá fundo branco. Escolher o arquivo só cria uma prévia; o envio acontece ao salvar o produto.</p><label><input type="checkbox" data-image-permission> A foto é do produto cadastrado e é própria ou tenho autorização para publicá-la.</label><img data-image-preview hidden alt="Prévia da imagem selecionada"><p>Ao publicar as páginas, a foto ficará na vitrine, na ficha e nas postagens. Não são usados Firebase Storage ou serviços de upload contratados.</p></div>'
   +'<p data-image-status role="status" aria-live="polite"></p><button type="button" data-check-images>Verificar fotos já publicadas</button>';
  input.after(container);
  const radios=[...container.querySelectorAll('[data-image-source]')],file=container.querySelector('[data-image-file]'),permission=container.querySelector('[data-image-permission]'),preview=container.querySelector('[data-image-preview]'),status=container.querySelector('[data-image-status]');
  radios.forEach(r=>r.name='foto-origem-'+input.id);
  let mode='url',selection=null,objectUrl='',generation=0,processing=null;
  const watches=new Map();
  let previousReadOnly=input.readOnly;
  function setBusy(busy){if(busy)previousReadOnly=input.readOnly;input.readOnly=busy?true:previousReadOnly;for(const control of container.querySelectorAll('input,button'))control.disabled=busy;}
  function revoke(){if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';preview.removeAttribute('src');preview.hidden=true;}
  function useUrl(){generation++;mode='url';selection=null;processing=null;file.value='';permission.checked=false;revoke();status.textContent='';input.hidden=false;input.required=required;radios[0].checked=true;radios[1].checked=false;container.querySelector('[data-local-fields]').hidden=true;}
  function chooseLocal(){mode='local';selection=null;generation++;input.hidden=true;input.required=false;container.querySelector('[data-local-fields]').hidden=false;}
  radios[0].addEventListener('change',()=>{if(radios[0].checked)useUrl();});radios[1].addEventListener('change',()=>{if(radios[1].checked)chooseLocal();});
  async function optimize(chosen){
   if(!chosen||!chosen.size||chosen.size>8*1024*1024)throw Error('Escolha uma imagem de até 8 MB.');
   const signature=new Uint8Array(await chosen.slice(0,16).arrayBuffer());
   const jpeg=signature[0]===255&&signature[1]===216&&signature[2]===255,png=signature[0]===137&&String.fromCharCode(...signature.slice(1,4))==='PNG',webp=String.fromCharCode(...signature.slice(0,4))==='RIFF'&&String.fromCharCode(...signature.slice(8,12))==='WEBP';
   if(!jpeg&&!png&&!webp)throw Error('Formato não aceito. Use JPG, PNG ou WebP; SVG, GIF e HEIC não são enviados.');
   if(typeof createImageBitmap!=='function')throw Error('Atualize o navegador para preparar a foto local, ou use a opção de link da imagem.');
   const bitmap=await createImageBitmap(chosen);
   try{
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw Error('A foto é grande demais para processar com segurança. Escolha uma versão menor.');
    for(const edge of [1200,1000,800,640])for(const quality of [.86,.76,.64]){
     const ratio=Math.min(1,edge/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
     const ctx=canvas.getContext('2d');if(!ctx)throw Error('Este navegador não consegue preparar a foto.');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
     const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
     if(blob?.size&&blob.size<=data.MAX_BYTES){const bytes=new Uint8Array(await blob.arrayBuffer()),size=data.dimensions(bytes),hash=await data.digest(bytes);let binary='';for(const n of bytes)binary+=String.fromCharCode(n);return {data:btoa(binary),bytes:bytes.length,...size,hash,blob};}
    }
    throw Error('Não foi possível reduzir a foto. Escolha uma imagem menor.');
   }finally{bitmap.close();}
  }
  file.addEventListener('change',()=>{
   const attempt=++generation;selection=null;permission.checked=false;revoke();status.textContent='Preparando a foto local...';
   processing=optimize(file.files?.[0]).then(value=>{if(attempt!==generation)return;selection=value;objectUrl=URL.createObjectURL(value.blob);preview.src=objectUrl;preview.hidden=false;status.textContent=`Prévia pronta: ${value.width} × ${value.height}, ${Math.ceil(value.bytes/1024)} KB. A foto só será enviada ao salvar.`;}).catch(error=>{if(attempt===generation){selection=null;status.textContent=error.message;}});
  });
  function capture(){
   if(mode!=='local')return null;
   if(!selection)throw Error('Escolha e aguarde a preparação da foto local.');
   if(!permission.checked)throw Error('Confirme a autorização de uso da imagem.');
   return Object.freeze({data:selection.data,bytes:selection.bytes,width:selection.width,height:selection.height,hash:selection.hash});
  }
  function queueRecord(image,id){return {version:1,productId:id,mime:'image/jpeg',hash:image.hash,data:image.data,bytes:image.bytes,width:image.width,height:image.height,queuedAt:new Date().toISOString()};}
  async function check(item){
   const uid=session();if(!uid)return false;
   try{
    const expected=data.descriptor({id:item.id,foto:item.url});if(!expected||expected.hash!==item.hash)return false;
    const response=await fetch(item.url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});
    if(!response.ok)return false;const bytes=new Uint8Array(await response.arrayBuffer());if(await data.digest(bytes)!==item.hash||session()!==uid)return false;
    if(await cleanup(item,uid)){forget(item);status.textContent='✓ Foto publicada e verificada. A cópia temporária foi liberada; o arquivo continua no site.';return true;}
   }catch{}
   return false;
  }
  async function checkAll(){status.textContent='Conferindo as fotos que aguardavam publicação...';if(!session()){status.textContent='Entre no painel antes de verificar as fotos.';return;}const items=pending();if(!items.length){status.textContent='Não há fotos locais aguardando confirmação neste navegador.';return;}const result=await Promise.all(items.map(check));if(result.some(done=>!done))status.textContent='Algumas fotos ainda aguardam a publicação das páginas. A imagem anterior do site permanece até a nova publicação terminar.';}
  container.querySelector('[data-check-images]').addEventListener('click',()=>void checkAll());
  root.addEventListener('rdc-admin-auth',()=>{if(session()&&pending().length)void checkAll();});
  function committed(image,id){if(!image)return;const item={id,hash:image.hash,url:data.urlFor(id,image.hash)};remember(item);status.textContent='Foto salva na fila. Publique as páginas para colocá-la no site.';let tries=0;const watch=async()=>{if(await check(item)||++tries>=8){watches.delete(id);return;}watches.set(id,setTimeout(watch,15000));};clearTimeout(watches.get(id));watches.set(id,setTimeout(watch,15000));}
  input.form?.addEventListener('reset',()=>{useUrl();});
  root.addEventListener('pagehide',()=>{generation++;revoke();for(const timer of watches.values())clearTimeout(timer);watches.clear();});
  const controller={capture,queueRecord,committed,clear:useUrl,setBusy,isLocal:()=>mode==='local',preview:()=>mode==='local'&&selection?objectUrl:'',urlFor:(image,id)=>data.urlFor(id,image.hash),container,checkAll};controllers.set(input,controller);return controller;
 }
 root.RDCProductImagePicker={mount};
})(window);
