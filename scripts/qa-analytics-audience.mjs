import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
// Local fixtures only: no login, real Google consent, metrics, sales or Firebase.
const root=resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+path);
  if(path.split('/').some(p=>p.startsWith('.'))||!file.startsWith(root+sep)||!(await stat(file)).isFile())throw Error('missing');
  let body=await readFile(file);
  if(['/dashboard.html','/painel-celular.html'].includes(path))body=Buffer.from(body.toString('utf8').replace(/<script\b[^]*?<\/script>/gi,'').replace('</head>','<script defer src="/analytics-audience.js"></script><style>#admin-content,#app{display:block!important}#login,#login-content{display:none!important}</style></head>'));
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(body);
 }catch{res.statusCode=404;res.end('Missing');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port,out=resolve(root,'.informational-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:390,height:844}});
let requests=0,billing=false;const errors=[],violations=[];
const fixtureTime=Date.parse('2026-10-27T18:00:00Z');
await context.addInitScript(at=>{window.fixtureUser='owner';window.fixtureNow=at;Date.now=()=>window.fixtureNow;window.RDCAnalyticsUserId=()=>window.fixtureUser;},fixtureTime);
await context.route('**/*',async route=>{
 const req=route.request(),url=req.url();if(url.startsWith(base))return route.continue();
 if(url==='https://accounts.google.com/gsi/client')return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{oauth2:{initTokenClient:function(options){window.fixtureScope=options.scope;window.fixtureInclude=options.include_granted_scopes;return {requestAccessToken:function(){options.callback({access_token:"local-fixture-token",scope:options.scope,expires_in:3600});}};}}}};'});
 if(url==='https://analyticsdata.googleapis.com/v1beta/properties/545546219:batchRunReports'){
  requests++;assert.equal(req.method(),'POST');const body=req.postDataJSON();assert.equal(body.requests.length,3);assert.doesNotMatch(JSON.stringify(body),/purchase|revenue|conversions/);
  if(billing)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{details:[{reason:'BILLING_DISABLED'}]}})});
  return route.fulfill({contentType:'application/json',body:JSON.stringify({reports:[1,7,14].map(n=>({metricHeaders:['sessions','totalUsers','screenPageViews'].map(name=>({name})),rowCount:1,rows:[{metricValues:[n+requests,2*n+requests,3*n+requests].map(x=>({value:String(x)}))}]}))})});
 }
 if(/firestore|firebase|google-analytics|\/collect/.test(url))violations.push(url.split('?')[0]);
 return route.abort();
});
try{
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/dashboard.html');
 await page.locator('[data-ga4-connect]').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('[data-ga4-connect]').disabled);
 assert.equal(requests,0,'abrir painel não envia dados nem consulta GA4 sem consentimento');
 assert.equal(await page.locator('[data-ga4-value="today:sessions"]').innerText(),'—');
 await page.locator('[data-ga4-connect]').click();await page.waitForFunction(()=>document.querySelector('[data-ga4-value="today:sessions"]').textContent==='2');
 assert.equal(await page.evaluate(()=>window.fixtureScope),'https://www.googleapis.com/auth/analytics.readonly');assert.equal(await page.evaluate(()=>window.fixtureInclude),false);
 assert.match(await page.locator('[data-ga4-status]').innerText(),/somente para leitura/);assert.equal(requests,1);
 const saved=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('rdc-ga4-audience-v1:')));
 assert.equal(saved.length,1);assert.doesNotMatch(JSON.stringify(saved),/local-fixture-token|access_token|refresh_token|Authorization/);
 for(const width of [360,390,768,1366]){
  await page.setViewportSize({width,height:900});assert.equal(await page.locator('[data-ga4-audience]').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'sem excesso de largura em '+width);
  await page.locator('[data-ga4-audience]').screenshot({path:resolve(out,'ga4-dashboard-'+width+'.png')});
 }
 const mobile=await context.newPage();mobile.on('pageerror',e=>errors.push(e.message));await mobile.clock.install({time:new Date(fixtureTime)});await mobile.goto(base+'/painel-celular.html');
 await mobile.waitForFunction(()=>document.querySelector('[data-ga4-value="today:sessions"]').textContent==='2');assert.equal(requests,1,'outra aba reutiliza totais, não o token');
 assert.match(await mobile.locator('[data-ga4-status]').innerText(),/Esta aba não está autorizada/);
 assert.equal(await mobile.locator('[data-ga4-connection]').getAttribute('data-tone'),'warning');
 assert.equal(await mobile.locator('[data-ga4-refresh]').isDisabled(),true);
 await mobile.setViewportSize({width:360,height:800});await mobile.locator('[data-ga4-audience]').screenshot({path:resolve(out,'ga4-mobile-360.png')});
 await mobile.locator('[data-ga4-connect]').click();await mobile.waitForFunction(()=>document.querySelector('[data-ga4-status]').textContent.includes('Conectado somente para leitura'));
 assert.equal(requests,1,'autorizar outra aba não repete uma consulta ainda recente');
 await Promise.all([page,mobile].map(p=>p.evaluate(at=>{window.fixtureNow=at;},fixtureTime+16*60000)));
 await mobile.clock.setFixedTime(new Date(fixtureTime+16*60000));await mobile.clock.runFor(60000);await mobile.clock.resume();
 await mobile.waitForFunction(()=>document.querySelector('[data-ga4-value="today:sessions"]').textContent==='3');assert.equal(requests,2,'o agendamento do painel móvel atualiza sem clique manual');
 await page.waitForFunction(()=>document.querySelector('[data-ga4-value="today:sessions"]').textContent==='3');
 const savedDate=await mobile.locator('[data-ga4-date]').innerText(),savedNumbers=await mobile.locator('.ga4-periods').innerText(),beforeExpiry=requests;
 await Promise.all([page,mobile].map(p=>p.evaluate(at=>{window.fixtureNow=at;},fixtureTime+61*60000)));
 await mobile.clock.setFixedTime(new Date(fixtureTime+61*60000));await mobile.clock.runFor(60000);await mobile.clock.resume();
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 for(const panel of [page,mobile]){
  await panel.waitForFunction(()=>document.querySelector('[data-ga4-title]').textContent==='⚠ Analytics precisa reconectar');
  assert.equal(await panel.locator('[data-ga4-connection]').getAttribute('data-tone'),'warning');
  assert.equal(await panel.locator('[data-ga4-connect]').innerText(),'Reconectar Google Analytics');
  assert.equal(await panel.locator('[data-ga4-date]').innerText(),savedDate);assert.equal(await panel.locator('.ga4-periods').innerText(),savedNumbers);
  assert.equal(await panel.locator('[data-ga4-refresh]').isDisabled(),true);
  await panel.setViewportSize({width:360,height:800});assert.equal(await panel.locator('[data-ga4-audience]').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  await panel.locator('[data-ga4-audience]').screenshot({path:resolve(out,panel===mobile?'ga4-mobile-expired-360.png':'ga4-dashboard-expired-360.png')});
 }
 assert.equal(requests,beforeExpiry,'expiração e aviso não geram consultas');
 await page.locator('[data-ga4-connect]').click();await page.waitForFunction(()=>document.querySelector('[data-ga4-value="today:sessions"]').textContent==='4');
 const lastDate=await page.locator('[data-ga4-date]').innerText();billing=true;await page.evaluate(at=>{window.fixtureNow=at;},fixtureTime+77*60000);
 await page.locator('[data-ga4-refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-ga4-status]').textContent.includes('faturamento'));
 assert.equal(await page.locator('[data-ga4-value="today:sessions"]').innerText(),'4');assert.equal(await page.locator('[data-ga4-date]').innerText(),lastDate);assert.equal(await page.locator('[data-ga4-refresh]').isDisabled(),true);
 await page.evaluate(()=>{window.fixtureUser='another';window.dispatchEvent(new Event('rdc-admin-auth'));});
 await page.waitForFunction(()=>document.querySelector('[data-ga4-value="today:sessions"]').textContent==='—');
 assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:['consentimento antes da leitura','somente analytics.readonly','nenhum token persistido ou compartilhado','cache privado por usuário','sincronia dos dois painéis sem consulta duplicada','atualização automática do móvel com relógio simulado, sem clique manual','360/390/768/1366px','erro de cobrança pausa e preserva data e totais','troca de usuário limpa a exibição','sem chamadas reais de Firebase, Analytics ou vendas'],errors,screenshots:out},null,2));
}finally{await context.close();await browser.close();await new Promise(done=>server.close(done));}
