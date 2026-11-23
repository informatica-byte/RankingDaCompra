import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const source=await readFile('growth-tools.js','utf8'),html=await readFile('dashboard.html','utf8'),css=await readFile('dashboard-mobile.css','utf8');
const video=source.match(/<p class="showcase-admin-help"><b>Cadastre de 3 a 20 vídeos[^]*?<\/p>/)[0];
const help=source.match(/<p class="seasonal-admin-help">Depois de salvar[^]*?<\/p>/)[0];
const preview=source.match(/preview.innerHTML = `([^]*?)`;/)[1].replace(/\$\{escapeHtml\(RANKI_THEME_IMAGES\[id\]\)\}/g,'').replace(/\$\{escapeHtml\(theme.name\)\}/g,'Black Friday').replace(/\$\{escapeHtml\(theme.icon\)\}/g,'⚡');
assert.doesNotMatch(video+help+preview,/preço|histórico/i);assert.match(preview,/características, vantagens e limitações/);
const browser=await chromium.launch({headless:true,channel:'chrome'});
await mkdir('../../outputs/dashboard-media-text-20261123',{recursive:true});
try{for(const width of [360,390]){
const page=await browser.newPage({viewport:{width,height:844}});await page.route('**/*',r=>r.abort());
await page.setContent(html.replace(/<script\b[^]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
await page.evaluate(markup=>{document.querySelector('#login-content').style.display='none';const el=document.querySelector('#admin-content');el.style.display='block';el.innerHTML=markup;},`<section class="painel"><h2>Vídeos no site</h2>${video}<h2>Temas</h2><p>${preview.replace(/<img[^>]*>/,'')}</p>${help}</section>`);
await page.addStyleTag({content:css});assert.ok(await page.locator('#admin-content .painel').evaluate(e=>e.scrollWidth<=e.clientWidth));
await page.screenshot({path:`../../outputs/dashboard-media-text-20261123/${width}.png`});console.log({width,noOverflow:true,network:'blocked'});await page.close();
}}finally{await browser.close();}
