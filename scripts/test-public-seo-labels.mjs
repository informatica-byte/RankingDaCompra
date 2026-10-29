import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicProductName,rewritePublicSeo,seoSitemap,ANALYSES_DESCRIPTION,EPSON_DESCRIPTION,CONSUMER_INTRO,seasonalDescription} from './public-seo-labels.mjs';

const product={id:'Bf3ccSwSiVkLw1Z8k2Hu',titulo:'Liquidificador Turbo Power Mondial 550W - L-99 FB',link:'https://www.mercadolivre.com.br/p/MLB15578949?pdp_filters=item_id%3AMLB4297760749#origin=share&wid=MLB4297760749'};
test('rótulos públicos distinguem anúncios sem inferir variantes nem modificar o cadastro',()=>{
 const before=JSON.stringify(product),name=publicProductName(product);
 assert.equal(name,product.titulo+' — anúncio MLB4297760749');assert.equal(JSON.stringify(product),before);
 assert.equal(publicProductName({...product,titulo:name}),name);
 assert.doesNotMatch(name,/127\s*V|220\s*V|branco|preto/i);
 const other=publicProductName({...product,id:'SnMMDq9bDXiMWX0IXYdO',link:'https://www.mercadolivre.com.br/p/MLB15578948?wid=MLB1793491599'});
 assert.notEqual(name,other);
});
test('nenhum rótulo é atribuído por catálogo, campanha, domínio estranho ou códigos contraditórios',()=>{
 for(const link of ['https://www.mercadolivre.com.br/p/MLB4297760749','https://www.mercadolivre.com.br/p/MLB15578949?pdp_filters=deal:MLB4297760749','https://evil.example/?wid=MLB4297760749','https://www.mercadolivre.com.br/p/MLB15578949?wid=MLB4297760749#item_id=MLB1793491599'])assert.equal(publicProductName({...product,link}),product.titulo);
 assert.equal(publicProductName({...product,id:'outro-cadastro'}),product.titulo);
 assert.equal(publicProductName({...product,titulo:'Outro produto'}),'Outro produto');
});
test('kits Principia não recebem composição inventada e mantêm os dois anúncios separados',()=>{
 const a=publicProductName({id:'DjihMK3g3rkBHHTPbOwp',titulo:'Principia Kit Limpeza E Hidratação Ch-01 + Ol-01 + Gl-02',link:'https://www.mercadolivre.com.br/p/MLB59774342#pdp_filters=deal:MLB779362-1&wid=MLB4247892213'});
 const b=publicProductName({id:'pO6CZCNo99YwtpIW0UB8',titulo:'Principia Kit Limpeza E Hidratação Ch-01 + Ol-01 + Gl-02',link:'https://www.mercadolivre.com.br/p/MLB59624823?pdp_filters=item_id:MLB5786186316'});
 assert.notEqual(a,b);assert.doesNotMatch(a+' '+b,/CH-01|GH-01|OL-01|GL-02/i);
 assert.equal(publicProductName({id:'DjihMK3g3rkBHHTPbOwp',titulo:a,link:'https://www.mercadolivre.com.br/p/MLB59774342?wid=MLB4247892213'}),a);
});
test('três descrições não prometem preço conferido e continuam informativas',()=>{
 for(const value of [ANALYSES_DESCRIPTION,EPSON_DESCRIPTION,seasonalDescription(CONSUMER_INTRO)]){
  assert.doesNotMatch(value,/preço|desconto confirmado|testamos|melhor do mercado/i);
  assert.match(value,/limitaç|atenção/);
 }
});
test('atualização HTML é idempotente e preserva links, canonical, CSP e estados de segurança',()=>{
 const title=publicProductName(product),file='produto/demo.html',url='https://rankingdacompra.com.br/'+file;
 const original='<html><head><meta http-equiv="Content-Security-Policy" content="object-src none"><title>Antigo</title><link rel="canonical" href="'+url+'"><meta property="og:title" content="Antigo"><meta name="twitter:title" content="Antigo"></head><body><h1>'+product.titulo+'</h1><script type="application/ld+json">'+JSON.stringify({'@type':'Article',headline:product.titulo,about:{'@type':'Thing',name:product.titulo},mainEntityOfPage:url})+'</script><a id="affiliate-offer" href="https://meli.la/existente?utm_source=x">Conferir</a></body></html>';
 const options={file,product:{title}},next=rewritePublicSeo(original,options);
 assert.match(next,/anúncio MLB4297760749/);assert.match(next,/https:\/\/meli.la\/existente\?utm_source=x/);
 assert.match(next,/rel="canonical" href="https:\/\/rankingdacompra.com.br\/produto\/demo.html"/);
 assert.match(next,/Content-Security-Policy/);assert.equal(rewritePublicSeo(next,options),next);
 assert.equal(rewritePublicSeo(original.replace('<head>','<head><meta http-equiv="refresh" content="0;url=/produto/original.html">'),options),original.replace('<head>','<head><meta http-equiv="refresh" content="0;url=/produto/original.html">'));
});
test('metadados e schemas recebem a mesma descrição, sem tocar descrições de outros produtos',()=>{
 const html='<head><meta name="description" content="preço confirmado"><meta property="og:description" content="preço confirmado"><meta name="twitter:description" content="preço confirmado"><script type="application/ld+json">{"@type":"WebPage","description":"preço confirmado"}</script></head>';
 const next=rewritePublicSeo(html,{file:'analises.html'});
 assert.doesNotMatch(next,/preço confirmado/);assert.equal((next.match(/Explore análises/g)||[]).length,4);
 assert.equal(rewritePublicSeo(html,{file:'outra.html'}),html);
});
test('geradores usam as mesmas descrições e diferenciam os nomes só na projeção pública',async()=>{
 for(const [file,term]of [['generate-discovery.mjs','ANALYSES_DESCRIPTION'],['generate-seasonal-guides.mjs','seasonalDescription(theme.intro)'],['product-title-corrections.mjs','metaSummary: EPSON_DESCRIPTION'],['informational-site.mjs','applyPublicSeoLabels(root)']])assert.ok((await readFile(new URL(file,import.meta.url),'utf8')).includes(term));
});
test('sitemap sinaliza só a revisão editorial selecionada sem remover URLs nem retroceder datas',()=>{
 const entry=(file,date)=>`<url><loc>https://rankingdacompra.com.br/${file}</loc><lastmod>${date}</lastmod></url>`;
 const original='<urlset>'+entry('analises.html','2026-10-26')+entry('outra.html','2026-10-20')+entry('futura.html','2026-11-01')+'</urlset>';
 const files=new Set(['analises.html','futura.html']),next=seoSitemap(original,files);
 assert.equal(next,'<urlset>'+entry('analises.html','2026-10-29')+entry('outra.html','2026-10-20')+entry('futura.html','2026-11-01')+'</urlset>');
 assert.equal(seoSitemap(next,files),next);
});
test('caminho de navegação usa o nome público sem mudar os destinos',()=>{
 const html='<nav class="crumb" aria-label="Você está aqui"><a href="/">Início</a>/<a href="/analises.html">Análises</a> / Nome antigo</nav>';
 const next=rewritePublicSeo(html,{product:{title:'Kit Principia — anúncio MLB4247892213'}});
 assert.match(next,/Kit Principia — anúncio MLB4247892213/);assert.doesNotMatch(next,/Nome antigo/);
 assert.match(next,/<a href="\/">Início<\/a>\/<a href="\/analises.html">Análises<\/a>/);
 assert.equal(rewritePublicSeo(next,{product:{title:'Kit Principia — anúncio MLB4247892213'}}),next);
});
