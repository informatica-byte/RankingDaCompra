import test from "node:test";
import assert from "node:assert/strict";
import { legacyProductAliases, observedProductAliases, productAliasPage, retiredProductTitle, selectCanonicalProducts, unavailableProductPage } from "./product-url-continuity.mjs";
import { readFileSync } from "node:fs";
import { refreshedRetiredPage } from "./refresh-retired-pages.mjs";

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
  assert.doesNotMatch(html, /rel="canonical"|http-equiv="refresh"|application\/ld\+json/);
  assert.match(html, /<form action="https:\/\/rankingdacompra.com.br\/" method="get">/);
  assert.match(html, /name="busca"/);
  assert.match(html, /sem assumir que são o mesmo produto/);
});

test("republicar uma análise retirada mantém o nome, sem preço e sem canônica genérica", () => {
  const first = unavailableProductPage('<title>Fone ABC: R$ 99,90: vale a pena? | Ranking da Compra</title>');
  const second = unavailableProductPage(first);
  assert.equal(retiredProductTitle(first), "Fone ABC");
  assert.equal(second, first);
  assert.match(second, /rdc-retired-product-title" content="Fone ABC"/);
  assert.doesNotMatch(second, /99,90|rel="canonical"|não disponível não consta/);
});

test("busca de recuperação não injeta HTML nem conserva entidades duplicadas", () => {
  const oldHtml = '<title>Fone &quot;ABC&quot; &amp; Cabo &#60;USB&#62; | Ranking da Compra</title>';
  const first = unavailableProductPage(oldHtml);
  assert.equal(retiredProductTitle(first), 'Fone "ABC" & Cabo <USB>');
  assert.equal(unavailableProductPage(first), first);
  assert.match(first, /value="Fone &quot;ABC&quot; &amp; Cabo &lt;USB&gt;"/);
  assert.doesNotMatch(first, /<USB>|&amp;quot;|&amp;lt;/);
});

test("stub anterior sem nome não inventa nome do produto nem consulta o Firebase", () => {
  const oldHtml = '<title>Análise não disponível | Ranking da Compra</title><p>Análise não disponível não consta na seleção atual.</p>';
  const html = unavailableProductPage(oldHtml);
  assert.equal(retiredProductTitle(oldHtml), "");
  assert.match(html, /O produto consultado não consta/);
  assert.match(html, /name="busca" type="search" value=""/);
  assert.doesNotMatch(html, /rdc-retired-product-title|firestore|firebase|mercadolivre|shopee/i);
});

const currentCatalogue = { version: 1, generatedAt: "2026-10-11T12:02:20.000Z", products: [{ id: "atual" }] };

test("reparo offline aceita somente stub retirado reconhecido e recusa catálogo ou caminhos inválidos", () => {
  const oldHtml = unavailableProductPage('<title>Fone ABC: R$ 99,90</title>');
  assert.equal(refreshedRetiredPage("retirado-20260810-1.html", oldHtml, currentCatalogue), oldHtml);
  assert.throws(() => refreshedRetiredPage("../index.html", oldHtml, currentCatalogue), /inválido/);
  assert.throws(() => refreshedRetiredPage("retirado.html", '<h1>Página comercial</h1>', currentCatalogue), /não é uma página retirada/);
  assert.throws(() => refreshedRetiredPage("retirado.html", oldHtml, { ...currentCatalogue, products: [] }), /Snapshot/);
  assert.throws(() => refreshedRetiredPage("retirado.html", oldHtml, { ...currentCatalogue, generatedAt: "desconhecida" }), /Snapshot/);
});

test("reparo offline nunca transforma produto atual ou alias em página retirada", () => {
  const oldHtml = unavailableProductPage('<title>Fone ABC</title>');
  assert.throws(() => refreshedRetiredPage("atual-20260810-1.html", oldHtml, currentCatalogue), /Produto atual/);
  assert.throws(() => refreshedRetiredPage("antigo.html", oldHtml, currentCatalogue, { "antigo.html": "atual" }), /alias preservado/);
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

test("trocar a versão preserva endereços observados do mesmo cadastro atual, sem restaurar IDs retirados", () => {
  const current = { id: "atual", titulo: "Fone ABC" };
  const aliases = observedProductAliases(["atual-20260810-1.html", "atual-20261011-2.html", "retirado-20260810-1.html", "imagem.json"], [current]);
  assert.deepEqual([...aliases.keys()], ["atual-20260810-1.html", "atual-20261011-2.html"]);
  assert.equal(aliases.get("atual-20260810-1.html"), current);
  assert.equal(aliases.has("retirado-20260810-1.html"), false);
});

test("versão observada de duplicado depende do principal comprovado ainda publicável", () => {
  const current = { id: "principal" };
  const duplicates = new Map([["duplicado", current]]);
  assert.equal(observedProductAliases(["duplicado-20260810-1.html"], [current], duplicates).get("duplicado-20260810-1.html"), current);
  assert.equal(observedProductAliases(["duplicado-20260810-1.html"], [], duplicates).size, 0);
});

test("continuidade de versões recusa caminhos externos e não adivinha arquivos ausentes", () => {
  const current = { id: "atual" };
  assert.equal(observedProductAliases([], [current]).size, 0);
  for (const file of ["../atual-20260810-1.html", "produto/atual-20260810-1.html", "https://example.com/atual-20260810-1.html"]) {
    assert.throws(() => observedProductAliases([file], [current]), /inválida/);
  }
  assert.throws(() => observedProductAliases({}, [current]), /inválida/);
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
