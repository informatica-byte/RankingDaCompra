import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const records=[
 {id:'7QHXFlimzdpfKr7yfo0T',titulo:'Tênis Feminino Olimp Para Caminhada Academia Promoção'},
 {id:'8a8Iat0nPiQxNPVcJqTU',titulo:'Tênis Reserva Masculino Casual Cano Baixo Antiderrapante'},
 {id:'iw5yKjD39u1kQ8Vm8ybv',titulo:'Carregador Turbo 200w Usb-c Compatível Xiaomi Samsung Bivolt'},
];
test('triagem 24 preserva identidade, preço, afiliado, variante e idempotência',()=>{
 for(const record of records){const p={...record,preco:'123,45',precoAnterior:'180',link:'https://meli.la/preservado',voltagem:'220 V',precoConferenciaId:'anterior'};const result=correctProductData(p);for(const key of ['id','preco','precoAnterior','link','voltagem','precoConferenciaId'])assert.equal(result[key],p[key]);assert.ok(result.titulo.length<=100);assert.deepEqual(correctProductData(result),result);assert.equal(manufacturerEvidence(result),null);assert.equal(correctProductData({...p,titulo:'Capa para '+p.titulo}).comentario,'');}
});
test('títulos e vantagens não garantem promoção, aderência, potência ou compatibilidade',()=>{
 const [olimp,reserva,charger]=records.map(correctProductData);
 assert.doesNotMatch(olimp.titulo,/promoção|olympikus/i);assert.match(olimp.comentario,/campo de marca informa Vili/);
 assert.doesNotMatch(reserva.titulo,/antiderrapante/i);assert.doesNotMatch(reserva.pros,/antiderrapante|proteção|conforto/i);
 assert.match(charger.titulo,/potência a confirmar/);assert.doesNotMatch(charger.pros,/200|Xiaomi|Samsung|garant/i);assert.match(charger.comentario,/não garantimos 200 W/);
});
test('três títulos e resumos coerentes no catálogo, busca e Article; 98 análises preservadas',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));
 const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 for(const raw of records){const p=c.products.find(p=>p.id===raw.id),expected=correctProductData(raw);assert.equal(p.title,expected.titulo);assert.equal(p.decisionBrief.reviewed,false);const html=await readFile(new URL('../produto/'+raw.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});assert.equal(nodes.find(n=>n['@type']==='Article').about.name,p.title);assert.equal(nodes.find(n=>n['@type']==='Article').description,s.products.find(x=>x.id===raw.id).summary);}
});
