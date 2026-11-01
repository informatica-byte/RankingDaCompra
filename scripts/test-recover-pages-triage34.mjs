import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {recover,REPO,STALE,PREPARED} from './recover-pages-triage34.mjs';
const run={status:200,body:{head_sha:PREPARED,status:'completed',conclusion:'failure'}};
test('recuperação só cancela o SHA antigo fixado, sem regenerar site ou expor token',async()=>{
 const calls=[];let i=0;const responses=[run,{status:200,body:{status:'succeed'}},{status:204},{status:200,body:{status:'canceled'}}];
 const result=await recover({repository:REPO,request:async(...args)=>{calls.push(args);return responses[i++];}});
 assert.equal(result.action,'cancel_accepted');assert.equal(calls.length,4);assert.equal(calls[2][0],'https://api.github.com/repos/'+REPO+'/pages/deployments/'+STALE+'/cancel');assert.equal(calls[2][1],'POST');assert.equal(calls.filter(x=>x[1]!=='GET').length,1);assert.equal(calls[0][2],false);assert.doesNotMatch(JSON.stringify(result),/token|secret|Bearer/i);
});
test('outro repositório, outra revisão ou revisão bem-sucedida impedem cancelamento',async()=>{
 await assert.rejects(recover({repository:'outro/repo',request:()=>assert.fail('no request')}));
 for(const body of [{...run.body,head_sha:'different'},{...run.body,conclusion:'success'},{...run.body,status:'in_progress'}]){let calls=0;await assert.rejects(recover({repository:REPO,request:async()=>{calls++;return {status:200,body};}}));assert.equal(calls,1);}
});
test('estado desconhecido ou leitura negada não cancela nada; já cancelado é idempotente',async()=>{
 for(const r of [{status:403,body:{}},{status:404,body:{}},{status:200,body:{status:'unknown_state'}}]){let i=0;await assert.rejects(recover({repository:REPO,request:async()=>++i===1?run:r}));assert.equal(i,2);}
 let i=0;assert.equal((await recover({repository:REPO,request:async()=>++i===1?run:{status:200,body:{status:'canceled'}}})).action,'already_canceled');assert.equal(i,2);
});
test('recuperação encerrada permanece desativada, sem escrita Pages, agenda ou credenciais persistidas',async()=>{
 const y=await readFile(new URL('../.github/workflows/recover-pages-triage34.yml',import.meta.url),'utf8');assert.match(y,/permissions: \{\}/);assert.match(y,/if: \$\{\{ false \}\}/);assert.match(y,/pages: read/);assert.match(y,/persist-credentials: false/);assert.doesNotMatch(y,/pages: write|schedule:|pull_request|id-token:|contents: write|secrets\./);
});
