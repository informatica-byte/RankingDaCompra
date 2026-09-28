import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const HOME = resolve("index.html");
const TOP = resolve("top5-semanal.json");
const SEARCH = resolve("search-index.json");
const START = "<!-- static-home-products:start -->";
const END = "<!-- static-home-products:end -->";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function validHttps(value) {
  return /^https:\/\//i.test(String(value || "")) ? String(value) : "";
}

function productPath(product) {
  const url = validHttps(product.productUrl);
  if (!url) return "analises.html";
  try {
    const parsed = new URL(url);
    return `${parsed.pathname.replace(/^\//, "")}${parsed.search}`;
  } catch {
    return "analises.html";
  }
}

const [home, weekly, search] = await Promise.all([
  readFile(HOME, "utf8"),
  readFile(TOP, "utf8").then(JSON.parse),
  readFile(SEARCH, "utf8").then(JSON.parse),
]);

const products = (Array.isArray(weekly.products) ? weekly.products : [])
  .filter((product) => product?.id && product?.titulo && validHttps(product?.foto))
  .slice(0, 6);

if (!products.length) throw new Error("O Top semanal não contém produtos suficientes para a página inicial estática.");

const cards = products.map((product, index) => {
  const price = String(product.precoPromocional || product.preco || "").trim();
  return `<article class="static-product-card"><a href="${escapeHtml(productPath(product))}"><img src="${escapeHtml(product.foto)}" alt="${escapeHtml(product.titulo)}" width="220" height="180" loading="${index < 3 ? "eager" : "lazy"}" decoding="async"><span>${index + 1}º destaque da semana</span><h2>${escapeHtml(product.titulo)}</h2>${price ? `<strong>Preço informado: R$ ${escapeHtml(price)}</strong>` : ""}<small>Ver análise, pontos positivos e limitações →</small></a></article>`;
}).join("");

const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const categories = new Map((search.categories || []).map((category) => [normalize(category.id), category]));
const guideAliases = new Map([
  ["camerasdeseguranca", "cameras-de-seguranca"], ["fonesdeouvido", "fones-de-ouvido"],
  ["fritadeiraairfrayereletrica", "fritadeira-air-fryer-eletrica"], ["relogiosmartwatch", "relogio-smartwatch"],
]);
const highlightedCategories = [...new Map(products.map((product) => {
  const key = normalize(product.categoria);
  const category = categories.get(key) || [...categories.values()].find((item) => normalize(item.name) === key);
  const slug = guideAliases.get(key) || category?.id || String(product.categoria || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return [slug, { slug, name: category?.name || product.categoria }];
})).values()].filter((category) => category.slug).slice(0, 3);
const guides = highlightedCategories.map((category) => `<a href="melhores-${escapeHtml(category.slug)}.html"><b>Melhores opções de ${escapeHtml(category.name)}</b><span>Comparativo atualizado da categoria →</span></a>`).join("");

const block = `${START}<main class="wrap static-home" aria-label="Produtos e comparativos em destaque"><section><div class="section-head"><div><div class="eyebrow">Seleção rastreável desta semana</div><h2>Produtos para comparar antes de comprar</h2><p>Conteúdo disponível diretamente no HTML, com análise, preço informado e limitações.</p></div><a href="analises.html">Ver todos os comparativos</a></div><div class="static-product-grid">${cards}</div><h2 class="static-guides-title">Três comparativos para consultar nesta semana</h2><nav class="static-guide-grid" aria-label="Comparativos prioritários da semana">${guides}</nav><p class="static-method">Seleção atualizada em ${escapeHtml(weekly.weekStart || weekly.updatedAt || "data recente")}. Revisão da <a href="sobre.html">Equipe Ranking da Compra</a>. <a href="como-avaliamos.html">Veja como classificamos os produtos</a>.</p></section></main>${END}`;

let output;
if (home.includes(START) && home.includes(END)) {
  output = home.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
} else {
  output = home.replace(/<main class="wrap"><p class="loading"/, `${block}<main class="wrap"><p class="loading"`);
}

if (output === home && !(home.includes(START) && home.includes(END))) throw new Error("Não foi possível localizar o ponto de inserção na página inicial.");
await writeFile(HOME, output, "utf8");
console.log(`Página inicial estática atualizada com ${products.length} produtos, sem leitura adicional do Firebase.`);

