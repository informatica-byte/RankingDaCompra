import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://rankingdacompra.com.br/";
const errors = [];

function fail(message) { errors.push(message); }
function has(html, pattern, label, file) { if (!pattern.test(html)) fail(file + ": " + label); }
function productIdentity(html) {
  const mlb = html.match(/\bMLB[-_\s]?(\d{6,})\b/i);
  if (mlb) return "mlb:" + mlb[1];
  const affiliate = html.match(/https:\/\/meli\.la\/[A-Za-z0-9_-]+/i);
  return affiliate ? "affiliate:" + affiliate[0].toLowerCase() : "";
}

const sitemap = await readFile(resolve("sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
const uniqueUrls = new Set(urls);
if (!urls.length) fail("sitemap.xml: nenhum endereço encontrado");
if (uniqueUrls.size !== urls.length) fail("sitemap.xml: existem endereços duplicados");

const identities = new Map();
for (const url of urls) {
  if (!url.startsWith(SITE)) { fail("Domínio inesperado no sitemap: " + url); continue; }
  if (!url.startsWith(SITE + "produto/")) continue;
  const relative = decodeURIComponent(url.slice(SITE.length));
  let html = "";
  try { html = await readFile(resolve(relative), "utf8"); }
  catch { fail(relative + ": arquivo informado no sitemap não existe"); continue; }

  has(html, /<title>[^<]{10,}<\/title>/i, "título ausente ou curto", relative);
  has(html, /<meta\s+name="description"\s+content="[^"]{50,}"/i, "descrição ausente ou curta", relative);
  has(html, /<meta\s+property="og:image"\s+content="https:\/\/rankingdacompra\.com\.br\/produto\/imagens\/[^"]+"/i, "imagem social local ausente", relative);
  has(html, /"@type":"Product"/i, "dados estruturados de produto ausentes", relative);
  if (!html.includes('rel="canonical" href="' + url + '"')) fail(relative + ": endereço canônico divergente");
  if (/name="robots"\s+content="[^"]*noindex/i.test(html)) fail(relative + ": página do sitemap marcada como noindex");
  if (html.includes("\uFFFD")) fail(relative + ": caractere corrompido encontrado");

  const identity = productIdentity(html);
  if (!identity) continue;
  const previous = identities.get(identity);
  if (previous) fail("Produto duplicado (" + identity + "): " + previous + " e " + relative);
  else identities.set(identity, relative);
}

for (const file of ["como-avaliamos.html", "sobre.html", "politica-afiliados.html", "privacidade.html", "contato.html"]) {
  const html = await readFile(resolve(file), "utf8");
  has(html, /property="og:image"\s+content="https:\/\/rankingdacompra\.com\.br\/og-ranking-da-compra\.png"/i, "imagem social ausente", file);
  has(html, /name="twitter:card"\s+content="summary_large_image"/i, "cartão social do Twitter ausente", file);
}

if (errors.length) {
  console.error("\nValidação bloqueou a publicação:");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}

console.log("Validação concluída: " + urls.length + " URLs, " + identities.size + " produtos únicos e metadados sociais completos.");
