(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RDCAffiliateLinkProgress=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const keyOK=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}:mercado_livre$/.test(value);
 const fingerprintOK=value=>value===''||typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const limits=['10','20','50','100','all'];
 function restore(value,day){
  if(!value||value.version!==1||value.day!==day||!Array.isArray(value.queue)||value.queue.length>3000||!Number.isInteger(value.cursor)||value.cursor<0||value.cursor>value.queue.length||!limits.includes(value.limit)||typeof value.repeat!=='boolean'||!['running','paused','complete'].includes(value.state))return null;
  const seen=new Set();for(const ref of value.queue){if(!ref||!keyOK(ref.key)||!fingerprintOK(ref.fingerprint)||seen.has(ref.key))return null;seen.add(ref.key);}
  return {version:1,day,limit:value.limit,repeat:value.repeat,queue:value.queue.map(ref=>({key:ref.key,fingerprint:ref.fingerprint})),cursor:value.cursor,state:value.cursor===value.queue.length?'complete':'paused',reason:['security','login','communication','manual'].includes(value.reason)?value.reason:'manual'};
 }
 function create(rows,{day,limit='20',repeat=false,finished=()=>false,result=()=>null}={}){
  const chosen=limits.includes(String(limit))?String(limit):'20';
  // With no saved cursor (including an upgrade), resume a security stop first,
  // then untouched items. Inconclusive reads go after them, not back to the front.
  const rank=row=>['security','login'].includes(result(row)?.status)?0:!result(row)?1:2;
  const pending=rows.filter(row=>keyOK(row.key)&&fingerprintOK(row.fingerprint)&&(repeat||!finished(row))).map((row,index)=>({row,index})).sort((a,b)=>rank(a.row)-rank(b.row)||a.index-b.index).map(x=>x.row);
  const selected=pending.slice(0,chosen==='all'?3000:Number(chosen));
  return {version:1,day,limit:chosen,repeat:repeat===true,queue:selected.map(row=>({key:row.key,fingerprint:row.fingerprint})),cursor:0,state:selected.length?'running':'complete',reason:''};
 }
 const resumable=p=>!!p&&p.cursor<p.queue.length&&p.state!=='complete';
 function next(p,rows,finished=()=>false){
  const byKey=new Map(rows.map(row=>[row.key,row]));
  while(p.cursor<p.queue.length){const ref=p.queue[p.cursor],row=byKey.get(ref.key);
   // A changed/deleted record is never queried using its old saved reference.
   // It remains eligible as a fresh pending item after this round finishes.
   if(!row||row.fingerprint!==ref.fingerprint||!p.repeat&&finished(row)){p.cursor++;continue;}
   return row;
  }
  p.state='complete';p.reason='';return null;
 }
 function advance(p){if(p.cursor<p.queue.length)p.cursor++;p.state=p.cursor===p.queue.length?'complete':'running';p.reason='';}
 function pause(p,reason='manual'){if(!resumable(p))return;p.state='paused';p.reason=['security','login','communication','manual'].includes(reason)?reason:'manual';}
 // Pacing never changes the cursor, availability evidence or saved products.
 function pacing(result,previous={}){
  const mode=previous.mode==='careful'?'careful':'adaptive';
  const slow=Number.isInteger(previous.slow)?Math.max(0,Math.min(3,previous.slow)):0;
  const clean=Number.isInteger(previous.clean)?Math.max(0,Math.min(19,previous.clean)):0;
  if(['security','login'].includes(result?.status))return {mode,slow:3,clean:0,wait:0};
  if(!['available','unavailable'].includes(result?.status))return {mode,slow:3,clean:0,wait:10000};
  if(result.elapsedMs>=15000)return {mode,slow:3,clean:0,wait:5000};
  if(slow)return {mode,slow:slow-1,clean:0,wait:5000};
  if(clean>=19)return {mode,slow:0,clean:0,wait:5000};
  return {mode,slow:0,clean:clean+1,wait:mode==='careful'?5000:2000};
 }
 return {restore,create,resumable,next,advance,pause,pacing};
});
