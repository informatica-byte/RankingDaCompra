import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const PROJECT_ID = "rankingdacompra";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE = "https://rankingdacompra.com.br/";
const GENERIC_TEXT = /(chama aten[cç][aã]o por|recursos descritos no pr[oó]prio t[ií]tulo|informa[cç][oõ]es em atualiza[cç][aã]o|produto identificado no an[uú]ncio|oferta para comparar|conhe[cç]a este produto)/i;
const CATEGORY_ALIASES = new Map([
  ["patineteelétrica", "parafusadeira-eletrica"],
  ["fritadeiraairfrayerelétrica", "fritadeira-air-fryer-eletrica"],
]);

function fieldValue(field) {
  if (!field) return "";
  return field.stringValue ?? field.integerValue ?? field.doubleValue
    ?? field.booleanValue ?? field.timestampValue ?? "";
}

async function listCollection(collection) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await fetch(`${FIRESTORE}/${collection}?${query}`);
    if (!response.ok) throw new Error(`${collection}: HTTP ${response.status}`);
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

function editorialProduct(product) {
  const summary = String(product.comentario || "").replace(/\s+/g, " ").trim();
  return summary.length >= 180 && !GENERIC_TEXT.test(summary);
}

async function marketplaceStatus() {
  try {
    const payload = JSON.parse(await readFile(resolve("mercadolivre-status.json"), "utf8"));
    return payload?.products && typeof payload.products === "object" ? payload.products : {};
  } catch {
    return {};
  }
}

function dateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function newestDate(values) {
  return values.map(dateOnly).filter(Boolean).sort().at(-1) || "";
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function absoluteImage(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol === "http:") url.protocol = "https:";
    return url.protocol === "https:" ? url.href : `${SITE}og-ranking-da-compra.png`;
  } catch {
    return `${SITE}og-ranking-da-compra.png`;
  }
}

function productDetailUrl(product) {
  return `${SITE}?produto=${encodeURIComponent(product.id)}`;
}

function productShareUrl(product) {
  return `${SITE}produto/${encodeURIComponent(product.id)}.html`;
}

function renderSharePage(product) {
  const title = String(product.titulo || "Produto recomendado").replace(/\s+/g, " ").trim();
  const description = String(product.comentario || "Confira a análise no Ranking da Compra.")
    .replace(/\s+/g, " ").trim().slice(0, 240);
  const image = absoluteImage(product.foto);
  const detailUrl = productDetailUrl(product);
  const shareUrl = productShareUrl(product);
  const redirectJson = JSON.stringify(detailUrl).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <title>${escapeHtml(title)} | Ranking da Compra</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(detailUrl)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Ranking da Compra">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:url" content="${escapeHtml(shareUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
  <meta property="og:image:alt" content="Foto de ${escapeHtml(title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(detailUrl)}">
  <style>body{font-family:Arial,sans-serif;background:#fbfaf5;color:#11221d;margin:0;padding:32px}.card{max-width:560px;margin:auto;background:#fff;border:1px solid #dfe7e2;border-radius:16px;padding:24px;text-align:center}.card img{width:100%;max-height:420px;object-fit:contain}.card a{display:inline-block;margin-top:16px;background:#116149;color:#fff;padding:12px 18px;border-radius:9px;text-decoration:none;font-weight:700}</style>
</head>
<body>
  <main class="card">
    <img src="${escapeHtml(image)}" alt="Foto de ${escapeHtml(title)}">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <a href="${escapeHtml(detailUrl)}">Ver análise e oferta</a>
  </main>
  <script>location.replace(${redirectJson});</script>
</body>
</html>
`;
}

function renderUrl(entry) {
  const lastModified = entry.lastModified
    ? `\n    <lastmod>${escapeXml(entry.lastModified)}</lastmod>` : "";
  return `  <url>\n    <loc>${escapeXml(entry.location)}</loc>${lastModified}\n    <changefreq>${entry.frequency}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`;
}

const [allCategories, allProducts, marketplaceProducts] = await Promise.all([
  listCollection("categorias"),
  listCollection("produtos"),
  marketplaceStatus(),
]);

const products = allProducts
  .filter(editorialProduct)
  .filter((product) => marketplaceProducts[product.id]?.visible !== false)
  .sort((a, b) => a.id.localeCompare(b.id));
const productsByCategory = new Map();
for (const product of products) {
  const items = productsByCategory.get(product.categoria) || [];
  items.push(product);
  productsByCategory.set(product.categoria, items);
}

// Categorias vazias ficam fora do sitemap porque a página pública usa noindex
// até existir pelo menos um produto editorial aprovado.
const categories = allCategories
  .filter((category) => productsByCategory.has(category.id))
  .sort((a, b) => a.id.localeCompare(b.id));

const siteLastModified = newestDate([
  ...products.flatMap((product) => [product.atualizadoEm, product.dataCadastro]),
  ...categories.map((category) => category.criadoEm),
]);

const urls = [
  { location: SITE, lastModified: siteLastModified, frequency: "daily", priority: "1.0" },
  { location: `${SITE}como-avaliamos.html`, frequency: "monthly", priority: "0.8" },
  { location: `${SITE}sobre.html`, frequency: "monthly", priority: "0.7" },
  { location: `${SITE}politica-afiliados.html`, frequency: "yearly", priority: "0.4" },
  { location: `${SITE}privacidade.html`, frequency: "yearly", priority: "0.3" },
  { location: `${SITE}contato.html`, frequency: "yearly", priority: "0.5" },
  ...categories.map((category) => ({
    location: `${SITE}?cat=${encodeURIComponent(CATEGORY_ALIASES.get(category.id) || category.id)}`,
    lastModified: newestDate([
      category.criadoEm,
      ...(productsByCategory.get(category.id) || []).flatMap((product) => [product.atualizadoEm, product.dataCadastro]),
    ]),
    frequency: "weekly",
    priority: "0.8",
  })),
  ...products.map((product) => ({
    location: `${SITE}?produto=${encodeURIComponent(product.id)}`,
    lastModified: newestDate([product.atualizadoEm, product.dataCadastro]),
    frequency: "weekly",
    priority: "0.7",
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(renderUrl).join("\n")}\n</urlset>\n`;
await writeFile(resolve("sitemap.xml"), xml, "utf8");

const productDirectory = resolve("produto");
await rm(productDirectory, { recursive: true, force: true });
await mkdir(productDirectory, { recursive: true });
for (const product of products) {
  if (!/^[A-Za-z0-9_-]+$/.test(product.id)) {
    console.warn(`Página social ignorada por ID inválido: ${product.id}`);
    continue;
  }
  await writeFile(resolve(productDirectory, `${product.id}.html`), renderSharePage(product), "utf8");
}

console.log(`Sitemap e páginas sociais atualizados: ${urls.length} URLs (${products.length} produtos e ${categories.length} categorias).`);
