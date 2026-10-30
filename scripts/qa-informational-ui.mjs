import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import home from '../informational-home.js';

// Development-only test: no logged-in browser, database, analytics or affiliate visits.
const root=resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const modulePath=process.env.RDC_PLAYWRIGHT_MODULE;
const playwright=modulePath?await import(pathToFileURL(modulePath)):await import('playwright');
const {chromium}=playwright.chromium?playwright:playwright.default;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 try{
  let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path==='/')path='/index.html';
  if(path.split('/').some(p=>p.startsWith('.'))||/\.(?:enc|key|pem|env)$/i.test(path))throw Error('Forbidden');
  const file=resolve(root,'.'+path);if(!file.startsWith(root+sep)||!(await stat(file)).isFile())throw Error('Missing');
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port;
const out=resolve(root,'.informational-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.RDC_QA_BROWSER_CHANNEL||'chrome'});
const results=[],errors=[];
try{
 const homeFeed=JSON.parse(await readFile(resolve(root,'informational-catalogue.json'),'utf8')),homeConfig=JSON.parse(await readFile(resolve(root,'site-config.json'),'utf8'));
 const shelfCount=home.collections(homeFeed).length,additional=home.collections(homeFeed).reduce((n,s)=>n+s.products.length,0),homeCount=home.selection(homeFeed).length+additional;
 const staticContext=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 await staticContext.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 const staticPage=await staticContext.newPage();await staticPage.goto(base+'/');
 assert.match(await staticPage.locator('[data-info-home-static]').innerText(),/Top 6/);
 assert.equal(await staticPage.locator('[data-info-home-static] #comparativos-inicio nav a').count(),home.guides(homeFeed).length);
 assert.equal(await staticPage.locator('[data-info-home-static] [data-info-video-product]').count(),home.videos(homeFeed,homeConfig).length);
 assert.equal(await staticPage.locator('[data-info-home-static] [data-info-shelf] [data-info-product]:visible').count(),additional,'produtos das categorias expostos sem JavaScript');
 assert.equal(await staticPage.locator('[data-info-home-static] iframe').count(),0);await staticContext.close();results.push('Top 6, guias e links dos vídeos rastreáveis sem JavaScript');
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await context.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(base)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
  if(route.request().resourceType()==='image'&&url.startsWith('https://rankingdacompra.com.br/produto/imagens/')){
   const path=new URL(url).pathname;
   return readFile(resolve(root,'.'+path)).then(body=>route.fulfill({contentType:types[extname(path)]||'image/jpeg',body})).catch(()=>route.abort());
  }
  // Product images only. Block SDKs, sales, analytics, APIs, pixels and storefronts.
  if(route.request().resourceType()==='image'&&/^https:\/\/(?:http2\.mlstatic\.com|rankingdacompra\.com\.br)\//.test(url))return route.continue();
  return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 async function check(label){
  assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),true,label+': overflow');
  const text=await page.locator('body').innerText();assert.doesNotMatch(text,/R\$\s*\d|\d+%\s*OFF|preço conferido em|conferir preço atual/i,label+': preço');
  results.push(label);
 }
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-info-home-restored]').waitFor();await check('início 390px sem Firebase');
 assert.equal(await page.locator('[data-info-home-restored] [data-info-product]').count(),homeCount);
 assert.equal(await page.locator('[data-info-home-restored] [data-info-shelf]').count(),shelfCount);
 assert.equal(await page.locator('[data-info-home-restored] [data-info-shelf] [data-info-product]:visible').count(),additional);
 assert.match(await page.locator('[data-info-home-restored] [data-best-title]').innerText(),/Top 6/);
 assert.equal(await page.locator('[data-info-home-restored] #comparativos-inicio nav a').count(),home.guides(homeFeed).length);
 assert.equal(await page.locator('[data-info-home-restored] [data-info-video-card]').count(),home.videos(homeFeed,homeConfig).length);
 assert.equal(await page.locator('[data-info-home-restored] iframe').count(),0,'nenhum player carrega sozinho');
 await page.locator('[data-info-home-restored] .info-home-more').first().locator('summary').click();
 assert.equal(await page.locator('[data-info-home-restored] #comparativos-inicio nav a:visible').count(),home.guides(homeFeed).length);
 await page.locator('[data-info-home-restored] .info-home-more').first().locator('summary').click();
 results.push('Top 6, 31 comparativos e 14 vídeos com ficha exata, sem reprodução automática');
 const initialPrivacy=page.getByRole('button',{name:'Recusar métricas',exact:true});if(await initialPrivacy.isVisible())await initialPrivacy.click();
 await page.screenshot({path:resolve(out,'inicio-mobile.png'),fullPage:true});
 await page.locator('[data-info-home-restored] #comparativos-inicio').screenshot({path:resolve(out,'comparativos-inicio-mobile.png')});
 for(const width of [360,768,1366]){await page.setViewportSize({width,height:900});await check('vitrine ampliada '+width+'px');}
 await page.setViewportSize({width:390,height:844});
 for(const img of await page.locator('[data-info-shelf] img').all()){
  await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());
  assert.equal(await img.evaluate(el=>el.complete&&el.naturalWidth>0),true,'foto existente da seleção carregada');
 }
 await page.locator('[data-info-shelf]').first().screenshot({path:resolve(out,'vitrine-fones-mobile.png')});
 await page.locator('[data-info-home-restored] #videos-inicio').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'videos-inicio-mobile.png')});
 assert.match(await page.locator('h1').innerText(),/Escolha com clareza/);
 assert.equal(await page.locator('#rdc-ambient-music button').first().getAttribute('aria-pressed'),'false');
 await page.locator('#info-search').fill('fone');await page.locator('#info-search').press('Enter');
 // Continuous navigation may keep the destination in its owned iframe.
 let destination=page;
 const frame=page.locator('iframe[data-rdc-navigation-frame]');
 await page.waitForTimeout(1200);
 for(const f of page.frames())if(f.url().includes('/comparar.html'))destination=f;
 if(!destination.url().includes('/comparar.html')){await page.goto(base+'/comparar.html?q=fone');destination=page;}
 await destination.locator('[data-buyer-results] .buyer-card').first().waitFor();
 await destination.locator('[data-buyer-query]').fill('');
 await destination.locator('[data-buyer-need]').selectOption('study');
 assert.ok(await destination.locator('[data-buyer-results] .buyer-card').count());
 assert.equal(await destination.locator('[data-buyer-results]').evaluate(el=>el.innerText.includes('Atalhos por tipo')),false);
 await destination.locator('[data-buyer-need]').selectOption('audio');
 assert.ok(await destination.locator('[data-buyer-results] .buyer-card').count());
 await destination.locator('[data-buyer-need]').selectOption('');await destination.locator('[data-buyer-query]').fill('fone');
 results.push('atalhos por necessidade filtram sem escolher produtos nem misturar a seleção comparável');
 assert.equal(await destination.locator('[data-buyer-budget]').isVisible(),false);
 assert.equal(await destination.locator('[data-buyer-recent]').isVisible(),false);
 const choices=destination.locator('[data-buyer-select]');assert.ok(await choices.count()>1);
 await choices.first().check();
 const same=await choices.first().evaluate(el=>el.closest('label').textContent.split('·').slice(1).join('·').trim());
 const ids=await choices.evaluateAll((nodes,same)=>nodes.filter(el=>el.closest('label').textContent.split('·').slice(1).join('·').trim()===same).map(el=>el.dataset.buyerSelect),same);
 if(ids.length>1){await destination.locator('[data-buyer-select="'+ids[1]+'"]').check();assert.ok(await destination.locator('[data-buyer-comparison] table').count());}
 assert.doesNotMatch(await destination.locator('body').innerText(),/R\$\s*\d|Preço e conferência/);
 results.push('comparador sem orçamento; seleção equivalente');
 await page.screenshot({path:resolve(out,'comparador-mobile.png'),fullPage:true});
 await page.goto(base+'/como-avaliamos.html',{waitUntil:'domcontentloaded'});
 await page.locator('[data-editorial-scope]').waitFor();
 for(const width of [360,390,768,1366]){await page.setViewportSize({width,height:900});await check('limites da análise documental '+width+'px');}
 assert.match(await page.locator('[data-editorial-scope]').innerText(),/Data do texto não é data de estoque/);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:resolve(out,'metodologia-mobile.png'),fullPage:true});
 const feed=JSON.parse(await readFile(resolve(root,'informational-catalogue.json'),'utf8'));
 const featured=feed.products.find(p=>p.comparison?.features?.length>=4&&feed.selected.includes(p.id));assert.ok(featured);
 const productPath=new URL(featured.url).pathname;
 await page.goto(base+productPath,{waitUntil:'domcontentloaded'});await check('ficha mobile com fontes');
 assert.equal(await page.locator('[data-decision-brief]').count(),1);assert.match(await page.locator('[data-decision-brief]').innerText(),/Para quem|Informações ainda limitadas/);
 assert.ok(await page.locator('[data-informational-faq] details,[data-reviewed-depth] details').count());
 const links=await page.locator('#affiliate-offer,#mobile-affiliate-offer,#affiliate-offer-shopee').evaluateAll(nodes=>nodes.map(el=>({id:el.id,href:el.href,rel:el.rel})));
 assert.ok(links.length);for(const link of links){assert.match(link.href,/^https:\/\//);assert.match(link.rel,/sponsored/);}
 results.push('afiliados preservados; nenhum link externo visitado');
 await page.screenshot({path:resolve(out,'ficha-mobile.png'),fullPage:true});
 const depth={products:(await Promise.all(['featured-analysis.json','popular-analysis.json','next-popular-analysis.json','campaign-analysis.json','documented-analysis-20261030.json','network-analysis-20261030.json','office-mobile-analysis-20261030.json','home-analysis-20261030.json'].map(async file=>JSON.parse(await readFile(resolve(root,file),'utf8'))))).flatMap(batch=>batch.products)};
 for(const entry of depth.products){
  const item=feed.products.find(p=>p.id===entry.id);assert.ok(item,'destaque publicado');
  await page.goto(base+new URL(item.url).pathname,{waitUntil:'domcontentloaded'});
  const review=page.locator('[data-reviewed-depth="'+entry.id+'"]');await review.waitFor();
  assert.equal(await review.locator('details').count(),entry.questions.length);
  assert.match(await review.innerText(),/Vantagens para avaliar/);assert.match(await review.innerText(),/Limitações que podem pesar/);
  const question=review.locator('details').first();await question.locator('summary').click();assert.equal(await question.getAttribute('open'),'');
  await check('análise aprofundada mobile: '+entry.id);
  if(entry.id==='O6e0R2WtiZfyyf2MJe5Y')assert.match(await review.innerText(),/Ryzen 5 40/);
  await review.screenshot({path:resolve(out,'analise-'+entry.id+'.png')});
 }
 await page.setViewportSize({width:360,height:800});await check('ficha 360px');
 for(const id of ['Bf3ccSwSiVkLw1Z8k2Hu','SnMMDq9bDXiMWX0IXYdO','DjihMK3g3rkBHHTPbOwp','pO6CZCNo99YwtpIW0UB8']){
  const item=feed.products.find(p=>p.id===id);if(!item)continue;
  await page.goto(base+new URL(item.url).pathname,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('h1').innerText(),item.title);
  assert.match(item.title,/ — anúncio MLB\d+$/);
  await check('título de anúncio distinto 360px: '+id);
  await page.screenshot({path:resolve(out,'titulo-'+id+'-mobile.png')});
 }
 await page.goto(base+'/melhores-fones-de-ouvido.html');await check('guia 360px');
 await page.goto(base+'/melhores-escolhas.html');await page.locator('[data-info-product]').first().waitFor();await check('seleção permanente 360px');
 await page.goto(base+'/analises.html');await check('diretório de análises 360px');
 await page.setViewportSize({width:1366,height:900});await page.goto(base+'/');await page.locator('[data-info-product]').first().waitFor();await check('início desktop');
 await page.screenshot({path:resolve(out,'inicio-desktop.png'),fullPage:true});
 // Exercise the persistent music/navigation owner, without leaving this server.
 const privacy=page.getByRole('button',{name:'Recusar métricas',exact:true});if(await privacy.isVisible())await privacy.click();
 await page.locator('#rdc-music-toggle').click();await page.waitForFunction(()=>document.getElementById('rdc-music-toggle')?.getAttribute('aria-pressed')==='true');
 await page.locator('[data-info-product] > a').first().click();
 await page.waitForFunction(()=>!!document.querySelector('#rdc-original-page'));
 const inner=page.frames().find(f=>f!==page.mainFrame()&&f.url().includes('/produto/'));assert.ok(inner,'navegação contínua da ficha');
 assert.equal(await inner.locator('#rdc-music-toggle').getAttribute('aria-pressed'),'true');
 assert.doesNotMatch(await inner.locator('body').innerText(),/R\$\s*\d|Preço conferido em/);
 results.push('música preservada durante navegação até a ficha');
 await page.goto(base+'/');await page.locator('#rdc-music-toggle').waitFor();assert.equal(await page.locator('#rdc-music-toggle').getAttribute('aria-pressed'),'false');
 await page.locator('[data-info-home-restored]').waitFor();
 const plays=page.locator('[data-info-home-restored] [data-info-video-play]');await plays.nth(0).click();
 assert.equal(await page.locator('[data-info-home-restored] iframe').count(),1);assert.match(await page.locator('[data-info-home-restored] iframe').getAttribute('src'),/^https:\/\/www.youtube-nocookie.com\/embed\/[\w-]{11}\?/);
 await plays.nth(1).click();assert.equal(await page.locator('[data-info-home-restored] iframe').count(),1,'trocar de vídeo encerra o player anterior');
 results.push('player sob clique e apenas um vídeo tocando por vez; YouTube externo bloqueado no teste');
 // A public feed failure cannot erase the server-rendered shelves or require a reload.
 const offlineContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await offlineContext.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 const offline=await offlineContext.newPage();offline.on('pageerror',e=>errors.push(e.message));let unavailable=true;
 await offline.route('**/informational-catalogue.json',route=>unavailable?route.fulfill({status:503,contentType:'application/json',body:'{}'}):route.continue());
 await offline.goto(base+'/',{waitUntil:'domcontentloaded'});await offline.locator('[data-info-retry]').waitFor();
 const offlinePrivacy=offline.getByRole('button',{name:'Recusar métricas',exact:true});if(await offlinePrivacy.isVisible())await offlinePrivacy.click();
 assert.ok((await offline.locator('[data-info-retry]').boundingBox()).height>=44);
 assert.equal(await offline.locator('[data-info-home-static]').isVisible(),true,'vitrine publicada continua visível na falha');
 assert.equal(await offline.locator('[data-info-home-static] #comparativos-inicio nav a').count(),home.guides(homeFeed).length);
 assert.equal(await offline.locator('[data-info-home-static] [data-info-video-product]').count(),home.videos(homeFeed,homeConfig).length);
 assert.equal(await offline.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),true);
 await offline.screenshot({path:resolve(out,'recuperacao-vitrine-mobile.png'),fullPage:true});
 await offline.locator('[data-info-recovery]').screenshot({path:resolve(out,'aviso-recuperacao-mobile.png')});
 unavailable=false;await offline.locator('[data-info-retry]').click();await offline.locator('[data-info-home-restored]').waitFor();
 assert.equal(await offline.locator('[data-info-recovery]').count(),0);
 unavailable=true;await offline.goto(base+'/comparar.html',{waitUntil:'domcontentloaded'});await offline.locator('[data-buyer-retry]').waitFor();
 assert.ok((await offline.locator('[data-buyer-retry]').boundingBox()).height>=44);
 assert.equal(await offline.locator('[data-buyer-catalog] a[href="/analises.html"]').isVisible(),true);
 unavailable=false;await offline.locator('[data-buyer-retry]').click();await offline.locator('[data-buyer-results] .buyer-card').first().waitFor();
 assert.equal(await offline.locator('[data-buyer-retry]').count(),0);assert.equal(await offline.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),true);
 results.push('HTTP 503 preserva vitrine/Top 6/guias/vídeos; retentativa manual recupera home e comparador sem recarregar');
 await offlineContext.close();
 // Isolated admin markup: only the informational helper runs, without SDK/login/write.
 for(const file of ['dashboard.html','painel-celular.html']){
  const html=(await readFile(resolve(root,file),'utf8')).replace(/<script\b[^]*?<\/script>/gi,'').replace('</head>','<script src="/informational-mode.js"></script></head>');
  await page.route(base+'/'+file,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html}));
  await page.goto(base+'/'+file,{waitUntil:'domcontentloaded'});
  for(const id of file==='dashboard.html'?['preco','precoAnterior','nota']:['atual','anterior'])assert.equal(await page.locator('#'+id).isVisible(),false,file+': '+id);
  results.push(file+': cadastro sem preço, teste isolado sem gravação');
 }
 assert.deepEqual(errors,[],'erros JavaScript no teste público');
 console.log(JSON.stringify({passed:results,screenshots:out,errors},null,2));
 await context.close();
}finally{await browser.close();await new Promise(done=>server.close(done));}
