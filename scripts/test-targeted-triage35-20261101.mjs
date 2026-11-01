import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence,headingForCorrection} from './product-title-corrections.mjs';
import {MARKETPLACE_FIELD_REVIEWS} from './marketplace-field-reviews.mjs';
import {documentedSpecifications} from './manufacturer-specifications.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
import {parseReleaseBatches,combinedEditorialManifest,assertTitleAndNeutralFamilyChange} from './editorial-release-plan.mjs';
const rows=[
 {id:'cjtpmssewHcTpdqJlbS6',titulo:'Positivo Vision TAB10 T3010 4GB RAM 128GB SSD com Capa Teclado'},
 {id:'DlFv98xnrCPIAeFfbRFv',titulo:'Fone Ouvido Bluetooth 5.3 Marca Pro Phone See'},
 {id:'FWRyLtto1bKeKurNikKq',titulo:'FORESTORY Fone Bluetooth 5.4 X5 Open Ear Grave Potente'},
 {id:'mlMLB5212483469',titulo:'Notebook Lenovo Ideapad Slim 3 15irh10 i5-13420h 8gb 256gb Ssd 83ns0003br'}
];
test('triagem 35 não muda preços, identidade ou afiliado e não aplica a capa ou outro anúncio',()=>{
 for(const raw of rows){const p={...raw,preco:'123,45',link:undefined,linkAfiliado:'https://meli.la/preservado',cor:'original',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of ['id','preco','link','linkAfiliado','cor','precoConferenciaId'])assert.equal(x[k],p[k]);assert.ok(x.titulo.length<=100);assert.deepEqual(correctProductData(x),x);assert.equal(correctProductData({...p,titulo:'Capa para '+raw.titulo}).titulo,'Capa para '+raw.titulo);}
 for(const raw of rows.slice(1)){const p={...raw,link:'https://www.mercadolivre.com.br/p/MLB99999999?pdp_filters=item_id%3AMLB9999999999'};assert.equal(correctProductData(p).titulo,p.titulo);}
});
test('tablet distingue armazenamento NAND de SSD sem prometer bateria ou desempenho',()=>{
 const x=correctProductData(rows[0]);assert.doesNotMatch(x.titulo,/SSD|6000|octa|garant/i);assert.match(x.comentario,/não tratamos os 128 GB como um SSD/);assert.match(x.comentario,/não garantia de velocidade ou horas de uso/);assert.equal(manufacturerEvidence(x),null);
});
test('títulos dos dois fones ficam coerentes sem refazer corpo e tabela anteriores',()=>{
 for(const raw of rows.slice(1,3)){const x=correctProductData(raw),r=MARKETPLACE_FIELD_REVIEWS.get(raw.id);assert.equal(x.comentario,r.summary);assert.equal(x.pros,r.positiveNotes.join('\n'));assert.equal(x.contras,r.negativeNotes.join('\n'));assert.doesNotMatch(x.titulo,/prova.*água|open.?ear|grave potente|gancho/i);}
 assert.match(correctProductData(rows[1]).titulo,/5\.4 anunciado/);assert.match(correctProductData(rows[2]).titulo,/5\.3, formato e autonomia a confirmar/);
});
test('IdeaPad não herda descrição ThinkPad nem a configuração 83NS0002BR',()=>{
 const x=correctProductData(rows[3]);assert.match(x.comentario,/descrição antiga falava de um ThinkPad/);assert.match(x.comentario,/não foram combinados/);assert.match(x.comentario,/não autentica a unidade/);assert.doesNotMatch(x.pros,/16 GB|10310U|recondicionado|512 GB/);assert.match(documentedSpecifications(x).features.find(f=>f.label==='Armazenamento SSD').value,/^256 GB/);
});
test('catálogo, busca e Article coerentes e 98 análises profundas preservadas',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 for(const raw of rows){const p=c.products.find(p=>p.id===raw.id);assert.equal(p.title,correctProductData(raw).titulo);const h=await readFile(new URL('../produto/'+p.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});const a=nodes.find(n=>n['@type']==='Article');assert.equal(a.about.name,p.title);assert.equal(a.description,s.products.find(x=>x.id===raw.id).summary);}
});
test('liberação conjunta conserva guardas e recusa ID repetido ou ordem inválida',()=>{
 assert.deepEqual(parseReleaseBatches('34,35'),[34,35]);assert.deepEqual(parseReleaseBatches('31'),[31]);for(const value of ['35,34','34,34','../34','0',''])assert.throws(()=>parseReleaseBatches(value));
 assert.deepEqual(combinedEditorialManifest([{items:[{id:'a'}],preserveExceptTitleIds:['a']},{items:[{id:'b'}]}]),{items:[{id:'a'},{id:'b'}],preserveExceptTitleIds:['a'],preserveExceptTitleAndNeutralFamilyIds:[]});assert.throws(()=>combinedEditorialManifest([{items:[{id:'a'}]},{items:[{id:'a'}]}]));
});
test('neutralizar família ambígua preserva todas as características e não permite promoção para outro formato',()=>{
 const before={id:'same',title:'Old',summary:'Preserved',comparison:{family:'fone-tws',features:[{label:'Formato',state:'unknown'}]}};const after={...before,title:'New',comparison:{...before.comparison,family:'fone'}};
 assertTitleAndNeutralFamilyChange(before,after);assert.throws(()=>assertTitleAndNeutralFamilyChange(before,{...after,summary:'Changed'}));assert.throws(()=>assertTitleAndNeutralFamilyChange(before,{...after,comparison:{...after.comparison,family:'headset'}}));
});
test('cabeçalho truncado só usa nome principal coerente, nunca produto relacionado ou acessório',()=>{
 const full='Fone Ouvido Bluetooth 5.3 Sem Fio Marca Pro Phone See',model=/pro phone see/i;
 const doc=(h,name)=>'<h1>'+h+'</h1><script type="application/ld+json">'+JSON.stringify({'@type':'Article',about:{'@type':'Thing',name}})+'</script>';
 assert.equal(headingForCorrection(doc('Fone Ouvido Bluetooth 5.3…',full),model),full);
 assert.equal(headingForCorrection(doc('Outro produto…',full),model),'Outro produto…');
 assert.equal(headingForCorrection(doc('Capa para Fone…',full),model),'Capa para Fone…');
 assert.equal(headingForCorrection(doc('Fone Ouvido Bluetooth 5.3',full),model),'Fone Ouvido Bluetooth 5.3');
 assert.equal(headingForCorrection('<h1>Fone Ouvido…</h1><script type="application/ld+json">{invalid</script>',model),'Fone Ouvido…');
});
