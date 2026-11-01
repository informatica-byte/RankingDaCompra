// Local-only checkpoint: never mark unserved editorial changes as published.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {refreshLedger} from './site-improvement-ledger.mjs';
import {combinedEditorialManifest,assertTitleAndNeutralFamilyChange} from './editorial-release-plan.mjs';
const out='../../outputs/melhorias-integrais-20261030/';
const json=async f=>JSON.parse(await readFile(f,'utf8'));
const c=await json('informational-catalogue.json'),old=await json('docs/site-improvement-progress.json');
const batches=[34,35],manifests=await Promise.all(batches.map(n=>json('docs/targeted-triage'+n+'-20261101.json'))),combined=combinedEditorialManifest(manifests);
const before=await json(out+'catalogo-antes-triagem34.json'),latest=new Map(c.products.map(p=>[p.id,p]));
const preparedIds=combined.items.filter(p=>p.decision==='targeted_correction_complete').map(p=>p.id).sort();
assert.deepEqual(before.products.filter(p=>JSON.stringify(p)!==JSON.stringify(latest.get(p.id))).map(p=>p.id).sort(),preparedIds,'Only the queued release may differ from the published baseline.');
const batch35=await json(out+'catalogo-antes-triagem35.json'),ids35=manifests[1].items.map(p=>p.id).sort();
assert.deepEqual(batch35.products.filter(p=>JSON.stringify(p)!==JSON.stringify(latest.get(p.id))).map(p=>p.id).sort(),ids35);
for(const id of manifests[1].preserveExceptTitleIds){const strip=p=>Object.fromEntries(Object.entries(p).filter(([k])=>k!=='title'));assert.deepEqual(strip(latest.get(id)),strip(batch35.products.find(p=>p.id===id)),'Do not redo the prior headphone body '+id);}
for(const id of manifests[1].preserveExceptTitleAndNeutralFamilyIds)assertTitleAndNeutralFamilyChange(batch35.products.find(p=>p.id===id),latest.get(id));
assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
const qa=JSON.parse((await readFile(out+'qa-triagem35.log','utf8')).trim());assert.equal(qa.checked.length,8);assert.ok(qa.checked.every(x=>x.passed));
const tests=await readFile(out+'testes-triagem35.log','utf8');assert.match(tests,/ℹ fail 0/);const testsPassed=Number(tests.match(/ℹ pass (\d+)/)?.[1]);assert.ok(testsPassed>=1325);
const p=refreshLedger(c,old),at=new Date().toISOString();
for(const [index,n] of batches.entries())for(const record of manifests[index].items.filter(p=>p.decision==='targeted_correction_complete')){
 const item=p.items.find(x=>x.id===record.id);assert.ok(!item.previousReviewPresent);item.status='prepared_awaiting_publication';item.lastCompletedAt=null;item.preparedAt=at;item.preparedBatch=n;item.workNotes=[record.reason,record.sourceLimit,'Prepared locally only; do not repeat review or mark published until joint production verification.'];item.sourceLinks=record.sourceLinks;
}
p.counts=p.items.reduce((a,x)=>{a[x.status]=(a[x.status]||0)+1;return a},{total:p.items.length});
const verificationCommand='node scripts/verify-targeted-editorial.mjs 34,35 20261101';
const proof={at,status:'prepared_awaiting_publication',newDeepReviews:0,batches,preparedIds,newPreparedIds:ids35,products:c.products.length,unchangedOutsideRelease:before.products.length-preparedIds.length,protectedDeepReviews:98,testsPassed,staticMobileChecks:qa.checked.length,headphoneBodiesUnchanged:[...manifests[1].preserveExceptTitleIds,...manifests[1].preserveExceptTitleAndNeutralFamilyIds],neutralFamilyIds:manifests[1].preserveExceptTitleAndNeutralFamilyIds,verificationCommand,productionVerified:false,publicationAttempted:false,noFirestoreEditorial:true};
await writeFile(out+'verificacao-local-triagem35.json',JSON.stringify(proof,null,2)+'\n');
p.triage35={...proof,proof:'outputs/melhorias-integrais-20261030/verificacao-local-triagem35.json',remainingDependencies:manifests[1].items.map(x=>({id:x.id,note:x.sourceLimit}))};
p.preparedRelease={status:'awaiting_github_pages_release',batches,manifestDate:'20261101',ids:preparedIds,verificationCommand,supportTicket:'4935458',doNotRepeatReviews:true};
const traffic=await json(out+'ga4-prioridade-visualizacoes-20261031.json'),views=new Map();for(const row of traffic.response.data){const id=row.page_path.match(/^\/produto\/([^/]+)-20260810-1\.html$/)?.[1];if(id)views.set(id,(views.get(id)||0)+Number(row.screen_page_views));}
p.editorialPriority.nextPendingIds=p.items.filter(x=>x.status==='pending').sort((a,b)=>(views.get(b.id)||0)-(views.get(a.id)||0)||a.id.localeCompare(b.id)).slice(0,8).map(x=>x.id);
await writeFile('docs/site-improvement-progress.json',JSON.stringify(p,null,2)+'\n');
console.log(JSON.stringify({proof,counts:p.counts,next:p.editorialPriority.nextPendingIds.slice(0,3).map(id=>({id,title:p.items.find(x=>x.id===id).title}))}));
