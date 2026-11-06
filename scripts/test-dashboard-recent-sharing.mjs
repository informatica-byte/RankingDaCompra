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
