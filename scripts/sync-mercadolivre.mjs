import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PROJECT_ID = "rankingdacompra";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OUTPUT = resolve("mercadolivre-status.json");
const TOKEN_FILE = resolve(".mercadolivre-token.enc");
let accessToken = String(process.env.MERCADO_LIVRE_ACCESS_TOKEN || "").trim();
const CLIENT_ID = String(process.env.MERCADO_LIVRE_CLIENT_ID || "").trim();
const CLIENT_SECRET = String(process.env.MERCADO_LIVRE_CLIENT_SECRET || "").trim();
const TOKEN_KEY = String(process.env.MERCADO_LIVRE_TOKEN_KEY || "").trim();
const AUTHORIZATION_CODE = String(process.env.MERCADO_LIVRE_AUTHORIZATION_CODE || "").trim();
const REDIRECT_URI = String(
  process.env.MERCADO_LIVRE_REDIRECT_URI
  || "https://rankingdacompra.com.br/oauth-mercadolivre.html",
).trim();
const MAX_PARALLEL_REQUESTS = 5;
const CONFIRMATIONS_TO_HIDE = 2;

function fieldValue(field) {
  if (!field) return "";
  return field.stringValue ?? field.integerValue ?? field.doubleValue
    ?? field.booleanValue ?? field.timestampValue ?? "";
}

function encryptionKey() {
  return createHash("sha256").update(TOKEN_KEY, "utf8").digest();
}

function encryptTokenSession(session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  });
}

function decryptTokenSession(value) {
  const payload = JSON.parse(value);
  if (payload?.version !== 1) throw new Error("Arquivo de autorização incompatível");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

async function readTokenSession() {
  try {
    return decryptTokenSession(await readFile(TOKEN_FILE, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error("Não foi possível abrir a autorização criptografada do Mercado Livre");
  }
}

async function requestOAuthToken(fields) {
  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const reason = String(payload.error_description || payload.message || `HTTP ${response.status}`);
    throw new Error(`Autorização do Mercado Livre recusada: ${reason.slice(0, 180)}`);
  }
  return payload;
}

async function saveOAuthToken(payload) {
  const session = {
    accessToken: String(payload.access_token),
    refreshToken: String(payload.refresh_token || ""),
    expiresAt: Date.now() + Math.max(300, Number(payload.expires_in || 21600)) * 1000,
  };
  await writeFile(TOKEN_FILE, `${encryptTokenSession(session)}\n`, "utf8");
  return session;
}

async function prepareAccessToken() {
  if (accessToken) return "access_token";
  const oauthConfigured = CLIENT_ID && CLIENT_SECRET && TOKEN_KEY;
  if (!oauthConfigured) return "not_configured";

  const stored = await readTokenSession();
  if (stored?.accessToken && Number(stored.expiresAt) > Date.now() + 10 * 60 * 1000) {
    accessToken = String(stored.accessToken);
    return "encrypted_session";
  }

  let payload;
  if (stored?.refreshToken) {
    payload = await requestOAuthToken({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: String(stored.refreshToken),
    });
  } else if (AUTHORIZATION_CODE) {
    payload = await requestOAuthToken({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: AUTHORIZATION_CODE,
      redirect_uri: REDIRECT_URI,
    });
  } else {
    throw new Error(
      "Autorização inicial pendente: adicione MERCADO_LIVRE_AUTHORIZATION_CODE uma única vez",
    );
  }

  const session = await saveOAuthToken(payload);
  accessToken = session.accessToken;
  return stored ? "refreshed" : "authorized";
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

function extractCatalogIdFromUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const match = url.pathname.match(/\/p\/(MLB\d{6,})/i);
    return match ? match[1].toUpperCase() : "";
  } catch {
    return "";
  }
}

function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function itemFromCatalog(catalogId) {
  if (!catalogId) return "";
  try {
    const payload = await fetchJson(
      `https://api.mercadolibre.com/products/${catalogId}/items`,
      { allowMissing: true },
    );
    const candidates = Array.isArray(payload) ? payload : (payload?.results || []);
    const active = candidates.find((candidate) => (
      candidate?.status === "active" && extractItemIdFromText(candidate?.item_id || candidate?.id)
    ));
    const any = active || candidates.find((candidate) => (
      extractItemIdFromText(candidate?.item_id || candidate?.id)
    ));
    return extractItemIdFromText(any?.item_id || any?.id);
  } catch {
    return "";
  }
}

async function itemFromExactTitle(title) {
  const normalized = normalizeTitle(title);
  if (normalized.length < 18) return "";
  try {
    const payload = await fetchJson(
      `https://api.mercadolibre.com/sites/MLB/search?limit=10&q=${encodeURIComponent(title)}`,
      { allowMissing: true },
    );
    const exactMatches = (payload?.results || []).filter((candidate) => (
      candidate?.status === "active"
      && normalizeTitle(candidate?.title) === normalized
      && extractItemIdFromText(candidate?.id)
    ));
    return exactMatches.length === 1 ? extractItemIdFromText(exactMatches[0].id) : "";
  } catch {
    return "";
  }
}

async function itemFromRedirect(value) {
  try {
    const url = new URL(String(value || ""));
    if (!/meli\.la$|mercadolivre\.com/i.test(url.hostname)) return "";
    for (const method of ["HEAD", "GET"]) {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(12_000),
      });
      const direct = extractItemIdFromUrl(response.url);
      if (direct) return direct;
      const catalog = extractCatalogIdFromUrl(response.url);
      const catalogItem = await itemFromCatalog(catalog);
      if (catalogItem) return catalogItem;
      if (method === "GET") {
        const html = await response.text();
        const embeddedPatterns = [
          /(?:wid|item_id)(?:=|%3D|\\u003[dD])(?:MLB[-_]?)(\d{6,})/i,
          /pdp_filters[^"'<>]{0,100}(?:MLB[-_]?)(\d{6,})/i,
        ];
        for (const pattern of embeddedPatterns) {
          const embedded = html.match(pattern);
          if (embedded) return `MLB${embedded[1]}`;
        }
      } else if (response.body) {
        await response.body.cancel();
      }
    }
  } catch {
    return "";
  }
  return "";
}

async function resolveItemId(product) {
  const explicit = extractItemIdFromText(product.mercadoLivreItemId);
  if (explicit) return explicit;

  const urls = [product.link, product.linkAfiliado].filter(Boolean);
  for (const value of urls) {
    const direct = extractItemIdFromUrl(value);
    if (direct) return direct;

    const catalogItem = await itemFromCatalog(extractCatalogIdFromUrl(value));
    if (catalogItem) return catalogItem;

    const redirected = await itemFromRedirect(value);
    if (redirected) return redirected;
  }

  // Migração dos cadastros antigos: só aceita uma correspondência de título
  // exatamente igual, evitando associar automaticamente um produto diferente.
  return itemFromExactTitle(product.titulo);
}

function requestHeaders() {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function fetchJson(url, { allowMissing = false, authenticated = true } = {}) {
  const response = await fetch(url, {
    headers: authenticated ? requestHeaders() : {},
    signal: AbortSignal.timeout(15_000),
  });
  if (allowMissing && [401, 403, 404].includes(response.status)) return null;
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = String(
      payload?.message || payload?.error || payload?.code || "",
    ).trim();
    const error = new Error(
      `Mercado Livre: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`,
    );
    error.httpStatus = response.status;
    throw error;
  }
  return response.json();
}

async function fetchLightningPromotion(itemId) {
  if (!accessToken) return null;
  const payload = await fetchJson(
    `https://api.mercadolibre.com/seller-promotions/items/${itemId}?app_version=v2`,
    { allowMissing: true },
  );
  if (!payload) return null;
  const promotions = Array.isArray(payload) ? payload : Array.isArray(payload.results) ? payload.results : [];
  const lightning = promotions.find((promotion) => {
    const type = String(promotion?.type || promotion?.promotion_type || "").toUpperCase();
    const status = String(promotion?.status?.id || promotion?.status || "").toLowerCase();
    return type === "LIGHTNING" && ["active", "started"].includes(status);
  });
  if (!lightning) return { checked: true, active: false };
  const endsAt = String(lightning.end_date || lightning.finish_date || lightning.date_to || "").trim();
  const startsAt = String(lightning.start_date || lightning.begin_date || lightning.date_from || "").trim();
  const endTime = Date.parse(endsAt);
  const price = Number(lightning.deal_price ?? lightning.price ?? lightning.discounted_price);
  return {
    checked: true,
    active: Boolean(endsAt && Number.isFinite(endTime) && endTime > Date.now()),
    promotionId: String(lightning.id || lightning.promotion_id || ""),
    startsAt,
    endsAt,
    price: Number.isFinite(price) && price > 0 ? price : null,
    source: "seller-promotions",
  };
}

function numberFromValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function walkJson(value, visitor) {
  if (!value || typeof value !== "object") return;
  visitor(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((item) => walkJson(item, visitor));
    else walkJson(child, visitor);
  }
}

export function parseMarketplaceHtml(html, itemId) {
  const source = String(html || "");
  const products = [];
  const jsonLdPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of source.matchAll(jsonLdPattern)) {
    try {
      const parsed = JSON.parse(match[1].trim());
      walkJson(parsed, (node) => {
        const type = String(node["@type"] || "").toLowerCase();
        if (type === "product" && node.offers) products.push(node);
      });
    } catch {
      // Alguns anúncios incluem blocos não JSON; os metadados abaixo continuam disponíveis.
    }
  }

  for (const product of products) {
    const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
    for (const offer of offers.filter(Boolean)) {
      const availability = String(offer.availability || "").toLowerCase();
      const price = numberFromValue(
        offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price,
      );
      if (!price) continue;
      const unavailable = /outofstock|soldout|discontinued/.test(availability);
      return {
        itemId,
        status: unavailable ? "inactive" : "active",
        available: !unavailable,
        price,
        regularPrice: null,
        currencyId: String(offer.priceCurrency || "BRL"),
        source: "public_page",
      };
    }
  }

  const pricePatterns = [
    /property=["']product:price:amount["'][^>]+content=["']([^"']+)/i,
    /itemprop=["']price["'][^>]+content=["']([^"']+)/i,
    /aria-label=["']Agora:\s*([\d.]+)\s*reais(?:\s+com\s+(\d+)\s+centavos)?/i,
    /aria-label=["'](?!Antes:)([\d.]+)\s*reais(?:\s+com\s+(\d+)\s+centavos)?/i,
    /"price"\s*:\s*"?(\d+(?:[.,]\d+)?)/i,
  ];
  let price = null;
  for (const pattern of pricePatterns) {
    const match = source.match(pattern);
    price = numberFromValue(
      match?.[2] ? `${match[1]},${String(match[2]).padStart(2, "0")}` : match?.[1],
    );
    if (price) break;
  }

  const normalized = source
    .replace(/&aacute;/gi, "á")
    .replace(/&atilde;/gi, "ã")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .toLowerCase();
  const unavailable = [
    "anúncio pausado",
    "anuncio pausado",
    "produto indisponível",
    "produto indisponivel",
    "publicação finalizada",
    "publicacao finalizada",
    "outofstock",
  ].some((marker) => normalized.includes(marker));
  const available = [
    "estoque disponível",
    "estoque disponivel",
    "comprar agora",
    "opções de compra",
    "opcoes de compra",
    "ir para a compra",
    "adicionar ao carrinho",
    "buybox-form",
    "instock",
  ].some((marker) => normalized.includes(marker));

  if (unavailable) {
    return {
      itemId,
      status: "inactive",
      available: false,
      price,
      regularPrice: null,
      currencyId: "BRL",
      source: "public_page",
    };
  }
  if (price && available) {
    return {
      itemId,
      status: "active",
      available: true,
      price,
      regularPrice: null,
      currencyId: "BRL",
      source: "public_page",
    };
  }
  throw new Error(
    `Mercado Livre: página sem preço ou disponibilidade verificável (preço=${price ? "sim" : "não"}, compra=${available ? "sim" : "não"}, tamanho=${source.length})`,
  );
}

async function fetchMarketplacePublicPage(itemId, productUrls = []) {
  const numericId = String(itemId || "").replace(/\D/g, "");
  const candidates = [
    ...productUrls,
    `https://produto.mercadolivre.com.br/MLB-${numericId}-_JM`,
  ].filter((value, index, list) => value && list.indexOf(value) === index);
  let lastError = new Error("Mercado Livre: página pública indisponível");

  for (const candidate of candidates) {
    let response;
    try {
      response = await fetch(candidate, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "pt-BR,pt;q=0.9",
        "user-agent":
          "Mozilla/5.0 (compatible; RankingDaCompra/1.0; +https://rankingdacompra.com.br/)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      });
      if (response.status === 404) continue;
      if (!response.ok) {
        lastError = new Error(`Mercado Livre: página pública HTTP ${response.status}`);
        continue;
      }
      return parseMarketplaceHtml(await response.text(), itemId);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function fetchMarketplaceItem(itemId, product = {}) {
  let item;
  let itemError = null;
  const attributes =
    "id,status,available_quantity,currency_id,permalink,price,original_price";
  const batchUrl =
    "https://api.mercadolibre.com/items?ids="
    + encodeURIComponent(itemId)
    + "&attributes="
    + attributes;
  const authenticationAttempts = accessToken ? [true, false] : [false];

  for (const authenticated of authenticationAttempts) {
    try {
      const batch = await fetchJson(batchUrl, { authenticated });
      const entry = Array.isArray(batch) ? batch[0] : null;
      if (!entry || Number(entry.code) !== 200 || !entry.body) {
        const status = Number(entry?.code || 502);
        const detail = String(
          entry?.body?.message || entry?.body?.error || "resposta inválida",
        ).trim();
        const requestError = new Error(
          "Mercado Livre Multiget: HTTP " + status + " - " + detail,
        );
        requestError.httpStatus = status;
        throw requestError;
      }
      item = entry.body;
      break;
    } catch (error) {
      itemError = error;
      if (error.httpStatus === 404) {
        return {
          itemId,
          status: "not_found",
          available: false,
          price: null,
          regularPrice: null,
          currencyId: "BRL",
          source: "api",
        };
      }
      if (authenticated && [401, 403].includes(error.httpStatus)) {
        console.warn(
          "Mercado Livre recusou o token para " + itemId
          + "; tentando a consulta pública oficial.",
        );
        continue;
      }
      break;
    }
  }

  if (!item && [401, 403].includes(itemError?.httpStatus)) {
    try {
      item = await fetchJson(
        "https://api.mercadolibre.com/items/"
          + encodeURIComponent(itemId)
          + "?attributes="
          + attributes,
        { authenticated: false },
      );
    } catch (error) {
      itemError = error;
    }
  }

  if (!item) {
    const error = itemError || new Error("Mercado Livre: anúncio sem resposta");
    if (error.httpStatus === 404) {
      return {
        itemId,
        status: "not_found",
        available: false,
        price: null,
        regularPrice: null,
        currencyId: "BRL",
        source: "api",
      };
    }
    if ([401, 403].includes(error.httpStatus)) {
      let salePriceError;
      for (const authenticated of authenticationAttempts) {
        try {
          const salePrice = await fetchJson(
            "https://api.mercadolibre.com/items/"
              + encodeURIComponent(itemId)
              + "/sale_price?context=channel_marketplace",
            { authenticated },
          );
          const amount = Number(salePrice?.amount);
          const regularAmount = Number(salePrice?.regular_amount);
          if (Number.isFinite(amount) && amount > 0) {
            return {
              itemId,
              status: "active",
              available: true,
              price: amount,
              regularPrice:
                Number.isFinite(regularAmount) && regularAmount > amount
                  ? regularAmount
                  : null,
              currencyId: String(salePrice?.currency_id || "BRL"),
              source: authenticated
                ? "sale_price_api"
                : "sale_price_public_api",
            };
          }
          throw new Error("Mercado Livre: preço de venda ausente");
        } catch (caught) {
          salePriceError = caught;
          if (authenticated && [401, 403].includes(caught.httpStatus)) {
            continue;
          }
          break;
        }
      }
      try {
        return await fetchMarketplacePublicPage(
          itemId,
          [product.link, product.linkAfiliado].filter(Boolean),
        );
      } catch (publicError) {
        throw new Error(
          error.message
          + "; preço: "
          + (salePriceError?.message || "indisponível")
          + "; fallback público: "
          + publicError.message,
        );
      }
    }
    throw error;
  }

  let salePrice = null;
  if (accessToken) {
    salePrice = await fetchJson(
      "https://api.mercadolibre.com/items/" + itemId + "/sale_price",
      { allowMissing: true },
    );
  }
  const lightning = await fetchLightningPromotion(itemId);

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
    source: itemError ? "public_api" : "api",
    lightning,
  };
}

function lightningFields(result = {}) {
  const promotion = result.lightning || {};
  return {
    lightningChecked: promotion.checked === true,
    lightningActive: promotion.active === true,
    lightningPromotionId: String(promotion.promotionId || ""),
    lightningStartsAt: String(promotion.startsAt || ""),
    lightningEndsAt: String(promotion.endsAt || ""),
    lightningPrice: Number(promotion.price) > 0 ? Number(promotion.price) : null,
    lightningSource: String(promotion.source || ""),
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
      source: result.source || "api",
      checkedAt,
      ...lightningFields(result),
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
    source: result.source || "api",
    checkedAt,
    ...lightningFields(result),
  };
}

function sameBusinessState(a = {}, b = {}) {
  const keys = [
    "itemId", "managed", "status", "available", "visible",
    "unavailableChecks", "price", "regularPrice", "currencyId", "source", "lastError",
    "lightningChecked", "lightningActive", "lightningPromotionId", "lightningStartsAt",
    "lightningEndsAt", "lightningPrice", "lightningSource",
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
    const result = await fetchMarketplaceItem(itemId, product);
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
  const authorization = await prepareAccessToken();
  if (authorization === "not_configured") {
    console.log(
      "Sincronização pausada com segurança: configure a autorização oficial do Mercado Livre.",
    );
    return;
  }

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
    if (record.lastError) summary.errors++;
    else if (!record.managed) summary.unmanaged++;
    else if (record.visible === false) summary.hidden++;
    else if (record.available === false) summary.confirming++;
    else if (record.available === true) summary.active++;
    else summary.errors++;
    return summary;
  }, { active: 0, hidden: 0, confirming: 0, unmanaged: 0, errors: 0 });

  console.log(
    `Mercado Livre sincronizado: ${products.length} produtos; `
    + `${counts.active} ativos, ${counts.hidden} ocultos, `
    + `${counts.confirming} aguardando confirmação, ${counts.unmanaged} sem item_id `
    + `e ${counts.errors} com falha temporária.`,
  );

  const successfulChecks = entries.reduce(
    (total, [, record]) =>
      total + (record.managed === true && !record.lastError ? 1 : 0),
    0,
  );
  console.log(
    "Preços efetivamente confirmados nesta execução: " + successfulChecks + ".",
  );
  if (products.length > 0 && successfulChecks === 0) {
    entries
      .filter(([, record]) => record.lastError)
      .slice(0, 3)
      .forEach(([productId, record]) => {
        console.error("Falha em " + productId + ": " + record.lastError);
      });
    throw new Error(
      "Sincronização inválida: nenhum preço foi confirmado. "
      + "O relatório foi gerado, mas a execução será marcada como falha.",
    );
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PROJECT_ID = "rankingdacompra";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OUTPUT = resolve("mercadolivre-status.json");
const TOKEN_FILE = resolve(".mercadolivre-token.enc");
let accessToken = String(process.env.MERCADO_LIVRE_ACCESS_TOKEN || "").trim();
const CLIENT_ID = String(process.env.MERCADO_LIVRE_CLIENT_ID || "").trim();
const CLIENT_SECRET = String(process.env.MERCADO_LIVRE_CLIENT_SECRET || "").trim();
const TOKEN_KEY = String(process.env.MERCADO_LIVRE_TOKEN_KEY || "").trim();
const AUTHORIZATION_CODE = String(process.env.MERCADO_LIVRE_AUTHORIZATION_CODE || "").trim();
const REDIRECT_URI = String(
  process.env.MERCADO_LIVRE_REDIRECT_URI
  || "https://rankingdacompra.com.br/oauth-mercadolivre.html",
).trim();
const MAX_PARALLEL_REQUESTS = 5;
const CONFIRMATIONS_TO_HIDE = 2;

function fieldValue(field) {
  if (!field) return "";
  return field.stringValue ?? field.integerValue ?? field.doubleValue
    ?? field.booleanValue ?? field.timestampValue ?? "";
}

function encryptionKey() {
  return createHash("sha256").update(TOKEN_KEY, "utf8").digest();
}

function encryptTokenSession(session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  });
}

function decryptTokenSession(value) {
  const payload = JSON.parse(value);
  if (payload?.version !== 1) throw new Error("Arquivo de autorização incompatível");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

async function readTokenSession() {
  try {
    return decryptTokenSession(await readFile(TOKEN_FILE, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error("Não foi possível abrir a autorização criptografada do Mercado Livre");
  }
}

async function requestOAuthToken(fields) {
  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const reason = String(payload.error_description || payload.message || `HTTP ${response.status}`);
    throw new Error(`Autorização do Mercado Livre recusada: ${reason.slice(0, 180)}`);
  }
  return payload;
}

async function saveOAuthToken(payload) {
  const session = {
    accessToken: String(payload.access_token),
    refreshToken: String(payload.refresh_token || ""),
    expiresAt: Date.now() + Math.max(300, Number(payload.expires_in || 21600)) * 1000,
  };
  await writeFile(TOKEN_FILE, `${encryptTokenSession(session)}\n`, "utf8");
  return session;
}

async function prepareAccessToken() {
  if (accessToken) return "access_token";
  const oauthConfigured = CLIENT_ID && CLIENT_SECRET && TOKEN_KEY;
  if (!oauthConfigured) return "not_configured";

  const stored = await readTokenSession();
  if (stored?.accessToken && Number(stored.expiresAt) > Date.now() + 10 * 60 * 1000) {
    accessToken = String(stored.accessToken);
    return "encrypted_session";
  }

  let payload;
  if (stored?.refreshToken) {
    payload = await requestOAuthToken({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: String(stored.refreshToken),
    });
  } else if (AUTHORIZATION_CODE) {
    payload = await requestOAuthToken({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: AUTHORIZATION_CODE,
      redirect_uri: REDIRECT_URI,
    });
  } else {
    throw new Error(
      "Autorização inicial pendente: adicione MERCADO_LIVRE_AUTHORIZATION_CODE uma única vez",
    );
  }

  const session = await saveOAuthToken(payload);
  accessToken = session.accessToken;
  return stored ? "refreshed" : "authorized";
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

function extractCatalogIdFromUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const match = url.pathname.match(/\/p\/(MLB\d{6,})/i);
    return match ? match[1].toUpperCase() : "";
  } catch {
    return "";
  }
}

function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function itemFromCatalog(catalogId) {
  if (!catalogId) return "";
  try {
    const payload = await fetchJson(
      `https://api.mercadolibre.com/products/${catalogId}/items`,
      { allowMissing: true },
    );
    const candidates = Array.isArray(payload) ? payload : (payload?.results || []);
    const active = candidates.find((candidate) => (
      candidate?.status === "active" && extractItemIdFromText(candidate?.item_id || candidate?.id)
    ));
    const any = active || candidates.find((candidate) => (
      extractItemIdFromText(candidate?.item_id || candidate?.id)
    ));
    return extractItemIdFromText(any?.item_id || any?.id);
  } catch {
    return "";
  }
}

async function itemFromExactTitle(title) {
  const normalized = normalizeTitle(title);
  if (normalized.length < 18) return "";
  try {
    const payload = await fetchJson(
      `https://api.mercadolibre.com/sites/MLB/search?limit=10&q=${encodeURIComponent(title)}`,
      { allowMissing: true },
    );
    const exactMatches = (payload?.results || []).filter((candidate) => (
      candidate?.status === "active"
      && normalizeTitle(candidate?.title) === normalized
      && extractItemIdFromText(candidate?.id)
    ));
    return exactMatches.length === 1 ? extractItemIdFromText(exactMatches[0].id) : "";
  } catch {
    return "";
  }
}

async function itemFromRedirect(value) {
  try {
    const url = new URL(String(value || ""));
    if (!/meli\.la$|mercadolivre\.com/i.test(url.hostname)) return "";
    for (const method of ["HEAD", "GET"]) {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(12_000),
      });
      const direct = extractItemIdFromUrl(response.url);
      if (direct) return direct;
      const catalog = extractCatalogIdFromUrl(response.url);
      const catalogItem = await itemFromCatalog(catalog);
      if (catalogItem) return catalogItem;
      if (method === "GET") {
        const html = await response.text();
        const embeddedPatterns = [
          /(?:wid|item_id)(?:=|%3D|\\u003[dD])(?:MLB[-_]?)(\d{6,})/i,
          /pdp_filters[^"'<>]{0,100}(?:MLB[-_]?)(\d{6,})/i,
        ];
        for (const pattern of embeddedPatterns) {
          const embedded = html.match(pattern);
          if (embedded) return `MLB${embedded[1]}`;
        }
      } else if (response.body) {
        await response.body.cancel();
      }
    }
  } catch {
    return "";
  }
  return "";
}

async function resolveItemId(product) {
  const explicit = extractItemIdFromText(product.mercadoLivreItemId);
  if (explicit) return explicit;

  const urls = [product.link, product.linkAfiliado].filter(Boolean);
  for (const value of urls) {
    const direct = extractItemIdFromUrl(value);
    if (direct) return direct;

    const catalogItem = await itemFromCatalog(extractCatalogIdFromUrl(value));
    if (catalogItem) return catalogItem;

    const redirected = await itemFromRedirect(value);
    if (redirected) return redirected;
  }

  // Migração dos cadastros antigos: só aceita uma correspondência de título
  // exatamente igual, evitando associar automaticamente um produto diferente.
  return itemFromExactTitle(product.titulo);
}

function requestHeaders() {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function fetchJson(url, { allowMissing = false, authenticated = true } = {}) {
  const response = await fetch(url, {
    headers: authenticated ? requestHeaders() : {},
    signal: AbortSignal.timeout(15_000),
  });
  if (allowMissing && [401, 403, 404].includes(response.status)) return null;
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = String(
      payload?.message || payload?.error || payload?.code || "",
    ).trim();
    const error = new Error(
      `Mercado Livre: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`,
    );
    error.httpStatus = response.status;
    throw error;
  }
  return response.json();
}

async function fetchLightningPromotion(itemId) {
  if (!accessToken) return null;
  const payload = await fetchJson(
    `https://api.mercadolibre.com/seller-promotions/items/${itemId}?app_version=v2`,
    { allowMissing: true },
  );
  if (!payload) return null;
  const promotions = Array.isArray(payload) ? payload : Array.isArray(payload.results) ? payload.results : [];
  const lightning = promotions.find((promotion) => {
    const type = String(promotion?.type || promotion?.promotion_type || "").toUpperCase();
    const status = String(promotion?.status?.id || promotion?.status || "").toLowerCase();
    return type === "LIGHTNING" && ["active", "started"].includes(status);
  });
  if (!lightning) return { checked: true, active: false };
  const endsAt = String(lightning.end_date || lightning.finish_date || lightning.date_to || "").trim();
  const startsAt = String(lightning.start_date || lightning.begin_date || lightning.date_from || "").trim();
  const endTime = Date.parse(endsAt);
  const price = Number(lightning.deal_price ?? lightning.price ?? lightning.discounted_price);
  return {
    checked: true,
    active: Boolean(endsAt && Number.isFinite(endTime) && endTime > Date.now()),
    promotionId: String(lightning.id || lightning.promotion_id || ""),
    startsAt,
    endsAt,
    price: Number.isFinite(price) && price > 0 ? price : null,
    source: "seller-promotions",
  };
}

function numberFromValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function walkJson(value, visitor) {
  if (!value || typeof value !== "object") return;
  visitor(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach((item) => walkJson(item, visitor));
    else walkJson(child, visitor);
  }
}

export function parseMarketplaceHtml(html, itemId) {
  const source = String(html || "");
  const products = [];
  const jsonLdPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of source.matchAll(jsonLdPattern)) {
    try {
      const parsed = JSON.parse(match[1].trim());
      walkJson(parsed, (node) => {
        const type = String(node["@type"] || "").toLowerCase();
        if (type === "product" && node.offers) products.push(node);
      });
    } catch {
      // Alguns anúncios incluem blocos não JSON; os metadados abaixo continuam disponíveis.
    }
  }

  for (const product of products) {
    const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
    for (const offer of offers.filter(Boolean)) {
      const availability = String(offer.availability || "").toLowerCase();
      const price = numberFromValue(
        offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price,
      );
      if (!price) continue;
      const unavailable = /outofstock|soldout|discontinued/.test(availability);
      return {
        itemId,
        status: unavailable ? "inactive" : "active",
        available: !unavailable,
        price,
        regularPrice: null,
        currencyId: String(offer.priceCurrency || "BRL"),
        source: "public_page",
      };
    }
  }

  const pricePatterns = [
    /property=["']product:price:amount["'][^>]+content=["']([^"']+)/i,
    /itemprop=["']price["'][^>]+content=["']([^"']+)/i,
    /aria-label=["']Agora:\s*([\d.]+)\s*reais(?:\s+com\s+(\d+)\s+centavos)?/i,
    /aria-label=["'](?!Antes:)([\d.]+)\s*reais(?:\s+com\s+(\d+)\s+centavos)?/i,
    /"price"\s*:\s*"?(\d+(?:[.,]\d+)?)/i,
  ];
  let price = null;
  for (const pattern of pricePatterns) {
    const match = source.match(pattern);
    price = numberFromValue(
      match?.[2] ? `${match[1]},${String(match[2]).padStart(2, "0")}` : match?.[1],
    );
    if (price) break;
  }

  const normalized = source
    .replace(/&aacute;/gi, "á")
    .replace(/&atilde;/gi, "ã")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .toLowerCase();
  const unavailable = [
    "anúncio pausado",
    "anuncio pausado",
    "produto indisponível",
    "produto indisponivel",
    "publicação finalizada",
    "publicacao finalizada",
    "outofstock",
  ].some((marker) => normalized.includes(marker));
  const available = [
    "estoque disponível",
    "estoque disponivel",
    "comprar agora",
    "opções de compra",
    "opcoes de compra",
    "ir para a compra",
    "adicionar ao carrinho",
    "buybox-form",
    "instock",
  ].some((marker) => normalized.includes(marker));

  if (unavailable) {
    return {
      itemId,
      status: "inactive",
      available: false,
      price,
      regularPrice: null,
      currencyId: "BRL",
      source: "public_page",
    };
  }
  if (price && available) {
    return {
      itemId,
      status: "active",
      available: true,
      price,
      regularPrice: null,
      currencyId: "BRL",
      source: "public_page",
    };
  }
  throw new Error(
    `Mercado Livre: página sem preço ou disponibilidade verificável (preço=${price ? "sim" : "não"}, compra=${available ? "sim" : "não"}, tamanho=${source.length})`,
  );
}

async function fetchMarketplacePublicPage(itemId, productUrls = []) {
  const numericId = String(itemId || "").replace(/\D/g, "");
  const candidates = [
    ...productUrls,
    `https://produto.mercadolivre.com.br/MLB-${numericId}-_JM`,
  ].filter((value, index, list) => value && list.indexOf(value) === index);
  let lastError = new Error("Mercado Livre: página pública indisponível");

  for (const candidate of candidates) {
    let response;
    try {
      response = await fetch(candidate, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "pt-BR,pt;q=0.9",
        "user-agent":
          "Mozilla/5.0 (compatible; RankingDaCompra/1.0; +https://rankingdacompra.com.br/)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      });
      if (response.status === 404) continue;
      if (!response.ok) {
        lastError = new Error(`Mercado Livre: página pública HTTP ${response.status}`);
        continue;
      }
      return parseMarketplaceHtml(await response.text(), itemId);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function fetchMarketplaceItem(itemId, product = {}) {
  let item;
  let itemError = null;
  const attributes =
    "id,status,available_quantity,currency_id,permalink,price,original_price";
  const batchUrl =
    "https://api.mercadolibre.com/items?ids="
    + encodeURIComponent(itemId)
    + "&attributes="
    + attributes;
  const authenticationAttempts = accessToken ? [true, false] : [false];

  for (const authenticated of authenticationAttempts) {
    try {
      const batch = await fetchJson(batchUrl, { authenticated });
      const entry = Array.isArray(batch) ? batch[0] : null;
      if (!entry || Number(entry.code) !== 200 || !entry.body) {
        const status = Number(entry?.code || 502);
        const detail = String(
          entry?.body?.message || entry?.body?.error || "resposta inválida",
        ).trim();
        const requestError = new Error(
          "Mercado Livre Multiget: HTTP " + status + " - " + detail,
        );
        requestError.httpStatus = status;
        throw requestError;
      }
      item = entry.body;
      break;
    } catch (error) {
      itemError = error;
      if (error.httpStatus === 404) {
        return {
          itemId,
          status: "not_found",
          available: false,
          price: null,
          regularPrice: null,
          currencyId: "BRL",
          source: "api",
        };
      }
      if (authenticated && [401, 403].includes(error.httpStatus)) {
        console.warn(
          "Mercado Livre recusou o token para " + itemId
          + "; tentando a consulta pública oficial.",
        );
        continue;
      }
      break;
    }
  }

  if (!item && [401, 403].includes(itemError?.httpStatus)) {
    try {
      item = await fetchJson(
        "https://api.mercadolibre.com/items/"
          + encodeURIComponent(itemId)
          + "?attributes="
          + attributes,
        { authenticated: false },
      );
    } catch (error) {
      itemError = error;
    }
  }

  if (!item) {
    const error = itemError || new Error("Mercado Livre: anúncio sem resposta");
    if (error.httpStatus === 404) {
      return {
        itemId,
        status: "not_found",
        available: false,
        price: null,
        regularPrice: null,
        currencyId: "BRL",
        source: "api",
      };
    }
    if ([401, 403].includes(error.httpStatus)) {
      let salePriceError;
      for (const authenticated of authenticationAttempts) {
        try {
          const salePrice = await fetchJson(
            "https://api.mercadolibre.com/items/"
              + encodeURIComponent(itemId)
              + "/sale_price?context=channel_marketplace",
            { authenticated },
          );
          const amount = Number(salePrice?.amount);
          const regularAmount = Number(salePrice?.regular_amount);
          if (Number.isFinite(amount) && amount > 0) {
            return {
              itemId,
              status: "active",
              available: true,
              price: amount,
              regularPrice:
                Number.isFinite(regularAmount) && regularAmount > amount
                  ? regularAmount
                  : null,
              currencyId: String(salePrice?.currency_id || "BRL"),
              source: authenticated
                ? "sale_price_api"
                : "sale_price_public_api",
            };
          }
          throw new Error("Mercado Livre: preço de venda ausente");
        } catch (caught) {
          salePriceError = caught;
          if (authenticated && [401, 403].includes(caught.httpStatus)) {
            continue;
          }
          break;
        }
      }
      try {
        return await fetchMarketplacePublicPage(
          itemId,
          [product.link, product.linkAfiliado].filter(Boolean),
        );
      } catch (publicError) {
        throw new Error(
          error.message
          + "; preço: "
          + (salePriceError?.message || "indisponível")
          + "; fallback público: "
          + publicError.message,
        );
      }
    }
    throw error;
  }

  let salePrice = null;
  if (accessToken) {
    salePrice = await fetchJson(
      "https://api.mercadolibre.com/items/" + itemId + "/sale_price",
      { allowMissing: true },
    );
  }
  const lightning = await fetchLightningPromotion(itemId);

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
    source: itemError ? "public_api" : "api",
    lightning,
  };
}

function lightningFields(result = {}) {
  const promotion = result.lightning || {};
  return {
    lightningChecked: promotion.checked === true,
    lightningActive: promotion.active === true,
    lightningPromotionId: String(promotion.promotionId || ""),
    lightningStartsAt: String(promotion.startsAt || ""),
    lightningEndsAt: String(promotion.endsAt || ""),
    lightningPrice: Number(promotion.price) > 0 ? Number(promotion.price) : null,
    lightningSource: String(promotion.source || ""),
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
      source: result.source || "api",
      checkedAt,
      ...lightningFields(result),
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
    source: result.source || "api",
    checkedAt,
    ...lightningFields(result),
  };
}

function sameBusinessState(a = {}, b = {}) {
  const keys = [
    "itemId", "managed", "status", "available", "visible",
    "unavailableChecks", "price", "regularPrice", "currencyId", "source", "lastError",
    "lightningChecked", "lightningActive", "lightningPromotionId", "lightningStartsAt",
    "lightningEndsAt", "lightningPrice", "lightningSource",
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
    const result = await fetchMarketplaceItem(itemId, product);
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
  const authorization = await prepareAccessToken();
  if (authorization === "not_configured") {
    console.log(
      "Sincronização pausada com segurança: configure a autorização oficial do Mercado Livre.",
    );
    return;
  }

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
    if (record.lastError) summary.errors++;
    else if (!record.managed) summary.unmanaged++;
    else if (record.visible === false) summary.hidden++;
    else if (record.available === false) summary.confirming++;
    else if (record.available === true) summary.active++;
    else summary.errors++;
    return summary;
  }, { active: 0, hidden: 0, confirming: 0, unmanaged: 0, errors: 0 });

  console.log(
    `Mercado Livre sincronizado: ${products.length} produtos; `
    + `${counts.active} ativos, ${counts.hidden} ocultos, `
    + `${counts.confirming} aguardando confirmação, ${counts.unmanaged} sem item_id `
    + `e ${counts.errors} com falha temporária.`,
  );

  const successfulChecks = entries.reduce(
    (total, [, record]) =>
      total + (record.managed === true && !record.lastError ? 1 : 0),
    0,
  );
  console.log(
    "Preços efetivamente confirmados nesta execução: " + successfulChecks + ".",
  );
  if (products.length > 0 && successfulChecks === 0) {
    throw new Error(
      "Sincronização inválida: nenhum preço foi confirmado. "
      + "O relatório foi gerado, mas a execução será marcada como falha.",
    );
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
