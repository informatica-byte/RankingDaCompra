// Deployment-specific read-only checks. Does not restore or query Firestore.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {publicationBackup} from './publication-backup.mjs';
import {correctProductData} from './product-title-corrections.mjs';
import {publicCatalogue} from './public-catalogue.mjs';
const [mode,backupFile,proofFile]=process.argv.slice(2);assert.ok(['local','live'].includes(mode));assert.ok(backupFile&&proofFile);
const raw=await readFile(backupFile,'utf8'),backup=JSON.parse(raw),input=publicationBackup(backup);
const catalogue=JSON.parse(await readFile('informational-catalogue.json','utf8')),localV=JSON.parse(await readFile('vitrine-publica.json','utf8'));
const expected=new Map(publicCatalogue(input.products.map(correctProductData)).products.map(p=>[p.id,p]));
for(const p of localV.products)assert.deepEqual(publicCatalogue([p]).products[0],expected.get(p.id),'Snapshot diverged from saved backup '+p.id);
const get=async file=>{if(mode==='local')return readFile(file,'utf8');const r=await fetch('https://rankingdacompra.com.br/'+file+'?check1398='+Date.now());assert.equal(r.status,200,file);return r.text();};
if(mode==='live'){assert.deepEqual(JSON.parse(await get('informational-catalogue.json')).products,catalogue.products);assert.deepEqual(JSON.parse(await get('vitrine-publica.json')).products,localV.products);assert.equal(await get('sitemap.xml'),await readFile('sitemap.xml','utf8'));}
const ids=['1RCE8RtBHkc6aVkKZ6xB','B3HTtYZQAYonACif4tW1','U52A4gBWWLEmfCzONtHb','XRKv9OGoKrBbcDP0GxER','CO1tCKBzr6q79BOpdBZW','d31e9yty1t0dekViXbAi','mWlmlmg15okWqGyIc5bh','8NEAHWVWDbRD0jFU4YSn','UqO48Rj9I0f8SpOqabpv'];
const pages=[];for(const id of ids){const data=input.products.find(p=>p.id===id),html=await get('produto/'+id+'-20260810-1.html');assert.ok(catalogue.products.some(p=>p.id===id));assert.ok(!/<meta name="robots" content="noindex/.test(html),id);const href=html.match(/<a\b[^>]*\bid="affiliate-offer"[^>]*href="([^"]+)/)?.[1];assert.equal(href,data.linkAfiliado,id);pages.push({id,affiliatePreserved:true,active:true});}
const aliases=[['WpCGzZDy0ND4DZmvKbwj','U52A4gBWWLEmfCzONtHb'],['eb6zL5KD6hGwH5SdE6Ua','XRKv9OGoKrBbcDP0GxER']];
for(const [id,target]of aliases){const html=await get('produto/'+id+'-20260810-1.html');assert.match(html,/noindex,follow/);assert.ok(html.includes('https://rankingdacompra.com.br/produto/'+target+'-20260810-1.html'));assert.equal(input.products.find(p=>p.id===id).linkAfiliado,input.products.find(p=>p.id===target).linkAfiliado);}
const paused='z3tHbOuX0kaa90FEyIvS';assert.equal(input.products.find(p=>p.id===paused).conferenciaPausada,true);assert.match(await get('produto/'+paused+'-20260810-1.html'),/Anúncio em pausa/);
const hashes={};for(const file of ['historico-precos.json','historico-precos-indice.json'])hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');
assert.deepEqual(hashes,{'historico-precos.json':'a296c4c8ee4c742e1c42b342ff405f4da03c26bf7ee9e5d8e016198d11358486','historico-precos-indice.json':'24648e4dd5cd89d992f995a8767c3c6bb5ef1bc58d9ebb581a970d1d90866abf'});
const proof={at:new Date().toISOString(),mode,backupSha256:createHash('sha256').update(raw).digest('hex'),backupRecords:input.products.length,publishedProducts:catalogue.products.length,pages,aliases,pausedRecordPreserved:paused,historyHashes:hashes,noDatabaseWrites:true};await writeFile(proofFile,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
