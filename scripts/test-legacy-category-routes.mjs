import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const home = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const routeScript = [...home.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1]).find((source) => source.includes("window.RANKING_CATEGORY_GUIDES="));
const observedLegacyRoutes = {
  belezaecuidados: "melhores-beleza-cuidados-e-saude.html",
  fonesdeouvido: "melhores-fones-de-ouvido.html",
  impressoras: "melhores-impressoras.html",
  kitbodysplashmasculino: "melhores-perfumes.html",
  "roupas-e-calcados": "melhores-roupas-e-calcados.html",
  "fritadeiraairfrayerelétrica": "melhores-fritadeira-air-fryer-eletrica.html",
  casa: "melhores-casa.html",
};

function resolveCategory(search) {
  assert.ok(routeScript, "O redirecionamento preventivo deve permanecer no HTML inicial.");
  const redirects = [];
  runInNewContext(routeScript, {
    window: {}, URL, URLSearchParams,
    location: { search, origin: "https://rankingdacompra.com.br", replace: (url) => redirects.push(url) },
  });
  return redirects;
}

for (const [category, file] of Object.entries(observedLegacyRoutes)) {
  test(`categoria antiga ${category} leva ao comparativo atual, sem soft 404`, () => {
    const target = `https://rankingdacompra.com.br/${file}`;
    assert.deepEqual(resolveCategory(`?cat=${encodeURIComponent(category)}`), [target]);
    const html = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(html.includes(`rel="canonical" href="${target}"`), "O destino deve ter canonical próprio.");
    assert.match(html, /<meta name="robots" content="index,follow/);
    assert.doesNotMatch(html, /Conteúdo não encontrado|Esta análise não está disponível/);
  });
}

test("categorias antigas mantêm normalização de acentos, caixa e separadores", () => {
  assert.deepEqual(resolveCategory("?cat=Beleza%20e%20Cuidados"), ["https://rankingdacompra.com.br/melhores-beleza-cuidados-e-saude.html"]);
  assert.deepEqual(resolveCategory("?cat=ROUPAS%20E%20CAL%C3%87ADOS"), ["https://rankingdacompra.com.br/melhores-roupas-e-calcados.html"]);
});

test("não inventa redirecionamento para categoria desconhecida, destino externo ou home sem filtro", () => {
  for (const search of ["", "?cat=", "?cat=inexistente", "?cat=https%3A%2F%2Fexample.com"]) {
    assert.deepEqual(resolveCategory(search), []);
  }
});
