import { writeFile } from "node:fs/promises";
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

function renderUrl(entry) {
  const lastModified = entry.lastModified
    ? `\n    <lastmod>${escapeXml(entry.lastModified)}</lastmod>` : "";
  return `  <url>\n    <loc>${escapeXml(entry.location)}</loc>${lastModified}\n    <changefreq>${entry.frequency}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`;
}

const [allCategories, allProducts] = await Promise.all([
  listCollection("categorias"),
  listCollection("produtos"),
]);

const products = allProducts.filter(editorialProduct).sort((a, b) => a.id.localeCompare(b.id));
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

console.log(`Sitemap atualizado: ${urls.length} URLs (${products.length} produtos e ${categories.length} categorias).`);
