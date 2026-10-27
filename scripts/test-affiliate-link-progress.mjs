import test from 'node:test';
import assert from 'node:assert/strict';
import progress from '../affiliate-link-progress.js';
const day='2026-10-27';
const rows=['inconclusive','confirmed','challenge','later'].map((id,i)=>({key:id+':mercado_livre',fingerprint:String(i).repeat(64)}));
test('CAPTCHA preserva o cursor: inconclusivos e concluídos anteriores não são repetidos na retomada',()=>{
 const p=progress.create(rows,{day,limit:'all'}),seen=[];
 seen.push(progress.next(p,rows).key);progress.advance(p);seen.push(progress.next(p,rows).key);progress.advance(p);
 assert.equal(progress.next(p,rows).key,'challenge:mercado_livre');progress.pause(p,'security');assert.equal(p.cursor,2);
 const restored=progress.restore(JSON.parse(JSON.stringify(p)),day);assert.equal(restored.cursor,2);assert.equal(progress.next(restored,rows).key,'challenge:mercado_livre');progress.pause(restored,'security');assert.equal(restored.cursor,2);
 progress.advance(restored);assert.equal(progress.next(restored,rows).key,'later:mercado_livre');progress.advance(restored);assert.equal(progress.next(restored,rows),null);assert.equal(restored.state,'complete');assert.deepEqual(seen,['inconclusive:mercado_livre','confirmed:mercado_livre']);
});
test('uma atualização sem cursor começa pelo bloqueio existente, não pelas leituras inconclusivas',()=>{
 const states=new Map([[rows[0].key,{status:'unverified'}],[rows[1].key,{status:'available'}],[rows[2].key,{status:'security'}]]);
 const p=progress.create(rows,{day,limit:'all',result:row=>states.get(row.key),finished:row=>states.get(row.key)?.status==='available'});
 assert.deepEqual(p.queue.map(x=>x.key),['challenge:mercado_livre','later:mercado_livre','inconclusive:mercado_livre']);
});
test('limite e ordem ficam congelados na rodada; pausa manual não zera a posição',()=>{
 const p=progress.create(rows,{day,limit:'10',repeat:true});progress.advance(p);progress.pause(p);assert.equal(p.cursor,1);assert.equal(p.repeat,true);
 const recovered=progress.restore({...p,state:'running',limit:'10'},day);assert.equal(recovered.state,'paused');assert.equal(recovered.cursor,1);assert.deepEqual(recovered.queue,p.queue);
});
test('link alterado, exclusão e confirmação concorrente não consultam a referência velha',()=>{
 const p=progress.create(rows,{day,limit:'all'}),updated=rows.map(x=>({...x}));updated[0].fingerprint='f'.repeat(64);updated.splice(1,1);
 assert.equal(progress.next(p,updated,row=>row.key==='challenge:mercado_livre').key,'later:mercado_livre');assert.equal(p.cursor,3);
 const fresh=progress.create(updated,{day,limit:'all'});assert.equal(progress.next(fresh,updated).fingerprint,'f'.repeat(64));
});
test('checkpoint não armazena URLs, tokens ou preços e recusa posições e dias inválidos',()=>{
 const p=progress.create(rows.map(x=>({...x,affiliateUrl:'https://meli.la/private',token:'SECRET',preco:100})),{day,limit:'all'});assert.doesNotMatch(JSON.stringify(p),/SECRET|meli\.la|preco|affiliateUrl/);
 for(const bad of [{...p,cursor:-1},{...p,cursor:99},{...p,day:'2026-10-26'},{...p,limit:'Infinity'},{...p,queue:[{key:'bad://example',fingerprint:''}]},{...p,queue:[p.queue[0],p.queue[0]]}])assert.equal(progress.restore(bad,day),null);
});
