import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";


const execFileAsync = promisify(execFile);
const PROJECT_ID = "rankingdacompra";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const COLLECTION = "mlbSolicitacoes";
const OUTPUT = "mlb-resolucoes.json";
const TOKEN_FILE = ".mercadolivre-token.enc";
const TOKEN_KEY = process.env.MERCADO_LIVRE_TOKEN_KEY || "";
const CLIENT_ID = process.env.MERCADO_LIVRE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.MERCADO_LIVRE_CLIENT_SECRET || "";


function field(fieldValue) {
  return fieldValue?.stringValue ?? fieldValue?.timestampValue ?? fieldValue?.booleanValue ?? "";
}


function decode(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}


function plain(value) {
  return decode(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}


function encryptionKey() {
  if (!TOKEN_KEY) return null;
  return createHash("sha256").update(TOKEN_KEY, "utf8").digest();
}


async function readTokenSession() {
  try {
    const envelope = JSON.parse(await readFile(TOKEN_FILE, "utf8"));
    const key = encryptionKey();
    if (!key) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}


async function writeTokenSession(session) {
  const key = encryptionKey();
  if (!key) return;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  await writeFile(TOKEN_FILE, JSON.stringify({
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  }) + "\n");
}


async function accessToken() {
  const session = await readTokenSession();
  if (!session?.access_token) return "";
  if (!session.expires_at || Number(session.expires_at) > Date.now() + 120000) return session.access_token;
  if (!session.refresh_token || !CLIENT_ID || !CLIENT_SECRET) return session.access_token;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: session.refresh_token,
  });
  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return session.access_token;
  const payload = await response.json();
  const next = {
    ...session,
    ...payload,
    refresh_token: payload.refresh_token || session.refresh_token,
    expires_at: Date.now() + Math.max(60, Number(payload.expires_in || 21600)) * 1000,
  };
  await writeTokenSession(next);
  return next.access_token;
}


function factualText(item, attributes) {
  const facts = attributes.slice(0, 6);
  const base = item.title + ". " + facts.join("; ") + ".";
  return (base + " Informações consultadas no anúncio oficial do Mercado Livre. Confira preço, estoque, frete e prazo no momento da compra.").slice(0, 480);
}


function pageDetails(html) {
  const products = [];
  for (const match of String(html || "").matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decode(match[1]));
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const value = queue.shift();
        if (!value || typeof value !== "object") continue;
        if (Array.isArray(value)) { queue.push(...value); continue; }
        const type = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
        if (type.some(item => String(item).toLowerCase() === "product")) products.push(value);
        if (Array.isArray(value["@graph"])) queue.push(...value["@graph"]);
      }
    } catch {}
  }
  const product = products.find(item => item?.offers && item?.name) || products[0];
  if (!product) return null;
  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers || {};
  const imageValue = Array.isArray(product.image) ? product.image[0] : product.image;
  const descriptionFacts = String(product.description || "").split(/\s*\|\s*|\n+/).map(plain).filter(Boolean);
  const extraFacts = [
    product.brand ? "Marca: " + (product.brand.name || product.brand) : "",
    product.color ? "Cor: " + product.color : "",
    product.weight ? "Peso informado: " + (product.weight.value || product.weight) : "",
    product.sku ? "Código do catálogo: " + product.sku : "",
    product.itemCondition ? "Condição informada: novo" : "",
  ].filter(Boolean);
  const attributes = [...new Set([...descriptionFacts, ...extraFacts])].slice(0, 10);
  const currentPrice = Number(offer.price || offer.lowPrice || 0);
  const originalMatch = String(html || "").match(/"original_price"\s*:\s*(\d+(?:\.\d+)?)/i);
  const originalPrice = Number(originalMatch?.[1] || 0);
  const title = String(product.name || "").trim();
  if (!title || !currentPrice || !/^https:\/\//i.test(String(imageValue || ""))) return null;
  return {
    titulo: title,
    foto: String(imageValue).replace(/^http:/, "https:"),
    precoAtual: currentPrice,
    precoAnterior: originalPrice > currentPrice ? originalPrice : 0,
    dadosTecnicos: attributes,
    comentario: (title + ". " + attributes.slice(0, 6).join("; ") + ". Informações extraídas dos dados públicos do anúncio. Confira preço, estoque, frete e prazo no momento da compra.").slice(0, 480),
    pros: ("Características reais do anúncio: " + attributes.slice(0, 4).join("; ") + ".").slice(0, 290),
    contras: "Confirme voltagem, medidas, variações, compatibilidade, frete, prazo e estoque diretamente no anúncio antes de comprar.",
    urlProduto: String(offer.url || ""),
  };
}


async function officialDetails(itemId, html = "") {
  const page = pageDetails(html);
  if (page?.titulo && page?.foto && page?.precoAtual) return page;
  const token = await accessToken();
  if (!token || !itemId) return null;
  const response = await fetch("https://api.mercadolibre.com/items/" + itemId, {
    headers: { authorization: "Bearer " + token },
  });
  if (!response.ok) return null;
  const item = await response.json();
  const attributes = (item.attributes || [])
    .map((attribute) => {
      const value = attribute.value_name || attribute.value_struct?.number || attribute.values?.[0]?.name || "";
      return value ? attribute.name + ": " + value : "";
    })
    .filter(Boolean);
  if (item.condition) attributes.push("Condição informada: " + item.condition);
  if (item.category_id) attributes.push("Categoria Mercado Livre: " + item.category_id);
  if (Number.isFinite(Number(item.available_quantity))) attributes.push("Estoque informado no anúncio: " + item.available_quantity);
  const unique = [...new Set(attributes)].slice(0, 10);
  const title = String(item.title || "").trim();
  const currentPrice = Number(item.price || 0);
  const originalPrice = Number(item.original_price || 0);
  return {
    titulo: title,
    foto: String(item.pictures?.[0]?.secure_url || item.thumbnail || "").replace(/^http:/, "https:"),
    precoAtual: currentPrice,
    precoAnterior: originalPrice > currentPrice ? originalPrice : 0,
    dadosTecnicos: unique,
    comentario: factualText(item, unique),
    pros: ("Características reais do anúncio: " + unique.slice(0, 4).join("; ") + ".").slice(0, 290),
    contras: "Confirme voltagem, medidas, variações, compatibilidade, frete, prazo e estoque diretamente no anúncio antes de comprar.",
    urlProduto: item.permalink || "",
  };
}


async function requests() {
  const response = await fetch(`${FIRESTORE}/${COLLECTION}?pageSize=300`);
  if (!response.ok) throw new Error(`Fila Firebase: HTTP ${response.status}`);
  const payload = await response.json();
  return (payload.documents || []).map((document) => {
    const data = { id: document.name.split("/").pop() };
    for (const [key, value] of Object.entries(document.fields || {})) data[key] = field(value);
    return data;
  }).filter((item) => item.status === "pendente" && item.link);
}




async function dumpViaMirror(url) {
  try {
    const mirror = new URL(url);
    const host = mirror.hostname.toLowerCase();
    if (!host.endsWith("mercadolivre.com.br")) return "";
    mirror.hostname = host.replace(/\./g, "-") + ".translate.goog";
    mirror.searchParams.set("_x_tr_sl", "pt");
    mirror.searchParams.set("_x_tr_tl", "en");
    mirror.searchParams.set("_x_tr_hl", "pt-BR");
    const response = await fetch(mirror.href, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
        "accept-language": "pt-BR,pt;q=0.9",
      },
    });
    if (!response.ok) return "";
    const html = await response.text();
    if (html && html.length > 10000 && pageDetails(html)) return html;
  } catch (error) {
    console.warn("Espelho público indisponível:", error?.message || error);
  }
  return "";
}

async function dumpWithPlaywright(url) {
  let launched;
  try {
    const { chromium } = await import("playwright-core");
    launched = await chromium.launch({
      headless: false,
      executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
    });
    const context = await launched.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 1200 },
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(15000);
    const html = await page.content();
    await launched.close();
    launched = null;
    if (html && html.length > 1000) return html;
  } catch (error) {
    console.warn("Navegador completo indisponível:", error?.message || error);
  } finally {
    if (launched) await launched.close().catch(() => {});
  }
  return "";
}

async function dump(url) {
  const mirrored = await dumpViaMirror(url);
  if (mirrored) return mirrored;
  const rendered = await dumpWithPlaywright(url);
  if (rendered) return rendered;
  const executables = [process.env.CHROME_PATH, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);
  let lastError;
  for (const executable of executables) {
    try {
      const { stdout } = await execFileAsync(executable, [
        "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "--window-size=1440,1200", "--lang=pt-BR", "--dump-dom", "--virtual-time-budget=30000", url
      ], { timeout: 50000, maxBuffer: 18 * 1024 * 1024 });
      if (stdout && stdout.length > 1000) return stdout;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`O navegador não conseguiu abrir o link. ${lastError?.message || ""}`.trim());
}


function candidates(html) {
  const list = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = decode(match[1]);
    const body = match[2];
    const itemFilter = url.match(/(?:item_id(?::|%3A|=|%3D)|itemId=)(MLB\d{6,})/i)?.[1];
    const pathItem = url.match(/(?:\/|\b)(MLB-?\d{6,})(?:-|\/|\?|\b)/i)?.[1]?.replace("-", "");
    const catalog = url.match(/\/p\/(MLB\d{6,})/i)?.[1];
    const mlb = (itemFilter || pathItem || catalog || "").toUpperCase();
    if (!mlb) continue;
    const title = plain(body) || plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    list.push({ mlb, urlProduto: new URL(url, "https://www.mercadolivre.com.br/").href, titulo: title });
  }
  return list;
}


function fallback(html, link) {
  const item = html.match(/(?:item_id["'=:%\s]+|"id"\s*:\s*")(MLB\d{6,})/i)?.[1];
  const catalog = html.match(/\/p\/(MLB\d{6,})/i)?.[1];
  const mlb = (item || catalog || "").toUpperCase();
  if (!mlb) return null;
  return {
    mlb,
    urlProduto: link,
    titulo: plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || "Produto do Mercado Livre"
  };
}


async function resolveRequest(request) {
  let html = "";
  try { html = await dump(request.link); } catch {}
  // Links de produto podem conter o código do catálogo e o código do anúncio.
  // Preço, foto e estoque pertencem ao anúncio (item_id/wid), então ele tem prioridade.
  const saleId = request.link.match(/(?:item_id(?:%3A|:)|[?&#]wid=)(MLB-?\d{6,})/i)?.[1]?.replace("-", "").toUpperCase();
  const directId = request.link.match(/(?:\/|\b)(MLB-?\d{6,})(?:-|\/|\?|#|\b)/i)?.[1]?.replace("-", "").toUpperCase();
  const htmlFound = candidates(html)[0] || fallback(html, request.link);
  const found = saleId
    ? { ...(htmlFound || {}), mlb: saleId, urlProduto: request.link, titulo: htmlFound?.titulo || "" }
    : htmlFound || (directId ? { mlb: directId, urlProduto: request.link, titulo: "" } : null);
  if (!found) throw new Error("O Mercado Livre não mostrou um anúncio identificável nesse link.");
  const details = await officialDetails(found.mlb, html);
  if (!details?.titulo || !details?.foto || !details?.precoAtual) {
    throw new Error("O anúncio foi localizado, mas os dados oficiais ainda não ficaram disponíveis.");
  }
  return {
    status: "ok",
    ...found,
    ...details,
    urlProduto: details.urlProduto || found.urlProduto,
    linkOriginal: request.link,
    resolvidoEm: new Date().toISOString(),
  };
}


let payload = { atualizadoEm: "", resultados: {} };
try { payload = JSON.parse(await readFile(OUTPUT, "utf8")); } catch {}
payload.resultados ||= {};


const queue = (await requests())
  .filter((request) => !payload.resultados[request.id])
  .sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)))
  .slice(0, 10);


for (const request of queue) {
  try {
    payload.resultados[request.id] = await resolveRequest(request);
    console.log(`${request.id}: ${payload.resultados[request.id].mlb}`);
  } catch (error) {
    payload.resultados[request.id] = {
      status: "erro",
      motivo: String(error?.message || error),
      linkOriginal: request.link,
      resolvidoEm: new Date().toISOString()
    };
    console.warn(`${request.id}: ${payload.resultados[request.id].motivo}`);
  }
}


const entries = Object.entries(payload.resultados).sort((a, b) => String(b[1].resolvidoEm).localeCompare(String(a[1].resolvidoEm))).slice(0, 300);
payload.resultados = Object.fromEntries(entries);
payload.atualizadoEm = new Date().toISOString();
await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);



