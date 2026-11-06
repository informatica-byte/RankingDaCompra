import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationProductGroups} from './product-deduplication.mjs';
import {selectCanonicalProducts,productAliasPage} from './product-url-continuity.mjs';

const principal='SEqRg2PsdNDdUJEB4T3W',legacy='YQ2jG9GgNpoRO7ocIocJ';
const link='https://www.mercadolivre.com.br/up/MLBU605239077?pdp_filters=item_id%3AMLB3621404839';
const linkAfiliado='https://meli.la/1wDYX2A';
const a={id:principal,titulo:'Lavadora portátil — duas baterias e maleta anunciadas',link,linkAfiliado,preco:'preservado'};
const b={id:legacy,titulo:'Lavadora Lava Jato Portátil Pressão 2 Baterias + Maleta',link,linkAfiliado,preco:'preservado'};
const select=rows=>selectCanonicalProducts(publicationProductGroups(rows),p=>p.id===legacy?10:1);
test('lavadora mantém ficha revisada e endereço legado sem mutar cadastros',()=>{
 const before=JSON.stringify([a,b]);
 for(const rows of [[a,b],[b,a]]){
  const result=select(rows);
  assert.deepEqual(result.selected.map(p=>p.id),[principal]);
  const target=result.aliases.get(legacy);
  assert.equal(target.id,principal);
  assert.match(productAliasPage(a.titulo,'https://rankingdacompra.com.br/produto/'+target.id+'-20260810-1.html'),/noindex,follow/);
 }
 assert.equal(JSON.stringify([a,b]),before);
});
test('lavadora recusa variantes, títulos ou identidades diferentes',()=>{
 for(const patch of [{id:'desconhecido'},{titulo:'Lavadora portátil uma bateria'},{link:link+'&variation_id=999'},{link:link.replace('MLBU605239077','MLBU12345')},{link:link.replace('MLB3621404839','MLB12345')},{linkAfiliado:'https://meli.la/outro'}]){
  assert.equal(select([a,{...b,...patch}]).selected.length,2);
 }
});
