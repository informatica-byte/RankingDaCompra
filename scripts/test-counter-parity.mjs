import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = name => readFile(new URL("../" + name, import.meta.url), "utf8");
const source = await read("metricas-resumo.js");
const sandbox = vm.createContext({});
vm.runInContext(source, sandbox);
const metrics = sandbox.RankingMetricasResumo;
const doc = (id, data) => ({ id, data: () => data });
const now = Date.parse("2026-10-07T15:00:00Z");

test("mesmos eventos novos e legados, sem repetir um documento ou cortar a taxa", () => {
  const click = doc("a", { dia: "2026-10-07", tipo: "clique_oferta", produtoId: "fone" });
  const rows = [
    click, click,
    doc("b", { dia: "2026-10-07", origem: "evento:clique_oferta:fone:site" }),
    doc("c", { dia: "2026-10-07", tipo: "clique_secao", canal: "view:google", produtoId: "fone" }),
    doc("d", { dia: "2026-10-06", origem: "/" }),
    doc("e", { dia: "2026-09-25", origem: "/" }),
    doc("f", { dia: "2026-10-08", tipo: "clique_oferta", produtoId: "futuro" }),
  ];
  const grouped = metrics.resumirDocumentos(rows, metrics.decodificar);
  const c = metrics.contar(grouped, "2026-10-07");
  assert.equal(c.cliques7, 2);
  assert.equal(c.produtosClicados7, 1);
  assert.equal(c.visualizacoes7, 1);
  assert.equal(c.taxa, 200, "eventos não são conversão de pessoas; não esconder valores acima de 100%");
  assert.equal(c.visitas7, 1);
  assert.equal(c.visitas14, 2);
  assert.equal(metrics.inicio(metrics.diaBrasil(Date.parse("2026-10-08T01:00:00Z")), 7), "2026-10-01");
});

test("dashboard e móvel compartilham cache, refresh e histórico sem consultas repetidas", async () => {
  const values = new Map();
  const armazenamento = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  let clock = now, queries = 0;
  const lerDocumentos = async desde => {
    queries++;
    assert.equal(desde, queries === 1 ? "2026-09-24" : "2026-10-07");
    return { docs: [doc("view", { dia: "2026-10-07", tipo: "clique_secao", canal: "view:site", produtoId: "p" }),
      ...(queries === 1 ? [doc("old", { dia: "2026-09-25", origem: "/" })] : []),
      ...(queries > 1 ? [doc("click", { dia: "2026-10-07", tipo: "clique_oferta", produtoId: "p" })] : [])] };
  };
  const options = { armazenamento, lerDocumentos, agora: () => clock, diaAtual: () => "2026-10-07" };
  const dashboard = metrics.criarLeitor(options), mobile = metrics.criarLeitor(options);
  await dashboard.ler();
  await mobile.ler(true);
  assert.equal(queries, 1, "abrir outro painel e atualizar imediatamente reutiliza a mesma consulta");
  clock += 61000;
  const atualizado = await mobile.ler(true);
  const outro = await dashboard.ler();
  assert.equal(queries, 2);
  assert.equal(outro.atualizadoEm, atualizado.atualizadoEm);
  assert.equal(metrics.contar(outro.registros, "2026-10-07").visitas14, 1, "preserva semana anterior");
  assert.equal(metrics.contar(outro.registros, "2026-10-07").cliques7, 1);
  assert.equal(metrics.total(outro.registros), 3, "releitura substitui, não soma o dia atual");
});

test("falha de consulta preserva os dados e a data verdadeira, não simula atualização", async () => {
  const values = new Map();
  const resumo = metrics.combinar(null, [{ dia: "2026-10-07", tipo: "visita", quantidade: 4 }],
    "2026-09-24", "2026-09-24", "2026-10-07", now - 300000);
  values.set(metrics.CHAVE_CACHE, JSON.stringify(resumo));
  const reader = metrics.criarLeitor({
    armazenamento: { getItem: key => values.get(key), setItem() { throw Error("não deveria gravar"); } },
    agora: () => now, diaAtual: () => "2026-10-07", lerDocumentos: async () => { throw Error("indisponível"); }
  });
  const snapshot = await reader.ler(true);
  assert.equal(snapshot.desatualizado, true);
  assert.equal(snapshot.atualizadoEm, now - 300000);
  assert.equal(metrics.contar(snapshot.registros, "2026-10-07").visitasHoje, 4);
});

const growth = await read("growth-tools.js");
const sitemap = await read("scripts/generate-sitemap.mjs");
const discovery = await read("scripts/generate-discovery.mjs");
const upgrade = discovery.slice(discovery.indexOf("function upgradeProductExperience("), discovery.indexOf("async function addRelatedLinks("));
const generatedLine = sitemap.split("\n").find(line => line.includes("navigator.clipboard.writeText") && line.includes("share-product"));
const inline = vm.runInNewContext("`" + generatedLine.trim() + "`", {
  product: { id: "p" }, title: "Fone", marketplace: "mercadolivre", shareUrl: "https://rankingdacompra.com.br/produto/p.html"
});
const upgradeContext = vm.createContext({ GROWTH_TOOLS_VERSION: "20261007-counters", MOBILE_PRODUCT_STYLE: "", escapeHtml: x => x });
vm.runInContext(upgrade, upgradeContext);

test("atualização retira o listener móvel duplicado e é idempotente", () => {
  const legacy = '<main></main><a id="mobile-affiliate-offer"></a>' + inline +
    '<script data-mobile-offer-track>document.getElementById("mobile-affiliate-offer")?.addEventListener("click",function(){gtag("event","select_item")});</script>';
  const upgraded = upgradeContext.upgradeProductExperience(legacy);
  assert.equal((upgraded.match(/getElementById\(['"]mobile-affiliate-offer['"]\)\?\.addEventListener/g) || []).length, 1);
  assert.equal(upgradeContext.upgradeProductExperience(upgraded), upgraded);
  const old = '<main></main><a id="mobile-affiliate-offer"></a><body></body>';
  const fallback = upgradeContext.upgradeProductExperience(old);
  assert.equal((fallback.match(/data-mobile-offer-track/g) || []).length, 1);
  assert.equal(upgradeContext.upgradeProductExperience(fallback), fallback);
});

function trackingContext(navigator) {
  const firebase = [], analytics = [], listeners = [], elements = new Map();
  for (const id of ["affiliate-offer", "mobile-affiliate-offer", "affiliate-offer-shopee", "share-product", "share-status"])
    elements.set(id, { id, listeners: [], addEventListener(type, fn) { this.listeners.push(fn); },
      closest(selector) { return selector.split(",").some(s => s.trim() === "#" + id) ? this : null; } });
  const context = vm.createContext({
    window: {}, document: { documentElement: { dataset: {} }, getElementById: id => elements.get(id),
      addEventListener: (type, fn) => listeners.push(fn) },
    funnelProduct: () => ({ id: "p" }), METRICS_VIEW_INTERVAL_MS: 1800000,
    localStorage: { getItem: () => String(Date.now()) },
    recordFunnelMetric: async (type, el) => firebase.push({ type, id: el.id }),
    gtag: (...args) => analytics.push(args), navigator, console
  });
  vm.runInContext(growth.slice(growth.indexOf("  function setupFunnelTracking() {"), growth.indexOf("  function escapeHtml(")) +
    "\nsetupFunnelTracking();setupFunnelTracking();", context);
  vm.runInContext(inline.replace(/^<script>/, "").replace(/<\/script>$/, ""), context);
  return { firebase, analytics, listeners, elements };
}

test("botões principal, fixo do celular e Shopee registram uma vez em cada coletor", async () => {
  const t = trackingContext({ share: async () => {} });
  assert.equal(t.listeners.length, 1);
  for (const id of ["affiliate-offer", "mobile-affiliate-offer", "affiliate-offer-shopee"]) {
    t.firebase.length = 0; t.analytics.length = 0;
    const element = t.elements.get(id), event = { target: element };
    for (const listener of element.listeners) await listener(event);
    for (const listener of t.listeners) await listener(event);
    assert.equal(t.firebase.length, 1, id);
    assert.equal(t.analytics.length, 1, id);
  }
});

test("compartilhar/copiar concluído conta, cancelamento ou falha não conta", async () => {
  for (const navigator of [{ share: async () => {} }, { clipboard: { writeText: async () => {} } },
    { share: async () => { throw { name: "AbortError" }; } }, { clipboard: { writeText: async () => { throw Error("negado"); } } }]) {
    const t = trackingContext(navigator);
    await t.elements.get("share-product").listeners[0]();
    const success = t.analytics.length;
    assert.equal(t.firebase.length, success);
    assert.equal(success, navigator.share ? (String(navigator.share).includes("throw") ? 0 : 1) :
      String(navigator.clipboard.writeText).includes("throw") ? 0 : 1);
  }
});

test("os dois painéis usam os mesmos campos e helper; ranking móvel continua com sete dias", async () => {
  const dashboard = await read("dashboard.html"), mobile = await read("painel-celular.html");
  const keys = html => [...html.matchAll(/data-metrica="([^"]+)"/g)].map(x => x[1]).sort();
  assert.deepEqual(keys(mobile), keys(dashboard));
  assert.match(dashboard, /RankingMetricasResumo\.criarLeitor/);
  assert.match(mobile, /RankingMetricasResumo\.criarLeitor/);
  assert.match(mobile, /\.filter\(m => m\.dia >= chave && m\.dia <= hoje\(\)\)/);
  assert.doesNotMatch(growth.slice(growth.indexOf("async function recordFunnelMetric"), growth.indexOf("function setupFunnelTracking")),
    /marketplace\s*:/, "não adicionar campo rejeitado pelas regras do Firestore");
});
