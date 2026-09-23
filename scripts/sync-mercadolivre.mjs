import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PROJECT_ID = "rankingdacompra";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OUTPUT = resolve("mercadolivre-status.json");
const TOKEN_FILE = resolve(".mercadolivre-token.enc");
const MLB_RESOLUTIONS_FILE = resolve("mlb-resolucoes.json");
const PRODUCT_SNAPSHOT = String(process.env.RDC_PRODUCTS_SNAPSHOT || "").trim();
const BATCH_SKIP_MARKER = String(process.env.RDC_BATCH_SKIP_MARKER || "").trim();
const BATCH_PARTIAL_MARKER = String(process.env.RDC_BATCH_PARTIAL_MARKER || "").trim();
const DAILY_BATCH = String(process.env.RDC_DAILY_BATCH || "").toLowerCase() === "true";
const FORCE_BATCH = String(process.env.RDC_FORCE_BATCH || "").toLowerCase() === "true";
const PREFLIGHT_ONLY = String(process.env.RDC_ML_PREFLIGHT_ONLY || "").toLowerCase() === "true";
let accessToken = String(process.env.MERCADO_LIVRE_ACCESS_TOKEN || "").trim();
const CLIENT_ID = String(process.env.MERCADO_LIVRE_CLIENT_ID || "").trim();
const CLIENT_SECRET = String(process.env.MERCADO_LIVRE_CLIENT_SECRET || "").trim();
const TOKEN_KEY = String(process.env.MERCADO_LIVRE_TOKEN_KEY || "").trim();
const AUTHORIZATION_CODE = String(process.env.MERCADO_LIVRE_AUTHORIZATION_CODE || "").trim();
const REDIRECT_URI = String(
  process.env.MERCADO_LIVRE_REDIRECT_URI
  || "https://rankingdacompra.com.br/oauth-mercadolivre.html",
).trim();
const MAX_PARALLEL_REQUESTS = Math.max(
  1,
  Math.min(2, Number(process.env.RDC_ML_PARALLEL_REQUESTS || 2)),
);
const MAX_BULK_ITEMS = 20;
const MARKETPLACE_REQUEST_INTERVAL_MS = Math.max(
  200,
  Number(process.env.RDC_ML_REQUEST_INTERVAL_MS || 350),
);
const MARKETPLACE_REQUEST_RETRIES = 4;
const CONFIRMATIONS_TO_HIDE = 2;

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
let nextMarketplaceRequestAt = 0;

async function throttleMarketplaceRequest() {
  const now = Date.now();
  const delay = Math.max(0, nextMarketplaceRequestAt - now);
  nextMarketplaceRequestAt = Math.max(now, nextMarketplaceRequestAt) + MARKETPLACE_REQUEST_INTERVAL_MS;
  if (delay > 0) await wait(delay);
}

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

async function saveOAuthToken(payload, authorizationCodeHash = "") {
  const session = {
    accessToken: String(payload.access_token),
    refreshToken: String(payload.refresh_token || ""),
    expiresAt: Date.now() + Math.max(300, Number(payload.expires_in || 21600)) * 1000,
    authorizationCodeHash,
  };
  await writeFile(TOKEN_FILE, `${encryptTokenSession(session)}\n`, "utf8");
  return session;
}

async function prepareAccessToken() {
  const staticAccessToken = accessToken;
  const oauthConfigured = CLIENT_ID && CLIENT_SECRET && TOKEN_KEY;

  if (!oauthConfigured) {
    return staticAccessToken ? "access_token" : "not_configured";
  }

  const stored = await readTokenSession();
  const authorizationCodeHash = AUTHORIZATION_CODE
    ? createHash("sha256").update(AUTHORIZATION_CODE, "utf8").digest("hex")
    : "";

  if (AUTHORIZATION_CODE && stored?.authorizationCodeHash !== authorizationCodeHash) {
    const payload = await requestOAuthToken({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: AUTHORIZATION_CODE,
      redirect_uri: REDIRECT_URI,
    });
    const session = await saveOAuthToken(payload, authorizationCodeHash);
    accessToken = session.accessToken;
    return "authorized";
  }

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
  } else if (staticAccessToken) {
    accessToken = staticAccessToken;
    return "access_token";
  } else {
    throw new Error(
      "Autorização inicial pendente: adicione MERCADO_LIVRE_AUTHORIZATION_CODE uma única vez",
    );
  }

  const session = await saveOAuthToken(payload, stored?.authorizationCodeHash || authorizationCodeHash);
  accessToken = session.accessToken;
  return "refreshed";
}

let rejectedAccessTokenRefreshPromise = null;
let rejectedAccessTokenRefreshUsed = false;

async function refreshRejectedAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET || !TOKEN_KEY) return false;
  if (rejectedAccessTokenRefreshUsed) return false;
  if (rejectedAccessTokenRefreshPromise) return rejectedAccessTokenRefreshPromise;
  rejectedAccessTokenRefreshUsed = true;
  rejectedAccessTokenRefreshPromise = (async () => {
    const stored = await readTokenSession();
    if (!stored?.refreshToken) return false;
    const payload = await requestOAuthToken({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: String(stored.refreshToken),
    });
    const session = await saveOAuthToken(payload, stored.authorizationCodeHash || "");
    accessToken = session.accessToken;
    console.log("Autorização do Mercado Livre renovada após recusa da sessão anterior.");
    return true;
  })().catch((error) => {
    console.warn("Não foi possível renovar a autorização recusada: " + String(error?.message || error));
    return false;
  });
  return rejectedAccessTokenRefreshPromise;
}

async function fetchFirestorePage(url, attempt = 0) {
  const response = await fetch(url);
  if (response.ok) return response;
  const retryable = response.status === 429 || response.status >= 500;
  if (retryable && attempt < 4) {
    const retryAfter = Number(response.headers.get("retry-after") || 0);
    const delay = Math.max(retryAfter * 1000, 1500 * (2 ** attempt));
    console.warn(`Firestore respondeu HTTP ${response.status}; nova tentativa em ${delay} ms.`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    return fetchFirestorePage(url, attempt + 1);
  }
  throw new Error(`Firestore: HTTP ${response.status}`);
}

async function listProducts() {
  const products = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await fetchFirestorePage(`${FIRESTORE}/produtos?${query}`);
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

async function readMlbResolutions() {
  try {
    const payload = JSON.parse(await readFile(MLB_RESOLUTIONS_FILE, "utf8"));
    return payload?.resultados && typeof payload.resultados === "object"
      ? payload.resultados
      : {};
  } catch {
    return {};
  }
}

export function isMercadoLivreProduct(product) {
  const marketplace = String(product?.marketplace || "").toLowerCase();
  if (marketplace === "shopee") return false;
  if (marketplace === "mercado_livre") return true;
  try {
    const host = new URL(String(product?.linkAfiliado || product?.link || "")).hostname.toLowerCase();
    if (host === "shopee.com.br" || host.endsWith(".shopee.com.br")) return false;
  } catch {}
  // Compatibilidade: todos os documentos antigos, sem o campo marketplace,
  // continuam sendo tratados como produtos do Mercado Livre.
  return true;
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

export function extractCatalogIdFromUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const match = url.pathname.match(/\/p\/(MLB\d{6,})/i);
    return match ? match[1].toUpperCase() : "";
  } catch {
    return "";
  }
}

export function shouldTrustStoredItemId(itemId, product = {}) {
  const normalized = extractItemIdFromText(itemId);
  if (!normalized) return false;
  const urls = [product.link, product.linkAfiliado].filter(Boolean);
  const catalogIds = urls.map(extractCatalogIdFromUrl).filter(Boolean);
  if (catalogIds.includes(normalized)) return false;
  const digits = normalized.replace(/\D/g, "");
  // Os anúncios atuais usam um MLB longo. Códigos curtos encontrados em links
  // /p/ são catálogo ou campanha e não podem justificar ocultação automática.
  if (urls.length && digits.length < 10) return false;
  return true;
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

async function resolveItemId(product, previousRecord = {}, allowNetworkLookup = true) {
  const explicit = extractItemIdFromText(product.mercadoLivreItemId);
  const urls = [product.link, product.linkAfiliado].filter(Boolean);

  // O wid/item_id do endereço identifica a oferta concreta e deve prevalecer
  // sobre um código antigo salvo no cadastro.
  for (const value of urls) {
    const direct = extractItemIdFromUrl(value);
    if (direct) return direct;
  }

  if (shouldTrustStoredItemId(explicit, product)) return explicit;

  // O relatório da execução anterior já contém o item_id confirmado. Reutilizá-lo
  // evita redirecionamentos e buscas repetidas em todos os lotes seguintes.
  const previousItemId = extractItemIdFromText(previousRecord.itemId);
  if (shouldTrustStoredItemId(previousItemId, product)) return previousItemId;

  // A localização profunda pertence ao robô localizador. O lote diário usa o
  // arquivo produzido por ele e não multiplica buscas, redirects e leituras.
  if (!allowNetworkLookup) return "";

  for (const value of urls) {

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

async function fetchJson(
  url,
  {
    allowMissing = false,
    authenticated = true,
    maxRetries = MARKETPLACE_REQUEST_RETRIES,
  } = {},
  attempt = 0,
) {
  await throttleMarketplaceRequest();
  const response = await fetch(url, {
    headers: authenticated ? requestHeaders() : {},
    signal: AbortSignal.timeout(15_000),
  });
  const retryable = response.status === 429 || response.status >= 500;
  if (retryable && attempt < maxRetries) {
    const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
    const exponential = 1200 * (2 ** attempt);
    const jitter = Math.floor(Math.random() * 600);
    const delay = Math.max(retryAfter, exponential + jitter);
    console.warn(
      `Mercado Livre respondeu HTTP ${response.status}; nova tentativa em ${delay} ms.`,
    );
    if (response.body) await response.body.cancel().catch(() => {});
    await wait(delay);
    return fetchJson(
      url,
      { allowMissing, authenticated, maxRetries },
      attempt + 1,
    );
  }
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

export function bulkItemFromEntry(entry = {}) {
  const rawStatus = entry.status_code ?? entry.code;
  const status = rawStatus === undefined || rawStatus === null
    ? (entry.body ? 200 : 502)
    : Number(rawStatus);
  if (status === 200 && entry.body) return { item: entry.body, error: null };
  if (status === 404) return { item: null, error: null, notFound: true };
  const detail = String(
    entry?.body?.message || entry?.body?.error || entry?.message || "resposta inválida",
  ).trim();
  const error = new Error(`Mercado Livre Bulk: HTTP ${status} - ${detail}`);
  error.httpStatus = status;
  return { item: null, error };
}

export function bulkItemAttributes() {
  return [
    "id", "status", "available_quantity", "currency_id", "permalink", "price",
    "original_price",
  ].map((attribute) => `body.${attribute}`).join(",");
}

export function shouldRetryBulkOutcome(outcome = {}) {
  if (!outcome?.error) return false;
  const status = Number(outcome.error.httpStatus || 0);
  if (status > 0) return status === 429 || status >= 500;
  return /resposta inv[aá]lida|fetch failed|timeout|tempo esgotado/i.test(
    String(outcome.error.message || outcome.error),
  );
}

export function summarizeBatchChecks(entries = []) {
  const summary = { confirmed: 0, failed: 0, unmanaged: 0, blocked: 0 };
  for (const [, record] of entries) {
    if (record.managed !== true) summary.unmanaged++;
    else if (record.lastError) {
      summary.failed++;
      if (/HTTP\s+(?:401|403)\b/i.test(String(record.lastError))) summary.blocked++;
    } else summary.confirmed++;
  }
  summary.complete = summary.failed === 0;
  summary.reason = summary.complete
    ? "complete"
    : summary.blocked > 0 ? "marketplace_access_denied" : "temporary_failures";
  return summary;
}

async function requestBulkItems(itemIds, authenticated) {
  // No endpoint /items/bulk, id e status_code pertencem ao envelope e já são
  // devolvidos automaticamente. O filtro aceita somente campos de body.*;
  // enviar campos do envelope nele faz alguns lotes retornarem 403 por item.
  const attributes = bulkItemAttributes();
  const url = "https://api.mercadolibre.com/items/bulk?ids="
    + encodeURIComponent(itemIds.join(","))
    + "&attributes="
    + attributes;
  const payload = await fetchJson(url, { authenticated });
  if (!Array.isArray(payload)) {
    throw new Error("Mercado Livre Bulk: resposta inválida");
  }
  return new Map(payload.map((entry, index) => {
    const id = extractItemIdFromText(entry?.id || entry?.body?.id || itemIds[index]);
    return [id || itemIds[index], bulkItemFromEntry(entry)];
  }));
}

async function requestBulkGroup(itemIds) {
  let groupOutcomes;
  let lastError;
  const authenticatedAttempts = accessToken ? [true, false] : [false];
  for (const authenticated of authenticatedAttempts) {
    try {
      groupOutcomes = await requestBulkItems(itemIds, authenticated);
      let deniedIds = itemIds.filter((id) => (
        [401, 403].includes(groupOutcomes.get(id)?.error?.httpStatus)
      ));
      if (authenticated && deniedIds.length && await refreshRejectedAccessToken()) {
        const refreshed = await requestBulkItems(deniedIds, true);
        for (const [id, outcome] of refreshed) groupOutcomes.set(id, outcome);
        deniedIds = deniedIds.filter((id) => (
          [401, 403].includes(groupOutcomes.get(id)?.error?.httpStatus)
        ));
      }
      if (authenticated && deniedIds.length) {
        const publicOutcomes = await requestBulkItems(deniedIds, false);
        for (const [id, outcome] of publicOutcomes) groupOutcomes.set(id, outcome);
      }
      return groupOutcomes;
    } catch (error) {
      lastError = error;
      if (authenticated && [401, 403].includes(error.httpStatus)) {
        if (await refreshRejectedAccessToken()) {
          try {
            return await requestBulkItems(itemIds, true);
          } catch (refreshedError) {
            lastError = refreshedError;
          }
        }
        continue;
      }
      break;
    }
  }
  throw lastError || new Error("Mercado Livre Bulk: consulta não concluída");
}

async function requestSingleMarketplaceItem(itemId) {
  const attributes = bulkItemAttributes()
    .split(",")
    .map((attribute) => attribute.replace(/^body\./, ""))
    .join(",");
  const url = `https://api.mercadolibre.com/items/${encodeURIComponent(itemId)}`
    + `?attributes=${encodeURIComponent(attributes)}`;
  const authenticatedAttempts = accessToken ? [true, false] : [false];
  let lastError;
  for (const authenticated of authenticatedAttempts) {
    try {
      const item = await fetchJson(url, { authenticated, maxRetries: 1 });
      if (!item || !extractItemIdFromText(item.id || itemId)) {
        const invalid = new Error("Mercado Livre Item: resposta inválida");
        invalid.httpStatus = 502;
        throw invalid;
      }
      return { item, error: null };
    } catch (error) {
      lastError = error;
      if (error.httpStatus === 404) return { item: null, error: null, notFound: true };
      if (authenticated && [401, 403].includes(error.httpStatus)) {
        if (await refreshRejectedAccessToken()) {
          try {
            const item = await fetchJson(url, {
              authenticated: true,
              maxRetries: 1,
            });
            if (item) return { item, error: null };
          } catch (refreshedError) {
            lastError = refreshedError;
          }
        }
        continue;
      }
      break;
    }
  }
  return { item: null, error: lastError };
}

async function recoverRetryableBulkOutcomes(groupOutcomes, itemIds) {
  let pending = itemIds.filter((id) => shouldRetryBulkOutcome(groupOutcomes.get(id)));
  if (!pending.length) return groupOutcomes;

  console.warn(
    `Mercado Livre devolveu erro temporário para ${pending.length} anúncio(s); `
    + "repetindo somente os afetados em grupos menores.",
  );
  await wait(1200 + Math.floor(Math.random() * 600));
  for (let index = 0; index < pending.length; index += 5) {
    const smallGroup = pending.slice(index, index + 5);
    try {
      const recovered = await requestBulkGroup(smallGroup);
      for (const [id, outcome] of recovered) groupOutcomes.set(id, outcome);
    } catch (error) {
      for (const id of smallGroup) groupOutcomes.set(id, { item: null, error });
    }
  }

  pending = itemIds.filter((id) => shouldRetryBulkOutcome(groupOutcomes.get(id)));
  if (!pending.length) return groupOutcomes;

  console.warn(
    `${pending.length} anúncio(s) ainda falharam no lote reduzido; `
    + "usando a consulta oficial individual com ritmo controlado.",
  );
  for (const id of pending) {
    groupOutcomes.set(id, await requestSingleMarketplaceItem(id));
  }
  return groupOutcomes;
}

async function fetchMarketplaceItemsBulk(itemIds) {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  const outcomes = new Map();
  for (let index = 0; index < uniqueIds.length; index += MAX_BULK_ITEMS) {
    const group = uniqueIds.slice(index, index + MAX_BULK_ITEMS);
    let groupOutcomes;
    try {
      groupOutcomes = await requestBulkGroup(group);
      groupOutcomes = await recoverRetryableBulkOutcomes(groupOutcomes, group);
    } catch (error) {
      groupOutcomes = new Map(group.map((id) => [id, { item: null, error }]));
      groupOutcomes = await recoverRetryableBulkOutcomes(groupOutcomes, group);
    }
    for (const id of group) {
      outcomes.set(id, groupOutcomes.get(id) || {
        item: null,
        error: new Error("Mercado Livre Bulk: item ausente na resposta"),
      });
    }
  }
  return outcomes;
}

export function catalogRecordFromPayload(catalogId, payload = {}) {
  const winner = payload?.buy_box_winner || payload?.buyBoxWinner || {};
  const amount = Number(winner.price ?? payload?.price);
  const regularAmount = Number(winner.original_price ?? payload?.original_price);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    itemId: extractItemIdFromText(winner.item_id || winner.id || ""),
    catalogId: String(catalogId || payload?.id || "").toUpperCase(),
    status: "active",
    available: true,
    price: amount,
    regularPrice: Number.isFinite(regularAmount) && regularAmount > amount ? regularAmount : null,
    currencyId: String(winner.currency_id || payload?.currency_id || "BRL"),
    source: "catalog_api",
  };
}

async function fetchMarketplaceCatalog(catalogId) {
  if (!catalogId) throw new Error("Mercado Livre: código de catálogo ausente");
  const url = `https://api.mercadolibre.com/products/${encodeURIComponent(catalogId)}`;
  const attempts = accessToken ? [true, false] : [false];
  let lastError = new Error("Mercado Livre: catálogo sem preço verificável");
  for (const authenticated of attempts) {
    try {
      const payload = await fetchJson(url, { authenticated });
      const record = catalogRecordFromPayload(catalogId, payload);
      if (record) return record;
      lastError = new Error("Mercado Livre: catálogo sem preço verificável");
    } catch (error) {
      lastError = error;
      if (authenticated && [401, 403].includes(error.httpStatus)) {
        if (await refreshRejectedAccessToken()) {
          try {
            const refreshed = catalogRecordFromPayload(
              catalogId,
              await fetchJson(url, { authenticated: true }),
            );
            if (refreshed) return refreshed;
          } catch (refreshedError) {
            lastError = refreshedError;
          }
        }
        continue;
      }
      break;
    }
  }
  throw lastError;
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

async function fetchMarketplaceItem(itemId, product = {}, prefetchedOutcome = null) {
  let item;
  let itemError = null;
  const attributes =
    "id,status,available_quantity,currency_id,permalink,price,original_price";
  const batchUrl =
    "https://api.mercadolibre.com/items/bulk?ids="
    + encodeURIComponent(itemId)
    + "&attributes="
    + attributes.split(",").map((attribute) => `body.${attribute}`).join(",");
  const authenticationAttempts = accessToken ? [true, false] : [false];

  const requestBatchItem = async (authenticated) => {
    const batch = await fetchJson(batchUrl, { authenticated });
    const entry = Array.isArray(batch) ? batch[0] : null;
    if (!entry) throw new Error("Mercado Livre Multiget: resposta inválida");
    const outcome = bulkItemFromEntry(entry);
    if (outcome.item) return outcome.item;
    if (outcome.notFound) {
      const notFound = new Error("Mercado Livre Multiget: anúncio não encontrado");
      notFound.httpStatus = 404;
      throw notFound;
    }
    throw outcome.error;
  };

  if (prefetchedOutcome?.notFound) {
    return {
      itemId,
      status: "not_found",
      available: false,
      price: null,
      regularPrice: null,
      currencyId: "BRL",
      source: "bulk_api",
    };
  }
  if (prefetchedOutcome?.item) item = prefetchedOutcome.item;
  else if (prefetchedOutcome?.error) throw prefetchedOutcome.error;

  for (const authenticated of item || itemError ? [] : authenticationAttempts) {
    try {
      item = await requestBatchItem(authenticated);
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
        if (await refreshRejectedAccessToken()) {
          try {
            item = await requestBatchItem(true);
            break;
          } catch (refreshedError) {
            itemError = refreshedError;
          }
        }
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
        const catalogId = [product.link, product.linkAfiliado]
          .map(extractCatalogIdFromUrl)
          .find(Boolean);
        if (catalogId) {
          try {
            const catalog = await fetchMarketplaceCatalog(catalogId);
            return { ...catalog, itemId: itemId || catalog.itemId };
          } catch {
            // Mantém abaixo o erro completo das tentativas do anúncio.
          }
        }
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

  // O endpoint bulk já traz o preço atual e o preço anterior. Evitamos aqui
  // duas requisições adicionais por produto (/sale_price e promoções), que eram
  // a principal fonte de picos e bloqueios no lote diário.
  const amount = Number(item?.price);
  const regularAmount = Number(item?.original_price);
  const status = String(item?.status || "unknown");
  const quantity = Number(item?.available_quantity);

  return {
    itemId,
    status,
    available: status === "active" && (!Number.isFinite(quantity) || quantity > 0),
    price: Number.isFinite(amount) && amount > 0 ? amount : null,
    regularPrice: Number.isFinite(regularAmount) && regularAmount > amount ? regularAmount : null,
    currencyId: String(item?.currency_id || "BRL"),
    source: itemError ? "public_api" : "bulk_api",
  };
}

function lightningFields(result = {}, previous = {}) {
  if (!Object.hasOwn(result, "lightning")) {
    const endsAt = String(previous.lightningEndsAt || "");
    const stillActive = previous.lightningActive === true
      && Number.isFinite(Date.parse(endsAt))
      && Date.parse(endsAt) > Date.now();
    return {
      lightningChecked: previous.lightningChecked === true,
      lightningActive: stillActive,
      lightningPromotionId: String(previous.lightningPromotionId || ""),
      lightningStartsAt: String(previous.lightningStartsAt || ""),
      lightningEndsAt: endsAt,
      lightningPrice: stillActive && Number(previous.lightningPrice) > 0
        ? Number(previous.lightningPrice)
        : null,
      lightningSource: String(previous.lightningSource || ""),
    };
  }
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
      catalogId: result.catalogId || "",
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
      lastAttemptAt: checkedAt,
      ...lightningFields(result, previous),
    };
  }

  return {
    itemId: result.itemId,
    catalogId: result.catalogId || "",
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
    lastAttemptAt: checkedAt,
    ...lightningFields(result, previous),
  };
}

function sameBusinessState(a = {}, b = {}) {
  const keys = [
    "itemId", "catalogId", "managed", "status", "available", "visible",
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

export function selectPreflightItemIds(previous = {}, limit = 3) {
  const ids = Object.values(previous.products || {})
    .filter((record) => record?.managed === true && /HTTP\s+(?:401|403)\b/i.test(String(record.lastError || "")))
    .map((record) => extractItemIdFromText(record.itemId))
    .filter(Boolean);
  return [...new Set(ids)].slice(0, limit);
}

async function checkMarketplaceAccess(previous) {
  const ids = selectPreflightItemIds(previous);
  if (!ids.length) {
    if (PREFLIGHT_ONLY) throw new Error("Sem item de amostra para testar o acesso do Mercado Livre.");
    console.log("Sem bloqueios anteriores para testar; seguindo com a conferência.");
    return;
  }
  if (PREFLIGHT_ONLY) {
    try {
      await fetchJson("https://api.mercadolibre.com/users/me", { maxRetries: 0 });
      console.log("A conta autorizada respondeu à consulta de identidade.");
    } catch (error) {
      if (![401, 403].includes(error?.httpStatus) || !await refreshRejectedAccessToken()) {
        throw new Error(`Teste de identidade recusado antes de consultar anúncios: ${String(error?.message || error)}`);
      }
      try {
        await fetchJson("https://api.mercadolibre.com/users/me", { maxRetries: 0 });
        console.log("A conta autorizada respondeu após renovar a sessão.");
      } catch (retryError) {
        throw new Error(`Teste de identidade recusado também após renovar a sessão: ${String(retryError?.message || retryError)}`);
      }
    }
  }
  let confirmed = 0;
  const failures = [];
  for (const id of ids) {
    try {
      const item = await fetchJson(`https://api.mercadolibre.com/items/${id}`, {
        maxRetries: 0,
      });
      if (extractItemIdFromText(item?.id) === id) confirmed++;
      else failures.push(`${id}: resposta sem identificação`);
    } catch (error) {
      failures.push(`${id}: ${String(error?.message || error)}`);
    }
  }
  if (!confirmed && failures.every((failure) => /HTTP\s+(?:401|403)\b/i.test(failure))) {
    if (await refreshRejectedAccessToken()) {
      try {
        const item = await fetchJson(`https://api.mercadolibre.com/items/${ids[0]}`, {
          maxRetries: 0,
        });
        if (extractItemIdFromText(item?.id) === ids[0]) confirmed++;
      } catch (error) {
        failures.push(`Após renovar token: ${String(error?.message || error)}`);
      }
    }
  }
  if (!confirmed) {
    try {
      const item = await fetchJson(`https://api.mercadolibre.com/items/${ids[0]}`, {
        authenticated: false,
        maxRetries: 0,
      });
      if (extractItemIdFromText(item?.id) === ids[0]) confirmed++;
      else failures.push("Consulta pública: resposta sem identificação");
    } catch (error) {
      failures.push(`Consulta pública: ${String(error?.message || error)}`);
    }
  }
  if (!confirmed) {
    throw new Error(
      "Mercado Livre ainda recusou as consultas de teste; lote interrompido antes de ler o Firebase. "
      + failures.join(" | "),
    );
  }
  console.log(`Teste de acesso: ${confirmed}/${ids.length} anúncio(s) consultado(s) sem ler o Firebase.`);
  if (failures.length) console.warn(`Amostras ainda com erro: ${failures.join(" | ")}`);
}

export function repairLegacyHiddenRecords(previous = {}, repairedAt = new Date().toISOString()) {
  let repaired = 0;
  const products = Object.fromEntries(
    Object.entries(previous.products || {}).map(([id, recordValue]) => {
      const record = recordValue && typeof recordValue === "object" ? recordValue : {};
      const itemId = extractItemIdFromText(record.itemId);
      const itemDigits = itemId.replace(/\D/g, "");
      const legacyCatalogFalsePositive = record.visible === false
        && record.status === "not_found"
        && itemDigits.length > 0
        && itemDigits.length < 10;
      if (!legacyCatalogFalsePositive) return [id, record];
      repaired++;
      return [id, {
        ...record,
        itemId: "",
        managed: false,
        status: "missing_item_id",
        available: null,
        visible: true,
        unavailableChecks: 0,
        lastError: "",
        legacyRepairAt: repairedAt,
      }];
    }),
  );
  return {
    repaired,
    payload: repaired ? { ...previous, updatedAt: repairedAt, products } : previous,
  };
}

function saoPauloDay(value) {
  if (value === undefined || value === null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function shouldSkipDailyBatch(previous = {}, now = new Date()) {
  if (!DAILY_BATCH || FORCE_BATCH) return false;
  const lastBatchDay = saoPauloDay(previous.lastBatchAt);
  return Boolean(lastBatchDay && lastBatchDay === saoPauloDay(now));
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

async function checkProduct(
  product,
  previousRecord,
  checkedAt,
  resolvedItemId = null,
  prefetchedOutcome = null,
) {
  const itemId = resolvedItemId !== null
    ? resolvedItemId
    : await resolveItemId(product, previousRecord);
  const catalogId = [product.link, product.linkAfiliado]
    .map(extractCatalogIdFromUrl)
    .find(Boolean) || "";
  if (!itemId) {
    if (catalogId) {
      try {
        const result = await fetchMarketplaceCatalog(catalogId);
        return deriveRecord(previousRecord, { ...result, itemId: "", catalogId }, checkedAt);
      } catch (error) {
        return {
          ...previousRecord,
          itemId: "",
          catalogId,
          managed: true,
          status: "catalog_unavailable",
          available: null,
          visible: previousRecord.visible !== false,
          lastError: String(error?.message || "Falha temporária no catálogo").slice(0, 160),
          checkedAt: previousRecord.checkedAt || "",
          lastAttemptAt: checkedAt,
        };
      }
    }
    return {
      itemId: "",
      catalogId: "",
      managed: false,
      status: "missing_item_id",
      available: null,
      visible: true,
      unavailableChecks: 0,
      price: null,
      regularPrice: null,
      currencyId: "BRL",
      checkedAt,
      lastAttemptAt: checkedAt,
    };
  }

  const relevantPrevious = previousRecord.itemId === itemId ? previousRecord : {};
  try {
    const result = await fetchMarketplaceItem(itemId, product, prefetchedOutcome);
    return deriveRecord(relevantPrevious, { ...result, catalogId }, checkedAt);
  } catch (error) {
    return {
      ...relevantPrevious,
      itemId,
      managed: true,
      visible: relevantPrevious.visible !== false,
      lastError: String(error?.message || "Falha temporária").slice(0, 160),
      checkedAt: relevantPrevious.checkedAt || "",
      lastAttemptAt: checkedAt,
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

  let previous = await readPrevious();
  if (PREFLIGHT_ONLY) {
    await checkMarketplaceAccess(previous);
    return;
  }
  const legacyRepair = repairLegacyHiddenRecords(previous);
  if (legacyRepair.repaired > 0) {
    previous = legacyRepair.payload;
    await writeFile(OUTPUT, `${JSON.stringify(previous, null, 2)}\n`, "utf8");
    console.log(
      `Reparo seguro: ${legacyRepair.repaired} falso(s) indisponível(is) antigo(s) voltou(aram) para revisão.`,
    );
  }
  if (shouldSkipDailyBatch(previous)) {
    if (BATCH_SKIP_MARKER) await writeFile(resolve(BATCH_SKIP_MARKER), "skipped\n", "utf8");
    console.log("Lote diário já concluído hoje; nenhuma leitura do Firebase foi realizada.");
    return;
  }

  await checkMarketplaceAccess(previous);

  const checkedAt = new Date().toISOString();
  let products;
  const mlbResolutions = await readMlbResolutions();
  try {
    const allProducts = await listProducts();
    products = allProducts.filter(isMercadoLivreProduct);
    const ignored = allProducts.length - products.length;
    if (ignored > 0) console.log(`${ignored} produto(s) de outras lojas ignorado(s) pelo robô do Mercado Livre.`);
  } catch (error) {
    if (/Firestore: HTTP 429/.test(String(error?.message || error))) {
      const payload = {
        ...previous,
        lastBatchAttemptAt: checkedAt,
        batchSummary: {
          complete: false,
          reason: "firebase_quota",
          total: 0,
          confirmed: 0,
          failed: 0,
          unmanaged: 0,
          attemptedAt: checkedAt,
        },
      };
      await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      if (BATCH_PARTIAL_MARKER) await writeFile(resolve(BATCH_PARTIAL_MARKER), "partial\n", "utf8");
      console.warn(
        "Autorização atualizada. O Firebase atingiu o limite temporário; tente novamente mais tarde.",
      );
      return;
    }
    throw error;
  }
  if (PRODUCT_SNAPSHOT) {
    await writeFile(resolve(PRODUCT_SNAPSHOT), `${JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
      products,
    })}\n`, "utf8");
  }
  const resolvedProducts = await mapWithConcurrency(
    products,
    MAX_PARALLEL_REQUESTS,
    async (product) => {
      const oldRecord = previous.products?.[product.id] || {};
      const cachedResolution = mlbResolutions[product.id] || {};
      const cachedItemId = cachedResolution.status === "ok"
        ? extractItemIdFromText(cachedResolution.mlb)
        : "";
      const itemId = await resolveItemId(
        cachedItemId
          ? { ...product, mercadoLivreItemId: product.mercadoLivreItemId || cachedItemId }
          : product,
        oldRecord,
        false,
      );
      return { product, oldRecord, itemId };
    },
  );
  const bulkOutcomes = await fetchMarketplaceItemsBulk(
    resolvedProducts.map(({ itemId }) => itemId),
  );
  console.log(
    `Consulta agrupada: ${bulkOutcomes.size} anúncio(s) em blocos de até ${MAX_BULK_ITEMS}.`,
  );
  const entries = await mapWithConcurrency(
    resolvedProducts,
    MAX_PARALLEL_REQUESTS,
    async ({ product, oldRecord, itemId }) => {
      const newRecord = await checkProduct(
        product,
        oldRecord,
        checkedAt,
        itemId,
        itemId ? bulkOutcomes.get(itemId) : null,
      );
      return [product.id, newRecord];
    },
  );

  const nextProducts = Object.fromEntries(entries);
  const changed = JSON.stringify(previous.products || {}) !== JSON.stringify(nextProducts);
  const checks = summarizeBatchChecks(entries);
  const batchComplete = checks.complete;
  const payload = {
    version: 1,
    updatedAt: changed ? checkedAt : (previous.updatedAt || checkedAt),
    lastBatchAt: batchComplete ? checkedAt : (previous.lastBatchAt || ""),
    lastBatchAttemptAt: checkedAt,
    batchSummary: {
      complete: batchComplete,
      reason: checks.reason,
      total: products.length,
      confirmed: checks.confirmed,
      failed: checks.failed,
      unmanaged: checks.unmanaged,
      blocked: checks.blocked,
      attemptedAt: checkedAt,
    },
    products: nextProducts,
  };
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  if (!batchComplete && BATCH_PARTIAL_MARKER) {
    await writeFile(resolve(BATCH_PARTIAL_MARKER), "partial\n", "utf8");
  }

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

  console.log(
    "Preços efetivamente confirmados nesta execução: " + checks.confirmed + ".",
  );
  if (!batchComplete) {
    entries
      .filter(([, record]) => record.lastError)
      .slice(0, 3)
      .forEach(([productId, record]) => {
        console.error("Falha em " + productId + ": " + record.lastError);
      });
    console.warn(
      `Conferência parcial: ${checks.failed} item(ns) gerenciado(s) não foram confirmados; `
      + `${checks.blocked} bloqueado(s) por autorização ou política do Mercado Livre. `
      + "O relatório será publicado, os preços válidos serão preservados e a execução será sinalizada.",
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

