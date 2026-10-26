import {readFile,writeFile,readdir,unlink} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import removal from '../product-removal-safety.js';
import {decodeConfigFields} from './public-site-config.mjs';
import {fetchFirestoreRead} from './firestore-read-auth.mjs';

export async function localRemovals(root=process.cwd()){
 try{return removal.registry(JSON.parse(await readFile(resolve(root,'product-deletions.json'),'utf8')));}
 catch(e){if(e.code==='ENOENT')return {version:1,ids:[]};throw e;}
}
export async function publicationRemovals(input,root=process.cwd()){
 const before=await localRemovals(root);let remote;
 if(input){remote=input.removals||null;}
 else{
  const response=await fetchFirestoreRead('https://firestore.googleapis.com/v1/projects/rankingdacompra/databases/(default)/documents/configuracoes/'+removal.REGISTRY,{signal:AbortSignal.timeout(15000)});
  if(response.status===404)remote=null;
  else if(!response.ok)throw Error('Exclusões definitivas: HTTP '+response.status+'. Publicação bloqueada sem alterar arquivos.');
  else remote=decodeConfigFields((await response.json()).fields);
 }
 const merged=removal.merged(before,remote);
 await writeFile(resolve(root,'product-deletions.json'),JSON.stringify(merged)+'\n','utf8');
 return new Set(merged.ids);
}
function removedPath(value,ids,aliases){
 try{const url=new URL(String(value||''),'https://rankingdacompra.com.br/');if(url.origin!=='https://rankingdacompra.com.br'||!url.pathname.startsWith('/produto/'))return false;
 const name=decodeURIComponent(url.pathname.slice('/produto/'.length));if(name.includes('/'))return false;
 if(aliases.has(name))return true;
 return [...ids].some(id=>name===id+'.html'||new RegExp('^'+id+'-\\d{8}-\\d+\\.html$').test(name));
 }catch{return false;}
}
function cleanStructuredData(value,ids,aliases){
 if(typeof value==='string')return removedPath(value,ids,aliases)?undefined:value;
 if(Array.isArray(value))return value.map(item=>cleanStructuredData(item,ids,aliases)).filter(item=>item!==undefined);
 if(value&&typeof value==='object'){
  if(['url','@id','item'].some(key=>typeof value[key]==='string'&&removedPath(value[key],ids,aliases)))return undefined;
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,cleanStructuredData(item,ids,aliases)]).filter(([,item])=>item!==undefined));
 }
 return value;
}
export function cleanRemovedLinks(html,ids,aliases=new Set()){
 return html.replace(/<a\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>([\s\S]*?)<\/a>/gi,(tag,_before,_quote,href)=>removedPath(href.replace(/&amp;/g,'&'),ids,aliases)?'<span>Análise removida</span>':tag)
 .replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,(tag,start,body,end)=>{
  const data=JSON.parse(body),clean=cleanStructuredData(data,ids,aliases);
  if(clean===undefined)return '';
  return JSON.stringify(data)===JSON.stringify(clean)?tag:start+JSON.stringify(clean).replace(/</g,'\\u003c')+end;
 });
}
export function pruneConfig(config,ids,aliases=new Set()){
 const next={...config};
 if(Array.isArray(next.bestChoicesProductIds))next.bestChoicesProductIds=next.bestChoicesProductIds.filter(id=>!ids.has(id));
 if(Array.isArray(next.youtubeShowcaseItems)){
  next.youtubeShowcaseItems=next.youtubeShowcaseItems.filter(item=>!removedPath(item.productUrl||item.produtoUrl,ids,aliases));
  if(next.youtubeShowcaseItems.length!==config.youtubeShowcaseItems.length){next.youtubeShowcaseLinks=next.youtubeShowcaseItems.map(item=>item.youtubeUrl||item.videoUrl||item.url);if(next.youtubeShowcaseItems.length<3)next.youtubeShowcaseEnabled=false;}
 }
 if(next.weeklyComparison?.produtos){const weekly={...next.weeklyComparison,produtos:next.weeklyComparison.produtos.filter(p=>!ids.has(p.id))};if(weekly.produtos.length!==next.weeklyComparison.produtos.length)weekly.publicado=false;next.weeklyComparison=weekly;}
 return next;
}
async function optionalJson(path,fallback){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function files(directory){try{return (await readdir(directory,{withFileTypes:true})).filter(e=>e.isFile()).map(e=>e.name);}catch(e){if(e.code==='ENOENT')return [];throw e;}}
async function removeFile(directory,name){
 if(basename(name)!==name||dirname(resolve(directory,name))!==resolve(directory))throw Error('Caminho de limpeza fora do diretório autorizado.');
 await unlink(resolve(directory,name));
}
export async function purgeRemovals(root=process.cwd()){
 root=resolve(root);const {ids:deleted}=await localRemovals(root),ids=new Set(deleted);
 if(!ids.size)return {products:0,pages:0,historyFiles:0,images:0};
 const productDir=resolve(root,'produto'),historyDir=resolve(root,'assets/price-history'),imageDir=resolve(productDir,'imagens');
 const registry=await optionalJson(resolve(root,'product-url-aliases.json'),{}),aliases=new Set();
 for(const [file,entry]of Object.entries(registry))if(ids.has(typeof entry==='string'?entry:entry?.id)){
  if(!/^[A-Za-z0-9_-]+\.html$/.test(file))throw Error('Alias de exclusão inválido.');aliases.add(file);
 }
 const ownsPage=name=>aliases.has(name)||deleted.some(id=>name===id+'.html'||new RegExp('^'+id+'-\\d{8}-\\d+\\.html$').test(name));
 let pages=0,historyFiles=0,images=0;
 for(const name of await files(productDir))if(ownsPage(name)){await removeFile(productDir,name);pages++;}
 // Preserve other records and audit data: erase only the selected price keys.
 for(const file of ['historico-precos.json','historico-precos-indice.json','mercadolivre-status.json']){
  const path=resolve(root,file),data=await optionalJson(path,null);if(!data)continue;
  if(!data.products||typeof data.products!=='object'||Array.isArray(data.products))throw Error('Histórico/status inválido; limpeza bloqueada: '+file);
  let changed=false;for(const id of deleted)if(Object.hasOwn(data.products,id)){delete data.products[id];changed=true;}
  if(changed)await writeFile(path,JSON.stringify(data)+'\n','utf8');
 }
 for(const name of await files(historyDir))if(deleted.some(id=>new RegExp('^'+id+'-[a-f0-9]{16}\\.json$').test(name))){await removeFile(historyDir,name);historyFiles++;}
 for(const file of ['vitrine-publica.json','search-index.json','top5-semanal.json']){
  const path=resolve(root,file),data=await optionalJson(path,null);if(!data)continue;
  if(!Array.isArray(data.products))throw Error('Catálogo inválido na limpeza: '+file);
  const filtered=data.products.filter(p=>!ids.has(p.id));if(filtered.length!==data.products.length){data.products=filtered;await writeFile(path,JSON.stringify(data,null,2)+'\n','utf8');}
 }
 const configPath=resolve(root,'site-config.json'),config=await optionalJson(configPath,null);if(config)await writeFile(configPath,JSON.stringify(pruneConfig(config,ids,aliases),null,2)+'\n','utf8');
 const identityPath=resolve(root,'product-identities.json'),identity=await optionalJson(identityPath,null);
 if(identity){
  if(identity.version!==1||!identity.entries||typeof identity.entries!=='object'||Array.isArray(identity.entries)||Object.values(identity.entries).some(values=>!Array.isArray(values)))throw Error('Índice de identidade inválido na limpeza.');
  const entries=Object.fromEntries(Object.entries(identity.entries).map(([key,values])=>[key,values.filter(id=>!ids.has(id))]).filter(([,values])=>values.length));
  if(JSON.stringify(entries)!==JSON.stringify(identity.entries)){identity.entries=entries;await writeFile(identityPath,JSON.stringify(identity)+'\n','utf8');}
 }
 const htmlFiles=[...(await files(root)).filter(n=>n.endsWith('.html')).map(n=>resolve(root,n)),...(await files(productDir)).filter(n=>n.endsWith('.html')).map(n=>resolve(productDir,n)),...(await files(resolve(root,'presentes'))).filter(n=>n.endsWith('.html')).map(n=>resolve(root,'presentes',n))];
 const texts=[];
 for(const path of htmlFiles){const original=await readFile(path,'utf8');const next=cleanRemovedLinks(original,ids,aliases);if(next!==original)await writeFile(path,next,'utf8');texts.push(next);}
 for(const name of await files(imageDir))if(deleted.some(id=>new RegExp('^'+id+'-[a-f0-9]{12}\\.(?:jpg|png|webp)$').test(name))&&!texts.some(html=>html.includes('produto/imagens/'+name))){await removeFile(imageDir,name);images++;}
 const sitemapPath=resolve(root,'sitemap.xml');try{const xml=await readFile(sitemapPath,'utf8');const next=xml.replace(/<url>[\s\S]*?<\/url>/g,entry=>removedPath(entry.match(/<loc>([^<]+)<\/loc>/)?.[1],ids,aliases)?'':entry);if(next!==xml)await writeFile(sitemapPath,next,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
 // The technical ID-only registry is retained to prevent restoration from old snapshots.
 return {products:ids.size,pages,historyFiles,images};
}
export async function verifyRemovals(root=process.cwd()){
 root=resolve(root);const {ids:deleted}=await localRemovals(root),ids=new Set(deleted);if(!ids.size)return;
 const registry=await optionalJson(resolve(root,'product-url-aliases.json'),{}),aliases=new Set(Object.entries(registry).filter(([,entry])=>ids.has(typeof entry==='string'?entry:entry?.id)).map(([file])=>file));
 const productDir=resolve(root,'produto');
 for(const name of await files(productDir))if(removedPath('/produto/'+name,ids,aliases))throw Error('Exclusão incompleta: página '+name);
 for(const file of ['historico-precos.json','historico-precos-indice.json','mercadolivre-status.json','vitrine-publica.json','search-index.json','top5-semanal.json']){
  const data=await optionalJson(resolve(root,file),null);if(!data)continue;
  if(!data.products||typeof data.products!=='object')throw Error('Arquivo inválido ao conferir exclusões: '+file);
  const remaining=Array.isArray(data.products)?data.products.map(p=>p.id):Object.keys(data.products);
  if(remaining.some(id=>ids.has(id)))throw Error('Exclusão incompleta: referência em '+file);
 }
 for(const name of await files(resolve(root,'assets/price-history')))if(deleted.some(id=>new RegExp('^'+id+'-[a-f0-9]{16}\\.json$').test(name)))throw Error('Exclusão incompleta: histórico '+name);
 const htmlFiles=[...(await files(root)).filter(n=>n.endsWith('.html')).map(n=>resolve(root,n)),...(await files(productDir)).filter(n=>n.endsWith('.html')).map(n=>resolve(productDir,n)),...(await files(resolve(root,'presentes'))).filter(n=>n.endsWith('.html')).map(n=>resolve(root,'presentes',n))];
 for(const file of htmlFiles){const html=await readFile(file,'utf8');if(cleanRemovedLinks(html,ids,aliases)!==html)throw Error('Exclusão incompleta: link público em '+file);}
 const xml=await readFile(resolve(root,'sitemap.xml'),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
 for(const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g))if(removedPath(match[1],ids,aliases))throw Error('Exclusão incompleta: sitemap');
 const config=await optionalJson(resolve(root,'site-config.json'),null);if(config&&JSON.stringify(pruneConfig(config,ids,aliases))!==JSON.stringify(config))throw Error('Exclusão incompleta: configuração pública');
 const identity=await optionalJson(resolve(root,'product-identities.json'),null);if(identity&&Object.values(identity.entries||{}).some(values=>!Array.isArray(values)||values.some(id=>ids.has(id))))throw Error('Exclusão incompleta: índice de identidade');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log('Limpeza de exclusões confirmadas: '+JSON.stringify(await purgeRemovals()));
