import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function api() {
  const context = {window:{}, URL, URLSearchParams, Intl};
  vm.createContext(context);
  vm.runInContext(await readFile(new URL('../buyer-tools.js', import.meta.url), 'utf8'), context);
  return context.window.RDCBuyerTools;
}

test('comparison rows preserve confirmed negatives and distinguish missing evidence', async () => {
  const tools = await api();
  const products = [
    {title:'JBL Tune 520BT', comparison:{features:[{label:'ANC', value:'Não possui ANC', state:'no', basis:'fabricante'}]}},
    {title:'Outro fone', comparison:{features:[]}}
  ];
  const rows = tools.featureRows(products);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].values[0].state, 'no');
  assert.equal(rows[0].values[1].state, 'unknown');
  assert.match(rows[0].values[1].value, /Não confirmado/);
});

test('comparison rejects unvalidated feature data instead of displaying assertions', async () => {
  const tools = await api();
  assert.equal(tools.comparisonFeatures({comparison:{features:[{label:'ANC', value:'Sim', state:'guessed', basis:'cadastro'}]}}).length, 0);
  assert.equal(tools.comparisonFeatures({comparison:{features:'invalid'}}).length, 0);
});

test('notebooks are comparable without confusing router or headphone uses', async () => {
  const tools = await api();
  assert.equal(tools.group({title:'Notebook Asus 8 GB SSD 256 GB'}), 'Notebooks');
  assert.equal(tools.comparable([{title:'Notebook Asus'},{title:'Notebook Lenovo'}]), true);
  assert.equal(tools.comparable([{title:'Notebook Asus'},{title:'Roteador Wi-Fi'}]), false);
  assert.equal(tools.group({title:'Power Bank Basike 20000mAh para Notebook e Celular'}), 'Baterias portáteis');
  assert.equal(tools.comparable([{title:'JBL Tune 520BT Bluetooth'},{title:'Headphone over-ear Bluetooth'}]), false);
});

test('catalog filters keep the same prices and freshness boundaries', async () => {
  const tools = await api();
  const now = Date.parse('2026-10-11T15:00:00Z');
  const items = [{title:'Notebook',category:'Informática',summary:'8 GB',recordedPrice:2000,checkedAt:'2026-10-11T09:00:00Z'},
    {title:'Notebook',category:'Informática',summary:'16 GB',recordedPrice:2500,checkedAt:'2026-10-08T09:00:00Z'}];
  assert.equal(tools.filterProducts(items, {query:'notebook',budget:2100,recent:true}, now).length, 1);
  assert.equal(tools.recent({...items[0],checkedAt:'2026-10-12T09:00:00Z'},now), false);
});

test('busca por fone não confunde microfone e aceita plural, acentos e modelos pontuados',async()=>{
  const tools=await api();
  const items=[{title:'Webcam',summary:'Com microfone',category:'Informática'}, {title:'Fones Bluetooth',summary:'',category:'Áudio'}, {title:'Notebook ASUS E1504FA-NJ1288',summary:'',category:'Informática'}];
  assert.deepEqual(Array.from(tools.filterProducts(items,{query:'fone'}),x=>x.title),['Fones Bluetooth']);
  assert.equal(tools.filterProducts(items,{query:'audio'}).length,1);
  assert.equal(tools.filterProducts(items,{query:'ASUS E1504FA-NJ1288'}).length,1);
});
