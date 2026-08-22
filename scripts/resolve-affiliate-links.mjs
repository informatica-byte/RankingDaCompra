import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);
const PROJECT_ID = "rankingdacompra";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const COLLECTION = "mlbSolicitacoes";
const OUTPUT = "mlb-resolucoes.json";

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

async function dump(url) {
  const executables = [process.env.CHROME_PATH, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);
  let lastError;
  for (const executable of executables) {
    try {
      const { stdout } = await execFileAsync(executable, [
        "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--user-agent=Mozilla/5.0 (Linux; Android 13; SM-A525M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
        "--dump-dom", "--virtual-time-budget=18000", url
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
  const html = await dump(request.link);
  const found = candidates(html)[0] || fallback(html, request.link);
  if (!found) throw new Error("O Mercado Livre não mostrou um anúncio identificável nesse link.");
  return { status: "ok", ...found, linkOriginal: request.link, resolvidoEm: new Date().toISOString() };
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
console.log(`Fila processada: ${queue.length} pedido(s).`);
