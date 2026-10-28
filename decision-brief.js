(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RDCDecisionBrief=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const text=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const promotional=/\b(?:excelente|incr[ií]vel|perfeit[oa]|alta absor[cç][aã]o|m[aá]xima (?:pureza|concentra[cç][aã]o|biodisponibilidade)|melhor do mercado|resultado garantido|desempenho excepcional|qualidade incompar[aá]vel)\b/i;
 function source(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:'';}catch{return '';}}
 function sober(value){return text(value).split(/(?<=[.!?])\s+/).filter(s=>!promotional.test(s)||/\b(?:n[aã]o|sem|aus[eê]ncia|alega[cç][aã]o|n[aã]o comprov)/i.test(s)).join(' ');}
 function facts(p){return (p?.comparison?.features||[]).filter(f=>f&&['yes','no'].includes(f.state)&&['fabricante','cadastro'].includes(f.basis)&&text(f.label)&&text(f.value)).map(f=>({label:text(f.label),value:sober(f.value),basis:f.basis,sourceUrl:source(f.sourceUrl)})).filter(f=>f.value);}
 function make(p,review){
  const confirmed=facts(p),unknown=(p?.comparison?.features||[]).filter(f=>f?.state==='unknown').map(f=>text(f.label)).filter(Boolean);
  const sources=(review?.sources||[]).map(s=>({url:source(s.url),label:text(s.label)})).filter(s=>s.url);
  const reviewed=!!review&&!!sober(review.fit)&&Array.isArray(review.advantages)&&Array.isArray(review.limitations)&&sources.length>0;
  const positives=reviewed?review.advantages.map(sober).filter(Boolean):confirmed.filter(f=>f.basis==='fabricante'&&f.sourceUrl).map(f=>f.label+': '+f.value+' (informação do fabricante, não teste próprio).');
  const limitations=reviewed?review.limitations.map(sober).filter(Boolean):[];
  return {version:1,reviewed,fit:reviewed?sober(review.fit):'Ainda não há análise documentada suficiente para indicar um perfil de uso específico. Use os dados abaixo para conferir se atende à sua necessidade.',
   caution:reviewed?sober(review.alternative||review.tradeoff):'Se uma característica decisiva não estiver confirmada, esta ficha não basta para assegurar que o produto atende ao seu uso.',
   advantages:positives.slice(0,3),limitations:limitations.slice(0,3),facts:confirmed.slice(0,3),pending:unknown.slice(0,4),
   check:reviewed?sober(review.check):'Confira o modelo, a versão, os acessórios e as condições diretamente no anúncio antes de decidir.',sources};
 }
 function eligible(p){const b=p?.decisionBrief;return b?.version===1&&b.reviewed===true&&b.advantages?.length>=1&&b.limitations?.length>=1&&b.sources?.some(s=>source(s.url));}
 function quality(p){return eligible(p)?facts(p).filter(f=>f.basis==='fabricante'&&f.sourceUrl).length:0;}
 function render(b){
  if(!b||b.version!==1)return '';
  if(!b.reviewed&&!b.facts.length)return '<p class="decision-brief" data-decision-brief><b>Informações ainda limitadas.</b> Não há evidência suficiente nesta ficha para indicar um perfil de uso ou vantagens específicas. Confira modelo, características e condições no anúncio. Não preenchemos essas lacunas por suposição.</p>';
  const list=items=>'<ul>'+items.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>';
  const further='<details><summary>Ver cuidados, outros dados e fontes</summary><p><b>Quando considerar outra opção:</b> '+esc(b.caution)+'</p>'+(b.advantages.length>1?'<h3>Outras vantagens documentadas</h3>'+list(b.advantages.slice(1)):'')+(b.limitations.length>1?'<h3>Outros cuidados</h3>'+list(b.limitations.slice(1)):'')+(b.facts.length?'<h3>Dados disponíveis na ficha</h3>'+list(b.facts.map(f=>f.label+': '+f.value+' — '+(f.basis==='fabricante'?'fabricante':'anúncio/cadastro, sem teste independente'))):'')+'<p><b>A confirmar:</b> '+esc(b.pending.length?b.pending.join('; '):'Compatibilidade com o seu uso, variante e condições atuais da oferta; ausência de pendências técnicas listadas não comprova verificação completa.')+'</p><p><b>Antes de comprar:</b> '+esc(b.check)+'</p>'+(b.sources.length?'<h3>Fontes utilizadas neste resumo</h3><ul>'+b.sources.map(s=>'<li><a href="'+esc(source(s.url))+'" target="_blank" rel="noopener noreferrer">'+esc(s.label||'Consultar fonte')+'</a></li>').join('')+'</ul>':'')+'</details>';
  return '<section class="decision-brief" data-decision-brief aria-label="Resumo para decidir"><h2>Antes de escolher, em poucas palavras</h2><p><b>Para quem pode servir:</b> '+esc(b.fit)+'</p><div class="decision-brief-grid"><div><h3>Uma vantagem para avaliar</h3>'+(b.advantages.length?list(b.advantages.slice(0,1)):'<p>Ainda não há vantagens específicas documentadas suficientes para afirmar um diferencial.</p>')+'</div><div><h3>Uma limitação importante</h3>'+(b.limitations.length?list(b.limitations.slice(0,1)):'<p>Não realizamos teste de uso, conforto ou desempenho deste produto. Não presuma recursos que a ficha não confirma.</p>')+'</div></div>'+further+'<p class="fine">Informações documentadas, não teste próprio nem garantia do vendedor. <a href="/como-avaliamos.html">Como avaliamos</a>.</p></section>';
 }
 return {text,sober,source,facts,make,eligible,quality,render};
});
