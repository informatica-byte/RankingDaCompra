import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import review from '../pending-review-pause.js';
import {assertReviewedPauses} from './verify-reviewed-pauses.mjs';
import {pausedProductPage,productAliasPage} from './product-url-continuity.mjs';
function fixture(){return {catalogue:{products:[{id:'other',preco:'99,90'}]},sitemap:'<urlset></urlset>',search:{products:[]},pages:Object.fromEntries(review.TARGETS.map(t=>[t.id,pausedProductPage({titulo:t.label})]))};}
test('all 21 paused pages survive without active offers, price edits or missing IDs',()=>{
 const data=fixture(),before=JSON.stringify(data);assert.deepEqual(assertReviewedPauses(data),{paused:21,activeProducts:1});assert.equal(JSON.stringify(data),before);
});
for(const where of ['catalogue','sitemap','search','page','redirect','price'])test('gate refuses an unconfirmed pause in '+where,()=>{
 const data=fixture(),id=review.TARGETS[0].id;
 if(where==='catalogue')data.catalogue.products.push({id});
 if(where==='sitemap')data.sitemap='<loc>https://rankingdacompra.com.br/produto/'+id+'-20260810-1.html</loc>';
 if(where==='search')data.search.products.push({id});
 if(where==='page')delete data.pages[id];
 if(where==='redirect')data.pages[id]=productAliasPage('same','https://rankingdacompra.com.br/produto/other.html');
 if(where==='price')data.pages[id]+='<a id="affiliate-offer">Comprar</a>';
 assert.throws(()=>assertReviewedPauses(data),/Publicação bloqueada/);
});
test('incomplete output and all existing publication guards still block',()=>{
 assert.throws(()=>assertReviewedPauses({}),/Saída.*incompleta/);
 const workflow=readFileSync(new URL('../.github/workflows/update-sitemap.yml',import.meta.url),'utf8');
 assert.match(workflow,/\[verificar-pausas\]/);assert.ok((workflow.match(/verify-reviewed-pauses\.mjs/g)||[]).length>=2);
 assert.match(workflow,/node --test scripts\/test-\*\.mjs/);assert.match(workflow,/node scripts\/validate-site\.mjs/);assert.match(workflow,/publication-price-guard\.mjs/);
});
