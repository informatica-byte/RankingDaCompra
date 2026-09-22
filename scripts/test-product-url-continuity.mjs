import test from "node:test";
import assert from "node:assert/strict";
import { productAliasPage, selectCanonicalProducts, unavailableProductPage } from "./product-url-continuity.mjs";

test("mantém só uma página principal e mapeia os endereços duplicados", () => {
  const old = { id: "antigo", score: 1 };
  const current = { id: "principal", score: 2 };
  const { selected, aliases } = selectCanonicalProducts(
    [{ products: [old, current] }],
    (product) => product.score,
  );
  assert.deepEqual(selected, [current]);
  assert.equal(aliases.get("antigo"), current);
  assert.equal(aliases.has("principal"), false);
});

test("página duplicada aponta somente para a análise principal e não mostra preço antigo", () => {
  const target = "https://rankingdacompra.com.br/produto/principal-20260810-1.html";
  const html = productAliasPage("Fone <Bluetooth>", target);
  assert.match(html, /http-equiv="refresh"/);
  assert.match(html, /rel="canonical" href="https:\/\/rankingdacompra.com.br\/produto\/principal-20260810-1.html"/);
  assert.match(html, /noindex,follow/);
  assert.match(html, /Fone &lt;Bluetooth&gt;/);
  assert.doesNotMatch(html, /R\$\s*\d/);
});

test("não redireciona para loja externa nem para uma URL arbitrária", () => {
  assert.throws(() => productAliasPage("Teste", "https://mercadolivre.com.br/item"), /Destino/);
  assert.throws(() => productAliasPage("Teste", "https://rankingdacompra.com.br/dashboard.html"), /Destino/);
});

test("página retirada preserva o endereço sem exibir preço ou link de compra antigo", () => {
  const oldHtml = '<title>Fone ABC: R$ 99,90: vale a pena?</title><a href="https://mercadolivre.com.br/item">Comprar</a>';
  const html = unavailableProductPage(oldHtml);
  assert.match(html, /noindex,follow/);
  assert.match(html, /Fone ABC/);
  assert.match(html, /analises\.html/);
  assert.doesNotMatch(html, /99,90|mercadolivre\.com\.br/);
});
