(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RDCSocialPage=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const SITE='https://rankingdacompra.com.br';
  function decode(value){return String(value||'').replace(/&(?:amp|quot|apos|lt|gt|#39|#(\d+)|#x([a-f\d]+));/gi,(all,dec,hex)=>{if(dec||hex){const n=parseInt(dec||hex,dec?10:16);return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):all;}return {'&amp;':'&','&quot;':'"','&apos;':"'",'&#39;':"'",'&lt;':'<','&gt;':'>'}[all.toLowerCase()]||all;});}
  function attrs(tag){const out={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)){const key=m[1].toLowerCase();if(Object.hasOwn(out,key))throw Error('Atributo social ambíguo.');out[key]=decode(m[3]);}return out;}
  function documentData(html){
    const values={};
    for(const m of String(html).matchAll(/<(?:meta|link)\b[^>]*>/gi)){
      const a=attrs(m[0]);const key=a.rel?.toLowerCase()==='canonical'?'canonical':a.property?.toLowerCase()||a.name?.toLowerCase()||(a['http-equiv']?.toLowerCase()==='refresh'?'refresh':'');
      if(!['canonical','og:image','og:title','og:type','rdc-offer-url','robots','refresh'].includes(key))continue;
      const value=key==='canonical'?a.href:a.content;if(Object.hasOwn(values,key)&&values[key]!==value)throw Error('Metadados sociais contraditórios.');values[key]=value||'';
    }
    return values;
  }
  function page(value){const u=new URL(value,SITE);if(u.origin!==SITE||u.username||u.password||!/^\/produto\/[A-Za-z0-9_-]+-\d{8}-\d+\.html$/.test(u.pathname))throw Error('Destino social não permitido.');u.search='';u.hash='';return u;}
  function offer(value){
    try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||!['mercadolivre.com.br','www.mercadolivre.com.br','produto.mercadolivre.com.br'].includes(u.hostname))return '';
      const hash=new URLSearchParams(u.hash.slice(1)),ids=[u.searchParams.get('wid'),hash.get('wid'),u.searchParams.get('pdp_filters')?.match(/\bitem_id[:=](MLB\d+)\b/i)?.[1],u.pathname.match(/\/MLB-(\d+)(?:[-/]|$)/i)?.[1]?.replace(/^(\d+)$/,'MLB$1')].filter(Boolean).map(x=>x.toUpperCase());
      return ids.length&&ids.every(x=>/^MLB\d{6,}$/.test(x)&&x===ids[0])?ids[0]:'';
    }catch{return '';}
  }
  function expectedOffer(product){const source=offer(product?.link),id=String(product?.id||'').match(/^ml(MLB\d{6,})$/)?.[1];return source&&(!id||id===source)?source:'';}
  function imageUrl(value){const u=new URL(value);if(u.origin!==SITE||u.username||u.password||!/^\/produto\/imagens\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(u.pathname))throw Error('Foto social não confirmada.');return u.href;}
  async function resolve(product,requestedUrl,fetchPage){
    const original=page(requestedUrl),id=String(product?.id||'');
    if(!id||original.pathname.match(/^\/produto\/(.+)-\d{8}-\d+\.html$/)?.[1]!==id)throw Error('Página não pertence ao cadastro solicitado.');
    let current=original;let aliased=false;
    for(let hop=0;hop<2;hop++){
      const response=await fetchPage(current.href,{cache:'no-store',credentials:'same-origin',redirect:'error'});
      if(!response.ok||page(response.url||current.href).href!==current.href)throw Error('Página social ainda não publicada.');
      const html=await response.text(),data=documentData(html),canonical=page(data.canonical||current.href);
      if(canonical.href!==current.href){
        const refresh=data.refresh?.match(/^\s*0\s*;\s*url\s*=\s*(.+?)\s*$/i)?.[1];
        if(hop||!refresh||page(refresh).href!==canonical.href||!/\bnoindex\b/i.test(data.robots))throw Error('Redirecionamento social não confirmado.');
        if(!expectedOffer(product))throw Error('Falta prova do mesmo anúncio.');
        current=canonical;aliased=true;continue;
      }
      const canonicalId=current.pathname.match(/\/([^/]+)-\d{8}-\d+\.html$/)[1];
      const identity=html.includes('?produto='+encodeURIComponent(canonicalId))||html.includes('/produto/imagens/'+canonicalId+'-');
      if(!identity||data['og:type']!=='product'||!data['og:title']||/\bnoindex\b/i.test(data.robots))throw Error('Página principal do produto não confirmada.');
      if(aliased&&offer(data['rdc-offer-url'])!==expectedOffer(product))throw Error('A página principal pertence a outro anúncio.');
      return {url:current.href,image:imageUrl(data['og:image']),title:data['og:title'],canonicalId,aliased};
    }
    throw Error('Encadeamento de páginas sociais não permitido.');
  }
  return {resolve,offer,documentData};
});
