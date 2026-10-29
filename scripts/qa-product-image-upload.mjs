import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,stat,mkdtemp,rm} from 'node:fs/promises';
import {resolve,extname,join,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import imageData from '../product-image-data.js';
import {materializeLocalProductImages} from './local-product-images.mjs';
const root=resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')),temp=await mkdtemp(join(tmpdir(),'rdc-photo-browser-'));
const {chromium}=await import(pathToFileURL(process.env.RDC_PLAYWRIGHT_MODULE));
const out=resolve(root,'audit-output/foto-local-20261029');await mkdir(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json','.css':'text/css'};
const server=http.createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(path==='/__qa_photo.html'){res.setHeader('Content-Type',types['.html']);res.end('<html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><script defer src="/product-image-data.js"></script><script defer src="/product-image-picker.js"></script><script defer src="/informational-mode.js"></script></head><body style="font-family:system-ui;margin:16px"><main style="max-width:900px;margin:auto"><h1>Cadastro de produto — teste isolado</h1><form><label>URL da foto<input id="foto" type="url" required value="https://http2.mlstatic.com/imagem-original.jpg" style="box-sizing:border-box;width:100%"></label></form></main></body></html>');return;}
  if(path.split('/').some(s=>s.startsWith('.'))||/\.(?:env|key|pem|enc)$/i.test(path))throw Error('Private');const file=resolve(root,'.'+path);if(!file.startsWith(root+sep)||!(await stat(file)).isFile())throw Error('Missing');res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.statusCode=404;res.end('Not found');}
});await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const published=new Map(),requests=[],errors=[],passed=[];
await context.route('**/*',route=>{
 const url=route.request().url();
 if(url.startsWith(base)||url.startsWith('blob:')||url.startsWith('data:'))return route.continue();
 if(url.startsWith(imageData.SITE+'/produto/imagens/')){requests.push(url);const bytes=published.get(url);return route.fulfill({status:bytes?200:404,headers:{'content-type':bytes?'image/jpeg':'text/plain','access-control-allow-origin':'*'},body:bytes||'Not found'});}
 return route.abort();
});
try{
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'/__qa_photo.html');await page.waitForFunction(()=>window.RDCProductImagePicker);
 await page.evaluate(()=>{
  window.__savedPhoto=null;window.__cleanupCalls=0;
  window.__photo=window.RDCProductImagePicker.mount(document.getElementById('foto'),{session:()=> 'admin-test',cleanup:async(item)=>{if(window.__savedPhoto?.hash!==item.hash)return false;window.__savedPhoto.data='';window.__cleanupCalls++;return true;}});
 });
 assert.equal(await page.locator('[data-local-product-image]').count(),1);
 await page.evaluate(()=>window.RDCProductImagePicker.mount(document.getElementById('foto')));assert.equal(await page.locator('[data-local-product-image]').count(),1);
 const png=Buffer.from(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;const ctx=canvas.getContext('2d');ctx.fillStyle='#1769e0';ctx.fillRect(0,0,1600,1000);ctx.fillStyle='#fff';ctx.font='bold 80px sans-serif';ctx.fillText('FOTO LOCAL — TESTE',120,450);return canvas.toDataURL('image/png').split(',')[1];}),'base64');
 await page.locator('[data-image-source="local"]').check();assert.equal(await page.locator('#foto').isVisible(),false);assert.equal(await page.locator('#foto').getAttribute('required'),null);
 await page.locator('[data-image-file]').setInputFiles({name:'foto-de-teste.png',mimeType:'image/png',buffer:png});
 await page.waitForFunction(()=>document.querySelector('[data-image-status]').textContent.includes('Prévia pronta'));
 assert.equal(requests.length,0);assert.equal(await page.evaluate(()=>window.__savedPhoto),null);passed.push('seleção e prévia não enviam foto nem salvam produto');
 const denied=await page.evaluate(()=>{try{window.__photo.capture();return '';}catch(error){return error.message;}});assert.match(denied,/autorização/);
 await page.locator('[data-image-permission]').check();
 const record=await page.evaluate(()=>{const captured=window.__photo.capture();window.__savedPhoto=window.__photo.queueRecord(captured,'produto-teste');return window.__savedPhoto;});
 const valid=await imageData.validate(record,'produto-teste');assert.ok(valid.width<=1200&&valid.height<=1200);assert.ok(record.bytes<=imageData.MAX_BYTES);assert.equal('name' in record,false);
 passed.push('PNG convertido para JPEG até 100 KB/1200px, sem nome de arquivo ou EXIF');
 await page.screenshot({path:resolve(out,'selecionar-foto-mobile.png'),fullPage:true});
 const product={id:'produto-teste',foto:valid.url,linkAfiliado:'https://meli.la/preservado',preco:'99,90'};let queueReads=0;
 await materializeLocalProductImages([product],join(temp,'produto/imagens'),async()=>{queueReads++;return record;});
 published.set(valid.url,await readFile(join(temp,'produto/imagens',valid.fileName)));
 await page.evaluate(({record,id})=>{window.__photo.committed(record,id);},{record,id:'produto-teste'});
 await page.locator('[data-check-images]').click();await page.waitForFunction(()=>window.__cleanupCalls===1);assert.equal(await page.evaluate(()=>window.__savedPhoto.data),'');
 assert.equal(queueReads,1);passed.push('publicação materializa o arquivo no site e só libera a fila após conferir os mesmos bytes');
 const poster=await page.evaluate(async foto=>{
  const loader=url=>new Promise((resolve,reject)=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Foto indisponível'));image.src=url;});
  const file=await window.RDCInformational.campaignImage({id:'produto-teste',titulo:'Produto de teste',comentario:'Imagem própria usada apenas em teste isolado.'},foto,loader);return {type:file.type,size:file.size};
 },valid.url);
 assert.equal(poster.type,'image/png');assert.ok(poster.size>0);passed.push('a arte de postagem é gerada com a mesma imagem publicada, sem enviar mensagens');
 await page.locator('[data-image-source="url"]').check();assert.equal(await page.locator('#foto').inputValue(),'https://http2.mlstatic.com/imagem-original.jpg');assert.equal(await page.evaluate(()=>window.__photo.capture()),null);
 passed.push('opção de URL original preservada ao desistir do arquivo local');
 await page.locator('[data-image-source="local"]').check();await page.locator('[data-image-file]').setInputFiles({name:'inseguro.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg onload="alert(1)"></svg>')});
 await page.waitForFunction(()=>document.querySelector('[data-image-status]').textContent.includes('Formato não aceito'));assert.equal(await page.locator('[data-image-preview]').isVisible(),false);
 assert.equal(await page.locator('body').evaluate(body=>body.scrollWidth<=innerWidth+1),true);await page.setViewportSize({width:1366,height:900});assert.equal(await page.locator('body').evaluate(body=>body.scrollWidth<=innerWidth+1),true);
 passed.push('SVG rejeitado; controles sem excesso de largura em 390/1366px');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed,errors,screenshots:out},null,2));
}finally{await browser.close();await new Promise(done=>server.close(done));assert.ok(resolve(temp).startsWith(resolve(tmpdir())+sep));await rm(temp,{recursive:true,force:true});}
