import fs from "node:fs/promises";
import path from "node:path";
import { observationFromHtml, addObservation } from "./price-observation.mjs";

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

function productIdentity(html) {
  const match = String(html || "").match(/\bMLB[-_\s]?(\d{6,})\b/i);
  return match ? `MLB${match[1]}` : "";
}

function normalizedTitle(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameProductTitle(left, right) {
  const a = normalizedTitle(left);
  const b = normalizedTitle(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const aTokens = new Set(a.split(" ").filter(token => token.length > 2));
  const bTokens = new Set(b.split(" ").filter(token => token.length > 2));
  if (!aTokens.size || !bTokens.size) return false;
  const overlap = [...aTokens].filter(token => bTokens.has(token)).length;
  return overlap / Math.min(aTokens.size, bTokens.size) >= 0.7;
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
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || (parsed.products && (typeof parsed.products !== "object" || Array.isArray(parsed.products)))) throw new Error("Formato de histórico inválido");
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw new Error(`Histórico existente não pôde ser lido; nenhum dado será substituído: ${error.message}`);
  }
}

async function main() {
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
    const title = String(product.name || current.title || "Produto").slice(0, 220);
    const identity = productIdentity(html);
    const currentIdentity = String(current.identity || "");
    const identityChanged = Boolean(currentIdentity && identity && currentIdentity !== identity);
    const titleChanged = Boolean(current.title && !sameProductTitle(current.title, title));
    const resetHistory = identityChanged || (!currentIdentity && titleChanged);
    const observation = observationFromHtml(html, price);
    if (!observation) continue;
    const baseline = resetHistory ? { archives: [...(current.archives || []), { ...current, archives: undefined }] } : current;
    products[id] = {
      ...addObservation(baseline, observation),
      title,
      ...(identity ? { identity } : {}),
    };
    if (resetHistory) console.log(`Histórico anterior arquivado para ${id}: o produto do registro mudou.`);
    recorded++;
  }

  const output = {
    ...history,
    version: 1,
    days: DAYS,
    updatedAt: new Date().toISOString(),
    products
  };
  await fs.writeFile(OUTPUT, `${JSON.stringify(output)}\n`, "utf8");
  console.log(`Histórico atualizado: ${recorded} produto(s), janela de ${DAYS} dias.`);
}

await main();
