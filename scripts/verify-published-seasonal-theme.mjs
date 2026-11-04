import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const site='https://rankingdacompra.com.br',out='../../outputs/melhorias-integrais-20261030';await mkdir(out,{recursive:true});
const config=await (await fetch(site+'/site-config.json')).json();assert.equal(config.seasonalThemeId,'black-friday');assert.equal(config.seasonalThemeMode,'manual');
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));const browser=await chromium.launch({headless:true,channel:'chrome'});const checked=[];
try{for(const width of [390,1280]){const page=await browser.newPage({viewport:{width,height:844}});const blocked=[];
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==site||route.request().resourceType()==='image'){blocked.push(u.hostname);return route.abort();}return route.continue();});
 await page.goto(site+'/?theme-check=20261104',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.seasonalTheme==='black-friday',null,{timeout:30000});
 assert.equal(await page.locator('[data-seasonal-banner]').count(),1);assert.match(await page.locator('[data-seasonal-banner]').innerText(),/escolhas bem informadas/);assert.equal(await page.locator('.hero h1').evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)');assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),true);
 await page.screenshot({path:`${out}/tema-publicado-${width}.png`});checked.push({width,theme:'black-friday',banner:1,overflow:false,externalNetwork:'blocked',firebaseWrites:0});await page.close();}
 await writeFile(out+'/verificacao-tema-publicado.json',JSON.stringify({checked,at:new Date().toISOString(),mode:config.seasonalThemeMode},null,2));console.log(JSON.stringify(checked));}finally{await browser.close();}
