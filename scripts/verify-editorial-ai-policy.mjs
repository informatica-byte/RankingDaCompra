import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
const base='https://rankingdacompra.com.br',get=async path=>{const r=await fetch(base+path+'?editorial-policy='+Date.now());assert.equal(r.status,200,path);return r.text();};
const before=JSON.parse(await readFile('../../outputs/melhorias-integrais-20261030/catalogo-antes-triagem75.json','utf8')),live=JSON.parse(await get('/informational-catalogue.json'));
assert.deepEqual(live.products,before.products,'Unrelated editorial product change');
for(const p of ['/dashboard.html','/painel-celular.html']){const h=await get(p);assert.match(h,/editorial-ai-policy.js\?v=20261104-1/);assert.match(h,/systemInstruction: window.RDCEditorialPolicy.instructions/);}
assert.equal(await get('/editorial-ai-policy.js'),await readFile('editorial-ai-policy.js','utf8'));
const queue=JSON.parse(await get('/editorial-review-queue.json')),local=JSON.parse(await readFile('editorial-review-queue.json','utf8'));assert.deepEqual(queue.items,local.items);
const proof={at:new Date().toISOString(),publicHttp200:true,productsUnchanged:live.products.length,counts:queue.counts,items:queue.items.length,aiCalls:0,firestoreCalls:0,limits:'Static published code and local mocked layout verified; no authenticated AI request or live generation tested.'};
await writeFile('../../outputs/melhorias-integrais-20261030/verificacao-politica-editorial.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
