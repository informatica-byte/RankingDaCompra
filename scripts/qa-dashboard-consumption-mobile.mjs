import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const html=await readFile('dashboard.html','utf8'),css=await readFile('dashboard-mobile.css','utf8');
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
try{
 for(const width of [360,390,768]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.abort());const page=await context.newPage();
  await page.setContent(html.replace(/<script\b[^]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
  await page.evaluate(()=>{document.querySelector('#login-content').style.display='none';document.querySelector('#admin-content').style.display='block';});
  const measure=()=>page.locator('.painel-consumo summary,.painel-consumo .consumo-acoes a').evaluateAll(es=>es.map(e=>({height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize),x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width})));
  const before=await measure();await page.addStyleTag({content:css});const after=await measure();
  if(width<=700){for(const a of after){assert.ok(a.height>=44,JSON.stringify({width,a}));assert.ok(a.font>=14);assert.ok(a.x+a.width<=width);}assert.ok(await page.locator('.painel-consumo .consumo-hora').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=14);}
  else assert.deepEqual(after,before);
  assert.equal(await page.locator('#btn-consumo-automatico').isHidden(),true);
  assert.equal(await page.locator('#btn-consumo-salvar').isDisabled(),true);
  assert.ok(await page.locator('.painel-consumo').evaluate(e=>e.scrollWidth<=e.clientWidth));
  results.push({width,before,after,noActionsTriggered:true});await context.close();
 }
 await mkdir('../../outputs/dashboard-consumption-mobile-20261120',{recursive:true});await writeFile('../../outputs/dashboard-consumption-mobile-20261120/qa.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
