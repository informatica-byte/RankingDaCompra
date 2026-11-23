import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const source=await readFile('growth-tools.js','utf8');
const markup=source.match(/<div class="growth-row"><label><input id="growth-youtube-enabled"[^]*?<\/label><\/div>/)?.[0];
assert.ok(markup);
const html=await readFile('dashboard.html','utf8');
const styles=[...html.matchAll(/<style[^>]*>([^]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const css=await readFile('dashboard-mobile.css','utf8');
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{for(const width of [360,390]){
 const page=await browser.newPage({viewport:{width,height:844}});
 await page.route('**/*',r=>r.abort());
 await page.setContent(`<style>${styles}\n${css}</style><div id="admin-content" style="display:block"><div class="painel"><div class="showcase-admin">${markup}</div></div></div>`);
 const result=await page.locator('#growth-youtube-enabled').evaluate(e=>({width:e.getBoundingClientRect().width,checked:e.checked,type:e.type,overflow:e.parentElement.scrollWidth>e.parentElement.clientWidth}));
 assert.equal(result.width,20);assert.equal(result.checked,false);assert.equal(result.type,'checkbox');assert.equal(result.overflow,false);
 console.log({viewport:width,...result});await page.close();
}}finally{await browser.close();}
