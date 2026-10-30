import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function refreshLedger(catalogue,previous={}) {
  const old=new Map((previous.items||[]).map(item=>[item.id,item]));
  const items=catalogue.products.map(p=>{
    const fingerprint=digest({title:p.title,summary:p.summary,brief:p.decisionBrief,comparison:p.comparison});
    const prior=old.get(p.id);
    if(prior?.fingerprint===fingerprint)return prior;
    return {id:p.id,url:p.url,title:p.title,fingerprint,
      status:p.decisionBrief?.reviewed?'preserve_prior_review':'pending',
      previousReviewPresent:!!p.decisionBrief?.reviewed,
      lastCompletedAt:null,workNotes:[],sourceLinks:[],
      ...(prior?{previousState:prior.status,changedSinceCheckpoint:true}:{})};
  });
  return {...previous,version:1,scope:'public informational site; no prices, records, affiliates or security rules changed',
    updatedAt:new Date().toISOString(),catalogueGeneratedAt:catalogue.generatedAt,
    modelPolicy:{...previous.modelPolicy,recommended:'GPT-6.1 Sol / Medium',changeOnlyAfterUserConfirmation:true},
    resumeRule:'Skip unchanged completed or previously reviewed items. Reopen only changed content, a new source or a documented defect. A generic rewrite is not a factual review.',
    counts:items.reduce((a,p)=>{a[p.status]=(a[p.status]||0)+1;return a},{total:items.length}),
    items};
}
async function main(){
  const output=resolve(process.argv[2]||'docs/site-improvement-progress.json');
  const catalogue=JSON.parse(await readFile('informational-catalogue.json','utf8'));
  let previous={};try{previous=JSON.parse(await readFile(output,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const next=refreshLedger(catalogue,previous);
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(next,null,2)+'\n');
  console.log(JSON.stringify({output,counts:next.counts}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
