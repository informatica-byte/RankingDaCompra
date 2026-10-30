import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const [mode,manifestPath]=process.argv.slice(2);
if(!['before','after'].includes(mode)||!manifestPath)throw Error('Use before|after e caminho do registro.');
const catalogue=JSON.parse(await readFile('informational-catalogue.json','utf8'));
const vitrine=JSON.parse(await readFile('vitrine-publica.json','utf8'));
const sourceVitrine=mode==='before'?JSON.parse(await readFile(resolve(manifestPath,'../vitrine-antes.json'),'utf8')):vitrine;
const protectedData=sourceVitrine.products.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>/^(?:id$|foto$|link|preco|promocao|oferta|conferencia|quarentena|anuncioSubstituido)/i.test(key)))).sort((a,b)=>a.id.localeCompare(b.id));
const pages=[];
for(const p of catalogue.products){
 const file=new URL(p.url).pathname.slice(1);
 const html=await readFile(file,'utf8');
 const affiliate=[...html.matchAll(/<a\b[^>]*\bid=["']((?:mobile-)?affiliate-offer(?:-shopee)?)["'][^>]*>/g)].map(m=>[m[1],m[0].match(/href=["']([^"']+)/)?.[1]]).sort();
 pages.push({id:p.id,file,affiliate});
}
pages.sort((a,b)=>a.id.localeCompare(b.id));
const sitemap=await readFile('sitemap.xml','utf8');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]).sort();
const snapshot={protectedData,pages,urls};
if(mode==='before'){await writeFile(manifestPath,JSON.stringify(snapshot,null,2)+'\n');console.log('Registro criado: '+pages.length+' produtos, '+urls.length+' URLs.');}
else{
 const before=JSON.parse(await readFile(manifestPath,'utf8'));
 assert.deepEqual(snapshot.protectedData,before.protectedData,'Preço, link, pausa ou campo operacional alterado');
 assert.deepEqual(snapshot.pages,before.pages,'ID, endereço de ficha ou link de afiliado alterado');
 assert.deepEqual(snapshot.urls,before.urls,'URLs do sitemap alteradas ou excluídas');
 console.log(JSON.stringify({passed:true,products:pages.length,sitemapUrls:urls.length,protected:'prices, records IDs, offers, pauses, quarantine, affiliates and URLs'}));
}

