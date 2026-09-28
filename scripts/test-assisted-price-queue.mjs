import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../painel-celular.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function dadosFilaPrecosAssistida()'),html.indexOf('function renderizarFilaPrecosAssistida()'));
function setup(){
 const context=vm.createContext({
  filaPrecosDados:{todos:[{id:'a',titulo:'A'},{id:'b',titulo:'B'},{id:'c',titulo:'C'}],metricas:[{id:'a'},{id:'a'},{id:'b'}]},
  filaPrecosPulados:new Set(),filaPrecosConferidos:new Set(),
  millisPrecoAssistido:v=>v||0,diaPrecoAssistido:v=>v?'hoje':'antes',hoje:()=> 'hoje',
  rankingTipoMetrica:()=> 'visualizacao_produto',rankingMetricaProdutoId:e=>e.id
 });vm.runInContext(source,context);return context;
}
const ids=c=>Array.from(c.dadosFilaPrecosAssistida().pendentes,p=>p.id);
test('fila prioriza visitas e mantém adiados depois dos demais',()=>{
 const c=setup();assert.deepEqual(ids(c),['a','b','c']);c.filaPrecosPulados.add('a');assert.deepEqual(ids(c),['b','c','a']);
});
test('deixar para o fim continua alternando quando todos foram adiados',()=>{
 const c=setup();['a','b','c'].forEach(id=>c.filaPrecosPulados.add(id));
 const handler=html.match(/if \(id === "precos-pular"\) \{([\s\S]*?)renderizarFilaPrecosAssistida\(\);/)[1];
 c.filaPrecosIdAtual='a';vm.runInContext(handler,c);assert.deepEqual(ids(c),['b','c','a']);
 c.filaPrecosIdAtual='b';vm.runInContext(handler,c);assert.deepEqual(ids(c),['c','a','b']);
});
test('adiar não marca preço como confirmado; conferidos realmente saem da fila',()=>{
 const c=setup();c.filaPrecosPulados.add('a');assert.equal(ids(c).length,3);
 c.filaPrecosConferidos.add('b');c.filaPrecosDados.todos[2].precoAtualizadoManualmenteEm=1;
 assert.deepEqual(ids(c),['a']);
});
