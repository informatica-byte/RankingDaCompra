import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONFIG, improveProduct, improveGuide, resolveEditorialProduct, applyVisibilityEditorial} from './visibility-editorial.mjs';
import {productAliasPage, pausedProductPage, unavailableProductPage} from './product-url-continuity.mjs';
import {localRemovals} from './product-removals.mjs';
const item=CONFIG.products[0];
const fixture=(name='Notebook Acer Aspire 5 A515-45-R2A3',robots='index,follow')=>`<html><head><title>Original</title><meta name="robots" content="${robots}"><meta name="description" content="Original"><link rel="canonical" href="https://rankingdacompra.com.br/produto/${item.id}-20260810-1.html"><script type="application/ld+json">${JSON.stringify({'@type':'Product',name,url:`https://rankingdacompra.com.br/produto/${item.id}-20260810-1.html`,offers:{price:'3419.90',availability:'https://schema.org/InStock'}})}</script></head><body><main><article><h1>${name}</h1><a id="affiliate-offer" href="https://meli.la/existing" rel="sponsored">Comprar</a><div class="panels"></div></article></main></body></html>`;
test('biblioteca preserva as 70 entradas anteriores e acrescenta quatro dispositivos sem duplicação',()=>{assert.equal(CONFIG.products.length,74);assert.equal(new Set(CONFIG.products.map(x=>x.id)).size,74);assert.equal(CONFIG.guides.length,3);assert.equal(CONFIG.products.filter(p=>p.id==='YuOWci2UixF5GuQE6IYS').length,1);});

test('guias oferecem dúvidas visíveis e atalhos seguros sem inventar avaliações nem renovar preços',()=>{
  const html='<html><head><title>Guia</title></head><body><h1>Guia</h1><table><td>R$ 123,45</td></table></body></html>';
  for(const guide of CONFIG.guides){const out=improveGuide(html,guide);assert.equal((out.match(/<details>/g)||[]).length,2);assert.match(out,/Revisão editorial: 21\/10\/2026/);assert.ok(out.includes('R$ 123,45'));assert.doesNotMatch(out,/"@type":"(?:FAQPage|AggregateRating)"/);}
  const out=improveGuide(html,CONFIG.guides[0]);assert.match(out,/comparar\.html\?q=fone&amp;orcamento=100/);
  const malicious=improveGuide(html,{...CONFIG.guides[0],questions:[['<script>','<img>']],links:[{url:'//outro.com/?orcamento=1',label:'fora'}]});
  assert.match(malicious,/&lt;script&gt;/);assert.doesNotMatch(malicious,/href="\/\/outro/);
});
test('produto ganha conteúdo visível e metadata sem alterar oferta ou canonical',()=>{const html=fixture(),out=improveProduct(html,item);assert.match(out,/Vale a pena para o seu uso/);assert.match(out,/sem teste prático/);assert.match(out,/Acer Aspire 5 A515-45-R2A3: vale a pena/);for(const part of html.match(/<script[\s\S]*?<\/script>|<link[^>]*canonical[^>]*>|<a id="affiliate-offer"[^>]*>/g))assert.ok(out.includes(part));});
test('reescrever a mesma página é idempotente',()=>{const out=improveProduct(fixture(),item);assert.equal(improveProduct(out,item),out);});
test('não aplica conselho de um produto a outro modelo nem a página retirada',()=>{assert.equal(improveProduct(fixture('Notebook outro modelo'),item),fixture('Notebook outro modelo'));assert.equal(improveProduct(fixture(undefined,'noindex,follow'),item),fixture(undefined,'noindex,follow'));});
test('texto editorial não injeta HTML e links externos seguem lista permitida',()=>{const out=improveProduct(fixture(),{...item,fit:'<img onerror=alert(1)>',links:[{url:'javascript:alert(1)',label:'Ataque'}]});assert.match(out,/&lt;img onerror=alert\(1\)&gt;/);assert.doesNotMatch(out,/href="javascript:/);});
test('comparativo preserva tabela e preço e apresenta h1 antes do auxílio de decisão',()=>{const html='<html><head><title>Antigo</title></head><body><main><h1>Antigo</h1><table><tr><td>R$ 123,45</td></tr></table></main></body></html>';const out=improveGuide(html,CONFIG.guides[0]);assert.ok(out.includes('<table><tr><td>R$ 123,45</td></tr></table>'));assert.ok(out.indexOf('<h1>')<out.indexOf('<!-- visibility-editorial:start -->'));assert.equal(improveGuide(out,CONFIG.guides[0]),out);assert.equal((out.match(/<!-- visibility-editorial:start -->/g)||[]).length,1);});

async function verifiedEditorialPage(root,entry,deleted){
  if(!deleted.has(entry.id))return resolveEditorialProduct(root,entry);
  const original=resolve(root,`produto/${entry.id}-20260810-1.html`);
  await assert.rejects(resolveEditorialProduct(root,entry),error=>error.code==='ENOENT'&&error.path===original,'exclusão confirmada deve remover a página, sem stub ou redirecionamento');
  return null;
}
function deletedProductLink(url,deleted){
  const id=String(url).match(/^\/produto\/([A-Za-z0-9_-]+)-\d{8}-\d+\.html$/)?.[1];return id&&deleted.has(id);
}
test('todas as páginas principais selecionadas têm uma única seção e links locais existentes',async()=>{
  const root=fileURLToPath(new URL('..',import.meta.url));
  const deleted=new Set((await localRemovals(root)).ids);
  const pages=(await Promise.all(CONFIG.products.map(x=>verifiedEditorialPage(root,x,deleted)))).filter(Boolean);
  for(const page of pages.filter(p=>p.inactive)){assert.doesNotMatch(page.html,/visibility-editorial:start|id=["']affiliate-offer["']/);}
  for(const {file,html,item:entry} of [...pages.filter(p=>!p.inactive),...await Promise.all(CONFIG.guides.map(async x=>({file:x.file,html:await readFile(new URL('../'+x.file,import.meta.url),'utf8'),item:x})))]){
    assert.equal((html.match(/<!-- visibility-editorial:start -->/g)||[]).length,1,file);
    assert.ok(html.includes(entry.title.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))),file);
    for(const link of entry.links){if(link.url.startsWith('/')){
      if(deletedProductLink(link.url,deleted)){assert.equal(html.includes('href="'+link.url+'"'),false,'link excluído não pode continuar no HTML');await assert.rejects(readFile(new URL('..'+link.url,import.meta.url)),{code:'ENOENT'});}
      else await readFile(new URL('..'+link.url,import.meta.url));
    }}
    for(const [,json]of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>JSON.parse(json));
  }
});

async function aliasFixture(t){
  const root=await mkdtemp(join(tmpdir(),'rdc-editorial-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'produto'));
  const starlink=CONFIG.products.find(p=>p.id==='6mZ1ahzme9kUH1UdSkJw');
  const old=`produto/${starlink.id}-20260810-1.html`, current='produto/principal-20260810-1.html';
  const target=fixture('Kit Starlink MINI Internet Via Satélite').replaceAll(item.id,'principal');
  const alias=productAliasPage('Kit Starlink MINI Internet Via Satélite','https://rankingdacompra.com.br/'+current);
  await writeFile(join(root,old),alias);await writeFile(join(root,current),target);
  return {root,starlink,old,current,target,alias};
}
test('Starlink consolidada recebe editorial na página principal sem preço, link ou alias alterados',async t=>{
  const f=await aliasFixture(t), page=await resolveEditorialProduct(f.root,f.starlink);
  assert.equal(page.file,f.current);assert.equal(page.item.id,'principal');
  await writeFile(join(f.root,'sitemap.xml'),`<urlset><url><loc>https://rankingdacompra.com.br/${f.current}</loc><lastmod>2026-10-01</lastmod></url></urlset>`);
  const changed=await applyVisibilityEditorial(f.root);
  assert.ok(changed.includes(f.current));assert.ok(!changed.includes(f.old));
  const output=await readFile(join(f.root,f.current),'utf8');
  assert.equal((output.match(/visibility-editorial:start/g)||[]).length,1);
  for(const part of f.target.match(/<script[\s\S]*?<\/script>|<link[^>]*canonical[^>]*>|<a id="affiliate-offer"[^>]*>/g))assert.ok(output.includes(part));
  assert.equal(await readFile(join(f.root,f.old),'utf8'),f.alias);
  assert.deepEqual(await applyVisibilityEditorial(f.root),[]);
});
test('resolver recusa alias externo, destinos divergentes, loop, cadeia e outro modelo',async t=>{
  const f=await aliasFixture(t);
  for(const html of [f.alias.replaceAll('https://rankingdacompra.com.br/','https://outro.example/'),f.alias.replace('0;url=https://rankingdacompra.com.br/'+f.current,'0;url=https://rankingdacompra.com.br/produto/outro-20260810-1.html'),productAliasPage('Starlink','https://rankingdacompra.com.br/'+f.old)]){
    await writeFile(join(f.root,f.old),html);await assert.rejects(()=>resolveEditorialProduct(f.root,f.starlink));
  }
  await writeFile(join(f.root,f.old),f.alias);
  for(const html of [productAliasPage('Starlink','https://rankingdacompra.com.br/'+f.old),f.target.replaceAll('Kit Starlink MINI Internet Via Satélite','Starlink Standard'),f.target.replace('index,follow','noindex,follow'),f.target.replaceAll('principal-20260810','outro-20260810')]){
    await writeFile(join(f.root,f.current),html);await assert.rejects(()=>resolveEditorialProduct(f.root,f.starlink));
  }
});
test('pausa e retirada explícitas preservam stub; seção ausente numa página ativa continua erro no contrato',async t=>{
  const f=await aliasFixture(t);
  for(const html of [pausedProductPage({titulo:'Starlink Mini'}),unavailableProductPage('<title>Starlink Mini</title>')]){
    await writeFile(join(f.root,f.old),html);const page=await resolveEditorialProduct(f.root,f.starlink);assert.equal(page.inactive,true);assert.equal(page.html,html);
  }
  await writeFile(join(f.root,f.old),f.alias);const page=await resolveEditorialProduct(f.root,f.starlink);
  assert.equal(page.inactive,false);assert.doesNotMatch(page.html,/visibility-editorial:start/);
  await rm(join(f.root,f.current));await assert.rejects(()=>resolveEditorialProduct(f.root,f.starlink));
});

test('só exclusão registrada permite ausência: páginas ativas, stubs, aliases quebrados e erros de acesso continuam bloqueados',async t=>{
  const f=await aliasFixture(t),deleted=new Set([f.starlink.id]);
  await rm(join(f.root,f.old));assert.equal(await verifiedEditorialPage(f.root,f.starlink,deleted),null);
  await assert.rejects(verifiedEditorialPage(f.root,f.starlink,new Set()),{code:'ENOENT'});
  await writeFile(join(f.root,f.old),unavailableProductPage('Starlink'));
  await assert.rejects(verifiedEditorialPage(f.root,f.starlink,deleted),/exclusão confirmada/);
  await writeFile(join(f.root,f.old),f.alias);await rm(join(f.root,f.current));
  await assert.rejects(verifiedEditorialPage(f.root,f.starlink,deleted),/exclusão confirmada/);
});
