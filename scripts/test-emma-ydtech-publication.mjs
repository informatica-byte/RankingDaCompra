import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationProductGroups} from './product-deduplication.mjs';
import {selectCanonicalProducts} from './product-url-continuity.mjs';
import {correctProductData} from './product-title-corrections.mjs';
const emma = [
  ['05S6aRd5qQ8i4L37P6qN','Colchão Casal Emma Original 138x188cm'],
  ['3yIHMxCIF9QgqjNOrSXC','Colchão Casal Emma Original 138x188cm 3 Camadas de Espuma, Embalado à Vácuo, Suporte para Coluna, Alta Respirabilidade, Capa Lavável'],
].map(([id,titulo],i)=>({id,titulo,link:'https://www.mercadolivre.com.br/p/MLB18724648?wid=MLB2171368181',linkAfiliado:'https://meli.la/1wxDsG2',preco:String(100+i),historico:'preservado-'+id,score:i?1:999}));
const group=rows=>selectCanonicalProducts(publicationProductGroups(rows),p=>p.score||0);
test('Emma mantém página editorial principal antes e depois da correção, sem mutar cadastros',()=>{
 for(const rows of [emma,emma.map(correctProductData)])for(const ordered of [rows,[...rows].reverse()]){
  const before=JSON.stringify(ordered),r=group(ordered);
  assert.equal(r.selected.length,1);assert.equal(r.selected[0].id,emma[1].id);
  assert.equal(r.aliases.get(emma[0].id).id,emma[1].id);assert.equal(JSON.stringify(ordered),before);
 }
});
test('Emma não aceita outro cadastro, tamanho, anúncio, afiliado ou variação',()=>{
 const [a,b]=emma.map(correctProductData);
 for(const patch of [{id:'outro'},{titulo:b.titulo.replace('138','158')},{link:b.link.replace('MLB2171368181','MLB9999999999')},{linkAfiliado:'https://meli.la/outro'},{link:b.link+'&variation_id=123'}])assert.equal(group([a,{...b,...patch}]).selected.length,2);
});
test('Ydtech reconhece título bruto exato somente no anúncio correto, preservando dados e idempotência',()=>{
 const raw={id:'6kC1jJj7i4kRtYyp3SZr',titulo:'Patinete Elétrico Scooter Dobrável Bluetooth Ydtech',link:'https://www.mercadolivre.com.br/p/MLB62867767?wid=MLB7389762032',linkAfiliado:'https://meli.la/2GHTmfK',preco:'1.190,99',historico:'inalterado'};
 const corrected=correctProductData(raw);
 assert.equal(corrected.titulo,'Patinete Elétrico Ydtech M187 Dobrável com Bluetooth');
 for(const key of ['id','link','linkAfiliado','preco','historico'])assert.equal(corrected[key],raw[key]);
 assert.deepEqual(correctProductData(corrected),corrected);
 for(const patch of [{titulo:raw.titulo+' Outro Modelo'},{link:raw.link.replace('MLB7389762032','MLB9999999999')},{id:'outro'}])assert.equal(correctProductData({...raw,...patch}).titulo,patch.titulo||raw.titulo);
});
