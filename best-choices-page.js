(() => {
  'use strict';
  let selectedProducts=[];

  function updateSchema(title,products,guides,api) {
    const schema=document.getElementById('best-schema');if(!schema)return;
    try {
      const data=JSON.parse(schema.textContent),graph=data['@graph'];
      if(!Array.isArray(graph))throw Error('Grafo da seleção incompleto');
      const page=graph.find(item=>item['@type']==='CollectionPage');
      const guideList=graph.find(item=>item['@id']===location.origin+'/melhores-escolhas.html#rankings'||item.name==='Rankings e comparativos por categoria');
      const productList=graph.find(item=>item['@id']===location.origin+'/melhores-escolhas.html#produtos'||item.name==='Produtos selecionados para analisar');
      if(page)page.name=title;
      if(guideList&&guides)guideList.itemListElement=guides.map((g,i)=>({'@type':'ListItem',position:i+1,name:g.title,url:new URL(g.url,location.origin).href}));
      if(productList)productList.itemListElement=products.map((p,i)=>({'@type':'ListItem',position:i+1,name:p.titulo,url:new URL(api.productUrl(p),location.origin).href}));
      schema.textContent=JSON.stringify(data).replace(/</g,'\\u003c');
    }catch(error){console.warn('O JSON-LD estático foi preservado; os preços continuam independentes.',error);}
  }

  // O HTML publicado continua compartilhável se um snapshot estiver indisponível.
  document.addEventListener('click',async event=>{
    const button=event.target?.closest?.('[data-share-product]');if(!button)return;
    const id=String(button.dataset.shareProduct||'');if(!/^[A-Za-z0-9_-]+$/.test(id))return;
    const api=window.RDCBestChoices,product=selectedProducts.find(p=>String(p.id)===id);
    const card=button.closest('.best-product-card'),link=card?.querySelector('[data-product-id]');
    const path=product&&api?api.productUrl(product):'/produto/'+encodeURIComponent(id)+'-20260810-1.html';
    if(!product&&(!link||String(link.dataset.productId)!==id||new URL(link.getAttribute('href'),location.origin).href!==new URL(path,location.origin).href))return;
    const payload={title:product?.titulo||link?.dataset.productTitle||card?.querySelector('h3')?.textContent||'Análise do produto',text:'Confira a análise, pontos positivos e limitações no Ranking da Compra.',url:new URL(path,location.origin).href};
    try {
      if(navigator.share)await navigator.share(payload);
      else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(payload.url);button.textContent='Link copiado';}
    }catch(error){if(error.name!=='AbortError')console.warn(error);}
  });

  async function update() {
    const api=window.RDCBestChoices;
    const [catalogue,config,status,manifest]=await Promise.all([
      window.RDCPublicData.json('/vitrine-publica.json'),window.RDCPublicData.json('/site-config.json'),
      window.RDCPublicData.json('/mercadolivre-status.json').catch(()=>({products:{}})),window.RDCPublicData.json('/best-choices-guides.json').catch(()=>null)]);
    if(!api||!Array.isArray(catalogue?.products)||!config||typeof config!=='object'||Array.isArray(config))throw Error('Catálogo publicado incompleto');
    const products=api.selectProducts(catalogue.products,config),statuses=status?.products||{};
    let guides=null;
    try {if(Array.isArray(manifest?.guides))guides=api.selectGuides(manifest.guides,config);}
    catch(error){console.warn('Os rankings estáticos foram preservados.',error);}
    const title=api.title(config.bestChoicesTitle,products,window.RDCPromotionTitle,statuses);
    const heading=document.querySelector('h1');if(heading)heading.textContent=title;
    document.querySelectorAll('[data-best-title]').forEach(element=>{element.textContent=title;});
    document.title=title+' | Ranking da Compra';
    document.querySelector('meta[property="og:title"]')?.setAttribute('content',document.title);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content',title);
    const guideGrid=document.querySelector('.best-guide-grid');
    try {if(guideGrid&&guides)guideGrid.outerHTML=api.guideCards(guides);}
    catch(error){console.warn('Os rankings estáticos foram preservados.',error);}
    const productGrid=document.querySelector('[data-best-products]');
    if(!productGrid)throw Error('Área de produtos ausente');
    productGrid.innerHTML=api.productCards(products,statuses);
    selectedProducts=products;
    updateSchema(title,products,guides,api);
  }
  update().catch(error=>{
    // Uma falha no snapshot não pode prolongar um selo de conferência.
    document.querySelectorAll('.best-product-card').forEach(card=>{
      const check=card.querySelector('.deal-check');if(check)check.textContent='Confira o preço e a disponibilidade no vendedor';
      const price=card.querySelector('.deal-price');
      if(price&&!price.textContent.startsWith('Último')&&price.textContent.includes('R$'))price.textContent='Último preço registrado: '+price.textContent;
      const date=card.querySelector('.deal-validity');
      if(date)date.textContent=date.textContent.replace('Preço conferido em ','Último registro em ');
    });
    console.warn('A página estática foi preservada sem afirmar preço recente.',error);
  });
})();
