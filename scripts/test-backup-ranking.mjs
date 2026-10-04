import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { verifyBackup } from './verify-backup.mjs';
import { restoreMissing } from './restore-backup.mjs';

const sample=()=>({
  format:'rankingdacompra-backup-v1',exportedAt:'2026-09-28T12:00:00.000Z',
  products:[{id:'a',data:{titulo:'Produto',preco:'99,00',precoAtualizadoManualmenteEm:{__rdc_type:'timestamp',seconds:1790000000,nanoseconds:0}}}],
  categories:[{id:'c',data:{nome:'Categoria'}}],siteConfig:{promotionSeoTitle:'Ofertas do dia'}
});

test('cópia completa é legível para preparação de restauração',()=>{
  assert.deepEqual(verifyBackup(sample()),{products:1,categories:1});
});
test('cópia incompleta ou com IDs duplicados é rejeitada',()=>{
  const incomplete=sample();delete incomplete.siteConfig;
  assert.throws(()=>verifyBackup(incomplete),/Configurações/);
  const duplicate=sample();duplicate.products.push({...duplicate.products[0]});
  assert.throws(()=>verifyBackup(duplicate),/duplicado/);
});
test('exportação preserva datas do Firestore em campos aninhados',()=>{
  const html=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
  const source=html.slice(html.indexOf('function serializarValorBackup('),html.indexOf('async function baixarBackupRanking('));
  const context=vm.createContext({Date,Object});
  vm.runInContext(source,context);
  const timestamp={seconds:1790000000,nanoseconds:42,toMillis:()=>1790000000000};
  const result=context.serializarValorBackup({preco:'99,00',historico:[{em:timestamp}]});
  assert.equal(result.preco,'99,00');
  assert.deepEqual(JSON.parse(JSON.stringify(result.historico[0].em)),{__rdc_type:'timestamp',seconds:1790000000,nanoseconds:42});
});
test('recuperação simulada cria só registros ausentes e preserva os existentes',async()=>{
  const records=new Map([['produtos/a',{titulo:'Já cadastrado',preco:'120,00'}]]);
  const firestore={collection:name=>({doc:id=>({
    create:async data=>{if(records.has(`${name}/${id}`))throw Object.assign(new Error('Existe'),{code:6});records.set(`${name}/${id}`,data);}
  })})};
  class Timestamp { constructor(seconds,nanoseconds){this.seconds=seconds;this.nanoseconds=nanoseconds;} }
  const result=await restoreMissing(firestore,sample(),Timestamp);
  assert.deepEqual(result,{categoriesCreated:1,productsCreated:0,existingSkipped:1});
  assert.equal(records.get('produtos/a').preco,'120,00');
  assert.equal(records.get('categorias/c').nome,'Categoria');
});

test('criação concorrente nunca é substituída pela cópia antiga',async()=>{
  const records=new Map();
  const firestore={collection:name=>({doc:id=>({create:async data=>{
    const key=`${name}/${id}`;
    if(name==='produtos')records.set(key,{preco:'120,00'});
    if(records.has(key))throw Object.assign(new Error('Já criado'),{code:6});
    records.set(key,data);
  }})})};
  const result=await restoreMissing(firestore,sample(),class Timestamp{});
  assert.equal(result.existingSkipped,1);
  assert.equal(records.get('produtos/a').preco,'120,00');
});
test('toda a cópia é validada antes da primeira gravação',async()=>{
  const backup=sample();backup.products[0].data.precoAtualizadoManualmenteEm.nanoseconds=-1;
  let writes=0;
  const firestore={collection:()=>({doc:()=>({create:async()=>{writes++;}})})};
  await assert.rejects(restoreMissing(firestore,backup,class Timestamp{}),/Data do Firestore inválida/);
  assert.equal(writes,0);
});
test('erro de permissão não é tratado como registro existente',async()=>{
  const firestore={collection:()=>({doc:()=>({create:async()=>{throw Object.assign(new Error('Sem permissão'),{code:7});}})})};
  await assert.rejects(restoreMissing(firestore,sample(),class Timestamp{}),/Sem permissão/);
});
