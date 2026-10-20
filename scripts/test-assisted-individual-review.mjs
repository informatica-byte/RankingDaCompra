import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../painel-celular.html',import.meta.url),'utf8');
const start=html.indexOf('function abrirRevisaoPendenciaPrecoAssistida('),end=html.indexOf('function abrirSubstituicaoAnuncioFilaPrecosAssistida(',start);
const code=html.slice(start,end);
function fixture(){
 const product={id:'pending',preco:100,link:'https://www.mercadolivre.com.br/produto/p/MLB12345678',linkAfiliado:'https://meli.la/existing'};
 const fields=new Map(),calls=[];
 const c=vm.createContext({filaPrecosSalvando:false,automacaoPrecosAtiva:false,automacaoPrecosPausada:false,filaPrecosDados:{todos:[product]},filaPrecosIdAtual:'next',
  $:id=>fields.get(id),dadosFilaPrecosAssistida:()=>({pendentes:[product]}),guardarPosicaoFilaPrecos:()=>calls.push('guardar'),renderizarFilaPrecosAssistida:()=>calls.push('render'),msg:()=>calls.push('mensagem')});
 fields.set('precos-item',{scrollIntoView:()=>calls.push('scroll')});vm.runInContext(code,c);return {c,product,fields,calls};
}
test('revisão individual seleciona pendência sem trocar link, alterar preço nem iniciar lote',()=>{
 const f=fixture(),before=JSON.stringify(f.product);f.c.abrirRevisaoPendenciaPrecoAssistida('pending');
 assert.equal(f.c.filaPrecosIdAtual,'pending');assert.equal(JSON.stringify(f.product),before);assert.deepEqual(f.calls,['guardar','render','mensagem','scroll']);
 assert.doesNotMatch(code,/updateDoc|deleteDoc|conferirPrecoNaAbaLocal|iniciarAutomacao/);
 assert.match(html,/data-revisar-preco/);
});
test('revisão individual não repete conferido nem interfere em lote ou edição em andamento',()=>{
 for(const state of ['filaPrecosSalvando','automacaoPrecosAtiva','automacaoPrecosPausada']){
  const f=fixture();f.c[state]=true;f.c.abrirRevisaoPendenciaPrecoAssistida('pending');assert.equal(f.c.filaPrecosIdAtual,'next');assert.equal(f.calls.length,0);
 }
 for(const editor of ['precos-editor','precos-substituicao']){
  const f=fixture();f.fields.set(editor,{hidden:false});f.c.abrirRevisaoPendenciaPrecoAssistida('pending');assert.equal(f.c.filaPrecosIdAtual,'next');
 }
 const f=fixture();f.c.dadosFilaPrecosAssistida=()=>({pendentes:[]});f.c.abrirRevisaoPendenciaPrecoAssistida('pending');assert.equal(f.c.filaPrecosIdAtual,'next');assert.deepEqual(f.calls,['mensagem']);
});
