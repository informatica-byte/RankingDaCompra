import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
const html=readFileSync("dashboard.html","utf8");
function extract(name){ const start=html.indexOf("function "+name+"("); let brace=html.indexOf("{",start), depth=1, end=brace+1; for(;depth&&end<html.length;end++){if(html[end]==="{")depth++;if(html[end]==="}")depth--;}return html.slice(start,end);}
test("semana exibida preserva a data civil de São Paulo",()=>{const ctx=createContext({Intl,Date});new Script(extract("dataTop5")).runInContext(ctx);assert.equal(ctx.dataTop5("2026-10-05"),"05/10/2026");assert.equal(ctx.dataTop5("2026-10-12"),"12/10/2026");});
test("resumo ignora pausados e exige reconferência após reativar",()=>{
 const elements={}; const ctx=createContext({Intl,Date,document:{getElementById(id){return elements[id]??={dataset:{}};}},atualizarPublicacaoRotina(){},promocaoVencida(){return false;}});
 for(const name of ["diaBrasilRotina","millisRotina","atualizarResumoRotina"])new Script(extract(name)).runInContext(ctx);
 const now=Date.now(), rows=[{precoAtualizadoManualmenteEm:now},{conferenciaPausada:true},{precoAtualizadoManualmenteEm:now-1000,conferenciaReativadaEm:now}];
 ctx.atualizarResumoRotina({size:3,forEach(fn){rows.forEach(data=>fn({data:()=>data}));}});
 assert.equal(elements["rotina-conferidos"].textContent,"1");assert.equal(elements["rotina-restantes"].textContent,"1");
 assert.equal(elements["rotina-pausados"].textContent,"1");
});

test('retirar link Shopee preserva preço histórico; não permite oferta nova sem preço ou preço órfão novo',()=>{
 const ctx=createContext({String,numeroPrecoPromocao:value=>Number(String(value).replace(',','.'))});
 new Script(extract('validarParShopeeCadastro')).runInContext(ctx);
 assert.equal(ctx.validarParShopeeCadastro('','229,00',{linkShopee:'https://s.shopee.com.br/old',precoShopee:'229,00'}),'');
 assert.equal(ctx.validarParShopeeCadastro('','229,00',{linkShopee:'',precoShopee:'229,00'}),'');
 assert.ok(ctx.validarParShopeeCadastro('','230,00',{precoShopee:'229,00'}));
 assert.ok(ctx.validarParShopeeCadastro('','229,00'));
 assert.ok(ctx.validarParShopeeCadastro('https://s.shopee.com.br/new',''));
 assert.equal(ctx.validarParShopeeCadastro('https://s.shopee.com.br/new','229,00'),'');
});
