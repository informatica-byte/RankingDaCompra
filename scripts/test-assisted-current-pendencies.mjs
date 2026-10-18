import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../painel-celular.html',import.meta.url),'utf8');
const helper=html.slice(html.indexOf('function pendenciasAtuaisAutomacaoPrecos()'),html.indexOf('function resumoAutomacaoPrecos('));
function fixture(loaded,ids){
 const falhas=new Map(['active','removed','confirmed','paused'].map(id=>[id,{id,titulo:id}]));
 const indisponiveis=new Map([['stock',{id:'stock'}],['old',{id:'old'}]]);
 const context=vm.createContext({filaPrecosDados:loaded?{}:null,dadosFilaPrecosAssistida:()=>({pendentes:ids.map(id=>({id}))}),automacaoPrecosFalhas:falhas,automacaoPrecosIndisponiveis:indisponiveis});
 vm.runInContext(helper,context);
 return {value:JSON.parse(JSON.stringify(context.pendenciasAtuaisAutomacaoPrecos())),falhas,indisponiveis};
}
test('fila carregada mostra apenas falhas e indisponíveis ainda pendentes',()=>{
 const {value}=fixture(true,['active','stock']);
 assert.deepEqual(value.falhas.map(x=>x.id),['active']);
 assert.deepEqual(value.indisponiveis.map(x=>x.id),['stock']);
});
test('fila concluída não mantém aviso de cadastro retirado ou já conferido',()=>{
 const {value}=fixture(true,[]);
 assert.deepEqual(value,{indisponiveis:[],falhas:[]});
});
test('filtrar a apresentação não apaga o histórico nem altera os cadastros',()=>{
 const {falhas,indisponiveis}=fixture(true,[]);
 assert.equal(falhas.size,4);assert.equal(indisponiveis.size,2);
});
test('antes de carregar a fila o histórico não é declarado resolvido',()=>{
 const {value}=fixture(false,[]);
 assert.equal(value.falhas.length,4);assert.equal(value.indisponiveis.length,2);
});
test('resumo e botões de substituição usam a mesma lista atual',()=>{
 const summary=html.slice(html.indexOf('function resumoAutomacaoPrecos('),html.indexOf('$("precos-exportar-rodada").onclick'));
 assert.match(summary,/const pendencias = pendenciasAtuaisAutomacaoPrecos\(\)/);
 assert.match(summary,/const separados = \[\.\.\.pendencias\.indisponiveis, \.\.\.pendencias\.falhas\]/);
 assert.doesNotMatch(summary,/automacaoPrecosFalhas\.size|automacaoPrecosIndisponiveis\.values/);
});

test('retomar fila já pulada move o item tentado para o fim e não duplica falha/indisponível',()=>{
 const fn=html.slice(html.indexOf('function separarProdutoAutomacao('),html.indexOf('function pararAutomacaoPrecosAssistida('));
 const falhas=new Map([['a',{id:'a'}],['b',{id:'b'}]]),indisponiveis=new Map(),pulados=new Set(['a','b','c']);
 let saves=0;
 const c=vm.createContext({automacaoPrecosFalhas:falhas,automacaoPrecosIndisponiveis:indisponiveis,filaPrecosPulados:pulados,filaPrecosIdAtual:'a',
  window:{__RDC_BOT_PRECOS_LOCAL__:{version:'2.4.8'}},linkPrecoAssistido:()=> 'https://produto.mercadolivre.com.br/MLB-1234567890',
  guardarPosicaoFilaPrecos:()=>saves++,renderizarFilaPrecosAssistida(){},msg(){}});
 vm.runInContext(fn,c);
 c.separarProdutoAutomacao({id:'a',titulo:'Produto A'},indisponiveis,'Sem estoque');
 assert.deepEqual([...pulados],['b','c','a']);assert.equal(falhas.has('a'),false);assert.equal(indisponiveis.size,1);assert.equal(saves,1);
 c.separarProdutoAutomacao({id:'a',titulo:'Produto A'},falhas,'Revisão necessária');
 assert.deepEqual([...pulados],['b','c','a']);assert.equal(indisponiveis.has('a'),false);assert.equal(falhas.get('a').motivo,'Revisão necessária');
});
