import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationProductGroups} from './product-deduplication.mjs';
import {selectCanonicalProducts} from './product-url-continuity.mjs';
import {correctProductData} from './product-title-corrections.mjs';

const main='pGWith3ABAHWNTRZG3fM', legacy='0ZlMlzbCo5Rh41J5oUjj', other='UqiDgQqIGUW5AWzaZg8i';
const title='PENTA MAGNÉSIO - Bisglicinato + Dimalato + Citrato + Taurato + Óxido de Magnésio - A Combinação Perfeita de 5 Magnésios com Máxima Pureza e Biodisponibilidade - 60 Cápsulas';
const link='https://www.mercadolivre.com.br/p/MLB61669343?pdp_filters=item_id%3AMLB4291609113';
const row=id=>({id,titulo:title,link,linkAfiliado:'https://meli.la/2KKtanb',preco:'preservado'});
const select=rows=>selectCanonicalProducts(publicationProductGroups(rows),p=>p.id===legacy?100:1);

test('Penta Magnésio keeps the current reviewed canonical and the other address without modifying records',()=>{
 const raw=[row(main),row(legacy),row(other)], saved=JSON.stringify(raw);
 const edited=raw.map(correctProductData);
 assert.notEqual(edited[0].titulo,edited[1].titulo);
 for(const rows of [raw,edited,[...edited].reverse()]){
  const result=select(rows);
  assert.deepEqual(result.selected.map(p=>p.id),[main]);
  assert.equal(result.aliases.get(legacy).id,main);
  assert.equal(result.aliases.get(other).id,main);
  assert.ok(rows.every(p=>p.preco==='preservado'&&p.linkAfiliado==='https://meli.la/2KKtanb'));
 }
 assert.equal(JSON.stringify(raw),saved);
});

test('Penta Magnésio keeps changed variants, listings, affiliate links and unknown records separate',()=>{
 for(const patch of [
  {titulo:'Penta Magnésio 120 cápsulas'}, {id:'outro'},
  {link:link+'&variation_id=123'}, {link:link+'&variation_id=123&variation_id=456'},
  {link:link.replace('MLB4291609113','MLB1234567890')},
  {link:link.replace('MLB61669343','MLB12345678')},
  {linkAfiliado:'https://meli.la/outro'}
 ]) assert.equal(select([correctProductData(row(main)),{...row(legacy),...patch}]).selected.length,2);
});
