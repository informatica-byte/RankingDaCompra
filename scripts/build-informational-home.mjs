import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import home from '../informational-home.js';
export async function buildInformationalHome(root=process.cwd()){
 const [data,config,original]=await Promise.all(['informational-catalogue.json','site-config.json','index.html'].map(async file=>{const s=await readFile(resolve(root,file),'utf8');return file.endsWith('.json')?JSON.parse(s):s;}));
 if(data.mode!=='informational'||!Array.isArray(data.products))throw Error('Catálogo informativo ausente; página anterior preservada.');
 const start='<!-- static-home-products:start -->',end='<!-- static-home-products:end -->';
 const a=original.indexOf(start),b=original.indexOf(end);if(a<0||b<a)throw Error('Marcadores da vitrine ausentes; página anterior preservada.');
 const block=start+'<main class="wrap static-home" data-info-home-static aria-label="Produtos, comparativos e vídeos em destaque">'+home.markup(data,config)+'</main>'+end;
 let next=original.slice(0,a)+block+original.slice(b+end.length);
 next=next.replace('✓ Preço com data de conferência','✓ Informações com fontes');
 // The assets remain in the head across ordinary catalogue regenerations.
 next=next.replace(/<link rel="stylesheet" href="\/informational-home\.css[^>]*>/g,'').replace(/<script defer src="\/informational-home\.js[^>]*><\/script>/g,'');
 next=next.replace('</head>','<link rel="stylesheet" href="/informational-home.css?v=20261027-1"><script defer src="/informational-home.js?v=20261027-1"></script></head>');
 if(next!==original)await writeFile(resolve(root,'index.html'),next,'utf8');
 return {selected:home.selection(data).length,guides:home.guides(data).length,videos:home.videos(data,config).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(await buildInformationalHome());
