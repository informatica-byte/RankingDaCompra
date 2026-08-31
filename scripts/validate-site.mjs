import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://rankingdacompra.com.br/";
const errors = [];

function fail(message) { errors.push(message); }
function has(html, pattern, label, file) { if (!pattern.test(html)) fail(file + ": " + label); }
function productIdentity(html) {
  const mlb = html.match(/\bMLB[-_\s]?(\d{6,})\b/i);
  if (mlb) return "mlb:" + mlb[1];
  const affiliate = html.match(/https:\/\/meli\.la\/[A-Za-z0-9_-]+/i);
  return affiliate ? "affiliate:" + affiliate[0].toLowerCase() : "";
}

const homeHtml = await readFile(resolve("index.html"), "utf8");
has(homeHtml, /const rotaInicial=.*:homeComPromocoes\(\)/, "a vitrine inicial ainda espera serviços externos antes de aparecer", "index.html");
has(homeHtml, /qualidadeHistoricoSemanal/, "priorização do Top 6 pelo histórico ausente", "index.html");
has(homeHtml, /id="offers-loading"/, "estado visual de carregamento imediato ausente", "index.html");

const growthTools = await readFile(resolve("growth-tools.js"), "utf8");
has(growthTools, /Preço atual acima do menor valor recente/, "aviso honesto para preço acima do histórico ausente", "growth-tools.js");
if (growthTools.includes("✓ Oferta comprovada pelo histórico")) fail("growth-tools.js: afirmação genérica de oferta comprovada ainda presente");

const sitemapGenerator = await readFile(resolve("scripts/generate-sitemap.mjs"), "utf8");
has(sitemapGenerator, /Custo-benefício editorial:/, "explicação da avaliação editorial ausente", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /overlap < 0\.8/, "filtro contra pontos copiados do título ausente", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /<script defer src="\/growth-tools\.js"><\/script>/, "corretor editorial não foi incluído nas páginas de produto", "scripts/generate-sitemap.mjs");

const sitemap = await readFile(resolve("sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
const uniqueUrls = new Set(urls);
if (!urls.length) fail("sitemap.xml: nenhum endereço encontrado");
if (uniqueUrls.size !== urls.length) fail("sitemap.xml: existem endereços duplicados");

const identities = new Map();
for (const url of urls) {
  if (!url.startsWith(SITE)) { fail("Domínio inesperado no sitemap: " + url); continue; }
  if (!url.startsWith(SITE + "produto/")) continue;
  const relative = decodeURIComponent(url.slice(SITE.length));
  let html = "";
  try { html = await readFile(resolve(relative), "utf8"); }
  catch { fail(relative + ": arquivo informado no sitemap não existe"); continue; }

  has(html, /<title>[^<]{10,}<\/title>/i, "título ausente ou curto", relative);
  has(html, /<meta\s+name="description"\s+content="[^"]{50,}"/i, "descrição ausente ou curta", relative);
  has(html, /<meta\s+property="og:image"\s+content="https:\/\/rankingdacompra\.com\.br\/produto\/imagens\/[^"]+"/i, "imagem social local ausente", relative);
  has(html, /"@type":"Product"/i, "dados estruturados de produto ausentes", relative);
  if (!html.includes('rel="canonical" href="' + url + '"')) fail(relative + ": endereço canônico divergente");
  if (/name="robots"\s+content="[^"]*noindex/i.test(html)) fail(relative + ": página do sitemap marcada como noindex");
  if (html.includes("\uFFFD")) fail(relative + ": caractere corrompido encontrado");

  const identity = productIdentity(html);
  if (!identity) continue;
  const previous = identities.get(identity);
  if (previous) fail("Produto duplicado (" + identity + "): " + previous + " e " + relative);
  else identities.set(identity, relative);
}

for (const file of ["como-avaliamos.html", "sobre.html", "politica-afiliados.html", "privacidade.html", "contato.html"]) {
  const html = await readFile(resolve(file), "utf8");
  has(html, /property="og:image"\s+content="https:\/\/rankingdacompra\.com\.br\/og-ranking-da-compra\.png"/i, "imagem social ausente", file);
  has(html, /name="twitter:card"\s+content="summary_large_image"/i, "cartão social do Twitter ausente", file);
}

const weeklyTop = JSON.parse(await readFile(resolve("top5-semanal.json"), "utf8"));
const weeklyProducts = Array.isArray(weeklyTop.products) ? weeklyTop.products : [];
if (weeklyProducts.length !== 6) fail("top5-semanal.json: o Top 6 precisa conter exatamente 6 produtos válidos");
const weeklyIds = new Set();
for (const product of weeklyProducts) {
  const id = String(product?.id || "").trim();
  if (!id) fail("top5-semanal.json: produto sem identificador");
  else if (weeklyIds.has(id)) fail("top5-semanal.json: produto duplicado no Top 6: " + id);
  else weeklyIds.add(id);
  if (!String(product?.titulo || "").trim()) fail("top5-semanal.json: produto sem título: " + (id || "desconhecido"));
  if (!String(product?.foto || "").startsWith("https://")) fail("top5-semanal.json: produto sem imagem segura: " + (id || "desconhecido"));
  if (!String(product?.productUrl || "").startsWith(SITE + "produto/")) fail("top5-semanal.json: página de produto inválida: " + (id || "desconhecido"));
  if (!String(product?.linkAfiliado || "").startsWith("https://")) fail("top5-semanal.json: link de afiliado inválido: " + (id || "desconhecido"));
  const price = Number(String(product?.precoPromocional || product?.preco || "0").replace(/\./g, "").replace(",", "."));
  if (!(price > 0)) fail("top5-semanal.json: preço inválido: " + (id || "desconhecido"));
}

if (errors.length) {
  console.error("\nValidação bloqueou a publicação:");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}

console.log("Validação concluída: " + urls.length + " URLs, " + identities.size + " produtos únicos e metadados sociais completos.");

