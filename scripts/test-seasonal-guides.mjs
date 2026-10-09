import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { confirmedPrice, generateSeasonalGuides, guideTitle, GUIDE_THEMES, recordedPrice, selectGuideProducts, suitableForGuide } from "./generate-seasonal-guides.mjs";

const now = new Date("2026-09-29T12:00:00Z");
const theme = GUIDE_THEMES.find(item => item.id === "criancas");
const products = Array.from({ length: 7 }, (_, index) => ({
  id: `teste-${index}`,
  titulo: `Brinquedo educativo de montar ${index}`,
  categoriaNome: "Brinquedos",
  comentario: "Um brinquedo para comparar por faixa etária, material, tamanho das peças e interesse da criança antes de comprar.",
  foto: "https://example.com/brinquedo.jpg",
  url: `https://rankingdacompra.com.br/produto/teste-${index}.html`,
  preco: "89,90",
  precoAtualizadoManualmente: true,
  precoAtualizadoManualmenteEm: index === 6 ? "2026-09-27T10:00:00Z" : "2026-09-29T10:00:00Z",
}));

test("preço somente após conferência manual recente", () => {
  assert.equal(confirmedPrice(products[0], now)?.amount, 89.9);
  assert.equal(confirmedPrice(products[6], now), null);
  assert.equal(recordedPrice(products[6], now)?.amount, 89.9);
  assert.equal(recordedPrice(products[6], now)?.fresh, false);
  assert.equal(confirmedPrice({ ...products[0], precoAtualizadoManualmente: false }, now), null);
  assert.equal(recordedPrice({ ...products[0], precoAtualizadoManualmente: false }, now), null);
});

test("título com limite de preço exige pelo menos cinco itens conferidos", () => {
  const selected = selectGuideProducts(products, theme, now);
  assert.equal(guideTitle(theme, "Presentes para o Dia das Crianças até R$ 100", selected), "Presentes para o Dia das Crianças até R$ 100");
  assert.equal(guideTitle(theme, "Presentes para o Dia das Crianças até R$ 50", selected), theme.title);
  assert.equal(guideTitle(theme, "Os melhores produtos da internet", selected), theme.title);
});

test("gera páginas independentes com metadados e links, sem alterar produtos", async () => {
  const root = await mkdtemp(join(tmpdir(), "ranking-presentes-"));
  try {
    const before = JSON.stringify(products);
    const urls = await generateSeasonalGuides(products, { seasonalThemeMode: "manual", seasonalThemeId: "criancas" }, { root, now });
    assert.ok(urls.some(item => item.url.endsWith("/presentes/dia-das-criancas.html")));
    const html = await readFile(join(root, "presentes", "dia-das-criancas.html"), "utf8");
    assert.match(html, /<link rel="canonical" href="https:\/\/rankingdacompra\.com\.br\/presentes\/dia-das-criancas\.html">/);
    assert.match(html, /<h1>Presentes para o Dia das Crianças/);
    assert.match(html, /R\$\s*89,90/);
    assert.match(html, /Último preço registrado/);
    assert.match(html, /Registrado em 27\/09\/2026/);
    assert.match(html, /produto\/teste-0\.html/);
    assert.equal(JSON.stringify(products), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("guia infantil exclui GTA e itens explicitamente adultos, preservando cadastro", () => {
 const gta={...products[0],titulo:"Grand Theft Auto VI - PlayStation 5"};
 assert.equal(suitableForGuide(gta,theme),false);
 assert.equal(suitableForGuide({...products[0],titulo:"Carro RC para adultos"},theme),false);
 assert.equal(suitableForGuide({...products[0],titulo:"GTA VI PS5"},theme),false);
 assert.equal(suitableForGuide({...products[0],comentario:"Jogo classificado 17+"},theme),false);
 assert.equal(suitableForGuide(products[0],theme),true);
 assert.equal(selectGuideProducts([gta],theme,now).length,0);
 assert.equal(suitableForGuide(gta,GUIDE_THEMES.find(t=>t.id==="natal")),true);
});
test("conferência e nota não tornam produto sem relação elegível ao tema",()=>{
 const unrelated={...products[0],titulo:"Roteador AX1500",categoriaNome:"Roteadores",nota:5};
 assert.equal(selectGuideProducts([unrelated],theme,now).length,0);
});
