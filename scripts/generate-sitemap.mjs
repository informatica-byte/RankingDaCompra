const SHARE_VERSION = "20260730-3";import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const PROJECT_ID = "rankingdacompra";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE = "https://rankingdacompra.com.br/";
const SHARE_VERSION = "20260730-2";
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
    if (url.hostname.endsWith("mlstatic.com") && url.pathname.endsWith(".webp")) {
      url.pathname = url.pathname.replace(/\.webp$/i, ".jpg");
    }
    return url.protocol === "https:" ? url.href : `${SITE}og-ranking-da-compra.png`;
  } catch {
    return `${SITE}og-ranking-da-compra.png`;
  }
}


function imageMime(extension) {
  return extension === "png" ? "image/png" : "image/jpeg";
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function cacheProductImage(product, imageDirectory) {
  const source = absoluteImage(product.foto);
  const fallback = `${SITE}og-ranking-da-compra.png`;
  if (source === fallback) return { url: source, mime: "image/png", fileName: "" };

  let extension;
  try {
    const match = new URL(source).pathname.match(/\.(jpe?g|png)$/i);
    if (!match) return { url: source, mime: "image/jpeg", fileName: "" };
    extension = match[1].toLowerCase().replace("jpeg", "jpg");
  } catch {
    return { url: fallback, mime: "image/png", fileName: "" };
  }

  const hash = createHash("sha256").update(source).digest("hex").slice(0, 12);
  const fileName = `${product.id}-${hash}.${extension}`;
  const filePath = resolve(imageDirectory, fileName);
  if (!(await fileExists(filePath))) {
    try {
      const response = await fetch(source, {
        headers: { "User-Agent": "RankingDaCompra-SocialImage/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = String(response.headers.get("content-type") || "").split(";")[0];
      if (!contentType.startsWith("image/")) throw new Error(`tipo inválido: ${contentType || "desconhecido"}`);
      if (extension === "jpg" && contentType !== "image/jpeg") throw new Error(`esperado JPEG, recebido ${contentType}`);
      if (extension === "png" && contentType !== "image/png") throw new Error(`esperado PNG, recebido ${contentType}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("tamanho de imagem inválido");
      await writeFile(filePath, bytes);
    } catch (error) {
      console.warn(`Foto social não armazenada para ${product.id}: ${error.message}`);
      return { url: source, mime: imageMime(extension), fileName: "" };
    }
  }

  return {
    url: `${SITE}produto/imagens/${fileName}?v=${SHARE_VERSION}`,
    mime: imageMime(extension),
    fileName,
  };
}

async function cacheProductImages(products, imageDirectory) {
  const images = new Map();
  const concurrency = 8;
  for (let index = 0; index < products.length; index += concurrency) {
    const batch = products.slice(index, index + concurrency);
    await Promise.all(batch.map(async (product) => {
      images.set(product.id, await cacheProductImage(product, imageDirectory));
    }));
  }
  return images;
}

function productDetailUrl(product) {
  return `${SITE}?produto=${encodeURIComponent(product.id)}`;
}

function productShareUrl(product) {
  return `${SITE}produto/${encodeURIComponent(product.id)}-${SHARE_VERSION}.html`;
}

function renderSharePage(product, socialImage) {
  const title = String(product.titulo || "Produto recomendado").replace(/\s+/g, " ").trim();
  const description = String(product.comentario || "Confira a análise no Ranking da Compra.")
    .replace(/\s+/g, " ").trim().slice(0, 240);
  const image = socialImage?.url || absoluteImage(product.foto);
  const imageType = socialImage?.mime || "image/jpeg";
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
  <meta property="og:image:type" content="${escapeHtml(imageType)}">
  <meta property="og:image:alt" content="Foto de ${escapeHtml(title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <style>body{font-family:Arial,sans-serif;background:#fbfaf5;color:#11221d;margin:0;padding:32px}.card{max-width:560px;margin:auto;background:#fff;border:1px solid #dfe7e2;border-radius:16px;padding:24px;text-align:center}.card img{width:100%;max-height:420px;object-fit:contain}.card a{display:inline-block;margin-top:16px;background:#116149;color:#fff;padding:12px 18px;border-radius:9px;text-decoration:none;font-weight:700}</style>
</head>
<body>
  <main class="card">
    <img src="${escapeHtml(image)}" alt="Foto de ${escapeHtml(title)}">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <a href="${escapeHtml(detailUrl)}">Ver análise e oferta</a>
  </main>
  <script>(()=>{const destino=new URL(${redirectJson});const entrada=new URLSearchParams(location.search);['utm_source','utm_medium','utm_campaign','utm_content'].forEach(chave=>{const valor=entrada.get(chave);if(valor)destino.searchParams.set(chave,valor)});location.replace(destino.href)})();</script>
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

// As páginas usadas por WhatsApp, Facebook e Instagram devem existir para todo
// produto ativo. As regras editoriais continuam valendo somente para o sitemap.
const shareProducts = allProducts
  .filter((product) => marketplaceProducts[product.id]?.visible !== false)
  .sort((a, b) => a.id.localeCompare(b.id));
const products = shareProducts.filter(editorialProduct);
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
const imageDirectory = resolve(productDirectory, "imagens");
await mkdir(imageDirectory, { recursive: true });

const validProducts = shareProducts.filter((product) => {
  const valid = /^[A-Za-z0-9_-]+$/.test(product.id);
  if (!valid) console.warn(`Página social ignorada por ID inválido: ${product.id}`);
  return valid;
});
const socialImages = await cacheProductImages(validProducts, imageDirectory);
const expectedPages = new Set();
for (const product of validProducts) {
  const fileName = `${product.id}-${SHARE_VERSION}.html`;
  expectedPages.add(fileName);
  await writeFile(
    resolve(productDirectory, fileName),
    renderSharePage(product, socialImages.get(product.id)),
    "utf8",
  );
}

for (const entry of await readdir(productDirectory, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".html") && !expectedPages.has(entry.name)) {
    await rm(resolve(productDirectory, entry.name), { force: true });
  }
}
const expectedImages = new Set(
  [...socialImages.values()].map((image) => image.fileName).filter(Boolean),
);
for (const entry of await readdir(imageDirectory, { withFileTypes: true })) {
  if (entry.isFile() && !expectedImages.has(entry.name)) {
    await rm(resolve(imageDirectory, entry.name), { force: true });
  }
}

const locallyHostedImages = expectedImages.size;
console.log(
  `Sitemap e páginas sociais atualizados: ${urls.length} URLs (${products.length} produtos, ${categories.length} categorias e ${locallyHostedImages} fotos locais).`,
);
