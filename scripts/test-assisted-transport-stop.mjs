import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../painel-celular.html',import.meta.url),'utf8');
const routine=html.slice(html.indexOf('async function executarAutomacaoPrecosAssistida('),html.indexOf('function iniciarAutomacaoPrecosAssistida('));
for(const error of [Object.assign(new Error('janela bloqueada'),{code:'RDC_POPUP_BLOCKED'}),Object.assign(new Error('timeout'),{code:'RDC_CHANNEL_TIMEOUT'}),new Error('O navegador bloqueou a janela do anúncio.')]){
 test('falha global interrompe sem pular produtos: '+error.message,async()=>{
  const products=[{id:'a',titulo:'Produto A'},{id:'b',titulo:'Produto B'}],separated=[],requests=[];let persisted=0,stopped=0;
  const c=vm.createContext({automacaoPrecosRodada:1,automacaoPrecosAtiva:true,automacaoPrecosPausada:false,filaPrecosIdAtual:'a',automacaoPrecosVisitados:new Set(),
   dadosFilaPrecosAssistida:()=>({pendentes:products}),acompanhamentoPrecos:{tentar:()=>true},
   linkPrecoAssistido:()=> 'https://produto.mercadolivre.com.br/MLB-1234567890',resumoAutomacaoPrecos(){},rankingEsc:s=>s,
   window:{conferirPrecoNaAbaLocal:async r=>{requests.push(r);throw error;}},esperar:async()=>{},
   guardarPosicaoFilaPrecos:()=>{persisted++;},pararAutomacaoPrecosAssistida:()=>{stopped++;c.automacaoPrecosAtiva=false;},
   separarProdutoAutomacao:(...args)=>separated.push(args),msg(){}});
  vm.runInContext(routine,c);await c.executarAutomacaoPrecosAssistida();
  assert.equal(stopped,1);assert.equal(persisted,1);assert.deepEqual(separated,[]);
  assert.ok(requests.every(r=>r.produtoId==='a'));assert.equal(c.filaPrecosIdAtual,'a');assert.equal(c.automacaoPrecosVisitados.size,0);
 });
}

test('resumo diferencia transporte de defeito do anúncio e não sugere substituição nesse caso',()=>{
 const summary=html.slice(html.indexOf('function resumoAutomacaoPrecos('),html.indexOf('function atualizarControlesAutomacaoPrecos('));
 assert.match(summary,/interrupcoes = pendencias\.falhas\.filter\(transporte\)/);
 assert.match(summary,/não são anúncios indisponíveis/);
 assert.match(summary,/Retome a conferência; esta falha não exige substituir o anúncio/);
});
