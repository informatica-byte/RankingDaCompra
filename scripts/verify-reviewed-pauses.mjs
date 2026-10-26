import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import review from '../pending-review-pause.js';

// Inspect only the output of the same complete generation: no second database
// read, price consultation, write or automatic restoration of paused products.
export function assertReviewedPauses({catalogue,sitemap,search,pages}) {
  if(!Array.isArray(catalogue?.products)||!search||typeof sitemap!=='string')throw Error('Saída de publicação incompleta para verificar pausas.');
  const ids=new Set(catalogue.products.map(p=>p.id)),searchText=JSON.stringify(search),errors=[];
  for(const target of review.TARGETS){
    const html=pages[target.id]||'';
    if(ids.has(target.id))errors.push(target.label+': ainda está no catálogo de ofertas.');
    if(sitemap.includes('/produto/'+target.id+'-'))errors.push(target.label+': ainda está no sitemap.');
    if(searchText.includes(target.id))errors.push(target.label+': ainda está na busca ativa.');
    if(!/<meta name="rdc-paused-product" content="true">/.test(html)
        || !/<meta name="robots" content="noindex,follow">/.test(html)
        || /http-equiv="refresh"|id="(?:mobile-)?affiliate-offer"|"@type"\s*:\s*"Product"/i.test(html)){
      errors.push(target.label+': página de pausa preservada não foi confirmada.');
    }
  }
  if(errors.length)throw Error('Publicação bloqueada na revisão dos 21: '+errors.join(' '));
  return {paused:review.TARGETS.length,activeProducts:catalogue.products.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const json=file=>JSON.parse(readFileSync(resolve(file),'utf8'));
  const pages=Object.fromEntries(review.TARGETS.map(target=>{
    let html='';try{html=readFileSync(resolve('produto',target.id+'-20260810-1.html'),'utf8');}catch{}
    return [target.id,html];
  }));
  const result=assertReviewedPauses({catalogue:json('vitrine-publica.json'),sitemap:readFileSync(resolve('sitemap.xml'),'utf8'),search:json('search-index.json'),pages});
  console.log('Pausas confirmadas nesta geração: '+result.paused+' cadastros preservados, separados da vitrine, sitemap e busca. Produtos ativos: '+result.activeProducts+'. Nenhuma conferência foi iniciada.');
}
