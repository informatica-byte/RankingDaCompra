import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import pause from '../conference-pause.js';
const when = Date.parse('2026-10-09T12:00:00Z');
const product = { id: 'p', titulo: 'Mesmo produto', preco: '99,90', link: 'https://example.com/p', foto: 'foto',
 precoAtualizadoManualmenteEm: '2026-10-09T10:00:00Z', historicoAnuncios: [{ link: 'anterior' }] };
test('prazo é de 30 dias; nunca reativa nem exclui automaticamente', () => {
 const p={...product,...pause.pausePatch(new Date(when).toISOString())};
 assert.equal(pause.state(p,when).remainingDays,30);
 assert.equal(pause.state(p,when+29*86400000).remainingDays,1);
 assert.equal(pause.state(p,when+30*86400000).expired,true);
 assert.equal(pause.state(p,when+31*86400000).paused,true);
 assert.deepEqual(Object.keys(pause.pausePatch(when)).sort(),['conferenciaPausada','conferenciaPausadaEm']);
});
test('datas Firestore, Date e ISO são aceitas; data inválida nunca libera exclusão', () => {
 for(const value of [new Date(when),new Date(when).toISOString(),{seconds:when/1000},{toMillis:()=>when}]) {
  assert.equal(pause.state({conferenciaPausada:true,conferenciaPausadaEm:value},when).remainingDays,30);
 }
 assert.equal(pause.state({conferenciaPausada:true,conferenciaPausadaEm:'inválida'},when).expired,false);
});
test('pausa e reativação preservam preços, datas de comprovação, conteúdo e histórico', () => {
 const p={...product,...pause.pausePatch(when),...pause.resumePatch(when+1)};
 for(const key of Object.keys(product)) assert.deepEqual(p[key],product[key]);
 assert.equal(p.conferenciaPausada,false); assert.equal(p.conferenciaPausadaEm,when);
 assert.equal(product.conferenciaPausada,undefined);
});
const html=readFileSync(new URL('../painel-celular.html',import.meta.url),'utf8');
const fn=html.slice(html.indexOf('async function alterarPausaAnuncio('),html.indexOf('async function carregarFilaPrecosAssistida()'));
function setup({denied=false,server=product}={}) {
 const local={...product};const writes=[],messages=[];let reads=0;
 const context=vm.createContext({Date,String,Object,Boolean,Error,db:{},
  window:{RDCConferencePause:pause},$:()=>null, filaPrecosDados:{todos:[local],produtos:[local]},
  filaPrecosSalvando:false,automacaoPrecosAtiva:false,filaPrecosIdAtual:'p',
  filaPrecosConferidos:new Set(['p']),filaPrecosPulados:new Set(['p']),
  automacaoPrecosIndisponiveis:new Map(),automacaoPrecosFalhas:new Map(),automacaoPrecosVisitados:new Set(),
  atualizarControlesAutomacaoPrecos(){},renderizarAnunciosPausados(){},renderizarFilaPrecosAssistida(){},guardarPosicaoFilaPrecos(){},
  msg:(...args)=>messages.push(args),serverTimestamp:()=> 'SERVER_TIMESTAMP',
  doc:(_db,col,id)=>({col,id}),runTransaction:async(_db,callback)=>{
   if(denied)throw Error('permission-denied');
   return callback({get:async()=>{reads++;return {exists:()=>Boolean(server),data:()=>server};},update:(ref,patch)=>writes.push({ref,patch})});
  }
 });
 vm.runInContext(fn,context);return {context,local,writes,messages,get reads(){return reads;}};
}
test('um clique pausa somente o item escolhido, usando uma transação sem recarregar catálogo',async()=>{
 const c=setup();await c.context.alterarPausaAnuncio('p',true);
 assert.equal(c.reads,1);assert.equal(c.writes.length,1);assert.equal(c.writes[0].ref.id,'p');
 assert.equal(c.writes[0].patch.conferenciaPausada,true);
 assert.equal(c.local.conferenciaPausada,true);assert.equal(c.local.preco,product.preco);
 assert.equal(c.context.filaPrecosConferidos.has('p'),false);
 assert.equal(c.context.filaPrecosIdAtual,'');
});
test('falha, produto removido ou pausa concorrente preservam cadastro e fila local',async()=>{
 for(const options of [{denied:true},{server:null},{server:{...product,conferenciaPausada:true}}]){
  const c=setup(options);await c.context.alterarPausaAnuncio('p',true);
  assert.equal(c.writes.length,0);assert.equal(c.local.conferenciaPausada,undefined);
  assert.equal(c.context.filaPrecosConferidos.has('p'),true);
  assert.equal(c.context.filaPrecosSalvando,false);assert.match(c.messages.at(-1)[1],/Não foi possível/);
 }
});
test('interface usa texto seguro, dá opções e só exclui mediante ação e confirmação',()=>{
 assert.match(html,/id="precos-pausar"/);assert.match(html,/id="precos-pausados"/);
 assert.match(html,/titulo.textContent = produto.titulo/);
 assert.match(html,/acao === "excluir" && window.RDCConferencePause.state\(produto\).expired/);
 const deletion=html.slice(html.indexOf('async function excluirProdutoFilaPrecosAssistida('),html.indexOf('$("precos-pausados").addEventListener'));
 assert.match(deletion,/confirm\(/);assert.match(deletion,/if \(!confirmado\) return/);
 assert.match(html,/atual.conferenciaPausada === true \? \{ conferenciaPausada: false/);
});
test('dashboard e robô oficial ignoram pausados, mas snapshot e registros antigos são preservados',()=>{
 const dash=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
 const sync=readFileSync(new URL('./sync-mercadolivre.mjs',import.meta.url),'utf8');
 assert.match(dash,/status\?\.visible !== false && doc.data\(\).conferenciaPausada !== true/);
 assert.match(sync,/products.filter\(product => product.conferenciaPausada !== true\)/);
 assert.match(sync,/Object.fromEntries\(\[\.\.\.pausedEntries, \.\.\.entries\]\)/);
 assert.match(sync,/version: 1,[\s\S]*?createdAt: new Date\(\).toISOString\(\),\s*products,/);
});
