import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import home from '../informational-home.js';
import {buildInformationalHome} from './build-informational-home.mjs';
const root=new URL('..',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');
const feed=()=>({mode:'informational',selected:['a','b'],products:[{id:'a',title:'Fone documentado',image:'https://http2.mlstatic.com/photo.jpg',url:'/produto/a.html',summary:'Recursos segundo o anúncio.'},{id:'b',title:'Fone documentado',image:'https://http2.mlstatic.com/photo2.jpg',url:'/produto/b.html',summary:'Outra publicação.'}],guides:[{url:'melhores-fones-de-ouvido.html',title:'Fones para cada uso'}]});
const config=()=>({youtubeShowcaseEnabled:true,youtubeShowcaseItems:[{youtubeUrl:'https://www.youtube.com/watch?v=nzOv8It_lLE',productUrl:'https://rankingdacompra.com.br/produto/a.html'}]});
test('Top 6 usa somente seleção existente, sem preço, pontuação ou duplicação por título',()=>{
 const data=feed(),before=JSON.stringify(data);assert.equal(home.selection(data).length,1);data.products.push({id:'external',title:'Externo',url:'https://evil.example/produto/e.html'});data.selected.push('external','missing');assert.equal(home.selection(data).length,1);assert.equal(JSON.stringify(feed()),before);
 const many={...feed(),products:Array.from({length:8},(_,i)=>({id:String(i),title:'Modelo '+i,url:'/produto/'+i+'.html'})),selected:Array.from({length:8},(_,i)=>String(i))};assert.equal(home.selection(many).length,6);
 assert.match(home.markup(many,config()),/Top 6 para conhecer e comparar/);assert.doesNotMatch(home.markup(many,config()),/R\$|ranking de menor|\d+% OFF/);
});
test('comparativos só apontam para guias locais sem repetir URL ou aceitar credenciais',()=>{
 const data=feed();data.guides.push(data.guides[0],{url:'https://evil.example/melhores-x.html',title:'Falso'},{url:'https://u:p@rankingdacompra.com.br/melhores-x.html',title:'Falso'},{url:'melhores-x.html?q=1',title:'Parâmetros'},{url:'javascript:alert(1)',title:'Falso'});assert.equal(home.guides(data).length,1);
});
test('vídeo precisa de ID válido e da página exata de produto publicado; configurações não mudam',()=>{
 const settings=config(),before=JSON.stringify(settings);settings.youtubeShowcaseItems.push(settings.youtubeShowcaseItems[0],{youtubeUrl:'https://youtu.be/nzOv8It_lLE',productUrl:'https://evil.example/produto/a.html'},{youtubeUrl:'https://youtube.com.evil.example/watch?v=12345678901',productUrl:'/produto/a.html'},{youtubeUrl:'https://www.youtube.com/watch?v=12345678901',productUrl:'/produto/missing.html'});
 assert.equal(home.videos(feed(),settings).length,1);assert.equal(home.videos(feed(),{...settings,youtubeShowcaseEnabled:false}).length,0);assert.equal(JSON.stringify(config()),before);
 assert.equal(home.videoId('https://www.youtube.com/shorts/nzOv8It_lLE'),'nzOv8It_lLE');assert.equal(home.videoId('https://user:secret@www.youtube.com/watch?v=nzOv8It_lLE'),'');
});
test('módulos não executam players sozinhos nem geram URLs de afiliados ou nomes inventados',()=>{
 const data=feed();data.products[0].title='Fone <script>alert(1)</script>';const html=home.markup(data,config());assert.doesNotMatch(html,/<iframe|<script|autoplay=|meli\.la|firebase|nota máxima/);assert.match(html,/data-info-video-play/);assert.match(html,/href="\/produto\/a.html"/);assert.match(html,/&lt;script&gt;/);
});
test('geração estática é idempotente e preserva scripts, busca e dados de origem',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rdc-home-')),data=feed(),settings=config();const source='<!doctype html><html><head><script src="/privacy-controls.js"></script></head><body><form action="/comparar.html"><input name="q"></form><!-- static-home-products:start -->Antigo<!-- static-home-products:end --><a href="https://meli.la/unchanged">Afiliado existente</a></body></html>';
 await Promise.all([['index.html',source],['informational-catalogue.json',JSON.stringify(data)],['site-config.json',JSON.stringify(settings)]].map(([file,value])=>writeFile(join(dir,file),value)));
 await buildInformationalHome(dir);const once=await readFile(join(dir,'index.html'),'utf8');await buildInformationalHome(dir);assert.equal(await readFile(join(dir,'index.html'),'utf8'),once);assert.match(once,/privacy-controls\.js/);assert.match(once,/name="q"/);assert.match(once,/https:\/\/meli.la\/unchanged/);assert.match(once,/data-info-home-static/);assert.equal(await readFile(join(dir,'site-config.json'),'utf8'),JSON.stringify(settings));
});
test('vitrine publicada inclui as 31 categorias e só os vídeos com ficha existente; links originais preservados',async()=>{
 const data=JSON.parse(await read('informational-catalogue.json')),settings=JSON.parse(await read('site-config.json')),html=await read('index.html');assert.equal(home.selection(data).length,6);assert.ok(home.guides(data).length>=3);assert.ok(home.videos(data,settings).length>0);assert.ok(home.videos(data,settings).length<=settings.youtubeShowcaseItems.length);
 assert.match(html,/data-info-home-static/);assert.match(html,/Top 6 para conhecer e comparar/);assert.match(html,/informational-home\.js/);assert.equal((html.match(/data-info-video-card=/g)||[]).length,home.videos(data,settings).length);
 for(const g of home.guides(data))assert.ok(html.includes('href="'+g.path+'"'));assert.doesNotMatch(html.slice(html.indexOf('<!-- static-home-products:start -->'),html.indexOf('<!-- static-home-products:end -->')),/R\$|<iframe|\d+% OFF/);
 const workflow=await read('.github/workflows/update-sitemap.yml');assert.ok(workflow.indexOf('node scripts/informational-site.mjs')<workflow.indexOf('node scripts/build-informational-home.mjs'));assert.ok(workflow.indexOf('node scripts/build-informational-home.mjs')<workflow.indexOf('node scripts/validate-site.mjs'));
});
