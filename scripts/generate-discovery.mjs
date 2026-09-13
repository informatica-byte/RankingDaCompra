import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { correctProductData } from "./product-title-corrections.mjs";

const PROJECT_ID = "rankingdacompra";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE = "https://rankingdacompra.com.br/";
const SHARE_VERSION = "20260810-1";
const GROWTH_TOOLS_VERSION = "20260913-patinete1";
const MOBILE_PRODUCT_STYLE = '<style data-mobile-product-buy>.mobile-buy{display:none}@media(max-width:700px){body{padding-bottom:72px}.top>div{display:flex;flex-direction:column;order:-1}.top>div>.eyebrow{order:1}.top>div>h1{order:2}.top>div>.full-title{order:3}.top>div>.rating{order:4}.top>div>.offer{order:5;margin:8px 0 14px}.top>div>.summary{order:6}.top>div>.facts{order:7}.photo{order:2}.mobile-buy{position:fixed;z-index:1000;left:10px;right:10px;bottom:10px;display:flex;align-items:center;justify-content:center;min-height:52px;padding:12px 15px;border-radius:11px;background:#1769e0;color:#fff;text-decoration:none;font-weight:950;box-shadow:0 10px 30px rgba(0,0,0,.25)}}</style>';
const GENERIC_TEXT = /(chama aten[cç][aã]o por|recursos descritos no pr[oó]prio t[ií]tulo|informa[cç][oõ]es em atualiza[cç][aã]o|produto identificado no an[uú]ncio|oferta para comparar|conhe[cç]a este produto)/i;
const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function fieldValue(field) {
  if (!field) return "";
  return field.stringValue ?? field.integerValue ?? field.doubleValue
    ?? field.booleanValue ?? field.timestampValue ?? "";
}

async function fetchFirestore(url, collection, maxAttempts = 6) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return response;
    const retryable = RETRYABLE_HTTP_STATUS.has(response.status);
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`${collection}: HTTP ${response.status}`);
    }
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const exponentialDelay = Math.min(1000 * (2 ** (attempt - 1)), 30000);
    const retryDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000 : exponentialDelay;
    await wait(retryDelay);
  }
  throw new Error(`${collection}: não foi possível consultar o Firebase`);
}

async function listCollection(collection) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await fetchFirestore(`${FIRESTORE}/${collection}?${query}`, collection, 2);
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

async function marketplaceStatus() {
  try {
    const payload = JSON.parse(await readFile(resolve("mercadolivre-status.json"), "utf8"));
    return payload?.products && typeof payload.products === "object" ? payload.products : {};
  } catch {
    return {};
  }
}

async function loadData() {
  const fixture = String(process.env.DISCOVERY_FIXTURE || "").trim();
  if (fixture) {
    const payload = JSON.parse(await readFile(resolve(fixture), "utf8"));
    return [payload.categories || [], payload.products || [], payload.marketplaceProducts || {}];
  }
  // O gerador principal acabou de consultar o Firebase e criar as páginas.
  // Reutilizá-las evita reler centenas de documentos na mesma execução.
  if (process.env.DISCOVERY_USE_GENERATED === "true") return loadGeneratedPages();
  try {
    return await Promise.all([listCollection("categorias"), listCollection("produtos"), marketplaceStatus()]);
  } catch (error) {
    console.warn(`Firebase temporariamente indisponível na descoberta interna: ${error.message}`);
    const fallback = await loadGeneratedPages();
    if (fallback[1].length) {
      console.warn(`Usando ${fallback[1].length} páginas de produto já publicadas como contingência.`);
      return fallback;
    }
    throw error;
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function textFromHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function attribute(html, elementPattern, name) {
  const element = String(html || "").match(elementPattern)?.[0] || "";
  return decodeHtml(element.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1] || "");
}

function structuredProduct(html) {
  for (const match of String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const payload = JSON.parse(match[1]);
      const nodes = Array.isArray(payload) ? payload : Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [payload];
      const product = nodes.find((node) => node?.["@type"] === "Product"
        || (Array.isArray(node?.["@type"]) && node["@type"].includes("Product")));
      if (product) return product;
    } catch {
      // Um bloco inválido não impede a leitura dos demais dados públicos da página.
    }
  }
  return {};
}

function firstUrl(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return /^https:\/\//i.test(String(candidate || "")) ? String(candidate) : "";
}

async function loadGeneratedPages() {
  const categories = new Map();
  const products = [];
  let entries = [];
  try {
    entries = await readdir(resolve("produto"), { withFileTypes: true });
  } catch {
    return [[], [], {}];
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    let html;
    try {
      html = await readFile(resolve("produto", entry.name), "utf8");
    } catch {
      continue;
    }
    const robots = attribute(html, /<meta[^>]+name=["']robots["'][^>]*>/i, "content");
    if (/\bnoindex\b/i.test(robots)) continue;
    const schema = structuredProduct(html);
    const title = textFromHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || String(schema.name || "").trim();
    const summary = textFromHtml(html.match(/<p[^>]+class=["'][^"']*summary[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]) || String(schema.description || "").trim();
    if (!title || summary.length < 180 || GENERIC_TEXT.test(summary)) continue;
    const categoryName = textFromHtml(html.match(/<div[^>]+class=["'][^"']*fact[^"']*["'][^>]*>\s*<span[^>]*>Categoria<\/span>([\s\S]*?)<\/div>/i)?.[1]) || String(schema.category || "Produtos").trim();
    const categoryId = slug(categoryName);
    const canonical = attribute(html, /<link[^>]+rel=["']canonical["'][^>]*>/i, "href")
      || `${SITE}produto/${encodeURIComponent(entry.name)}`;
    const offer = Array.isArray(schema.offers) ? schema.offers[0] : schema.offers || {};
    const review = Array.isArray(schema.review) ? schema.review[0] : schema.review || {};
    const noteNames = (list) => (list?.itemListElement || [])
      .map((item) => String(item?.name || "").trim()).filter(Boolean);
    const rating = Number(schema.aggregateRating?.ratingValue || review.reviewRating?.ratingValue || 0);
    const image = firstUrl(schema.image)
      || attribute(html, /<meta[^>]+property=["']og:image["'][^>]*>/i, "content");
    const ranking = Number(textFromHtml(html).match(/#(\d+)\s+no ranking/i)?.[1] || 0);
    const suffix = `-${SHARE_VERSION}.html`;
    const productId = entry.name.endsWith(suffix) ? entry.name.slice(0, -suffix.length) : entry.name.replace(/\.html$/i, "");
    categories.set(categoryId, { id: categoryId, nome: categoryName });
    products.push({
      id: productId,
      titulo: title,
      categoria: categoryId,
      comentario: summary,
      foto: image,
      preco: numberPrice(offer.price),
      nota: Number.isFinite(rating) ? rating : 0,
      pros: noteNames(review.positiveNotes).join("; "),
      contras: noteNames(review.negativeNotes).join("; "),
      ranking,
      atualizadoEm: new Date().toISOString(),
      __productUrl: canonical,
    });
  }
  return [[...categories.values()], products, {}];
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
  return values.map(dateOnly).filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);
}

function slug(value) {
  return String(value || "produtos")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "produtos";
}

function numberPrice(value) {
  let text = String(value || "").replace(/R\$/gi, "").replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!text) return 0;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function promotionIsValid(product) {
  const previous = numberPrice(product.precoAnterior);
  const promotional = numberPrice(product.precoPromocional);
  const end = product.promocaoValidaAte
    ? new Date(`${String(product.promocaoValidaAte).slice(0, 10)}T23:59:59-03:00`) : null;
  return product.promocaoAtiva === true && previous > promotional && promotional > 0
    && (!end || (!Number.isNaN(end.getTime()) && end.getTime() >= Date.now()));
}

function sortProducts(a, b) {
  const promotionDifference = Number(promotionIsValid(b)) - Number(promotionIsValid(a));
  if (promotionDifference) return promotionDifference;
  const rating = (trustedRating(b.nota) - trustedRating(a.nota));
  return rating || numberPrice(a.precoPromocional || a.preco) - numberPrice(b.precoPromocional || b.preco)
    || String(a.titulo || "").localeCompare(String(b.titulo || ""), "pt-BR");
}

function trustedRating(value) {
  const rating = Number(value);
  return Number.isFinite(rating) && rating >= 3 && rating <= 5 ? rating : 0;
}

function editorialItems(value) {
  return String(value || "").split(/\s*;\s*|\n+/).map((item) => item.trim()).filter(Boolean);
}

function productEvidence(product) {
  return [product.titulo, product.comentario, product.pros, product.contras, product.dadosTecnicos]
    .filter(Boolean).join(". ").replace(/\s+/g, " ");
}

function firstNumber(text, expressions) {
  for (const expression of expressions) {
    const match = text.match(expression);
    if (match) return Number(String(match[1]).replace(",", ".")) || 0;
  }
  return 0;
}

function scooterSpecs(product) {
  const text = productEvidence(product);
  const rangePair = text.match(/(\d{1,3})\s*(?:a|-|–)\s*(\d{1,3})\s*km/i);
  const suspensionMentioned = /suspens[aã]o|amortecedor/i.test(text);
  const suspensionDenied = /n[aã]o (?:possui|tem|inclui) suspens[aã]o|sem suspens[aã]o/i.test(text);
  return {
    power: firstNumber(text, [/(?:pot[eê]ncia|motor)[^\d]{0,22}(\d{3,4})\s*w/i, /(\d{3,4})\s*w\b/i]),
    range: rangePair ? Math.max(Number(rangePair[1]), Number(rangePair[2])) : firstNumber(text, [/autonomia[^\d]{0,24}(\d{1,3})\s*km/i, /alcance[^\d]{0,24}(\d{1,3})\s*km/i]),
    weight: firstNumber(text, [/(?:pesa|peso do produto)[^\d]{0,18}(\d{1,2}(?:[.,]\d+)?)\s*kg/i]),
    load: firstNumber(text, [/(?:suporta|carga m[aá]xima|peso m[aá]ximo)[^\d]{0,20}(\d{2,3})\s*kg/i]),
    suspension: suspensionMentioned && !suspensionDenied,
    solidTires: /pneu(?:s)?\s+s[oó]lido/i.test(text),
  };
}

function scooterScore(product) {
  const specs = scooterSpecs(product);
  const evidenceCount = [specs.power, specs.range, specs.weight, specs.load].filter(Boolean).length;
  return Math.min(specs.power / 25, 24) + Math.min(specs.range, 40) * 0.7
    + (specs.suspension ? 7 : 0) + trustedRating(product.nota) * 6 + evidenceCount * 3;
}

function money(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numberPrice(value));
}

function scooterReason(product, position, averagePrice) {
  const specs = scooterSpecs(product);
  const price = numberPrice(product.precoPromocional || product.preco);
  const facts = [];
  if (specs.power) facts.push(`${specs.power} W informados`);
  if (specs.range) facts.push(`autonomia anunciada de ${specs.range} km`);
  if (specs.suspension) facts.push("suspensão informada");
  if (specs.weight) facts.push(`${String(specs.weight).replace(".", ",")} kg`);
  const priceContext = price <= averagePrice ? "preço abaixo da média desta seleção" : "preço acima da média desta seleção";
  const lead = position === 1 ? "Lidera pelo conjunto mais forte de especificações publicadas"
    : position === 2 ? "Fica em segundo pelo equilíbrio entre recursos publicados e preço"
      : position === 3 ? "Ocupa o terceiro lugar por entregar uma proposta intermediária"
        : position === 4 ? "Fica em quarto porque perde pontos no conjunto de informações comparáveis"
          : "Fecha a lista porque a ficha pública oferece menos vantagens mensuráveis nesta comparação";
  return `${lead}: ${facts.slice(0, 3).join(", ") || "ficha técnica identificada"} e ${priceContext}.`;
}

function renderScooterGuide(products, productUrls, lastModified) {
  const candidates = products.filter((product) => slug(product.categoria).includes("patinete"));
  if (candidates.length < 3) return "";
  const averagePrice = candidates.reduce((sum, product) => sum + numberPrice(product.precoPromocional || product.preco), 0) / candidates.length;
  const ranked = [...candidates].sort((a, b) => scooterScore(b) - scooterScore(a)
    || numberPrice(a.precoPromocional || a.preco) - numberPrice(b.precoPromocional || b.preco));
  const winner = ranked[0];
  const cheapest = [...ranked].sort((a, b) => numberPrice(a.precoPromocional || a.preco) - numberPrice(b.precoPromocional || b.preco))[0];
  const value = [...ranked].filter((product) => product.id !== winner.id && product.id !== cheapest.id)
    .sort((a, b) => numberPrice(a.precoPromocional || a.preco) - numberPrice(b.precoPromocional || b.preco)
      || scooterScore(b) - scooterScore(a))[0] || ranked[1];
  const quick = [
    ["🏆 Melhor geral", winner, "Conjunto técnico mais completo da seleção"],
    ["💚 Melhor custo-benefício", value, "Boa relação entre recursos e preço informado"],
    ["💰 Mais barato", cheapest, "Menor preço informado entre os comparados"],
  ].map(([label, product, note]) => `<article><span>${label}</span><strong>${escapeHtml(product.titulo)}</strong><b>${escapeHtml(money(product.precoPromocional || product.preco))}</b><small>${note}</small><a href="${escapeHtml(productUrls.get(product.id))}">Ver análise e preço</a></article>`).join("");
  const rows = ranked.map((product, index) => {
    const specs = scooterSpecs(product);
    return `<tr><th scope="row">${index + 1}º ${escapeHtml(product.titulo)}</th><td>${specs.power ? `${specs.power} W` : "Não informado"}</td><td>${specs.range ? `${specs.range} km` : "Não informada"}</td><td>${specs.weight ? `${String(specs.weight).replace(".", ",")} kg` : "Não informado"}</td><td>${escapeHtml(money(product.precoPromocional || product.preco))}</td></tr>`;
  }).join("");
  const cards = ranked.map((product, index) => {
    const specs = scooterSpecs(product);
    const pros = editorialItems(product.pros).slice(0, 3);
    const cons = editorialItems(product.contras).slice(0, 2);
    const intended = specs.weight && specs.weight <= 13 ? "Quem precisa dobrar e transportar o patinete com frequência." : specs.range >= 30 ? "Quem prioriza autonomia anunciada para trajetos mais longos." : "Quem busca deslocamentos urbanos e quer comparar preço e ficha técnica.";
    const avoidSource = cons[0] || (specs.solidTires ? "Quem prioriza maior conforto em pisos muito irregulares." : "Quem precisa de uma especificação não confirmada no anúncio.");
    const avoid = avoidSource.length > 190 ? `${avoidSource.slice(0, 187).replace(/\s+\S*$/, "")}…` : avoidSource;
    return `<article class="rank-card"><div class="rank-number">${index + 1}º lugar</div><img src="${escapeHtml(firstUrl(product.foto))}" alt="${escapeHtml(product.titulo)}" loading="lazy" width="260" height="210"><div><h2>${escapeHtml(product.titulo)}</h2><p class="why"><b>Por que está nesta posição:</b> ${escapeHtml(scooterReason(product, index + 1, averagePrice))}</p><div class="tags">${specs.power ? `<span>${specs.power} W</span>` : ""}${specs.range ? `<span>${specs.range} km anunciados</span>` : ""}${specs.suspension ? "<span>Com suspensão</span>" : ""}${trustedRating(product.nota) ? `<span>Nota editorial ${trustedRating(product.nota).toFixed(1)}/5</span>` : ""}</div><p><b>Indicado para:</b> ${escapeHtml(intended)}</p><p><b>Não é a melhor escolha para:</b> ${escapeHtml(avoid)}</p>${pros.length ? `<details><summary>Ver pontos positivos e cuidados</summary><ul>${pros.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}${cons.map((item) => `<li><b>Atenção:</b> ${escapeHtml(item)}</li>`).join("")}</ul></details>` : ""}<div class="card-foot"><strong>${escapeHtml(money(product.precoPromocional || product.preco))}</strong><a href="${escapeHtml(productUrls.get(product.id))}">Ver análise e preço atual</a></div></div></article>`;
  }).join("");
  const itemList = ranked.map((product, index) => ({ "@type": "ListItem", position: index + 1, url: productUrls.get(product.id), name: product.titulo }));
  const structuredData = JSON.stringify({ "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": `${SITE}#organization`, name: "Ranking da Compra", url: SITE },
    { "@type": "CollectionPage", "@id": `${SITE}melhores-patinetes-eletricos.html#page`, name: "Melhores patinetes elétricos de 2026", url: `${SITE}melhores-patinetes-eletricos.html`, dateModified: lastModified, mainEntity: { "@type": "ItemList", itemListElement: itemList } },
  ] }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow,max-image-preview:large"><title>Melhores patinetes elétricos de 2026: ${ranked.length} opções comparadas</title><meta name="description" content="Compare os melhores patinetes elétricos de 2026 por preço, potência, autonomia anunciada, peso, pontos positivos e limitações."><link rel="canonical" href="${SITE}melhores-patinetes-eletricos.html"><meta property="og:type" content="article"><meta property="og:title" content="Melhores patinetes elétricos de 2026"><meta property="og:description" content="Comparação objetiva de ${ranked.length} patinetes elétricos com vencedor, custo-benefício e opção mais barata."><meta property="og:url" content="${SITE}melhores-patinetes-eletricos.html"><meta property="og:image" content="${escapeHtml(firstUrl(winner.foto))}"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0f3d2e"><script type="application/ld+json">${structuredData}</script><style>:root{--green:#116149;--ink:#11221d;--muted:#607068;--line:#dfe7e2;--cream:#fbfaf5;--gold:#b17800}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.55}a{color:var(--green)}.wrap{width:min(1120px,calc(100% - 28px));margin:auto}header{background:#fff;border-bottom:1px solid var(--line)}header .wrap{min-height:66px;display:flex;align-items:center;justify-content:space-between}.brand{font-weight:950;text-decoration:none}.hero{padding:42px 0 24px}.eyebrow{color:var(--green);font-size:.73rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase}h1{max-width:850px;margin:8px 0 12px;font-size:clamp(2rem,5vw,3.7rem);line-height:1.04;letter-spacing:-.05em}.hero>p{max-width:820px;color:var(--muted)}.disclosure{padding:11px 13px;border-left:4px solid var(--green);background:#edf7f1;border-radius:8px;font-size:.84rem}.quick{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.quick article{display:flex;flex-direction:column;gap:7px;padding:18px;background:#fff;border:1px solid var(--line);border-radius:14px}.quick span{font-weight:950;color:var(--green)}.quick b{font-size:1.15rem}.quick small{color:var(--muted)}.quick a,.card-foot a{margin-top:auto;padding:10px 12px;border-radius:8px;background:var(--green);color:#fff;text-align:center;text-decoration:none;font-weight:900}.table-wrap{overflow:auto;margin:30px 0;background:#fff;border:1px solid var(--line);border-radius:14px}table{width:100%;border-collapse:collapse;min-width:760px}caption{padding:16px;text-align:left;font-weight:950}th,td{padding:12px;border-top:1px solid var(--line);text-align:left;font-size:.85rem}th{max-width:310px}.rank-card{position:relative;display:grid;grid-template-columns:240px 1fr;gap:24px;margin:18px 0;padding:23px;background:#fff;border:1px solid var(--line);border-radius:18px}.rank-card:first-of-type{border:2px solid #e0ad30;background:#fffdf5}.rank-card img{width:100%;height:220px;object-fit:contain;background:#fafcfb;border-radius:12px}.rank-number{position:absolute;top:12px;left:12px;padding:6px 9px;border-radius:999px;background:var(--green);color:#fff;font-size:.75rem;font-weight:950}.rank-card h2{margin:0 0 9px;line-height:1.2}.why{padding:12px;background:#f1f7f3;border-radius:10px}.tags{display:flex;gap:7px;flex-wrap:wrap}.tags span{padding:5px 8px;border-radius:999px;background:#eef5f0;font-size:.73rem;font-weight:850}details{margin:12px 0}summary{color:var(--green);font-weight:900;cursor:pointer}.card-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:15px}.card-foot strong{color:#087a3d;font-size:1.25rem}.method{margin:36px 0;padding:20px;background:#fff;border:1px solid var(--line);border-radius:14px}.method h2{margin-top:0}footer{margin-top:42px;padding:28px 0;background:#10231c;color:#dfeae4;font-size:.82rem}footer a{color:#fff}@media(max-width:720px){header .wrap{gap:12px;font-size:.82rem}.hero{padding-top:27px}.quick{grid-template-columns:1fr}.rank-card{grid-template-columns:1fr;padding:18px}.rank-card img{height:210px}.rank-card>div:nth-child(3){display:flex;flex-direction:column}.rank-card h2{order:-1;padding-right:58px}.card-foot{align-items:stretch;flex-direction:column}.card-foot a{min-height:48px;display:grid;place-items:center}}</style></head><body><header><div class="wrap"><a class="brand" href="${SITE}">Ranking da Compra</a><a href="${SITE}analises.html#patinete-eletrico">Todas as análises</a></div></header><main class="wrap"><section class="hero"><span class="eyebrow">Guia de compra atualizado em 2026</span><h1>Melhores patinetes elétricos: ${ranked.length} opções comparadas</h1><p>Comparamos preço informado, potência, autonomia anunciada, peso, recursos e limitações para mostrar rapidamente qual opção faz mais sentido para cada necessidade.</p><p class="disclosure"><b>Transparência:</b> esta análise cruza as informações públicas dos anúncios e o histórico cadastrado no Ranking da Compra. A equipe não afirma ter realizado teste prático. Confirme especificações, preço, estoque e garantia com o vendedor.</p></section><section class="quick" aria-label="Destaques rápidos">${quick}</section><div class="table-wrap"><table><caption>Comparação rápida</caption><thead><tr><th>Produto</th><th>Potência</th><th>Autonomia anunciada</th><th>Peso</th><th>Preço informado</th></tr></thead><tbody>${rows}</tbody></table></div><section aria-label="Ranking detalhado">${cards}</section><section class="method"><h2>Como classificamos</h2><p>A ordem considera somente evidências que podem ser comparadas: potência, autonomia anunciada, peso, capacidade de carga, suspensão, quantidade de fatos técnicos cadastrados, avaliação editorial confiável e preço relativo à seleção. Uma nota inconsistente ou sem base suficiente não é exibida nem decide a posição.</p><p>O ranking ajuda a reduzir a lista, mas a escolha final depende do seu trajeto, inclinação das ruas, peso do usuário, necessidade de carregar o patinete e assistência técnica disponível.</p><a href="${SITE}como-avaliamos.html">Conheça a metodologia editorial completa →</a></section></main><footer><div class="wrap"><b>Ranking da Compra</b> — alguns links são de afiliados e podem gerar comissão sem custo adicional para você. <a href="${SITE}politica-afiliados.html">Política de afiliados</a>.</div></footer></body></html>\n`;
}

function guideFileName(categoryId) {
  if (slug(categoryId).includes("patinete")) return "melhores-patinetes-eletricos.html";
  return `melhores-${slug(categoryId)}.html`;
}

function categoryScore(product, minimumPrice, maximumPrice) {
  const price = numberPrice(product.precoPromocional || product.preco);
  const range = Math.max(maximumPrice - minimumPrice, 1);
  const priceScore = price ? ((maximumPrice - price) / range) * 35 : 0;
  const ratingScore = trustedRating(product.nota) ? (trustedRating(product.nota) / 5) * 30 : 0;
  const evidence = editorialItems(product.pros).length + editorialItems(product.contras).length;
  const evidenceScore = Math.min(evidence * 4, 20);
  const technicalFacts = (productEvidence(product).match(/\b\d+(?:[.,]\d+)?\s*(?:w|kw|v|mah|gb|tb|hz|l|ml|kg|cm|mm|km|mp)\b/gi) || []).length;
  return { total: priceScore + ratingScore + evidenceScore + Math.min(technicalFacts * 3, 15), priceScore, ratingScore, evidenceScore, technicalFacts };
}

function renderCategoryGuide(categoryId, categoryName, categoryProducts, productUrls, lastModified) {
  if (categoryProducts.length < 3) return "";
  if (slug(categoryId).includes("patinete")) return renderScooterGuide(categoryProducts, productUrls, lastModified);
  const prices = categoryProducts.map((product) => numberPrice(product.precoPromocional || product.preco)).filter(Boolean);
  const minimumPrice = Math.min(...prices);
  const maximumPrice = Math.max(...prices);
  const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const ranked = [...categoryProducts].sort((a, b) => categoryScore(b, minimumPrice, maximumPrice).total - categoryScore(a, minimumPrice, maximumPrice).total
    || numberPrice(a.precoPromocional || a.preco) - numberPrice(b.precoPromocional || b.preco));
  const winner = ranked[0];
  const cheapest = [...ranked].sort((a, b) => numberPrice(a.precoPromocional || a.preco) - numberPrice(b.precoPromocional || b.preco))[0];
  const value = ranked.find((product) => product.id !== winner.id && product.id !== cheapest.id) || ranked[1];
  const fileName = guideFileName(categoryId);
  const guideUrl = `${SITE}${fileName}`;
  const quick = [["🏆 Melhor geral", winner], ["💚 Melhor custo-benefício", value], ["💰 Mais barato", cheapest]].map(([label, product]) => `<article><span>${label}</span><strong>${escapeHtml(product.titulo)}</strong><b>${escapeHtml(money(product.precoPromocional || product.preco))}</b><a href="${escapeHtml(productUrls.get(product.id))}">Ver análise e preço</a></article>`).join("");
  const rows = ranked.map((product, index) => {
    const positive = editorialItems(product.pros)[0] || "Informação positiva em revisão";
    const attention = editorialItems(product.contras)[0] || "Confirme os detalhes no anúncio";
    return `<tr><th scope="row">${index + 1}º ${escapeHtml(product.titulo)}</th><td>${escapeHtml(money(product.precoPromocional || product.preco))}</td><td>${escapeHtml(positive)}</td><td>${escapeHtml(attention)}</td></tr>`;
  }).join("");
  const cards = ranked.map((product, index) => {
    const price = numberPrice(product.precoPromocional || product.preco);
    const score = categoryScore(product, minimumPrice, maximumPrice);
    const positives = editorialItems(product.pros).slice(0, 3);
    const attentions = editorialItems(product.contras).slice(0, 2);
    const relativePrice = price < averagePrice * 0.97 ? "abaixo" : price > averagePrice * 1.03 ? "acima" : "próximo";
    const why = `A posição resulta do preço ${relativePrice} da média da seleção, ${positives.length + attentions.length} evidências editoriais cadastradas${trustedRating(product.nota) ? ` e nota editorial de ${trustedRating(product.nota).toFixed(1)}/5` : " e ausência de nota confiável usada no cálculo"}. Pontuação comparativa: ${score.total.toFixed(1)} de 100.`;
    return `<article class="rank-card"><div class="rank-number">${index + 1}º lugar</div><img src="${escapeHtml(firstUrl(product.foto))}" alt="${escapeHtml(product.titulo)}" loading="lazy" width="260" height="210"><div><h2>${escapeHtml(product.titulo)}</h2><p class="why"><b>Por que está nesta posição:</b> ${escapeHtml(why)}</p><p><b>Indicado para:</b> ${escapeHtml(positives[0] || "Quem procura esta proposta e quer confirmar os detalhes diretamente no anúncio.")}</p><p><b>Não é a melhor escolha para:</b> ${escapeHtml(attentions[0] || "Quem depende de uma característica ainda não confirmada na ficha pública.")}</p><details><summary>Mais informações</summary><ul>${positives.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}${attentions.map((item) => `<li><b>Atenção:</b> ${escapeHtml(item)}</li>`).join("")}</ul></details><div class="card-foot"><strong>${escapeHtml(money(price))}</strong><a href="${escapeHtml(productUrls.get(product.id))}">Ver análise e preço atual</a></div></div></article>`;
  }).join("");
  const structuredData = JSON.stringify({ "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": `${SITE}#organization`, name: "Ranking da Compra", url: SITE },
    { "@type": "CollectionPage", "@id": `${guideUrl}#page`, name: `Melhores opções de ${categoryName} em 2026`, url: guideUrl, dateModified: lastModified, mainEntity: { "@type": "ItemList", itemListElement: ranked.map((product, index) => ({ "@type": "ListItem", position: index + 1, url: productUrls.get(product.id), name: product.titulo })) } },
  ] }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow,max-image-preview:large"><title>Melhores opções de ${escapeHtml(categoryName)} em 2026 | Ranking da Compra</title><meta name="description" content="Compare ${ranked.length} opções de ${escapeHtml(categoryName)} por preço, pontos positivos, limitações e evidências editoriais."><link rel="canonical" href="${guideUrl}"><meta property="og:type" content="article"><meta property="og:title" content="Melhores opções de ${escapeHtml(categoryName)} em 2026"><meta property="og:description" content="Comparação objetiva com melhor geral, custo-benefício e opção mais barata."><meta property="og:url" content="${guideUrl}"><meta property="og:image" content="${escapeHtml(firstUrl(winner.foto))}"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#0f3d2e"><script type="application/ld+json">${structuredData}</script><style>:root{--green:#116149;--ink:#11221d;--muted:#607068;--line:#dfe7e2;--cream:#fbfaf5}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.55}a{color:var(--green)}.wrap{width:min(1120px,calc(100% - 28px));margin:auto}header{background:#fff;border-bottom:1px solid var(--line)}header .wrap{min-height:66px;display:flex;align-items:center;justify-content:space-between}.brand{font-weight:950;text-decoration:none}.hero{padding:42px 0 24px}.eyebrow{color:var(--green);font-size:.73rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase}h1{max-width:880px;margin:8px 0 12px;font-size:clamp(2rem,5vw,3.6rem);line-height:1.04;letter-spacing:-.05em}.hero p{max-width:850px;color:var(--muted)}.disclosure{padding:11px 13px;border-left:4px solid var(--green);background:#edf7f1;border-radius:8px;font-size:.84rem}.quick{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.quick article{display:flex;flex-direction:column;gap:7px;padding:18px;background:#fff;border:1px solid var(--line);border-radius:14px}.quick span{font-weight:950;color:var(--green)}.quick b{font-size:1.15rem}.quick a,.card-foot a{margin-top:auto;padding:10px 12px;border-radius:8px;background:var(--green);color:#fff;text-align:center;text-decoration:none;font-weight:900}.table-wrap{overflow:auto;margin:30px 0;background:#fff;border:1px solid var(--line);border-radius:14px}table{width:100%;border-collapse:collapse;min-width:820px}caption{padding:16px;text-align:left;font-weight:950}th,td{padding:12px;border-top:1px solid var(--line);text-align:left;font-size:.84rem}.rank-card{position:relative;display:grid;grid-template-columns:230px 1fr;gap:24px;margin:18px 0;padding:23px;background:#fff;border:1px solid var(--line);border-radius:18px}.rank-card:first-of-type{border:2px solid #e0ad30;background:#fffdf5}.rank-card img{width:100%;height:215px;object-fit:contain;background:#fafcfb;border-radius:12px}.rank-number{position:absolute;top:12px;left:12px;padding:6px 9px;border-radius:999px;background:var(--green);color:#fff;font-size:.75rem;font-weight:950}.rank-card h2{margin:0 0 9px;line-height:1.2}.why{padding:12px;background:#f1f7f3;border-radius:10px}summary{color:var(--green);font-weight:900;cursor:pointer}.card-foot{display:flex;align-items:center;justify-content:space-between;gap:16px}.card-foot strong{color:#087a3d;font-size:1.25rem}.method{margin:36px 0;padding:20px;background:#fff;border:1px solid var(--line);border-radius:14px}footer{margin-top:42px;padding:28px 0;background:#10231c;color:#dfeae4;font-size:.82rem}footer a{color:#fff}@media(max-width:720px){header .wrap{gap:12px;font-size:.82rem}.hero{padding-top:27px}.quick{grid-template-columns:1fr}.rank-card{grid-template-columns:1fr;padding:18px}.rank-card img{height:205px}.rank-card h2{padding-right:58px}.card-foot{align-items:stretch;flex-direction:column}.card-foot a{min-height:48px;display:grid;place-items:center}}</style></head><body><header><div class="wrap"><a class="brand" href="${SITE}">Ranking da Compra</a><a href="${SITE}analises.html#${escapeHtml(slug(categoryId))}">Todas as análises</a></div></header><main class="wrap"><section class="hero"><span class="eyebrow">Guia de compra atualizado em 2026</span><h1>Melhores opções de ${escapeHtml(categoryName)}: ${ranked.length} produtos comparados</h1><p>Veja logo no início o melhor geral, o custo-benefício e a opção mais barata. Depois, confira por que cada produto ocupa sua posição.</p><p class="disclosure"><b>Transparência:</b> a classificação usa preço e informações públicas cadastradas. A equipe não afirma ter realizado teste prático. Confirme especificações, preço, estoque e garantia com o vendedor.</p></section><section class="quick" aria-label="Destaques rápidos">${quick}</section><div class="table-wrap"><table><caption>Comparação rápida</caption><thead><tr><th>Produto</th><th>Preço</th><th>Principal vantagem</th><th>Ponto de atenção</th></tr></thead><tbody>${rows}</tbody></table></div><section aria-label="Ranking detalhado">${cards}</section><section class="method"><h2>Como classificamos</h2><p>A pontuação de 0 a 100 considera custo-benefício (35%), avaliação editorial confiável (30%), qualidade dos pontos positivos e limitações cadastrados (20%) e presença de fatos técnicos mensuráveis (15%). Notas inconsistentes não são usadas.</p><a href="${SITE}como-avaliamos.html">Conheça a metodologia editorial completa →</a></section></main><footer><div class="wrap"><b>Ranking da Compra</b> — alguns links são de afiliados e podem gerar comissão sem custo adicional para você. <a href="${SITE}politica-afiliados.html">Política de afiliados</a>.</div></footer></body></html>\n`;
}

function extractSitemapLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
}

async function productUrlMap(products, sitemapXml) {
  const locations = extractSitemapLocations(sitemapXml).filter((location) => location.includes("/produto/"));
  let files = [];
  try {
    files = (await readdir(resolve("produto"), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
      .map((entry) => entry.name);
  } catch {
    files = [];
  }
  const fileSet = new Set(files);
  const locationSet = new Set(locations);
  const map = new Map();
  for (const product of products) {
    if (product.__productUrl) {
      try {
        const fileName = decodeURIComponent(basename(new URL(product.__productUrl).pathname));
        if (fileSet.has(fileName) && locationSet.has(product.__productUrl)) {
          map.set(product.id, product.__productUrl);
        }
      } catch {
        // Produto sem página publicada fica fora do diretório até a próxima geração.
      }
      continue;
    }
    const match = locations.find((location) => {
      try {
        const fileName = decodeURIComponent(basename(new URL(location).pathname));
        return fileSet.has(fileName)
          && (fileName === `${product.id}.html` || fileName.startsWith(`${product.id}-`));
      } catch {
        return false;
      }
    });
    if (match) {
      map.set(product.id, match);
      continue;
    }
    // Um arquivo fora do sitemap pode ser uma versão antiga ou duplicada.
    // Ele permanece preservado no repositório, mas não entra no catálogo público.
  }
  return map;
}

function renderDirectoryPage(categories, productsByCategory, productUrls, categoryNames, lastModified) {
  const groups = categories.map((category) => ({
    id: category.id,
    name: categoryNames.get(category.id) || category.id,
    products: [...(productsByCategory.get(category.id) || [])].sort(sortProducts),
  })).filter((group) => group.products.length);
  const itemList = groups.flatMap((group) => group.products).map((product, index) => ({
    "@type": "ListItem", position: index + 1, url: productUrls.get(product.id), name: product.titulo,
  }));
  const directoryTitle = "Análises de produtos, preços e ofertas | Ranking da Compra";
  const directoryDescription = `Compare ${itemList.length} análises de produtos por categoria, com preço informado, pontos positivos, limitações e links para conferir a oferta atual.`;
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${SITE}#organization`, name: "Ranking da Compra", url: SITE },
      { "@type": "CollectionPage", "@id": `${SITE}analises.html#page`, name: "Todas as análises de produtos", url: `${SITE}analises.html`, dateModified: lastModified, mainEntity: { "@type": "ItemList", itemListElement: itemList } },
    ],
  }).replace(/</g, "\\u003c");
  const navigation = groups.map((group) => `<a href="#${escapeHtml(slug(group.id))}">${escapeHtml(group.name)} <span>${group.products.length}</span></a>`).join("");
  const sections = groups.map((group) => `<section id="${escapeHtml(slug(group.id))}"><div class="section-head"><div><span class="eyebrow">Categoria</span><h2>${escapeHtml(group.name)}</h2>${group.products.length >= 3 ? `<a class="read" href="${SITE}${guideFileName(group.id)}">Ver o comparativo desta categoria →</a>` : ""}</div><a href="#top">Voltar ao topo ↑</a></div><div class="products">${group.products.map((product) => {
    const summary = String(product.comentario || "").replace(/\s+/g, " ").trim();
    const badge = promotionIsValid(product) ? '<span class="deal">Oferta do dia</span>' : "";
    return `<article><h3><a href="${escapeHtml(productUrls.get(product.id))}">${escapeHtml(product.titulo)}</a></h3><p>${escapeHtml(summary.slice(0, 190))}${summary.length > 190 ? "…" : ""}</p><div>${badge}<a class="read" href="${escapeHtml(productUrls.get(product.id))}">Ver preço, prós e contras →</a></div></article>`;
  }).join("")}</div></section>`).join("");
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow,max-image-preview:large"><title>${escapeHtml(directoryTitle)}</title>
<meta name="description" content="${escapeHtml(directoryDescription)}">
<link rel="canonical" href="${SITE}analises.html"><meta property="og:type" content="website"><meta property="og:site_name" content="Ranking da Compra"><meta property="og:locale" content="pt_BR"><meta property="og:title" content="${escapeHtml(directoryTitle)}"><meta property="og:description" content="${escapeHtml(directoryDescription)}"><meta property="og:url" content="${SITE}analises.html"><meta property="og:image" content="${SITE}og-ranking-da-compra.png"><meta property="og:image:alt" content="Ranking da Compra — análises de produtos"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(directoryTitle)}"><meta name="twitter:description" content="${escapeHtml(directoryDescription)}"><meta name="twitter:image" content="${SITE}og-ranking-da-compra.png"><meta name="theme-color" content="#0f3d2e"><script type="application/ld+json">${structuredData}</script>
<style>:root{--green:#116149;--ink:#11221d;--muted:#607068;--line:#dfe7e2;--cream:#fbfaf5;--deal:#fff2bf}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.55}a{color:var(--green)}.wrap{width:min(1120px,calc(100% - 32px));margin:auto}header{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5}.bar{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:18px}.brand{font-weight:900;text-decoration:none}.back{font-weight:800;text-decoration:none}.hero{padding:50px 0 28px}.eyebrow{color:var(--green);font-size:.75rem;text-transform:uppercase;letter-spacing:.09em;font-weight:900}h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.05;letter-spacing:-.05em;margin:9px 0 14px}.hero p{max-width:760px;color:var(--muted);font-size:1.06rem}.summary{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.summary span{background:#edf7f1;border:1px solid #cde4d5;border-radius:999px;padding:7px 11px;font-weight:800;font-size:.84rem}.category-nav{display:flex;flex-wrap:wrap;gap:8px;padding:18px;background:#fff;border:1px solid var(--line);border-radius:16px}.category-nav a{display:flex;gap:7px;align-items:center;padding:8px 10px;background:#f3f7f4;border-radius:8px;text-decoration:none;font-weight:800;font-size:.84rem}.category-nav span{color:var(--muted)}section{padding:38px 0;border-bottom:1px solid var(--line)}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:end;margin-bottom:16px}.section-head h2{margin:4px 0 0;font-size:1.7rem}.section-head>a{font-size:.82rem}.products{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.products article{display:flex;flex-direction:column;background:#fff;border:1px solid var(--line);border-radius:13px;padding:17px}.products h3{font-size:1rem;line-height:1.35;margin:0 0 8px}.products h3 a{text-decoration:none;color:var(--ink)}.products h3 a:hover{text-decoration:underline}.products p{color:var(--muted);font-size:.86rem;margin:0 0 13px}.products article>div{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto}.read{font-size:.8rem;font-weight:850;text-decoration:none}.deal{background:var(--deal);color:#725300;border-radius:999px;padding:5px 8px;font-size:.7rem;font-weight:900}footer{background:#10231c;color:#dfeae4;padding:30px 0;margin-top:38px;font-size:.84rem}footer a{color:#fff}@media(max-width:760px){.products{grid-template-columns:1fr}.bar{padding:13px 0;align-items:flex-start}.section-head{align-items:flex-start}.products article>div{align-items:flex-start;flex-direction:column}}</style>
</head><body id="top"><header><div class="wrap bar"><a class="brand" href="${SITE}">Ranking da Compra</a><a class="back" href="${SITE}#promocoes">← Ofertas de hoje</a></div></header><main class="wrap"><div class="hero"><span class="eyebrow">Diretório permanente</span><h1>Análises de produtos para comprar melhor</h1><p>Esta página reúne as análises editoriais publicadas. Use as categorias para encontrar produtos, comparar pontos positivos e limitações e confirmar o preço atual no vendedor.</p><div class="summary"><span>${groups.length} ${groups.length === 1 ? "categoria" : "categorias"}</span><span>${itemList.length} ${itemList.length === 1 ? "análise publicada" : "análises publicadas"}</span><span>Atualizado em ${escapeHtml(new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(`${lastModified}T12:00:00-03:00`)))}</span></div></div><nav class="category-nav" aria-label="Categorias de análises">${navigation}</nav>${sections}</main><footer><div class="wrap"><b>Ranking da Compra</b> — escolhas mais claras para comprar melhor. Alguns links são de afiliados; podemos receber comissão sem custo adicional para você. <a href="${SITE}como-avaliamos.html">Conheça nosso método</a>.</div></footer></body></html>\n`;
}

function relatedSection(product, related, productUrls, categoryName) {
  const links = related.map((item) => `<li><a href="${escapeHtml(productUrls.get(item.id))}">${escapeHtml(item.titulo)}</a></li>`).join("");
  const guide = (related.length + 1) >= 3
    ? `<p><a href="${SITE}${guideFileName(product.categoria)}" style="display:inline-flex;padding:10px 13px;border-radius:8px;background:#116149;color:#fff;font-weight:900;text-decoration:none">Ver comparativo completo da categoria →</a></p>` : "";
  return `<!-- discovery-related:start --><section class="related-discovery" style="margin-top:28px;padding:20px;border:1px solid #dfe7e2;border-radius:13px;background:#fafcfb"><h2 style="margin:0 0 9px;font-size:1.1rem">Compare também em ${escapeHtml(categoryName)}</h2>${links ? `<ul style="margin:0 0 12px;padding-left:20px">${links}</ul>` : ""}${guide}<a href="${SITE}analises.html#${escapeHtml(slug(product.categoria))}" style="color:#116149;font-weight:850">Ver todas as análises desta categoria →</a></section><!-- discovery-related:end -->`;
}

function upgradeProductExperience(html) {
  let next = String(html || "").replace(
    /growth-tools\.js\?v=[^"'<>]+/g,
    `growth-tools.js?v=${GROWTH_TOOLS_VERSION}`,
  );
  if (!next.includes("data-mobile-product-buy")) {
    next = next.replace(
      /(<script defer src=["']\/growth-tools\.js\?v=[^"']+["']><\/script>)/,
      `${MOBILE_PRODUCT_STYLE}\n  $1`,
    );
  }
  if (!next.includes('id="mobile-affiliate-offer"')) {
    const offer = next.match(/<a class="cta(?: [^"]*)?" id="affiliate-offer" href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
    if (offer) {
      const marketplace = /shopee/i.test(`${offer[1]} ${offer[2]}`) ? "Shopee" : "Mercado Livre";
      const mobileOffer = `<a class="mobile-buy" id="mobile-affiliate-offer" href="${offer[1]}" target="_blank" rel="sponsored noopener noreferrer">Ver preço na ${marketplace}</a>`;
      next = next.replace("</main>", `</main>\n\n  ${mobileOffer}`);
    }
  }
  if (next.includes('id="mobile-affiliate-offer"') && !next.includes("data-mobile-offer-track")) {
    const tracking = '<script data-mobile-offer-track>document.getElementById("mobile-affiliate-offer")?.addEventListener("click",function(){if(typeof gtag==="function")gtag("event","select_item",{item_list_name:"pagina_produto_mobile"})});</script>';
    next = next.replace("</body>", `  ${tracking}\n</body>`);
  }
  return next;
}

async function addRelatedLinks(products, productsByCategory, productUrls, categoryNames) {
  let updated = 0;
  for (const product of products) {
    const productUrl = productUrls.get(product.id);
    let fileName;
    try {
      fileName = decodeURIComponent(basename(new URL(productUrl).pathname));
    } catch {
      continue;
    }
    const filePath = resolve("produto", fileName);
    let html;
    try {
      html = await readFile(filePath, "utf8");
    } catch {
      continue;
    }
    const related = [...(productsByCategory.get(product.categoria) || [])]
      .filter((item) => item.id !== product.id).sort(sortProducts).slice(0, 4);
    const section = relatedSection(product, related, productUrls, categoryNames.get(product.categoria) || "Produtos");
    const withoutOldSection = html.replace(/<!-- discovery-related:start -->[\s\S]*?<!-- discovery-related:end -->/g, "");
    const next = upgradeProductExperience(withoutOldSection.replace("</article>", `${section}</article>`));
    if (next !== html) {
      await writeFile(filePath, next, "utf8");
      updated += 1;
    }
  }
  return updated;
}

function updateSitemap(xml, lastModified, guidePages) {
  const pages = [[`${SITE}analises.html`, "daily", "0.9"], ...guidePages.map((fileName) => [`${SITE}${fileName}`, "weekly", "0.9"])];
  let updated = xml;
  updated = updated.replace(/\s*<url>\s*<loc>https:\/\/rankingdacompra\.com\.br\/melhores-[^<]+\.html<\/loc>[\s\S]*?<\/url>/g, "");
  for (const [url] of pages) {
    updated = updated.replace(new RegExp(`\\s*<url>\\s*<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<\\/loc>[\\s\\S]*?<\\/url>`, "g"), "");
  }
  const entries = pages.map(([url, frequency, priority]) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${escapeXml(lastModified)}</lastmod>\n    <changefreq>${frequency}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`).join("");
  return updated.replace("</urlset>", `${entries}</urlset>`);
}

function buildSearchIndex(categories, products, productUrls, categoryNames, lastModified) {
  const categoryPayload = categories.map((category) => ({
    id: category.id,
    name: categoryNames.get(category.id) || category.id,
  }));
  const productPayload = products.map((product) => ({
    id: product.id,
    title: String(product.titulo || "").trim(),
    summary: String(product.comentario || "").replace(/\s+/g, " ").trim(),
    category: categoryNames.get(product.categoria) || product.categoria || "Produtos",
    image: firstUrl(product.foto),
    price: numberPrice(product.precoPromocional || product.preco),
    rating: Number(product.nota) || 0,
    ranking: 0,
    url: productUrls.get(product.id),
  })).filter((product) => product.title && product.summary.length >= 180 && product.url);
  return { version: 1, updatedAt: lastModified, categories: categoryPayload, products: productPayload };
}

const [allCategories, allProducts, marketplaceProducts] = await loadData();
const candidateProducts = allProducts.map(correctProductData)
  .filter(editorialProduct)
  .filter((product) => numberPrice(product.precoPromocional || product.preco) > 0)
  .filter((product) => marketplaceProducts[product.id]?.visible !== false)
  .sort(sortProducts);
let sitemapXml = await readFile(resolve("sitemap.xml"), "utf8");
const productUrls = await productUrlMap(candidateProducts, sitemapXml);
const products = candidateProducts.filter((product) => productUrls.has(product.id));
if (products.length !== candidateProducts.length) {
  console.warn(
    "Descoberta interna: " + (candidateProducts.length - products.length) +
    " cadastro(s) sem página publicada foram ignorados para impedir links 404.",
  );
}
const productsByCategory = new Map();
for (const product of products) {
  const items = productsByCategory.get(product.categoria) || [];
  items.push(product);
  productsByCategory.set(product.categoria, items);
}
const categories = allCategories
  .filter((category) => productsByCategory.has(category.id))
  .sort((a, b) => String(a.nome || a.id).localeCompare(String(b.nome || b.id), "pt-BR"));
const knownCategoryIds = new Set(categories.map((category) => category.id));
for (const categoryId of productsByCategory.keys()) {
  if (!knownCategoryIds.has(categoryId)) categories.push({ id: categoryId, nome: categoryId });
}
const categoryNames = new Map(categories.map((category) => [category.id, String(category.nome || category.id).replace(/air\s+frayer/gi, "Air Fryer")]));
const lastModified = newestDate([
  ...products.flatMap((product) => [product.atualizadoEm, product.dataCadastro]),
  ...categories.map((category) => category.criadoEm),
]);
await writeFile(resolve("analises.html"), renderDirectoryPage(categories, productsByCategory, productUrls, categoryNames, lastModified), "utf8");
const guidePages = [];
for (const category of categories) {
  const fileName = guideFileName(category.id);
  const guide = renderCategoryGuide(category.id, categoryNames.get(category.id) || category.id, productsByCategory.get(category.id) || [], productUrls, lastModified);
  if (!guide) continue;
  await writeFile(resolve(fileName), guide, "utf8");
  guidePages.push(fileName);
}
for (const file of (await readdir(resolve("."))).filter((name) => /^melhores-.+\.html$/.test(name))) {
  if (!guidePages.includes(file)) await unlink(resolve(file));
}
await writeFile(
  resolve("search-index.json"),
  JSON.stringify(buildSearchIndex(categories, products, productUrls, categoryNames, lastModified), null, 2) + "\n",
  "utf8",
);
sitemapXml = updateSitemap(sitemapXml, lastModified, guidePages);
await writeFile(resolve("sitemap.xml"), sitemapXml, "utf8");
const relatedPages = await addRelatedLinks(products, productsByCategory, productUrls, categoryNames);

console.log(`Descoberta interna atualizada: ${products.length} análises pesquisáveis sem Firebase, ${guidePages.length} comparativos e ${relatedPages} páginas com produtos relacionados.`);
