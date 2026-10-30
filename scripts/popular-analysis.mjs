import {readFile} from 'node:fs/promises';

export const POPULAR_ANALYSES=JSON.parse(await readFile(new URL('../popular-analysis.json',import.meta.url),'utf8'));
export const NEXT_POPULAR_ANALYSES=JSON.parse(await readFile(new URL('../next-popular-analysis.json',import.meta.url),'utf8'));
export const CAMPAIGN_ANALYSES=JSON.parse(await readFile(new URL('../campaign-analysis.json',import.meta.url),'utf8'));
export const DOCUMENTED_ANALYSES=JSON.parse(await readFile(new URL('../documented-analysis-20261030.json',import.meta.url),'utf8'));
export const NETWORK_ANALYSES=JSON.parse(await readFile(new URL('../network-analysis-20261030.json',import.meta.url),'utf8'));
export const OFFICE_MOBILE_ANALYSES=JSON.parse(await readFile(new URL('../office-mobile-analysis-20261030.json',import.meta.url),'utf8'));
export const HOME_ANALYSES=JSON.parse(await readFile(new URL('../home-analysis-20261030.json',import.meta.url),'utf8'));
export const POPULAR_BATCHES=[POPULAR_ANALYSES,NEXT_POPULAR_ANALYSES,CAMPAIGN_ANALYSES,DOCUMENTED_ANALYSES,NETWORK_ANALYSES,OFFICE_MOBILE_ANALYSES,HOME_ANALYSES];
export const popularById=new Map(POPULAR_BATCHES.flatMap(batch=>batch.products.map(item=>[item.id,item])));

// Match the model and every explicit seller item code. A catalogue, a deal code,
// an affiliate short link or words in a related card cannot identify a seller.
export function matchesPopularAnalysis(item,name,link){
 if(!item||!new RegExp(item.guard,'i').test(name||''))return false;
 try{
  const u=new URL(link);
  if(u.protocol!=='https:'||u.username||u.password||u.port||!['www.mercadolivre.com.br','produto.mercadolivre.com.br'].includes(u.hostname))return false;
  const ids=[];
  const path=u.pathname.match(/\/MLB-(\d+)(?:-|\/|$)/);if(path)ids.push('MLB'+path[1]);
  for(const params of [u.searchParams,new URLSearchParams(u.hash.slice(1))]){
   for(const wid of params.getAll('wid'))ids.push(wid);
   for(const filters of params.getAll('pdp_filters'))for(const m of filters.matchAll(/item_id[:=](MLB\d+)/g))ids.push(m[1]);
  }
  if(item.expectedListing)return ids.length>0&&ids.every(id=>id===item.expectedListing);
  return !!item.expectedCatalogue&&u.pathname.split('/').includes(item.expectedCatalogue)&&ids.length===0;
 }catch{return false;}
}

export function registeredOfferUrl(html){
 const tag=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]).find(tag=>/\bname=["']rdc-offer-url["']/i.test(tag));
 return tag?.match(/\bcontent=(["'])(.*?)\1/i)?.[2]?.replace(/&amp;/g,'&')||'';
}
