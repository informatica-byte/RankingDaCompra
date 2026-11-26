import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const source=await readFile('growth-tools.js','utf8'),html=await readFile('dashboard.html','utf8'),css=await readFile('dashboard-mobile.css','utf8');
const start=source.indexOf('<h2>💚 Clube de Ofertas no WhatsApp',source.indexOf('async function renderAdmin()'));
const markup=source.slice(start,source.indexOf('<div class="showcase-admin">',start));
assert.ok(markup.includes('growth-whatsapp-enabled'));
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
const out='../../outputs/dashboard-club-mobile-20261126';await mkdir(out,{recursive:true});
try{for(const width of [360,390,768]){
 const page=await browser.newPage({viewport:{width,height:844}});await page.route('**/*',r=>r.abort());
 await page.setContent(html.replace(/<script\b[^]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
 await page.evaluate(markup=>{document.querySelector('#login-content').style.display='none';const admin=document.querySelector('#admin-content');admin.style.display='block';admin.innerHTML=`<section class="painel" id="club-fixture">${markup}</section>`;},markup);
 await page.addStyleTag({content:css});
 const result=await page.locator('#growth-whatsapp-enabled').evaluate(e=>({width:e.getBoundingClientRect().width,checked:e.checked,type:e.type,parentWidth:e.parentElement.clientWidth,parentScroll:e.parentElement.scrollWidth}));
 results.push({viewport:width,...result});
 if(process.env.QA_EXPECT_FIXED==='true'&&width<=700){assert.equal(result.width,20);assert.ok(result.parentScroll<=result.parentWidth);}
 assert.equal(result.checked,true);assert.equal(result.type,'checkbox');
 await page.screenshot({path:`${out}/${width}.png`});await page.close();
 }await writeFile(`${out}/qa.json`,JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close();}
