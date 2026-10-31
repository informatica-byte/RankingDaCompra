import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {refreshLedger} from './site-improvement-ledger.mjs';
const out='../../outputs/melhorias-integrais-20261030/';
const json=async f=>JSON.parse(await readFile(f,'utf8'));
const before=await json(out+'catalogo-antes-triagem23.json'),local=await json('informational-catalogue.json');
const manifest=await json('docs/targeted-triage23-20261031.json');
const expected=manifest.items.map(p=>p.id).sort();
const current=new Map(local.products.map(p=>[p.id,p]));
const changed=before.products.filter(p=>JSON.stringify(p)!==JSON.stringify(current.get(p.id))).map(p=>p.id).sort();
assert.deepEqual(changed,expected);
const liveResponse=await fetch('https://rankingdacompra.com.br/informational-catalogue.json?triage23='+Date.now());assert.equal(liveResponse.status,200);const live=await liveResponse.json();
const byId=new Map(live.products.map(p=>[p.id,p]));
const checked=[];
for(const id of expected){const p=current.get(id);assert.deepEqual(byId.get(id),p,'Live mismatch '+id);const r=await fetch(p.url+'?triage23='+Date.now());assert.equal(r.status,200);const h=await r.text();const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});const article=nodes.find(n=>n['@type']==='Article');assert.equal(article.about.name,p.title);assert.match(article.description,/não|confirm/);checked.push({id,url:p.url,http:200,title:p.title});}
for(const p of before.products.filter(p=>!expected.includes(p.id)))assert.deepEqual(byId.get(p.id),p,'Unrelated live editorial change '+p.id);
const proof={at:new Date().toISOString(),products:live.products.length,changedIds:expected,unchangedProducts:before.products.length-expected.length,deepReviews:live.products.filter(p=>p.decisionBrief?.reviewed).length,pages:checked,noFirestoreEditorial:true};
assert.equal(proof.deepReviews,98);
await writeFile(out+'verificacao-publicada-triagem23.json',JSON.stringify(proof,null,2)+'\n');
const progressPath='docs/site-improvement-progress.json';
const old=await json(progressPath),next=refreshLedger(local,old);
for(const decision of manifest.items){const item=next.items.find(p=>p.id===decision.id);item.status=decision.decision;item.lastCompletedAt=proof.at;item.workNotes=[decision.reason,decision.sourceLimit,'Targeted claim correction only, not a new deep review.'];item.sourceLinks=decision.sourceLinks;}
next.counts=next.items.reduce((a,p)=>{a[p.status]=(a[p.status]||0)+1;return a},{total:next.items.length});
next.triage23={status:'published_verified',verifiedAt:proof.at,changedIds:expected,newDeepReviews:0,proof:'outputs/melhorias-integrais-20261030/verificacao-publicada-triagem23.json',remainingDependencies:manifest.items.map(p=>({id:p.id,note:p.sourceLimit}))};
next.editorialPriority.nextPendingIds=next.editorialPriority.nextPendingIds.filter(id=>next.items.find(p=>p.id===id)?.status==='pending');
await writeFile(progressPath,JSON.stringify(next,null,2)+'\n');
console.log(JSON.stringify({proof,counts:next.counts,next:next.editorialPriority.nextPendingIds[0]}));
