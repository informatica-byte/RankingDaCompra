import {readFile, writeFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import safety from '../product-save-safety.js';
import {registeredOfferUrl} from './popular-analysis.mjs';
import {productSeoTitle} from './product-seo-titles.mjs';

const SITE='https://rankingdacompra.com.br';
export const ANALYSES_DESCRIPTION='Explore análises de produtos por categoria, com características, vantagens, limitações e links para consultar as condições nas lojas.';
export const EPSON_DESCRIPTION='Epson EcoTank L3250: tanque de tinta, USB, Wi-Fi Direct e rendimento anunciado. Compare recursos, usos e limitações.';
export const CONSUMER_INTRO='Escolhas de várias categorias para avaliar uso, características e limitações, sem prometer descontos que não foram comprovados.';
export const seasonalDescription=intro=>`${intro} Veja produtos cadastrados, características e pontos de atenção antes de escolher.`;
const descriptions=new Map([
 ['analises.html',ANALYSES_DESCRIPTION],
 ['presentes/dia-do-consumidor.html',seasonalDescription(CONSUMER_INTRO)],
 ['produto/EmrdwlcDgCCM5suoz8dB-20260810-1.html',EPSON_DESCRIPTION],
]);
// Public editorial labels only: these are distinct saved listings, not a
// deduplication rule or evidence of a colour, voltage or kit composition.
const reviewed=new Map([
 ['Bf3ccSwSiVkLw1Z8k2Hu',{listing:'MLB4297760749',guard:/liquidificador.*mondial.*l-99\s*fb/i,name:'Liquidificador Turbo Power Mondial 550W - L-99 FB'}],
 ['SnMMDq9bDXiMWX0IXYdO',{listing:'MLB1793491599',guard:/liquidificador.*mondial.*l-99\s*fb/i,name:'Liquidificador Turbo Power Mondial 550W - L-99 FB'}],
 ['DjihMK3g3rkBHHTPbOwp',{listing:'MLB4247892213',guard:/principia.*kit.*limpeza.*hidrata|kit.*limpeza.*hidrata.*principia/i,name:'Kit de limpeza e hidratação Principia'}],
 ['pO6CZCNo99YwtpIW0UB8',{listing:'MLB5786186316',guard:/principia.*kit.*limpeza.*hidrata|kit.*limpeza.*hidrata.*principia/i,name:'Kit de limpeza e hidratação Principia'}],
]);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decode=value=>String(value).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const text=value=>decode(String(value).replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
export function publicProductName(product){
 const original=String(product.titulo||product.title||'').trim(),rule=reviewed.get(product.id);
 if(!rule||!rule.guard.test(original))return original;
 try{if(safety.listingId({marketplace:'mercado_livre',link:product.link})!==rule.listing)return original;}catch{return original;}
 return `${rule.name} — anúncio ${rule.listing}`;
}
function localPath(url){
 const parsed=new URL(url,SITE);
 return parsed.origin===SITE&&!parsed.pathname.includes('..')?decodeURIComponent(parsed.pathname).slice(1):'';
}
const affiliateTargets=html=>[...html.matchAll(/<a\b[^>]*\bid=["'](?:affiliate-offer|mobile-affiliate-offer|affiliate-offer-shopee)["'][^>]*>/gi)].map(m=>m[0].match(/\bhref=(["'])(.*?)\1/i)?.[2]);
export function rewritePublicSeo(html,{file='',product=null,labels=new Map()}={}){
 if(/http-equiv=["']refresh["']|rdc-paused-product|rdc-retired-product/i.test(html))return html;
 const before=affiliateTargets(html);
 const description=file==='produto/EmrdwlcDgCCM5suoz8dB-20260810-1.html'&&!/epson.*l3250/i.test(text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||''))?undefined:descriptions.get(file);
 const title=product?.title;
 if(title){
  html=html.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/i,(_,a,b)=>a+esc(title)+b)
   .replace(/<title>[\s\S]*?<\/title>/i,()=>`<title>${esc(productSeoTitle(title))}</title>`)
   .replace(/(<meta\b[^>]*(?:name=["']twitter:title["']|property=["']og:title["'])[^>]*content=)(["'])(.*?)\2/gi,(_,a,q)=>a+q+esc(title)+q)
   .replace(/(<img\b[^>]*class=["']photo["'][^>]*alt=)(["'])(.*?)\2/i,(_,a,q)=>a+q+esc(title)+q);
 }
 if(description)html=html.replace(/(<meta\b[^>]*(?:name=["'](?:description|twitter:description)["']|property=["']og:description["'])[^>]*content=)(["'])(.*?)\2/gi,(_,a,q)=>a+q+esc(description)+q);
 html=html.replace(/(<a\b[^>]*\bhref=(["'])(.*?)\2[^>]*>)([^<]*)(<\/a>)/gi,(all,a,q,url,body,end)=>{
  let item;try{item=labels.get(localPath(decode(url)));}catch{return all;}
  return item&&[item.original,item.title].includes(text(body))?a+esc(item.title)+end:all;
 });
 html=html.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,(all,a,json,b)=>{
  let data;try{data=JSON.parse(json);}catch{return all;}
  const beforeData=JSON.stringify(data);
  const visit=node=>{
   if(Array.isArray(node)){node.forEach(visit);return;}if(!node||typeof node!=='object')return;
   let item;try{if(node.url||node.item)item=labels.get(localPath(typeof node.item==='string'?node.item:node.url||node.item?.['@id']||''));}catch{}
   if(item&&node.name)node.name=item.title;
   if(title&&['Product','Article'].includes(node['@type'])){
    if(node.name)node.name=title;if(node.headline)node.headline=title;
    if(node.about?.name)node.about.name=title;
   }
   if(description&&node.description)node.description=description;
   Object.values(node).forEach(visit);
  };visit(data);
  if(JSON.stringify(data)===beforeData)return all;
  const updated=JSON.stringify(data).replace(/</g,'\\u003c');
  return updated===json?all:a+updated+b;
 });
 if(JSON.stringify(affiliateTargets(html))!==JSON.stringify(before))throw Error('Links de afiliados alterados: '+file);
 return html;
}
export function seoSitemap(xml,files){
 // Date of this editorial correction, not a new product/price verification.
 // Preserve URL membership and never roll a more recent lastmod backwards.
 return xml.replace(/<url>[\s\S]*?<\/url>/g,entry=>{
  const location=entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
  let file;try{file=localPath(decode(location));}catch{return entry;}
  return files.has(file)?entry.replace(/<lastmod>([^<]+)<\/lastmod>/, (tag,date)=>date.slice(0,10)<'2026-10-29'?'<lastmod>2026-10-29</lastmod>':tag):entry;
 });
}
export async function applyPublicSeoLabels(root=process.cwd()){
 root=resolve(root);
 const searchPath=resolve(root,'search-index.json'),search=JSON.parse(await readFile(searchPath,'utf8')),labels=new Map();
 for(const p of search.products||[]){
  if(!reviewed.has(p.id))continue;
  const file=localPath(p.url);if(!file.startsWith('produto/')||!file.endsWith('.html'))continue;
  const html=await readFile(resolve(root,file),'utf8');
  const title=publicProductName({...p,link:registeredOfferUrl(html)});
  if(title!==p.title||title.includes(' — anúncio '))labels.set(file,{id:p.id,original:p.title,title});
 }
 let changed=0;const changedFiles=[];
 for(const file of ['search-index.json','informational-catalogue.json']){
  const path=resolve(root,file),original=await readFile(path,'utf8'),data=JSON.parse(original);let dirty=false;
  for(const p of data.products||[]){const item=labels.get(localPath(p.url));if(item&&item.id===p.id&&p.title!==item.title){p.title=item.title;dirty=true;}}
  if(dirty){await writeFile(path,JSON.stringify(data,null,original.includes('\n')?2:undefined)+'\n','utf8');changed++;changedFiles.push(file);}
 }
 const files=(await readdir(root)).filter(f=>f.endsWith('.html'));
 for(const folder of ['produto','presentes'])for(const f of await readdir(resolve(root,folder)))if(f.endsWith('.html'))files.push(folder+'/'+f);
 for(const file of files){
  if(!labels.size&&!descriptions.has(file))continue;
  const path=resolve(root,file),original=await readFile(path,'utf8'),next=rewritePublicSeo(original,{file,product:labels.get(file),labels});
  if(next!==original){await writeFile(path,next,'utf8');changed++;changedFiles.push(file);}
 }
 const sitemapPath=resolve(root,'sitemap.xml'),xml=await readFile(sitemapPath,'utf8');
 const nextXml=seoSitemap(xml,new Set([...descriptions.keys(),...labels.keys()]));
 if(nextXml!==xml){await writeFile(sitemapPath,nextXml,'utf8');changed++;changedFiles.push('sitemap.xml');}
 return {changed,changedFiles,labels:[...labels.values()]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await applyPublicSeoLabels()));
