import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const root=process.cwd(),types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+sep)||path.split('/').some(p=>p.startsWith('.')))throw Error('Forbidden');res.setHeader('Content-Type',(types[extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
const out=resolve(root,'../../outputs/upgrade-busca-20261118');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),checks=[],errors=[];
try{
 for(const width of [360,390]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('#catalogue-query').waitFor();
  const privacy=page.getByRole('button',{name:'Recusar métricas',exact:true});if(await privacy.isVisible())await privacy.click();
  for(const id of ['top6-editorial','comparativos-inicio','videos-inicio'])assert.ok(await page.locator('#'+id).isVisible());
  assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),true);
  for(const sel of ['#catalogue-query','#catalogue-category','#catalogue-purpose','.info-search-filters button']){const box=await page.locator(sel).boundingBox();assert.ok(box.height>=44&&box.x>=0&&box.x+box.width<=width+1);}
  await page.locator('.info-search-panel').screenshot({path:resolve(out,'filtros-'+width+'.png')});
  await page.locator('#catalogue-category').selectOption('Fones de ouvido');await page.locator('#catalogue-purpose').selectOption('audio-video');await page.locator('#catalogue-query').fill('redmi');await page.locator('.info-search-filters button').click();
  await page.locator('[data-search-count]').waitFor();assert.match(page.url(),/categoria=Fones/);assert.match(page.url(),/finalidade=audio-video/);
  assert.equal(await page.locator('#catalogue-query').inputValue(),'redmi');assert.equal(await page.locator('#catalogue-purpose').inputValue(),'audio-video');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
  await page.reload();await page.locator('[data-search-count]').waitFor();
  assert.equal(await page.locator('#catalogue-category').inputValue(),'Fones de ouvido');assert.equal(await page.locator('#catalogue-purpose').inputValue(),'audio-video');
  assert.ok(await page.locator('[data-info-product]').count()>0);
  for(const title of await page.locator('[data-info-product] h3').allTextContents())assert.match(title,/redmi/i);
  assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),true);
  await page.screenshot({path:resolve(out,'resultados-'+width+'.png')});
  await page.locator('#catalogue-query').fill('zzzzsemresultado');await page.locator('.info-search-filters button').click();await page.getByText('Nenhum produto corresponde à combinação.').waitFor();
  await page.locator('[data-search-clear]').click();await page.locator('[data-search-count]').waitFor();
  const initial=await page.locator('[data-info-product]').count();assert.equal(initial,72);
  await page.getByRole('button',{name:'Mostrar mais resultados',exact:true}).click();assert.equal(await page.locator('[data-info-product]').count(),96);
  await page.reload();await page.locator('[data-search-count]').waitFor();assert.equal(await page.locator('#catalogue-category').inputValue(),'');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
  checks.push({width,noOverflow:true,touchTargets:true,homeSectionsPreserved:true,combinedFilters:true,emptyState:true,clear:true,pagination:true,reload:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'qa.json'),JSON.stringify({checks,errors,externalRequestsBlocked:true},null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();await new Promise(done=>server.close(done));}
