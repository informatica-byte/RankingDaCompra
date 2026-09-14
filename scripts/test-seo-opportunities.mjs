import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../seo-opportunities.js", import.meta.url), "utf8");
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "seo-opportunities.js" });

const api = sandbox.window.RankingSEOOpportunities;
assert.ok(api, "API de teste não foi exposta");

const portuguese = [
  "Consultas mais frequentes;Cliques;Impressões;CTR;Posição",
  '"melhor notebook até 3000";2;120;1,7%;8,4',
  '"air fryer para família";0;45;0%;14,2'
].join("\n");
const rowsPt = api.parseSearchConsoleCsv(portuguese);
assert.equal(rowsPt.length, 2);
assert.equal(rowsPt[0].kind, "consulta");
assert.equal(rowsPt[0].impressions, 120);
assert.equal(rowsPt[0].ctr, 1.7);
assert.equal(rowsPt[0].position, 8.4);

const english = [
  "Top pages,Clicks,Impressions,CTR,Position",
  "https://rankingdacompra.com.br/melhores-notebook.html,3,250,1.2%,9.5"
].join("\n");
const rowsEn = api.parseSearchConsoleCsv(english);
assert.equal(rowsEn[0].kind, "pagina");
assert.equal(rowsEn[0].clicks, 3);

const report = api.analyzeRows([...rowsPt, ...rowsEn]);
assert.equal(report.sourceRows, 3);
assert.equal(report.impressions, 415);
assert.equal(report.clicks, 5);
assert.ok(report.opportunities.length >= 2);
assert.equal(report.opportunities[0].label, "https://rankingdacompra.com.br/melhores-notebook.html");

console.log("Central SEO: CSV em português/inglês, cálculo e prioridades validados.");
