import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../painel-celular.html',import.meta.url),'utf8');
const summary=html.slice(html.indexOf('function resumoAutomacaoPrecos('),html.indexOf('function atualizarControlesAutomacaoPrecos('));
test('salvamento manual atualiza as pendências sem apagar a mensagem nem consultar serviços',()=>{
 const target={innerHTML:''},button={};let pendencias={indisponiveis:[],falhas:[{id:'a',titulo:'Produto A',motivo:'Revisão'},{id:'b',titulo:'Produto B',motivo:'Revisão'}]};
 const c=vm.createContext({$:id=>id==='precos-auto-resumo'?target:button,ultimaMensagemAutomacaoPrecos:'',
  pendenciasAtuaisAutomacaoPrecos:()=>pendencias,rankingEsc:String,acompanhamentoPrecos:{estado:()=>({tentados:0,limite:30})}});
 vm.runInContext(summary,c);c.resumoAutomacaoPrecos('Preço salvo com segurança.');
 assert.match(target.innerHTML,/Ver todas as 2 pendências/);
 pendencias={indisponiveis:[],falhas:[{id:'b',titulo:'Produto B',motivo:'Revisão'}]};c.resumoAutomacaoPrecos();
 assert.match(target.innerHTML,/Preço salvo com segurança/);assert.match(target.innerHTML,/Ver todas as 1 pendências/);
 assert.doesNotMatch(target.innerHTML,/Produto A|Ver todas as 2/);
 pendencias={indisponiveis:[],falhas:[]};c.resumoAutomacaoPrecos();
 assert.doesNotMatch(target.innerHTML,/Ver todas as|Separados:/);
 assert.equal(typeof button.onclick,'function');
});
test('qualquer renderização da fila atualiza o resumo antes de escolher o próximo item',()=>{
 const render=html.slice(html.indexOf('function renderizarFilaPrecosAssistida()'),html.indexOf('function renderizarAnunciosPausados()'));
 assert.match(render,/atualizarControlesAutomacaoPrecos\(\);[\s\S]*?resumoAutomacaoPrecos\(\);[\s\S]*?if \(!fila\.pendentes\.length\)/);
 assert.doesNotMatch(summary.split('$("precos-exportar-rodada").onclick')[0],/fetch\(|getDocs\(|updateDoc\(/);
});
