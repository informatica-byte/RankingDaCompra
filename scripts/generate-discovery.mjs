import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const PROJECT_ID = "rankingdacompra";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE = "https://rankingdacompra.com.br/";
const GENERIC_TEXT = /(chama aten[cç][aã]o por|recursos descritos no pr[oó]prio t[ií]tulo|informa[cç][oõ]es em atualiza[cç][aã]o|produto identificado no an[uú]ncio|oferta para comparar|conhe[cç]a este produto)/i;
const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function fieldValue(field) {
  if (!field) return "";
  return field.stringValue ?? field.integerValue ?? field.doubleValue
    ?? field.booleanValue ?? field.timestampValue ?? "";
}

async function fetchFirestore(url, collection, maxAttempts = 6) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return response;
    const retryable = RETRYABLE_HTTP_STATUS.has(response.status);
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`${collection}: HTTP ${response.status}`);
    }
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const exponentialDelay = Math.min(1000 * (2 ** (attempt - 1)), 30000);
    const retryDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000 : exponentialDelay;
    await wait(retryDelay);
  }
  throw new Error(`${collection}: não foi possível consultar o Firebase`);
}

async function listCollection(collection) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await fetchFirestore(`${FIRESTORE}/${collection}?${query}`, collection, 2);
    const payload = await response.json();
    for (const document of payload.documents || []) {
      const record = { id: document.name.split("/").pop() };
      for (const [key, field] of Object.entries(document.fields || {})) {
        record[key] = fieldValue(field);
      }
      documents.push(record);
    }
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function marketplaceStatus() {
  try {
    const payload = JSON.parse(await readFile(resolve("mercadolivre-status.json"), "utf8"));
    return payload?.products && typeof payload.products === "object" ? payload.products : {};
  } catch {
    return {};
  }
}

async function loadData() {
  const fixture = String(process.env.DISCOVERY_FIXTURE || "").trim();
  if (fixture) {
    const payload = JSON.parse(await readFile(resolve(fixture), "utf8"));
    return [payload.categories || [], payload.products || [], payload.marketplaceProducts || {}];
  }
  try {
    return await Promise.all([listCollection("categorias"), listCollection("produtos"), marketplaceStatus()]);
  } catch (error) {
    console.warn(`Firebase temporariamente indisponível na descoberta interna: ${error.message}`);
    const fallback = await loadGeneratedPages();
    if (fallback[1].length) {
      console.warn(`Usando ${fallback[1].length} páginas de produto já publicadas como contingência.`);
      return fallback;
    }
    throw error;
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function textFromHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function attribute(html, elementPattern, name) {
  const element = String(html || "").match(elementPattern)?.[0] || "";
  return decodeHtml(element.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1] || "");
}

async function loadGeneratedPages() {
  const categories = new Map();
  const products = [];
  let entries = [];
  try {
    entries = await readdir(resolve("produto"), { withFileTypes: true });
  } catch {
    return [[], [], {}];
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    let html;
    try {
      html = await readFile(resolve("produto", entry.name), "utf8");
    } catch {
      continue;
    }
    const robots = attribute(html, /<meta[^>]+name=["']robots["'][^>]*>/i, "content");
    if (robots && !/\bindex\b/i.test(robots)) continue;
    const title = textFromHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
    const summary = textFromHtml(html.match(/<p[^>]+class=["'][^"']*summary[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]);
    if (!title || summary.length < 180 || GENERIC_TEXT.test(summary)) continue;
    const categoryName = textFromHtml(html.match(/<div[^>]+class=["'][^"']*fact[^"']*["'][^>]*>\s*<span[^>]*>Categoria<\/span>([\s\S]*?)<\/div>/i)?.[1]) || "Produtos";
    const categoryId = slug(categoryName);
    const canonical = attribute(html, /<link[^>]+rel=["']canonical["'][^>]*>/i, "href")
      || `${SITE}produto/${encodeURIComponent(entry.name)}`;
    categories.set(categoryId, { id: categoryId, nome: categoryName });
    products.push({
      id: entry.name.replace(/\.html$/i, ""),
      titulo: title,
      categoria: categoryId,
      comentario: summary,
      atualizadoEm: new Date().toISOString(),
      __productUrl: canonical,
    });
  }
  return [[...categories.values()], products, {}];
}

function editorialProduct(product) {
  const summary = String(product.comentario || "").replace(/\s+/g, " ").trim();
  return summary.length >= 180 && !GENERIC_TEXT.test(summary);
}

function dateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function newestDate(values) {
  return values.map(dateOnly).filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);
}

function slug(value) {
  return String(value || "produtos")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "produtos";
}

function numberPrice(value) {
  let text = String(value || "").replace(/R\$/gi, "").replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!text) return 0;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function promotionIsValid(product) {
  const previous = numberPrice(product.precoAnterior);
  const promotional = numberPrice(product.precoPromocional);
  const end = product.promocaoValidaAte
    ? new Date(`${String(product.promocaoValidaAte).slice(0, 10)}T23:59:59-03:00`) : null;
  return product.promocaoAtiva === true && previous > promotional && promotional > 0
    && (!end || (!Number.isNaN(end.getTime()) && end.getTime() >= Date.now()));
}

function sortProducts(a, b) {
  const promotionDifference = Number(promotionIsValid(b)) - Number(promotionIsValid(a));
  if (promotionDifference) return promotionDifference;
  const rankingDifference = (Number(a.ranking) || 9999) - (Number(b.ranking) || 9999);
  return rankingDifference || String(a.titulo || "").localeCompare(String(b.titulo || ""), "pt-BR");
}

function extractSitemapLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
}

async function productUrlMap(products, sitemapXml) {
  const locations = extractSitemapLocations(sitemapXml).filter((location) => location.includes("/produto/"));
  let files = [];
  try {
    files = (await readdir(resolve("produto"), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
      .map((entry) => entry.name);
  } catch {
    files = [];
  }
  const fileSet = new Set(files);
  const locationSet = new Set(locations);
  const map = new Map();
  for (const product of products) {
    if (product.__productUrl) {
      try {
        const fileName = decodeURIComponent(basename(new URL(product.__productUrl).pathname));
        if (fileSet.has(fileName) && locationSet.has(product.__productUrl)) {
          map.set(product.id, product.__productUrl);
        }
      } catch {
        // Produto sem página publicada fica fora do diretório até a próxima geração.
      }
      continue;
    }
    const match = locations.find((location) => {
      try {
        const fileName = decodeURIComponent(basename(new URL(location).pathname));
        return fileSet.has(fileName)
          && (fileName === `${product.id}.html` || fileName.startsWith(`${product.id}-`));
      } catch {
        return false;
      }
    });
    if (match) {
      map.set(product.id, match);
      continue;
    }
    // Um arquivo fora do sitemap pode ser uma versão antiga ou duplicada.
    // Ele permanece preservado no repositório, mas não entra no catálogo público.
  }
  return map;
}

function renderDirectoryPage(categories, productsByCategory, productUrls, categoryNames, lastModified) {
  const groups = categories.map((category) => ({
    id: category.id,
    name: categoryNames.get(category.id) || category.id,
    products: [...(productsByCategory.get(category.id) || [])].sort(sortProducts),
  })).filter((group) => group.products.length);
  const itemList = groups.flatMap((group) => group.products).map((product, index) => ({
    "@type": "ListItem", position: index + 1, url: productUrls.get(product.id), name: product.titulo,
  }));
  const directoryTitle = "Análises de produtos, preços e ofertas | Ranking da Compra";
  const directoryDescription = `Compare ${itemList.length} análises de produtos por categoria, com preço informado, pontos positivos, limitações e links para conferir a oferta atual.`;
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE}#organization`, name: "Ranking da Compra", url: SITE },
      { "@type": "CollectionPage", "@id": `${SITE}analises.html#page`, name: "Todas as análises de produtos", url: `${SITE}analises.html`, dateModified: lastModified, mainEntity: { "@type": "ItemList", itemListElement: itemList } },
    ],
  }).replace(/</g, "\\u003c");
  const navigation = groups.map((group) => `<a href="#${escapeHtml(slug(group.id))}">${escapeHtml(group.name)} <span>${group.products.length}</span></a>`).join("");
  const sections = groups.map((group) => `<section id="${escapeHtml(slug(group.id))}"><div class="section-head"><div><span class="eyebrow">Categoria</span><h2>${escapeHtml(group.name)}</h2></div><a href="#top">Voltar ao topo ↑</a></div><div class="products">${group.products.map((product) => {
    const summary = String(product.comentario || "").replace(/\s+/g, " ").trim();
    const badge = promotionIsValid(product) ? '<span class="deal">Oferta do dia</span>' : "";
    return `<article><h3><a href="${escapeHtml(productUrls.get(product.id))}">${escapeHtml(product.titulo)}</a></h3><p>${escapeHtml(summary.slice(0, 190))}${summary.length > 190 ? "…" : ""}</p><div>${badge}<a class="read" href="${escapeHtml(productUrls.get(product.id))}">Ver preço, prós e contras →</a></div></article>`;
  }).join("")}</div></section>`).join("");
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow,max-image-preview:large"><title>${escapeHtml(directoryTitle)}</title>
<meta name="description" content="${escapeHtml(directoryDescription)}">
<link rel="canonical" href="${SITE}analises.html"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(directoryTitle)}"><meta property="og:description" content="${escapeHtml(directoryDescription)}"><meta property="og:url" content="${SITE}analises.html"><meta property="og:image" content="${SITE}og-ranking-da-compra.png"><meta name="theme-color" content="#0f3d2e"><script type="application/ld+json">${structuredData}</script>
<style>:root{--green:#116149;--ink:#11221d;--muted:#607068;--line:#dfe7e2;--cream:#fbfaf5;--deal:#fff2bf}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.55}a{color:var(--green)}.wrap{width:min(1120px,calc(100% - 32px));margin:auto}header{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5}.bar{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{font-weight:900;text-decoration:none}.back{font-weight:800;text-decoration:none}.hero{padding:50px 0 28px}.eyebrow{color:var(--green);font-size:.75rem;text-transform:uppercase;letter-spacing:.09em;font-weight:900}h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.05;letter-spacing:-.05em;margin:9px 0 14px}.hero p{max-width:760px;color:var(--muted);font-size:1.06rem}.summary{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.summary span{background:#edf7f1;border:1px solid #cde4d5;border-radius:999px;padding:7px 11px;font-weight:800;font-size:.84rem}.category-nav{display:flex;flex-wrap:wrap;gap:8px;padding:18px;background:#fff;border:1px solid var(--line);border-radius:16px}.category-nav a{display:flex;gap:7px;align-items:center;padding:8px 10px;background:#f3f7f4;border-radius:8px;text-decoration:none;font-weight:800;font-size:.84rem}.category-nav span{color:var(--muted)}section{padding:38px 0;border-bottom:1px solid var(--line)}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:16px}.section-head h2{margin:4px 0 0;font-size:1.7rem}.section-head>a{font-size:.82rem}.products{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.products article{display:flex;flex-direction:column;background:#fff;border:1px solid var(--line);border-radius:13px;padding:17px}.products h3{font-size:1rem;line-height:1.35;margin:0 0 8px}.products h3 a{text-decoration:none;color:var(--ink)}.products h3 a:hover{text-decoration:underline}.products p{color:var(--muted);font-size:.86rem;margin:0 0 13px}.products article>div{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto}.read{font-size:.8rem;font-weight:850;text-decoration:none}.deal{background:var(--deal);color:#725300;border-radius:999px;padding:5px 8px;font-size:.7rem;font-weight:900}footer{background:#10231c;color:#dfeae4;padding:30px 0;margin-top:38px;font-size:.84rem}footer a{color:#fff}@media(max-width:760px){.products{grid-template-columns:1fr}.bar{padding:13px 0;align-items:flex-start}.section-head{align-items:flex-start}.products article>div{align-items:flex-start;flex-direction:column}}</style>
</head><body id="top"><header><div class="wrap bar"><a class="brand" href="${SITE}">Ranking da Compra</a><a class="back" href="${SITE}#promocoes">← Ofertas de hoje</a></div></header><main class="wrap"><div class="hero"><span class="eyebrow">Diretório permanente</span><h1>Análises de produtos para comprar melhor</h1><p>Esta página reúne as análises editoriais publicadas. Use as categorias para encontrar produtos, comparar pontos positivos e limitações e confirmar o preço atual no vendedor.</p><div class="summary"><span>${groups.length} ${groups.length === 1 ? "categoria" : "categorias"}</span><span>${itemList.length} ${itemList.length === 1 ? "análise publicada" : "análises publicadas"}</span><span>Atualizado em ${escapeHtml(new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(`${lastModified}T12:00:00-03:00`)))}</span></div></div><nav class="category-nav" aria-label="Categorias de análises">${navigation}</nav>${sections}</main><footer><div class="wrap"><b>Ranking da Compra</b> — escolhas mais claras para comprar melhor. Alguns links são de afiliados; podemos receber comissão sem custo adicional para você. <a href="${SITE}como-avaliamos.html">Conheça nosso método</a>.</div></footer></body></html>\n`;
}

function relatedSection(product, related, productUrls, categoryName) {
  const links = related.map((item) => `<li><a href="${escapeHtml(productUrls.get(item.id))}">${escapeHtml(item.titulo)}</a></li>`).join("");
  return `<!-- discovery-related:start --><section class="related-discovery" style="margin-top:28px;padding:20px;border:1px solid #dfe7e2;border-radius:13px;background:#fafcfb"><h2 style="margin:0 0 9px;font-size:1.1rem">Compare também em ${escapeHtml(categoryName)}</h2>${links ? `<ul style="margin:0 0 12px;padding-left:20px">${links}</ul>` : ""}<a href="${SITE}analises.html#${escapeHtml(slug(product.categoria))}" style="color:#116149;font-weight:850">Ver todas as análises desta categoria →</a></section><!-- discovery-related:end -->`;
}

async function addRelatedLinks(products, productsByCategory, productUrls, categoryNames) {
  let updated = 0;
  for (const product of products) {
    const productUrl = productUrls.get(product.id);
    let fileName;
    try {
      fileName = decodeURIComponent(basename(new URL(productUrl).pathname));
    } catch {
      continue;
    }
    const filePath = resolve("produto", fileName);
    let html;
    try {
      html = await readFile(filePath, "utf8");
    } catch {
      continue;
    }
    const related = [...(productsByCategory.get(product.categoria) || [])]
      .filter((item) => item.id !== product.id).sort(sortProducts).slice(0, 4);
    const section = relatedSection(product, related, productUrls, categoryNames.get(product.categoria) || "Produtos");
    const withoutOldSection = html.replace(/<!-- discovery-related:start -->[\s\S]*?<!-- discovery-related:end -->/g, "");
    const next = withoutOldSection.replace("</article>", `${section}</article>`);
    if (next !== html) {
      await writeFile(filePath, next, "utf8");
      updated += 1;
    }
  }
  return updated;
}

function updateSitemap(xml, lastModified) {
  const directoryUrl = `${SITE}analises.html`;
  const withoutOldDirectory = xml.replace(new RegExp(`\\s*<url>\\s*<loc>${directoryUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/loc>[\\s\\S]*?<\\/url>`, "g"), "");
  const entry = `  <url>\n    <loc>${escapeXml(directoryUrl)}</loc>\n    <lastmod>${escapeXml(lastModified)}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
  return withoutOldDirectory.replace("</urlset>", `${entry}</urlset>`);
}

const [allCategories, allProducts, marketplaceProducts] = await loadData();
const candidateProducts = allProducts
  .filter(editorialProduct)
  .filter((product) => marketplaceProducts[product.id]?.visible !== false)
  .sort(sortProducts);
let sitemapXml = await readFile(resolve("sitemap.xml"), "utf8");
const productUrls = await productUrlMap(candidateProducts, sitemapXml);
const products = candidateProducts.filter((product) => productUrls.has(product.id));
if (products.length !== candidateProducts.length) {
  console.warn(
    "Descoberta interna: " + (candidateProducts.length - products.length) +
    " cadastro(s) sem página publicada foram ignorados para impedir links 404.",
  );
}
const productsByCategory = new Map();
for (const product of products) {
  const items = productsByCategory.get(product.categoria) || [];
  items.push(product);
  productsByCategory.set(product.categoria, items);
}
const categories = allCategories
  .filter((category) => productsByCategory.has(category.id))
  .sort((a, b) => String(a.nome || a.id).localeCompare(String(b.nome || b.id), "pt-BR"));
const knownCategoryIds = new Set(categories.map((category) => category.id));
for (const categoryId of productsByCategory.keys()) {
  if (!knownCategoryIds.has(categoryId)) categories.push({ id: categoryId, nome: categoryId });
}
const categoryNames = new Map(categories.map((category) => [category.id, String(category.nome || category.id).replace(/air\s+frayer/gi, "Air Fryer")]));
const lastModified = newestDate([
  ...products.flatMap((product) => [product.atualizadoEm, product.dataCadastro]),
  ...categories.map((category) => category.criadoEm),
]);
await writeFile(resolve("analises.html"), renderDirectoryPage(categories, productsByCategory, productUrls, categoryNames, lastModified), "utf8");
sitemapXml = updateSitemap(sitemapXml, lastModified);
await writeFile(resolve("sitemap.xml"), sitemapXml, "utf8");
const relatedPages = await addRelatedLinks(products, productsByCategory, productUrls, categoryNames);

console.log(`Descoberta interna atualizada: ${products.length} análises ligadas em analises.html e ${relatedPages} páginas com produtos relacionados.`);
