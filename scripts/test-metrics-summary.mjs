import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../metricas-resumo.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(source, context);
const summary = context.RankingMetricasResumo;
assert.equal(summary.VERSION, 1);

const docs = [
  { id: "visita-1", data: () => ({ dia: "2026-09-22", origem: "/" }) },
  { id: "visita-2", data: () => ({ dia: "2026-09-22", origem: "/produto" }) },
  { id: "clique-1", data: () => ({ dia: "2026-09-22", tipo: "clique_oferta", produtoId: "fone", canal: "site" }) },
  { id: "clique-2", data: () => ({ dia: "2026-09-22", tipo: "clique_oferta", produtoId: "fone", canal: "site" }) },
  { id: "legado", data: () => ({ dia: "2026-09-22", origem: "evento:clique_oferta:fone:site" }) },
];
const decode = (data, id) => {
  if (data.tipo) return { id, ...data };
  const [, tipo, produtoId, canal] = String(data.origem).split(":");
  return { id, tipo, produtoId, canal, dia: data.dia };
};
const grouped = summary.resumirDocumentos(docs, decode);
assert.equal(summary.total(grouped), 5);
const first = summary.combinar(null, grouped, "2026-09-22", "2026-09-10", "2026-09-22", 1000);
const replay = summary.combinar(first, grouped, "2026-09-22", "2026-09-10", "2026-09-22", 2000);
assert.equal(summary.total(replay.registros), 5, "releitura do mesmo dia não duplica métricas");
const snapshot = summary.instantaneo(replay);
assert.equal(snapshot.docs.length, 5, "painel recebe a cardinalidade original dos eventos");
const ids = new Set(snapshot.docs.map((doc) => doc.id));
assert.equal(ids.size, 5, "cada evento sintetizado recebe identidade única");
assert.equal(snapshot.docs.filter((doc) => doc.data().tipo === "clique_oferta").length, 3);
assert.equal(snapshot.docs.filter((doc) => doc.data().tipo === "visita").length, 2);
const nextDay = summary.combinar(first, [...grouped, { dia: "2026-09-23", tipo: "visita", quantidade: 1 }],
  "2026-09-22", "2026-09-10", "2026-09-23", 3000);
assert.equal(summary.total(nextDay.registros), 6,
  "o dia anterior é substituído sem duplicação e o dia novo é incluído");

console.log("Resumo local de métricas: contagens e proteção contra duplicação OK");

const dashboard = await readFile(new URL("../dashboard.html", import.meta.url), "utf8");
assert.match(dashboard, /<script src="\/metricas-resumo\.js\?v=20260923-1"><\/script>[\s\S]*?<script>/,
  "o resumo precisa carregar antes do painel");
for (const match of dashboard.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\btype\s*=\s*["']module["']/i.test(match[1]) || !match[2].trim()) continue;
  new vm.Script(match[2], { filename: "dashboard.html" });
}
console.log("Scripts clássicos do painel: sintaxe OK");
