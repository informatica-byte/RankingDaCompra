import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const batch=process.argv[2];assert.match(batch||'',/^\d+$/);
const date=process.argv[3]||'20261031';assert.match(date,/^\d{8}$/);
const manifest=JSON.parse(await readFile(`docs/targeted-triage${batch}-${date}.json`,'utf8'));
const catalogue=JSON.parse(await readFile('informational-catalogue.json','utf8'));
const module=process.env.RDC_PLAYWRIGHT_MODULE;assert.ok(module,'Set the existing Playwright runtime module');
const {chromium}=await import(pathToFileURL(module));
const output=resolve(`.informational-qa/triage${batch}`);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const checked=[];
try {
 const context=await browser.newContext({javaScriptEnabled:false});
 await context.route('**/*',route=>route.abort()); // No Firebase, analytics, fonts or affiliate destinations.
 const page=await context.newPage();
 for(const record of manifest.items){
  const product=catalogue.products.find(p=>p.id===record.id);assert.ok(product);
  const html=await readFile(new URL(product.url).pathname.slice(1),'utf8');
  let expectedHeading=product.title;
  if(record.decision==='screened_no_change'){
   // Preserve an existing display truncation on a deliberately unchanged page.
   // Compare its exact pre-edit H1, not a looser prefix or shortened fixture.
   const baseline=execFileSync('git',['show','HEAD:'+new URL(product.url).pathname.slice(1)],{encoding:'utf8',maxBuffer:2000000});
   await page.setContent(baseline,{waitUntil:'domcontentloaded'});
   expectedHeading=await page.locator('h1').innerText();
  }
  for(const width of [360,390]){
   await page.setViewportSize({width,height:844});await page.setContent(html,{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('h1').innerText(),expectedHeading);
   assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),true,record.id+' overflow '+width);
   assert.doesNotMatch(await page.locator('body').innerText(),/R\$\s*\d/);
   assert.ok(await page.locator('#affiliate-offer').getAttribute('href'));
   checked.push({id:record.id,width,passed:true});
  }
  await page.screenshot({path:resolve(output,record.id+'.png'),fullPage:true});
 }
 await context.close();console.log(JSON.stringify({checked,output,scope:'Static local mobile rendering, external requests blocked; no physical-device or product test.'}));
} finally {await browser.close();}
