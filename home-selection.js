(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RDCHomeSelection=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function titleKey(product){
    // Presentation rule, not a claim of identical SKU. Keep model, color,
    // voltage and size words. Never remove a record or rewrite an offer.
    const title=String(product?.titulo||product?.title||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    return title ? 'title:'+title : 'id:'+String(product?.id||'');
  }
  function distinctTitles(products){
    const seen=new Set();
    return (Array.isArray(products)?products:[]).filter(product=>{
      const key=titleKey(product);
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
  }
  function consumerSelection(products){
    // Editorial presentation only: do not rewrite the panel's saved selection.
    // Detailed/specialist products remain on the complete selection/category.
    const priority=[
      ['ARscPKCMZs3D8k22qltl',/redmi.*buds\s*6\s*play/i],
      ['GjHJtzdsIhbmSINvhPeX',/jbl.*tune\s*520\s*bt/i],
      ['48oRcQNlH00KgNLHkvsG',/xiaomi.*smart\s*band\s*9\s*active/i],
      ['O6e0R2WtiZfyyf2MJe5Y',/asus.*vivobook(?=.*(?:7520u|e1504fa-nj1288))(?=.*16\s*gb)(?=.*512\s*(?:ssd|gb))/i],
      ['UvxFn4gfaexb8TvcaT5e',/logitech.*m170/i],
      ['huCYMmOsGPKJ8jOiJ1gR',/wap.*wl\s*1800.*220\s*v/i],
    ];
    const rank=p=>priority.findIndex(([id,model])=>String(p?.id)===id&&model.test(p.titulo||p.title||''));
    return distinctTitles(products).map((p,index)=>({p,index,rank:rank(p)}))
      .sort((a,b)=>(a.rank<0?999:a.rank)-(b.rank<0?999:b.rank)||a.index-b.index)
      .slice(0,6).map(({p})=>p);
  }
  function guideNavigation(guides){
    const safe=(Array.isArray(guides)?guides:[]).filter(g=>/^melhores-[a-z0-9-]+\.html$/.test(g?.url||'')&&g?.title).slice(0,3);
    if(!safe.length)return '';
    return '<section class="home-guides" id="guias-inicio"><h2>Comece pelo que você precisa</h2><p>Veja as diferenças de cada categoria antes de escolher uma oferta.</p><nav aria-label="Guias para escolher por necessidade">'+safe.map(g=>'<a href="/'+esc(g.url)+'">'+esc(g.title)+'<span>Ver diferenças e limitações →</span></a>').join('')+'</nav><a class="home-all-guides" href="/analises.html">Ver todas as categorias</a></section>';
  }
  return {titleKey,distinctTitles,consumerSelection,guideNavigation};
});
