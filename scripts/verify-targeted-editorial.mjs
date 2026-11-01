import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {refreshLedger} from './site-improvement-ledger.mjs';
const batch=process.argv[2];assert.match(batch||'',/^\d+$/);
const date=process.argv[3]||'20261031';assert.match(date,/^\d{8}$/);
const out='../../outputs/melhorias-integrais-20261030/';
const json=async f=>JSON.parse(await readFile(f,'utf8'));
const before=await json(out+'catalogo-antes-triagem'+batch+'.json'),local=await json('informational-catalogue.json');
const manifest=await json('docs/targeted-triage'+batch+'-'+date+'.json');
const ids=manifest.items.filter(p=>p.decision==='targeted_correction_complete').map(p=>p.id).sort(),current=new Map(local.products.map(p=>[p.id,p]));
assert.deepEqual(before.products.filter(p=>JSON.stringify(p)!==JSON.stringify(current.get(p.id))).map(p=>p.id).sort(),ids);
const stripTitle=p=>Object.fromEntries(Object.entries(p).filter(([k])=>k!=='title'));
for(const id of manifest.preserveExceptTitleIds||[])assert.deepEqual(stripTitle(current.get(id)),stripTitle(before.products.find(p=>p.id===id)),'Prior body or facts changed '+id);
const get=async url=>{const r=await fetch(url+'?triage'+batch+'='+Date.now());assert.equal(r.status,200,url);return r.text();};
const live=JSON.parse(await get('https://rankingdacompra.com.br/informational-catalogue.json')),byId=new Map(live.products.map(p=>[p.id,p]));
const baseline=await json(out+'invariantes-triagem'+batch+'.json'),search=JSON.parse(await get('https://rankingdacompra.com.br/search-index.json'));
const pages=[];
for(const id of ids){
 const p=current.get(id);assert.deepEqual(byId.get(id),p,'live mismatch '+id);
 const h=await get(p.url);assert.match(h,/<h1\b/);
 const context=manifest.items.find(p=>p.id===id)?.publicContextUrl;if(context){assert.ok(h.includes('href="'+context+'"'),'Missing context reference '+id);assert.match(h,/data-editorial-context/);}
 const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
 const article=nodes.find(n=>n['@type']==='Article'),found=search.products.find(x=>x.id===id);assert.equal(article.about.name,p.title);assert.equal(found.title,p.title);assert.equal(found.summary,article.description);
 const affiliates=[...h.matchAll(/<a\b[^>]*\bid=["']((?:mobile-)?affiliate-offer(?:-shopee)?)["'][^>]*>/g)].map(m=>[m[1],m[0].match(/href=["']([^"']+)/)?.[1]]).sort();assert.deepEqual(affiliates,baseline.pages.find(p=>p.id===id).affiliate);
 pages.push({id,url:p.url,http:200,title:p.title,affiliatesPreserved:true});
}
for(const p of before.products.filter(p=>!ids.includes(p.id)))assert.deepEqual(byId.get(p.id),p,'unrelated live change '+p.id);
const v=JSON.parse(await get('https://rankingdacompra.com.br/vitrine-publica.json'));
const protectedData=v.products.map(p=>Object.fromEntries(Object.entries(p).filter(([k])=>/^(?:id$|foto$|link|preco|promocao|oferta|conferencia|quarentena|anuncioSubstituido)/i.test(k)))).sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(protectedData,baseline.protectedData);
const xml=await get('https://rankingdacompra.com.br/sitemap.xml'),urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]).sort();assert.deepEqual(urls,baseline.urls);
const proof={at:new Date().toISOString(),products:live.products.length,sitemapUrls:urls.length,protectedRecords:protectedData.length,changedIds:ids,unchangedProducts:before.products.length-ids.length,deepReviews:live.products.filter(p=>p.decisionBrief?.reviewed).length,pages,noFirestoreEditorial:true};assert.equal(proof.deepReviews,98);
await writeFile(out+'verificacao-publicada-triagem'+batch+'.json',JSON.stringify(proof,null,2)+'\n');
const progress=refreshLedger(local,await json('docs/site-improvement-progress.json'));
for(const d of manifest.items){const i=progress.items.find(x=>x.id===d.id);i.status=d.decision;i.lastCompletedAt=proof.at;i.workNotes=[d.reason,d.sourceLimit,'Targeted necessary correction only, not a new deep review.'];i.sourceLinks=d.sourceLinks;}
progress.counts=progress.items.reduce((a,p)=>{a[p.status]=(a[p.status]||0)+1;return a},{total:progress.items.length});
progress['triage'+batch]={status:'published_verified',verifiedAt:proof.at,changedIds:ids,newDeepReviews:0,proof:'outputs/melhorias-integrais-20261030/verificacao-publicada-triagem'+batch+'.json',remainingDependencies:manifest.items.map(p=>({id:p.id,note:p.sourceLimit}))};
const traffic=await json(out+'ga4-prioridade-visualizacoes-20261031.json'),views=new Map();for(const row of traffic.response.data){const id=row.page_path.match(/^\/produto\/([^/]+)-20260810-1\.html$/)?.[1];if(id)views.set(id,(views.get(id)||0)+Number(row.screen_page_views));}
progress.editorialPriority.nextPendingIds=progress.items.filter(p=>p.status==='pending').sort((a,b)=>(views.get(b.id)||0)-(views.get(a.id)||0)||a.id.localeCompare(b.id)).slice(0,8).map(p=>p.id);
await writeFile('docs/site-improvement-progress.json',JSON.stringify(progress,null,2)+'\n');
console.log(JSON.stringify({proof,counts:progress.counts,next:progress.editorialPriority.nextPendingIds[0]}));
