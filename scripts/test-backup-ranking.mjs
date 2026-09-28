import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { verifyBackup } from './verify-backup.mjs';

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
