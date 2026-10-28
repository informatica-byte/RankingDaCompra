import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import info from '../informational-mode.js';
import decision from '../decision-brief.js';
import {popularById,matchesPopularAnalysis,registeredOfferUrl} from './popular-analysis.mjs';
const featuredBriefs=JSON.parse(await readFile(new URL('../featured-analysis.json',import.meta.url),'utf8')).products;

const money=/R\$(?:\s|&nbsp;)*[\d.,]+/gi;
const legacyLabel=value=>String(value||'').replace(/(?:Oferta informada:|Pre[cç]o informado de)\s*/gi,'Informações sobre ').replace(/\s+por\s+R\$(?:\s|&nbsp;)*[\d.,]+/gi,'').replace(/\(?\d+(?:[,.]\d+)?\s*%\s*(?:OFF|de desconto)\)?/gi,'').replace(/at[eé]\s*R\$(?:\s|&nbsp;)*[\d.,]+/gi,'por características').replace(money,'').replace(/(?:ofertas? rel[aâ]mpago|ofertas? verificadas?)/gi,'produtos em destaque').replace(/comparar por or[cç]amento/gi,'Comparar características').replace(/pre[cç]os com data(?: de confer[eê]ncia)?/gi,'informações com fontes').replace(/Ver an[aá]lise e (?:conferir pre[cç]o|pre[cç]o atual|ofertas|pre[cç]o)/gi,'Ver análise completa').replace(/Pre[cç]os? a confirmar:?/gi,'Condições nas lojas').replace(/pre[cç]os? registrados?/gi,'características documentadas').replace(/Consulte pre[cç]os, diferenças/gi,'Consulte fontes, diferenças').replace(/Compare rankings por categoria/gi,'Explore comparativos por categoria').replace(/mais barato/gi,'alternativas para comparar').replace(/melhor custo.benef[ií]cio/gi,'adequação ao seu uso').replace(/Melhores escolhas e rankings de produtos/gi,'Produtos e guias para escolher melhor').replace(/veja os crit[eé]rios dos rankings abaixo/gi,'consulte as fontes e limitações em cada ficha').replace(/rankings, produtos e pre[cç]os atualizados/gi,'guias e informações dos produtos').replace(/Atualizando rankings e produtos selecionados/gi,'Carregando produtos e guias').replace(/\s{2,}/g,' ').trim();
const label=value=>legacyLabel(value).replace(/An[aá]lises de produtos, pre[cç]os e ofertas/gi,'Análises de produtos, vantagens e limitações').replace(/Ver pre[cç]o, pr[oó]s e contras/gi,'Ver análise, vantagens e limitações').replace(/pelo seu or[cç]amento/gi,'pelo seu uso');
function attrs(tag){return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(m=>[m[1].toLowerCase(),m[3]]));}
function plain(value){return value.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();}
// Position-based transformation: raw scripts/styles are opaque, and only
// complete generated elements are removed. No browser execution or network.
export function elements(html){
 const stack=[],nodes=[];const tokens=/<!--[^]*?-->|<script\b(?:[^>"']|"[^"]*"|'[^']*')*>[^]*?<\/script\s*>|<style\b(?:[^>"']|"[^"]*"|'[^']*')*>[^]*?<\/style\s*>|<\/?[a-zA-Z][\w:-]*(?:[^>"']|"[^"]*"|'[^']*')*>/g;
 for(const match of html.matchAll(tokens)){
  const raw=match[0];if(/^<!--|^<(?:script|style)\b/i.test(raw))continue;
  const tag=raw.match(/^<\/?([\w:-]+)/)?.[1]?.toLowerCase();if(!tag)continue;
  if(/^<\//.test(raw)){
   const index=stack.findLastIndex(node=>node.tag===tag);if(index<0)continue;
   const node=stack[index];stack.length=index;node.close=match.index;node.end=match.index+raw.length;node.text=plain(html.slice(node.openEnd,node.close));continue;
  }
  const node={tag,start:match.index,openEnd:match.index+raw.length,end:match.index+raw.length,close:match.index+raw.length,attributes:attrs(raw),parent:stack.at(-1),children:[],text:''};
  node.parent?.children.push(node);nodes.push(node);
  if(!/^(?:meta|link|img|input|br|hr|source|area|embed|wbr|param|track|col|base)$/.test(tag)&&!raw.endsWith('/>'))stack.push(node);
 }
 return nodes;
}
function changes(html,ranges){
 const kept=[];
 for(const range of ranges.sort((a,b)=>a.start-b.start||b.end-a.end)){
  if(kept.some(p=>p.start<=range.start&&p.end>=range.end))continue;
  if(kept.some(p=>p.end>range.start))throw Error('Transformações HTML sobrepostas; publicação bloqueada.');kept.push(range);
 }
 for(const {start,end,value=''}of kept.reverse())html=html.slice(0,start)+value+html.slice(end);
 return html;
}
function schema(value){
 if(Array.isArray(value))return value.map(schema).filter(v=>v!==undefined);
 if(typeof value==='string')return label(value);
 if(!value||typeof value!=='object')return value;
 const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];
 if(types.some(t=>['Offer','AggregateOffer','Review','Rating','AggregateRating'].includes(t)))return undefined;
 if(types.includes('Product'))return {...(value['@context']?{'@context':value['@context']}:{}),'@type':'Article',headline:label(value.name),description:label(value.description),image:value.image,mainEntityOfPage:value.url||value['@id']?.replace(/#product$/,''),about:{'@type':'Thing',name:label(value.name)},author:{'@type':'Organization',name:'Equipe editorial Ranking da Compra'}};
 const forbidden=new Set(['offers','price','lowPrice','highPrice','priceCurrency','priceValidUntil','availability','aggregateRating','reviewRating','ratingValue','ratingCount','reviewCount','bestRating','worstRating','review']);
 return Object.fromEntries(Object.entries(value).filter(([key])=>!forbidden.has(key)).map(([key,item])=>[key,schema(item)]).filter(([,item])=>item!==undefined));
}
export function affiliateLinks(html){
 return [...html.matchAll(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map(m=>attrs(m[0])).filter(a=>['affiliate-offer','mobile-affiliate-offer','affiliate-offer-shopee'].includes(a.id)).map(a=>[a.id,a.href]);
}
export function assertInformationalHtml(html,file='página'){
 if(!/name="rdc-site-mode" content="informational"/.test(html))throw Error(file+': modo informativo não declarado');
 const visible=html.replace(/<script\b[^]*?<\/script>|<style\b[^]*?<\/style>/gi,'');
 if(/R\$(?:\s|&nbsp;)*\d/.test(visible))throw Error(file+': preço numérico exposto');
 const visit=node=>{
  if(Array.isArray(node)){node.forEach(visit);return;}if(!node||typeof node!=='object')return;
  if((Array.isArray(node['@type'])?node['@type']:[node['@type']]).some(t=>['Offer','AggregateOffer','AggregateRating','Review','Rating'].includes(t)))throw Error(file+': oferta ou avaliação estruturada incompatível com o modo informativo');
  for(const [key,value]of Object.entries(node)){if(['price','lowPrice','highPrice','priceCurrency','priceValidUntil','ratingValue','ratingCount','reviewCount'].includes(key))throw Error(file+': campo comercial estruturado exposto: '+key);visit(value);}
 };
 for(const [,json]of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([^]*?)<\/script>/gi))visit(JSON.parse(json));
 for(const [id,link]of affiliateLinks(html)){
  const url=new URL(link.replace(/&amp;/g,'&'));
  if(url.protocol!=='https:'||url.username||url.password||url.port||!/(^|\.)(meli\.la|mercadolivre\.com\.br|mercadolibre\.com|shopee\.com\.br)$/.test(url.hostname))throw Error(file+': link de afiliado inválido: '+id);
 }
}
export function informationalHtml(source,product,file=''){
 if(/^instalar[-.]/i.test(file))return source.replace(/<meta name="rdc-site-mode"[^>]*>/g,'').replace(/<script src="\/informational-mode\.js[^>]*><\/script>/g,'').replace(/<link rel="stylesheet" href="\/informational-mode\.css[^>]*>/g,'');
 if(/http-equiv=["']refresh["']|rdc-paused-product|rdc-retired-product/i.test(source))return source;
 // Our bounded, generated brief already has its own escaping and editorial
 // rules. Keep it opaque to legacy text rewrites (which trim inline spacing).
 // The whole page still goes through the final public/security validators.
 const savedBriefs=[];
 const prepared=source.replace(/<!-- decision-brief:start -->[^]*?<!-- decision-brief:end -->/g,block=>'<!-- rdc-preserved-brief:'+ (savedBriefs.push(block)-1)+' -->');
 let html=prepared.replace(/<script\b([^>]*type=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi,(_tag,attributes,json)=>{const clean=schema(JSON.parse(json));return clean?'<script'+attributes+'>'+JSON.stringify(clean).replace(/</g,'\\u003c')+'</script>':'';});
 const nodes=elements(html),ranges=[];let decisionQuestion=false;
 const add=(node,value='')=>ranges.push({start:node.start,end:node.end,value});
 for(const node of nodes){
  const a=node.attributes,classes=String(a.class||'').split(/\s+/);
  const opening=html.slice(node.start,node.openEnd),has=name=>new RegExp('\\s'+name+'(?:[\\s=>])').test(opening);
  if(classes.some(c=>/^(?:price|previous|rating|deal-prices|deal-price|deal-validity|deal-check|flash-timer|flash-discount|flash-ribbon|flash-badge|price-proof|weekly-ranking-score|score|rank-number)$/.test(c))||has('data-offer-proof')||has('data-price-history-product')){add(node);continue;}
  if(has('data-informational-faq')){add(node);continue;}
  if(node.tag==='details'&&node.children.some(child=>child.tag==='summary'&&/R\$|or[cç]amento|custo.benef[ií]cio|adequa[cç][aã]o ao seu uso|por caracter[ií]sticas ou|O que devo comparar antes de escolher/i.test(child.text))){add(node,decisionQuestion?'':'<details><summary>O que devo comparar antes de escolher?</summary><p>Compare modelos do mesmo tipo e confira os recursos que fazem diferença no seu uso. Consulte as fontes e as informações sinalizadas como pendentes. As condições de compra são definidas pela loja parceira.</p></details>');decisionQuestion=true;continue;}
  if(node.tag==='meta'&&/price|rdc-price|rdc-manual/i.test(a.property||a.name||a.itemprop||'')){add(node);continue;}
  if(node.tag==='strong'&&/^(?:Pre[cç]o a confirmar|Pre[cç]o conferido|[UÚ]ltimo pre[cç]o registrado)/i.test(node.text)){add(node);continue;}
  if(classes.includes('fact')&&/^(?:Posi[cç][aã]o|Nota |Avalia[cç][aã]o)/i.test(node.text)){add(node);continue;}
  if(classes.includes('badge')&&/melhor|oferta|desconto|mais barato/i.test(node.text)){add(node);continue;}
  if(node.tag==='p'||node.tag==='li'){
   if((/R\$(?:\s|&nbsp;)*\d|menor pre[cç]o|mais barato|custo.benef[ií]cio.*\d+%|Por que est[aá] nesta posi[cç][aã]o|pre[cç]o conferido|pre[cç]o registrado|pre[cç]o mant[eé]m|data do pre[cç]o|confer[eê]ncia do pre[cç]o|[0-9]+\s*%\s*(?:off|de desconto)/i.test(node.text))&&!/id=["'](?:mobile-)?affiliate-offer/.test(html.slice(node.start,node.end)))add(node);
  }
  if(node.tag==='tr'&&/^(?:Pre[cç]o|Pontua[cç][aã]o|Custo.benef[ií]cio|Confer[eê]ncia do pre[cç]o)/i.test(node.text))add(node);
  if(node.tag==='table'){
   const rows=node.children.flatMap(child=>child.tag==='tr'?[child]:child.children.filter(c=>c.tag==='tr'));
   const headings=rows.find(row=>row.children.some(c=>c.tag==='th'));
   if(headings){const indexes=headings.children.map((cell,i)=>/pre[cç]o|pontua[cç][aã]o|custo.benef[ií]cio|confer[eê]ncia/i.test(cell.text)?i:-1).filter(i=>i>=0);for(const row of rows)for(const i of indexes)if(row.children[i])add(row.children[i]);}
  }
  if(node.tag==='label'&&node.children.some(c=>c.tag==='input'&&/data-buyer-budget|data-buyer-recent/.test(html.slice(c.start,c.openEnd)))){const original=html.slice(node.start,node.end);if(!/^<label\s+hidden/.test(original))add(node,original.replace(/^<label/,'<label hidden'));}
 }
 html=changes(html,ranges);
 if(/^melhores-.+\.html$/.test(file)){
  html=html.replace(/<p class="notice" data-informational-guide>[^]*?<\/p>/g,'');
  const note=file==='melhores-escolhas.html'?'<p class="notice" data-informational-guide>Seleção sem prazo de encerramento, organizada para explorar produtos e usos, não para apontar um vencedor por preço. <a href="/como-avaliamos.html">Conheça nossos critérios</a>.</p>':'<p class="notice" data-informational-guide><b>Sem vencedor artificial.</b> Comparamos informações anunciadas de modelos do mesmo tipo. Dados sem confirmação permanecem sinalizados. Não realizamos testes próprios. <a href="/como-avaliamos.html">Leia nossa metodologia</a>.</p>';
  html=html.replace(/(<h1\b[^>]*>[^]*?<\/h1>)/i,'$1'+note);
 }
 if(file==='como-avaliamos.html'){
  const main=elements(html).find(node=>node.tag==='main');
  if(!main)throw Error('Metodologia sem conteúdo principal.');
  const body='<main class="wrap"><h1>Como ajudamos você a escolher</h1><p>Um produto bom para outra pessoa pode não atender ao que você precisa. Nosso trabalho é organizar diferenças, explicar limitações e mostrar onde cada informação foi encontrada.</p><h2>Comparamos o que pode ser comparado</h2><p>Separamos tipos de produto e modelos distintos. Outra cor do mesmo modelo não vira um concorrente novo. Quando o formato ou a versão estiver contraditório, sinalizamos a dúvida em vez de forçar uma classificação.</p><h2>Fontes e limites da informação</h2><ul><li>Dados do anúncio são identificados como informação do vendedor, não como teste independente.</li><li>Documentação do fabricante só é atribuída ao modelo ou à variante que conseguimos relacionar à fonte.</li><li>O que não está confirmado continua sinalizado. Ausência de informação não significa ausência do recurso.</li><li>Não atribuímos estrelas, desempenho medido ou experiência de uso que não podemos comprovar.</li></ul><h2>Sem ranking de menor preço</h2><p>O site não publica valores, descontos ou contadores de oferta. As seleções são caminhos para explorar características e usos, não uma promessa de economia. Confira as condições de compra, disponibilidade, entrega e variante na loja.</p><h2>Como o site se mantém</h2><p>Podemos receber comissão pelos links de afiliados, sem custo adicional para você. Não tratamos cliques como vendas. A aprovação de uma compra é informada pela plataforma de afiliados, não pelo clique no botão.</p><h2>Uso de IA e revisão</h2><p>A IA pode auxiliar na organização do texto, mas não substitui a fonte. Não garantimos que toda análise tenha sido revisada por duas IAs. Uma melhoria de redação não altera silenciosamente a ordem calculada ou cria evidência de teste prático.</p><p><a href="/politica-afiliados.html">Política de afiliados</a> · <a href="/contato.html">Encontrou algo incorreto? Avise a equipe</a></p></main>';
  html=changes(html,[{start:main.start,end:main.end,value:body}]);
 }
 html=html.split(/(<script\b[^]*?<\/script>|<style\b[^]*?<\/style>)/gi).map(part=>/^<(script|style)\b/i.test(part)?part:part.replace(/>([^<]+)</g,(_all,content)=>'>'+label(content)+'<').replace(/(<meta\b[^>]*(?:property|name)=["'](?:og:title|og:description|twitter:title|twitter:description|description)["'][^>]*content=)(["'])([^"']*)(\2)/gi,(_all,start,q,value,end)=>start+q+label(value)+end)).join('');
 html=html.replace(/<meta name="rdc-site-mode"[^>]*>/g,'').replace(/<script src="\/informational-mode\.js[^>]*><\/script>/g,'').replace(/<link rel="stylesheet" href="\/informational-mode\.css[^>]*>/g,'');
 html=html.replace(/(<script\b[^>]*src=["']\/)(buyer-tools|growth-tools|best-choices-page|best-choices)(\.js)([^"']*)(["'])/gi,(_all,start,name,ext,query,end)=>start+name+ext+query.replace(/([?&])mode=[^&"']*/g,'')+(query.includes('?')?'&':'?')+'mode='+info.VERSION+end);
 html=html.replace(/>(Conferir pre[cç]o(?: atual)?|Ver pre[cç]o)( no Mercado Livre| na Mercado Livre| na Shopee)</gi,(_all,_action,place)=>'>Ver produto'+place.replace('na Mercado','no Mercado')+'<');
 html=html.replace(/[ \t]+\r?\n/g,'\n');
 html=html.replace(/<script src="\/decision-brief\.js[^>]*><\/script>/g,'');
 const injection='<meta name="rdc-site-mode" content="informational"><link rel="stylesheet" href="/informational-mode.css?v='+info.VERSION+'"><script src="/decision-brief.js?v='+info.VERSION+'"></script><script src="/informational-mode.js?v='+info.VERSION+'"></script>';
 const policy=html.match(/<meta\b(?=[^>]*http-equiv=["']Content-Security-Policy["'])(?:[^>"']|"[^"]*"|'[^']*')*>/i);
 if(policy)html=html.slice(0,policy.index+policy[0].length)+injection+html.slice(policy.index+policy[0].length);
 else html=html.replace(/<head([^>]*)>/i,'<head$1>'+injection);
 if(product&&!/data-reviewed-depth=/.test(html)){const faq=info.faq(product);if(faq){const marker=html.indexOf('</article>');html=marker>=0?html.slice(0,marker)+faq+html.slice(marker):html.replace('</main>',faq+'</main>');}}
 html=html.replace(/<!-- rdc-preserved-brief:(\d+) -->/g,(_tag,index)=>savedBriefs[Number(index)]);
 if(product?.decisionBrief){
  html=html.replace(/<!-- decision-brief:start -->[^]*?<!-- decision-brief:end -->/g,'').replace(/<!-- quick-product-summary:start -->[^]*?<!-- quick-product-summary:end -->/g,'').replace(/<details data-full-product-summary><summary>Ler a análise completa<\/summary>(<p class="summary">[^]*?<\/p>)<\/details>/g,'$1');
  const rendered=decision.render(product.decisionBrief);
  html=html.replace(/<p class="summary">([^]*?)<\/p>/,(paragraph,body)=> '<!-- decision-brief:start -->'+rendered+'<!-- decision-brief:end -->'+(decision.sober(body)===decision.text(body)?paragraph:'<p class="summary">'+info.esc(decision.sober(body)||'Alegações promocionais do anúncio não foram comprovadas nesta análise. Consulte os dados e as fontes disponíveis.')+'</p>'));
 }
 if(JSON.stringify(affiliateLinks(source))!==JSON.stringify(affiliateLinks(html)))throw Error('A migração alteraria os links de afiliados de '+(product?.id||'uma página')+'. Operação bloqueada.');
 return html;
}
function attrsById(html,id){return [...html.matchAll(/<a\b[^>]*>/gi)].map(m=>attrs(m[0])).find(a=>a.id===id);}
export async function buildInformationalSite(root=process.cwd()){
 root=resolve(root);const readJson=async file=>JSON.parse(await readFile(resolve(root,file),'utf8'));
 const [search,catalogue,config,guides]=await Promise.all(['search-index.json','vitrine-publica.json','site-config.json','best-choices-guides.json'].map(readJson));
 const map=new Map(catalogue.products.map(p=>[p.id,p]));
 const products=search.products.map(p=>({id:p.id,title:p.title,summary:info.excerpt(p.summary),image:p.image,url:p.url,category:p.category,categoryId:map.get(p.id)?.categoria||'',comparison:p.comparison}));
 // Public editorial projection only. Saved records, prices and source snapshots
 // stay intact. Confirm against the page's registered seller before overriding.
 for(const p of products){
  const review=popularById.get(p.id);if(!review)continue;
  const source=await readFile(resolve(root,new URL(p.url,'https://rankingdacompra.com.br').pathname.slice(1)),'utf8');
  if(matchesPopularAnalysis(review,p.title,registeredOfferUrl(source))){
   p.summary=info.excerpt(review.publicSummary);if(review.publicName)p.title=review.publicName;
   if(review.comparisonFeatures&&p.comparison)p.comparison={...p.comparison,features:review.comparisonFeatures.map(feature=>({...feature}))};
  }
 }
 for(const p of products){
  const html=await readFile(resolve(root,new URL(p.url,'https://rankingdacompra.com.br').pathname.slice(1)),'utf8');
  const candidate=popularById.get(p.id)||featuredBriefs.find(r=>r.id===p.id);
  const matched=candidate&&new RegExp(candidate.guard,'i').test(p.title)&&html.includes('data-reviewed-depth="'+p.id+'"')&&(!(candidate.expectedListing||candidate.expectedCatalogue)||matchesPopularAnalysis(candidate,p.title,registeredOfferUrl(html)));
  p.decisionBrief=decision.make(p,matched?candidate:null);
 }
 const byUrl=new Map(products.map(p=>[new URL(p.url,'https://rankingdacompra.com.br/').pathname.slice(1),p]));
 const publicFiles=(await readdir(root)).filter(f=>f.endsWith('.html')&&!info.privatePath('/'+f));
 for(const directory of ['produto','presentes'])for(const file of await readdir(resolve(root,directory)))if(file.endsWith('.html'))publicFiles.push(directory+'/'+file);
 let changed=0;
 for(const file of publicFiles){const path=resolve(root,file),old=await readFile(path,'utf8'),p=byUrl.get(file);const next=informationalHtml(old,p,file);if(next!==old){await writeFile(path,next,'utf8');changed++;}}
 const feed={version:1,mode:'informational',editorialSelectionVersion:1,generatedAt:new Date().toISOString(),selected:(config.bestChoicesProductIds||[]).filter(id=>products.some(p=>p.id===id)),guides:guides.guides.map(g=>({...g,title:label(g.title),summary:info.excerpt(g.summary)})),products};
 await writeFile(resolve(root,'informational-catalogue.json'),JSON.stringify(feed)+'\n');
 // The migration changes the page, not the verification date of its facts.
 // Keep a fixed migration floor instead of claiming a fresh review every build.
 const sitemapPath=resolve(root,'sitemap.xml'),sitemap=await readFile(sitemapPath,'utf8');
 const updated=sitemap.replace(/<lastmod>([^<]+)<\/lastmod>/g,(tag,date)=>date.slice(0,10)<'2026-10-26'?'<lastmod>2026-10-26</lastmod>':tag);
 if(updated!==sitemap)await writeFile(sitemapPath,updated,'utf8');
 console.log('Modo informativo: '+products.length+' produtos; '+changed+' páginas preparadas sem preços, sem alterar cadastros ou links de afiliados.');
 return {products:products.length,changed};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await buildInformationalSite();
