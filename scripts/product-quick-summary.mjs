import {HIGHLIGHT_EDITORIAL} from './highlight-editorial.mjs';
import {documentedSpecifications} from './manufacturer-specifications.mjs';

// These short decisions reuse the already reviewed model/source. They contain
// no ranking, new performance claim, price, score or merchant guarantee.
const SUMMARY=new Map([
  ['ARscPKCMZs3D8k22qltl',{fit:'Fone compacto sem fio com encaixe dentro do ouvido.',limit:'Não tem ANC para ouvir; a redução de ruído anunciada atua nas chamadas.',check:'Confira o encaixe e diferencie a autonomia do fone do total com recargas.'}],
  ['GjHJtzdsIhbmSINvhPeX',{fit:'Alternativa sem fio com apoio sobre as orelhas (on-ear).',limit:'Não possui ANC; o conforto individual não foi testado.',check:'Confira o encaixe e a compatibilidade com os aparelhos que você usa.'}],
  ['48oRcQNlH00KgNLHkvsG',{fit:'Pulseira com registros de atividades pelo Mi Fitness, segundo a Xiaomi.',limit:'Os registros de bem-estar não são diagnóstico nem substituem aparelhos médicos.',check:'Confira a compatibilidade do celular e as restrições para uso na água.'}],
  ['O6e0R2WtiZfyyf2MJe5Y',{fit:'Notebook com 16 GB de RAM e SSD de 512 GB, segundo o anúncio.',limit:'Linux KeepOS anunciado; não acompanha Windows.',check:'Confira a configuração ofertada e se seus programas funcionam nesse sistema.'}],
  ['UvxFn4gfaexb8TvcaT5e',{fit:'Mouse sem fio com receptor USB, para aparelhos com porta compatível.',limit:'Depende do receptor USB; não é um mouse Bluetooth.',check:'Confira se receptor e pilha fazem parte do conjunto vendido.'}],
  ['huCYMmOsGPKJ8jOiJ1gR',{fit:'Lavadora compacta para avaliar em tarefas de limpeza residencial.',limit:'Oferta de 220 V; 1.500 PSI permissíveis não equivalem à pressão nominal.',check:'Confira a rede elétrica, os acessórios e as instruções para a superfície.'}],
]);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function quickSummary(product){
  const source=HIGHLIGHT_EDITORIAL.get(product?.id),summary=SUMMARY.get(product?.id);
  const title=String(product?.titulo||product?.title||'');
  if(!summary||!source?.model.test(title)||/^(?:capa|case|suporte|carregador|refil)\b/i.test(title))return null;
  // The ASUS offer has a listing-specific guard; don't use another seller/SKU.
  if(source.sourceKind==='marketplace-listing'&&!documentedSpecifications(product))return null;
  return {...summary,sourceUrl:source.sourceUrl,sourceKind:source.sourceKind||'manufacturer-specification'};
}
const STYLE='<style data-quick-product-summary-style>.quick-product-summary{margin:12px 0;padding:14px;border:1px solid #c8ded2;border-radius:12px;background:#f2faf5;color:#183c2d;min-width:0;overflow-wrap:anywhere}.quick-product-summary h2{font-size:1rem;line-height:1.3;margin:0 0 10px}.quick-product-summary p{font-size:.94rem;line-height:1.5;margin:8px 0}.quick-product-summary .fine{font-size:.8rem}details[data-full-product-summary]{margin:8px 0;min-width:0;overflow-wrap:anywhere}details[data-full-product-summary]>summary{cursor:pointer;min-height:44px;padding:10px 0;font-weight:700;color:#075e45}@media(max-width:700px){.top [data-quick-product-summary],.top details[data-full-product-summary]{order:6;width:100%;min-width:0}}</style>';
export function applyQuickSummary(html,product){
  const clean=html.replace(/<!-- quick-product-summary:start -->[\s\S]*?<!-- quick-product-summary:end -->/g,'')
    .replace(/<style data-quick-product-summary-style>[\s\S]*?<\/style>/g,'')
    .replace(/<details data-full-product-summary><summary>Ler a análise completa<\/summary>(<p class="summary">[\s\S]*?<\/p>)<\/details>/g,'$1');
  const brief=quickSummary(product);
  const heading=clean.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]*>/g,' ');
  if(!brief||!heading||!HIGHLIGHT_EDITORIAL.get(product.id).model.test(heading)||!/<p class="summary">/.test(clean)||/name="robots" content="noindex/.test(clean))return clean;
  const block='<!-- quick-product-summary:start --><section class="quick-product-summary" data-quick-product-summary aria-label="Resumo para decidir"><h2>Em poucas palavras</h2><p><b>Para quem faz sentido:</b> '+esc(brief.fit)+'</p><p><b>Principal limitação:</b> '+esc(brief.limit)+'</p><p><b>Antes de comprar:</b> '+esc(brief.check)+'</p><p class="fine">'+(brief.sourceKind==='marketplace-listing'?'Informações do anúncio, sem validação independente.':'Informações do fabricante, não teste próprio.')+' <a href="'+esc(brief.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Consultar fonte</a>.</p></section><!-- quick-product-summary:end -->';
  return clean.replace('</head>',STYLE+'</head>').replace(/<p class="summary">[\s\S]*?<\/p>/,p=>block+'<details data-full-product-summary><summary>Ler a análise completa</summary>'+p+'</details>');
}
