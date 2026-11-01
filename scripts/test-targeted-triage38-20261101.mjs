import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const rows=[
 {id:'5Kojn8DcrLoydOBjq4vd',titulo:'Fogareiro Portátil Usd Camping Acendimento Automático Com Maleta'},
 {id:'CEVlNR7lM1QTwgcn0tRu',titulo:'Jogo Banco Imobiliário - Brasil - Brinquedos Estrela'},
 {id:'CFEyN1hdeMSM6BS89h5o',titulo:'Creatina Monohidratada em Pote 300g 100% Pura Dark Lab'}
];
test('triagem 38 preserva identidade, preços e links e recusa aplicar ficha a acessórios',()=>{
 for(const raw of rows){const p={...raw,preco:'123,45',linkAfiliado:'https://meli.la/preservado',cor:'original',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of ['id','preco','linkAfiliado','cor','precoConferenciaId'])assert.equal(x[k],p[k]);assert.ok(x.titulo.length<=100);assert.deepEqual(correctProductData(x),x);assert.equal(manufacturerEvidence(x),null);assert.equal(correctProductData({...p,titulo:'Capa para '+p.titulo}).titulo,'Capa para '+p.titulo);}
 for(const raw of rows.slice(1)){const p={...raw,comentario:'preservar',link:'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB9999999999'};assert.equal(correctProductData(p).comentario,'preservar');assert.equal(correctProductData(p).titulo,p.titulo);}
});
test('fogareiro não ganha certificação, cartucho universal ou garantia de segurança',()=>{
 const x=correctProductData(rows[0]);assert.match(x.comentario,/informações do anúncio, não resultados de teste/);assert.match(x.comentario,/não comprova segurança/);assert.match(x.contras,/cartucho compatível.*confirmação/);assert.doesNotMatch(x.pros,/seguro|segurança|resistente|excelente|ideal|certificad/i);assert.doesNotMatch(x.comentario,/\d+\s*(?:g\/h|BTU|kW)|EN\s*417|MSF[-\s]*1/i);
});
test('Banco Imobiliário não inventa edição, idade, jogadores ou ganhos de aprendizagem',()=>{
 const x=correctProductData(rows[1]);assert.equal(x.titulo,rows[1].titulo);assert.match(x.comentario,/não comprova melhoria/);assert.match(x.comentario,/Não transferimos.*outra edição/);assert.doesNotMatch(x.pros,/estimula|melhora|garant|\d.*anos|\d.*jogadores/i);
});
test('Dark Lab só corrige título de pureza e remove frase legada sobre preços',()=>{
 const oldSummary='O anúncio identifica creatina monohidratada Dark Lab em pote de 300 g. Confira fabricante, lote, lacre, ingredientes e procedência na embalagem recebida. Esta revisão não verificou laudos laboratoriais, percentuais de pureza nem autenticidade do lote; não usamos esses números como motivo de recomendação. Não há garantia de ganho de força ou desempenho e esta página não substitui orientação profissional. O preço válido é o exibido com a data de conferência, não uma cotação fixa no texto.';
 assert.equal(correctProductData(rows[2]).comentario,oldSummary.replace(' O preço válido é o exibido com a data de conferência, não uma cotação fixa no texto.',''));
 const x=correctProductData(rows[2]);assert.match(x.titulo,/pureza do lote não verificada/);assert.doesNotMatch(x.comentario,/preço|cotação|dose|recomendamos/i);assert.match(x.comentario,/não verificou laudos/);assert.equal(x.pros,'Embalagem de 300 g identificada no cadastro; confirme a unidade oferecida.');
});
test('catálogo, busca e Article coerentes sem ampliar 98 análises profundas',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 for(const raw of rows){const p=c.products.find(p=>p.id===raw.id);assert.equal(p.title,correctProductData(raw).titulo);const h=await readFile(new URL('../produto/'+p.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});const a=nodes.find(n=>n['@type']==='Article');assert.equal(a.about.name,p.title);assert.equal(a.description,s.products.find(x=>x.id===raw.id).summary);}
});
