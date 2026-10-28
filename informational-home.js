(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./informational-mode.js'));
 else {root.RDCInformationalHome=factory(root.RDCInformational);if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.RDCInformationalHome.init(),{once:true});else root.RDCInformationalHome.init();}}
})(typeof window==='object'?window:globalThis,function(info){
 'use strict';
 const SITE='https://rankingdacompra.com.br';
 const esc=info.esc;
 const clean=value=>info.excerpt(info.text(value));
 // Editorial shelves point to existing articles, never to invented offers.
 // ID + model + category guards prevent a reused record from becoming a new recommendation.
 const SHELVES=[
  {id:'fones-tws',title:'Fones TWS: veja as diferenças antes de escolher',category:'Fones de ouvido',family:'fone-tws',guide:'melhores-fones-de-ouvido.html',question:'Compare encaixe, autonomia anunciada, microfone e cancelamento de ruído. Outra cor do mesmo modelo não é uma alternativa diferente.',items:[
   ['kYzXt8BeErDzXsC6BlwB',/havit.*tw982/i,'HAVIT LIFE 01T (TW982)'],
   ['ZVVdy8TuP0yW0XNIyiEA',/soundcore.*p30i/i,'soundcore P30i da Anker'],
   ['FlqPY3yHJ2xPoNgnhSTE',/galaxy.*buds.*core/i,'Samsung Galaxy Buds Core']
  ]},
  {id:'notebooks',title:'Notebooks: confira a configuração da sua rotina',category:'Notebook',family:'notebook',guide:'melhores-notebook.html',question:'Processador, memória, armazenamento e sistema operacional precisam corresponder à variante do anúncio. Abra a análise para conferir o que está documentado.',items:[
   ['a77W30LAOCEPjWdkcAlU',/asus.*e1504fa-nj732/i,'ASUS Vivobook Go 15 E1504FA-NJ732'],
   ['TEaC0vVXmdvp4s8QMqpn',/acer.*a515-45-r2a3/i,'Acer Aspire 5 A515-45-R2A3'],
   ['7evzZBujin11TlbT8hvm',/dell.*dc15-i51334u-a50/i,'Dell DC15-i51334U-A50']
  ]},
  {id:'roteadores',title:'Roteadores: entenda a conexão antes da compra',category:'Roteador',family:'roteador',guide:'melhores-roteador.html',question:'Compare portas, padrão Wi-Fi, revisão de hardware e compatibilidade da rede. A velocidade anunciada da classe Wi-Fi não é uma garantia de velocidade de internet.',items:[
   ['AweCTxq7vwVQ7VmN4IIg',/mercusys.*mr80x.*v4/i,'MERCUSYS MR80X V4'],
   ['qZUWO8WSrcOKWVrAqTW7',/tp-link.*ex1500/i,'TP-Link EX1500'],
   ['mlMLB4801704305',/tenda.*rx12.*v2/i,'Tenda RX12 Pro V2.0']
  ]},
  {id:'cameras',title:'Câmeras: conheça as opções de monitoramento',category:'Câmeras de segurança',guide:'melhores-cameras-de-seguranca.html',question:'Confira o local de instalação, alimentação, aplicativo e forma de gravação na ficha. Não presuma proteção contra chuva nem serviço em nuvem gratuito.',items:[
   ['YKSSWNPjLAaUeRSLtVWT',/tapo.*c200/i,'TP-Link Tapo C200'],
   ['Gcz9OSyGgHGMKYfG87IS',/intelbras.*ime.*360/i,'Intelbras iME 360'],
   ['hvEYsBQVyORk8vWbQCNU',/intelbras.*im3.*c/i,'Intelbras iM3 C com MicroSD 32 GB']
  ]}
 ];
 function localPath(value,pattern){try{const u=new URL(value,SITE);return u.origin===SITE&&!u.username&&!u.password&&!u.search&&!u.hash&&pattern.test(u.pathname)?u.pathname:'';}catch{return '';}}
 function selection(data){
  const byId=new Map((data.products||[]).map(p=>[p.id,p])),seen=new Set(),out=[];
  let ids=data.selected||[];
  if(data.editorialSelectionVersion===1)ids=ids.filter(id=>{const b=byId.get(id)?.decisionBrief;return b?.reviewed&&b.advantages?.length&&b.limitations?.length&&b.sources?.length;}).map((id,index)=>({id,index,score:(byId.get(id).comparison?.features||[]).filter(f=>f.state!=='unknown'&&f.basis==='fabricante'&&f.sourceUrl).length})).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.id);
  for(const id of ids){const p=byId.get(id);if(!p||info.productUrl(p)==='#')continue;const key=info.text(p.title).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(!key||seen.has(key))continue;seen.add(key);out.push(p);if(out.length===6)break;}
  return out;
 }
 function guides(data){const seen=new Set();return (data.guides||[]).flatMap(g=>{const path=localPath(g.url,/^\/melhores-[a-z0-9-]+\.html$/);if(!path||seen.has(path)||!clean(g.title))return [];seen.add(path);return [{path,title:clean(g.title)}];});}
 function collections(data){
  const byId=new Map((data.products||[]).map(p=>[p.id,p])),seen=new Set(selection(data).map(p=>p.id)),publishedGuides=new Set(guides(data).map(g=>g.path));
  return SHELVES.flatMap(s=>{
   const path='/'+s.guide;if(!publishedGuides.has(path))return [];
   const products=s.items.flatMap(([id,model,title])=>{const p=byId.get(id);if(!p||seen.has(id)||p.category!==s.category||(s.family&&p.comparison?.family!==s.family)||!model.test(p.title||'')||info.productUrl(p)==='#'||!clean(p.summary))return [];return [{...p,title}];});
   if(products.length<2)return [];
   products.forEach(p=>seen.add(p.id));return [{id:s.id,title:s.title,question:s.question,path,products}];
  });
 }
 function collectionCards(items){return items.map(s=>'<section class="info-home-section info-shelf" id="explore-'+esc(s.id)+'" data-info-shelf="'+esc(s.id)+'"><div class="info-shelf-heading"><div><span class="eyebrow">Seleção por categoria</span><h2>'+esc(s.title)+'</h2></div><a href="'+esc(s.path)+'">Abrir o guia da categoria →</a></div><p>'+esc(s.question)+'</p><div class="deal-grid">'+info.cards(s.products)+'</div></section>').join('');}
 function structuredData(data){
  const lists=[{id:'top6-editorial',title:'Seleção editorial para conhecer e comparar',products:selection(data)},...collections(data)];
  return {'@context':'https://schema.org','@graph':lists.filter(s=>s.products.length).map(s=>({'@type':'ItemList','@id':SITE+'/#'+(s.id==='top6-editorial'?s.id:'explore-'+s.id),name:s.title,itemListOrder:'https://schema.org/ItemListUnordered',numberOfItems:s.products.length,itemListElement:s.products.map(p=>({'@type':'ListItem',name:clean(p.title),url:SITE+info.productUrl(p)}))}))};
 }
 function videoId(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return '';const host=u.hostname.toLowerCase();let id='';if(['youtube.com','www.youtube.com','m.youtube.com'].includes(host))id=u.pathname==='/watch'?u.searchParams.get('v'):(u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})\/?$/)||[])[1];else if(host==='youtu.be')id=u.pathname.slice(1);return /^[\w-]{11}$/.test(id||'')?id:'';}catch{return '';}}
 function videos(data,config){
  if(config?.youtubeShowcaseEnabled!==true)return [];
  const byPath=new Map((data.products||[]).map(p=>[info.productUrl(p),p])),seen=new Set();
  return (Array.isArray(config.youtubeShowcaseItems)?config.youtubeShowcaseItems:[]).slice(0,20).flatMap(item=>{const id=videoId(item.youtubeUrl),path=localPath(item.productUrl,/^\/produto\/[a-zA-Z0-9_-]+\.html$/),p=byPath.get(path);if(!id||!p||seen.has(id))return [];seen.add(id);return [{id,path,title:clean(p.title),image:info.safe(p.image||p.foto)}];});
 }
 function guideCards(items){return items.map(g=>'<a href="'+esc(g.path)+'"><strong>'+esc(g.title)+'</strong><span>Ver modelos, diferenças e limitações →</span></a>').join('');}
 function videoCards(items){return items.map(v=>'<article class="info-video-card" data-info-video-card="'+esc(v.id)+'"><div class="info-video-media"><img src="'+esc(v.image)+'" alt="'+esc(v.title)+'" loading="lazy" decoding="async" width="320" height="180"></div><h3>'+esc(v.title)+'</h3><button type="button" data-info-video-play="'+esc(v.id)+'" aria-label="Assistir ao vídeo de '+esc(v.title)+'">▶ Assistir ao vídeo</button><a href="'+esc(v.path)+'" data-info-video-product>Conhecer o produto e suas limitações →</a><a href="https://www.youtube.com/watch?v='+esc(v.id)+'" target="_blank" rel="noopener noreferrer">Abrir no YouTube ↗</a></article>').join('');}
 function markup(data,config){
  const products=selection(data),allGuides=guides(data),clips=videos(data,config),shelves=collections(data);
  const top=products.length?'<section class="info-home-section" id="melhores-escolhas" data-best-choices="true"><div id="top6-editorial"><span class="eyebrow">Seleção editorial</span><h2 data-best-title>'+(products.length===6?'Top 6 para conhecer e comparar':'Produtos para conhecer e comparar')+'</h2><p>Seis caminhos para explorar características e usos diferentes, não uma classificação do melhor para o pior. Compare apenas modelos do mesmo tipo e consulte as fontes de cada ficha.</p><div class="deal-grid" data-best-products>'+info.cards(products)+'</div><a class="button secondary" href="/melhores-escolhas.html">Explorar mais produtos selecionados</a></div></section>':'';
  const comparison=allGuides.length?'<section class="info-guides info-home-section" id="comparativos-inicio"><h2>Comparativos para cada necessidade</h2><p>Escolha uma categoria para entender formatos, recursos anunciados, vantagens e limitações. Informações não confirmadas permanecem sinalizadas.</p><nav id="guias-inicio" class="info-guide-grid" aria-label="Comparativos prioritários">'+guideCards(allGuides.slice(0,3))+'</nav>'+(allGuides.length>3?'<details class="info-home-more"><summary>Ver as outras '+(allGuides.length-3)+' categorias</summary><nav class="info-guide-grid" aria-label="Outros comparativos">'+guideCards(allGuides.slice(3))+'</nav></details>':'')+'<div class="info-home-actions"><a class="button primary" href="/comparar.html">Montar minha comparação</a><a href="/analises.html">Ver todos os guias e análises →</a></div></section>':'';
  const video=clips.length?'<section class="info-home-section" id="videos-inicio" data-info-videos><h2>Vídeos do Ranki: conheça os produtos</h2><p>Assista e abra a análise correspondente para consultar fontes e dúvidas. Os vídeos podem mostrar condições da época da gravação; confira as informações atuais na loja parceira.</p><p class="fine">O player do YouTube só é carregado quando você toca em assistir. Nenhum vídeo começa sozinho.</p><div class="info-video-grid">'+videoCards(clips.slice(0,6))+'</div>'+(clips.length>6?'<details class="info-home-more"><summary>Ver mais '+(clips.length-6)+' vídeos</summary><div class="info-video-grid">'+videoCards(clips.slice(6))+'</div></details>':'')+'</section>':'';
  const nav='<nav class="info-home-nav" aria-label="Explore a vitrine">'+(products.length?'<a href="#top6-editorial">Top 6 editorial</a>':'')+(allGuides.length?'<a href="#comparativos-inicio">Comparativos por categoria</a>':'')+(clips.length?'<a href="#videos-inicio">Vídeos dos produtos</a>':'')+'</nav>';
  const catalogue='<p class="info-catalogue-summary"><strong>'+esc(String(data.products?.length||0))+' análises no catálogo</strong><span>'+allGuides.length+' guias para explorar</span><a href="/analises.html">Conhecer todas as categorias →</a></p>';
  const shelfNav=shelves.length?'<nav class="info-home-nav info-shelf-nav" aria-label="Produtos por interesse">'+shelves.map(s=>'<a href="#explore-'+esc(s.id)+'">'+esc(s.products[0].category)+'</a>').join('')+'</nav>':'';
  return nav+catalogue+top+comparison+shelfNav+collectionCards(shelves)+video;
 }
 function bind(scope){scope.addEventListener('click',event=>{const button=event.target.closest('[data-info-video-play]');if(!button||!scope.contains(button)||!videoId('https://www.youtube.com/watch?v='+button.dataset.infoVideoPlay))return;const card=button.closest('[data-info-video-card]');if(!card)return;
  for(const other of scope.querySelectorAll('[data-info-video-card]')){other.querySelector('iframe')?.remove();const img=other.querySelector('img'),play=other.querySelector('[data-info-video-play]');if(img)img.hidden=false;if(play)play.hidden=false;}
  const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+button.dataset.infoVideoPlay+'?autoplay=1&playsinline=1&rel=0';frame.title=button.getAttribute('aria-label');frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';card.querySelector('.info-video-media').append(frame);card.querySelector('img').hidden=true;button.hidden=true;
 });}
 function init(){
  if(!info?.enabled||!/^\/(?:index\.html)?$/.test(location.pathname))return;
  const params=new URLSearchParams(location.search);if(['busca','cat','produto'].some(key=>params.has(key)))return;
  const app=document.getElementById('app');if(!app)return;
  // Static markup remains useful with JavaScript disabled or a failed feed.
  const staticHome=app.querySelector('[data-info-home-static]');if(staticHome)bind(staticHome);
  let configPromise,pending=false;
  const config=()=>configPromise||=(fetch('/site-config.json',{cache:'no-cache',credentials:'omit'}).then(r=>{if(!r.ok)throw Error('Configuração indisponível');return r.json();}).catch(()=>null));
  const enhance=async()=>{
   const main=app.querySelector('.info-hero + main');if(!main||main.dataset.infoHomeRestored||pending)return;
   pending=true;try{const [data,settings]=await Promise.all([info.load(),config()]);if(!main.isConnected)return;
    // If configuration is temporarily unavailable, keep server-rendered videos.
    const staticVideos=staticHome?.querySelector('[data-info-videos]')?.outerHTML||'';
    main.dataset.infoHomeRestored='true';main.querySelector('#melhores-escolhas')?.remove();main.querySelector('.info-guides')?.remove();main.insertAdjacentHTML('afterbegin',markup(data,settings)+(!settings?staticVideos:''));bind(main);
   }catch{ /* Keep the previous content; never replace the page with an error. */ }finally{pending=false;}
  };
  const observer=new MutationObserver(()=>void enhance());observer.observe(app,{childList:true,subtree:true});void enhance();
 }
 return {selection,guides,collections,structuredData,videoId,videos,markup,bind,init};
});
