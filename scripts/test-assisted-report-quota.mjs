import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../painel-celular.html',import.meta.url),'utf8');
const fn=html.slice(html.indexOf('function guardarPosicaoFilaPrecos()'),html.indexOf('function recuperarPosicaoFilaPrecos()'));
function setup(fail){
 const results=new Map([['novo',{status:'confirmado',preco:123,origem:'robo_assistido_2.4.8'}]]),nodes=new Map(),writes=[];
 nodes.set('precos-auto',{appendChild(node){nodes.set(node.id,node);}});
 const c=vm.createContext({Date,JSON,filaPrecosDia:'2026-10-18',filaPrecosIdAtual:'proximo',filaPrecosPulados:new Set(),filaPrecosConferidos:new Set(['novo']),filaPrecosResultados:results,
  filaPrecosRodadaId:'2026-10-18T10:00:00Z',automacaoPrecosFalhas:new Map(),automacaoPrecosIndisponiveis:new Map(),filaPrecosDados:{reconferirHoje:false},filaPrecosReconferirSalvo:false,
  acompanhamentoPrecos:{estado:()=>({tentados:16})},chaveFilaPrecos:'rdc-conferencia-test',
  localStorage:{setItem(k,v){if(fail)throw new Error('QuotaExceededError');writes.push([k,v]);},getItem(){throw new Error('Não reler cópia antiga');},removeItem(){throw new Error('Não apagar histórico');}},
  $:id=>nodes.get(id),document:{createElement:()=>({setAttribute(){}})}});
 vm.runInContext(fn,c);return{c,nodes,writes};
}
test('quota local não transforma relatório atual em snapshot antigo nem apaga histórico',()=>{
 const {c,nodes,writes}=setup(true),live=JSON.parse(c.guardarPosicaoFilaPrecos());
 assert.equal(live.resultados[0][0],'novo');assert.equal(live.resultados[0][1].preco,123);assert.equal(writes.length,0);
 assert.match(nodes.get('precos-armazenamento-aviso').textContent,/nenhum histórico foi apagado/);
});
test('persistência disponível mantém diário e backup da rodada',()=>{
 const {c,writes}=setup(false),live=c.guardarPosicaoFilaPrecos();
 assert.equal(writes.length,2);assert.ok(writes.every(([,value])=>value===live));
});
test('exportação usa retorno vivo da serialização e não lê snapshot persistido antigo',()=>{
 const exportCode=html.slice(html.indexOf('$("precos-exportar-rodada").onclick'),html.indexOf('function atualizarControlesAutomacaoPrecos'));
 assert.match(exportCode,/const dados = guardarPosicaoFilaPrecos\(\)/);assert.doesNotMatch(exportCode,/localStorage\.getItem/);
});
