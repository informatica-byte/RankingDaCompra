import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const shared = await readFile(new URL("../growth-tools.js", import.meta.url), "utf8");
const generator = await readFile(new URL("./generate-sitemap.mjs", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/update-sitemap.yml", import.meta.url), "utf8");
assert.match(generator, /writeFile\(PARTIAL_GENERATION_MARKER,[^]*?process\.exit\(0\)/,
  "falha na fonte de produtos deve preservar os arquivos publicados");
assert.match(workflow, /if \[\[ -f \.ranking-generation-partial \]\]; then[^]*?exit 0/,
  "o fluxo não pode reconstruir descoberta ou validar dados parciais");
const names = ["statusMercadoLivre", "millisConferenciaManual", "precoManualProduto", "fontePrecoSeguro",
  "produtoDisponivel", "precoConfirmadoRecente", "registroPreco", "rotuloPrecoSeguro", "getPrice"];
const source = names.map(name => {
  const line = html.split("\n").find(value => value.startsWith(`function ${name}(`));
  assert.ok(line, `${name} ausente`);
  return line;
}).join("\n");
const now = Date.now();
const statuses = {};
const context = vm.createContext({
  Date, Number, Promise, Intl,
  mercadoLivreStatus: statuses,
  numeroPreco: value => Number(String(value || "").replace(",", ".")) || 0,
  promocaoValida: () => false,
  moeda: value => `R$ ${Number(value).toFixed(2)}`,
  queueMicrotask,
  document: { getElementById: () => null },
});
vm.runInContext(source, context);
const product = { id: "produto-teste", preco: "100,00" };

assert.equal(await context.getPrice(product), "Último preço cadastrado: R$ 100.00 (não confirmado)");
statuses[product.id] = { managed: true, status: "active", available: true, visible: true, price: 90,
  checkedAt: new Date(now - 60 * 60 * 1000).toISOString() };
assert.equal(await context.getPrice(product), "R$ 90.00");
statuses[product.id].checkedAt = new Date(now - 72 * 60 * 60 * 1000).toISOString();
assert.match(await context.getPrice(product), /^Último preço registrado: R\$ 90\.00/);
statuses[product.id].visible = false;
statuses[product.id].unavailableChecks = 2;
assert.equal(context.produtoDisponivel(product), true, "bloqueio antigo não pode eliminar indicação");
statuses[product.id].checkedAt = new Date(now - 60 * 60 * 1000).toISOString();
assert.equal(context.produtoDisponivel(product), false, "indisponibilidade recente confirmada deve proteger comprador");
const manuallyChecked = {
  id: "top6-manual",
  preco: "100,00",
  precoAtualizadoManualmente: true,
  precoAtualizadoManualmenteEm: new Date(now - 10 * 60 * 1000).toISOString(),
};
assert.equal(context.precoConfirmadoRecente(manuallyChecked), true,
  "conferência manual recente do Top 6 deve aparecer como confirmada");
assert.match(generator, /precoAtualizadoManualmenteEm:\s*product\.precoAtualizadoManualmenteEm/,
  "o gerador deve preservar o horário da conferência manual no Top 6");
const priceFunctions = ["numberPrice", "currentPriceFromCard"].map(name => {
  const match = shared.match(new RegExp("  function " + name + "\\([^]*?\\n  \\}"));
  assert.ok(match, name + " ausente");
  return match[0];
}).join("\n");
const extractCardPrice = vm.runInNewContext(priceFunctions + "\ncurrentPriceFromCard");
assert.equal(extractCardPrice({
  querySelector: () => ({ textContent: "Preço conferido em 23/09/2026: R$ 561,11" }),
}), 561.11, "a data da conferência não pode ser confundida com o valor do produto");
const highlightsSource = shared.match(/  function weeklyHighlights\(products\) \{[^]*?\n  \}/)?.[0];
assert.ok(highlightsSource, "destaques do comparativo ausentes");
const highlights = vm.runInNewContext(highlightsSource + "\nweeklyHighlights", {
  numberPrice: value => Number(value) || 0,
  brl: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
});
const comparison = [
  { id: "a", preco: 35.99, scoreTotal: 8.2, criterios: { custoBeneficio: 10 }, clicks: 0, views: 0 },
  { id: "b", preco: 74, scoreTotal: 8, criterios: { custoBeneficio: 7 }, clicks: 3, views: 8 },
  { id: "c", preco: 91, scoreTotal: 7.5, criterios: { custoBeneficio: 6 }, clicks: 0, views: 0 },
];
const highlighted = highlights(comparison);
assert.equal(new Set(highlighted.map(entry => entry.item.id)).size, highlighted.length,
  "o mesmo produto não deve ocupar três destaques separados");
assert.match(highlighted[0].detail, /custo-benefício.*menor preço/,
  "os méritos acumulados do vencedor devem continuar visíveis");
assert.ok(!shared.includes('"Cinco opções comparadas até "'),
  "a descrição não deve repetir um teto cadastrado que contradiz os produtos");

assert.ok(shared.includes('offer.textContent = "Conferir preço atual no Mercado Livre"'));
assert.ok(shared.includes('document.getElementById("mobile-affiliate-offer")'));
assert.ok(!shared.includes('offer.removeAttribute("href")'), "link de indicação não pode ser removido por preço antigo");
assert.ok(generator.includes('const indexable = editorial && offerUrl !== "#";'));
assert.ok(generator.includes('if (offerUrl !== "#" && confirmed) structuredOffers.push'));
console.log("Preço seguro e preservação dos links de indicação: OK");
