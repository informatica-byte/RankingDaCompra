import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const html=await readFile('index.html','utf8'),previous=execFileSync('git',['show','HEAD:index.html'],{encoding:'utf8',maxBuffer:20000000});
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[],out=resolve('../../outputs/renewed-highlights-20261120');await mkdir(out,{recursive:true});
try{
 for(const width of [360,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin==='https://rankingdacompra.com.br'&&/^\/produto\/imagens\/[\w-]+\.(?:jpg|webp|png)$/.test(u.pathname)){try{return await r.fulfill({body:await readFile('.'+u.pathname),contentType:u.pathname.endsWith('.webp')?'image/webp':u.pathname.endsWith('.png')?'image/png':'image/jpeg'});}catch{}}return r.abort();});const page=await context.newPage();
  const clean=s=>s.replace(/<script\b[^]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
  page.setDefaultTimeout(10000);console.log('viewport',width);
  await page.setContent(clean(previous),{waitUntil:'domcontentloaded'});const preserved=await page.locator('#melhores-escolhas,#comparativos-inicio,#videos-inicio').evaluateAll(es=>es.map(e=>e.outerHTML));
  await page.setContent(clean(html),{waitUntil:'domcontentloaded'});for(const f of ['informational-mode.css','informational-home.css'])await page.addStyleTag({content:await readFile(f,'utf8')});
  assert.deepEqual(await page.locator('#melhores-escolhas,#comparativos-inicio,#videos-inicio').evaluateAll(es=>es.map(e=>e.outerHTML)),preserved);
  assert.equal(await page.locator('[data-home-highlight]').count(),6);
  assert.equal(await page.locator('#destaques-renovados').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
  for(const e of await page.locator('[data-home-highlight]').all()){const b=await e.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width+1);}
  assert.match(await page.locator('#destaques-renovados').innerText(),/28\/09 a 25\/10\/2026/);
  await page.locator('#destaques-renovados').screenshot({path:resolve(out,'destaques-'+width+'.png'),animations:'disabled',timeout:10000});results.push({width,cards:6,previousSectionsIdentical:true,noActionsTriggered:true});await context.close();
 }
 await writeFile(resolve(out,'qa.json'),JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close();}
