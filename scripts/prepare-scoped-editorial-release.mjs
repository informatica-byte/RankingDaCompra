import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {affiliateLinks} from './informational-site.mjs';
import {guidance} from './local-purchase-guidance.mjs';

const [base,generated]=process.argv.slice(2).map(p=>path.resolve(p));
assert.ok(base&&generated&&base!==generated&&!fs.existsSync(path.join(base,'.git')),'Use uma cópia isolada da base, sem .git');
const novante='UkgpEmnU2nSDUmOujW6W', paused='H3AOP8Gxqhtn1TcPX2Ug';
const live=new Set([...Object.keys(guidance),novante]);
const authorizedLinks=new Set(['EmrdwlcDgCCM5suoz8dB','NQAtVQKwZQtKxXtEn21Q','UNQtBcYJ9obcCPWURmeq']);
const relative=id=>'produto/'+id+'-20260810-1.html';
const read=(root,file)=>fs.readFileSync(path.join(root,file),'utf8');
const pending=new Map();
for(const id of [...live,paused]){
 const file=relative(id), old=read(base,file), next=read(generated,file);
 if(id===paused){
  assert.match(next,/<meta name="rdc-paused-product" content="true">/);
  assert.equal(affiliateLinks(next).length,0);
 }else{
  assert.ok(next.includes(Object.hasOwn(guidance,id)?'data-local-purchase-guidance="'+id+'"':'data-reviewed-depth="'+id+'"'));
  if(!authorizedLinks.has(id))assert.deepEqual(affiliateLinks(next),affiliateLinks(old),id);
 }
 pending.set(file,next);
}
for(const file of ['informational-catalogue.json','search-index.json','vitrine-publica.json']){
 const old=JSON.parse(read(base,file)), next=JSON.parse(read(generated,file));
 const records=new Map(next.products.map(p=>[p.id,p]));
 for(const id of live)assert.ok(records.has(id)&&old.products.some(p=>p.id===id),id);
 assert.ok(!records.has(paused));
 old.products=old.products.filter(p=>p.id!==paused).map(p=>live.has(p.id)?records.get(p.id):p);
 if(Array.isArray(old.selected))old.selected=old.selected.filter(id=>id!==paused);
 pending.set(file,JSON.stringify(old)+'\n');
}
const sitemap=read(base,'sitemap.xml');
const entries=[...sitemap.matchAll(/^[ \t]*<url>[\s\S]*?<\/url>\r?\n/gm)];
const removed=entries.filter(([block])=>block.includes('<loc>https://rankingdacompra.com.br/'+relative(paused)+'</loc>'));
assert.equal(removed.length,1);
pending.set('sitemap.xml',sitemap.replace(removed[0][0],''));
const pausedUrl='https://rankingdacompra.com.br/'+relative(paused);
for(const file of ['analises.html','melhores-esporte-e-lazer.html']){
 const source=read(base,file);
 let removedCards=0,removedItems=0;
 let result=source.replace(/<article\b[^>]*>[\s\S]*?<\/article>/gi,card=>{
  if(!card.includes('href="'+pausedUrl+'"'))return card;
  removedCards++;
  return '';
 }).replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,(whole,start,raw,end)=>{
  const tree=JSON.parse(raw);
  let touched=false;
  function visit(node){
   if(!node||typeof node!=='object')return;
   for(const value of Object.values(node))visit(value);
   if(!Array.isArray(node.itemListElement))return;
   const next=node.itemListElement.filter(item=>item.url!==pausedUrl);
   if(next.length===node.itemListElement.length)return;
   removedItems+=node.itemListElement.length-next.length;
   node.itemListElement=next.map((item,i)=>({...item,position:i+1}));
   if(Number.isInteger(node.numberOfItems))node.numberOfItems=next.length;
   touched=true;
  }
  visit(tree);
  return touched?start+JSON.stringify(tree).replace(/</g,'\\u003c')+end:whole;
 });
 assert.equal(removedCards,1,file);assert.equal(removedItems,1,file);
 if(file==='analises.html')result=result.replace(/(>)(\d+)( análises publicadas<)/,(_m,a,n,b)=>a+(Number(n)-1)+b);
 assert.ok(!result.includes(pausedUrl),file);
 pending.set(file,result);
}
for(const [file,value] of pending)fs.writeFileSync(path.join(base,file),value);
console.log(JSON.stringify({updated:[...live],paused,files:[...pending.keys()]}));
