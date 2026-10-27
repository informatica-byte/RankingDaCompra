import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import review from '../affiliate-link-review.js';
import core from '../affiliate-link-audit.js';
const record=()=>({id:'p',titulo:'JBL Tune 520BT',link:'https://www.mercadolivre.com.br/p/MLB23997257?wid=MLB1234567890',linkAfiliado:'https://meli.la/old',linkShopee:'https://s.shopee.com.br/old',preco:100,precoAnterior:150,precoConferenciaId:'old-proof',conferenciaPausada:false,comentario:'Ficha preservada',foto:'https://http2.mlstatic.com/photo.jpg'});
const input=()=>({market:'mercado_livre',sourceUrl:'https://www.mercadolivre.com.br/p/MLB23997257?wid=MLB9876543210',affiliateUrl:'https://meli.la/new',sameProduct:true});
function fixture(){let current=record(),uid='admin',protectedCount=0,writes=[];const adapter={authorize:()=>{if(!uid)throw Error('Entre novamente');return uid;},read:async()=>current,prepare:async p=>p,transact:async(_id,action)=>{let patch;const out=await action({read:async()=>current,protect:async()=>{protectedCount++;},update:value=>{patch=value;}});if(patch){writes.push(patch);current={...current,...patch};}return out;},timestamp:()=> 'timestamp',append:x=>[x],invalidate(){}};return {api:review.create(adapter),adapter,get current(){return current;},set current(x){current=x;},get writes(){return writes;},get protections(){return protectedCount;},set uid(x){uid=x;}};}
test('salva só links e metadados do anúncio no mesmo documento, preservando preços, ficha e outra loja',async()=>{
 const f=fixture(),original=structuredClone(f.current),base=await f.api.read('p');assert.equal('preco'in base,false);assert.equal(f.writes.length,0);
 const out=await f.api.save('p',base,input());assert.equal(out.id,'p');assert.equal('preco'in out,false);assert.equal(f.protections,1);assert.equal(f.writes.length,1);
 for(const key of ['preco','precoAnterior','precoConferenciaId','comentario','foto','linkShopee','conferenciaPausada'])assert.equal(f.current[key],original[key]);
 assert.equal(f.current.mercadoLivreItemId,'MLB9876543210');assert.equal(f.current.historicoAnuncios[0].link,original.link);assert.equal('preco'in f.current.historicoAnuncios[0],false);
 assert.deepEqual(Object.keys(f.writes[0]).sort(),['anuncioSubstituidoEm','atualizadoEm','historicoAnuncios','link','linkAfiliado','mercadoLivreItemId'].sort());
});
test('não aceita outro domínio, anúncio conflitante, link curto original, credenciais ou confirmação ausente',()=>{
 for(const change of [{sameProduct:false},{sourceUrl:'https://meli.la/short'},{sourceUrl:'https://user:secret@www.mercadolivre.com.br/p/MLB12345'},{sourceUrl:'https://evil.example/p/MLB12345'},{affiliateUrl:'https://www.mercadolivre.com.br/p/MLB23997257?wid=MLB1111111111'},{sourceUrl:'https://www.mercadolivre.com.br/p/MLB23997257?wid=MLB9876543210#item_id=MLB1234567890'},{market:'shopee'},{affiliateUrl:'https://meli.la/x?access_token=secret'}])assert.throws(()=>review.links(record(),{...input(),...change}),undefined,JSON.stringify(Object.keys(change)));
});
test('edição da Shopee preserva os links do Mercado Livre e mantém original e afiliado separados',()=>{
 const patch=review.links(record(),{market:'shopee',sourceUrl:'https://shopee.com.br/product/123/456',affiliateUrl:'https://s.shopee.com.br/new',sameProduct:true});assert.deepEqual(patch,{linkShopee:'https://s.shopee.com.br/new',linkShopeeOriginal:'https://shopee.com.br/product/123/456'});assert.throws(()=>review.links(record(),{market:'shopee',sourceUrl:'https://shopee.com.br/product/123/456',affiliateUrl:'https://shopee.com.br/product/123/789',sameProduct:true}),/diferentes/);
});
test('conflitos, exclusão, mudança de sessão e duplicado não gravam nem recriam produto',async()=>{
 for(const mode of ['links','missing','session','duplicate']){const f=fixture(),base=await f.api.read('p');if(mode==='links')f.current={...f.current,linkAfiliado:'https://meli.la/other'};if(mode==='missing')f.current=null;if(mode==='session')f.adapter.prepare=async p=>{f.uid='other';return p;};if(mode==='duplicate')f.adapter.transact=async(_id,action)=>action({read:async()=>f.current,protect:async()=>{throw Error('Já cadastrado');},update(){throw Error('Não pode gravar');}});await assert.rejects(f.api.save('p',base,input()));assert.equal(f.writes.length,0);}
});
test('mudança de preço em outra sessão não é sobrescrita; pausa e retomada só mudam a revisão',async()=>{
 const f=fixture(),base=await f.api.read('p');f.current={...f.current,preco:222};await f.api.save('p',base,input());assert.equal(f.current.preco,222);const paused=await f.api.pause('p',await f.api.read('p'),true);assert.equal(paused.conferenciaPausada,true);assert.deepEqual(Object.keys(f.writes.at(-1)).sort(),['conferenciaPausada','conferenciaPausadaEm']);await f.api.pause('p',paused,false);assert.equal(f.current.preco,222);assert.equal(f.current.conferenciaPausada,false);
});
test('adaptadores dos dois painéis mantêm transação, sessão, registro de identidade e apenas um cadastro-alvo',async()=>{
 for(const file of ['dashboard.html','painel-celular.html']){const html=await readFile(new URL('../'+file,import.meta.url),'utf8');const code=html.slice(html.indexOf('window.RDCAffiliateAuditReview ='),html.indexOf('window.RDCAffiliateAuditReview =')+2100);assert.match(code,/auth.currentUser/);assert.match(code,/transaction.get\(ref\)/);assert.match(code,/transaction.update\(ref, changes\)/);assert.match(code,/protegerIdentidade/);assert.doesNotMatch(code,/transaction.delete|preco\s*:/);assert.match(html,/affiliate-link-review.js/);}
});
