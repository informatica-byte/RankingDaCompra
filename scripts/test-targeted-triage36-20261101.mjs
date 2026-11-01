import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {correctProductData,manufacturerEvidence} from './product-title-corrections.mjs';
import {MARKETPLACE_FIELD_REVIEWS} from './marketplace-field-reviews.mjs';
import {assertCurrentProductIdentities} from './fixtures/assert-current-product-identities.mjs';
const tool={id:'SctMie0hqocPmrWupQLO',titulo:'Roçadeira Lateral A Gasolina 4 Em 1 52cc Capacidade de 1200ml 9500 Rpm Com Acessórios The Black Tools'};
const phone={id:'U52A4gBWWLEmfCzONtHb',titulo:'Fone Ouvido Bluetooth Sem Fio Prova DAgua Wireless Tipo Light Cancelamento Ruido Celular'};
test('triagem 36 protege preços, afiliados, identidade e outras ofertas',()=>{
 for(const raw of [tool,phone]){const p={...raw,preco:'123,45',linkAfiliado:'https://meli.la/preservado',cor:'original',precoConferenciaId:'anterior'};const x=correctProductData(p);for(const k of ['id','preco','linkAfiliado','cor','precoConferenciaId'])assert.equal(x[k],p[k]);assert.ok(x.titulo.length<=100);assert.deepEqual(correctProductData(x),x);assert.equal(manufacturerEvidence(x),null);assert.equal(correctProductData({...p,titulo:'Capa para '+p.titulo}).titulo,'Capa para '+p.titulo);}
 assert.equal(correctProductData({...phone,link:'https://www.mercadolivre.com.br/p/MLB58519492?pdp_filters=item_id%3AMLB5758097762'}).titulo,phone.titulo);
});
test('BRO520 não converte um kit de referência em oferta validada ou ensaio profissional',()=>{
 const x=correctProductData(tool);assert.match(x.comentario,/não comprova que todos esses itens acompanham/);assert.match(x.comentario,/não são medições da equipe/);assert.match(x.comentario,/siga o manual específico/);assert.doesNotMatch(x.comentario,/120 horas|120 h|garantimos|mistur[ae].*\d|[12]T.*cortar/);assert.doesNotMatch(x.pros,/6 meses|óculos|luvas|garant/i);
});
test('PRO PHONE SEE mantém a revisão anterior sem garantir água, ANC ou conector',()=>{
 const x=correctProductData(phone),r=MARKETPLACE_FIELD_REVIEWS.get(phone.id);assert.equal(x.comentario,r.summary);assert.equal(x.pros,r.positiveNotes.join('\n'));assert.equal(x.contras,r.negativeNotes.join('\n'));assert.match(x.titulo,/5\.3 anunciado/);assert.match(x.titulo,/proteção e ANC a confirmar/);assert.doesNotMatch(x.titulo,/Light|Lightning|prova.*água/i);
});
test('catálogo, busca e Article coerentes, sem ampliar 98 análises profundas',async()=>{
 const get=async f=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));const c=await get('informational-catalogue.json'),s=await get('search-index.json');assertCurrentProductIdentities(c,s,await get('vitrine-publica.json'));assert.equal(c.products.filter(p=>p.decisionBrief?.reviewed).length,98);
 for(const raw of [tool,phone]){const p=c.products.find(p=>p.id===raw.id);assert.equal(p.title,correctProductData(raw).titulo);const h=await readFile(new URL('../produto/'+p.id+'-20260810-1.html',import.meta.url),'utf8');const nodes=[...h.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].flatMap(m=>{const j=JSON.parse(m[1]);return j['@graph']||[j]});const a=nodes.find(n=>n['@type']==='Article');assert.equal(a.about.name,p.title);assert.equal(a.description,s.products.find(x=>x.id===raw.id).summary);}
});
test('checkpoint genérico permanece local e recusa marcar conteúdo não publicado como concluído',async()=>{
 const source=await readFile(new URL('./record-prepared-editorial.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/fetch\(|exec\(|spawn\(|Firestore.*get/i);assert.match(source,/prepared_awaiting_publication/);assert.match(source,/publicationAttempted:false/);assert.match(source,/assert\.deepEqual/);
});
