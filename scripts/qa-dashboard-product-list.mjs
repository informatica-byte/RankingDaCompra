import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const html=await readFile('dashboard.html','utf8'),css=await readFile('dashboard-mobile.css','utf8');
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
try{
 for(const width of [360,390,768]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.route('**/*',r=>r.abort());const page=await context.newPage();
  await page.setContent(html.replace(/<script\b[^]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
  const renderer=html.match(/function cartaoProdutoPublicado\(doc\) \{[^]*?\n        \}/)[0];
  await page.evaluate(renderer=>{
   window.escapeHtml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');window.statusMercadoLivreAdmin={};
   const render=Function(renderer+';return cartaoProdutoPublicado')();
   document.querySelector('#login-content').style.display='none';document.querySelector('#admin-content').style.display='block';
   document.querySelector('#painel-publicados').hidden=false;
   document.querySelector('#itens-lista').innerHTML=render({id:'fixture-only',data:()=>({titulo:'Produto fictício com um título bastante longo para avaliar a leitura confortável no celular',categoria:'Teste fictício'})});
  },renderer);
  const before=await page.locator('.item-admin-titulo').evaluate(e=>e.getBoundingClientRect().width);
  await page.addStyleTag({content:css});
  const after=await page.locator('.item-admin-titulo').evaluate(e=>e.getBoundingClientRect().width);
  for(const button of await page.locator('#itens-lista button').all()){const b=await button.boundingBox();if(width<=700)assert.ok(b.width>=44&&b.height>=44,JSON.stringify({width,b}));assert.ok(b.x>=0&&b.x+b.width<=width);}
  assert.ok(await page.locator('#itens-lista').evaluate(e=>e.scrollWidth<=e.clientWidth));
  if(width<=700)assert.ok(after>before,'título deve recuperar espaço');
  results.push({width,beforeTitleWidth:before,afterTitleWidth:after,actionsNotTriggered:true});await context.close();
 }
 await mkdir('../../outputs/dashboard-product-list-20261119',{recursive:true});await writeFile('../../outputs/dashboard-product-list-20261119/qa.json',JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close();}
