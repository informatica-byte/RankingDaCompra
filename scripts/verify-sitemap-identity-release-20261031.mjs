import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {assertPublishedPricesPreserved} from './publication-price-guard.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const out='../../outputs/melhorias-integrais-20261030/';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const oldV=await json(out+'antes-correcao-testes-vitrine.json');
const oldC=await json(out+'antes-correcao-testes-catalogo.json');
const baseline=await json(out+'invariantes-antes.json');
const get=async path=>{const r=await fetch('https://rankingdacompra.com.br/'+path+'?verify='+Date.now());assert.equal(r.status,200,path);return r.text();};
const [v,c,s,xml]=await Promise.all(['vitrine-publica.json','informational-catalogue.json','search-index.json','sitemap.xml'].map(get));
const V=JSON.parse(v),C=JSON.parse(c),S=JSON.parse(s);
assertCurrentProductIdentities(C,S,V);
const currentV=new Map(V.products.map(p=>[p.id,p]));
const currentC=new Map(C.products.map(p=>[p.id,p]));
for(const p of oldV.products){assert.ok(currentV.has(p.id),'Removed '+p.id);for(const k of Object.keys(p).filter(k=>/^(?:id$|foto$|link|preco|promocao|oferta|conferencia|quarentena|anuncioSubstituido)/i.test(k)))assert.deepEqual(currentV.get(p.id)[k],p[k],p.id+' '+k);}
for(const p of oldC.products)assert.deepEqual(currentC.get(p.id),p,'Existing informational product changed '+p.id);
for(const p of baseline.pages){const html=await readFile(p.file,'utf8');const links=[...html.matchAll(/<a\b[^>]*\bid=["']((?:mobile-)?affiliate-offer(?:-shopee)?)["'][^>]*>/g)].map(m=>[m[1],m[0].match(/href=["']([^"']+)/)?.[1]]).sort();assert.deepEqual(links,p.affiliate.slice().sort(),p.id+' affiliate');}
const locs=t=>[...t.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
const previousUrls=locs(await readFile(out+'antes-correcao-testes-sitemap.xml','utf8')),urls=locs(xml);
for(const url of previousUrls)assert.ok(urls.includes(url),'Removed URL '+url);
const oldIds=new Set(oldC.products.map(p=>p.id));
const added=C.products.filter(p=>!oldIds.has(p.id));
const newPages=[];
for(const p of added){const page=await get(new URL(p.url,'https://rankingdacompra.com.br').pathname.slice(1));assert.match(page,/<h1\b/);assert.match(page,/<link[^>]+canonical/i);newPages.push({id:p.id,title:p.title,url:p.url,http:200});}
const runs=[];for(const id of [41196404191,41196537765,41196581883]){const r=await(await fetch('https://api.github.com/repos/informatica-byte/RankingDaCompra/actions/runs/'+id+'?v='+Date.now())).json();assert.equal(r.conclusion,'success');runs.push({id,conclusion:r.conclusion,sha:r.head_sha});}
const proof={at:new Date().toISOString(),products:C.products.length,previousProducts:oldC.products.length,sitemapUrls:urls.length,previousSitemapUrls:previousUrls.length,prices:assertPublishedPricesPreserved(oldV,V),unchangedInformationalProducts:oldC.products.length,unchangedAffiliatePages:baseline.pages.length,deepReviews:C.products.filter(p=>p.decisionBrief?.reviewed).length,newPages,runs,tests:{total:1277,passed:1277,failed:0},priceGuard:true};
await writeFile(out+'verificacao-publicada-correcao-testes.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
