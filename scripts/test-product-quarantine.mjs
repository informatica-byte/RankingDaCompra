import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import q from '../product-quarantine.js';
import core from '../affiliate-link-audit.js';
import review from '../affiliate-link-review.js';
const at=Date.parse('2026-10-27T18:00:00Z');
const record=()=>({id:'p',titulo:'Fone JBL Tune 520BT',foto:'https://http2.mlstatic.com/foto.jpg',link:'https://www.mercadolivre.com.br/fone/p/MLB23997257?wid=MLB1234567890',linkAfiliado:'https://meli.la/test',preco:123,precoAnterior:150,comentario:'Análise preservada',conferenciaPausada:false});
function fixture(){
 let current=record(),registry={version:1,ids:['previous']},uid='owner',transactions=0;const time={now:at},writes=[];
 const adapter={authorize:()=>uid,now:()=>time.now,serverNow:async()=>time.now,read:async()=>current,timestamp:()=> 'server-timestamp',invalidate(){},transact:async(_id,work)=>{
  transactions++;const ops=[];const out=await work({read:async()=>current,registry:async()=>{adapter.onRegistry?.();return registry;},update:p=>ops.push(['update',p]),saveRegistry:r=>ops.push(['registry',r]),removeProduct:()=>ops.push(['delete'])});
  for(const [kind,value]of ops){writes.push([kind,value]);if(kind==='update')current={...current,...value};if(kind==='registry')registry=value;if(kind==='delete')current=null;}return out;
 }};
 const api=q.create(adapter);return {api,adapter,time,writes,get current(){return current;},set current(v){current=v;},get registry(){return registry;},set registry(v){registry=v;},get transactions(){return transactions;},set uid(v){uid=v;}};
}
async function enter(f){const p=await f.api.read('p');return f.api.enter('p',p,'QUARENTENA 40 p');}
function check(p,time,status='unavailable'){
 const row=core.request({productId:p.id,title:p.titulo,expectedUrl:p.link,affiliateUrl:p.linkAfiliado});
 const value=core.classify(row,{url:p.link,title:p.titulo,unavailable:status==='unavailable',primaryNotice:true,buyable:status==='available'});return {row,result:{...value,status,checkedAt:time}};
}
test('entrada exige consentimento exato, mantém links/preços/ficha e prazo de 40 dias sem reiniciar',async()=>{
 const f=fixture(),before=structuredClone(f.current),base=await f.api.read('p');
 await assert.rejects(f.api.enter('p',base,'SIM'),/expressamente/);assert.equal(f.transactions,0);
 const saved=await enter(f),s=q.state(saved,at);assert.equal(s.active,true);assert.equal(s.remainingDays,40);assert.equal(s.deadline,at+40*q.DAY);assert.equal(saved.conferenciaPausada,true);
 for(const key of ['preco','precoAnterior','comentario','link','linkAfiliado'])assert.equal(f.current[key],before[key]);
 await assert.rejects(f.api.enter('p',await f.api.read('p'),'QUARENTENA 40 p'),/reiniciado/);assert.equal(f.writes.length,1);
 assert.equal(q.state(saved,at+39*q.DAY).remainingDays,1);assert.equal(q.state(saved,at+40*q.DAY).due,true);
});
test('não entra com link curto original, sem MLB de anúncio, outra loja, produto removido ou sessão ausente',async()=>{
 for(const input of [{link:'https://meli.la/short'},{link:'https://www.mercadolivre.com.br/p/MLB23997257'},{link:'https://shopee.com.br/product/123/456',linkAfiliado:'https://s.shopee.com.br/abc'}]){const f=fixture();f.current={...f.current,...input};await assert.rejects(enter(f));assert.equal(f.writes.length,0);}
 const f=fixture();f.uid='';await assert.rejects(enter(f));assert.equal(f.transactions,0);
});
test('antes do prazo e em falhas não faz consultas ou exclusões; precisa de leitura nova após o prazo',async()=>{
 const f=fixture(),p=await enter(f),count=f.transactions;f.time.now=at+39*q.DAY;
 let c=check(p,f.time.now);assert.equal((await f.api.review(p,c.row,c.result)).action,'waiting');assert.equal(f.transactions,count);
 f.time.now=at+40*q.DAY;assert.equal((await f.api.review(p,c.row,c.result)).action,'held');assert.equal(f.transactions,count);
 for(const status of ['security','login','error','unverified','identity_unconfirmed']){c=check(p,f.time.now,status);assert.equal((await f.api.review(p,c.row,c.result)).action,'held');}
 assert.equal(f.transactions,count);assert.ok(f.current);assert.equal(f.writes.length,1);
});
test('horário do servidor impede antecipar exclusão e erro de data não altera o cadastro',async()=>{
 const f=fixture(),p=await enter(f);f.time.now=at+40*q.DAY+60000;const c=check(p,f.time.now);f.adapter.serverNow=async()=>at+40*q.DAY-1000;
 assert.equal((await f.api.review(p,c.row,c.result)).action,'held');assert.ok(f.current);assert.equal(f.writes.length,1);
 const calls=[];const send=async(...args)=>{calls.push(args);return {ok:true,headers:{get:()=>new Date(at).toUTCString()}};};assert.equal(await q.serverNow(send,()=>at),at);assert.equal(calls[0][1].method,'HEAD');assert.equal(calls[0][1].credentials,'omit');
 await assert.rejects(q.serverNow(async()=>({ok:true,headers:{get:()=>null}}),()=>at),/horário do servidor/);
 await assert.rejects(q.serverNow(send,()=>at+q.DAY),/horário do servidor/);
});
test('40 dias mais nova indisponibilidade do mesmo MLB excluem só o cadastro autorizado e registram limpeza pública',async()=>{
 const f=fixture(),p=await enter(f);f.time.now=at+40*q.DAY+1;const c=check(p,f.time.now),out=await f.api.review(p,c.row,c.result);
 assert.deepEqual(out,{action:'deleted',id:'p',cleanupPending:true});assert.equal(f.current,null);assert.deepEqual(f.registry.ids,['p','previous']);assert.deepEqual(f.writes.map(x=>x[0]),['update','registry','delete']);
});
test('anúncio disponível cancela a quarentena, preservando eventual pausa manual anterior',async()=>{
 for(const previous of [true,false]){const f=fixture();f.current={...f.current,conferenciaPausada:previous};const p=await enter(f);f.time.now+=10*q.DAY;const c=check(p,f.time.now,'available'),out=await f.api.review(p,c.row,c.result);assert.equal(out.action,'returned');assert.equal(out.product.quarentenaAnuncio,undefined);assert.equal(f.current.quarentenaAnuncio,null);assert.equal(f.current.conferenciaPausada,previous);assert.equal(f.current.preco,123);assert.equal(f.registry.ids.includes('p'),false);}
});
test('resultado antigo, outro anúncio/loja, leitura sem vínculo e quarentena inválida jamais excluem',async()=>{
 const f=fixture(),p=await enter(f);f.time.now+=41*q.DAY;const c=check(p,f.time.now),count=f.transactions;
 for(const bad of [{...c.result,checkedAt:f.time.now-120001},{...c.result,checkedAt:f.time.now+10000},{...c.result,productId:'other'},{...c.result,market:'shopee'},{...c.result,inspection:''},{...c.result,robotVersion:'2.4.14'},{...c.result,finalUrl:'https://www.mercadolivre.com.br/fone/p/MLB23997257?wid=MLB9876543210'},{...c.result,finalUrl:'https://www.mercadolivre.com.br/p/MLB23997257'}])assert.equal((await f.api.review(p,c.row,bad)).action,'held');
 assert.equal((await f.api.review({...p,quarentenaAnuncio:{invalid:true}},c.row,c.result)).action,'held');assert.equal(f.transactions,count);assert.ok(f.current);
});
test('troca concorrente, cancelamento, alteração da quarentena, pausa da rodada e registro inválido bloqueiam exclusão',async()=>{
 for(const mode of ['link','foto','cancel','restart','session','stop','registry']){
  const f=fixture(),p=await enter(f);f.time.now+=41*q.DAY;const c=check(p,f.time.now);let proceed=true;
  if(mode==='link')f.current={...f.current,linkAfiliado:'https://meli.la/new'};
  if(mode==='foto')f.current={...f.current,foto:'https://http2.mlstatic.com/new.jpg'};
  if(mode==='cancel')f.current={...f.current,quarentenaAnuncio:null};
  if(mode==='restart')f.current={...f.current,quarentenaAnuncio:{...f.current.quarentenaAnuncio,startedAt:at+q.DAY}};
  if(mode==='session')f.adapter.onRegistry=()=>{f.uid='other';};
  if(mode==='stop')f.adapter.onRegistry=()=>{proceed=false;};
  if(mode==='registry')f.registry={version:2,ids:[]};
  await assert.rejects(f.api.review(p,c.row,c.result,()=>proceed),undefined,mode);assert.equal(f.writes.length,1,mode);assert.ok(f.current,mode);
 }
});
test('cancelamento explícito conserva o produto, não altera preço e impede a exclusão antiga',async()=>{
 const f=fixture(),p=await enter(f),saved=await f.api.cancel('p',p);assert.equal(q.state(saved).active,false);assert.equal(f.current.preco,123);f.time.now+=41*q.DAY;const c=check(p,f.time.now);await assert.rejects(f.api.review(p,c.row,c.result));assert.ok(f.current);
});
test('trocar os links ou reativar manualmente cancela a autorização de exclusão anterior',async()=>{
 for(const kind of ['links','resume']){const f=fixture();await enter(f);const adapter={...f.adapter,prepare:async x=>x,append:x=>[x],transact:(id,work)=>f.adapter.transact(id,tx=>work({...tx,protect:async()=>{}}))};const api=review.create(adapter),base=await api.read('p');
  if(kind==='links')await api.save('p',base,{market:'mercado_livre',sourceUrl:'https://www.mercadolivre.com.br/p/MLB23997257?wid=MLB9876543210',affiliateUrl:'https://meli.la/new',sameProduct:true});else await api.pause('p',base,false);
  assert.equal(f.current.quarentenaAnuncio,null);assert.equal(f.current.preco,123);
 }
});
test('os dois painéis usam transação autenticada e a limpeza existente, sem novo agendamento ou cobrança',async()=>{
 for(const file of ['dashboard.html','painel-celular.html']){const html=await readFile(new URL('../'+file,import.meta.url),'utf8');assert.match(html,/RDCProductQuarantineAccess = window.RDCProductQuarantine.create/);assert.match(html,/product-quarantine-panel.js/);assert.match(html,/saveRegistry: value => transaction.set\(registryRef, value\)/);assert.match(html,/removeProduct: \(\) => \{transaction.delete\(ref\);transaction.delete\([^\n]+RDCProductImageData.queueId\(id\)/);}
 const source=await readFile(new URL('../product-quarantine.js',import.meta.url),'utf8');assert.doesNotMatch(source,/setInterval|fetch\(|getDocs|access_token|refresh_token|secret|credentials:\s*['"]include/);assert.match(source,/method:'HEAD',credentials:'omit'/);
});
