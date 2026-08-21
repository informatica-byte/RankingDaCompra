import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const PRODUCT_DIR = path.join(ROOT, "produto");
const OUTPUT = path.join(ROOT, "historico-precos.json");
const DAYS = 30;
const GROWTH_SCRIPT = '<script defer src="/growth-tools.js"></script>';

function saoPauloDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function productId(filename) {
  return filename.replace(/-\d{8}-\d+\.html$/i, "").replace(/\.html$/i, "");
}

function findProduct(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProduct(item);
      if (found) return found;
    }
    return null;
  }
  if (node["@type"] === "Product" || (Array.isArray(node["@type"]) && node["@type"].includes("Product"))) return node;
  if (node["@graph"]) return findProduct(node["@graph"]);
  return null;
}

function extractProduct(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const product = findProduct(JSON.parse(match[1]));
      if (product) return product;
    } catch {}
  }
  return null;
}

function priceFrom(product) {
  const offers = Array.isArray(product?.offers) ? product.offers : [product?.offers];
  for (const offer of offers) {
    const price = Number(offer?.price ?? offer?.lowPrice);
    if (Number.isFinite(price) && price > 0) return Math.round(price * 100) / 100;
  }
  return 0;
}

async function readExisting() {
  try {
    const parsed = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function main() {
  const today = saoPauloDate();
  const cutoffDate = new Date(`${today}T12:00:00-03:00`);
  cutoffDate.setDate(cutoffDate.getDate() - (DAYS - 1));
  const cutoff = saoPauloDate(cutoffDate);
  const history = await readExisting();
  const products = history.products && typeof history.products === "object" ? history.products : {};
  const files = (await fs.readdir(PRODUCT_DIR)).filter(name => name.endsWith(".html"));
  let recorded = 0;

  for (const filename of files) {
    const filePath = path.join(PRODUCT_DIR, filename);
    let html = await fs.readFile(filePath, "utf8");
    const originalHtml = html;
    html = html.replace(/>\s*Ver preço atual no Mercado Livre\s*</gi, ">Comprar agora no Mercado Livre<");
    if (!html.includes('/growth-tools.js')) {
      html = /<\/body>/i.test(html)
        ? html.replace(/<\/body>/i, `  ${GROWTH_SCRIPT}\n</body>`)
        : `${html.trimEnd()}\n${GROWTH_SCRIPT}\n`;
    }
    if (html !== originalHtml) await fs.writeFile(filePath, html, "utf8");
    const product = extractProduct(html);
    const price = priceFrom(product);
    if (!product || !price) continue;
    const id = productId(filename);
    const current = products[id] && typeof products[id] === "object" ? products[id] : {};
    const points = Array.isArray(current.points) ? current.points.filter(point => Array.isArray(point) && String(point[0]) >= cutoff) : [];
    const withoutToday = points.filter(point => String(point[0]) !== today);
    withoutToday.push([today, price]);
    withoutToday.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    products[id] = {
      title: String(product.name || current.title || "Produto").slice(0, 220),
      points: withoutToday.slice(-DAYS)
    };
    recorded++;
  }

  for (const [id, item] of Object.entries(products)) {
    item.points = Array.isArray(item.points) ? item.points.filter(point => Array.isArray(point) && String(point[0]) >= cutoff).slice(-DAYS) : [];
    if (!item.points.length) delete products[id];
  }

  const output = {
    version: 1,
    days: DAYS,
    updatedAt: new Date().toISOString(),
    products
  };
  await fs.writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Histórico atualizado: ${recorded} produto(s), janela de ${DAYS} dias.`);
}

await main();
