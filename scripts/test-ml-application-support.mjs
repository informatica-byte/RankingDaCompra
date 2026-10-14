import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("./sync-mercadolivre.mjs", import.meta.url), "utf8");
const start = source.indexOf("// Application support diagnostic:");
const end = source.indexOf("// End application support diagnostic", start);
assert.ok(start >= 0 && end > start);
const diagnose = new Function(source.slice(start, end).replace("export async function", "async function") + "\nreturn diagnoseSupportApplication;")();
test("retorna apenas campos aprovados e scopes da aplicação correta", async () => {
  const calls = [];
  const rows = [
    {ok:true,status:200,data:{id:131527439,access_token:"NAO_PUBLICAR"}},
    {ok:true,status:200,data:{active:true,sandbox_mode:false,certification_status:"not_certified",secret:"NAO_PUBLICAR"}},
    {ok:true,status:200,data:[{app_id:1,scopes:["write"]},{app_id:3720917002139194,scopes:["read","offline_access"]}]},
  ];
  const report=await diagnose(async url => {calls.push(url);return rows.shift();});
  assert.deepEqual(report.scopes,["read","offline_access"]);
  assert.equal(report.active,true);
  assert.equal(report.sandbox_mode,false);
  assert.equal(report.certification_status,"not_certified");
  assert.equal(calls.length,3);
  assert.ok(calls.every(url => url.startsWith("https://api.mercadolibre.com/")));
  assert.ok(!JSON.stringify(report).includes("NAO_PUBLICAR"));
});
test("não consulta aplicação com conta divergente", async () => {
  let calls=0;
  const report=await diagnose(async () => {calls++;return {ok:true,status:200,data:{id:7}};});
  assert.equal(calls,1);
  assert.equal(report.consultas.conta.proprietariaConfirmada,false);
  assert.equal(report.active,null);
});
test("403 é preservado sem fabricar estado nem publicar resposta bruta", async () => {
  const rows=[
    {ok:true,status:200,data:{id:131527439}},
    {ok:false,status:403,data:{message:"SEGREDO",active:true}},
    {ok:true,status:200,data:[{app_id:3720917002139194,scopes:["read"]}]},
  ];
  const report=await diagnose(async () => rows.shift());
  assert.equal(report.active,null);
  assert.equal(report.consultas.aplicacao.status,403);
  assert.deepEqual(report.scopes,["read"]);
  assert.ok(!JSON.stringify(report).includes("SEGREDO"));
});
test("scopes malformados não são expostos", async () => {
  const rows=[
    {ok:true,status:200,data:{id:131527439}},
    {ok:true,status:200,data:{active:true,sandbox_mode:false,certification_status:"APP_USR_SEGREDO"}},
    {ok:true,status:200,data:[{app_id:3720917002139194,scopes:["read","APP_USR_SEGREDO"]}]},
  ];
  const report=await diagnose(async () => rows.shift());
  assert.equal(report.scopes,null);
  assert.equal(report.certification_status,null);
  assert.ok(!JSON.stringify(report).includes("SEGREDO"));
});
test("modo isolado vem antes da leitura de produtos", () => {
  const mode=source.indexOf('if (PREFLIGHT_ONLY && String(process.env.RDC_ML_SUPPORT_APPLICATION_DETAILS');
  assert.ok(mode>source.indexOf("async function main()"));
  assert.ok(mode<source.indexOf("let previous = await readPrevious()",mode));
  const block=source.slice(mode,source.indexOf("const supportItemId",mode));
  assert.ok(!block.includes("listProducts"));
  assert.ok(!block.includes("fetchFirestore"));
  assert.ok(block.includes("return;"));
});
test("consulta grants da aplicação quando lista da conta não informa scopes", async () => {
  const rows=[
    {ok:true,status:200,data:{id:131527439}},
    {ok:true,status:200,data:{active:true,sandbox_mode:false,certification_status:"not_certified"}},
    {ok:true,status:200,data:[]},
    {ok:true,status:200,data:{grants:[
      {user_id:7,app_id:3720917002139194,scopes:["write"]},
      {user_id:131527439,app_id:3720917002139194,scopes:["read","offline_access"]},
    ]}},
  ];
  const calls=[];
  const report=await diagnose(async url => {calls.push(url);return rows.shift();});
  assert.equal(calls.length,4);
  assert.ok(calls[3].endsWith("/applications/3720917002139194/grants"));
  assert.deepEqual(report.scopes,["read","offline_access"]);
});
test("aceita scopes textuais documentados sem publicar campos extras", async () => {
  const rows=[
    {ok:true,status:200,data:{id:131527439}},
    {ok:true,status:200,data:{active:true,sandbox_mode:false,certification_status:"not_certified"}},
    {ok:true,status:200,data:{applications:[{id:3720917002139194,scope:"read offline_access",access_token:"SEGREDO"}]}},
  ];
  const report=await diagnose(async () => rows.shift());
  assert.deepEqual(report.scopes,["read","offline_access"]);
  assert.ok(!JSON.stringify(report).includes("SEGREDO"));
});
test("grants da rota específica podem omitir app_id sem perder a seleção da conta", async () => {
  const rows=[
    {ok:true,status:200,data:{id:131527439}},
    {ok:true,status:200,data:{active:true,sandbox_mode:false,certification_status:"not_certified"}},
    {ok:true,status:200,data:[]},
    {ok:true,status:200,data:{grants:[{user_id:131527439,scopes:["read","write","offline_access"]}]}},
  ];
  const report=await diagnose(async () => rows.shift());
  assert.deepEqual(report.scopes,["read","write","offline_access"]);
});
