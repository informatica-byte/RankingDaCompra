import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const root=process.cwd(),types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+sep)||path.split('/').some(p=>p.startsWith('.')))throw Error('Forbidden');res.setHeader('Content-Type',(types[extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base=process.env.RDC_QA_BASE||'http://127.0.0.1:'+server.address().port;
const out=resolve(root,'../../outputs/upgrade-comparador-20261118'+(process.env.RDC_QA_BASE?'/publico':''));await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),checks=[],errors=[];
try{
 for(const width of [360,390]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',r=>r.request().method()==='GET'&&r.request().url().startsWith(base+'/')?r.continue():r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/comparar.html?produto=ARscPKCMZs3D8k22qltl');await page.locator('.buyer-selection').waitFor();
  const privacy=page.getByRole('button',{name:'Recusar métricas',exact:true});if(await privacy.isVisible())await privacy.click();
  assert.equal(await page.locator('[data-buyer-same-type]').isChecked(),true);
  assert.match(await page.locator('.buyer-selection').innerText(),/1 de 3/);
  // P30i lacks an explicit reviewed in-ear format in this catalogue; do not
  // weaken that guard just to make a test pair selectable.
  await page.locator('[data-buyer-query]').fill('tw982');await page.locator('[data-buyer-select="kYzXt8BeErDzXsC6BlwB"]').check();
  assert.match(await page.locator('.buyer-selection').innerText(),/2 de 3/);
  assert.equal(await page.locator('[data-buyer-comparison] thead th').count(),3);
  await page.locator('[data-buyer-jump]').click();assert.equal(await page.locator('[data-buyer-comparison] h2').evaluate(e=>e===document.activeElement),true);
  const before=await page.locator('[data-buyer-comparison] tbody tr').count();
  await page.locator('[data-buyer-differences]').click();assert.equal(await page.locator('[data-buyer-differences]').getAttribute('aria-pressed'),'true');assert.ok(await page.locator('[data-buyer-comparison] tbody tr').count()<=before);
  assert.match(await page.locator('[data-buyer-comparison]').innerText(),/não é uma característica ausente/);
  await page.locator('[data-buyer-differences]').click();assert.equal(await page.locator('[data-buyer-comparison] tbody tr').count(),before);
  const scroll=page.locator('.buyer-table-scroll');await scroll.scrollIntoViewIfNeeded();
  assert.equal(await scroll.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'dois produtos lado a lado sem arrastar horizontalmente');
  assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),true);
  assert.equal(await scroll.locator('thead th').first().evaluate(e=>getComputedStyle(e).position),'sticky');
  await scroll.screenshot({path:resolve(out,'tabela-'+width+'.png')});
  await page.locator('[data-buyer-query]').fill('lp40');await page.locator('[data-buyer-select="rERcfIbgG1c0uUdNlQ4o"]').check();
  assert.equal(await page.locator('[data-buyer-comparison] thead th').count(),4);
  assert.equal(await scroll.evaluate(e=>e.scrollWidth>e.clientWidth),true,'três produtos mantêm rolagem interna');
  await page.locator('.buyer-selection [data-buyer-remove="rERcfIbgG1c0uUdNlQ4o"]').click();
  await page.locator('[data-buyer-same-type]').uncheck();await page.locator('[data-buyer-query]').fill('notebook');await page.locator('[data-buyer-select]').first().click();
  assert.match(await page.locator('[data-buyer-status]').innerText(),/mesmo tipo/);assert.match(await page.locator('.buyer-selection').innerText(),/2 de 3/);
  await page.locator('.buyer-selection [data-buyer-remove]').first().click();assert.match(await page.locator('.buyer-selection').innerText(),/1 de 3/);
  await page.locator('[data-buyer-clear-selection]').click();assert.equal(await page.locator('.buyer-selection').isVisible(),false);assert.equal(await page.locator('[data-buyer-comparison] table').count(),0);
  await page.goto(base+'/');for(const id of ['top6-editorial','comparativos-inicio','videos-inicio'])assert.equal(await page.locator('#'+id).isVisible(),true);
  checks.push({width,selectTwo:true,sameTypeGuard:true,selectionRemoval:true,clearSelection:true,onlyDifferences:true,stickyHeaders:true,localTableScroll:true,noBodyOverflow:true,homePreserved:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'qa.json'),JSON.stringify({checks,errors,externalRequestsBlocked:true,backendWrites:false},null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();await new Promise(done=>server.close(done));}
