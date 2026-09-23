import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const shared = await readFile(new URL("../growth-tools.js", import.meta.url), "utf8");
const generator = await readFile(new URL("./generate-sitemap.mjs", import.meta.url), "utf8");
const names = ["statusMercadoLivre", "produtoDisponivel", "precoConfirmadoRecente", "registroPreco", "rotuloPrecoSeguro", "getPrice"];
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
  moeda: value => `R$ ${Number(value).toFixed(2)}`,
  queueMicrotask,
  document: { getElementById: () => null },
});
vm.runInContext(source, context);
const product = { id: "produto-teste", preco: "100,00" };

assert.equal(await context.getPrice(product), "Conferir preço atual no vendedor");
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

assert.ok(shared.includes('offer.textContent = "Conferir preço atual no Mercado Livre"'));
assert.ok(shared.includes('document.getElementById("mobile-affiliate-offer")'));
assert.ok(!shared.includes('offer.removeAttribute("href")'), "link de indicação não pode ser removido por preço antigo");
assert.ok(generator.includes('const indexable = editorial && offerUrl !== "#";'));
assert.ok(generator.includes('if (offerUrl !== "#" && confirmed) structuredOffers.push'));
console.log("Preço seguro e preservação dos links de indicação: OK");
