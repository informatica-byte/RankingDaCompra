import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync("ranki-video-studio.js", "utf8");
const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const facts = source.slice(source.indexOf("function primaryFact("), source.indexOf("function descriptionForProduct("));
const build = (product, type = "intro") => new Function("clean", "state", "$", facts + "; return scriptForProduct();")(clean, {product}, () => ({value:type}));
test("roteiro não narra frases cortadas ou reticências", () => {
 const product = { title:"Produto", category:"Categoria", summary:"Esta explicação do anúncio é muito extensa e termina com uma importante condição que não deve ser cortada.", pros:["Uso em área externa somente se…"], cons:["Incompatível com um aparelho muito específico quando há determinada configuração que precisa ser verificada integralmente"] };
 for (const type of ["intro","vale","pros"]) {
  const script = build(product,type);
  assert.doesNotMatch(script, /…|\.\.\./);
  assert.match(script, /confirme medidas, garantia e frete no vendedor\./);
  assert.ok(script.length < 700);
 }
});
test("roteiro preserva fatos curtos completos e Bluetooth decimal", () => {
 const script = build({title:"JBL Tune 520BT", summary:"Bluetooth 5.3 e conexão sem fio", pros:["Bluetooth 5.3 e conexão sem fio"], cons:["Não oferece cancelamento ativo de ruído"]});
 assert.match(script, /Bluetooth 5\.3 e conexão sem fio\./);
 assert.match(script, /Não oferece cancelamento ativo de ruído\./);
});
test("nome extenso não vira nome cortado na narração", () => {
 const script = build({title:"Nome".repeat(30), summary:"", pros:[], cons:[]});
 assert.match(script, /Conheça este produto\./);
 assert.doesNotMatch(script, /…|NomeNome/);
});
