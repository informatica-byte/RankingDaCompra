import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';

// Isolated local QA: no logged-in browser, database, analytics or real audio host.
const root=resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(path==='/__qa_music_admin.html'){res.setHeader('Content-Type',mime['.html']);res.end('<html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><script defer src="/ambient-music-settings.js"></script><script defer src="/ambient-music-admin.js"></script></head><body style="font-family:system-ui;margin:16px"><main id="ambient-admin"></main></body></html>');return;}
  if(path.split('/').some(s=>s.startsWith('.'))||/\.(?:env|pem|key|enc)$/i.test(path))throw Error('Private');
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+sep)||!(await stat(file)).isFile())throw Error('Missing');
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port,out=resolve(root,'audit-output/musica-20261029');await mkdir(out,{recursive:true});
const config=JSON.parse(await readFile(resolve(root,'site-config.json'),'utf8'));
const tracks=[{name:'Faixa de teste A',url:'https://audio.example.org/a.mp3',credit:'Arquivo sintético exclusivo do teste',rights:'own',licenseUrl:''},{name:'Faixa de teste B',url:'https://audio.example.org/b.mp3',credit:'Arquivo sintético exclusivo do teste',rights:'own',licenseUrl:''}];
function wav(){const samples=8000,buf=Buffer.alloc(44+samples*2);buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(8000,24);buf.writeUInt32LE(16000,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(samples*2,40);return buf;}
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--mute-audio']}),passed=[],errors=[];
async function contextFor(ambientMusic,{failure=false}={}){
 const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true});
 const requests=[];
 await context.addInitScript(()=>{const Original=window.Audio;window.__qaAudios=[];window.Audio=function(...args){const a=new Original(...args);window.__qaAudios.push(a);return a;};});
 await context.route('**/*',async route=>{
  const url=route.request().url();
  if(url.startsWith('https://audio.example.org/')){requests.push(url);return route.fulfill({status:failure?404:200,headers:{'access-control-allow-origin':'*','content-type':'audio/wav'},body:failure?'Not found':wav()});}
  if(url.startsWith(base+'/site-config.json'))return route.fulfill({contentType:'application/json',body:JSON.stringify({...config,...(ambientMusic?{ambientMusic}:{})})});
  if(url.startsWith(base)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
  return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 return {context,page,requests};
}
try{
 const f=await contextFor({kind:'files',rightsConfirmed:true,tracks});
 await f.page.goto(base+'/');await f.page.locator('#rdc-music-toggle:not(:disabled)').waitFor();
 assert.equal(await f.page.locator('#rdc-music-toggle').getAttribute('aria-pressed'),'false');assert.equal(f.requests.length,0);
 assert.equal(await f.page.evaluate(()=>window.__qaAudios.length),0);passed.push('nenhum arquivo de áudio carregado antes da ativação');
 await f.page.locator('#rdc-music-toggle').click();await f.page.waitForFunction(()=>document.getElementById('rdc-music-toggle').getAttribute('aria-pressed')==='true');
 assert.equal(await f.page.locator('#rdc-music-toggle').getAttribute('aria-pressed'),'true');
 await f.page.waitForFunction(()=>window.__qaAudios[0].src.endsWith('/b.mp3')&&window.__qaAudios[0].readyState>=2&&!window.__qaAudios[0].paused);
 assert.ok(f.requests.some(url=>url.endsWith('/a.mp3')));assert.ok(f.requests.some(url=>url.endsWith('/b.mp3')));passed.push('sequência de duas faixas toca na ordem após um clique');
 await f.page.locator('#rdc-music-credit').waitFor({state:'visible'});
 await f.page.locator('a[href*="melhores-fones-de-ouvido.html"]').first().click();
 const child=f.page.frameLocator('#rdc-continuous-page');await child.locator('h1').waitFor();
 assert.equal(await child.locator('#rdc-music-toggle').getAttribute('aria-pressed'),'true');
 assert.equal(await f.page.evaluate(()=>window.__qaAudios.length),1);assert.equal(await f.page.evaluate(()=>window.__qaAudios[0].paused),false);
 passed.push('a mesma instância de áudio continua ao abrir o comparativo');
 await child.locator('#rdc-ambient-music summary').click();await child.locator('#rdc-music-volume').focus();await child.locator('#rdc-music-volume').press('Home');
 assert.equal(await f.page.evaluate(()=>window.__qaAudios[0].volume),0);passed.push('controle de volume e mudo funcionam no celular após navegar');
 await child.locator('#rdc-music-toggle').click();assert.equal(await f.page.evaluate(()=>window.__qaAudios[0].paused),true);
 await child.locator('#rdc-music-toggle').click();await f.page.waitForFunction(()=>window.__qaAudios[0]&&!window.__qaAudios[0].paused);
 await f.page.screenshot({path:resolve(out,'musica-no-comparativo-mobile.png')});
 const before=f.requests.length;await f.page.reload();await f.page.locator('#rdc-music-toggle:not(:disabled)').waitFor();
 assert.equal(await f.page.locator('#rdc-music-toggle').getAttribute('aria-pressed'),'false');assert.equal(await f.page.evaluate(()=>window.__qaAudios.length),0);assert.equal(f.requests.length,before);
 passed.push('nova entrada ou recarga fica desligada e não carrega arquivos');await f.context.close();

 const bad=await contextFor({kind:'files',rightsConfirmed:true,tracks:[tracks[0]]},{failure:true});
 await bad.page.goto(base+'/');await bad.page.locator('#rdc-music-toggle:not(:disabled)').waitFor();await bad.page.locator('#rdc-music-toggle').click();
 await bad.page.waitForFunction(()=>document.getElementById('rdc-music-toggle').getAttribute('aria-pressed')==='false'&&!document.getElementById('rdc-music-toggle').disabled);
 assert.ok(await bad.page.locator('h1').isVisible());assert.match(await bad.page.locator('#rdc-music-status').innerText(),/Não foi possível|pausada/i);passed.push('arquivo indisponível mantém música pausada e navegação funcionando');await bad.context.close();

 const admin=await contextFor();await admin.page.goto(base+'/__qa_music_admin.html');
 await admin.page.waitForFunction(()=>window.RDCAmbientMusicAdmin);
 await admin.page.evaluate(()=>{window.__qaSaved=null;window.RDCAmbientMusicAdmin.mount(document.getElementById('ambient-admin'),{config:{},save:async value=>{window.__qaSaved=value;}});});
 await admin.page.selectOption('#ambient-preset','calma');await admin.page.locator('[data-preview-generated]').click();await admin.page.locator('[data-stop-preview]').click();
 assert.equal(await admin.page.evaluate(()=>window.__qaSaved),null);
 await admin.page.locator('[data-save-music]').click();assert.equal((await admin.page.evaluate(()=>window.__qaSaved)).ambientMusic.preset,'calma');
 passed.push('prévia da melodia não salva; salvamento isolado inclui só a configuração de música');
 await admin.page.evaluate(()=>window.__qaSaved=null);await admin.page.selectOption('#ambient-kind','files');
 await admin.page.locator('[data-save-music]').click();assert.equal(await admin.page.evaluate(()=>window.__qaSaved),null);
 await admin.page.locator('[data-name]').fill('Minha trilha');await admin.page.locator('[data-url]').fill(tracks[0].url);await admin.page.locator('[data-credit]').fill('Autor informado');await admin.page.locator('[data-rights-confirmed]').check();
 await admin.page.locator('[data-save-music]').click();const saved=await admin.page.evaluate(()=>window.__qaSaved);
 assert.deepEqual(Object.keys(saved),['ambientMusic']);assert.equal(saved.ambientMusic.tracks[0].url,tracks[0].url);
 await admin.page.evaluate(()=>scrollTo(0,0));await admin.page.screenshot({path:resolve(out,'dashboard-musica-uma-faixa-mobile.png'),fullPage:true});
 for(let i=0;i<5;i++)await admin.page.locator('[data-add-track]').click();await admin.page.locator('[data-add-track]').click();assert.equal(await admin.page.locator('fieldset').count(),6);
 assert.equal(await admin.page.locator('body').evaluate(body=>body.scrollWidth<=innerWidth+1),true);
 await admin.page.screenshot({path:resolve(out,'dashboard-musica-mobile.png'),fullPage:true});
 await admin.page.setViewportSize({width:1366,height:900});assert.equal(await admin.page.locator('body').evaluate(body=>body.scrollWidth<=innerWidth+1),true);await admin.page.screenshot({path:resolve(out,'dashboard-musica-desktop.png')});
 passed.push('editor até seis faixas, confirmação obrigatória e layout sem largura excedente em 360/1366px');
 assert.equal(admin.requests.length,0);passed.push('editor não baixa áudio sem ouvir prévia; nenhum acesso ao Firebase ou Analytics');await admin.context.close();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed,errors,screenshots:out},null,2));
}finally{await browser.close();await new Promise(done=>server.close(done));}
