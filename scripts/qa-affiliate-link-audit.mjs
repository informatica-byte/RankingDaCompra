import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const module=process.env.RDC_PLAYWRIGHT_MODULE;
const {chromium}=module?await import(pathToFileURL(module)):await import('playwright');
const assets=new Set(['affiliate-link-audit.js','affiliate-link-panel.js','affiliate-link-audit.css']);
const html=mobile=>`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/affiliate-link-audit.css"><style>body{font-family:Arial;margin:16px;color:#143b2b}.card,.painel{padding:14px;border:1px solid #ddd}button{font:inherit}</style><script src="/affiliate-link-audit.js"></script><script>
window.RDCInformational={enabled:true,esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
window.sourceReads=0;window.calls=[];window.securityResolved=false;window.cancelCalls=0;
window.record=Object.freeze({id:'jbl',titulo:'JBL Tune 520BT Fone sem fio',preco:100,link:'https://www.mercadolivre.com.br/p/MLB23997257?wid=MLB1234567890',linkAfiliado:'https://meli.la/test-only',linkShopee:'https://shopee.com.br/product/123/456'});
window.RDCAffiliateAuditSource=async()=>{sourceReads++;return [record];};
window.__RDC_BOT_LINKS_LOCAL__={version:'2.5.0',readOnly:true,ready:true};
window.conferirLinkAfiliadoNaAbaLocal=async row=>{calls.push({id:row.productId,market:row.market});return RDCAffiliateLinkAudit.classify(row,{url:row.expectedUrl,title:row.title,buyable:true,security:row.market==='shopee'&&!securityResolved});};
window.cancelarConferenciaLinksLocal=()=>cancelCalls++;
</script><script defer src="/affiliate-link-panel.js"></script></head><body><a href="#precos-mobile">Preços</a><button id="tab-precos">Preços</button><main id="${mobile?'app':'admin-content'}"><section id="${mobile?'precos-mobile':'painel-precos'}"><button>Conferir todos os preços</button><input id="historical-price" value="100"></section></main></body></html>`;
const server=http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname.slice(1);if(path==='dashboard.html'||path==='painel-celular.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html(path==='painel-celular.html'));}else if(assets.has(path)){res.setHeader('Content-Type',path.endsWith('css')?'text/css':'text/javascript');res.end(await readFile(resolve(root,path)));}else{res.statusCode=404;res.end();}}catch{res.statusCode=500;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:'chrome'});const errors=[],checked=[];await mkdir(resolve(root,'.informational-qa'),{recursive:true});
try{
 for(const file of ['dashboard.html','painel-celular.html']){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const original=window.setTimeout.bind(window);window.setTimeout=(fn,ms,...args)=>original(fn,ms===5000?0:ms,...args);});
  await page.goto(base+'/'+file);await page.locator('[data-audit-load]').waitFor();
  assert.equal(await page.locator('[data-audit-limit]').inputValue(),'20','limite conservador continua padrão');
  assert.equal(await page.locator('[data-audit-limit] option[value="all"]').innerText(),'Todos os pendentes');
  assert.equal(await page.locator('[data-audit-limit] option').allTextContents().then(x=>x.includes('100')),true);
  await page.locator('[data-audit-limit]').selectOption('all');
  assert.equal(await page.locator('body').evaluate(b=>b.scrollWidth<=innerWidth+1),true);assert.equal(await page.locator(file==='dashboard.html'?'#painel-precos':'#precos-mobile').isVisible(),false);
  assert.equal(await page.evaluate(()=>sourceReads),0);assert.equal(await page.evaluate(()=>calls.length),0);
  assert.match(await page.evaluate(async()=>{try{await conferirPrecoNaAbaLocal({});return '';}catch(e){return e.message;}}),/somente links/);
  await page.locator('[data-audit-load]').click();await page.waitForFunction(()=>!document.querySelector('[data-audit-start]').disabled);assert.equal(await page.evaluate(()=>sourceReads),1);
  await page.locator('[data-audit-start]').click();await page.waitForFunction(()=>document.querySelector('[data-audit-status]').textContent.includes('pausada para sua intervenção'),{timeout:20000});
  assert.equal(await page.evaluate(()=>calls.length),2);assert.match(await page.locator('[data-audit-summary]').innerText(),/1 confirmado/);
  const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('rdc-affiliate-audit-report-v1')));assert.equal(initial.records.length,2);assert.doesNotMatch(JSON.stringify(initial),/"preco"|"price"|token|credential/);
  await page.evaluate(()=>securityResolved=true);await page.locator('[data-audit-start]').click();await page.waitForFunction(()=>document.querySelector('[data-audit-status]').textContent.includes('Rodada concluída'));
  assert.equal(await page.evaluate(()=>calls.length),3);assert.match(await page.locator('[data-audit-summary]').innerText(),/2 confirmado/);assert.equal(await page.evaluate(()=>record.preco),100);
  const final=await page.evaluate(()=>JSON.parse(localStorage.getItem('rdc-affiliate-audit-report-v1')));assert.ok(final.records.every(x=>x.status==='active_same'));
  await page.screenshot({path:resolve(root,'.informational-qa','links-'+file.replace('.html','')+'-390.png'),fullPage:true});
  await page.setViewportSize({width:360,height:800});assert.equal(await page.locator('body').evaluate(b=>b.scrollWidth<=innerWidth+1),true);
  await page.reload();await page.locator('[data-audit-load]').click();await page.waitForFunction(()=>!document.querySelector('[data-audit-start]').disabled);await page.locator('[data-audit-start]').click();await page.waitForFunction(()=>document.querySelector('[data-audit-status]').textContent.includes('Rodada concluída'));
  assert.equal(await page.evaluate(()=>calls.length),0,'retomada não repete confirmados');assert.equal(await page.evaluate(()=>sourceReads),1);
  await page.evaluate(()=>{window.RDCAffiliateAuditSource=async()=>{sourceReads++;return [record,...Array.from({length:55},(_,i)=>({...record,id:'extra-'+i,linkShopee:''}))];};});
  await page.locator('[data-audit-load]').click();await page.waitForFunction(()=>!document.querySelector('[data-audit-start]').disabled);
  await page.locator('[data-audit-limit]').selectOption('10');await page.locator('[data-audit-start]').click();await page.waitForFunction(()=>document.querySelector('[data-audit-status]').textContent.includes('Rodada concluída'));
  assert.equal(await page.evaluate(()=>calls.length),10,'limite numérico respeitado');
  await page.locator('[data-audit-limit]').selectOption('all');await page.locator('[data-audit-start]').click();await page.waitForFunction(()=>document.querySelector('[data-audit-status]').textContent.includes('Rodada concluída'));
  assert.equal(await page.evaluate(()=>calls.length),55,'todos ultrapassa 50 e não repete os dez já confirmados');
  assert.match(await page.locator('[data-audit-summary]').innerText(),/57 confirmado/);
  assert.equal(await page.evaluate(()=>record.preco),100);
  await page.locator('[data-audit-start]').click();await page.waitForFunction(()=>document.querySelector('[data-audit-status]').textContent.includes('Rodada concluída'));
  assert.equal(await page.evaluate(()=>calls.length),55,'nova rodada todos não repete confirmados');
  checked.push(file+': limite numérico, todos acima de 50, pausa, retomada sem repetição, relatório, preservação do preço e layout 390/360 px');await context.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checked,errors,scope:'fixtures locais; sem Firestore, Analytics, credenciais ou consultas reais às lojas'},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
