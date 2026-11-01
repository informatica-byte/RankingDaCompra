// Records a verified deployment failure; it does not mark unserved content complete.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const out='../../outputs/melhorias-integrais-20261030/';
const json=async f=>JSON.parse(await readFile(f,'utf8'));
const before=await json(out+'catalogo-antes-triagem34.json');
const response=await fetch('https://rankingdacompra.com.br/informational-catalogue.json?triage34blocked='+Date.now());assert.equal(response.status,200);
const live=await response.json();assert.deepEqual(live.products,before.products,'Public content changed; reassess instead of recording the old blocker.');
const runResponse=await fetch('https://api.github.com/repos/informatica-byte/RankingDaCompra/actions/runs/41291112610?checkpoint='+Date.now());assert.equal(runResponse.status,200);const run=await runResponse.json();assert.equal(run.conclusion,'failure');assert.equal(run.run_attempt,3);
const manifest=await json('docs/targeted-triage34-20261101.json'),p=await json('docs/site-improvement-progress.json'),at=new Date().toISOString();
const pc=manifest.items.find(x=>x.id==='YdPOVmrHVJ8EO7fmgyXu'),record=p.items.find(x=>x.id===pc.id);assert.equal(record.status,'pending');record.status='screened_no_change';record.lastCompletedAt=at;record.workNotes=[pc.reason,pc.sourceLimit,'Local and live product content remain identical; no rewrite needed.'];record.sourceLinks=[];
const fragrance=p.items.find(x=>x.id==='w4grNjrGMy69omEzW0QP');assert.equal(fragrance.status,'pending');fragrance.workNotes=['Editorial correction prepared and committed in b6c771d57 / generated 7c559fb66; not served yet. Do not redo the review or claim it published.', 'Resume only the failed Pages deployment after the stale eed0e63ca lock is resolved, then run node scripts/verify-targeted-editorial.mjs 34 20261101.'];fragrance.sourceLinks=manifest.items[0].sourceLinks;
const proof={at,status:'awaiting_publication',sourceCommit:'b6c771d57',generatedCommit:'7c559fb66a4d2148fcda70a8a3a8effaf6551e4a',testsPassed:1314,integrityRun:41291080447,sitemapRun:41291080436,pagesRun:41291112610,pagesAttempts:3,failedDeployJobs:[124802504373,124802884624,124803174930],blocker:'GitHub Pages HTTP 400: in progress deployment eed0e63ca55604f4df531cbc04b0f23f155f6ab2, although that earlier Actions run is completed/success. No cancellation control exposed in inspected deployments/Pages UI.',liveCatalogueStillPrevious:true,liveProductsUnchanged:live.products.length,protectedDeepReviews:98,preparedId:fragrance.id,screenedNoChangeId:pc.id,screenshot:'outputs/melhorias-integrais-20261030/pages-bloqueio-triagem34.png',nextEditorialIdAfterPublication:'cjtpmssewHcTpdqJlbS6'};
await writeFile(out+'verificacao-parcial-triagem34.json',JSON.stringify(proof,null,2)+'\n');
p.updatedAt=at;p.counts=p.items.reduce((a,x)=>{a[x.status]=(a[x.status]||0)+1;return a},{total:p.items.length});p.triage34={...proof,proof:'outputs/melhorias-integrais-20261030/verificacao-parcial-triagem34.json',newDeepReviews:0,resume:'Do not edit the two records again. Resolve stale Pages deployment and retry only latest deploy, then verify-targeted-editorial.mjs 34 20261101 before marking Nayef complete.'};
p.editorialPriority.nextPendingIds=p.editorialPriority.nextPendingIds.filter(id=>id!==pc.id);
await writeFile('docs/site-improvement-progress.json',JSON.stringify(p,null,2)+'\n');
console.log(JSON.stringify({at,counts:p.counts,status:p.triage34.status,next:p.editorialPriority.nextPendingIds[0]}));
