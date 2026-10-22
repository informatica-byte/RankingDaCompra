import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {pausedProductPage} from './product-url-continuity.mjs';
import {publicCatalogue} from './public-catalogue.mjs';

test('pausa explícita sobrevive no snapshot sem publicar notas privadas nem modificar preço',()=>{
  const product={id:'p',titulo:'Mesmo produto',preco:123.45,precoAtualizadoManualmenteEm:'2026-10-21T12:00:00Z',conferenciaPausada:true,conferenciaPausadaEm:'privado',token:'privado'};
  const before=JSON.stringify(product),published=publicCatalogue([product]).products[0];
  assert.equal(published.conferenciaPausada,true);
  assert.equal(published.preco,product.preco);
  assert.equal(published.precoAtualizadoManualmenteEm,product.precoAtualizadoManualmenteEm);
  assert.equal('token' in published,false);assert.equal('conferenciaPausadaEm' in published,false);
  assert.equal(JSON.stringify(product),before);
});

test('endereço de pausado permanece próprio, sem compra, preço, redirecionamento ou alegação de exclusão',()=>{
  const product={id:'p',titulo:'Fone <TWS>',preco:123.45,linkAfiliado:'https://meli.la/abc'};
  const before=JSON.stringify(product),html=pausedProductPage(product);
  assert.match(html,/Anúncio em pausa/);assert.match(html,/Fone &lt;TWS&gt;/);assert.match(html,/noindex,follow/);
  assert.doesNotMatch(html,/123[.,]45|meli\.la|http-equiv="refresh"|Oferta encerrada/);
  assert.equal(JSON.stringify(product),before);
});

test('pausa impede destaque mesmo com conferência recente e reativação não muda preços',()=>{
  const scope={window:{},module:{exports:{}}};vm.runInNewContext(readFileSync('best-choices.js','utf8'),scope);
  const api=scope.module.exports,product={id:'p',titulo:'Fone TWS',foto:'https://example.com/p.jpg',preco:99,precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:new Date().toISOString()};
  assert.ok(api.eligible(product));assert.equal(api.eligible({...product,conferenciaPausada:true}),false);
  assert.equal(api.selectProducts([{...product,conferenciaPausada:true}],{bestChoicesProductIds:['p']}).length,0);
  assert.equal(api.selectProducts([{...product,conferenciaPausada:false}],{bestChoicesProductIds:['p']})[0].preco,99);
});

test('todos os caminhos de publicação respeitam a pausa sem escrever no banco',()=>{
  const generator=readFileSync('scripts/generate-sitemap.mjs','utf8'),discovery=readFileSync('scripts/generate-discovery.mjs','utf8');
  assert.match(generator,/const rawShareProducts = allProducts\s*\.filter\(\(product\) => product\.conferenciaPausada !== true\)/);
  assert.match(generator,/expectedPages\.add\(fileName\);\s*if \(!partialProductSource\) await writeFile\(resolve\(productDirectory,fileName\),pausedProductPage\(product\)/);
  assert.match(discovery,/const candidateProducts = allProducts\.map\(correctProductData\)\s*\.filter\(\(product\) => product\.conferenciaPausada !== true\)/);
  const home=readFileSync('index.html','utf8');assert.match(home,/function produtoDisponivel\(produto\)\{if\(produto\?\.conferenciaPausada===true\)return false/);
});
