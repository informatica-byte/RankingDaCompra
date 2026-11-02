import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const runtime=process.env.RDC_PLAYWRIGHT_MODULE;assert.ok(runtime);
const {chromium}=await import(pathToFileURL(runtime));
const html=await readFile('painel-celular.html','utf8');
const browser=await chromium.launch({headless:true,channel:'chrome'});
const output='../../outputs/melhorias-integrais-20261030';await mkdir(output,{recursive:true});
try{
 const context=await browser.newContext({javaScriptEnabled:false});await context.route('**/*',r=>r.abort());
 const page=await context.newPage(),checks=[];
 for(const width of [360,390,768]){
  await page.setViewportSize({width,height:844});await page.setContent(html,{waitUntil:'domcontentloaded'});
  // Test only static authenticated layout; no login, Firebase requests or writes.
  await page.locator('#app').evaluate(e=>e.style.display='block');await page.locator('#login').evaluate(e=>e.style.display='none');
  const link=page.locator('#express-criar-paginas');await link.scrollIntoViewIfNeeded();assert.ok(await link.isVisible());
  const box=await link.boundingBox();assert.ok(box.height>=48&&box.x>=0&&box.x+box.width<=width+1);
  assert.equal(await link.getAttribute('target'),'_blank');assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),true);
  await link.focus();assert.equal(await link.evaluate(e=>e===document.activeElement),true);
  await page.screenshot({path:output+'/mobile-create-pages-'+width+'.png'});checks.push({width,visible:true,noOverflow:true,keyboardFocus:true});
 }
 await context.close();await writeFile(output+'/mobile-create-pages-qa.json',JSON.stringify({checks,noExternalRequests:true,noLoginOrBackendWrites:true},null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();}
