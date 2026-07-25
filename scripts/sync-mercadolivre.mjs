import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const PROJECT_ID = "rankingdacompra";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OUTPUT = resolve("mercadolivre-status.json");
const ACCESS_TOKEN = String(process.env.MERCADO_LIVRE_ACCESS_TOKEN || "").trim();
const MAX_PARALLEL_REQUESTS = 5;
const CONFIRMATIONS_TO_HIDE = 2;

function fieldValue(field) {
  if (!field) return "";
  return field.stringValue ?? field.integerValue ?? field.doubleValue
    ?? field.booleanValue ?? field.timestampValue ?? "";
}

async function listProducts() {
  const products = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await fetch(`${FIRESTORE}/produtos?${query}`);
    if (!response.ok) throw new Error(`Firestore: HTTP ${response.status}`);
    const payload = await response.json();
    for (const document of payload.documents || []) {
      const product = { id: document.name.split("/").pop() };
      for (const [key, field] of Object.entries(document.fields || {})) {
        product[key] = fieldValue(field);
      }
      products.push(product);
    }
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
  return products;
}

export function extractItemIdFromText(value) {
  const text = String(value || "");
  const direct = text.match(/\bMLB[-_]?(\d{6,})\b/i);
  return direct ? `MLB${direct[1]}` : "";
}

export function extractItemIdFromUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const queryId = extractItemIdFromText(
      `${url.searchParams.get("item_id") || ""} ${url.searchParams.get("wid") || ""} ${url.searchParams.get("pdp_filters") || ""}`,
    );
    if (queryId) return queryId;
    if (/\/p\/MLB\d+/i.test(url.pathname)) return "";
    return extractItemIdFromText(url.pathname);
  } catch {
    return extractItemIdFromText(value);
  }
}

async function resolveItemId(product) {
  const explicit = extractItemIdFromText(product.mercadoLivreItemId);
  if (explicit) return explicit;

  const urls = [product.link, product.linkAfiliado].filter(Boolean);
  for (const value of urls) {
    const direct = extractItemIdFromUrl(value);
    if (direct) return direct;

    try {
      const url = new URL(value);
      if (/meli\.la$|mercadolivre\.com/i.test(url.hostname)) {
        const response = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(12_000),
        });
        const redirected = extractItemIdFromUrl(response.url);
        if (redirected) return redirected;
      }
    } catch {
      // O produto continua visível e será marcado como não gerenciado.
    }
  }
  return "";
}

function requestHeaders() {
  return ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : {};
}

async function fetchJson(url, { allowMissing = false } = {}) {
  const response = await fetch(url, {
    headers: requestHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  if (allowMissing && [401, 403, 404].includes(response.status)) return null;
  if (!response.ok) {
    const error = new Error(`Mercado Livre: HTTP ${response.status}`);
    error.httpStatus = response.status;
    throw error;
  }
  return response.json();
}

async function fetchMarketplaceItem(itemId) {
  let item;
  try {
    item = await fetchJson(
      `https://api.mercadolibre.com/items/${itemId}?attributes=id,status,available_quantity,currency_id,permalink,price,original_price`,
    );
  } catch (error) {
    if (error.httpStatus === 404) {
      return {
        itemId,
        status: "not_found",
        available: false,
        price: null,
        regularPrice: null,
        currencyId: "BRL",
      };
    }
    throw error;
  }

  let salePrice = null;
  if (ACCESS_TOKEN) {
    salePrice = await fetchJson(
      `https://api.mercadolibre.com/items/${itemId}/sale_price`,
      { allowMissing: true },
    );
  }

  const amount = Number(salePrice?.amount ?? item?.price);
  const regularAmount = Number(salePrice?.regular_amount ?? item?.original_price);
  const status = String(item?.status || "unknown");
  const quantity = Number(item?.available_quantity);

  return {
    itemId,
    status,
    available: status === "active" && (!Number.isFinite(quantity) || quantity > 0),
    price: Number.isFinite(amount) && amount > 0 ? amount : null,
    regularPrice: Number.isFinite(regularAmount) && regularAmount > amount ? regularAmount : null,
    currencyId: String(salePrice?.currency_id || item?.currency_id || "BRL"),
  };
}

export function deriveRecord(previous = {}, result, checkedAt) {
  if (!result.available) {
    const unavailableChecks = Math.min(
      Number(previous.unavailableChecks || 0) + 1,
      CONFIRMATIONS_TO_HIDE,
    );
    return {
      itemId: result.itemId,
      managed: true,
      status: result.status,
      available: false,
      visible: unavailableChecks < CONFIRMATIONS_TO_HIDE,
      unavailableChecks,
      price: result.price,
      regularPrice: result.regularPrice,
      currencyId: result.currencyId,
      checkedAt,
    };
  }

  return {
    itemId: result.itemId,
    managed: true,
    status: result.status,
    available: true,
    visible: true,
    unavailableChecks: 0,
    price: result.price,
    regularPrice: result.regularPrice,
    currencyId: result.currencyId,
    checkedAt,
  };
}

function sameBusinessState(a = {}, b = {}) {
  const keys = [
    "itemId", "managed", "status", "available", "visible",
    "unavailableChecks", "price", "regularPrice", "currencyId", "lastError",
  ];
  return keys.every((key) => (a[key] ?? null) === (b[key] ?? null));
}

async function readPrevious() {
  try {
    const parsed = JSON.parse(await readFile(OUTPUT, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : { products: {} };
  } catch {
    return { products: {} };
  }
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function checkProduct(product, previousRecord, checkedAt) {
  const itemId = await resolveItemId(product);
  if (!itemId) {
    return {
      itemId: "",
      managed: false,
      status: "missing_item_id",
      available: null,
      visible: true,
      unavailableChecks: 0,
      price: null,
      regularPrice: null,
      currencyId: "BRL",
      checkedAt,
    };
  }

  const relevantPrevious = previousRecord.itemId === itemId ? previousRecord : {};
  try {
    const result = await fetchMarketplaceItem(itemId);
    return deriveRecord(relevantPrevious, result, checkedAt);
  } catch (error) {
    return {
      ...relevantPrevious,
      itemId,
      managed: true,
      visible: relevantPrevious.visible !== false,
      lastError: String(error?.message || "Falha temporária").slice(0, 160),
      checkedAt,
    };
  }
}

async function main() {
  const [products, previous] = await Promise.all([listProducts(), readPrevious()]);
  const checkedAt = new Date().toISOString();
  const entries = await mapWithConcurrency(
    products,
    MAX_PARALLEL_REQUESTS,
    async (product) => {
      const oldRecord = previous.products?.[product.id] || {};
      const newRecord = await checkProduct(product, oldRecord, checkedAt);
      if (sameBusinessState(oldRecord, newRecord)) {
        newRecord.checkedAt = oldRecord.checkedAt || checkedAt;
      }
      return [product.id, newRecord];
    },
  );

  const nextProducts = Object.fromEntries(entries);
  const changed = JSON.stringify(previous.products || {}) !== JSON.stringify(nextProducts);
  const payload = {
    version: 1,
    updatedAt: changed ? checkedAt : (previous.updatedAt || checkedAt),
    products: nextProducts,
  };
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const counts = Object.values(nextProducts).reduce((summary, record) => {
    if (!record.managed) summary.unmanaged++;
    else if (record.visible === false) summary.hidden++;
    else if (record.available === false) summary.confirming++;
    else summary.active++;
    return summary;
  }, { active: 0, hidden: 0, confirming: 0, unmanaged: 0 });

  console.log(
    `Mercado Livre sincronizado: ${products.length} produtos; `
    + `${counts.active} ativos, ${counts.hidden} ocultos, `
    + `${counts.confirming} aguardando confirmação e ${counts.unmanaged} sem item_id.`,
  );
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
