import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import uniqueness from '../product-uniqueness.js';
import {buildIdentityIndex} from './build-product-identity-index.mjs';
const ml=(id='1234567890',extra={})=>({marketplace:'mercado_livre',titulo:'Mesmo nome',link:'https://produto.mercadolivre.com.br/MLB-'+id+'-produto-_JM',...extra});
const empty=()=>({version:1,entries:{}});
async function indexFor(records){const entries={};for(const p of records)for(const key of uniqueness.identify(p,{strict:false}).keys){const hash=await uniqueness.hash(key);entries[hash]=[...new Set([...(entries[hash]||[]),p.id])];}return {version:1,entries};}
function database(records={}){
 const docs=new Map(Object.entries(records)),versions=new Map(),writes=[];
 async function transaction(work){
  for(let attempt=0;attempt<12;attempt++){
   const reads=new Map(),pending=[];
   const read=async id=>{reads.set(id,versions.get(id)||0);return docs.has(id)?structuredClone(docs.get(id)):null;};
   const write=(id,data)=>pending.push([id,structuredClone(data)]);
   const result=await work({read,write});await Promise.resolve();
   if([...reads].some(([id,version])=>(versions.get(id)||0)!==version))continue;
   for(const [id,data]of pending){docs.set(id,data);versions.set(id,(versions.get(id)||0)+1);writes.push([id,data]);}return result;
  }throw Error('retry limit');
 }
 async function save(product,id,index=empty(),creating=true){
  const prepared=await uniqueness.prepare(product,async()=>index);id=id||prepared.id;
  return transaction(async tx=>{
   const current=await tx.read('p:'+id);if(creating&&current)throw Error('já está cadastrado');if(!creating&&!current)throw Error('excluído');
   await uniqueness.acquire({readRegistry:()=>tx.read('registry'),readRemoved:()=>tx.read('removed'),readProduct:other=>tx.read('p:'+other),saveRegistry:data=>tx.write('registry',data),timestamp:()=> 'TIME'},prepared,id,product,creating);
   tx.write('p:'+id,product);return id;
  });
 }
 return {docs,writes,save};
}

test('mesmo anúncio ignora tracking e não depende do título nem de MLB antigo no campo salvo',()=>{
 const a=ml(),b=ml('1234567890',{titulo:'Nome abreviado',mercadoLivreItemId:'MLB9999999999',link:'https://www.mercadolivre.com.br/produto/p/MLB99999999?utm_source=x#deal=MLB1111111&wid=MLB1234567890'});
 assert.equal(uniqueness.conflicts(a,b),true);assert.equal(uniqueness.conflicts(a,ml('9999999999',{mercadoLivreItemId:'MLB1234567890'})),false);
});
test('não une nomes, fotos, categorias ou vendedores diferentes por semelhança',()=>{
 const a=ml('1234567890',{foto:'https://example.invalid/same.jpg',categoria:'cat'}),b=ml('9876543210',{foto:a.foto,categoria:a.categoria});
 assert.equal(uniqueness.conflicts(a,b),false);
 const base='https://www.mercadolivre.com.br/p/MLB12345678?wid=';
 assert.equal(uniqueness.conflicts({...a,link:base+'MLB1234567890'},{...b,link:base+'MLB9876543210'}),false);
 assert.equal(uniqueness.conflicts({...a,link:base+'MLB1234567890'},{...b,link:'https://www.mercadolivre.com.br/p/MLB12345678'}),true,'catálogo sem vendedor é ambíguo: pedir revisão, nunca unir');
});
test('a mesma campanha de ofertas ou campo MLB incorreto não une um controle a uma maquininha',()=>{
 const a={link:'https://www.mercadolivre.com.br/controle/up/MLBU3461479224?pdp_filters=deal%3AMLB779362-1#tracking_id=x&wid=MLB4231915505',mercadoLivreItemId:'MLB779362'};
 const b={link:'https://www.mercadolivre.com.br/maquininha/p/MLB12345678?pdp_filters=deal%3AMLB779362-1#tracking_id=y&wid=MLB9876543210',mercadoLivreItemId:'MLB779362'};
 assert.equal(uniqueness.conflicts(a,b),false);
});
test('links da Shopee e links de afiliado repetidos pertencem a um cadastro só',()=>{
 const shopee={link:'https://shopee.com.br/product/123/456?utm_source=x'};
 assert.equal(uniqueness.conflicts(shopee,{link:'https://shopee.com.br/Outro-titulo-i.123.456?utm_medium=affiliates'}),true);
 assert.equal(uniqueness.conflicts(shopee,{link:'https://shopee.com.br/product/00123/00456'}),true);
 assert.equal(uniqueness.conflicts(ml('1234567890',{linkShopee:shopee.link}),shopee),true);
 assert.equal(uniqueness.conflicts(ml('1234567890',{linkAfiliado:'https://meli.la/CaseSensitive'}),ml('9876543210',{linkAfiliado:'https://meli.la/CaseSensitive'})),true);
 assert.equal(uniqueness.conflicts(ml('1234567890',{linkAfiliado:'https://meli.la/CaseSensitive'}),ml('9876543210',{linkAfiliado:'https://meli.la/casesensitive'})),false);
});
test('recusa links curtos como fonte de novo cadastro, credenciais, domínios falsos e links contraditórios',async()=>{
 for(const link of ['https://meli.la/token','https://s.shopee.com.br/token','https://mercadolivre.com.br.evil.test/p/MLB1234567','https://user:password@mercadolivre.com.br/p/MLB1234567','https://www.mercadolivre.com.br/sem-codigo','http://www.mercadolivre.com.br/p/MLB1234567'])await assert.rejects(uniqueness.prepare({link},async()=>empty()));
 await assert.rejects(uniqueness.prepare(ml('1234567890',{linkAfiliado:ml('9876543210').link}),async()=>empty()),/diferentes/);
});
test('ID determinístico cobre catálogo e Shopee; ausência de índice bloqueia sem fallback',async()=>{
 for(const product of [{link:'https://www.mercadolivre.com.br/p/MLB12345678'},{link:'https://shopee.com.br/product/123/456'}]){
  assert.equal((await uniqueness.prepare(product,async()=>empty())).id,(await uniqueness.prepare({...product,link:product.link+'?utm_source=other'},async()=>empty())).id);
 }
 await assert.rejects(uniqueness.loadIndex(async()=>({ok:false})),/nenhum cadastro/);
 for(const data of [{...empty(),complete:false,generatedAt:new Date().toISOString()},{...empty(),complete:true,generatedAt:'bad'}])await assert.rejects(uniqueness.loadIndex(async()=>({ok:true,json:async()=>data})),/aguarde/i);
 assert.deepEqual(await uniqueness.loadIndex(async()=>({ok:true,json:async()=>({...empty(),complete:true,generatedAt:new Date().toISOString()})})),empty());
});
test('cadastro legado sem campo MLB é bloqueado pelo índice, mantendo preço e ID original',async()=>{
 const original={id:'old-random-id',...ml('1234567890',{preco:'9,90'})},index=await indexFor([original]),db=database({'p:old-random-id':original});
 await assert.rejects(db.save(ml('1234567890',{link:'https://www.mercadolivre.com.br/p/MLB12345678?wid=MLB1234567890'}),undefined,index),error=>error.existingId==='old-random-id');
 assert.equal(db.writes.length,0);assert.deepEqual(db.docs.get('p:old-random-id'),original);
});
test('índice desatualizado não impede novo cadastro por documento ausente ou link realmente trocado',async()=>{
 const stale={id:'old',...ml()},index=await indexFor([stale]);
 for(const records of [{},{'p:old':ml('9876543210')}]){const db=database(records);await db.save(ml(),undefined,index);assert.ok(db.docs.has('p:mlMLB1234567890'));}
});
test('cliques simultâneos com o mesmo anúncio ou afiliado permitem só um novo produto',async()=>{
 for(const pair of [[ml(),ml()], [ml('1234567890',{linkAfiliado:'https://meli.la/same'}),ml('9876543210',{linkAfiliado:'https://meli.la/same'})]]){
  const db=database();const results=await Promise.allSettled(pair.map(p=>db.save(p)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal([...db.docs.keys()].filter(key=>key.startsWith('p:')).length,1);assert.equal(db.writes.length,2);
 }
});
test('edição não pode apontar ao anúncio de outro produto; edições legítimas liberam a identidade anterior',async()=>{
 const first={id:'first',...ml()},second={id:'second',...ml('9876543210')},index=await indexFor([first,second]),db=database({'p:first':first,'p:second':second});
 await assert.rejects(db.save({...first,link:second.link},'first',index,false),/já está cadastrado/);assert.equal(db.writes.length,0);
 await db.save({...first,link:ml('1111111111').link},'first',index,false);
 await db.save(ml(),undefined,index);assert.equal(db.docs.get('p:second').link,second.link);
});
test('uma criação simultânea à troca de link não toma a mesma identidade em dois cadastros',async()=>{
 const first={id:'first',...ml()},index=await indexFor([first]),db=database({'p:first':first}),target=ml('9876543210');
 const results=await Promise.allSettled([db.save({...first,link:target.link},'first',index,false),db.save(target,undefined,index)]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal([...db.docs].filter(([key,data])=>key.startsWith('p:')&&uniqueness.conflicts(target,data)).length,1);
});
test('referência técnica de produto excluído não recria o ID e falha transacional não deixa reserva parcial',async()=>{
 const db=database({removed:{version:1,ids:['mlMLB1234567890']}});await assert.rejects(db.save(ml()),/excluído definitivamente/);assert.equal(db.writes.length,0);
 const prepared=await uniqueness.prepare(ml(),async()=>empty()),writes=[];
 await assert.rejects(uniqueness.acquire({readRegistry:async()=>empty(),readRemoved:async()=>null,readProduct:async()=>null,saveRegistry:data=>writes.push(data),timestamp:()=> 'time'},prepared,'p',{...ml('9876543210')},true),/mudaram/);assert.equal(writes.length,0);
});
test('índice rejeita formatos/caminhos arbitrários, tamanho excessivo e dados além de IDs',()=>{
 for(const value of [{version:1,entries:{'../outside':['p']}},{version:1,entries:{['a'.repeat(64)]:['../p']}},{version:1,entries:{},token:'never'},{version:2,entries:{}},{version:1,entries:{['a'.repeat(64)]:Array(101).fill('p')}}])assert.throws(()=>uniqueness.registry(value));
});
test('índice de publicação reutiliza a fonte completa, inclui pausados e não contém preços ou títulos',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rdc-identity-index-'));
 try{
  const products=[{id:'active',...ml()},{id:'paused',...ml('9876543210'),conferenciaPausada:true},{id:'.site-theme',sistema:true}],before=JSON.stringify(products);
  const index=await buildIdentityIndex(products,root);assert.equal(index.complete,true);assert.equal(JSON.stringify(products),before);
  const text=await readFile(join(root,'product-identities.json'),'utf8');assert.doesNotMatch(text,/Mesmo nome|mercadolivre\.com|preco|token/);assert.match(text,/paused/);assert.doesNotMatch(text,/site-theme/);
 }finally{await rm(root,{recursive:true,force:true});}
});
