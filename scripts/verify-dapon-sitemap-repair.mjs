// Publication verification only. Never restores, queries or writes Firestore.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {publicationBackup} from './publication-backup.mjs';
import {correctProductData} from './product-title-corrections.mjs';
import {publicCatalogue} from './public-catalogue.mjs';
const [mode,backupFile]=process.argv.slice(2),out='../../outputs/melhorias-integrais-20261030/';
assert.ok(['before','capture-links','local','live'].includes(mode));assert.ok(backupFile);
const raw=await readFile(backupFile,'utf8'),input=publicationBackup(JSON.parse(raw));
const json=async f=>JSON.parse(await readFile(f,'utf8'));
const hashes=async()=>Object.fromEntries(await Promise.all(['historico-precos.json','historico-precos-indice.json'].map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
const affiliates=h=>[...h.matchAll(/<a\b[^>]*\bid=["']((?:mobile-)?affiliate-offer(?:-shopee)?)["'][^>]*>/g)].map(m=>[m[1],m[0].match(/href=["']([^"']+)/)?.[1]]).sort();
if(mode==='before'){
 assert.deepEqual([...(input.removals?.ids||[])].sort(),[...((await json('product-deletions.json')).ids||[])].sort(),'Do not enact new removals in this repair.');
 for(const [a,b]of [['informational-catalogue.json','catalogo-antes-dapon-sitemap.json'],['vitrine-publica.json','vitrine-antes-dapon-sitemap.json']])await writeFile(out+b,await readFile(a));
 await writeFile(out+'dapon-sitemap-baseline.json',JSON.stringify({historyHashes:await hashes(),urls:[...(await readFile('sitemap.xml','utf8')).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]).sort()}));
 console.log('Baseline and unchanged removal registry confirmed.');
}else if(mode==='capture-links'){
 const before=await json(out+'catalogo-antes-dapon-sitemap.json'),base=await json(out+'dapon-sitemap-baseline.json');assert.ok(!base.affiliates,'Do not replace original affiliate evidence.');
 const files=before.products.map(p=>new URL(p.url).pathname.slice(1));assert.ok(files.every(f=>/^produto\/[a-zA-Z0-9_-]+\.html$/.test(f)));
 const result=spawnSync('git',['cat-file','--batch'],{input:files.map(f=>'HEAD:'+f).join('\n')+'\n',maxBuffer:100*1024*1024});assert.equal(result.status,0);
 let offset=0;const records=[];for(const file of files){const end=result.stdout.indexOf(10,offset),header=result.stdout.subarray(offset,end).toString();assert.match(header,/^[a-f0-9]+ blob \d+$/);const size=Number(header.split(' ').at(-1)),start=end+1;records.push({file,links:affiliates(result.stdout.subarray(start,start+size).toString())});offset=start+size+1;}
 base.affiliates=records;await writeFile(out+'dapon-sitemap-baseline.json',JSON.stringify(base));console.log('Original affiliate anchors captured for '+records.length+' pages.');
}else{
 const c=await json('informational-catalogue.json'),v=await json('vitrine-publica.json'),before=await json(out+'catalogo-antes-dapon-sitemap.json'),base=await json(out+'dapon-sitemap-baseline.json');
 assert.deepEqual(await hashes(),base.historyHashes,'History must remain byte-identical');
 assert.ok(base.affiliates?.length===before.products.length);for(const record of base.affiliates)assert.deepEqual(affiliates(await readFile(record.file,'utf8')),record.links,'Existing affiliate changed '+record.file);
 const expected=new Map(publicCatalogue(input.products.map(correctProductData)).products.map(p=>[p.id,p]));
 for(const p of v.products)assert.deepEqual(publicCatalogue([p]).products[0],expected.get(p.id),'Saved backup fields changed '+p.id);
 const now=new Map(c.products.map(p=>[p.id,p]));for(const p of before.products)assert.deepEqual(now.get(p.id),p,'Existing editorial content or record removed/changed '+p.id);
 const xml=await readFile('sitemap.xml','utf8'),urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]).sort();for(const url of base.urls)assert.ok(urls.includes(url),'Existing sitemap URL removed '+url);
 const get=async file=>{if(mode==='local')return readFile(file,'utf8');const r=await fetch('https://rankingdacompra.com.br/'+file+'?daponRepair='+Date.now());assert.equal(r.status,200,file);return r.text();};
 if(mode==='live'){assert.deepEqual(JSON.parse(await get('informational-catalogue.json')).products,c.products);assert.deepEqual(JSON.parse(await get('vitrine-publica.json')).products,v.products);assert.equal(await get('sitemap.xml'),xml);}
 const main='NJipazuMXMzOH9YZbxwu',olds=['JuHTAByi0pSeuxzlBCy4','Y6Ty2gcU1ktmmGyznDWs'],canonical='https://rankingdacompra.com.br/produto/'+main+'-20260810-1.html';
 const h=await get('produto/'+main+'-20260810-1.html');assert.ok(h.includes('autonomia e porta de recarga divergentes'));assert.ok(!h.includes('noindex,follow'));for(const old of olds){const alias=await get('produto/'+old+'-20260810-1.html');assert.match(alias,/noindex,follow/);assert.ok(alias.includes(canonical));}
 assert.equal(c.products.filter(p=>[main,...olds].includes(p.id)).length,1);assert.equal(c.products.find(p=>[main,...olds].includes(p.id)).id,main);
 assert.equal(h.match(/<a\b[^>]*id="affiliate-offer"[^>]*href="([^"]+)/)?.[1],'https://meli.la/2K1ekie');
 const records=input.products.filter(p=>[main,...olds].includes(p.id));assert.equal(records.length,3);assert.ok(records.every(p=>p.linkAfiliado==='https://meli.la/2K1ekie'));
 const proof={at:new Date().toISOString(),mode,backupSha256:createHash('sha256').update(raw).digest('hex'),backupRecords:input.products.length,publicProducts:c.products.length,sitemapUrls:urls.length,existingEditorialPreserved:before.products.length,canonical,aliases:olds.map(old=>'https://rankingdacompra.com.br/produto/'+old+'-20260810-1.html'),affiliatePreserved:true,backendRecordsPreserved:records.map(p=>p.id),historyHashes:base.historyHashes,noDatabaseWrites:true};
 await writeFile(out+'dapon-sitemap-'+mode+'.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
