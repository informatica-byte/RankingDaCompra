import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import home from '../informational-home.js';
import {buildInformationalHome} from './build-informational-home.mjs';
const root=new URL('..',import.meta.url);
const read=file=>readFile(new URL(file,root),'utf8');
const feed=()=>({mode:'informational',selected:['a','b'],products:[{id:'a',title:'Fone documentado',image:'https://http2.mlstatic.com/photo.jpg',url:'/produto/a.html',summary:'Recursos segundo o anúncio.'},{id:'b',title:'Fone documentado',image:'https://http2.mlstatic.com/photo2.jpg',url:'/produto/b.html',summary:'Outra publicação.'}],guides:[{url:'melhores-fones-de-ouvido.html',title:'Fones para cada uso'}]});
const config=()=>({youtubeShowcaseEnabled:true,youtubeShowcaseItems:[{youtubeUrl:'https://www.youtube.com/watch?v=nzOv8It_lLE',productUrl:'https://rankingdacompra.com.br/produto/a.html'}]});
function shelfFeed(){
 const groups=[
  ['Fones de ouvido','fone-tws',[['kYzXt8BeErDzXsC6BlwB','HAVIT TW982'],['ZVVdy8TuP0yW0XNIyiEA','soundcore P30i'],['FlqPY3yHJ2xPoNgnhSTE','Samsung Galaxy Buds Core']]],
  ['Notebook','notebook',[['a77W30LAOCEPjWdkcAlU','ASUS E1504FA-NJ732'],['TEaC0vVXmdvp4s8QMqpn','Acer A515-45-R2A3'],['7evzZBujin11TlbT8hvm','Dell DC15-i51334U-A50']]],
  ['Roteador','roteador',[['AweCTxq7vwVQ7VmN4IIg','MERCUSYS MR80X V4'],['qZUWO8WSrcOKWVrAqTW7','TP-Link EX1500'],['mlMLB4801704305','Tenda RX12 Pro V2.0']]],
  ['Câmeras de segurança',null,[['YKSSWNPjLAaUeRSLtVWT','TP-Link Tapo C200'],['Gcz9OSyGgHGMKYfG87IS','Intelbras iME 360'],['hvEYsBQVyORk8vWbQCNU','Intelbras iM3 C']]]
 ];
 const top=Array.from({length:6},(_,i)=>({id:'top'+i,title:'Seleção '+i,url:'/produto/top'+i+'.html',summary:'Informações da ficha publicada.'}));
 return {mode:'informational',selected:top.map(p=>p.id),guides:['fones-de-ouvido','notebook','roteador','cameras-de-seguranca'].map(name=>({url:'melhores-'+name+'.html',title:name})),products:[...top,...groups.flatMap(([category,family,items])=>items.map(([id,title])=>({id,title,category,comparison:family?{family}:null,url:'/produto/'+id+'.html',summary:'Informações do anúncio; veja os limites na ficha.'})))]};
}
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
 data.products.forEach(p=>p.title='Modelo $& documentado');
 await Promise.all([['index.html',source],['informational-catalogue.json',JSON.stringify(data)],['site-config.json',JSON.stringify(settings)]].map(([file,value])=>writeFile(join(dir,file),value)));
 await mkdir(join(dir,'produto'));
 await Promise.all(['produto/a.html','melhores-fones-de-ouvido.html'].map(file=>writeFile(join(dir,file),'<html><head><meta name="robots" content="index,follow"></head><body>Artigo publicado</body></html>')));
 await writeFile(join(dir,'sitemap.xml'),'<urlset><url><loc>https://rankingdacompra.com.br/</loc><lastmod>2026-10-26</lastmod></url><url><loc>https://rankingdacompra.com.br/produto/a.html</loc></url><url><loc>https://rankingdacompra.com.br/melhores-fones-de-ouvido.html</loc></url></urlset>');
 await buildInformationalHome(dir);const once=await readFile(join(dir,'index.html'),'utf8');await buildInformationalHome(dir);assert.equal(await readFile(join(dir,'index.html'),'utf8'),once);assert.match(once,/privacy-controls\.js/);assert.match(once,/name="q"/);assert.match(once,/https:\/\/meli.la\/unchanged/);assert.match(once,/data-info-home-static/);assert.equal(await readFile(join(dir,'site-config.json'),'utf8'),JSON.stringify(settings));
 assert.deepEqual(JSON.parse(once.match(/id="informational-home-schema" type="application\/ld\+json">([^]*?)<\/script>/)[1]),home.structuredData(data));
 const validMap=await readFile(join(dir,'sitemap.xml'),'utf8');
 await writeFile(join(dir,'sitemap.xml'),validMap.replace('<loc>https://rankingdacompra.com.br/produto/a.html</loc>','<loc>https://rankingdacompra.com.br/produto/outro.html</loc>'));
 await assert.rejects(buildInformationalHome(dir),/fora do sitemap/);assert.equal(await readFile(join(dir,'index.html'),'utf8'),once);
 await writeFile(join(dir,'sitemap.xml'),validMap);await writeFile(join(dir,'produto/a.html'),'<meta name="robots" content="noindex,follow">');
 await assert.rejects(buildInformationalHome(dir),/não indexável/);assert.equal(await readFile(join(dir,'index.html'),'utf8'),once);
});
test('vitrine por categoria expõe doze fichas adicionais sem alterar o catálogo ou repetir modelos',async()=>{
 const data=shelfFeed(),before=JSON.stringify(data),shelves=home.collections(data);
 assert.equal(shelves.length,4);assert.deepEqual(shelves.map(s=>s.products.length),[3,3,3,3]);
 const shown=[...home.selection(data),...shelves.flatMap(s=>s.products)];assert.equal(new Set(shown.map(p=>p.id)).size,18);assert.equal(new Set(shown.map(p=>p.title)).size,18);
 assert.equal(JSON.stringify(data),before);
 const changed=structuredClone(data);changed.products.find(p=>p.id==='ZVVdy8TuP0yW0XNIyiEA').title='Outra cor de um modelo sem identificação';
 assert.ok(!home.collections(changed).flatMap(s=>s.products).some(p=>p.id==='ZVVdy8TuP0yW0XNIyiEA'));
 const moved=structuredClone(data);moved.products.find(p=>p.id==='FlqPY3yHJ2xPoNgnhSTE').category='Notebook';
 assert.ok(!home.collections(moved).flatMap(s=>s.products).some(p=>p.id==='FlqPY3yHJ2xPoNgnhSTE'));
 const settings=JSON.parse(await read('site-config.json')),html=home.markup(data,settings);
 assert.equal((html.match(/data-info-shelf=/g)||[]).length,4);assert.equal((html.match(/data-info-product=/g)||[]).length,18);
 assert.doesNotMatch(html,/R\$|mais vendidos|melhor do mercado|<iframe|ratingValue/);
 const schema=home.structuredData(data);assert.equal(schema['@graph'].length,5);
 for(const list of schema['@graph']){assert.equal(list.itemListOrder,'https://schema.org/ItemListUnordered');assert.equal(list.numberOfItems,list.itemListElement.length);for(const p of list.itemListElement)assert.match(p.url,/^https:\/\/rankingdacompra\.com\.br\/produto\//);}
});
test('vitrine e dados estruturados são permanentes, e o sitemap não ganha páginas fictícias',async()=>{
 const html=await read('index.html'),sitemap=await read('sitemap.xml'),data=JSON.parse(await read('informational-catalogue.json'));
 const raw=html.match(/<script id="informational-home-schema" type="application\/ld\+json">([^]*?)<\/script>/)?.[1];assert.ok(raw);assert.deepEqual(JSON.parse(raw),home.structuredData(data));
 assert.ok(sitemap.match(/<loc>https:\/\/rankingdacompra\.com\.br\/<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/)?.[1]>='2026-10-27');
 for(const s of home.collections(data))for(const p of s.products)assert.ok(sitemap.includes('<loc>'+p.url+'</loc>'));
 const expected=home.selection(data).length+home.collections(data).reduce((n,s)=>n+s.products.length,0);
 const block=html.split('<!-- static-home-products:start -->')[1].split('<!-- static-home-products:end -->')[0];assert.equal((block.match(/data-info-product=/g)||[]).length,expected);
 assert.ok(block.indexOf('data-best-products')<block.indexOf('id="comparativos-inicio"'));
});
test('vitrine publicada inclui as 31 categorias e só os vídeos com ficha existente; links originais preservados',async()=>{
 const data=JSON.parse(await read('informational-catalogue.json')),settings=JSON.parse(await read('site-config.json')),html=await read('index.html');assert.equal(home.selection(data).length,6);assert.ok(home.guides(data).length>=3);assert.ok(home.videos(data,settings).length>0);assert.ok(home.videos(data,settings).length<=settings.youtubeShowcaseItems.length);
 assert.match(html,/data-info-home-static/);assert.match(html,/Top 6 para conhecer e comparar/);assert.match(html,/informational-home\.js/);assert.equal((html.match(/data-info-video-card=/g)||[]).length,home.videos(data,settings).length);
 for(const g of home.guides(data))assert.ok(html.includes('href="'+g.path+'"'));assert.doesNotMatch(html.slice(html.indexOf('<!-- static-home-products:start -->'),html.indexOf('<!-- static-home-products:end -->')),/R\$|<iframe|\d+% OFF/);
 const workflow=await read('.github/workflows/update-sitemap.yml');assert.ok(workflow.indexOf('node scripts/informational-site.mjs')<workflow.indexOf('node scripts/build-informational-home.mjs'));assert.ok(workflow.indexOf('node scripts/build-informational-home.mjs')<workflow.indexOf('node scripts/validate-site.mjs'));
});
