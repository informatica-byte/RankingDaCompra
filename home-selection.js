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
  function guideNavigation(guides){
    const safe=(Array.isArray(guides)?guides:[]).filter(g=>/^melhores-[a-z0-9-]+\.html$/.test(g?.url||'')&&g?.title).slice(0,3);
    if(!safe.length)return '';
    return '<section class="home-guides" id="guias-inicio"><h2>Comece pelo que você precisa</h2><p>Veja as diferenças de cada categoria antes de escolher uma oferta.</p><nav aria-label="Guias para escolher por necessidade">'+safe.map(g=>'<a href="/'+esc(g.url)+'">'+esc(g.title)+'<span>Ver diferenças e limitações →</span></a>').join('')+'</nav><a class="home-all-guides" href="/analises.html">Ver todas as categorias</a></section>';
  }
  return {titleKey,distinctTitles,guideNavigation};
});
