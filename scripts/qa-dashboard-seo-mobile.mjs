import assert from 'node:assert/strict';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const html=await readFile('dashboard.html','utf8'),css=await readFile('dashboard-mobile.css','utf8');
const source=(await readFile('seo-opportunities.js','utf8')).replace('const api = {','const api = { renderReport,');
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];const out='../../outputs/dashboard-seo-mobile-20261126';await mkdir(out,{recursive:true});
try{for(const width of [360,390,768]){const page=await browser.newPage({viewport:{width,height:844}});await page.route('**/*',r=>r.abort());await page.setContent(html.replace(/<script\b[^]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
await page.evaluate(()=>{document.querySelector('#login-content').style.display='none';const a=document.querySelector('#admin-content');a.style.display='block';a.innerHTML='<section class="painel"><section id="seo-opportunities-dashboard"></section></section>';});
await page.addScriptTag({content:source});await page.addStyleTag({content:css});
const before=await page.locator('.seo-toolbar a').evaluate(e=>({height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width}));
await page.evaluate(()=>{const a=window.RankingSEOOpportunities;const rows=a.parseSearchConsoleCsv('Consulta,Cliques,Impressões,CTR,Posição\nfones para caminhada,2,200,1%,12');a.renderReport(document.querySelector('#seo-opportunities-dashboard'),a.analyzeRows(rows,{period:'Dados fictícios — teste isolado'}));});
const metrics=await page.locator('#seo-opportunities-dashboard').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth,font:getComputedStyle(e.querySelector('.seo-summary span')).fontSize,dateFont:getComputedStyle(e.querySelector('.seo-date')).fontSize}));
if(process.env.QA_EXPECT_FIXED==='true'&&width<=700){assert.ok(before.height>=44);assert.equal(metrics.font,'14px');assert.equal(metrics.dateFont,'14px');assert.ok(metrics.scroll<=metrics.client);}
results.push({width,link:before,...metrics});await page.screenshot({path:`${out}/${width}.png`});await page.close();}await writeFile(`${out}/qa.json`,JSON.stringify(results,null,2));console.log(results);}finally{await browser.close();}
