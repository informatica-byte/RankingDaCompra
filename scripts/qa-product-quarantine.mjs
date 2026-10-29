import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const assets=['affiliate-link-audit.js','product-removal-safety.js','product-quarantine.js','product-quarantine-panel.js','affiliate-link-review.js','affiliate-link-progress.js','affiliate-link-panel.js'];
const server=http.createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname.slice(1);try{
 if(assets.includes(path)||path==='affiliate-link-audit.css'){res.setHeader('Content-Type',path.endsWith('.css')?'text/css':'text/javascript');return res.end(await readFile(resolve(root,path)));}
 if(!['dashboard.html','painel-celular.html'].includes(path)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/affiliate-link-audit.css"><style>body{font-family:Arial;margin:12px;color:#163b2c}button{font:inherit}</style>'+assets.slice(0,-1).map(file=>'<script src="/'+file+'"></script>').join('')+'<main id="'+(path==='dashboard.html'?'admin-content':'app')+'"></main><script>window.RDCInformational={enabled:true,esc:v=>String(v??"").replace(/[&<>"\x27]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;","\x27":"&#39;"}[c]||c))};</script><script defer src="/affiliate-link-panel.js"></script>');
 }catch{res.statusCode=500;res.end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port,out=resolve(root,'.informational-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],passed=[];
try{
 for(const file of ['dashboard.html','painel-celular.html'])for(const mode of ['delete','returned','manual']){
  const context=await browser.newContext({viewport:{width:360,height:800}});await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{const original=setTimeout.bind(window);window.setTimeout=(fn,ms,...args)=>original(fn,ms===5000?0:ms,...args);});
  await page.goto(base+'/'+file);await page.evaluate(mode=>{
   window.fixtureNow=Date.now();Date.now=()=>fixtureNow;window.writes=[];window.registry={version:1,ids:[]};window.blocked=false;window.back=mode==='manual';window.calls=[];
   window.current={id:'gone',titulo:'Produto fictício para teste local',foto:'https://http2.mlstatic.com/photo.jpg',link:'https://www.mercadolivre.com.br/fone/p/MLB23997257?wid=MLB1234567890',linkAfiliado:'https://meli.la/test',preco:123};
   window.__RDC_BOT_LINKS_LOCAL__={version:'2.5.3',readOnly:true};window.RDCAffiliateAuditSource=async()=>current?[{...current}]:[];
   window.conferirLinkAfiliadoNaAbaLocal=async row=>{calls.push(row.productId);return {...RDCAffiliateLinkAudit.classify(row,{url:row.checkUrl,title:row.title,buyable:back,security:blocked,unavailable:!back,primaryNotice:true}),checkedAt:fixtureNow};};
   window.RDCProductQuarantineAccess=RDCProductQuarantine.create({authorize:()=> 'owner',read:async()=>({...current}),now:()=>fixtureNow,serverNow:async()=>fixtureNow,timestamp:()=> 'fixture-time',invalidate(){},transact:async(id,work)=>{
    const ops=[];const result=await work({read:async()=>({...current}),registry:async()=>registry,update:p=>ops.push(['update',p]),saveRegistry:r=>ops.push(['registry',r]),removeProduct:()=>ops.push(['delete'])});
    for(const [kind,value]of ops){writes.push([kind,value]);if(kind==='update')current={...current,...value};if(kind==='registry')registry=value;if(kind==='delete')current=null;}return result;
   }});
  },mode);
  await page.locator('[data-audit-load]').click();await page.waitForFunction(()=>!document.querySelector('[data-audit-start]').disabled);await page.locator('[data-audit-start]').click();await page.waitForFunction(()=>document.querySelector('[data-audit-status]').textContent.includes('Rodada concluída'));
  if(mode==='manual')await page.locator('[data-audit-filter]').selectOption('all');
  const button=page.locator('[data-quarantine]');await button.waitFor();assert.equal(await button.innerText(),'⏳ Colocar em quarentena por 40 dias');assert.equal(await page.evaluate(()=>writes.length),0);
  page.once('dialog',d=>d.dismiss());await button.click();await page.waitForFunction(()=>!document.querySelector('[data-quarantine]').disabled);assert.equal(await page.evaluate(()=>writes.length),0,'cancelar confirmação não grava');
  page.on('dialog',d=>d.type()==='prompt'?d.accept('QUARENTENA 40 gone'):d.accept());await button.click();await page.waitForFunction(()=>document.querySelector('[data-quarantine]').textContent==='Cancelar quarentena');
  assert.equal(await page.evaluate(()=>current.preco),123);assert.equal(await page.evaluate(()=>current.conferenciaPausada),true);assert.equal(await page.evaluate(()=>writes.length),1);
  await page.locator('[data-audit-filter]').selectOption('quarantine');assert.equal(await page.locator('[data-audit-row]').count(),1);assert.match(await page.locator('[data-quarantine-info]').innerText(),/40 dia/);assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),true);
  await page.locator('[data-audit-row]').screenshot({path:resolve(out,'quarentena-'+file.replace('.html','')+'-360.png')});
  if(mode==='manual'){
   const snapshot=await page.evaluate(()=>({records:JSON.parse(localStorage.getItem('rdc-affiliate-audit-report-v1')).records,calls,writes,registry}));
   assert.equal(snapshot.records.length,1);assert.equal(snapshot.records[0].status,'available','quarentena manual não falsifica resultado como indisponível');assert.equal(snapshot.calls.length,1,'entrada manual não repete conferência');assert.equal(snapshot.writes.length,1);assert.deepEqual(snapshot.registry.ids,[]);
   const card=page.locator('[data-audit-row]');
   for(const width of [360,390,768,1366]){await page.setViewportSize({width,height:900});const box=await button.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width+1&&box.height>=44);assert.equal(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);}
  }else if(mode==='returned'){
   await page.evaluate(()=>{fixtureNow+=86400000;back=true;});await page.locator('[data-audit-start]').click();await page.waitForFunction(()=>document.querySelector('[data-audit-status]').textContent.includes('Anúncio voltou'));
   assert.equal(await page.evaluate(()=>current.quarentenaAnuncio),null);assert.equal(await page.evaluate(()=>current.conferenciaPausada),false);assert.equal(await page.evaluate(()=>registry.ids.length),0);assert.equal(await page.evaluate(()=>current.preco),123);
  }else{
   await page.evaluate(()=>{fixtureNow+=39*86400000;});await page.locator('[data-audit-start]').click();await page.waitForFunction(()=>document.querySelector('[data-audit-status]').textContent.includes('Rodada concluída'));assert.equal(await page.evaluate(()=>writes.length),1,'39 dias não excluem');
   await page.evaluate(()=>{fixtureNow+=86400000;blocked=true;});await page.locator('[data-audit-start]').click();await page.waitForFunction(()=>document.querySelector('[data-audit-status]').textContent.includes('pausada para sua intervenção'));assert.equal(await page.evaluate(()=>writes.length),1,'CAPTCHA depois do prazo não exclui');
   await page.evaluate(()=>{blocked=false;});await page.locator('[data-audit-start]').click();await page.waitForFunction(()=>document.querySelector('[data-audit-status]').textContent.includes('Cadastro excluído após 40 dias'));
   assert.equal(await page.evaluate(()=>current),null);assert.deepEqual(await page.evaluate(()=>registry.ids),['gone']);assert.deepEqual(await page.evaluate(()=>writes.map(x=>x[0])),['update','registry','delete']);assert.equal(await page.locator('[data-audit-row]').count(),0);
  }
  passed.push(file+': '+mode+'; confirmação, prazo, CAPTCHA, retorno, preços e layout seguros');await context.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed,errors,scope:'Somente fixtures locais; nenhuma chamada ao Firebase ou Mercado Livre, nenhum produto real alterado.'},null,2));
}finally{await browser.close();await new Promise(done=>server.close(done));}
