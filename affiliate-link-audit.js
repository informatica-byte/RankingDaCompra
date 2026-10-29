(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RDCAffiliateLinkAudit=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION='2.5.3',KIND='affiliate_link_audit',MAX_AGE=7*86400000;
 const STATES=['available','unavailable','unverified','security','login','error','active_same','different_target','identity_unconfirmed'];
 const text=x=>String(x||'').replace(/\s+/g,' ').trim();
 const redacted=x=>text(x).replace(/\b(?:Bearer\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g,'[credencial omitida]').replace(/\b(?:access_token|refresh_token|client_secret|authorization|password|senha|cookie)\s*[:=]\s*\S+/gi,'[credencial omitida]');
 const normalize=x=>text(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 function url(value){
  try{const u=new URL(String(value||''));if(u.protocol!=='https:'||u.username||u.password||u.port||u.href.length>1800)return null;
   if([...u.searchParams.keys(),...new URLSearchParams(u.hash.slice(1)).keys()].some(k=>/token|secret|password|authorization|credential|session|jwt|code_verifier|api.?key|^(?:code|state|auth)$/i.test(k)))return null;
   if(['meli.la','www.meli.la'].includes(u.hostname)||/(^|\.)mercadolivre\.com\.br$/.test(u.hostname))return {u,market:'mercado_livre'};
   if(['shope.ee','s.shopee.com.br','shopee.com.br','www.shopee.com.br'].includes(u.hostname))return {u,market:'shopee'};
  }catch{}return null;
 }
 function identity(value){
  const safe=url(value);if(!safe)return null;const {u,market}=safe;
  if(market==='shopee'){
   const m=u.pathname.match(/^\/product\/(\d+)\/(\d+)(?:\/|$)/)||u.pathname.match(/-i\.(\d+)\.(\d+)(?:\/|$)/);
   return {market,listing:m?m[1]+'/'+m[2]:'',catalog:''};
  }
  const ids=[],code=v=>/^MLB-?\d{6,}$/i.test(v)?v.toUpperCase().replace('MLB-','MLB'):null;
  const path=u.pathname.match(/(?:^|\/)(MLB-\d+)(?:-|\/|$)/i);if(path)ids.push(path[1]);
  for(const p of [u.searchParams,new URLSearchParams(u.hash.slice(1))]){
   for(const k of ['wid','item_id'])ids.push(...p.getAll(k));
   for(const f of p.getAll('pdp_filters'))for(const m of f.matchAll(/(?:^|[|,])item_id[:=]([^|,]+)/gi))ids.push(m[1]);
  }
  if(ids.some(x=>!code(x))||new Set(ids.map(code)).size>1)return null;
  return {market,listing:ids.length?code(ids[0]):'',catalog:u.pathname.match(/\/(?:p|up)\/(MLBU?\d+)(?:\/|$)/i)?.[1]?.toUpperCase()||''};
 }
 function publicURL(value){const safe=url(value);if(!safe)return '';const id=identity(value);let result=safe.u.origin+safe.u.pathname;if(id?.listing&&id.market==='mercado_livre'&&!/\/MLB-\d+/.test(safe.u.pathname))result+='?wid='+id.listing;return result.slice(0,1200);}
 function titleMatch(expected,found){
  const clean=s=>normalize(s).replace(/\b(?:preto|preta|branco|branca|azul|verde|cinza|rosa|cor|bivolt)\b/g,' ').replace(/\b\d+\s*(?:v|volts)\b/g,' ').replace(/\s+/g,' ').trim();
  const a=clean(expected),b=clean(found);if(a.length<4||b.length<4)return 'unknown';
  const capacity=s=>[...s.matchAll(/\b(\d+)\s*(gb|tb)\b/g)].map(m=>Number(m[1])*(m[2]==='tb'?1024:1)).filter(n=>n>=64);
  const ca=capacity(a),cb=capacity(b);if(ca.length&&cb.length&&Math.max(...ca)!==Math.max(...cb))return 'different';
  const tokens=s=>s.split(' ').filter(w=>w.length>=3&&!/^(com|sem|para|produto|anunciado|anunciada|anuncio|confirmar|dados|cor)$/.test(w));
  const aa=[...new Set(tokens(a))],bb=new Set(tokens(b));
  const codes=xs=>xs.filter(w=>/[a-z]/.test(w)&&/\d/.test(w)&&!/^\d+(?:gb|tb|w|mah|hz|mm|cm|mp)$/.test(w));
  for(const c of codes(aa)){const family=c.replace(/\d+/g,'#');if(codes([...bb]).some(x=>x!==c&&x.replace(/\d+/g,'#')===family)&&!bb.has(c))return 'different';}
  // Contradictory editions remain a different product, even on the same catalogue.
  const edition=s=>s.match(/\b(iphone|ipad|airpods|galaxy|redmi|watch fit)\s+([a-z]?\d+[a-z]?)(?:\s+(pro|max|plus|ultra|fe|mini))?\b/);
  const ea=edition(a),eb=edition(b);if(ea&&eb&&ea[1]===eb[1]&&ea[2]===eb[2]&&(ea[3]||'base')!==(eb[3]||'base'))return 'different';
  if(/\bps5\b|playstation\s*5/.test(a)&&/\bps5\b|playstation\s*5/.test(b)&&/\b(disk|disc|leitor)\b/.test(a)&&/\bdigital\b/.test(b)&&!/\bleitor\b/.test(b))return 'different';
  const hits=aa.filter(x=>bb.has(x)).length;return hits>=2&&hits/Math.min(aa.length||1,bb.size||1)>=0.6?'compatible':'unknown';
 }
 function request(input){
  const affiliate=url(input?.affiliateUrl),expected=input?.expectedUrl?url(input.expectedUrl):null;
  if(!affiliate||!text(input?.productId)||!text(input?.title))throw Error('Produto e link de afiliado válidos são necessários.');
  const target=identity(input.affiliateUrl),short=['meli.la','www.meli.la','s.shopee.com.br','shope.ee'].includes(affiliate.u.hostname)||/^\/sec\/[a-z0-9_-]+\/?$/i.test(affiliate.u.pathname);
  if(/\/(?:checkout|cart|carrinho|payment|payments|orders|account|login|oauth|auth)(?:\/|$)/i.test(affiliate.u.pathname)||(!short&&!target?.listing&&!target?.catalog))throw Error('Use um link de produto/afiliado, não de conta, carrinho ou pagamento.');
  if(input.expectedUrl&&(!expected||expected.market!==affiliate.market||!identity(input.expectedUrl)))throw Error('O endereço original não identifica a mesma loja com segurança.');
  const original=expected&&identity(expected.u.href),useOriginal=!!(original?.listing||original?.catalog);
  return {kind:KIND,readOnly:true,inspection:'availability',checkedVia:useOriginal?'original_product':'affiliate_fallback',checkUrl:useOriginal?expected.u.href:affiliate.u.href,productId:text(input.productId).slice(0,100),title:text(input.title).slice(0,300),affiliateUrl:affiliate.u.href,expectedUrl:expected?.u.href||'',market:affiliate.market};
 }
 function classify(input,e){
  const req=request(input),base={kind:KIND,readOnly:true,inspection:'availability',checkedVia:req.checkedVia,productId:req.productId,market:req.market,checkedAt:Date.now(),foundTitle:redacted(e.title).slice(0,300),finalUrl:publicURL(e.url),robotVersion:VERSION};
  const done=(status,reason)=>({...base,status,reason});
  if(e.security)return done('security','Verificação humana ou bloqueio de acesso. Resolva pessoalmente; não é prova de anúncio indisponível.');
  if(e.login)return done('login','A loja exige login para concluir a leitura. Nenhum cadastro foi alterado.');
  const actual=identity(e.url);
  if(!actual||actual.market!==req.market)return done('unverified','Não foi possível ler um anúncio da loja esperada. Isso não comprova indisponibilidade.');
  // Availability is not an identity audit. Still require a real product page,
  // so a profile, list, search or recommendation is never counted as stock.
  const path=url(e.url)?.u.pathname||'',productRoute=actual.market==='shopee'?!!actual.listing:/\/(?:p|up)\/MLBU?\d+(?:\/|$)|(?:^|\/)MLB-\d+(?:-|\/|$)/i.test(path);
  if(!productRoute||/^\/(?:social|ofertas|search|lista|lists)(?:\/|$)/i.test(path))return done('unverified','A página aberta não é um anúncio de produto (pode ser perfil, lista ou redirecionamento). Confira o link original; não foi classificado como indisponível.');
  if(e.unavailable&&e.primaryNotice)return done('unavailable','O anúncio informa que está pausado, encerrado ou sem estoque. Nenhum cadastro ou link foi alterado.');
  if(e.buyable||e.stockAvailable===true)return done('available','O anúncio informa estoque disponível ou exibe ação de compra habilitada. Somente disponibilidade foi conferida; produto, nome, características, preço e destino do afiliado não foram comparados.');
  return done('unverified','O anúncio não mostrou informação suficiente para decidir se está disponível. Tente novamente ou confira manualmente; não é prova de indisponibilidade.');
 }
 function visible(doc,node){if(!node||node.closest?.('[hidden],[aria-hidden="true"],.ui-pdp-other-sellers,.ui-pdp-other-sellers-item,[class*="recommend"],[class*="carousel"],header,nav,footer'))return false;const view=doc.defaultView;if(!view)return false;const s=view.getComputedStyle(node);return s.display!=='none'&&s.visibility!=='hidden'&&node.getClientRects().length>0;}
 function evidence(doc,href){
  const safe=url(href),market=safe?.market,body=text(doc.body?.innerText).slice(0,12000);let path='';try{path=new URL(href).pathname;}catch{}
  const first=selectors=>[...doc.querySelectorAll(selectors)].find(n=>visible(doc,n));
  const heading=first(market==='shopee'?'h1,[data-testid="product-name"],.product-briefing h2':'h1.ui-pdp-title,h1');
  const title=text(heading?.textContent),security=/captcha|\/security\b|\/challenge\b/i.test(path)||/n[aã]o sou um rob[oô]|complete esta etapa|confirme que voc[eê] [eé] humano|automated access|access denied|too many requests|unusual traffic|temporariamente bloquead|acesso negado/i.test(body);
  const login=/\/(?:login|auth|sign-in|buyer\/login)(?:\/|$)/i.test(path);
  const notices=[...doc.querySelectorAll('.ui-pdp-message,.ui-pdp-stock-information,.ui-pdp-buybox,.ui-pdp-shipping-message__text,[data-testid="product-unavailable"],[role="alert"],.product-not-exist')].filter(n=>visible(doc,n));
  const unavailable=notices.some(n=>/an[uú]ncio (?:pausado|finalizado)|produto (?:sem estoque|indispon[ií]vel)|este (?:produto|an[uú]ncio) n[aã]o est[aá] dispon[ií]vel|produto n[aã]o encontrado|sold out|produto esgotado/i.test(text(n.textContent)))||/^(?:n[aã]o encontramos|produto n[aã]o encontrado|an[uú]ncio (?:pausado|finalizado))/i.test(title);
  const stockAvailable=[...doc.querySelectorAll('.ui-pdp-stock-information,[data-testid="stock-information"]')].filter(n=>visible(doc,n)).some(n=>/\bestoque dispon[ií]vel\b|\bem estoque\b|\bdispon[ií]vel para compra\b/i.test(text(n.textContent)));
  const controls=market==='shopee'?'[data-testid="buy-now"],.product-briefing button,.product-briefing [role="button"],main button,[role="main"] button,.page-product button':'.ui-pdp-actions button,.ui-pdp-buybox button,.ui-vpp-buybox button,main button,[role="main"] button';
  const buyable=[...doc.querySelectorAll(controls)].some(n=>visible(doc,n)&&!n.disabled&&n.getAttribute('aria-disabled')!=='true'&&/comprar|adicionar ao carrinho|buy now/i.test(text(n.textContent)));
  const listingIds=market==='mercado_livre'?[...doc.querySelectorAll('.ui-vpp-denounce__info,.ui-pdp-denounce__info')].filter(n=>visible(doc,n)).map(n=>text(n.textContent).match(/An[uú]ncio\s*#?\s*(?:MLB-?)?(\d{6,})/i)?.[1]).filter(Boolean).map(x=>'MLB'+x):[];
  return {url:href,title,security,login,unavailable,primaryNotice:unavailable,buyable,stockAvailable,listingIds};
 }
 function queue(products,includePaused=true){
  const out=[],seen=new Set();for(const p of products||[]){if(!p?.id||p.sistema===true||!text(p.titulo)||(!includePaused&&p.conferenciaPausada===true))continue;
   const mercadoLivre=value=>{try{return /(^|\.)(?:mercadolivre\.com\.br|meli\.la)$/.test(new URL(String(value||'')).hostname);}catch{return false;}};
   if(!mercadoLivre(p.linkAfiliado)&&!mercadoLivre(p.link))continue;
   const candidates=[['mercado_livre',p.linkAfiliado||p.link,p.link]];
   for(const [market,affiliate,source]of candidates){
    if(!affiliate)continue;const key=String(p.id)+':'+market;if(seen.has(key))continue;seen.add(key);
    try{const expected=url(source)?.market===market?source:'';out.push({...request({productId:String(p.id),title:p.titulo,affiliateUrl:affiliate,expectedUrl:expected}),key,paused:p.conferenciaPausada===true});}
    catch{out.push({key,productId:String(p.id),title:text(p.titulo).slice(0,300),market,invalid:true});}
   }
  }return out;
 }
 // Diagnostic allowlist: durations and fixed enums only, never page content,
 // URLs, request IDs, browser storage, cookies or authentication data.
 function safeTiming(value){
  if(!value||value.version!==1)return null;const out={version:1};
  for(const key of ['startupMs','loadMs','readMs','workerMs','roundTripMs','deliveryMs','panelMs','pauseBeforeMs'])if(Number.isFinite(value[key])&&value[key]>=0&&value[key]<=86400000)out[key]=Math.round(value[key]);
  if(Number.isInteger(value.observations)&&value.observations>=0&&value.observations<=1000)out.observations=value.observations;
  for(const key of ['earlyRead','hiddenAtStart','timeout'])if(typeof value[key]==='boolean')out[key]=value[key];
  if(['adaptive','careful'].includes(value.mode))out.mode=value.mode;
  return Object.keys(out).length>1?out:null;
 }
 function safeResult(value){if(value?.kind!==KIND||value.readOnly!==true||!STATES.includes(value.status)||!Number.isFinite(value.checkedAt))throw Error('Resposta de links inválida.');const timing=safeTiming(value.timing);return {kind:KIND,readOnly:true,inspection:value.inspection==='availability'?'availability':'',checkedVia:['original_product','affiliate_fallback'].includes(value.checkedVia)?value.checkedVia:'',productId:text(value.productId).slice(0,100),market:['mercado_livre','shopee'].includes(value.market)?value.market:'',status:value.status,reason:redacted(value.reason).slice(0,500),foundTitle:redacted(value.foundTitle).slice(0,300),finalUrl:publicURL(value.finalUrl),checkedAt:value.checkedAt,robotVersion:text(value.robotVersion).slice(0,20),...(timing?{timing}:{})};}
 const project=(p,id=p?.id)=>({id:String(id||''),titulo:p?.titulo,link:p?.link,linkAfiliado:p?.linkAfiliado,linkShopee:p?.linkShopee,linkShopeeOriginal:p?.linkShopeeOriginal,urlShopee:p?.urlShopee,conferenciaPausada:p?.conferenciaPausada===true,sistema:p?.sistema===true});
 return {VERSION,KIND,MAX_AGE,STATES,normalize,url,identity,publicURL,titleMatch,request,classify,evidence,queue,safeTiming,safeResult,project};
});
