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
  rankingTipoMetrica:()=> 'visualizacao_produto',rankingMetricaProdutoId:e=>e.id,
  guardarPosicaoFilaPrecos:()=>{}
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

test('reconferência inclui preços já confirmados sem falsificar a data ou reler o catálogo',()=>{
 const c=setup();c.filaPrecosDados.todos[2].precoAtualizadoManualmenteEm=1;
 c.filaPrecosDados.reconferirHoje=true;
 assert.deepEqual(ids(c),['a','b','c']);
 c.filaPrecosConferidos.add('a');assert.deepEqual(ids(c),['b','c']);
 assert.equal(c.filaPrecosDados.todos[2].precoAtualizadoManualmenteEm,1);
});

test('posição da fila volta no mesmo dia sem salvar falsa conferência',()=>{
 const stateCode=html.slice(html.indexOf('let filaPrecosDados = null;'),html.indexOf('function millisPrecoAssistido('));
 const values=new Map();
 const localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const create=day=>{
  const context=vm.createContext({localStorage,hoje:()=>day});
  vm.runInContext(stateCode,context);
  return context;
 };
 const first=create('2026-09-28');
 vm.runInContext('filaPrecosIdAtual="produto-2";filaPrecosPulados.add("produto-1");guardarPosicaoFilaPrecos()',first);
 const resumed=create('2026-09-28');
 assert.equal(vm.runInContext('filaPrecosIdAtual',resumed),'produto-2');
 assert.deepEqual(Array.from(vm.runInContext('filaPrecosPulados',resumed)),['produto-1']);
 assert.equal(vm.runInContext('filaPrecosConferidos.size',resumed),0);
 const tomorrow=create('2026-09-29');
 assert.equal(vm.runInContext('filaPrecosIdAtual',tomorrow),'');
 assert.equal(vm.runInContext('filaPrecosPulados.size',tomorrow),0);
});
