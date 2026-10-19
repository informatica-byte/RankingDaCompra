import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import integrity from '../comparison-integrity.js';
import {groupComparisonProducts,renderIntegrityGuide} from './comparison-guides.mjs';
const product=(id,titulo,extra={})=>({id,titulo,preco:100,...extra});

test('separa tipos por finalidade sem usar a categoria como prova',()=>{
  const pairs=[['Roteador WiFi AX1500','Roteador Mesh Deco X10'],['Smart TV Samsung','Projetor Smart TV Android'],['Bicicleta Aro 29 GTS','Bicicleta Ergométrica Spinning'],['Smartwatch Amazfit Bip 6','Relógio Digital Casio'],['Pulseira Inteligente Xiaomi Smart Band 9 Active','Smartwatch Amazfit Bip 6'],['Caixa de som JBL Go 4','Barra de Som ULTIMEA'],['Fone OWS TWS Open Ear ForeStory X5','Fone Redmi Buds 6 Play']];
  for(const [a,b]of pairs)assert.equal(integrity.comparable([{title:a},{title:b}]),false,a+' / '+b);
  assert.equal(integrity.type({title:'Suporte para Notebook Asus'}),'');
  assert.equal(integrity.type({title:'Caixa de som Bluetooth TWS'}),'speaker-portable');
  assert.equal(integrity.type({title:'Fone Bluetooth com gancho'}),'');
  assert.equal(integrity.type({title:'Fone soundcore P30i Estojo com Suporte para Celular'}),'earbuds-tws');
});
test('não duplica modelos por cor e preserva configurações que realmente mudam',()=>{
  assert.equal(integrity.modelKey({title:'Redmi Buds 6 Play Azul'}),integrity.modelKey({title:'Fone Xiaomi Redmi Buds 6 Play M2420E1 Preto'}));
  assert.equal(integrity.comparable([{title:'Redmi Buds 6 Play Azul'},{title:'Redmi Buds 6 Play Preto'}]),false);
  for(const [a,b]of [['Notebook Asus 8GB 256GB Preto','Notebook Asus 16GB 512GB Azul'],['PS5 Slim Disk 1TB com jogos','PS5 Slim Digital 825GB'],['Air Fryer Mondial 127V','Air Fryer Mondial 220V'],['Kit 2 Body Splash Azul','Kit 3 Body Splash Azul']])assert.notEqual(integrity.modelKey({title:a}),integrity.modelKey({title:b}));
  assert.notEqual(integrity.modelKey({title:'Perfume Rose Verde'}),integrity.modelKey({title:'Perfume Rose Rosa'}));
  const items=[product('blue','Redmi Buds 6 Play Azul'),product('ARscPKCMZs3D8k22qltl','Fone Xiaomi Redmi Buds 6 Play Preto')];
  const group=groupComparisonProducts(items)[0];
  assert.equal(group.items.length,1);
  assert.equal(group.items[0].product.id,'ARscPKCMZs3D8k22qltl');
  assert.equal(group.items[0].alternatives[0].id,'blue');
  assert.equal(items.length,2);
});
test('não transforma elogios, medições inexistentes e resumos de venda em comprovação',()=>{
  const p=product('x','Patinete Elétrico 500W',{pros:'Melhor autonomia comprovada, suporta tudo, qualidade garantida',comentario:'Testado profissionalmente, o mais vendido',nota:5});
  const html=renderIntegrityGuide({file:'melhores-patinetes-eletricos.html',title:'Patinetes',products:[p],urls:new Map([['x','/produto/x.html']]),date:'2026-10-19'});
  assert.doesNotMatch(html,/Melhor autonomia comprovada|suporta tudo|qualidade garantida|Testado profissionalmente|mais vendido|5\/5/);
  assert.match(html,/Sem especificações técnicas confirmadas por fonte de fabricante/);
  assert.match(html,/data-comparison-type="scooter-electric"/);
  assert.match(html,/data-comparison-integrity/);
  assert.doesNotMatch(html,/🏆|💚 Melhor custo/);
});
test('o comparador interativo usa a mesma identidade e bloqueia cores repetidas',async()=>{
  const context={window:{},URL,Intl};vm.createContext(context);
  vm.runInContext(await readFile(new URL('../comparison-integrity.js',import.meta.url),'utf8'),context);
  vm.runInContext(await readFile(new URL('../buyer-tools.js',import.meta.url),'utf8'),context);
  const buyer=context.window.RDCBuyerTools;
  assert.equal(buyer.comparable([{title:'Fone Redmi Buds 6 Play Azul'},{title:'Fone Redmi Buds 6 Play Preto'}]),false);
  assert.equal(buyer.comparable([{title:'Roteador AX1500'},{title:'Roteador Mesh AX1500'}]),false);
  assert.equal(buyer.comparable([{title:'Fone soundcore P30i'},{title:'Galaxy Buds Core Preto'}]),true);
});
test('todos os cadastros públicos permanecem alcançáveis após agrupar repetições',async()=>{
  const {products}=JSON.parse(await readFile(new URL('../search-index.json',import.meta.url),'utf8'));
  const groups=integrity.partition(products);
  const represented=groups.flatMap(g=>g.items.flatMap(x=>[x.product,...x.alternatives])).map(p=>p.id);
  assert.equal(represented.length,products.length);
  assert.equal(new Set(represented).size,products.length);
  assert.deepEqual([...represented].sort(),products.map(p=>p.id).sort());
});
