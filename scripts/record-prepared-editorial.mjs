// Local checkpoint only. Publication is a separate, guarded live verification.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {refreshLedger} from './site-improvement-ledger.mjs';
import {parseReleaseBatches,combinedEditorialManifest,assertTitleAndNeutralFamilyChange} from './editorial-release-plan.mjs';
const out='../../outputs/melhorias-integrais-20261030/';
const json=async f=>JSON.parse(await readFile(f,'utf8'));
const current=parseReleaseBatches(process.argv[2]);assert.equal(current.length,1);
const batch=current[0],date=process.argv[3];assert.match(date||'',/^\d{8}$/);
const old=await json('docs/site-improvement-progress.json'),previousBatches=old.preparedRelease?.batches||[];
assert.ok(!previousBatches.includes(batch),'Do not checkpoint a completed preparation again.');
if(previousBatches.length)assert.equal(old.preparedRelease.manifestDate,date,'Mixed manifest dates need an explicit release plan.');
const batches=parseReleaseBatches([...previousBatches,batch].join(','));
const manifests=await Promise.all(batches.map(n=>json('docs/targeted-triage'+n+'-'+date+'.json'))),manifest=manifests.at(-1),combined=combinedEditorialManifest(manifests);
const before=await json(out+'catalogo-antes-triagem'+batches[0]+'.json'),batchBefore=await json(out+'catalogo-antes-triagem'+batch+'.json'),c=await json('informational-catalogue.json'),byId=new Map(c.products.map(p=>[p.id,p]));
const preparedIds=combined.items.filter(x=>x.decision==='targeted_correction_complete').map(x=>x.id).sort(),newIds=manifest.items.filter(x=>x.decision==='targeted_correction_complete').map(x=>x.id).sort();
const changed=snapshot=>snapshot.products.filter(x=>JSON.stringify(x)!==JSON.stringify(byId.get(x.id))).map(x=>x.id).sort();
assert.deepEqual(changed(before),preparedIds,'Only queued editorial changes may differ from the original baseline.');assert.deepEqual(changed(batchBefore),newIds);
const stripTitle=p=>Object.fromEntries(Object.entries(p).filter(([k])=>k!=='title'));
for(const id of combined.preserveExceptTitleIds)assert.deepEqual(stripTitle(byId.get(id)),stripTitle(before.products.find(p=>p.id===id)),'Do not redo prior facts '+id);
for(const id of combined.preserveExceptTitleAndNeutralFamilyIds)assertTitleAndNeutralFamilyChange(before.products.find(p=>p.id===id),byId.get(id));
for(const r of manifest.items.filter(x=>x.decision==='screened_no_change'))assert.deepEqual(byId.get(r.id),batchBefore.products.find(x=>x.id===r.id));
assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
const baseline=await json(out+'invariantes-triagem'+batch+'.json'),v=await json('vitrine-publica.json');
const protectedData=v.products.map(p=>Object.fromEntries(Object.entries(p).filter(([k])=>/^(?:id$|foto$|link|preco|promocao|oferta|conferencia|quarentena|anuncioSubstituido)/i.test(k)))).sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(protectedData,baseline.protectedData);
const xml=await readFile('sitemap.xml','utf8'),urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]).sort();assert.deepEqual(urls,baseline.urls);
const qa=JSON.parse((await readFile(out+'qa-triagem'+batch+'.log','utf8')).trim());assert.equal(qa.checked.length,manifest.items.length*2);assert.ok(qa.checked.every(x=>x.passed));
const tests=await readFile(out+'testes-triagem'+batch+'.log','utf8');assert.match(tests,/ℹ fail 0/);const testsPassed=Number(tests.match(/ℹ pass (\d+)/)?.[1]);assert.ok(testsPassed>=1326);
const p=refreshLedger(c,old),at=new Date().toISOString();
for(const id of old.preparedRelease?.ids||[])assert.equal(p.items.find(x=>x.id===id).status,'prepared_awaiting_publication','Do not repeat or overwrite prior prepared content.');
for(const r of manifest.items){const i=p.items.find(x=>x.id===r.id);assert.equal(i.status,'pending','Only new pending IDs may be assessed.');assert.ok(!i.previousReviewPresent);i.workNotes=[r.reason,r.sourceLimit];i.sourceLinks=r.sourceLinks;
 if(r.decision==='targeted_correction_complete'){i.status='prepared_awaiting_publication';i.lastCompletedAt=null;i.preparedAt=at;i.preparedBatch=batch;i.workNotes.push('Prepared locally only; production verification is still required.');}
 else {assert.equal(r.decision,'screened_no_change');i.status='screened_no_change';i.lastCompletedAt=at;}
}
p.counts=p.items.reduce((a,x)=>{a[x.status]=(a[x.status]||0)+1;return a},{total:p.items.length});
const verificationCommand='node scripts/verify-targeted-editorial.mjs '+batches.join(',')+' '+date;
const proof={at,status:'prepared_awaiting_publication',batches,preparedIds,newPreparedIds:newIds,screenedNoChangeIds:manifest.items.filter(x=>x.decision==='screened_no_change').map(x=>x.id),newDeepReviews:0,products:c.products.length,protectedRecords:protectedData.length,sitemapUrls:urls.length,unchangedOutsideRelease:c.products.length-preparedIds.length,protectedDeepReviews:98,testsPassed,staticMobileChecks:qa.checked.length,verificationCommand,productionVerified:false,publicationAttempted:false,noFirestoreEditorial:true};
await writeFile(out+'verificacao-local-triagem'+batch+'.json',JSON.stringify(proof,null,2)+'\n');
p['triage'+batch]={...proof,proof:'outputs/melhorias-integrais-20261030/verificacao-local-triagem'+batch+'.json',remainingDependencies:manifest.items.map(x=>({id:x.id,note:x.sourceLimit}))};
p.preparedRelease={...old.preparedRelease,status:'awaiting_github_pages_release',batches,manifestDate:date,ids:preparedIds,verificationCommand,doNotRepeatReviews:true};
const traffic=await json(out+'ga4-prioridade-visualizacoes-20261031.json'),views=new Map();for(const row of traffic.response.data){const id=row.page_path.match(/^\/produto\/([^/]+)-20260810-1\.html$/)?.[1];if(id)views.set(id,(views.get(id)||0)+Number(row.screen_page_views));}
p.editorialPriority.nextPendingIds=p.items.filter(x=>x.status==='pending').sort((a,b)=>(views.get(b.id)||0)-(views.get(a.id)||0)||a.id.localeCompare(b.id)).slice(0,8).map(x=>x.id);
await writeFile('docs/site-improvement-progress.json',JSON.stringify(p,null,2)+'\n');
console.log(JSON.stringify({proof,counts:p.counts,next:p.editorialPriority.nextPendingIds.slice(0,3).map(id=>({id,title:p.items.find(x=>x.id===id).title}))}));
