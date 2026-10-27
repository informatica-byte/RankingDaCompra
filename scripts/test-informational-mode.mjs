import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import info from '../informational-mode.js';
import {informationalHtml,assertInformationalHtml,affiliateLinks} from './informational-site.mjs';

const fixture='<!doctype html><html lang="pt-BR"><head><meta http-equiv="Content-Security-Policy" content="object-src \'none\'; base-uri \'self\'"><script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'Product',name:'Modelo documentado',url:'https://rankingdacompra.com.br/produto/demo.html',offers:{'@type':'Offer',price:'123.45',priceCurrency:'BRL'},review:{'@type':'Review',reviewRating:{'@type':'Rating',ratingValue:5}}})+'</script></head><body><main><article><h1>Modelo documentado</h1><div class="price">R$ 123,45</div><p>Recursos anunciados, sem teste independente.</p><a id="affiliate-offer" href="https://meli.la/abc" rel="sponsored noopener">Conferir na loja</a><a id="affiliate-offer-shopee" href="https://shopee.com.br/product/12/34?utm_source=afiliado" rel="sponsored noopener">Shopee</a></article></main></body></html>';
const product={id:'demo',comparison:{features:[{label:'Bluetooth',value:'5.4, segundo o anúncio',state:'yes',basis:'cadastro',sourceUrl:'https://www.mercadolivre.com.br/p/MLB123'},{label:'ANC',value:'A confirmar',state:'unknown',reason:'O anúncio não documenta ANC.'}]}};

test('modo informativo remove valores e avaliações sem alterar monetização nem CSP',()=>{
 const html=informationalHtml(fixture,product,'produto/demo.html');
 assertInformationalHtml(html);assert.deepEqual(affiliateLinks(html),affiliateLinks(fixture));
 assert.ok(html.indexOf('Content-Security-Policy')<html.indexOf('/informational-mode.js'));
 assert.match(html,/"@type":"Article"/);assert.doesNotMatch(html,/"@type":"(?:Offer|Product|Review|Rating)"/);
 assert.match(html,/5\.4, segundo o anúncio/);assert.match(html,/não está confirmada/);assert.match(html,/sem teste independente/);
 assert.equal(informationalHtml(html,product,'produto/demo.html'),html);
});

test('conteúdo e URLs não podem injetar HTML ou credenciais',()=>{
 assert.equal(info.safe('https://usuario:senha@example.com/'),'#');
 assert.equal(info.safe('javascript:alert(1)'),'#');
 assert.equal(info.productUrl({id:'x',url:'https://malicioso.example/produto/x.html'}),'#');
 const html=info.faq({comparison:{features:[{label:'<img onerror=1>',value:'<script>alert(1)</script>',state:'yes',sourceUrl:'javascript:alert(1)'}]}});
 assert.doesNotMatch(html,/<script|<img|href="javascript:/);assert.match(html,/&lt;script&gt;/);
});

test('catálogo público informativo não carrega campos financeiros',async()=>{
 const catalogue=JSON.parse(await readFile(new URL('../informational-catalogue.json',import.meta.url),'utf8'));
 assert.equal(catalogue.mode,'informational');assert.ok(catalogue.products.length>0);
 for(const p of catalogue.products){for(const key of ['preco','price','priceValue','regularPrice','rating','nota','precoPromocional','discount'])assert.equal(p[key],undefined);assert.notEqual(info.productUrl(p),'#');}
});

test('publicação mantém controles de segurança e inclui a versão informativa final',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/update-sitemap.yml',import.meta.url),'utf8');
 assert.ok(workflow.indexOf('node scripts/informational-site.mjs')<workflow.indexOf('node scripts/validate-site.mjs'));
 assert.match(workflow,/publication-price-guard/);assert.match(workflow,/git add -A[^\n]+informational-catalogue\.json/);
 for(const file of ['dashboard.html','painel-celular.html']){
  const html=await readFile(new URL('../'+file,import.meta.url),'utf8');
  assert.match(html,/RDCInformational/);assert.match(html,/RDCProductUniqueness/);
 }
 const history=await readFile(new URL('./update-price-history.mjs',import.meta.url),'utf8');
 assert.match(history,/informational/);
});

test('rejeita preços e links adulterados em páginas finais',()=>{
 const clean=informationalHtml(fixture,product,'produto/demo.html');
 assert.throws(()=>assertInformationalHtml(clean.replace('</main>','<p>R$ 1,00</p></main>')),/preço/);
 assert.throws(()=>assertInformationalHtml(clean.replace('https://meli.la/abc','https://evil.example/abc')),/link de afiliado inválido/);
});

test('todas as páginas do sitemap respeitam o modo informativo, sem apagar destinos',async()=>{
 const xml=await readFile(new URL('../sitemap.xml',import.meta.url),'utf8');
 const pages=[...xml.matchAll(/<loc>https:\/\/rankingdacompra\.com\.br\/([^<]*)<\/loc>/g)].map(m=>m[1]||'index.html').filter(path=>path.endsWith('.html'));
 assert.ok(pages.length>500);
 for(const file of pages){const html=await readFile(new URL('../'+file,import.meta.url),'utf8');if(/http-equiv="refresh"/.test(html))continue;assertInformationalHtml(html,file);}
});

test('compartilhamento do painel não divulga preços históricos nem afirma teste próprio',()=>{
 const p={id:'test',titulo:'Produto documentado',foto:'https://http2.mlstatic.com/foto.jpg',comentario:'Um texto informativo sobre os dados do anúncio.',preco:'999,00',precoPromocional:'899,00'};
 const html=info.campaignCard(p,{url:'https://rankingdacompra.com.br/produto/test.html',message:'Leia a análise e confira as fontes.'});
 assert.doesNotMatch(html,/999|899|R\$|desconto|testamos/i);assert.match(html,/data-central-compartilhar="test"/);assert.match(html,/https:\/\/wa.me\//);
 assert.equal(info.campaignCard(p,{url:'https://malicioso.example/test',message:'x'}),'');
});
