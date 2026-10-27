import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import home from '../informational-home.js';
export async function buildInformationalHome(root=process.cwd()){
 const [data,config,original,sitemap]=await Promise.all(['informational-catalogue.json','site-config.json','index.html','sitemap.xml'].map(async file=>{const s=await readFile(resolve(root,file),'utf8');return file.endsWith('.json')?JSON.parse(s):s;}));
 if(data.mode!=='informational'||!Array.isArray(data.products))throw Error('Catálogo informativo ausente; página anterior preservada.');
 // A visible shelf must not advertise a missing, retired or non-indexable article.
 const routes=new Set([...home.selection(data),...home.collections(data).flatMap(s=>s.products)].map(p=>new URL(p.url,'https://rankingdacompra.com.br').pathname));
 home.guides(data).forEach(g=>routes.add(g.path));
 home.videos(data,config).forEach(v=>routes.add(v.path));
 for(const path of routes){
  if(!sitemap.includes('<loc>https://rankingdacompra.com.br'+path+'</loc>'))throw Error('Destino fora do sitemap: '+path+'; página anterior preservada.');
  const article=await readFile(resolve(root,'.'+path),'utf8');
  if(/http-equiv=["']refresh["']|rdc-paused-product|rdc-retired-product|<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(article))throw Error('Destino não indexável: '+path+'; página anterior preservada.');
 }
 const start='<!-- static-home-products:start -->',end='<!-- static-home-products:end -->';
 const a=original.indexOf(start),b=original.indexOf(end);if(a<0||b<a)throw Error('Marcadores da vitrine ausentes; página anterior preservada.');
 const block=start+'<main class="wrap static-home" data-info-home-static aria-label="Produtos, comparativos e vídeos em destaque">'+home.markup(data,config)+'</main>'+end;
 let next=original.slice(0,a)+block+original.slice(b+end.length);
 next=next.replace('✓ Preço com data de conferência','✓ Informações com fontes');
 // The assets remain in the head across ordinary catalogue regenerations.
 next=next.replace(/<link rel="stylesheet" href="\/informational-home\.css[^>]*>/g,'').replace(/<script defer src="\/informational-home\.js[^>]*><\/script>/g,'');
 next=next.replace(/<script id="informational-home-schema" type="application\/ld\+json">[^]*?<\/script>/g,'');
 const schema=JSON.stringify(home.structuredData(data)).replace(/</g,'\\u003c');
 next=next.replace('</head>',()=>'<link rel="stylesheet" href="/informational-home.css?v=20261027-2"><script defer src="/informational-home.js?v=20261027-2"></script><script id="informational-home-schema" type="application/ld+json">'+schema+'</script></head>');
 // Fixed content revision, not a claim that every product was reviewed today.
 const updatedSitemap=sitemap.replace(/<url>\s*<loc>https:\/\/rankingdacompra\.com\.br\/<\/loc>([^]*?)<\/url>/,block=>block.replace(/<lastmod>([^<]+)<\/lastmod>/,(tag,date)=>date.slice(0,10)<'2026-10-27'?'<lastmod>2026-10-27</lastmod>':tag));
 if(next!==original)await writeFile(resolve(root,'index.html'),next,'utf8');
 if(updatedSitemap!==sitemap)await writeFile(resolve(root,'sitemap.xml'),updatedSitemap,'utf8');
 return {selected:home.selection(data).length,additional:home.collections(data).reduce((sum,s)=>sum+s.products.length,0),shelves:home.collections(data).length,guides:home.guides(data).length,videos:home.videos(data,config).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(await buildInformationalHome());
