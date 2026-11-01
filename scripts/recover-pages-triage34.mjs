// One-off recovery of the exact stale Pages deployment from the verified incident.
// No deletes, site settings, product writes, builds or credential output.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
export const REPO='informatica-byte/RankingDaCompra';
export const STALE='eed0e63ca55604f4df531cbc04b0f23f155f6ab2';
export const PREPARED='7c559fb66a4d2148fcda70a8a3a8effaf6551e4a';
export async function recover({repository,request}){
 assert.equal(repository,REPO,'Unexpected repository; recovery refused.');
 const base='https://api.github.com/repos/'+REPO;
 const run=await request(base+'/actions/runs/41291112610','GET',false);assert.equal(run.status,200);
 assert.equal(run.body.head_sha,PREPARED,'Do not cancel based on another revision.');
 assert.equal(run.body.status,'completed');assert.equal(run.body.conclusion,'failure');
 const target=base+'/pages/deployments/'+STALE;
 const before=await request(target,'GET',true);assert.equal(before.status,200,'Cannot inspect the exact stale deployment.');
 const state=before.body.status;assert.match(state,/^[a-z_]{1,40}$/,'Unexpected status.');
 console.log(JSON.stringify({phase:'inspected_exact_stale_deployment',sha:STALE,status:state}));
 if(['canceled','cancelled'].includes(state))return {action:'already_canceled',stale:STALE,before:state};
 // Even succeed can be a stale backend lock: the failure log names this exact SHA.
 assert.ok(['succeed','queued','deployment_in_progress','syncing_files','updating_pages','purging_cdn','waiting','pending'].includes(state),'Unknown status; do not mutate.');
 const cancel=await request(target+'/cancel','POST',true);assert.equal(cancel.status,204,'Cancellation not accepted; HTTP '+cancel.status+'; '+String(cancel.body?.message||'No API message')+'; do not change settings as a workaround.');
 const after=await request(target,'GET',true);assert.equal(after.status,200);assert.match(after.body.status,/^[a-z_]{1,40}$/);
 return {action:'cancel_accepted',stale:STALE,before:state,after:after.body.status};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 assert.ok(process.env.GITHUB_TOKEN,'Use only the ephemeral Actions token.');
 const request=async(url,method,auth)=>{
  const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'};
  if(auth)headers.Authorization='Bearer '+process.env.GITHUB_TOKEN;
  const r=await fetch(url,{method,headers,signal:AbortSignal.timeout(20000)});
  let body={};
  if(r.status===200)body=await r.json();
  else if((r.headers.get('content-type')||'').includes('json')){
   const value=await r.json();
   body={message:String(value.message||'').replaceAll(process.env.GITHUB_TOKEN,'[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,240)};
  } else await r.body?.cancel();
  return {status:r.status,body};
 };
 console.log(JSON.stringify(await recover({repository:process.env.GITHUB_REPOSITORY,request})));
}
