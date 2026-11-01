import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {refreshLedger} from './site-improvement-ledger.mjs';
const out='../../outputs/melhorias-integrais-20261030/';
const json=async f=>JSON.parse(await readFile(f,'utf8'));
const before=await json(out+'catalogo-antes-triagem24.json'),local=await json('informational-catalogue.json');
const manifest=await json('docs/targeted-triage24-20261031.json');
const ids=manifest.items.map(p=>p.id).sort(),localById=new Map(local.products.map(p=>[p.id,p]));
assert.deepEqual(before.products.filter(p=>JSON.stringify(p)!==JSON.stringify(localById.get(p.id))).map(p=>p.id).sort(),ids);
const get=async url=>{const r=await fetch(url+'?triage24='+Date.now());assert.equal(r.status,200,url);return r.text();};
const live=JSON.parse(await get('https://rankingdacompra.com.br/informational-catalogue.json')),byId=new Map(live.products.map(p=>[p.id,p]));
const baseline=await json(out+'invariantes-triagem24.json');
const pages=[],descriptions=new Map();
for(const id of ids){const p=localById.get(id);assert.deepEqual(byId.get(id),p,'live mismatch '+id);const h=await get(p.url);assert.match(h,/<h1\b/);const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});const article=nodes.find(n=>n['@type']==='Article');assert.equal(article.about.name,p.title);descriptions.set(id,article.description);const affiliates=[...h.matchAll(/<a\b[^>]*\bid=["']((?:mobile-)?affiliate-offer(?:-shopee)?)["'][^>]*>/g)].map(m=>[m[1],m[0].match(/href=["']([^"']+)/)?.[1]]).sort();assert.deepEqual(affiliates,baseline.pages.find(p=>p.id===id).affiliate);pages.push({id,url:p.url,http:200,title:p.title,affiliatesPreserved:true});}
for(const p of before.products.filter(p=>!ids.includes(p.id)))assert.deepEqual(byId.get(p.id),p,'unrelated live change '+p.id);
const search=JSON.parse(await get('https://rankingdacompra.com.br/search-index.json'));
for(const id of ids){const p=localById.get(id),found=search.products.find(x=>x.id===id);assert.equal(found.title,p.title);assert.equal(found.summary,descriptions.get(id),'live search/Article summary mismatch '+id);}
const liveV=JSON.parse(await get('https://rankingdacompra.com.br/vitrine-publica.json'));
const protectedData=liveV.products.map(p=>Object.fromEntries(Object.entries(p).filter(([k])=>/^(?:id$|foto$|link|preco|promocao|oferta|conferencia|quarentena|anuncioSubstituido)/i.test(k)))).sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(protectedData,baseline.protectedData);
const xml=await get('https://rankingdacompra.com.br/sitemap.xml'),urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]).sort();assert.deepEqual(urls,baseline.urls);
const proof={at:new Date().toISOString(),products:live.products.length,sitemapUrls:urls.length,protectedRecords:protectedData.length,changedIds:ids,unchangedProducts:before.products.length-ids.length,deepReviews:live.products.filter(p=>p.decisionBrief?.reviewed).length,pages,noFirestoreEditorial:true};assert.equal(proof.deepReviews,98);
await writeFile(out+'verificacao-publicada-triagem24.json',JSON.stringify(proof,null,2)+'\n');
const progress=refreshLedger(local,await json('docs/site-improvement-progress.json'));
for(const d of manifest.items){const i=progress.items.find(x=>x.id===d.id);i.status=d.decision;i.lastCompletedAt=proof.at;i.workNotes=[d.reason,d.sourceLimit,'Targeted necessary correction only, not a new deep review.'];i.sourceLinks=d.sourceLinks;}
progress.counts=progress.items.reduce((a,p)=>{a[p.status]=(a[p.status]||0)+1;return a},{total:progress.items.length});
progress.triage24={status:'published_verified',verifiedAt:proof.at,changedIds:ids,newDeepReviews:0,proof:'outputs/melhorias-integrais-20261030/verificacao-publicada-triagem24.json',remainingDependencies:manifest.items.map(p=>({id:p.id,note:p.sourceLimit}))};
progress.editorialPriority.nextPendingIds=progress.editorialPriority.nextPendingIds.filter(id=>progress.items.find(p=>p.id===id)?.status==='pending');
await writeFile('docs/site-improvement-progress.json',JSON.stringify(progress,null,2)+'\n');
console.log(JSON.stringify({proof,counts:progress.counts,next:progress.editorialPriority.nextPendingIds[0]}));
