import assert from 'node:assert/strict';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const browser=await chromium.launch({headless:true,channel:'chrome'});const out='../../outputs/melhorias-integrais-20261030';await mkdir(out,{recursive:true});
const source=await readFile('growth-tools.js','utf8'),html=await readFile('index.html','utf8');
// Exercise the actual renderer and styles without booting unrelated history,
// analytics, product queries, admin code or any external network destination.
const boot='  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });\n  else init();';
assert.ok(source.replaceAll('\r\n','\n').includes(boot));
const fixture=source.replaceAll('\r\n','\n').replace(boot,'  window.themeQA={renderSeasonalTheme,injectStyles};');const checked=[];
try{const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 for(const width of [390,1280]){await page.setViewportSize({width,height:844});await page.setContent(html.replace(/<script\b[^>]*>[^]*?<\/script>/gi,''));await page.evaluate(()=>{window.RDCInformational={enabled:true};});await page.addScriptTag({content:fixture});
 await page.evaluate(()=>{window.themeQA.injectStyles();window.themeQA.renderSeasonalTheme({seasonalThemeMode:'manual',seasonalThemeId:'black-friday'});});
 assert.equal(await page.locator('body').getAttribute('data-seasonal-theme'),'black-friday');assert.equal(await page.locator('[data-seasonal-banner]').count(),1);assert.match(await page.locator('[data-seasonal-banner]').innerText(),/escolhas bem informadas/);
 assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),true);assert.equal(await page.locator('.hero h1').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');
 await page.screenshot({path:`${out}/tema-black-friday-${width}.png`});
 await page.evaluate(()=>window.themeQA.renderSeasonalTheme({seasonalThemeMode:'manual',seasonalThemeId:'black-friday'}));assert.equal(await page.locator('[data-seasonal-banner]').count(),1);
 await page.evaluate(()=>window.themeQA.renderSeasonalTheme({seasonalThemeMode:'off'}));assert.equal(await page.locator('[data-seasonal-banner]').count(),0);assert.equal(await page.locator('body').getAttribute('data-seasonal-theme'),null);checked.push({width,manual:true,off:true,noDuplicate:true});
 }await writeFile(`${out}/qa-tema-black-friday.json`,JSON.stringify({checked,network:'blocked',scope:'Local browser rendering; no physical device or Firebase access.'},null,2));console.log(JSON.stringify(checked));}finally{await browser.close();}
