import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
const dashboard = read('dashboard.html');
const start = dashboard.indexOf('function cartaoProdutoPublicado(doc)');
const end = dashboard.indexOf('function cartaoProdutoRevisao(doc)',start);
assert.ok(start>0&&end>start);
const cardSource = dashboard.slice(start,end);
const now = Date.parse('2026-10-17T15:00:00Z');
function card(product, status = {}, safety = true) {
  const context=vm.createContext({Date,URL,console,statusMercadoLivreAdmin:{p:status},escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),window:{}});
  if(safety) {
    vm.runInContext(read('flash-offer-safety.js'),context);
    const evaluate=context.window.RDCFlashOfferSafety.evaluate;
    context.window.RDCFlashOfferSafety.evaluate=(p,s)=>evaluate(p,s,now);
  }
  vm.runInContext(cardSource,context);
  return context.cartaoProdutoPublicado({id:'p',data:()=>product});
}
const product = {
  titulo:'Tablet de teste',categoria:'Tablet',preco:'80,00',precoAnterior:'100,00',precoPromocional:'80,00',
  ofertaRelampagoAtiva:true,ofertaRelampagoTerminaEm:new Date(now+3600000).toISOString(),
  precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:new Date(now-1000).toISOString(),
  precoConferenciaCampo:'precoPromocional',precoConferenciaValor:80,
};
test('dashboard não confunde cadastro salvo com implantação pública confirmada',()=>{
  const html=card(product);
  assert.match(html,/Cadastro pronto para a vitrine/);
  assert.match(html,/alterações na vitrine dependem da publicação/);
  assert.doesNotMatch(html,/Visível na vitrine pública/);
  assert.match(html,/editarProduto\('p'\)/);
});
test('selo relâmpago do dashboard usa preço confirmado e desconto real, como a vitrine',()=>{
  assert.match(card(product),/class="status-relampago"/);
  for(const patch of [
    {precoAtualizadoManualmente:false},
    {precoAtualizadoManualmenteEm:new Date(now-86400001).toISOString()},
    {precoConferenciaValor:90},
    {precoAnterior:'70,00'},
    {ofertaRelampagoTerminaEm:new Date(now-1).toISOString()},
    {anuncioSubstituidoEm:new Date(now).toISOString()},
  ]) assert.doesNotMatch(card({...product,...patch}),/class="status-relampago"/,JSON.stringify(patch));
  assert.doesNotMatch(card(product,{},false),/class="status-relampago"/);
});
test('renderizar o estado administrativo é somente leitura e continua escapando títulos',()=>{
  const input={...product,titulo:'<img src=x onerror=alert(1)>'};
  const before=JSON.stringify(input);
  const html=card(input);
  assert.equal(JSON.stringify(input),before);
  assert.ok(html.includes('&lt;img'));
  assert.doesNotMatch(cardSource,/getDocs|getDoc\(|updateDoc|deleteDoc|fetch\(/);
});
