import assert from 'node:assert/strict';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const html=await readFile('dashboard.html','utf8'),css=await readFile('dashboard-mobile.css','utf8');
const markup=html.slice(html.indexOf('<div class="painel ga4-legacy">'),html.indexOf('<div class="painel central-divulgacao"'));
assert.match(markup,/não pessoas únicas nem vendas/);assert.match(markup,/coleta antiga desativada/);
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];const out='../../outputs/dashboard-legacy-mobile-20261126';await mkdir(out,{recursive:true});
try{for(const width of [360,390,768]){const page=await browser.newPage({viewport:{width,height:844}});await page.route('**/*',r=>r.abort());
await page.setContent(html.replace(/<script\b[^]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));await page.evaluate(markup=>{document.querySelector('#login-content').style.display='none';const a=document.querySelector('#admin-content');a.style.display='block';a.innerHTML=markup;},markup);await page.addStyleTag({content:css});
const m=await page.locator('.ga4-legacy').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth,font:getComputedStyle(e.querySelector('.metrica-visita span')).fontSize,values:[...e.querySelectorAll('strong')].map(x=>x.textContent)}));assert.ok(m.scroll<=m.client);assert.ok(m.values.every(v=>v==='—'));assert.equal(m.font,width<=700?'14px':'12px');results.push({width,...m});await page.screenshot({path:`${out}/${width}.png`});await page.close();}await writeFile(`${out}/qa.json`,JSON.stringify(results,null,2));console.log(results);}finally{await browser.close();}
