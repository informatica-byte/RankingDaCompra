import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const records=[
 {id:'mlMLB4222763449',titulo:'Sanduicheira Inox Multiuso Oster Preto/inox'},
 {id:'mlMLB5259893582',titulo:'Complexo B Ultra Vegano Em Gotas | 30ml | Sabor Frutas Amarelas | Bigens'},
 {id:'4qfOr9o2qNFtHLcRZzRC',titulo:'Lixeira Inteligente Automática Redonda Recarregável USB‐C Sensor para Cozinha Banheiro Escritório'},
];
test('triagem 23 corrige somente identidades previstas e preserva dados operacionais',()=>{
 for(const record of records){const p={...record,preco:'123,45',precoAnterior:'155,00',link:'https://meli.la/inalterado',ofertaRelampagoAtiva:false};const result=correctProductData(p);for(const key of ['id','titulo','preco','precoAnterior','link','ofertaRelampagoAtiva'])assert.equal(result[key],p[key]);assert.deepEqual(correctProductData(result),result);assert.equal(manufacturerEvidence(p),null);assert.equal(correctProductData({...p,titulo:'Outro produto sem identidade correspondente'}).comentario,'');}
});
test('sem modelo elétrico presumido, benefício terapêutico ou escolha arbitrária de litros',()=>{
 const [oster,bigens,bin]=records.map(correctProductData);
 assert.match(oster.comentario,/não confirma a versão elétrica/);assert.doesNotMatch(oster.pros,/1000|127|220|resistente|carnes|legumes/);
 assert.match(bigens.comentario,/não orientamos dose/);assert.doesNotMatch(bigens.pros,/absorção|energia|imuno|mental|tratamento/);
 assert.match(bin.comentario,/capacidade permanece a confirmar/);assert.doesNotMatch(bin.pros,/15|16|30 cm/);
});
test('três correções alinhadas em busca e Article, sem ampliar análises profundas',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));
 const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 for(const record of records){const p=c.products.find(p=>p.id===record.id);assert.equal(p.decisionBrief.reviewed,false);const html=await readFile(new URL('../produto/'+record.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});assert.equal(nodes.find(n=>n['@type']==='Article').about.name,p.title);assert.equal(s.products.find(p=>p.id===record.id).summary,nodes.find(n=>n['@type']==='Article').description);}
});
test('publicação editorial não autentica nem lê Firestore e mantém trava e validadores',async()=>{
 const w=await readFile(new URL('../.github/workflows/update-sitemap.yml',import.meta.url),'utf8');
 assert.match(w,/if: \$\{\{ !\(github.event_name == 'push' && contains\(github.event.head_commit.message, '\[editorial-local\]'\)\) \}\}/);
 const branch=w.slice(w.indexOf('if [[ "$EDITORIAL_LOCAL"'),w.indexOf('generated=false'));
 assert.match(branch,/PRESERVE_PUBLISHED_PRICES/);assert.match(branch,/exit 1/);assert.match(branch,/assertCurrentProductIdentities/);assert.doesNotMatch(branch,/node scripts\/generate-sitemap/);
 assert.match(w,/DISCOVERY_USE_GENERATED=true node scripts\/generate-discovery.mjs/);assert.match(w,/node --test scripts\/test-\*\.mjs/);assert.match(w,/node scripts\/validate-site.mjs/);
});
