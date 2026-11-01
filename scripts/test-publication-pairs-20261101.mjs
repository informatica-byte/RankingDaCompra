import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicationProductGroups,publicationIdentity,reviewedPublicationVariation,distinctReviewedPublicationVariations,explicitPublicationVariation} from './product-deduplication.mjs';
import {selectCanonicalProducts} from './product-url-continuity.mjs';
import {correctProductData} from './product-title-corrections.mjs';
const rows=JSON.parse(readFileSync(new URL('./fixtures/publication-pairs-20261101.json',import.meta.url),'utf8')).products;
const group=ps=>selectCanonicalProducts(publicationProductGroups(ps),p=>p.score||0);
test('seis cadastros continuam intactos, gerando quatro páginas principais e dois aliases',()=>{
 const ps=rows.map(p=>correctProductData({...p,preco:'preservar',precoConferenciaId:'anterior'})),before=JSON.stringify(ps),r=group(ps);assert.equal(r.selected.length,4);assert.equal(r.aliases.size,2);assert.equal(JSON.stringify(ps),before);
 assert.equal(r.aliases.get('WpCGzZDy0ND4DZmvKbwj').id,'U52A4gBWWLEmfCzONtHb');assert.equal(r.aliases.get('eb6zL5KD6hGwH5SdE6Ua').id,'XRKv9OGoKrBbcDP0GxER');assert.ok(!r.aliases.has(rows[0].id)&&!r.aliases.has(rows[1].id));
});
test('títulos editoriais exatos mantêm prova e a página estabelecida mesmo com pontuação menor',()=>{
 const ps=rows.map(p=>correctProductData({...p,score:['WpCGzZDy0ND4DZmvKbwj','eb6zL5KD6hGwH5SdE6Ua'].includes(p.id)?100:0}));const r=group(ps);assert.equal(r.aliases.get(ps[3].id).id,ps[2].id);assert.equal(r.aliases.get(ps[5].id).id,ps[4].id);
 for(const index of [2,4])for(const patch of [{titulo:ps[index].titulo+' outro modelo'},{linkAfiliado:'https://meli.la/outro'},{link:'https://www.mercadolivre.com.br/p/MLB12345678?wid=MLB9876543210'}])assert.equal(group([{...ps[index],...patch},ps[index+1]]).selected.length,2);
});
test('variações explícitas distintas nunca são unidas, mesmo com título igual ou sem a correção editorial',()=>{
 assert.equal(group(rows.slice(0,2)).selected.length,2);assert.ok(distinctReviewedPublicationVariations(...rows.slice(0,2).map(reviewedPublicationVariation)));
 const p=rows[0];for(const patch of [{id:'nao-revisado'},{titulo:p.titulo+' novo'},{linkAfiliado:'https://meli.la/Outro'},{link:p.link.replace('207161735289','999')},{link:p.link.split('?')[0]},{link:p.link+'#searchVariation=999'}])assert.equal(reviewedPublicationVariation({...p,...patch}),null);
 assert.equal(distinctReviewedPublicationVariations(reviewedPublicationVariation(rows[0]),null),false);assert.equal(distinctReviewedPublicationVariations({id:'forjado',listingId:'MLB5157546240',variationId:'1'},reviewedPublicationVariation(rows[1])),false);
});
test('variação desconhecida ou contraditória não vira prova nem ponte entre grupos',()=>{
 assert.throws(()=>explicitPublicationVariation(rows[0].link+'#variation_id=999'),/ambígua/);assert.throws(()=>explicitPublicationVariation(rows[0].link+'&variation_id=abc'),/ambígua/);assert.equal(publicationIdentity({...rows[0],link:rows[0].link+'#variation_id=999'}),null);
 const p={...rows[0],id:'terceiro',link:rows[0].link.split('?')[0]};assert.equal(group([...rows.slice(0,2),p]).selected.length,3);
});
test('exceção de validação só vale para MLB revisado, mantendo afiliados como colisão e todos os pares anteriores',()=>{
 const source=readFileSync(new URL('./validate-site.mjs',import.meta.url),'utf8');assert.ok(source.includes("identity.startsWith('mlb:')||identity.startsWith('affiliate:')"));assert.ok(source.includes('&&distinctReviewedPublicationVariations(prior.variation,variation)'));assert.ok(source.includes('for(const prior of previous)'));assert.ok(source.includes('Produto duplicado ('));assert.ok(!source.includes('new Set([\'MLB5157546240\'])'));
});
test('Kappa e Aramis são variantes exatas do mesmo anúncio, não permissão genérica para reutilizar afiliado',()=>{
 const families=[['MLB5532075156','https://meli.la/1ipvXiB','Tênis Kappa Pulse Rx Unissex Corrida Conforto',[['CO1tCKBzr6q79BOpdBZW','200557607865'],['d31e9yty1t0dekViXbAi','184470902110'],['mWlmlmg15okWqGyIc5bh','200557607873']]],['MLB4359093019','https://meli.la/2zzQqEV','Tênis Masculino Casual Aramis Daily Slip Confortável Moderno',[['8NEAHWVWDbRD0jFU4YSn','201545712649'],['UqO48Rj9I0f8SpOqabpv','201545712661']]]];
 for(const [listing,affiliate,title,entries]of families){const ps=entries.map(([id,v])=>({id,titulo:title,link:`https://produto.mercadolivre.com.br/MLB-${listing.slice(3)}-produto-_JM?searchVariation=${v}`,linkAfiliado:affiliate}));assert.equal(group(ps).selected.length,ps.length);for(const a of ps)for(const b of ps)assert.equal(distinctReviewedPublicationVariations(reviewedPublicationVariation(a),reviewedPublicationVariation(b)),a.id!==b.id);assert.equal(reviewedPublicationVariation({...ps[0],linkAfiliado:'https://meli.la/outro'}),null);assert.equal(reviewedPublicationVariation({...ps[0],id:'novo'}),null);}
});
