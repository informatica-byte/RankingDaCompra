(() => {
  'use strict';
  async function update() {
    const api=window.RDCBestChoices;
    const [catalogue,config,status,manifest]=await Promise.all([
      window.RDCPublicData.json('/vitrine-publica.json'),window.RDCPublicData.json('/site-config.json'),
      window.RDCPublicData.json('/mercadolivre-status.json').catch(()=>({products:{}})),window.RDCPublicData.json('/best-choices-guides.json')]);
    if(!Array.isArray(catalogue?.products)||!Array.isArray(manifest?.guides))throw Error('Catálogo publicado incompleto');
    const products=api.selectProducts(catalogue.products,config),guides=api.selectGuides(manifest.guides,config);
    const title=api.title(config.bestChoicesTitle,products,window.RDCPromotionTitle,status.products||{});
    document.querySelector('h1').textContent=title;
    document.querySelector('[data-best-title]').textContent=title;
    document.title=title+' | Ranking da Compra';
    document.querySelector('meta[property="og:title"]')?.setAttribute('content',document.title);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content',title);
    document.querySelector('.best-guide-grid').outerHTML=api.guideCards(guides);
    document.querySelector('[data-best-products]').innerHTML=api.productCards(products,status.products||{});
    const schema=document.getElementById('best-schema'),data=JSON.parse(schema.textContent);
    data['@graph'][0].name=title;
    data['@graph'][2].itemListElement=guides.map((g,i)=>({'@type':'ListItem',position:i+1,name:g.title,url:new URL(g.url,location.origin).href}));
    data['@graph'][3].itemListElement=products.map((p,i)=>({'@type':'ListItem',position:i+1,name:p.titulo,url:new URL(api.productUrl(p),location.origin).href}));
    schema.textContent=JSON.stringify(data);
    document.addEventListener('click',async event=>{
      const button=event.target.closest('[data-share-product]');if(!button)return;
      const product=products.find(p=>String(p.id)===button.dataset.shareProduct);if(!product)return;
      const payload={title:product.titulo,text:'Confira a análise, pontos positivos e limitações no Ranking da Compra.',url:new URL(api.productUrl(product),location.origin).href};
      try {if(navigator.share)await navigator.share(payload);else{await navigator.clipboard.writeText(payload.url);button.textContent='Link copiado';}}catch(error){if(error.name!=='AbortError')console.warn(error);}
    });
  }
  update().catch(error=>{
    // Uma falha no snapshot não pode prolongar um selo de conferência.
    document.querySelectorAll('.best-product-card').forEach(card=>{
      card.querySelector('.deal-check').textContent='Confira o preço e a disponibilidade no vendedor';
      const price=card.querySelector('.deal-price');
      if(!price.textContent.startsWith('Último')&&price.textContent.includes('R$'))price.textContent='Último preço registrado: '+price.textContent;
      const date=card.querySelector('.deal-validity');
      date.textContent=date.textContent.replace('Preço conferido em ','Último registro em ');
    });
    console.warn('A página estática foi preservada sem afirmar preço recente.',error);
  });
})();
