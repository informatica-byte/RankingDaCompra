import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {MARKETPLACE_FIELD_REVIEWS} from './marketplace-field-reviews.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
import {comparisonData} from './product-decision.mjs';
const rows=[
 {id:'XRKv9OGoKrBbcDP0GxER',titulo:"Kit 2 Refletor Super Led 400w Ip67 Holofote Bivolt Prova D'água Branco Frio 6500k Preto"},
 {id:'z507ObVuMlSEBSnK40Uc',titulo:'Fone de Ouvido Bluetooth 5.3 Tws Sem Fio Esportivo Compatível Com iPhone Samsung Xiaomi Motorola Com Gancho Premium KAPBOM Preto'},
 {id:'1tIzUpXs4udqZOZwpQX7',titulo:'Headset Com Fio Hxz-b39 Fone De Ouvido Headset Gamer Bege Preto'},
 {id:'51cYaPGtvus2ayLrbFwH',titulo:'Kit Starlink MINI Internet Via Satélite'}
];
test('triagem 37 preserva identidade, preços e afiliados e recusa outra oferta e acessórios',()=>{
 for(const raw of rows){const p={...raw,preco:'123,45',linkAfiliado:'https://meli.la/preservado',cor:'original',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of ['id','preco','linkAfiliado','cor','precoConferenciaId'])assert.equal(x[k],p[k]);assert.ok(x.titulo.length<=100);assert.deepEqual(correctProductData(x),x);assert.equal(manufacturerEvidence(x),null);assert.equal(correctProductData({...p,titulo:'Capa para '+p.titulo}).titulo,'Capa para '+p.titulo);const other={...p,link:'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB9999999999'};assert.equal(correctProductData(other).titulo,other.titulo);assert.equal(correctProductData({...other,comentario:'preservar'}).comentario,'preservar');}
});
test('refletores não viram potência por unidade ou certificação confirmadas',()=>{
 const x=correctProductData(rows[0]);assert.match(x.titulo,/IP67 anunciados/);assert.match(x.comentario,/não há documentação/);assert.match(x.comentario,/cada refletor ou ao conjunto/);assert.match(x.comentario,/não uma certificação verificada/);assert.doesNotMatch(x.pros,/400 W|certificad|ilumina.*\d|prova.*água/i);
});
test('KAPBOM e HXZ-B39 só ajustam título sem refazer fatos ou resolver contradições por inferência',()=>{
 for(const raw of rows.slice(1,3)){const x=correctProductData(raw),r=MARKETPLACE_FIELD_REVIEWS.get(raw.id);assert.equal(x.comentario,r.summary);assert.equal(x.pros,r.positiveNotes.join('\n'));assert.equal(x.contras,r.negativeNotes.join('\n'));assert.match(x.titulo,/divergente no anúncio/);assert.doesNotMatch(x.titulo,/premium|gamer|compatível|Bluetooth 5\.3/i);}
 assert.equal(comparisonData(correctProductData(rows[1])).family,'fone-tws');
 assert.equal(comparisonData(correctProductData(rows[2])).family,'headset');
});
test('Starlink deixa de garantir estabilidade, plano ou ativação da unidade',()=>{
 const x=correctProductData(rows[3]);assert.equal(x.titulo,rows[3].titulo);assert.match(x.comentario,/Não garantimos conexão estável/);assert.match(x.comentario,/não comprova serviço disponível/);assert.match(x.contras,/ativação.*confirmação/);assert.doesNotMatch(x.pros,/alta performance|garante|ilimitad|Mbps|plano incluso/i);
});
test('quatro páginas, catálogo, busca e Article mantêm coerência e 98 análises profundas',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 for(const raw of rows){const p=c.products.find(p=>p.id===raw.id);assert.equal(p.title,correctProductData(raw).titulo);const h=await readFile(new URL('../produto/'+p.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});const a=nodes.find(n=>n['@type']==='Article');assert.equal(a.about.name,p.title);assert.equal(a.description,s.products.find(x=>x.id===raw.id).summary);}
});
