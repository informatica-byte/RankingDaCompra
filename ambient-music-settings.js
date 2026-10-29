(function(root){
 'use strict';
 const PRESETS=Object.freeze([
  {id:'suave',name:'Suave — melodia atual',chords:[[48,55,59,64],[45,52,55,60],[41,48,52,57],[43,50,57,62]],melody:[76,72,69,74,71,67,69,74],interval:8},
  {id:'calma',name:'Calma — notas espaçadas',chords:[[48,55,60,64],[43,50,55,59],[45,52,57,60],[41,48,53,57]],melody:[72,67,69,65,67,64,65,67],interval:10},
  {id:'leve',name:'Leve — variação instrumental',chords:[[50,57,62,65],[46,53,58,62],[48,55,60,64],[45,52,57,60]],melody:[77,74,72,69,74,72,70,69],interval:8}
 ]);
 const defaults=()=>({version:1,kind:'generated',preset:'suave',tracks:[]});
 function https(value){
  if(typeof value!=='string'||value.length>1200)throw Error('Use um endereço HTTPS público, sem credenciais.');
  const url=new URL(value.trim());
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||!/^([a-z0-9-]+\.)+[a-z]{2,63}$/i.test(url.hostname)||/\.(?:local|internal|localhost|test|invalid)$/i.test(url.hostname))throw Error('Use um endereço HTTPS público e permanente, sem senha, parâmetros ou códigos de acesso.');
  return url.href;
 }
 function audioUrl(value){
  const url=new URL(https(value));
  if(/(^|\.)(?:youtube\.com|youtu\.be|googlevideo\.com|spotify\.com|soundcloud\.com)$/.test(url.hostname)||!/\.(?:mp3|m4a|ogg|oga|wav|aac)$/i.test(url.pathname))throw Error('Cole o endereço direto de um arquivo MP3, M4A, OGG, WAV ou AAC autorizado; não um link do YouTube ou Spotify.');
  return url.href;
 }
 const clean=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
 function normalize(input,{strict=false}={}){
  try{
   if(input===undefined)return defaults();
   if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Configuração de música inválida.');
   if(!['generated','files'].includes(input.kind))throw Error('Escolha o tipo de música.');
   if(input.kind==='generated'){
    if(!PRESETS.some(p=>p.id===input.preset))throw Error('Escolha uma das melodias do site.');
    const library=Array.isArray(input.tracks)&&input.tracks.length?normalize({...input,kind:'files'},{strict:true}):null;
    return {...defaults(),preset:input.preset,...(library?{rightsConfirmed:true,tracks:library.tracks}:{})};
   }
   if(input.rightsConfirmed!==true)throw Error('Confirme que as faixas são próprias ou licenciadas para uso no site.');
   if(!Array.isArray(input.tracks)||input.tracks.length<1||input.tracks.length>6)throw Error('Cadastre de uma a seis faixas.');
   const seen=new Set();
   const tracks=input.tracks.map(track=>{
    if(!track||typeof track!=='object'||Array.isArray(track))throw Error('Faixa inválida.');
    const name=clean(track.name,80),credit=clean(track.credit,180),url=audioUrl(track.url);
    if(!name||!credit)throw Error('Informe o nome da faixa e os créditos do autor ou da fonte.');
    if(!['own','licensed'].includes(track.rights))throw Error('Indique se a faixa é própria ou licenciada.');
    const licenseUrl=track.licenseUrl?https(track.licenseUrl):'';
    if(track.rights==='licensed'&&!licenseUrl)throw Error('Informe uma página pública com os termos da licença, sem contratos ou dados pessoais.');
    if(seen.has(url))throw Error('O mesmo arquivo foi informado mais de uma vez.');seen.add(url);
    return {name,url,credit,rights:track.rights,licenseUrl};
   });
   return {version:1,kind:'files',preset:'suave',rightsConfirmed:true,tracks};
  }catch(error){if(strict)throw error;return defaults();}
 }
 let pending;
 function load(){
  if(pending)return pending;
  const request=Promise.resolve().then(()=>root.RDCPublicData?.json?root.RDCPublicData.json('/site-config.json')
   :typeof root.fetch==='function'?root.fetch('/site-config.json',{credentials:'omit',cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Configuração indisponível');return r.json();}):{});
  let timer;
  pending=Promise.race([request,new Promise((_,reject)=>{timer=root.setTimeout(()=>reject(Error('Tempo esgotado')),3000);})])
   .then(config=>normalize(config?.ambientMusic)).catch(()=>({...defaults(),unavailable:true})).finally(()=>root.clearTimeout?.(timer));
  return pending;
 }
 const api={PRESETS,defaults,normalize,audioUrl,load};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.RDCAmbientMusicSettings=api;
})(typeof window==='object'?window:globalThis);
