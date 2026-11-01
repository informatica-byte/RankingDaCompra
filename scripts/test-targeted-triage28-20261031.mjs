import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const records=[
 {id:'28xGyV66fEYlx6CnRxIq',titulo:'Vara De Pesca Completo 180m Carretilha E Linhaacessorios Cor Verde'},
 {id:'7W5TZBLUNQOGfenrgEtg',titulo:'Kit Body Splash Masculino 3un 200ml Perfume De Luxo For Men'},
];
test('triagem 28 conserva dados operacionais, cor, afiliados e não aplica a acessórios',()=>{
 for(const raw of records){const p={...raw,preco:'123,45',precoAnterior:'180',link:'https://meli.la/preservado',cor:'Verde',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of ['id','preco','precoAnterior','link','cor','precoConferenciaId'])assert.equal(x[k],p[k]);assert.ok(x.titulo.length<=100);assert.deepEqual(correctProductData(x),x);assert.equal(manufacturerEvidence(x),null);assert.equal(correctProductData({...p,titulo:'Capa para '+p.titulo}).titulo,'Capa para '+p.titulo);}
});
test('não escolhe medida da vara ou volume do kit por suposição',()=>{
 const [fishing,splash]=records.map(correctProductData);assert.doesNotMatch(fishing.titulo,/180|1[,.]80/);assert.doesNotMatch(fishing.pros,/carbono|cerâmica|leve|resistência/i);assert.match(fishing.comentario,/nem escolhemos 1,80 m por suposição/);
 assert.doesNotMatch(splash.titulo,/600|200|3un|luxo/i);assert.doesNotMatch(splash.pros,/vegano|crueldade|fixação|certifica/i);assert.match(splash.comentario,/Não assumimos que esse campo represente o total/);
});
test('dois títulos e resumos coerentes em catálogo, busca e Article sem novas análises profundas',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 for(const raw of records){const p=c.products.find(x=>x.id===raw.id);assert.equal(p.title,correctProductData(raw).titulo);const h=await readFile(new URL('../produto/'+raw.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});assert.equal(nodes.find(x=>x['@type']==='Article').about.name,p.title);assert.equal(nodes.find(x=>x['@type']==='Article').description,s.products.find(x=>x.id===raw.id).summary);assert.equal(p.decisionBrief.reviewed,false);}
});
