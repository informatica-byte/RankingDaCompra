import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import choices from '../best-choices.js';
import titles from '../promotion-title.js';

const SITE='https://rankingdacompra.com.br/';
const json=async file=>JSON.parse(await readFile(resolve(file),'utf8'));
const [catalogue,config,status,focus]=await Promise.all([json('vitrine-publica.json'),json('site-config.json'),json('mercadolivre-status.json').catch(()=>({products:{}})),json('editorial-focus.json').catch(()=>({guides:[]}))]);
if(!Array.isArray(catalogue.products))throw Error('Catálogo incompleto: seleção permanente preservada.');
const decode=value=>String(value||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const text=value=>decode(String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
const guides=[];
for(const file of (await readdir('.')).filter(f=>/^melhores-[a-z0-9-]+\.html$/.test(f)&&f!==choices.PAGE)) {
  const html=await readFile(file,'utf8');
  if(/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html))continue;
  const title=text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const summary=decode(html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)/i)?.[1]||'Compare as análises, critérios e limitações antes de escolher.');
  if(title)guides.push({url:file,title,summary});
}
guides.sort((a,b)=>{
  const priority=url=>{const index=(focus.guides||[]).findIndex(g=>g.url===url);return index<0?999:index;};
  return priority(a.url)-priority(b.url)||a.title.localeCompare(b.title,'pt-BR');
});
const seeded=choices.seedConfig(config,catalogue.products,guides);
await writeFile('site-config.json',JSON.stringify(seeded,null,2)+'\n');
await writeFile('best-choices-guides.json',JSON.stringify({schemaVersion:1,guides},null,2)+'\n');
const products=choices.selectProducts(catalogue.products,seeded),selectedGuides=choices.selectGuides(guides,seeded);
const heading=choices.title(seeded.bestChoicesTitle,products,titles,status.products||{});
const description='Compare rankings por categoria e produtos selecionados. Veja diferenças, análises, preços registrados e limitações para escolher melhor.';
const content='<section class="best-section" id="melhores-escolhas" data-best-choices="true"><div class="section-head"><div><div class="eyebrow">Seleção permanente</div><h2 data-best-title>'+choices.esc(heading)+'</h2><p class="best-explanation">Escolha pela categoria e pela sua necessidade. Cada ranking compara produtos compatíveis; os destaques abaixo são uma seleção editorial, não uma disputa entre categorias.</p></div></div>'+choices.guideCards(selectedGuides)+'<h3 class="best-products-heading">Produtos selecionados para analisar</h3><div class="deal-grid" data-best-products>'+choices.productCards(products,status.products||{})+'</div><p class="best-explanation">Seleção sem prazo de encerramento. O preço mantém sua data de conferência e só é indicado como recente por até 24 horas. Confirme preço, frete, estoque e especificações no vendedor. <a href="/como-avaliamos.html">Conheça nossos critérios</a>.</p></section>';
const graph={'@context':'https://schema.org','@graph':[
  {'@type':'CollectionPage','@id':SITE+choices.PAGE,name:heading,url:SITE+choices.PAGE,description,inLanguage:'pt-BR'},
  {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Início',item:SITE},{'@type':'ListItem',position:2,name:'Melhores escolhas',item:SITE+choices.PAGE}]},
  {'@type':'ItemList',name:'Rankings e comparativos por categoria',itemListElement:selectedGuides.map((g,i)=>({'@type':'ListItem',position:i+1,name:g.title,url:SITE+g.url}))},
  {'@type':'ItemList',name:'Produtos selecionados para analisar',itemListElement:products.map((p,i)=>({'@type':'ListItem',position:i+1,name:p.titulo,url:SITE+choices.productUrl(p).slice(1)}))}
]};
const style=':root{--green:#116149;--ink:#17372a;--line:#d5e5de}*{box-sizing:border-box}body{margin:0;color:var(--ink);background:#f6faf7;font:16px system-ui,Segoe UI,sans-serif;line-height:1.6}a{color:#116149}.wrap{width:min(1120px,calc(100% - 32px));margin:auto}header{background:white;border-bottom:1px solid var(--line)}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:70px}.brand{font-weight:900;text-decoration:none}main{padding:30px 0 50px}h1{font-size:clamp(1.8rem,4vw,2.7rem);line-height:1.2}h2{font-size:1.6rem}.eyebrow{color:#116149;font-size:.75rem;font-weight:900;text-transform:uppercase}.best-section{background:white;padding:24px;border:1px solid var(--line);border-radius:18px}.deal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.deal-card{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:14px;padding:16px}.deal-card img{display:block;width:100%;height:160px;object-fit:contain;background:#fafcfb}.deal-check{font-size:.77rem;color:#116149;font-weight:800;margin-top:8px}.deal-card h3{font-size:1rem;line-height:1.4}.deal-price{font-weight:900;font-size:1.15rem;color:#116149}.deal-validity{font-size:.78rem;color:#587066}.deal-actions{margin-top:auto}.offer-button{display:block;text-align:center;min-height:44px;padding:10px;border-radius:9px;background:#1769e0;color:white;text-decoration:none;font-weight:800}.share-deal-button{background:transparent;border:0;color:#116149;min-height:44px;font:inherit;cursor:pointer}.crumb{font-size:.85rem}footer{padding:24px 0;border-top:1px solid var(--line);font-size:.85rem}.section-head>div>h2{margin:8px 0}@media(max-width:850px){.deal-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:580px){.deal-grid{grid-template-columns:1fr}.best-section{padding:16px}.wrap{width:calc(100% - 24px)}}';
const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+choices.esc(heading)+' | Ranking da Compra</title><meta name="description" content="'+description+'"><meta name="robots" content="index,follow"><link rel="canonical" href="'+SITE+choices.PAGE+'"><meta property="og:title" content="'+choices.esc(heading)+' | Ranking da Compra"><meta property="og:description" content="'+description+'"><meta property="og:type" content="website"><meta property="og:url" content="'+SITE+choices.PAGE+'"><meta property="og:image" content="'+SITE+'og-ranking-da-compra.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+choices.esc(heading)+'"><meta name="twitter:description" content="'+description+'"><script type="application/ld+json" id="best-schema">'+JSON.stringify(graph).replace(/</g,'\\u003c')+'</script><style>'+style+'</style><link rel="stylesheet" href="/best-choices.css?v=20261005-1"><script src="/public-data.js?v=20261005-1"></script><script src="/promotion-title.js?v=20261005-1"></script><script src="/best-choices.js?v=20261005-ux"></script><script defer src="/best-choices-page.js?v=20261005-1"></script><script defer src="/growth-tools.js?v=20261005-ux"></script></head><body><header><div class="wrap"><a class="brand" href="/">Ranking da Compra</a><nav><a href="/analises.html">Todas as categorias</a> · <a href="/#relampagos">Ofertas relâmpago</a></nav></div></header><main class="wrap"><nav class="crumb" aria-label="Caminho da página"><a href="/">Início</a> / Melhores escolhas</nav><h1>'+choices.esc(heading)+'</h1><p>Um ponto de partida para encontrar o produto certo. Acesse o comparativo da categoria, examine os critérios e consulte a análise completa antes de comprar.</p>'+content.replace(/<h2 data-best-title>[\s\S]*?<\/h2>/, '<h2>Compare por categoria e necessidade</h2>')+'</main><footer><div class="wrap">Podemos receber comissão pelos links de afiliados, sem custo adicional para você. Não afirmamos ter testado os produtos pessoalmente. <a href="/politica-afiliados.html">Política de afiliados</a> · <a href="/contato.html">Contato</a></div></footer></body></html>\n';
const previous=await readFile(choices.PAGE,'utf8').catch(()=>'');
await writeFile(choices.PAGE,html);
let sitemap=await readFile('sitemap.xml','utf8');
const location=SITE+choices.PAGE;
const old=sitemap.match(/<url>\s*<loc>https:\/\/rankingdacompra\.com\.br\/melhores-escolhas\.html<\/loc>[\s\S]*?<\/url>/)?.[0];
const lastModified=previous===html ? old?.match(/<lastmod>([^<]+)/)?.[1] || new Date().toISOString().slice(0,10) : new Date().toISOString().slice(0,10);
sitemap=sitemap.replace(/^[ \t]*<url>\s*<loc>https:\/\/rankingdacompra\.com\.br\/melhores-escolhas\.html<\/loc>[\s\S]*?<\/url>[ \t]*\r?\n?/gm,'').replace(/^[ \t]+$/gm,'').replace(/\n+(?=<\/urlset>)/,'\n');
sitemap=sitemap.replace('</urlset>','  <url><loc>'+location+'</loc><lastmod>'+lastModified+'</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>\n</urlset>');
await writeFile('sitemap.xml',sitemap);
// Persistent HTML also lives on the home page, with no Firebase request.
let home=await readFile('index.html','utf8');
const start='<!-- static-home-products:start -->',end='<!-- static-home-products:end -->';
const staticBlock=start+'<main class="wrap static-home" aria-label="Produtos e comparativos em destaque">'+content+'<a class="button secondary" href="/'+choices.PAGE+'">Ver página completa de melhores escolhas</a><nav class="static-guide-grid" aria-label="Comparativos prioritários">'+selectedGuides.map(g=>'<a href="/'+choices.esc(g.url)+'">'+choices.esc(g.title)+'</a>').join('')+'</nav></main>'+end;
home=home.replace(new RegExp(start+'[\\s\\S]*?'+end),staticBlock);
await writeFile('index.html',home);
console.log('Melhores escolhas publicadas: '+products.length+' produtos e '+selectedGuides.length+' rankings, sem novas leituras do Firebase.');
