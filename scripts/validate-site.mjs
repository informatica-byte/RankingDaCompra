import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://rankingdacompra.com.br/";
const errors = [];

function fail(message) { errors.push(message); }
function has(html, pattern, label, file) { if (!pattern.test(html)) fail(file + ": " + label); }
function productIdentityKeys(html) {
  const mlbKeys = [...html.matchAll(/\bMLB[-_\s]?(\d{6,})\b/gi)]
    .map((match) => "mlb:" + match[1]);
  const affiliateKeys = [...html.matchAll(/https:\/\/meli\.la\/[A-Za-z0-9_-]+/gi)]
    .map((match) => "affiliate:" + match[0].toLowerCase());
  return [...new Set([...mlbKeys, ...affiliateKeys])];
}

const homeHtml = await readFile(resolve("index.html"), "utf8");
has(homeHtml, /const rotaInicial=.*:homeComPromocoes\(\)/, "a vitrine inicial ainda espera serviços externos antes de aparecer", "index.html");
has(homeHtml, /qualidadeHistoricoSemanal/, "priorização do Top 6 pelo histórico ausente", "index.html");
has(homeHtml, /id="offers-loading"/, "estado visual de carregamento imediato ausente", "index.html");
has(homeHtml, /repetidoEmDestaque/, "preenchimento de segurança para manter seis produtos ausente", "index.html");

const growthTools = await readFile(resolve("growth-tools.js"), "utf8");
has(growthTools, /Preço atual acima do menor valor recente/, "aviso honesto para preço acima do histórico ausente", "growth-tools.js");
if (growthTools.includes("✓ Oferta comprovada pelo histórico")) fail("growth-tools.js: afirmação genérica de oferta comprovada ainda presente");
has(growthTools, /const SEASONAL_THEMES = \{/, "catálogo de temas sazonais ausente", "growth-tools.js");
has(growthTools, /seasonalThemeMode/, "controle manual e automático de temas ausente", "growth-tools.js");
has(growthTools, /automaticThemeId/, "calendário automático de campanhas ausente", "growth-tools.js");
has(growthTools, /prefers-reduced-motion/, "acessibilidade das animações sazonais ausente", "growth-tools.js");
has(growthTools, /collection\("produtos"\)\.doc\("\.site-theme"\)/, "armazenamento seguro e invisível dos temas ausente", "growth-tools.js");
has(growthTools, /tipo:\s*"configuracao_tema"/, "identificação do registro técnico de temas ausente", "growth-tools.js");
has(growthTools, /function renderMascot\(\)/, "integração do mascote Ranki ausente", "growth-tools.js");
has(growthTools, /src="\/ranki\.png"/, "imagem do mascote Ranki não está ligada à vitrine", "growth-tools.js");
has(growthTools, /data-ranki-mascot/, "proteção contra duplicação do mascote ausente", "growth-tools.js");
has(growthTools, /const RANKI_THEME_IMAGES/, "roupas temáticas do Ranki ausentes", "growth-tools.js");
has(growthTools, /function ensureRankiHelp\(\)/, "janela do Ranki Ajuda ausente", "growth-tools.js");
has(growthTools, /data-ranki-action="ofertas"/, "atalhos do Ranki Ajuda ausentes", "growth-tools.js");
has(growthTools, /aria-controls="ranki-help"/, "controle acessível do Ranki Ajuda ausente", "growth-tools.js");
has(growthTools, /if \(event\.key === "Escape"\) closeRankiHelp\(\)/, "fechamento do Ranki Ajuda pelo teclado ausente", "growth-tools.js");
has(growthTools, /function setupFunnelTracking\(\)/, "rastreamento do funil comercial ausente", "growth-tools.js");
has(growthTools, /recordFunnelMetric\("clique_secao",\s*offer,\s*"view:"/, "visualizações de produto não são registradas de forma compatível com as regras", "growth-tools.js");
has(growthTools, /recordFunnelMetric\("clique_oferta"/, "cliques em Comprar não são registrados no funil", "growth-tools.js");

const dashboardHtml = await readFile(resolve("dashboard.html"), "utf8");
has(dashboardHtml, /id="central-visualizacoes-semana"/, "contador de visualizações do funil ausente", "dashboard.html");
has(dashboardHtml, /id="central-taxa-clique"/, "taxa de avanço ao Mercado Livre ausente", "dashboard.html");
has(dashboardHtml, /Produtos vistos sem resultado/, "lista de produtos vistos sem resultado ausente", "dashboard.html");
has(dashboardHtml, /visualizacao_produto/, "painel não reconhece visualizações das páginas de produto", "dashboard.html");
const seasonalThemeIds = ["ano-novo", "volta-aulas", "carnaval", "consumidor", "pascoa", "maes", "namorados", "festa-junina", "pais", "criancas", "black-friday", "natal"];
for (const theme of seasonalThemeIds) {
  if (!growthTools.includes(`${theme}:`) && !growthTools.includes(`"${theme}":`)) fail(`growth-tools.js: tema sazonal ausente: ${theme}`);
  let themedRanki = null;
  try { themedRanki = await readFile(resolve(`assets/ranki/${theme}.png`)); } catch {}
  if (!themedRanki || themedRanki.length < 10000 || themedRanki[0] !== 0x89 || themedRanki.toString("ascii", 1, 4) !== "PNG") {
    fail(`assets/ranki/${theme}.png: roupa temática do Ranki ausente ou inválida`);
  }
}

const rankiImage = await readFile(resolve("ranki.png"));
if (rankiImage.length < 10000 || rankiImage[0] !== 0x89 || rankiImage.toString("ascii", 1, 4) !== "PNG") {
  fail("ranki.png: arquivo PNG do mascote ausente ou inválido");
}

const sitemapGenerator = await readFile(resolve("scripts/generate-sitemap.mjs"), "utf8");
has(sitemapGenerator, /Custo-benefício editorial:/, "explicação da avaliação editorial ausente", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /overlap < 0\.8/, "filtro contra pontos copiados do título ausente", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /<script defer src="\/growth-tools\.js"><\/script>/, "corretor editorial não foi incluído nas páginas de produto", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /id="affiliate-offer"/, "botão de compra rastreável ausente das páginas de produto", "scripts/generate-sitemap.mjs");

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

  for (const identity of productIdentityKeys(html)) {
    const previous = identities.get(identity);
    if (previous && previous !== relative) {
      fail("Produto duplicado (" + identity + "): " + previous + " e " + relative);
    } else {
      identities.set(identity, relative);
    }
  }
}

const directoryHtml = await readFile(resolve("analises.html"), "utf8");
const directoryUrls = new Set(
  [...directoryHtml.matchAll(/href=["'](https:\/\/rankingdacompra\.com\.br\/produto\/[^"'?#]+)["']/gi)]
    .map((match) => match[1]),
);
const sitemapProductUrls = new Set(urls.filter((url) => url.startsWith(SITE + "produto/")));
for (const url of directoryUrls) {
  if (!sitemapProductUrls.has(url)) {
    fail("analises.html: produto fora do sitemap ou sem página publicada: " + url);
    continue;
  }
  const relative = decodeURIComponent(url.slice(SITE.length));
  try { await readFile(resolve(relative), "utf8"); }
  catch { fail("analises.html: link para arquivo inexistente: " + relative); }
}
if (directoryUrls.size !== sitemapProductUrls.size) {
  fail(
    "analises.html: catálogo possui " + directoryUrls.size +
    " produtos, mas o sitemap possui " + sitemapProductUrls.size,
  );
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

console.log("Validação concluída: " + urls.length + " URLs, " + sitemapProductUrls.size + " produtos públicos e metadados sociais completos.");



