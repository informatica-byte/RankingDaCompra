import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import social from '../social-page-verifier.js';
const SITE='https://rankingdacompra.com.br';
const original=SITE+'/produto/mlMLB7533453778-20260810-1.html';
const canonical=SITE+'/produto/6mZ1ahzme9kUH1UdSkJw-20260810-1.html';
const image=SITE+'/produto/imagens/6mZ1ahzme9kUH1UdSkJw-photo.jpg?v=20260810-1';
const product={id:'mlMLB7533453778',titulo:'Starlink Mini Kit Antena Satélite com Roteador Wi-Fi',link:'https://www.mercadolivre.com.br/p/MLB40656539?pdp_filters=item_id%3AMLB7533453778',preco:'470,71',linkAfiliado:'https://meli.la/preservar'};
const alias=`<meta name="robots" content="noindex,follow"><link href="${canonical}" rel="canonical"><meta content="0;url=${canonical}" http-equiv="refresh">`;
const main=`<meta property="og:type" content="product"><meta content="Starlink Mini" property="og:title"><link rel="canonical" href="${canonical}"><meta property="og:image" content="${image}"><meta name="rdc-offer-url" content="https://www.mercadolivre.com.br/p/MLB40656539#position=12&amp;wid=MLB7533453778"><meta name="robots" content="index,follow">`;
function fixture(first=alias,last=main){const calls=[];return {calls,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,url,text:async()=>url===original?first:last};}};}

test('Starlink duplicada usa página e foto principais somente com prova do mesmo anúncio',async()=>{
  const f=fixture(),before=JSON.stringify(product),out=await social.resolve(product,original,f.fetch);
  assert.deepEqual(out,{url:canonical,image,title:'Starlink Mini',canonicalId:'6mZ1ahzme9kUH1UdSkJw',aliased:true});
  assert.equal(JSON.stringify(product),before);
  assert.equal(f.calls.length,2);assert.ok(f.calls.every(c=>c.options.redirect==='error'&&c.options.cache==='no-store'));
});
test('página direta continua válida e não depende de ID histórico na vitrine',async()=>{
  const f=fixture(main,main),p={...product,id:'6mZ1ahzme9kUH1UdSkJw'};
  assert.equal((await social.resolve(p,canonical,f.fetch)).aliased,false);assert.equal(f.calls.length,1);
});

test('foto local publicada é reconhecida no compartilhamento sem afrouxar a identidade do anúncio',async()=>{
  const local=SITE+'/produto/imagens/6mZ1ahzme9kUH1UdSkJw-local-'+'a'.repeat(64)+'.jpg';
  const p={...product,id:'6mZ1ahzme9kUH1UdSkJw',foto:local},html=main.replace(image,local),before=JSON.stringify(p);
  assert.equal((await social.resolve(p,canonical,fixture(html,html).fetch)).image,local);
  assert.equal(JSON.stringify(p),before);
  await assert.rejects(social.resolve(product,original,fixture(alias,html.replaceAll('MLB7533453778','MLB9999999999')).fetch),/outro anúncio/);
});
test('mesmo catálogo com vendedor/anúncio diferente não libera compartilhamento',async()=>{
  await assert.rejects(social.resolve(product,original,fixture(alias,main.replaceAll('MLB7533453778','MLB9999999999')).fetch),/outro anúncio/);
  for(const changed of [{...product,link:'https://www.mercadolivre.com.br/p/MLB40656539'},{...product,link:'https://evil.example/MLB7533453778'},{...product,link:product.link+'&wid=MLB9999999999'}])await assert.rejects(social.resolve(changed,original,fixture().fetch),/prova do mesmo anúncio/);
});
test('redirecionamento externo ou não comprovado é bloqueado antes da segunda leitura',async()=>{
  for(const first of [alias.replaceAll(canonical,'https://evil.example/produto/outro-20260810-1.html'),alias.replace('noindex,follow','index,follow'),alias.replace('0;url=','1;url='),alias.replace('http-equiv="refresh"','name="outro"')]){
    const f=fixture(first);await assert.rejects(social.resolve(product,original,f.fetch));assert.equal(f.calls.length,1);
  }
});
test('loops, cadeias e redirecionamento HTTP não recebem aprovação',async()=>{
  await assert.rejects(social.resolve(product,original,fixture(alias,alias.replaceAll(canonical,original)).fetch));
  await assert.rejects(social.resolve(product,original,async()=>({ok:true,url:'https://evil.example',text:async()=>main})));
  await assert.rejects(social.resolve(product,original,async()=>({ok:false,url:original,text:async()=>main})));
});
test('foto genérica, externa, ausente e página pausada não liberam os botões',async()=>{
  for(const last of [main.replace(image,SITE+'/og-ranking-da-compra.png'),main.replace(image,'https://evil.example/photo.jpg'),main.replace('og:image','og:other'),main.replace('index,follow','noindex,follow'),main.replace('og:type','og:other-type')])await assert.rejects(social.resolve(product,original,fixture(alias,last).fetch));
});
test('metadados ambíguos e credenciais em URL são recusados',async()=>{
  await assert.rejects(social.resolve(product,original,fixture(alias,main+'<meta property="og:image" content="https://evil.example/foto.jpg">').fetch),/contraditórios/);
  await assert.rejects(social.resolve(product,original,fixture(alias,main.replace(image,image.replace('https://','https://user:secret@'))).fetch));
  await assert.rejects(social.resolve(product,original.replace('mlMLB7533453778','outro'),fixture().fetch));
});
test('prova diferencia item de catálogo e entende fragmento, filtro e URL direta',()=>{
  for(const url of [product.link,'https://www.mercadolivre.com.br/p/MLB40656539#position=1&wid=MLB7533453778','https://produto.mercadolivre.com.br/MLB-7533453778-starlink-_JM'])assert.equal(social.offer(url),'MLB7533453778');
  for(const url of ['https://www.mercadolivre.com.br/p/MLB40656539','http://produto.mercadolivre.com.br/MLB-7533453778-x','https://www.mercadolivre.com.br/p/MLB40656539?wid=MLB7533453778#wid=MLB9999999999'])assert.equal(social.offer(url),'');
});

const dashboard=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
function runFunction(context,start,end){const a=dashboard.indexOf(start),b=dashboard.indexOf(end,a);assert.ok(a>=0&&b>a);vm.runInContext(dashboard.slice(a,b),context);}
test('painel atualiza link identificado, WhatsApp, Facebook e foto sem tocar no cadastro',()=>{
  const input={},photo={},wa={tagName:'A',dataset:{centralRede:'whatsapp'}},fb={tagName:'A',dataset:{centralRede:'facebook'}};
  const state={pagina:{url:canonical,image},pronto:true,arquivoPronto:true};
  const ctx={URL,Map,CSS:{escape:s=>s},dataBrasil:()=> '2026-10-23',estadosPublicacaoCentral:new Map([[product.id,state]]),SHARE_VERSION_CENTRAL:'20260810-1',textoPadraoCentral:()=> 'texto original',document:{getElementById:id=>id.startsWith('campanha-link')?input:{value:'Meu texto preservado'},querySelector:()=>photo,querySelectorAll:()=>[wa,fb]}};
  vm.createContext(ctx);runFunction(ctx,'function hashCampanhaCentral','const INTERVALO_PUBLICACAO_CENTRAL');runFunction(ctx,'function atualizarLinksCampanhaCentral','function duracaoPublicacaoCentral');
  const before=JSON.stringify(product);ctx.atualizarLinksCampanhaCentral(product);
  assert.ok(input.value.startsWith(canonical+'?'));assert.equal(new URL(input.value).searchParams.get('utm_content'),product.id);
  assert.match(new URL(wa.href).searchParams.get('text'),/Meu texto preservado/);assert.ok(new URL(wa.href).searchParams.get('text').includes(canonical));
  assert.ok(new URL(fb.href).searchParams.get('u').startsWith(canonical));assert.equal(photo.src,image);assert.equal(JSON.stringify(product),before);
});
test('falha na foto não é tratada como arquivo pronto e renderização não oculta o erro',async()=>{
  const state={},ctx={prepararArquivoCampanhaCentral:async()=>null,atualizarAvisoPublicacaoCentral:()=>{},INTERVALO_PUBLICACAO_CENTRAL:15000};vm.createContext(ctx);
  runFunction(ctx,'async function prepararFotoSocialCentral','function carregarImagemCentral');await ctx.prepararFotoSocialCentral(product,state);
  assert.equal(state.arquivoPronto,false);assert.equal(state.fotoErro,true);assert.equal(state.arquivoVerificando,false);
  ctx.prepararArquivoCampanhaCentral=async()=>({type:'image/png'});await ctx.prepararFotoSocialCentral(product,state);assert.equal(state.arquivoPronto,true);assert.equal(state.fotoErro,false);
  assert.doesNotMatch(dashboard,/prepararArquivoCampanhaCentral\(produto\)\.finally\(\(\)=>\{estado\.arquivoPronto=true/);
  assert.match(dashboard,/if\(estado\.pronto&&estado\.arquivoPronto\)/);
});
test('resolução concorrente reutiliza leituras públicas e não acessa Firestore',async()=>{
  let count=0;const state={};const ctx={Map,estadosPublicacaoCentral:new Map([[product.id,state]]),promessasPaginaSocialCentral:new Map(),urlCampanhaCentral:()=>original,fetch:()=>{},window:{RDCSocialPage:{resolve:async()=>{count++;await Promise.resolve();return {url:canonical,image};}}}};vm.createContext(ctx);
  runFunction(ctx,'async function resolverPaginaSocialCentral','function atualizarLinksCampanhaCentral');await Promise.all([ctx.resolverPaginaSocialCentral(product),ctx.resolverPaginaSocialCentral(product)]);await ctx.resolverPaginaSocialCentral(product);assert.equal(count,1);
  assert.doesNotMatch(readFileSync(new URL('../social-page-verifier.js',import.meta.url),'utf8'),/firebase|firestore|\.collection\(|\.update\(/i);
});

test('arquivo de compartilhamento usa a foto resolvida antes da chave e invalida troca de anúncio',()=>{
  const state={pagina:{image}},ctx={dataBrasil:()=> '2026-10-23',estadosPublicacaoCentral:new Map([[product.id,state]])};vm.createContext(ctx);
  runFunction(ctx,'function chaveArquivoCampanhaCentral','async function prepararArquivoCampanhaCentral');
  const first=ctx.chaveArquivoCampanhaCentral(product);
  assert.notEqual(ctx.chaveArquivoCampanhaCentral({...product,link:product.link+'&novo=1'}),first);
  state.pagina.image=image+'&rev=2';assert.notEqual(ctx.chaveArquivoCampanhaCentral(product),first);
  assert.match(dashboard,/async function prepararArquivoCampanhaCentral\(produto\)\{[\s\S]*?await resolverPaginaSocialCentral\(produto\)[\s\S]*?const chave=chaveArquivoCampanhaCentral\(produto\)/);
});
