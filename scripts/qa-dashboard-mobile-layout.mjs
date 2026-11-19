import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import info from '../informational-mode.js';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const html=process.env.RDC_QA_PUBLISHED?await fetch('https://rankingdacompra.com.br/dashboard.html?qa=layout-20261119').then(r=>r.text()):await readFile('dashboard.html','utf8');
const previous=execFileSync('git',['show','bdb8fe608:dashboard.html'],{encoding:'utf8',maxBuffer:10000000}).replace(/\r\n/g,'\n'),current=html.replace(/\r\n/g,'\n');
const scripts=s=>[...s.matchAll(/<script\b[^]*?<\/script>/gi)].map(m=>m[0]),links=s=>[...s.matchAll(/href="([^"]*)"/g)].map(m=>m[1]).filter(v=>!v.includes('dashboard-mobile.css'));
assert.deepEqual(scripts(current),scripts(previous));assert.deepEqual(links(current),links(previous));
const css=await readFile('dashboard-mobile.css','utf8'),out=resolve('../../outputs/dashboard-mobile-layout-20261119'+(process.env.RDC_QA_PUBLISHED?'/publico':''));await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),checks=[];
try{
 for(const width of [360,390,768,1024,1280]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.abort());const page=await context.newPage();
  await page.setContent(html.replace(/<script\b[^]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
  const cards=Array.from({length:6},(_,n)=>info.campaignCard({id:'fixture'+n,title:'Modelo fictício com título longo para verificar a leitura no cartão '+n,summary:'Informações fictícias exclusivas do teste de layout.'},{url:'https://rankingdacompra.com.br/produto/fixture'+n+'.html',message:'Texto fictício.'})).join('');
  await page.evaluate(cards=>{document.getElementById('login-content').hidden=true;const admin=document.getElementById('admin-content');admin.style.display='block';for(const child of admin.children)if(!child.matches('#central-divulgacao')&&!child.querySelector('#formProduto'))child.hidden=true;const central=document.getElementById('central-divulgacao');for(const child of central.children)if(!child.matches('.central-cabecalho,#central-recentes'))child.hidden=true;document.getElementById('central-melhores').innerHTML=cards;},cards);
  const field=page.locator('#formProduto #link'),before=await field.evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
  await page.addStyleTag({content:css});
  assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),true,'sem rolagem lateral a '+width);
  const after=await field.evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
  if(width<=700){assert.ok(after>=16);for(const el of await page.locator('.central-cabecalho-acoes>*').all()){const box=await el.boundingBox();assert.ok(box.height>=44&&box.x>=0&&box.x+box.width<=width+1);}assert.ok(await page.locator('#central-recentes .campanha-topo h4').first().evaluate(e=>e.clientWidth)>=140);}
  const columns=await page.locator('#central-melhores').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
  if(width===1024)assert.equal(columns,2);if(width===1280)assert.equal(columns,3);
  await page.locator('.central-cabecalho').screenshot({path:resolve(out,'cabecalho-'+width+'.png')});await page.locator('#central-recentes .campanha-card').first().screenshot({path:resolve(out,'cartao-'+width+'.png')});
  checks.push({width,beforeFieldFont:before,afterFieldFont:after,columns,noOverflow:true,actionsNotTriggered:true});await context.close();
 }
 await writeFile(resolve(out,'qa.json'),JSON.stringify({checks,fixtureOnly:true,networkBlocked:true,noCopyRetest:true},null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();}
