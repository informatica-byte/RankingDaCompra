import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
const samples=[['u8AujPhW3B7Z3N0aF6VS','Cadeira Dobrável Camping Pesca com Porta Copo Resistente até 120kg'],['eJn1Xl8uCPLxKCObXB6r','Caixa De Som Basike Ba-RAD207 80W Rádio FM Bluetooth 5.3 TWS RGB Bass Boost 9000mAh'],['XWXtgVSsCBCwOtcMCdO3','Caixa De Som Bluetooth Jbl Go 5 Amarela'],['vEHXKQ4q4UbcFfjPhtTa','Caixa de som Boombox Philco Extreme Bluetooth V.5.4 300W PBX01']];
test('triagem 21 preserva preços/afiliados, rejeita acessórios e outra geração de JBL',()=>{
 for(const [id,titulo] of samples){const raw={id,titulo,preco:'100,00',link:'https://meli.la/preservado'};const p=correctProductData(raw);assert.equal(p.preco,raw.preco);assert.equal(p.link,raw.link);assert.equal(manufacturerEvidence(raw),null);assert.ok(p.titulo.length<=100);assert.deepEqual(correctProductData(p),p);const accessory={...raw,titulo:'Capa para '+titulo};assert.equal(correctProductData(accessory).titulo,accessory.titulo);}
 const other={id:samples[2][0],titulo:samples[2][1].replace('Go 5','Go 4')};assert.equal(correctProductData(other).comentario,'');
});
test('triagem 21 não escolhe carga por imagem, converte mAh em horas ou inventa potência/Go 5',()=>{
 const p=samples.map(([id,titulo])=>correctProductData({id,titulo}));assert.match(p[0].titulo,/carga a confirmar/);assert.doesNotMatch(p[0].comentario,/150 kg/);assert.match(p[1].comentario,/não foi convertida em horas de uso/);assert.match(p[2].titulo,/modelo a confirmar/);assert.match(p[2].comentario,/Não aplicamos especificações de outras gerações/);assert.match(p[3].comentario,/Não usamos watts como medida de volume sonoro/);
});
test('quatro correções da triagem 21 têm títulos e Article alinhados sem aumentar 98 análises',async()=>{
 const get=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
 const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(x=>x.decisionBrief?.reviewed).length,98);
 for(const [id] of samples){const p=c.products.find(x=>x.id===id),h=await readFile(new URL('../produto/'+id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});const a=nodes.find(x=>x['@type']==='Article');assert.equal(a.about.name,p.title);assert.equal(a.description,s.products.find(x=>x.id===id).summary);assert.equal(p.decisionBrief.reviewed,false);}
});
