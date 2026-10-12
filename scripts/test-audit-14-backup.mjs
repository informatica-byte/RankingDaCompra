import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { verifyBackup } from './verify-backup.mjs';
import { restoreMissing } from './restore-backup.mjs';

const html = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
const code = html.slice(html.indexOf('function serializarValorBackup('), html.indexOf("document.getElementById('btn-backup-ranking').addEventListener"));
const snap = docs => ({metadata:{fromCache:false}, docs:docs.map(([id,data]) => ({id,data:()=>data}))});

async function exportFixture(theme, {cached=false, fail=false}={}) {
  let blob;
  let downloads=0;
  const reads=[];
  const status={textContent:''};
  const button={disabled:false};
  const context=vm.createContext({
    Date, Object, Array, Blob, Error, String, JSON,
    auth:{currentUser:{uid:'test-admin'}},
    snapshotProdutosBackup:snap([['product',{titulo:'Produto',preco:'99,00',dataCadastro:'2026-10-12'}]]),
    snapshotCategoriasBackup:snap([['category',{nome:'Categoria'}]]),
    db:{collection:name=>({
      get:async options=>{reads.push([name,options.source]);return snap([['site',{bestChoicesTitle:'Escolhas'}],['ranking-semanal',{titulo:'Ranking salvo'}]]);},
      doc:id=>({get:async options=>{reads.push([name,id,options.source]);if(fail)throw Error('Falha no tema');return {exists:Boolean(theme),metadata:{fromCache:cached},data:()=>theme};}})
    })},
    document:{getElementById:id=>id==='backup-ranking-status'?status:button,createElement:()=>({click:()=>{downloads++;}})},
    URL:{createObjectURL:value=>{blob=value;return 'blob:test';},revokeObjectURL:()=>{}},
    setTimeout:()=>{},diaBrasilRotina:()=> '2026-10-12',
  });
  vm.runInContext(code,context);
  await context.baixarBackupRanking();
  return {reads,downloads,status:status.textContent,button,backup:blob?JSON.parse(await blob.text()):null};
}

test('backup inclui tema sem dataCadastro e ranking privado com uma leitura pontual',async()=>{
  const theme={seasonalThemeMode:'manual',seasonalThemeId:'natal',giftGuideTitle_natal:'Meus presentes'};
  const result=await exportFixture(theme);
  assert.equal(result.downloads,1);
  assert.deepEqual(result.reads,[['configuracoes','server'],['produtos','.site-theme','server']]);
  assert.deepEqual(result.backup.products.find(item=>item.id==='.site-theme').data,theme);
  assert.equal(result.backup.configurations.find(item=>item.id==='ranking-semanal').data.titulo,'Ranking salvo');
  assert.deepEqual(verifyBackup(result.backup),{products:2,categories:1});
  const records=new Map();
  const firestore={collection:name=>({doc:id=>({create:async data=>{records.set(`${name}/${id}`,data);}})})};
  await restoreMissing(firestore,result.backup,class Timestamp{});
  assert.deepEqual(records.get('produtos/.site-theme'),theme);
});

test('tema inexistente não impede backup, sem criar configuração inventada',async()=>{
  const result=await exportFixture(null);
  assert.equal(result.downloads,1);
  assert.equal(result.backup.products.length,1);
});

for(const options of [{cached:true},{fail:true}]) {
  test(`falha ou cache do tema não baixa cópia parcial: ${JSON.stringify(options)}`,async()=>{
    const result=await exportFixture({seasonalThemeId:'natal'},options);
    assert.equal(result.downloads,0);
    assert.equal(result.backup,null);
    assert.equal(result.button.disabled,false);
    assert.match(result.status,/Falha no download/);
  });
}
