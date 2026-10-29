import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import removal from '../product-removal-safety.js';
import {purgeRemovals,publicationRemovals,pruneConfig,cleanRemovedLinks,verifyRemovals} from './product-removals.mjs';

test('registry validates IDs, contains no content and merges monotonically',()=>{
 assert.deepEqual(removal.merged({version:1,ids:['old']},{version:1,ids:['new','old']}),{version:1,ids:['new','old']});
 for(const value of [{version:2,ids:[]},{version:1,ids:['../escape']},{version:1,ids:['ok'],token:'no'},{version:1,ids:Array(4001).fill('x')}])assert.throws(()=>removal.registry(value));
 assert.throws(()=>removal.merged({version:1,ids:Array.from({length:4000},(_,i)=>'p'+i)},{version:1,ids:['new']}));
});

test('transaction deletes only the confirmed product and adds only its ID atomically',async()=>{
 const product={id:'target',titulo:'Produto',link:'https://example.test/item',preco:'19,90'},writes=[];
 const adapter={session:()=> 'admin',timestamp:()=> 'time',transaction:work=>work({product:async()=>({...product}),registry:async()=>({version:1,ids:['previous']}),saveRegistry:v=>writes.push(v),removeProduct:()=>writes.push('delete-target')})};
 assert.equal((await removal.remove(adapter,product,'admin')).cleanupPending,true);
 assert.deepEqual(writes,[{version:1,ids:['previous','target'],updatedAt:'time'},'delete-target']);
 assert.equal(product.preco,'19,90');
 for(const changed of [null,{...product,titulo:'Outro produto'}]){
  writes.length=0;await assert.rejects(removal.remove({...adapter,transaction:work=>work({product:async()=>changed,registry:async()=>null,saveRegistry:v=>writes.push(v),removeProduct:()=>writes.push('delete')})},product,'admin'));assert.equal(writes.length,0);
 }
 writes.length=0;await assert.rejects(removal.remove({...adapter,session:()=> 'other'},product,'admin'));assert.equal(writes.length,0);
});

test('cleanup erases selected history/pages/references without touching prefix collisions or shared images',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rdc-removal-test-'));
 const json=async(file,data)=>writeFile(join(root,file),JSON.stringify(data));
 try{
  for(const dir of ['produto/imagens','assets/price-history','presentes'])await mkdir(join(root,dir),{recursive:true});
  await json('product-deletions.json',{version:1,ids:['p']});
  await json('product-url-aliases.json',{'old.html':'p'});
  for(const file of ['p.html','p-20260101-1.html','old.html','p2.html'])await writeFile(join(root,'produto',file),'page');
  for(const file of ['historico-precos.json','historico-precos-indice.json','mercadolivre-status.json'])await json(file,{products:{p:{price:19},p2:{price:29}}});
  for(const file of ['p-1111111111111111.json','p-2222222222222222.json','p2-1111111111111111.json'])await json('assets/price-history/'+file,{data:true});
  for(const file of ['vitrine-publica.json','search-index.json','top5-semanal.json'])await json(file,{products:[{id:'p',preco:19},{id:'p2',preco:29}]});
  await json('site-config.json',{bestChoicesProductIds:['p','p2'],weeklyComparison:{publicado:true,produtos:[{id:'p'},{id:'p2'}]}});
  await json('product-identities.json',{version:1,complete:true,entries:{['a'.repeat(64)]:['p','p2'],['b'.repeat(64)]:['p']}});
  await writeFile(join(root,'index.html'),'<a href="/produto/p.html">p</a><a href="/produto/old.html">old</a><a href="/produto/p2.html">p2</a><img src="/produto/imagens/p-222222222222.webp">');
  for(const name of ['p-111111111111.webp','p-222222222222.webp','p2-111111111111.webp','p-local-'+ 'a'.repeat(64)+'.jpg','p2-local-'+'b'.repeat(64)+'.jpg'])await writeFile(join(root,'produto/imagens',name),'image');
  await writeFile(join(root,'sitemap.xml'),'<urlset><url><loc>https://rankingdacompra.com.br/produto/p.html</loc></url><url><loc>https://rankingdacompra.com.br/produto/p2.html</loc></url></urlset>');
  await assert.rejects(verifyRemovals(root),/Exclusão incompleta/);
  assert.deepEqual(await purgeRemovals(root),{products:1,pages:3,historyFiles:2,images:2});
  await verifyRemovals(root);
  for(const file of ['produto/p.html','produto/old.html','produto/p-20260101-1.html','assets/price-history/p-1111111111111111.json'])await assert.rejects(access(join(root,file)),{code:'ENOENT'});
  for(const file of ['produto/p2.html','produto/imagens/p-222222222222.webp','assets/price-history/p2-1111111111111111.json'])await access(join(root,file));
  await assert.rejects(access(join(root,'produto/imagens/p-local-'+'a'.repeat(64)+'.jpg')),{code:'ENOENT'});
  await access(join(root,'produto/imagens/p2-local-'+'b'.repeat(64)+'.jpg'));
  const history=JSON.parse(await readFile(join(root,'historico-precos.json')));assert.deepEqual(history.products,{p2:{price:29}});
  const index=await readFile(join(root,'index.html'),'utf8');assert.doesNotMatch(index,/href="\/produto\/(?:p|old)\.html"/);assert.match(index,/href="\/produto\/p2\.html"/);
  assert.doesNotMatch(await readFile(join(root,'sitemap.xml'),'utf8'),/\/p\.html/);
  const config=JSON.parse(await readFile(join(root,'site-config.json')));assert.deepEqual(config.bestChoicesProductIds,['p2']);assert.equal(config.weeklyComparison.publicado,false);
  assert.deepEqual(JSON.parse(await readFile(join(root,'product-identities.json'))).entries,{['a'.repeat(64)]:['p2']});
  assert.deepEqual([...(await publicationRemovals({removals:null},root))],['p'],'old snapshot cannot restore a deleted product');
  assert.deepEqual(await purgeRemovals(root),{products:1,pages:0,historyFiles:0,images:0});
 }finally{await rm(root,{recursive:true,force:true});}
});

test('empty registry is a no-op; invalid aliases and registry block cleanup',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rdc-removal-validation-'));
 try{
  assert.deepEqual(await purgeRemovals(root),{products:0,pages:0,historyFiles:0,images:0});
  await writeFile(join(root,'product-deletions.json'),JSON.stringify({version:1,ids:['p']}));
  await writeFile(join(root,'product-url-aliases.json'),JSON.stringify({'../outside.html':'p'}));
  await assert.rejects(purgeRemovals(root),/Alias/);
  await writeFile(join(root,'product-deletions.json'),JSON.stringify({version:1,ids:['../outside']}));
  await assert.rejects(purgeRemovals(root),/inválido/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('configuration keeps unrelated fields and prices; removed comparison is unpublished',()=>{
 const config={custom:'keep',weeklyComparison:{publicado:true,produtos:[{id:'p',preco:12},{id:'q',preco:25}]}};
 const revised=pruneConfig(config,new Set(['p']));assert.equal(revised.custom,'keep');assert.deepEqual(revised.weeklyComparison.produtos,[{id:'q',preco:25}]);assert.equal(config.weeklyComparison.produtos.length,2);
});

test('cleans confirmed URLs from structured data without deleting external URLs or unrelated schema',()=>{
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'ItemList',itemListElement:[{position:1,url:'https://rankingdacompra.com.br/produto/p.html'},{position:2,url:'https://rankingdacompra.com.br/produto/p2.html'},{position:3,url:'https://other.test/produto/p.html'}]})+'</script>';
 const cleaned=cleanRemovedLinks(html,new Set(['p']));const schema=JSON.parse(cleaned.match(/>(.*)</)[1]);assert.equal(schema.itemListElement.length,2);assert.equal(schema.itemListElement[0].position,2);assert.match(cleaned,/other.test/);assert.equal(cleanRemovedLinks(cleaned,new Set(['p'])),cleaned);
});
