(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.RDCInformational=api;if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>api.init(),{once:true});else api.init();}}
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const enabled=true,VERSION='20261026-info1';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const privatePath=path=>/\/(?:dashboard|painel-celular|admin|estudio-videos|login)(?:[./-]|$)/i.test(path);
 function text(value){return String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
 function excerpt(value){const clean=text(value).split(/(?<=[.!?])\s+/).filter(sentence=>!/(?:R\$\s*\d|\d+[,.]?\d*\s*%\s*(?:off|de desconto)|menor pre[cç]o|mais barato|melhor custo.benef[ií]cio|mais vendido|confira pre[cç]o)/i.test(sentence)).join(' ');return clean.length>230?clean.slice(0,226).replace(/\s+\S*$/,'')+'…':clean;}
 function safe(value){try{const url=new URL(String(value),'https://rankingdacompra.com.br/');return url.protocol==='https:'&&!url.username&&!url.password?url.href:'#';}catch{return '#';}}
 function productUrl(p){const value=p.url||p.productUrl||'/produto/'+p.id+'-20260810-1.html';try{const url=new URL(value,'https://rankingdacompra.com.br/');return url.origin==='https://rankingdacompra.com.br'&&/^\/produto\/[A-Za-z0-9_-]+\.html$/.test(url.pathname)?url.pathname:'#';}catch{return '#';}}
 function cards(products){return products.map(p=>'<article class="deal-card best-product-card info-card" data-info-product="'+esc(p.id)+'"><a href="'+esc(productUrl(p))+'"><img src="'+esc(safe(p.image||p.foto))+'" alt="'+esc(p.title||p.titulo)+'" loading="lazy" decoding="async" width="260" height="180"><h3>'+esc(p.title||p.titulo)+'</h3></a><p>'+esc(excerpt(p.summary||p.comentario))+'</p><div class="info-card-actions"><a class="button offer-button" href="'+esc(productUrl(p))+'" data-product-id="'+esc(p.id)+'">Conhecer o produto</a><a class="info-compare" href="/comparar.html?produto='+encodeURIComponent(p.id)+'">Comparar características →</a></div></article>').join('');}
 function faq(product){
  const facts=(product.comparison?.features||[]).filter(f=>f&&typeof f.label==='string'&&typeof f.value==='string').slice(0,4);
  if(!facts.length)return '';
  return '<section class="info-questions" data-informational-faq><h2>Dúvidas para decidir com mais segurança</h2>'+facts.map(f=>'<details><summary>O que sabemos sobre '+esc(f.label.toLowerCase())+' neste modelo?</summary><p>'+(f.state==='unknown'?'Essa informação não está confirmada nesta ficha. '+esc(f.reason||'Não trate a ausência de informação como ausência do recurso. Confira a versão exata no anúncio.') :esc(f.value)+' <small>Base: '+(f.basis==='fabricante'?'documentação do fabricante indicada na ficha':'informação cadastrada a partir do anúncio, sem teste independente')+'.</small>')+'</p>'+((f.state!=='unknown'&&f.sourceUrl&&safe(f.sourceUrl)!=='#')?'<a href="'+esc(safe(f.sourceUrl))+'" target="_blank" rel="noopener noreferrer">Consultar a fonte deste dado ↗</a>':'')+'</details>').join('')+'<p class="fine">Confira modelo e versão, acessórios incluídos, disponibilidade, entrega e condições diretamente no vendedor. Não afirmamos ter testado pessoalmente este produto. <a href="/como-avaliamos.html">Como elaboramos as análises</a>.</p></section>';
 }
 let pending;
 function load(){return pending||=(fetch('/informational-catalogue.json',{cache:'no-cache',credentials:'omit'}).then(r=>{if(!r.ok)throw Error('Catálogo indisponível');return r.json();}).then(data=>{if(data.mode!=='informational'||!Array.isArray(data.products))throw Error('Catálogo informativo inválido');return data;}).catch(error=>{pending=null;throw error;}));}
 async function route({app,setSeo,query='',category='',id=''}){
  const key=JSON.stringify([query,category,id]);if(app.dataset.informationalRoute===key)return;app.dataset.informationalRoute=key;
  try{
   const data=await load();
   if(id){const product=data.products.find(p=>p.id===id);if(product){location.replace(productUrl(product));return;}app.innerHTML='<main class="wrap"><h1>Produto não encontrado</h1><p>Esse cadastro não está publicado. <a href="/analises.html">Ver as análises disponíveis</a>.</p></main>';return;}
   const terms=normalize(query).split(/\s+/).filter(Boolean);
   const found=data.products.filter(p=>(!category||p.categoryId===category||normalize(p.category)===normalize(category))&&terms.every(term=>normalize(p.title+' '+p.summary+' '+p.category).includes(term)));
   const isHome=!query&&!category;
   const selected=isHome?data.selected.map(id=>found.find(p=>p.id===id)).filter(Boolean).slice(0,6):found.slice(0,72);
   const items=selected.length?selected:found.slice(0,isHome?6:72);
   const title=isHome?'Escolha com clareza. Compare antes de comprar.':query?'Resultados para “'+query+'”':'Conheça os produtos desta categoria';
   setSeo(title+' | Ranking da Compra','Análises de informações anunciadas, diferenças de uso, limitações e fontes. Consulte as condições de compra nas lojas.',null,query||category?'noindex,follow':'index,follow');
   app.innerHTML='<section class="hero info-hero"><div class="wrap"><div class="eyebrow">Informações para uma escolha consciente</div><h1>'+esc(title)+'</h1><p>Entenda as diferenças, veja o que está documentado e escolha o que faz sentido para o seu uso. As condições de compra ficam nas lojas parceiras.</p><form class="hero-search" action="/comparar.html" role="search"><label for="info-search">O que você quer entender ou comprar?</label><input id="info-search" name="q" type="search" value="'+esc(query)+'" placeholder="Ex.: fone para reuniões, notebook ou roteador"><button type="submit">Encontrar produtos</button></form><div class="hero-actions"><a class="button primary" href="/comparar.html">Comparar características</a><a class="button secondary" href="/analises.html">Explorar os guias</a></div><div class="hero-proof"><span>✓ Fontes e limites indicados</span><span>✓ Diferenças entre tipos e modelos</span><span>✓ Links de afiliados identificados</span></div></div></section><main class="wrap"><section id="melhores-escolhas" data-best-choices="true"><h2 data-best-title>'+(isHome?'Produtos para conhecer melhor':found.length+' produto(s) encontrado(s)')+'</h2><p>Seleção editorial para explorar, não um ranking de menor preço. Abra a ficha para conferir os detalhes e as dúvidas ainda não respondidas.</p><div class="deal-grid" data-best-products>'+cards(items)+'</div>'+(found.length>72?'<p>Use a busca ou o <a href="/comparar.html">comparador</a> para refinar os resultados.</p>':'')+'</section>'+(isHome?'<section class="info-guides"><h2>Comece pela dúvida que você quer resolver</h2><div class="info-guide-grid">'+data.guides.slice(0,6).map(g=>'<a href="/'+esc(g.url)+'"><strong>'+esc(g.title)+'</strong><span>Ver diferenças e cuidados para escolher →</span></a>').join('')+'</div></section><section class="info-questions"><h2>O que vale conferir antes de escolher?</h2><details><summary>Dois produtos da mesma categoria servem para o mesmo uso?</summary><p>Nem sempre. Um headphone, um fone intra-auricular e um modelo aberto têm propostas diferentes. O comparador separa os tipos identificados e sinaliza informações contraditórias.</p></details><details><summary>Um dado do anúncio já foi comprovado em teste?</summary><p>Não. Identificamos o que vem do anúncio, o que tem documentação do fabricante e o que permanece sem confirmação. Não afirmamos teste prático que não realizamos.</p></details><details><summary>Onde vejo as condições de compra?</summary><p>Na loja parceira. Confira a versão, os acessórios, a entrega e as condições do vendedor antes de concluir a compra. Podemos receber comissão pelos links de afiliados, sem custo adicional para você.</p></details></section>':'')+'<p class="fine">Informações para orientar a escolha, sem garantia de desempenho ou disponibilidade. <a href="/politica-afiliados.html">Entenda como o site se mantém</a>.</p></main>';
   document.body.classList.add('js-app-ready');document.querySelector('.static-home')?.setAttribute('hidden','');
  }catch{app.innerHTML='<main class="wrap"><h1>Vamos encontrar uma boa opção para o seu uso?</h1><p>O catálogo não carregou agora. <a href="/analises.html">Explore os guias disponíveis</a> ou recarregue a página para tentar novamente.</p></main>';}
 }
 function cleanVisible(scope=document){
  if(privatePath(location.pathname))return;
  const selectors='.deal-prices,.deal-price,.deal-validity,.deal-check,.flash-timer,.flash-discount,.flash-ribbon,.price,.previous,.rating,[data-offer-proof],[data-price-history-product]';
  scope.querySelectorAll(selectors).forEach(node=>node.remove());
  scope.querySelectorAll('[data-buyer-budget],[data-buyer-recent]').forEach(input=>{input.value='';input.checked=false;input.disabled=true;(input.closest('label')||input).hidden=true;});
  scope.querySelectorAll('[data-buyer-budget-shortcuts]').forEach(node=>node.hidden=true);
  scope.querySelectorAll('[data-youtube-product-overlay] em').forEach(node=>{if(/R\$|pre[cç]o|conferido/i.test(node.textContent))node.remove();});
 }
 function initAdmin(){
  const note=document.createElement('p');note.className='info-admin-note';note.textContent='Modo informativo ativo: os preços históricos são preservados internamente, mas não aparecem na vitrine. Novos cadastros não precisam de preço; a conferência diária deixou de ser necessária para publicar.';
  const form=document.querySelector('#formProduto,#preview');if(form)form.before(note);
  for(const id of ['preco','precoAnterior','precoPromocional','precoShopee','atual','anterior','preco-shopee','nota','selo','ranking','promocaoAtiva','promocaoValidaAte','ofertaRelampagoAtiva','ofertaRelampagoDuracao','duracao']){const input=document.getElementById(id);if(!input)continue;input.required=false;input.dataset.informationalOptional='true';const label=document.querySelector('label[for="'+id+'"]')||(input.previousElementSibling?.tagName==='LABEL'?input.previousElementSibling:null);if(label)label.hidden=true;input.hidden=true;}
  for(const selector of ['.tipos','#duracao-box']){const node=document.querySelector(selector);if(node)node.hidden=true;}
  const help=document.querySelector('#ajuda-marketplace');if(help)help.textContent='Você pode informar uma segunda opção na Shopee sem cadastrar preço. O link permanece no mesmo produto.';
 }
 function campaignCard(p,{url,message}){
  let page;try{page=new URL(url);if(page.origin!=='https://rankingdacompra.com.br')return '';}catch{return '';}
  const id=esc(p.id),share=encodeURIComponent(message+'\n'+page.href);
  return '<article class="campanha-card" data-campanha-card="'+id+'"><div class="campanha-posicao">Análise informativa</div><div class="campanha-topo"><img src="'+esc(safe(p.foto))+'" alt="'+esc(p.titulo)+'"><h4>'+esc(p.titulo)+'</h4></div><p>'+esc(excerpt(p.comentario))+'</p><div class="campanha-status campanha-ok">✓ Sem preço divulgado; confira a fonte e o modelo antes de compartilhar</div><div class="campanha-publicacao publicacao-aguardando" data-central-publicacao="'+id+'" role="status" aria-live="polite">Verificando página e foto...</div><label>Texto para compartilhar</label><textarea id="campanha-texto-'+id+'" rows="5" maxlength="650">'+esc(message)+'</textarea><div class="campanha-acoes"><a class="btn-rede-campanha btn-rede-whatsapp" href="https://wa.me/?text='+share+'" target="_blank" rel="noopener noreferrer" data-central-compartilhar="'+id+'" data-central-rede="whatsapp">WhatsApp</a><button type="button" class="btn-rede-campanha btn-rede-instagram" data-central-compartilhar="'+id+'" data-central-rede="instagram">Instagram</button><a class="btn-rede-campanha btn-rede-facebook" href="https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(page.href)+'" target="_blank" rel="noopener noreferrer" data-central-compartilhar="'+id+'" data-central-rede="facebook">Facebook</a></div><label>Link da análise</label><input id="campanha-link-'+id+'" class="campanha-link" value="'+esc(page.href)+'" readonly></article>';
 }
 async function campaignImage(p,url,loadImage){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f5faf7';ctx.fillRect(0,0,1080,1080);ctx.fillStyle='#10553e';ctx.fillRect(0,0,1080,165);ctx.fillStyle='#fff';ctx.font='800 48px Arial';ctx.fillText('Ranking da Compra',55,80);ctx.font='28px Arial';ctx.fillText('Conheça as características antes de escolher',55,128);
  const image=await loadImage(url),scale=Math.min(850/image.width,500/image.height);ctx.drawImage(image,(1080-image.width*scale)/2,190+(500-image.height*scale)/2,image.width*scale,image.height*scale);
  ctx.fillStyle='#153e2d';ctx.font='800 38px Arial';const words=text(p.titulo).split(/\s+/);let line='',y=760,lines=0;
  for(const word of words){if(ctx.measureText(line+' '+word).width>950&&line){ctx.fillText(line,55,y);y+=48;line='';if(++lines===3)break;}line+=(line?' ':'')+word;}
  if(line&&lines<3)ctx.fillText(line,55,y);ctx.font='27px Arial';ctx.fillText('Leia a análise, veja as fontes e compare o mesmo tipo de produto.',55,985);ctx.font='700 30px Arial';ctx.fillText('rankingdacompra.com.br',55,1040);
  const blob=await new Promise((done,reject)=>canvas.toBlob(b=>b?done(b):reject(Error('Falha ao preparar imagem informativa.')),'image/png'));
  return new File([blob],'analise-'+String(p.id).replace(/[^a-z0-9_-]/gi,'')+'.png',{type:'image/png'});
 }
 function init(){
  if(privatePath(location.pathname)){initAdmin();return;}
  cleanVisible();
  if(location.pathname==='/'||location.pathname==='/index.html'){
   const app=document.getElementById('app'),q=new URLSearchParams(location.search);
   const setSeo=(title,description,_image,robots)=>{document.title=title;for(const [name,content]of [['description',description],['robots',robots]]){let meta=document.querySelector('meta[name="'+name+'"]');if(!meta){meta=document.createElement('meta');meta.name=name;document.head.append(meta);}meta.content=content;}};
   if(app)route({app,setSeo,query:q.get('busca')||'',category:q.get('cat')||'',id:q.get('produto')||''});
  }
  const observer=new MutationObserver(()=>cleanVisible());observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),120000);
 }
 return {enabled,VERSION,esc,text,excerpt,safe,privatePath,productUrl,cards,faq,route,load,cleanVisible,init,campaignCard,campaignImage};
});
