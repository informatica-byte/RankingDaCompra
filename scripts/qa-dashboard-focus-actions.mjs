import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const html=await readFile('dashboard.html','utf8'),css=await readFile('dashboard-mobile.css','utf8');
const links=[...html.matchAll(/<a href="[^"]+" target="_blank" rel="noopener">(?:Confirmar buscas no Search Console|Ver audiência completa no Analytics)<\/a>/g)].map(m=>m[0]);
assert.equal(links.length,2);
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
try{
 for(const width of [360,390,768]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.abort());const page=await context.newPage();
  await page.setContent(html.replace(/<script\b[^]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
  await page.evaluate(links=>{document.querySelector('#login-content').style.display='none';const a=document.querySelector('#admin-content');a.style.display='block';a.innerHTML='<section class="painel"><div class="foco-acoes">'+links.join('')+'</div></section>';},links);
  const before=await page.locator('.foco-acoes a').evaluateAll(es=>es.map(e=>({height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize)})));
  await page.addStyleTag({content:css});
  const after=await page.locator('.foco-acoes a').evaluateAll(es=>es.map(e=>({height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize),width:e.getBoundingClientRect().width,x:e.getBoundingClientRect().x})));
  if(width<=700)for(const a of after){assert.ok(a.height>=44);assert.ok(a.font>=14);assert.ok(a.x+a.width<=width);}
  else assert.equal(after[0].height,before[0].height);
  results.push({width,before,after,linksNotOpened:true});await context.close();
 }
 await mkdir('../../outputs/dashboard-focus-actions-20261119',{recursive:true});await writeFile('../../outputs/dashboard-focus-actions-20261119/qa.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
