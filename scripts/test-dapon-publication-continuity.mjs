import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicationProductGroups,publicationIdentity} from './product-deduplication.mjs';
import {selectCanonicalProducts,productAliasPage} from './product-url-continuity.mjs';
import {correctProductData} from './product-title-corrections.mjs';
const ids=['NJipazuMXMzOH9YZbxwu','JuHTAByi0pSeuxzlBCy4'];
const title='Fone De Ouvido Headphone Dapon H02D Bluetooth 5.1 Over-ear 22h Preto';
const rows=ids.map((id,i)=>({id,titulo:title,link:'https://www.mercadolivre.com.br/p/MLB24117280?pdp_filters=item_id%3AMLB4587377807'+(i?'&attributes=COLOR%3AMLB24117280':''),linkAfiliado:'https://meli.la/2K1ekie',preco:i?'outro valor salvo':'valor principal salvo',precoConferenciaId:'preservar-'+id,score:i?999:1}));
const group=ps=>selectCanonicalProducts(publicationProductGroups(ps),p=>p.score||0);
test('Dapon bruto e título editorial geram a mesma página principal sem mutar registros',()=>{
 for(const ps of [rows,rows.map(correctProductData)])for(const ordered of [ps,[...ps].reverse()]){const before=JSON.stringify(ordered),r=group(ordered);assert.equal(r.selected.length,1);assert.equal(r.selected[0].id,ids[0]);assert.equal(r.aliases.get(ids[1]).id,ids[0]);assert.equal(JSON.stringify(ordered),before);}
});
test('Dapon exige os IDs e título exatos, catálogo anúncio e afiliado comprovados',()=>{
 const [canonical,old]=rows.map(correctProductData);for(const patch of [{id:'outro-id'},{titulo:'Dapon H02D outra edição'},{linkAfiliado:'https://meli.la/outro'},{link:old.link.replace('MLB4587377807','MLB9999999999')},{link:old.link.replace('MLB24117280','MLB99999999')},{link:'https://produto.mercadolivre.com.br/MLB-4587377807-_JM'}]){const changed={...old,...patch};assert.ok(!publicationIdentity(changed)?.reviewed);assert.equal(group([canonical,changed]).selected.length,2);}
});
test('variação distinta ou ambígua não vira Dapon principal nem ponte por terceiro cadastro',()=>{
 const [a,b]=rows.map(correctProductData);for(const link of [b.link+'&searchVariation=123',b.link+'&searchVariation=123#variation_id=456'])assert.equal(group([a,{...b,link}]).selected.length,2);
 // A third record with an identical explicit listing/title may use the existing
 // generic rule, but cannot bridge the differently titled reviewed record.
 const third={...b,id:'terceiro',titulo:a.titulo};for(const ps of [[a,b,third],[third,b,a],[b,third,a]]){const groups=publicationProductGroups(ps);assert.equal(groups.length,2);assert.ok(groups.every(g=>!(g.products.some(p=>p.id===ids[1])&&g.products.some(p=>p.id==='terceiro'))));}
});
test('endereço antigo do Dapon mantém alias para a página principal, não para vitrine ou outro produto',async()=>{
 const alias=productAliasPage('Dapon H02D','https://rankingdacompra.com.br/produto/'+ids[0]+'-20260810-1.html');assert.match(alias,/noindex,follow/);assert.ok(alias.includes('/produto/'+ids[0]+'-20260810-1.html'));
 const current=await readFile(new URL('../produto/'+ids[1]+'-20260810-1.html',import.meta.url),'utf8');assert.match(current,/noindex,follow/);assert.ok(current.includes('/produto/'+ids[0]+'-20260810-1.html'));
});
test('terceiro cadastro comprovado permanece alias da mesma página; registro desconhecido continua separado',()=>{
 const third={...rows[1],id:'Y6Ty2gcU1ktmmGyznDWs',link:'https://www.mercadolivre.com.br/p/MLB24117280#wid=MLB4587377807'};
 for(const ps of [[third,...rows],[...rows,third],[rows[1],third,rows[0]]]){const before=JSON.stringify(ps),r=group(ps.map(correctProductData));assert.equal(r.selected.length,1);assert.equal(r.selected[0].id,ids[0]);assert.equal(r.aliases.size,2);assert.equal(r.aliases.get(third.id).id,ids[0]);assert.equal(JSON.stringify(ps),before);}
 for(const patch of [{id:'desconhecido'},{linkAfiliado:'https://meli.la/Outro'},{titulo:'Dapon outro modelo'},{link:third.link+'&variation_id=999'}])assert.equal(group([correctProductData(rows[0]),{...third,...patch}]).selected.length,2);
});
