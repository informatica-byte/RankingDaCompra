import test from "node:test";
import assert from "node:assert/strict";
import { legacyProductAliases, productAliasPage, selectCanonicalProducts, unavailableProductPage } from "./product-url-continuity.mjs";
import { readFileSync } from "node:fs";

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

test("endereço legado observado aponta para o mesmo cadastro disponível", () => {
  const current = { id: "5FQyewGiYpron6Bn32d1", titulo: "Escorredor" };
  const registry = JSON.parse(readFileSync(new URL("../product-url-aliases.json", import.meta.url), "utf8"));
  assert.equal(legacyProductAliases(registry, [current]).get("5FQyewGiYpron6Bn32d1.html"), current);
});

test("não cria destino para retirado, nem para duplicado cujo principal não é publicável", () => {
  const canonical = { id: "principal" };
  const duplicates = new Map([["duplicado", canonical]]);
  assert.equal(legacyProductAliases({ "retirado.html": "ausente" }, []).size, 0);
  assert.equal(legacyProductAliases({ "antigo.html": "duplicado" }, [], duplicates).size, 0);
  assert.equal(legacyProductAliases({ "antigo.html": "duplicado" }, [canonical], duplicates).get("antigo.html"), canonical);
});

test("registro de continuidade recusa caminhos externos e travessia de diretório", () => {
  for (const file of ["../dashboard.html", "https://example.com/x.html", "produto/x.html", "x.html?y=1"]) {
    assert.throws(() => legacyProductAliases({ [file]: "produto" }, []), /inválido/);
  }
  assert.throws(() => legacyProductAliases({ "antigo.html": "../../produto" }, []), /inválido/);
  assert.throws(() => legacyProductAliases([], []), /inválido/);
});

test("gerador preserva os aliases explícitos sem incluí-los no sitemap", () => {
  const source = readFileSync(new URL("./generate-sitemap.mjs", import.meta.url), "utf8");
  assert.match(source, /legacyProductAliases\(legacyRegistry, validProducts, productAliasTargets\)/);
  assert.match(source, /expectedPages\.add\(fileName\)/);
  const html = productAliasPage("Escorredor", "https://rankingdacompra.com.br/produto/5FQyewGiYpron6Bn32d1-20260810-1.html");
  assert.match(html, /noindex,follow/);
  assert.match(html, /content="0;url=https:\/\/rankingdacompra.com.br\/produto\/5FQyewGiYpron6Bn32d1-20260810-1.html"/);
  const workflow = readFileSync(new URL("../.github/workflows/update-sitemap.yml", import.meta.url), "utf8");
  assert.match(workflow, /- "product-url-aliases\.json"/);
  assert.match(workflow, /- "scripts\/product-url-continuity\.mjs"/);
});
