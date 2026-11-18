import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const html=process.env.RDC_QA_PUBLISHED?await fetch('https://rankingdacompra.com.br/dashboard.html?qa=recentes-20261118').then(r=>{assert.equal(r.status,200);return r.text();}):await readFile('dashboard.html','utf8');
const block=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const info=await readFile('informational-mode.js','utf8');
const out=resolve('../../outputs/upgrade-dashboard-20261118'+(process.env.RDC_QA_PUBLISHED?'/publico':''));await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),checks=[],errors=[];
try{
 for(const width of [360,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  // Isolated authenticated-layout fixture. No real login, Firebase SDK, reads,
  // writes, images, network sharing, clipboard or product data is used.
  await page.setContent(html.replace(/<script\b[^]*?<\/script>/gi,''));
  await page.addScriptTag({content:info});
  await page.addScriptTag({content:`
   var auth={currentUser:{uid:'fixture-only'}},centralDivulgacaoInicializada=false,copied=[],textosCampanhaCentral={};
   var estadosPublicacaoCentral=new Map(),produtosCentralAtual=[];
   var escapeHtml=window.RDCInformational.esc;
   function produtoCentralPorId(id){return produtosCentralAtual.find(p=>p.id===id)}
   function urlCampanhaCentral(p){return 'https://rankingdacompra.com.br/produto/'+p.id+'.html'}
   function textoPadraoCentral(p){return p.titulo}
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>copied.push(text)},configurable:true});
   ${block('function dataMsCentral(','\n')}
   ${block('function destaqueRecenteCentral(','function melhoresOfertasCentral(')}
   ${block('function inicializarCentralDivulgacao(','\n')}
   for(let n=0;n<6;n++){let p={id:'fixture'+n,titulo:'Produto fictício para testar a divulgação '+n,comentario:'Texto de teste, sem especificações inventadas.',dataCadastro:'2026-11-18T12:00:00Z'};produtosCentralAtual.push(p);estadosPublicacaoCentral.set(p.id,{pronto:false,arquivoPronto:false});}
   document.getElementById('central-melhores').innerHTML=produtosCentralAtual.map(p=>destaqueRecenteCentral(p,window.RDCInformational.campaignCard(p,{url:urlCampanhaCentral(p),message:p.titulo}))).join('');
   document.getElementById('admin-content').style.display='block';document.getElementById('login-content').hidden=true;
   for(const child of document.getElementById('admin-content').children)if(!child.matches('.recentes-atalho,#central-divulgacao'))child.hidden=true;
   for(const child of document.getElementById('central-divulgacao').children)if(!child.matches('#central-recentes'))child.hidden=true;
   inicializarCentralDivulgacao();
  `});
  await page.locator('.recentes-atalho a').click();assert.equal(await page.locator('#central-recentes').isVisible(),true);
  assert.equal(await page.locator('#central-recentes .campanha-card').count(),6);
  assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),true);
  const copy=page.locator('[data-central-copiar="fixture0"][data-central-copiar-tipo="texto"]');
  assert.ok((await copy.boundingBox()).height>=44);await copy.click();assert.equal(await page.evaluate(()=>copied.length),0);
  assert.match(await page.locator('#recente-retorno-fixture0').innerText(),/Aguarde/);
  await page.evaluate(()=>{estadosPublicacaoCentral.get('fixture0').pronto=true;estadosPublicacaoCentral.get('fixture0').arquivoPronto=true;});
  await page.locator('#campanha-texto-fixture0').fill('Texto revisado pelo usuário');await copy.click();
  assert.equal(await page.evaluate(()=>copied[0]),'Texto revisado pelo usuário\nhttps://rankingdacompra.com.br/produto/fixture0.html');
  await page.locator('[data-central-copiar="fixture0"][data-central-copiar-tipo="link"]').click();assert.equal(await page.evaluate(()=>copied[1]),'https://rankingdacompra.com.br/produto/fixture0.html');
  await page.locator('#central-recentes .campanha-card').first().screenshot({path:resolve(out,'card-'+width+'.png')});
  await page.evaluate(()=>auth.currentUser=null);await copy.click();assert.equal(await page.evaluate(()=>copied.length),2);
  checks.push({width,cards:6,noOverflow:true,touchTargets:true,publicationGuard:true,sessionGuard:true,editedTextPreserved:true,copyOnlyNoPublishing:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(out,'qa.json'),JSON.stringify({checks,errors,isolatedFictitiousData:true,noAuthenticatedSessionAccess:true,networkBlocked:true},null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();}
