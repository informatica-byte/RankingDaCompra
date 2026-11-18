import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
const block=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));

test('dashboard orders eligible recent products by registration date, not title or edit date',()=>{
 const produto=(id,day,extra={})=>({id,titulo:id,foto:'foto',link:'afiliado',dataCadastro:{toDate:()=>new Date(2026,10,day)},...extra});
 const list=[produto('A',1,{atualizadoEm:new Date(2026,10,30)}),produto('Z',2),produto('Q',9,{quarentenaAnuncio:{}}),produto('Sem foto',9,{foto:''}),produto('Sem link',9,{link:''}),produto('Oculto',9,{oculto:true}),...['F','E','D','C','B'].map((id,i)=>produto(id,i+3))];
 const result=runInNewContext(
  block('function dataMsCentral(','\n')+'\n'+block('function produtoElegivelParaDivulgacaoCentral(','window.obterOfertasAtivasParaTitulo')+'\nmelhoresOfertasCentral().map(p=>p.id).join(",")',
  {window:{RDCInformational:{enabled:true}},produtosCentralAtual:list,produtoOcultoNaVitrine:p=>p.oculto,linkAfiliadoValidoCentral:p=>Boolean(p.link)});
 assert.equal(result,'B,C,D,E,F,Z');
});

test('recentes ficam antes das métricas com atalho único e data de cadastro explícita',()=>{
 assert.equal((html.match(/id="central-recentes"/g)||[]).length,1);
 assert.ok(html.indexOf('id="central-recentes"')<html.indexOf('class="central-metricas" aria-label'));
 assert.match(html,/href="#central-recentes"/);
 const source=block('function destaqueRecenteCentral(','async function copiarRecenteCentral(');
 const context={dataMsCentral:()=>Date.parse('2026-11-18T12:00:00Z'),Intl,Date,escapeHtml:s=>String(s).replace(/</g,'&lt;')};
 const card=runInNewContext(source+';destaqueRecenteCentral({id:"a"},\'<article><div class="campanha-posicao">Análise informativa</div></article>\')',context);
 assert.match(card,/Cadastrado em 18\/11\/2026/);assert.match(card,/publicação verificada separadamente/);
 assert.match(card,/data-central-copiar-tipo="texto"/);assert.match(card,/data-central-copiar-tipo="link"/);
});

test('copiar exige sessão e página/foto prontas; preserva texto editado sem publicar',async()=>{
 const retorno={},state={pronto:false,arquivoPronto:false},calls=[];
 const context={auth:{currentUser:{uid:'ficticio'}},document:{getElementById:id=>id.startsWith('recente-retorno')?retorno:{value:'Texto editado'}},produtoCentralPorId:()=>({id:'a'}),estadosPublicacaoCentral:new Map([['a',state]]),urlCampanhaCentral:()=>'/produto/a.html',textoPadraoCentral:()=>'',navigator:{clipboard:{writeText:async text=>calls.push(text)}}};
 runInNewContext(block('async function copiarRecenteCentral(','function melhoresOfertasCentral('),context);
 await context.copiarRecenteCentral('a','texto');assert.equal(calls.length,0);
 state.pronto=true;await context.copiarRecenteCentral('a','link');assert.equal(calls.length,0);
 state.arquivoPronto=true;await context.copiarRecenteCentral('a','texto');assert.equal(calls[0],'Texto editado\n/produto/a.html');
 await context.copiarRecenteCentral('a','link');assert.equal(calls[1],'/produto/a.html');assert.match(retorno.textContent,/Nada foi publicado/);
 context.auth.currentUser=null;await context.copiarRecenteCentral('a','link');assert.equal(calls.length,2);
});
