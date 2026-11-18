import test from 'node:test';
import assert from 'node:assert/strict';
import info from '../informational-mode.js';
const products=[{id:'a',title:'Fone Áudio',category:'Fones de ouvido',summary:'Bluetooth',url:'/produto/a.html'},{id:'b',title:'Notebook',category:'Notebook',categoryId:'n',summary:'Fone compatível não confirmado',url:'/produto/b.html'},{id:'c',title:'Roteador',category:'Roteador',summary:'Wi-Fi',url:'/produto/c.html'}];
test('filtros combinam texto, categoria e finalidade sem modificar registros',()=>{
 const before=JSON.stringify(products);
 assert.deepEqual(info.searchProducts(products,{query:'audio',category:'Fones de ouvido',purpose:'audio-video'}).map(p=>p.id),['a']);
 assert.deepEqual(info.searchProducts(products,{category:'n',purpose:'trabalho-estudo'}).map(p=>p.id),['b']);
 assert.equal(info.searchProducts(products,{category:'Notebook',purpose:'conexao'}).length,0);
 assert.equal(info.searchProducts(products,{purpose:'inventada'}).length,0);
 assert.equal(JSON.stringify(products),before);
});
test('ordem prioriza título, normaliza acentos e não corta o catálogo',()=>{
 assert.deepEqual(info.searchProducts(products,{query:'fone'}).map(p=>p.id),['a','b']);
 assert.equal(info.searchProducts(Array.from({length:100},(_,i)=>({...products[0],id:String(i)})),{}).length,100);
});
test('formulário rotulado permite só categoria/finalidade e escapa texto',()=>{
 const html=info.searchForm({products},{query:'"><script>x</script>',category:'Notebook',purpose:'trabalho-estudo'});
 assert.match(html,/method="get"/);assert.match(html,/name="categoria"/);assert.match(html,/name="finalidade"/);
 assert.match(html,/value="Notebook" selected/);assert.match(html,/value="trabalho-estudo" selected/);
 assert.doesNotMatch(html,/<script>| required|meli\.la|firestore/);
 assert.match(html,/não garantem/);
});
