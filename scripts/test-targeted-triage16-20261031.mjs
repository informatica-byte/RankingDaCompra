import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
const samples=[['qAkENABz4tpPjLGpyPEw','Balança Digital Bioimpedância Bluetooth Corporal'],['QqhF1Rgq1LcKQMhFr50j','Banco Bike Selim Grande Para Bicicleta Super Comfort'],['ICxKGrUEwJIcuNHBKQ6z','Barra de Som ULTIMEA Poseidon R3T 2.1 240W Subwoofer Sem Fio'],['LGW7J8fPa6f2lwsNDYOM','Barraca 3 Em 1 Túnel Menino Foguete Azul Toca Tenda Infantil'],['GpoXj5YCjA93hBDg5L0v','Barraca Para Até 4 Pessoas Camping Iglu Homefy']];
test('triagem 16 mantém identidade, preços, afiliados e guardas de modelo',()=>{
 for(const [id,titulo] of samples){
  const raw={id,titulo,link:'https://meli.la/preservado',preco:'123,45'};
  const p=correctProductData(raw);assert.equal(p.link,raw.link);assert.equal(p.preco,raw.preco);
  if(id==='QqhF1Rgq1LcKQMhFr50j'){assert.match(p.titulo,/^Selim para bicicleta.*medidas a confirmar$/);assert.ok(p.titulo.length<=100);}else assert.equal(p.titulo,titulo);
  assert.equal(manufacturerEvidence(raw),null);assert.deepEqual(correctProductData(p),p);
  assert.equal(correctProductData({...raw,titulo:'Outro tipo de produto'}).comentario,'');
 }
});
test('triagem 16 retira garantias sem inventar medidas, faixa etária ou testes',()=>{
 const p=samples.map(([id,titulo])=>correctProductData({id,titulo}));
 assert.match(p[0].comentario,/não são conclusões comprovadas/);
 assert.match(p[1].comentario,/não presumimos uma unidade ou medida corrigida/);
 assert.match(p[2].comentario,/nem permite garantir posicionamento em qualquer ponto/);
 assert.match(p[3].comentario,/não confirmam faixa etária nem conteúdo/);
 assert.match(p[4].comentario,/não é usada nesta ficha para garantir proteção contra chuva/);
});
test('cinco correções da triagem 16 estão alinhadas em busca e dados estruturados, sem elevar 98 análises',async()=>{
 const get=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
 const c=await get('informational-catalogue.json'),s=await get('search-index.json');
 assert.equal(c.products.filter(x=>x.decisionBrief?.reviewed).length,98);
 for(const [id] of samples){
  const h=await readFile(new URL('../produto/'+id+'-20260810-1.html',import.meta.url),'utf8');
  const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});
  assert.equal(nodes.find(x=>x['@type']==='Article').description,s.products.find(x=>x.id===id).summary);
  assert.equal(c.products.find(x=>x.id===id).decisionBrief.reviewed,false);
 }
});
