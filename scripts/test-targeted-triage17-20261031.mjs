import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData} from './product-title-corrections.mjs';
import {reviewedProduct} from './fixtures/reviewed-marketplace-products.mjs';
const samples=[['avV2oOE8xcX9ioG4GNnT','Bicicleta Aro 29 Gts Alumínio Rdx 24v'],['eWSvbRDlCUBkWhNx5s6T','Bicicleta Aro 29 Gts Dexter 24 Marchas'],['YOLXINIYLDE2vnlgq8aR','Bicicleta Aro 29 Gts Alumunio Lavy Câmbio Shimano'],['qSwfFcX2XaFU4QLIb8bN','Bicicleta Elétrica Scooter 500w Bikelete Smart MT2']];
test('título promocional antigo não vira frase cortada nem comprovação de modelo/autenticidade',()=>{
 const raw={id:'hYk6ccUgsn1KL36RxXrY',titulo:'Tênis On Running Cloud Leve Academia Promoção -70% Off',preco:'209,76',link:'https://meli.la/preservado'};
 const p=correctProductData(raw);assert.doesNotMatch(p.titulo,/70%|promoção|off/i);assert.match(p.titulo,/modelo exato a confirmar/);assert.equal(p.link,raw.link);assert.equal(p.preco,raw.preco);assert.deepEqual(correctProductData(p),p);
 assert.equal(correctProductData({...raw,titulo:'Capa para '+raw.titulo}).titulo,'Capa para '+raw.titulo);
});
test('triagem 17 preserva dados protegidos, aplica guardas e não escolhe bateria divergente',()=>{
 for(const [id,titulo] of samples){const raw={id,titulo,link:'https://meli.la/preservado',preco:'123,45',categoria:'casa'};const p=correctProductData(raw);assert.equal(p.preco,raw.preco);assert.equal(p.link,raw.link);assert.deepEqual(correctProductData(p),p);assert.equal(correctProductData({...raw,titulo:'Produto de outro tipo'}).categoria,'casa');}
 const mt=correctProductData({id:samples[3][0],titulo:samples[3][1]});assert.match(mt.titulo,/bateria a confirmar/);assert.match(mt.comentario,/15 Ah.*12 Ah/);assert.match(mt.comentario,/não escolhemos um dos valores nem calculamos autonomia/);
 for(const [id,titulo] of samples.slice(0,2))assert.equal(correctProductData({id,titulo,categoria:'casa'}).categoria,'bicicletas');
 for(const [id,titulo] of samples){const accessory={id,titulo:'Capa para '+titulo,categoria:'casa'};assert.equal(correctProductData(accessory).titulo,accessory.titulo);assert.equal(correctProductData(accessory).categoria,'casa');}
});
test('Basike muda só o título da revisão de campos; não refaz análise nem inventa ANC',()=>{
 const raw=reviewedProduct('xUz3eJJ8CDLhc5sW47BB'),p=correctProductData(raw);
 assert.match(p.titulo,/Bluetooth 5\.4 anunciado/);assert.match(p.titulo,/formato a confirmar/);
 assert.match(p.comentario,/não confirma ANC/);assert.equal(p.preco,raw.preco);
 assert.deepEqual(correctProductData(p),p);
 const accessory={...raw,titulo:'Capa para '+raw.titulo};assert.equal(correctProductData(accessory).titulo,accessory.titulo);
});
test('duas categorias e três textos estão consistentes nas páginas e na busca, mantendo 98 análises',async()=>{
 const get=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
 const c=await get('informational-catalogue.json'),s=await get('search-index.json');
 assert.equal(c.products.filter(x=>x.decisionBrief?.reviewed).length,98);
 for(const id of ['xUz3eJJ8CDLhc5sW47BB',...samples.map(x=>x[0])]){
  const p=c.products.find(x=>x.id===id),h=await readFile(new URL('../produto/'+id+'-20260810-1.html',import.meta.url),'utf8');
  const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  if(samples.slice(0,2).some(x=>x[0]===id)){
   assert.equal(p.categoryId,'bicicletas');assert.equal(p.category,'Bicicletas');assert.match(h,/<span>Categoria<\/span>Bicicletas/);
   assert.equal(nodes.find(x=>x['@type']==='BreadcrumbList').itemListElement.find(x=>x.position===2).name,'Bicicletas');
  }else {assert.equal(nodes.find(x=>x['@type']==='Article').description,s.products.find(x=>x.id===id).summary);}
  if(id==='xUz3eJJ8CDLhc5sW47BB'||id===samples[3][0])assert.equal(nodes.find(x=>x['@type']==='Article').about.name,p.title);
 }
});
