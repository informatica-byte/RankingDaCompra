import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {refreshLedger} from './site-improvement-ledger.mjs';
const out='../../outputs/melhorias-integrais-20261030/',mode=process.argv[2];
const batch=process.argv[3]||'39';assert.match(batch,/^\d+$/);
const json=async f=>JSON.parse(await readFile(f,'utf8'));
const files=['historico-precos.json','historico-precos-indice.json'];
const hash=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
if(mode==='before'){
 for(const [a,b]of [['informational-catalogue.json',`catalogo-antes-triagem${batch}.json`],['vitrine-publica.json','vitrine-antes.json']])await writeFile(out+b,await readFile(a));
 await writeFile(out+`historicos-triagem${batch}.json`,JSON.stringify(await hash()));
}else if(mode==='prepare'){
 assert.deepEqual(await hash(),await json(out+`historicos-triagem${batch}.json`));
 const c=await json('informational-catalogue.json'),before=await json(out+`catalogo-antes-triagem${batch}.json`),m=await json(`docs/targeted-triage${batch}-20261101.json`);
 const changed=m.items.filter(x=>x.decision==='targeted_correction_complete').map(x=>x.id).sort(),byId=new Map(c.products.map(x=>[x.id,x]));
 assert.deepEqual(before.products.filter(x=>JSON.stringify(x)!==JSON.stringify(byId.get(x.id))).map(x=>x.id).sort(),changed);
 const old=await json('docs/site-improvement-progress.json'),p=refreshLedger(c,old);
 for(const r of m.items){assert.equal(old.items.find(x=>x.id===r.id).status,'pending');const x=p.items.find(x=>x.id===r.id);x.status=r.decision==='screened_no_change'?r.decision:'prepared_awaiting_publication';x.workNotes=[r.reason,r.sourceLimit];x.sourceLinks=r.sourceLinks;if(x.status==='screened_no_change')x.lastCompletedAt=new Date().toISOString();}
 for(const prior of old.items.filter(x=>['targeted_correction_complete','preserve_prior_review'].includes(x.status)))assert.deepEqual(p.items.find(x=>x.id===prior.id),prior);
 p.counts=p.items.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{total:p.items.length});
 p['triage'+batch]={status:'prepared_awaiting_publication',ids:changed,newDeepReviews:0};
 await writeFile('docs/site-improvement-progress.json',JSON.stringify(p,null,2)+'\n');console.log(JSON.stringify({changed,counts:p.counts}));
}else throw Error('before|prepare required');
