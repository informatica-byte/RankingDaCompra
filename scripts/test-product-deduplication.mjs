import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import offerReplacement from '../product-offer-replacement.js';
import {publicationIdentity, publicationProductGroups, sameHistoricalListing, REVIEWED_PUBLICATION_PAIRS} from './product-deduplication.mjs';
import {selectCanonicalProducts,legacyProductAliases} from './product-url-continuity.mjs';

const control='https://www.mercadolivre.com.br/controle/up/MLBU3461479224';
const terminal='https://www.mercadolivre.com.br/maquininha/p/MLB12345678';
const item='MLB4231915505',other='MLB9876543210';
const product=(id,link,titulo='Controle Joystick Wireless')=>({id,link,titulo,preco:'159,90',precoAnterior:'299,00',precoPromocional:'149,90',precoConferenciaId:'preservado',precoConferenciaValor:159.9,precoAtualizadoManualmenteEm:'2026-10-26T10:00:00Z'});
const dedup=products=>selectCanonicalProducts(publicationProductGroups(products),p=>p.score||0);

for (const [listingId,catalogueId,affiliate,...records] of REVIEWED_PUBLICATION_PAIRS) {
 const rows=records.map(([id,title])=>Object.freeze({...product(id,
   `https://www.mercadolivre.com.br/p/${catalogueId}?wid=${listingId}`,title),
   linkAfiliado:affiliate}));
 test('revisão delimitada de títulos abreviados preserva valores: '+listingId,()=>{
  const before=JSON.stringify(rows), result=dedup(rows);
  assert.equal(result.selected.length,1);assert.equal(result.aliases.size,rows.length-1);
  assert.equal(JSON.stringify(rows),before);
  assert.ok(rows.includes(result.selected[0]));
 });
 for(const [label,patch] of [
  ['outro cadastro',{id:'novo-cadastro-nao-revisado'}],
  ['outro modelo',{titulo:records[0][1]+' Modelo Diferente 2'}],
  ['outro anúncio',{link:`https://www.mercadolivre.com.br/p/${catalogueId}?wid=MLB9876543210`}],
  ['outro catálogo',{link:`https://www.mercadolivre.com.br/p/MLB98765432?wid=${listingId}`}],
  ['sem anúncio explícito',{link:`https://www.mercadolivre.com.br/p/${catalogueId}`}],
  ['outro afiliado',{linkAfiliado:'https://meli.la/OutroDestino'}],
 ])test('revisão não é reutilizada com '+label+': '+listingId,()=>{
  const changed={...rows[0],...patch};
  // Use the differently worded record; identical titles are already handled
  // by the original explicit-listing rule, independently of this review.
  assert.equal(dedup([changed,rows.at(-1)]).selected.length,2);
 });
}

test('divergência P30i verde/preto continua separada mesmo com o mesmo anúncio',()=>{
 const common='Fone de Ouvido Bluetooth 5.4 soundcore P30i da Anker';
 const rows=['Verde','Preto'].map((color,i)=>({...product(
   i?'ZVVdy8TuP0yW0XNIyiEA':'5bQKU9inL3pq14yE8K4L',
   'https://www.mercadolivre.com.br/p/MLB38176139?wid=MLB5410636044',common+' '+color),
   linkAfiliado:i?'https://meli.la/2JXwiJj':'https://meli.la/1jDhep3'}));
 assert.equal(dedup(rows).selected.length,2);
 assert.ok(rows.every(row=>!publicationIdentity(row).reviewed));
});

for(const campaign of ['deal:MLB779362-1','deal%3AMLB779362-1','deal%253AMLB779362-1'])test('campanha '+campaign+' nunca une produtos diferentes',()=>{
 const a=product('controle',control+'?pdp_filters='+campaign+'#wid='+item);
 const b=product('maquininha',terminal+'?pdp_filters='+campaign+'#wid='+other,'Maquininha de Cartao');
 const snapshot=JSON.stringify([a,b]),result=dedup([a,b]);
 assert.equal(result.selected.length,2);assert.equal(result.aliases.size,0);assert.equal(JSON.stringify([a,b]),snapshot);
 assert.equal(publicationIdentity(a).listingId,item);assert.equal(publicationIdentity(b).listingId,other);
});

test('catálogo, título, código legado, texto técnico e afiliado curto sozinhos não consolidam',()=>{
 const link='https://www.mercadolivre.com.br/p/MLB12345678?pdp_filters=deal:MLB779362-1';
 const products=['a','b'].map(id=>({...product(id,link),codigoMLB:item,mercadoLivreItemId:item,dadosTecnicos:'Campanha '+item,linkAfiliado:'https://meli.la/mesmo'}));
 assert.equal(dedup(products).selected.length,2);assert.equal(publicationIdentity(products[0]),null);
 assert.equal(dedup(['a','b'].map(id=>({...product(id,''),codigoMLB:item}))).aliases.size,0);
});

test('mesmo catálogo e nome, mas anúncios diferentes, permanecem separados',()=>{
 const a=product('a','https://www.mercadolivre.com.br/p/MLB12345678?wid='+item);
 const b=product('b','https://www.mercadolivre.com.br/p/MLB12345678?wid='+other);
 assert.equal(dedup([a,b]).selected.length,2);
});

test('link de afiliado repetido não encadeia anúncios distintos',()=>{
 const products=[item,other].map((id,i)=>({...product(String(i),control+'?wid='+id),linkAfiliado:'https://meli.la/mesmo'}));
 assert.equal(dedup(products).selected.length,2);assert.equal(dedup(products).aliases.size,0);
});

test('somente mesmo anúncio explícito e título compatível geram alias, sem editar valores',()=>{
 const a=Object.freeze({...product('a','https://produto.mercadolivre.com.br/MLB-4231915505-controle-_JM'),score:1});
 const b=Object.freeze({...product('b',control+'?pdp_filters=item_id%3A'+item,'  CONTROLE joystick wireless!  '),score:2});
 const snapshot=JSON.stringify([a,b]),result=dedup([a,b]);
 assert.deepEqual(result.selected,[b]);assert.equal(result.aliases.get('a'),b);
 assert.equal(JSON.stringify([a,b]),snapshot);
 for(const field of ['preco','precoAnterior','precoPromocional','precoConferenciaId','precoConferenciaValor','precoAtualizadoManualmenteEm','link'])assert.equal(result.selected[0][field],b[field]);
});

for(const title of ['Maquininha de Cartao','Controle Modelo Pro 2','Controle Joystick Wireless 128 GB','Controle Joystick Wireless Kit 2'])test('mesmo anúncio com título contraditório não é unido: '+title,()=>{
 assert.equal(dedup([product('a',control+'?wid='+item),product('b',control+'?wid='+item,title)]).selected.length,2);
});

test('modelo, catálogo e edição não são inferidos por uma ponte intermediária',()=>{
 const a=product('a','https://www.mercadolivre.com.br/p/MLB12345678?wid='+item);
 const b=product('b','https://produto.mercadolivre.com.br/MLB-4231915505-controle-_JM');
 const c=product('c','https://www.mercadolivre.com.br/p/MLB87654321?wid='+item);
 for(const rows of [[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]]){
  const groups=publicationProductGroups(rows);assert.equal(groups.length,2);
  assert.ok(groups.every(g=>!(g.products.includes(a)&&g.products.includes(c))));
 }
});

for(const link of [
 control+'?wid='+item+'&wid='+other,
 control+'?wid='+item+'#item_id='+other,
 control+'?pdp_filters=item_id%3A'+item+'%7Citem_id%3A'+other,
 'https://produto.mercadolivre.com.br/MLB-4231915505-_JM?wid='+other,
 control+'?wid=MLBabc',
 'https://user:pass@www.mercadolivre.com.br/MLB-4231915505-_JM',
 'https://mercadolivre.com.br.evil.example/MLB-4231915505-_JM',
 'http://www.mercadolivre.com.br/MLB-4231915505-_JM',
])test('fonte inválida ou ambígua nunca autoriza consolidação: '+link.replace(/user:pass@/,'[credenciais]@'),()=>{
 const a=product('a',link),b=product('b',link);
 assert.equal(publicationIdentity(a),null);assert.equal(dedup([a,b]).selected.length,2);
});

test('fonte e afiliado com anúncios explicitamente diferentes ficam para revisão',()=>{
 const a={...product('a',control+'?wid='+item),linkAfiliado:terminal+'?wid='+other};
 assert.equal(publicationIdentity(a),null);
 assert.equal(dedup([a,{...a,id:'b'}]).aliases.size,0);
});

test('cadastro sem ID ou ID repetido continua bloqueando publicação',()=>{
 assert.throws(()=>publicationProductGroups({}),/inválida/);
 assert.throws(()=>dedup([product('',control+'?wid='+item)]),/identidade/);
 assert.throws(()=>dedup([product('a',control+'?wid='+item),product('a',control+'?wid='+item)]),/repetido/);
});

test('alias histórico exige anúncio real; catálogo, campanha e texto coincidente não são prova',()=>{
 const p=product('a','https://www.mercadolivre.com.br/p/'+item+'?pdp_filters=deal:'+item+'-1');
 const proof={'antigo.html':{id:'a',itemId:item,modelWords:['controle','joystick']}};
 assert.equal(sameHistoricalListing(p,item),false);assert.equal(legacyProductAliases(proof,[p]).size,0);
 const current={...p,link:control+'?pdp_filters=item_id%3A'+item};
 assert.equal(legacyProductAliases(proof,[current]).get('antigo.html'),current);
 assert.equal(sameHistoricalListing({...current,link:current.link+'#wid='+other},item),false);
});

function validator(){
 const source=readFileSync('scripts/validate-site.mjs','utf8'),context={URL,offerReplacement};
 runInNewContext(source.slice(source.indexOf('function productIdentityKeys('),source.indexOf('const homeHtml =')),context);
 return html=>Array.from(context.productIdentityKeys(html));
}
const page=(source,affiliate='https://meli.la/OwnLink')=>'<meta content="'+source+'" name="rdc-offer-url"><a href="'+affiliate+'" id="affiliate-offer">Comprar</a>';
test('validação mantém colisão do anúncio e do botão real, mas ignora código de campanha',()=>{
 const keys=validator();
 const a=keys(page(control+'?wid='+item+'&amp;pdp_filters=deal:MLB779362-1'));
 assert.ok(a.includes('mlb:4231915505'));assert.ok(a.includes('affiliate:https://meli.la/OwnLink'));
 assert.ok(!a.includes('mlb:779362'));assert.ok(!a.includes('mlb:3461479224'));
 const b=keys(page(control+'#wid='+item));assert.ok(b.includes('mlb:4231915505'));
 assert.ok(!keys(page(control+'#wid='+other,'https://meli.la/ownlink')).includes('affiliate:https://meli.la/OwnLink'));
 assert.throws(()=>keys(page(control+'?wid='+item+'&amp;item_id='+other)),/anúncios diferentes/);
 assert.throws(()=>keys(page(control+'?wid='+item,terminal+'?wid='+other)),/anúncios diferentes/);
 assert.throws(()=>keys(page(control+'?wid='+item)+page(control+'?wid='+other)),/fontes.*contraditórias/);
});

test('gerador e aliases históricos usam a interpretação restrita, sem fallback por texto',()=>{
 const generator=readFileSync('scripts/generate-sitemap.mjs','utf8');
 assert.match(generator,/const groups = publicationProductGroups\(products\)/);
 assert.match(generator,/selectCanonicalProducts\(groups, productSeoScore\)/);
 assert.doesNotMatch(generator,/function productIdentityKeys\(/);
 assert.match(readFileSync('scripts/product-url-continuity.mjs','utf8'),/sameHistoricalListing\(product, proof.itemId\)/);
 assert.match(readFileSync('.github/workflows/update-sitemap.yml','utf8'),/scripts\/product-deduplication\.mjs/);
});
