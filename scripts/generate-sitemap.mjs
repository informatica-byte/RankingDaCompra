import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";

import { createHash } from "node:crypto";

import { resolve } from "node:path";

import { execFile } from "node:child_process";

import { promisify } from "node:util";



const PROJECT_ID = "rankingdacompra";

const FIREBASE_API_KEY = "AIzaSyChRBmFfokCPPec7oTdC1u9obQg6M83Epk";

const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const SITE = "https://rankingdacompra.com.br/";

const SHARE_VERSION = "20260810-1";

const GENERIC_TEXT = /(chama aten[cç][aã]o por|recursos descritos no pr[oó]prio t[ií]tulo|informa[cç][oõ]es em atualiza[cç][aã]o|produto identificado no an[uú]ncio|oferta para comparar|conhe[cç]a este produto)/i;

const execFileAsync = promisify(execFile);

let partialProductSource = false;



const CATEGORY_ALIASES = new Map([

  ["patineteelétrica", "parafusadeira-eletrica"],

  ["fritadeiraairfrayerelétrica", "fritadeira-air-fryer-eletrica"],

]);



function fieldValue(field) {

  if (!field) return "";

  return field.stringValue ?? field.integerValue ?? field.doubleValue

    ?? field.booleanValue ?? field.timestampValue ?? "";

}



const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);



function wait(milliseconds) {

  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

}



async function fetchFirestore(url, collection, maxAttempts = 8) {

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {

    const response = await fetch(url);

    if (response.ok) return response;



    const retryable = RETRYABLE_HTTP_STATUS.has(response.status);

    if (!retryable || attempt === maxAttempts) {

      throw new Error(collection + ": HTTP " + response.status + " após " + attempt + " tentativa(s)");

    }



    const retryAfterSeconds = Number(response.headers.get("retry-after"));

    const exponentialDelay = Math.min(2000 * (2 ** (attempt - 1)), 60000);

    const retryDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0

      ? retryAfterSeconds * 1000

      : exponentialDelay + Math.floor(Math.random() * 500);



    console.warn(

      collection + ": HTTP " + response.status + "; nova tentativa " + (attempt + 1) + "/" + maxAttempts + " em " + retryDelay + " ms.",

    );

    await wait(retryDelay);

  }



  throw new Error(collection + ": falha inesperada ao consultar o Firestore");

}



async function listCollection(collection, maxAttempts = 8) {

  const documents = [];

  let pageToken = "";

  do {

    const query = new URLSearchParams({ pageSize: "300", key: FIREBASE_API_KEY });

    if (pageToken) query.set("pageToken", pageToken);

    let response;

    try {

      // A chave pública identifica o projeto e evita o limite baixo das leituras anônimas.

      response = await fetchFirestore(FIRESTORE + "/" + collection + "?" + query, collection, maxAttempts);

    } catch (keyError) {

      // Mantém a leitura pública como contingência caso a chave esteja temporariamente indisponível.

      query.delete("key");

      try {

        response = await fetchFirestore(FIRESTORE + "/" + collection + "?" + query, collection, maxAttempts);

      } catch (publicError) {

        throw new Error(

          collection + ": leitura com chave falhou (" + String(keyError?.message || keyError) +

          "); leitura pública falhou (" + String(publicError?.message || publicError) + ")",

        );

      }

    }

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



function decodePublicHtml(value) {

  return String(value || "")

    .replace(/<[^>]*>/g, " ")

    .replace(/&nbsp;|&#160;/gi, " ")

    .replace(/&amp;/gi, "&")

    .replace(/&quot;/gi, '"')

    .replace(/&#39;|&apos;/gi, "'")

    .replace(/&lt;/gi, "<")

    .replace(/&gt;/gi, ">")

    .replace(/\s+/g, " ")

    .trim();

}



function repairPortugueseEncoding(value) {
  const bad = "\uFFFD";
  const repairs = [
    ["Informa" + bad + bad + "es", "Informações"],
    ["Caracter" + bad + "sticas", "Características"],
    ["Condi" + bad + bad + "o", "Condição"],
    ["C" + bad + "digo", "Código"],
    ["cat" + bad + "logo", "catálogo"],
    ["extra" + bad + "das", "extraídas"],
    ["p" + bad + "blicos", "públicos"],
    ["an" + bad + "ncio", "anúncio"],
    ["pre" + bad + "o", "preço"],
    ["varia" + bad + bad + "es", "variações"],
    ["n" + bad + "o", "não"],
    ["identific" + bad + "vel", "identificável"],
    ["dispon" + bad + "veis", "disponíveis"],
    ["ent" + bad + "o", "então"],
  ];
  let text = String(value || "");
  for (const [broken, corrected] of repairs) text = text.split(broken).join(corrected);
  return text.split(bad).join("").replace(/\s+/g, " ").trim();
}

function htmlAttribute(fragment, name) {

  const match = String(fragment || "").match(new RegExp(name + '="([^"]*)"', "i"));

  return decodePublicHtml(match?.[1] || "");

}



function htmlClassText(fragment, className) {

  const expression = new RegExp(

    '<[^>]+class="[^"]*' + className + '[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>',

    "i",

  );

  return decodePublicHtml(String(fragment || "").match(expression)?.[1] || "");

}



async function listPublicOffers() {

  console.warn("Firebase temporariamente limitado; lendo as ofertas já exibidas na vitrine pública.");

  const chromeCandidates = [

    process.env.CHROME_PATH,

    "google-chrome",

    "google-chrome-stable",

    "chromium",

    "chromium-browser",

  ].filter(Boolean);

  let html = "";

  let lastError = null;

  for (const executable of chromeCandidates) {

    try {

      const result = await execFileAsync(

        executable,

        [

          "--headless=new",

          "--no-sandbox",

          "--disable-gpu",

          "--disable-dev-shm-usage",

          "--dump-dom",

          "--virtual-time-budget=15000",

          SITE + "?gerador-social=" + Date.now(),

        ],

        { maxBuffer: 12 * 1024 * 1024, timeout: 50000 },

      );

      html = result.stdout || "";

      if (html.includes("data-share-product")) break;

    } catch (error) {

      lastError = error;

    }

  }



  if (!html.includes("data-share-product")) {

    throw new Error("A vitrine pública não pôde ser lida para o modo de emergência. " + String(lastError?.message || ""));

  }



  const productsById = new Map();

  for (const match of html.matchAll(/<article\b[^>]*class="[^"]*deal-card[^"]*"[^>]*>[\s\S]*?<\/article>/gi)) {

    const card = match[0];

    const id = htmlAttribute(card, "data-flash-card")

      || htmlAttribute(card, "data-share-product")

      || decodePublicHtml(card.match(/data-share-product="([^"]+)"/i)?.[1] || "");

    if (!/^[A-Za-z0-9_-]+$/.test(id)) continue;

    const title = htmlClassText(card, "deal-title")

      || decodePublicHtml(card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "")

      || htmlAttribute(card.match(/<img\b[^>]*>/i)?.[0], "alt");

    const image = htmlAttribute(card.match(/<img\b[^>]*>/i)?.[0], "src");

    if (!title || !image) continue;

    const currentPrice = htmlClassText(card, "deal-price");

    const previousPrice = htmlClassText(card, "old-price");

    productsById.set(id, {

      id,

      titulo: title,

      foto: image,

      categoria: "ofertas",

      comentario: "Oferta em destaque na vitrine do Ranking da Compra. Confira o preço, o prazo, o estoque, o frete e as condições atualizadas antes de finalizar a compra.",

      pros: "Preço promocional exibido na vitrine; acesso pela página do Ranking da Compra; condições verificáveis antes da compra",

      contras: "O preço e o estoque podem mudar; confirme o frete; verifique as condições do vendedor",

      preco: currentPrice,

      precoAnterior: previousPrice,

      precoPromocional: currentPrice,

      promocaoAtiva: true,

      link: SITE + "?produto=" + encodeURIComponent(id),

      linkAfiliado: SITE + "?produto=" + encodeURIComponent(id),

      nota: "",

    });

  }



  const products = [...productsById.values()];

  if (!products.length) throw new Error("Nenhuma oferta ativa foi encontrada na vitrine pública.");

  console.log("Modo de emergência: " + products.length + " oferta(s) recuperada(s) da vitrine.");

  return products;

}




function schemaNotes(list) {
  return (list?.itemListElement || [])
    .map((item) => repairPortugueseEncoding(item?.name || ""))
    .filter(Boolean)
    .join("; ");
}

async function listPublishedProducts() {
  console.warn("Usando as páginas de produto já publicadas como fonte segura de contingência.");
  const directory = resolve("produto");
  const entries = await readdir(directory, { withFileTypes: true });
  const products = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith("-" + SHARE_VERSION + ".html")) continue;
    const id = entry.name.slice(0, -("-" + SHARE_VERSION + ".html").length);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) continue;

    try {
      const html = await readFile(resolve(directory, entry.name), "utf8");
      let schema = null;
      for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
          const payload = JSON.parse(match[1]);
          const nodes = Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [payload];
          schema = nodes.find((node) => node?.["@type"] === "Product");
          if (schema) break;
        } catch {
          // Ignora um bloco inválido e tenta o próximo.
        }
      }
      if (!schema?.name) continue;

      const offer = Array.isArray(schema.offers) ? schema.offers[0] : schema.offers || {};
      const review = Array.isArray(schema.review) ? schema.review[0] : schema.review || {};
      const images = Array.isArray(schema.image) ? schema.image : [schema.image];
      const sourceMatch = html.match(/class=["'][^"']*source[^"']*["'][\s\S]*?<a\b[^>]*href=["']([^"']+)["']/i);

      products.push({
        id,
        titulo: repairPortugueseEncoding(schema.name),
        foto: String(images.find(Boolean) || ""),
        categoria: repairPortugueseEncoding(schema.category || "ofertas"),
        comentario: repairPortugueseEncoding(schema.description || review.reviewBody || ""),
        pros: schemaNotes(review.positiveNotes),
        contras: schemaNotes(review.negativeNotes),
        preco: String(offer.price || ""),
        precoAnterior: "",
        precoPromocional: "",
        promocaoAtiva: false,
        link: decodePublicHtml(sourceMatch?.[1] || offer.url || ""),
        linkAfiliado: String(offer.url || ""),
        nota: String(review?.reviewRating?.ratingValue || ""),
        atualizadoEm: "",
        dataCadastro: "",
      });
    } catch (error) {
      console.warn("Página de contingência ignorada (" + entry.name + "): " + error.message);
    }
  }

  if (!products.length) throw new Error("Nenhuma página de produto publicada pôde ser lida.");
  console.log("Modo de contingência: " + products.length + " produto(s) recuperado(s) das páginas publicadas.");
  return products;
}


function editorialProduct(product) {

  const summary = sanitizeEditorialSummary(product.comentario);

  return summary.length >= 180 && !GENERIC_TEXT.test(summary);

}



async function marketplaceStatus() {

  try {

    const payload = JSON.parse(await readFile(resolve("mercadolivre-status.json"), "utf8"));

    return payload?.products && typeof payload.products === "object" ? payload.products : {};

  } catch {

    return {};

  }

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



function escapeHtml(value) {

  return String(value ?? "").replace(/[&<>"']/g, (character) => ({

    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",

  })[character]);

}



function absoluteImage(value) {

  try {

    const url = new URL(String(value || ""));

    if (url.protocol === "http:") url.protocol = "https:";

    if (url.hostname.endsWith("mlstatic.com") && url.pathname.endsWith(".webp")) {

      url.pathname = url.pathname.replace(/\.webp$/i, ".jpg");

    }

    return url.protocol === "https:" ? url.href : `${SITE}og-ranking-da-compra.png`;

  } catch {

    return `${SITE}og-ranking-da-compra.png`;

  }

}





function imageMime(extension) {

  return extension === "png" ? "image/png" : "image/jpeg";

}



async function fileExists(filePath) {

  try {

    await access(filePath);

    return true;

  } catch {

    return false;

  }

}



async function cacheProductImage(product, imageDirectory) {

  const source = absoluteImage(product.foto);

  const fallback = `${SITE}og-ranking-da-compra.png`;

  if (source === fallback) return { url: source, mime: "image/png", fileName: "" };



  let extension = "";

  try {

    const match = new URL(source).pathname.match(/\.(jpe?g|png)$/i);

    if (match) extension = match[1].toLowerCase().replace("jpeg", "jpg");

  } catch {

    return { url: fallback, mime: "image/png", fileName: "" };

  }



  const hash = createHash("sha256").update(source).digest("hex").slice(0, 12);

  let fileName = extension ? `${product.id}-${hash}.${extension}` : "";

  let filePath = fileName ? resolve(imageDirectory, fileName) : "";



  if (!extension) {

    for (const candidate of ["jpg", "png"]) {

      const candidateName = `${product.id}-${hash}.${candidate}`;

      if (await fileExists(resolve(imageDirectory, candidateName))) {

        extension = candidate;

        fileName = candidateName;

        filePath = resolve(imageDirectory, fileName);

        break;

      }

    }

  }



  if (!filePath || !(await fileExists(filePath))) {

    try {

      const response = await fetch(source, {

        headers: { "User-Agent": "RankingDaCompra-SocialImage/1.0" },

      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = String(response.headers.get("content-type") || "").split(";")[0];

      if (!contentType.startsWith("image/")) throw new Error(`tipo inválido: ${contentType || "desconhecido"}`);

      const detectedExtension = contentType === "image/png" ? "png" : contentType === "image/jpeg" ? "jpg" : "";

      if (!detectedExtension) throw new Error(`formato não compatível: ${contentType}`);

      if (extension && extension !== detectedExtension) throw new Error(`esperado ${extension.toUpperCase()}, recebido ${contentType}`);

      extension = detectedExtension;

      fileName = `${product.id}-${hash}.${extension}`;

      filePath = resolve(imageDirectory, fileName);

      const bytes = new Uint8Array(await response.arrayBuffer());

      if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("tamanho de imagem inválido");

      await writeFile(filePath, bytes);

    } catch (error) {

      console.warn(`Foto social não armazenada para ${product.id}: ${error.message}`);

      return { url: source, mime: imageMime(extension), fileName: "" };

    }

  }



  return {

    url: `${SITE}produto/imagens/${fileName}?v=${SHARE_VERSION}`,

    mime: imageMime(extension),

    fileName,

  };

}



async function cacheProductImages(products, imageDirectory) {

  const images = new Map();

  const concurrency = 8;

  for (let index = 0; index < products.length; index += concurrency) {

    const batch = products.slice(index, index + concurrency);

    await Promise.all(batch.map(async (product) => {

      images.set(product.id, await cacheProductImage(product, imageDirectory));

    }));

  }

  return images;

}



function productDetailUrl(product) {

  return `${SITE}produto/${encodeURIComponent(product.id)}-${SHARE_VERSION}.html`;

}



function shareDay() {

  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

}



function shareHash(value) {

  let hash = 0;

  for (const character of String(value || "")) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;

  return hash.toString(36);

}



function shareRevision(product) {

  const values = [product?.id, product?.foto];

  return `${shareDay().replace(/\D/g, "")}-${shareHash(values.join("|"))}`;

}



function productShareUrl(product) {

  const url = new URL(`produto/${encodeURIComponent(product.id)}-${SHARE_VERSION}.html`, SITE);

  url.searchParams.set("v", shareRevision(product));

  return url.href;

}



function safeExternalUrl(value) {

  try {

    const url = new URL(String(value || ""));

    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";

  } catch {

    return "#";

  }

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

    ? new Date(`${String(product.promocaoValidaAte).slice(0, 10)}T23:59:59-03:00`)

    : null;

  return product.promocaoAtiva === true && previous > promotional && promotional > 0

    && (!end || (!Number.isNaN(end.getTime()) && end.getTime() >= Date.now()));

}

function weeklyTopWeek(date = new Date()) {

  const localDay = new Intl.DateTimeFormat("en-CA", {

    timeZone: "America/Sao_Paulo",

    year: "numeric",

    month: "2-digit",

    day: "2-digit",

  }).format(date);

  const monday = new Date(localDay + "T12:00:00Z");

  const weekday = monday.getUTCDay() || 7;

  monday.setUTCDate(monday.getUTCDate() - weekday + 1);

  const sunday = new Date(monday);

  sunday.setUTCDate(sunday.getUTCDate() + 6);

  return {

    id: monday.toISOString().slice(0, 10),

    start: monday.toISOString().slice(0, 10),

    end: sunday.toISOString().slice(0, 10),

  };

}



function weeklyTopVerifiedAt(product) {

  return newestDate([

    product.precoConferidoPorIAEm,

    product.precoAtualizadoManualmenteEm,

    product.atualizadoEm,

    product.dataCadastro,

  ]);

}



function weeklyTopFreshnessDays(product) {

  const verifiedAt = weeklyTopVerifiedAt(product);

  if (!verifiedAt) return 999;

  const time = Date.parse(verifiedAt + "T12:00:00Z");

  return Number.isNaN(time) ? 999 : Math.max(0, Math.floor((Date.now() - time) / 86400000));

}



function weeklyTopCurrentPrice(product) {

  if (promotionIsValid(product)) return numberPrice(product.precoPromocional);

  return numberPrice(product.preco) || numberPrice(product.precoPromocional);

}



function weeklyTopDiscount(product) {

  const current = weeklyTopCurrentPrice(product);

  const previous = numberPrice(product.precoAnterior);

  return previous > current && current > 0 ? Math.round((1 - current / previous) * 100) : 0;

}



function weeklyTopRotation(product, weekId) {

  const digest = createHash("sha256").update(weekId + ":" + product.id).digest("hex").slice(0, 8);

  return Number.parseInt(digest, 16) % 31;

}



function weeklyTopScore(product, weekId) {

  const freshness = weeklyTopFreshnessDays(product);

  const rating = Math.max(0, Math.min(5, Number(product.nota) || 0));

  const ranking = Math.max(0, 25 - (Number(product.ranking) || 25));

  const freshBoost = freshness <= 7 ? 42 : freshness <= 14 ? 24 : freshness <= 30 ? 8 : 0;

  return weeklyTopDiscount(product) * 4 + rating * 11 + ranking + freshBoost

    + weeklyTopRotation(product, weekId);

}



async function readPreviousWeeklyTop() {

  try {

    return JSON.parse(await readFile(resolve("top5-semanal.json"), "utf8"));

  } catch {

    return null;

  }

}



function weeklyTopSnapshot(product, image, position) {

  const current = weeklyTopCurrentPrice(product);

  const previous = numberPrice(product.precoAnterior);

  return {

    id: String(product.id),

    position,

    titulo: repairPortugueseEncoding(product.titulo),

    categoria: String(product.categoria || "ofertas").trim(),

    selo: String(product.selo || "Escolha da semana").trim(),

    foto: SITE + "produto/imagens/" + image.fileName + "?v=" + SHARE_VERSION,

    productUrl: productShareUrl(product),

    linkAfiliado: String(product.linkAfiliado || product.link || "").trim(),

    preco: current.toFixed(2).replace(".", ","),

    precoAnterior: previous > current ? previous.toFixed(2).replace(".", ",") : "",

    precoPromocional: current.toFixed(2).replace(".", ","),

    desconto: weeklyTopDiscount(product),

    nota: String(product.nota || ""),

    ranking: String(product.ranking || ""),

    comentario: repairPortugueseEncoding(product.comentario),

    pros: repairPortugueseEncoding(product.pros),

    contras: repairPortugueseEncoding(product.contras),

    dadosTecnicos: repairPortugueseEncoding(product.dadosTecnicos),

    precoConferidoEm: weeklyTopVerifiedAt(product),

  };

}



async function generateWeeklyTop(products, socialImages) {

  const week = weeklyTopWeek();

  const previous = await readPreviousWeeklyTop();

  const candidates = products.filter((product) => {

    const image = socialImages.get(product.id);

    const affiliate = String(product.linkAfiliado || product.link || "").trim();

    return editorialProduct(product)

      && image?.fileName

      && affiliate.toLowerCase().startsWith("https://")

      && weeklyTopCurrentPrice(product) > 0;

  });



  const freshCandidates = candidates.filter((product) => weeklyTopFreshnessDays(product) <= 14);

  const baseCandidates = freshCandidates.length >= 6 ? freshCandidates : candidates;

  const previousIds = new Set((previous?.products || []).map((product) => String(product.id)));

  const sameWeek = previous?.weekStart === week.start;

  let ordered = [];



  if (sameWeek) {

    const byId = new Map(baseCandidates.map((product) => [String(product.id), product]));

    ordered = (previous.products || []).map((product) => byId.get(String(product.id))).filter(Boolean);

    const selectedIds = new Set(ordered.map((product) => String(product.id)));

    ordered.push(...baseCandidates.filter((product) => !selectedIds.has(String(product.id)))

      .sort((a, b) => weeklyTopScore(b, week.id) - weeklyTopScore(a, week.id)));

  } else {

    const rotated = baseCandidates.filter((product) => !previousIds.has(String(product.id)));

    const pool = rotated.length >= 6 ? rotated : baseCandidates;

    ordered = [...pool].sort((a, b) => weeklyTopScore(b, week.id) - weeklyTopScore(a, week.id));

  }



  const selected = [];

  const categoryCounts = new Map();

  for (const product of ordered) {

    const category = String(product.categoria || "ofertas");

    if ((categoryCounts.get(category) || 0) >= 2) continue;

    selected.push(product);

    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

    if (selected.length === 6) break;

  }

  if (selected.length < 6) {

    const selectedIds = new Set(selected.map((product) => String(product.id)));

    for (const product of ordered) {

      if (selectedIds.has(String(product.id))) continue;

      selected.push(product);

      if (selected.length === 6) break;

    }

  }


  if (selected.length < 6) {
    if (previous?.products?.length) {
      console.warn("Top 6 anterior preservado: somente " + selected.length + " produto(s) elegível(is).");
      return previous;
    }
    throw new Error("Não há 6 produtos elegíveis para montar o Top 6 semanal.");
  }


  const payload = {

    version: 1,

    weekStart: week.start,

    validUntil: week.end + "T23:59:59-03:00",

    updatedAt: week.start + "T07:00:00-03:00",

    selectionRule: freshCandidates.length >= 6

      ? "precos-conferidos-nos-ultimos-14-dias"

      : "melhores-produtos-disponiveis",

    products: selected.map((product, index) => weeklyTopSnapshot(

      product,

      socialImages.get(product.id),

      index + 1,

    )),

  };

  await writeFile(resolve("top5-semanal.json"), JSON.stringify(payload, null, 2) + "\n", "utf8");

  return payload;

}





function money(value) {

  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

}



function compactText(value, maxLength) {

  const text = String(value || "").replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) return text;

  const shortened = text.slice(0, Math.max(1, maxLength - 1)).replace(/\s+\S*$/, "").trim();

  return `${shortened || text.slice(0, maxLength - 1)}…`;

}



function editorialItems(value, productTitle = "") {

  const titleWords = new Set(normalizedProductTitle({ titulo: productTitle }).split(" ").filter((word) => word.length > 2));
  const generic = /informa[cç][oõ]es? (?:extra[ií]das?|obtidas?)|dados p[uú]blicos|confira (?:no|o) an[uú]ncio|recursos descritos|produto identificado|ficha (?:n[aã]o )?informa/i;
  const normalized = (text) => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  return repairPortugueseEncoding(value).split(/\n|;/).flatMap((part) => part.split(","))

    .map((part) => part.replace(/^[\s•✓!+-]+/, "").replace(/\s+/g, " ").trim())
    .filter((part) => {
      if (part.length < 18 || part.split(/\s+/).length < 3 || generic.test(part)) return false;
      const words = normalized(part).split(" ").filter((word) => word.length > 2);
      const overlap = words.length ? words.filter((word) => titleWords.has(word)).length / words.length : 1;
      return overlap < 0.8;
    })
    .filter((part, index, items) => items.findIndex((other) => normalized(other) === normalized(part)) === index)
    .slice(0, 4);

}



function renderSharePage(product, socialImage, categoryNames) {

  const title = repairPortugueseEncoding(product.titulo || "Produto recomendado");

  const summary = sanitizeEditorialSummary(product.comentario || "Confira a análise no Ranking da Compra.");

  const image = socialImage?.url || absoluteImage(product.foto);

  const imageType = socialImage?.mime || "image/jpeg";

  const detailUrl = productDetailUrl(product);

  const shareUrl = productShareUrl(product);

  const offerUrl = safeExternalUrl(product.linkAfiliado || product.link);

  const sourceUrl = safeExternalUrl(product.link);

  const categoryName = productCategoryName(product, categoryNames);

  const positive = editorialItems(product.pros, title);

  const attention = editorialItems(product.contras, title);

  const editorial = editorialProduct(product);

  const promotional = promotionIsValid(product);

  const currentPrice = promotional ? numberPrice(product.precoPromocional) : numberPrice(product.preco);

  const previousPrice = promotional ? numberPrice(product.precoAnterior) : 0;

  const discount = previousPrice > currentPrice ? Math.round((1 - currentPrice / previousPrice) * 100) : 0;

  const seoHook = promotional && discount >= 5

    ? `${discount}% OFF por ${money(currentPrice)}`

    : currentPrice > 0

      ? `${money(currentPrice)}: vale a pena?`

      : "vale a pena? prós e contras";

  const seoProductName = compactText(title, Math.max(24, 64 - seoHook.length - 2));

  const seoTitle = `${seoProductName}: ${seoHook}`;

  const browserTitle = seoTitle.length <= 43 ? `${seoTitle} | Ranking da Compra` : seoTitle;

  const descriptionLead = promotional && discount >= 5

    ? `Oferta informada: ${title} por ${money(currentPrice)} (${discount}% OFF).`

    : currentPrice > 0

      ? `Preço informado de ${title}: ${money(currentPrice)}.`

      : `Análise de ${title}.`;

  const description = compactText(`${descriptionLead} ${summary}`, 158);

  const modified = newestDate([product.atualizadoEm, product.dataCadastro]);

  const rating = Number(product.nota);

  const productSchema = { "@type": "Product", "@id": `${detailUrl}#product`, name: title, description: summary, image: [image], category: categoryName, url: detailUrl };
  const brand = repairPortugueseEncoding(product.marca || product.brand || "");
  const gtin = String(product.gtin13 || product.gtin14 || product.gtin || product.ean || "").replace(/\D/g, "");
  if (brand) productSchema.brand = { "@type": "Brand", name: brand };
  if ([8, 12, 13, 14].includes(gtin.length)) productSchema["gtin" + gtin.length] = gtin;

  if (offerUrl !== "#" && currentPrice > 0) productSchema.offers = { "@type": "Offer", url: offerUrl, priceCurrency: "BRL", price: currentPrice.toFixed(2), availability: "https://schema.org/InStock" };

  if (editorial && Number.isFinite(rating) && rating >= 1 && rating <= 5) {

    productSchema.review = { "@type": "Review", name: `Análise editorial de ${title}`, author: { "@type": "Organization", name: "Equipe editorial Ranking da Compra" }, publisher: { "@id": `${SITE}#organization` }, reviewBody: summary, reviewRating: { "@type": "Rating", ratingValue: rating, bestRating: 5, worstRating: 1 } };

    if (positive.length) productSchema.review.positiveNotes = { "@type": "ItemList", itemListElement: positive.map((name, index) => ({ "@type": "ListItem", position: index + 1, name })) };

    if (attention.length) productSchema.review.negativeNotes = { "@type": "ItemList", itemListElement: attention.map((name, index) => ({ "@type": "ListItem", position: index + 1, name })) };

  }

  const structuredData = JSON.stringify({ "@context": "https://schema.org", "@graph": [

    { "@type": "Organization", "@id": `${SITE}#organization`, name: "Ranking da Compra", url: SITE },

    { "@type": "BreadcrumbList", itemListElement: [

      { "@type": "ListItem", position: 1, name: "Início", item: SITE },

      { "@type": "ListItem", position: 2, name: categoryName, item: `${SITE}?cat=${encodeURIComponent(product.categoria || "")}` },

      { "@type": "ListItem", position: 3, name: title, item: detailUrl },

    ] },

    productSchema,

  ] }).replace(/</g, "\\u003c");

  const positiveHtml = positive.length ? positive.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>A ficha cadastrada ainda não traz pontos positivos específicos suficientes.</li>";

  const attentionHtml = attention.length ? attention.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>Confirme compatibilidade, garantia, frete e vendedor antes da compra.</li>";

  const priceHtml = currentPrice > 0

    ? `${previousPrice > currentPrice ? `<span class="previous">De ${escapeHtml(money(previousPrice))}</span>` : ""}<strong>${promotional ? "Oferta informada: " : "Preço informado: "}${escapeHtml(money(currentPrice))}</strong>`

    : "<strong>Consulte o preço atual no vendedor</strong>";



  return `<!doctype html>

<html lang="pt-BR">

<head>

  <meta charset="utf-8">

  <meta name="viewport" content="width=device-width,initial-scale=1">

  <meta name="robots" content="${editorial ? "index,follow,max-image-preview:large" : "noindex,follow"}">

  <title>${escapeHtml(browserTitle)}</title>

  <meta name="description" content="${escapeHtml(description)}">

  <link rel="canonical" href="${escapeHtml(detailUrl)}">

  <meta property="og:type" content="product">

  <meta property="og:site_name" content="Ranking da Compra">

  <meta property="og:locale" content="pt_BR">

  <meta property="og:url" content="${escapeHtml(shareUrl)}">

  <meta property="og:title" content="${escapeHtml(seoTitle)}">

  <meta property="og:description" content="${escapeHtml(description)}">

  <meta property="og:image" content="${escapeHtml(image)}">

  <meta property="og:image:secure_url" content="${escapeHtml(image)}">

  <meta property="og:image:type" content="${escapeHtml(imageType)}">

  <meta property="og:image:alt" content="Foto de ${escapeHtml(title)}">

  <meta name="twitter:card" content="summary_large_image">

  <meta name="twitter:title" content="${escapeHtml(seoTitle)}">

  <meta name="twitter:description" content="${escapeHtml(description)}">

  <meta name="twitter:image" content="${escapeHtml(image)}">

  <meta name="theme-color" content="#0f3d2e">

  <script type="application/ld+json">${structuredData}</script>

  <style>:root{--green:#116149;--ink:#11221d;--muted:#66746d;--line:#dfe7e2;--cream:#fbfaf5;--blue:#1769e0}*{box-sizing:border-box}body{font-family:Inter,Segoe UI,Arial,sans-serif;background:var(--cream);color:var(--ink);margin:0;line-height:1.55}a{color:inherit}.wrap{width:min(1040px,calc(100% - 32px));margin:auto}header{background:#fff;border-bottom:1px solid var(--line)}header .wrap{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{color:var(--green);font-weight:900;text-decoration:none}.back{color:var(--green);font-weight:750;text-decoration:none;font-size:.9rem}main{padding:30px 0 56px}.crumb{color:var(--muted);font-size:.82rem;margin-bottom:16px}.crumb a{color:var(--green)}article{background:#fff;border:1px solid var(--line);border-radius:20px;padding:clamp(20px,4vw,42px)}.top{display:grid;grid-template-columns:minmax(240px,.85fr) minmax(0,1.15fr);gap:38px}.photo{width:100%;height:390px;object-fit:contain;background:#fafcfb;border-radius:14px}.eyebrow{color:var(--green);font-size:.75rem;text-transform:uppercase;letter-spacing:.09em;font-weight:900}h1{font-size:clamp(1.7rem,4vw,2.7rem);line-height:1.12;letter-spacing:-.04em;margin:9px 0 12px}.rating{color:#9b6000;font-weight:850}.summary{color:#43534b;font-size:1.03rem}.offer{background:#edf7f1;border:1px solid #cde4d5;border-radius:14px;padding:18px;margin-top:20px}.previous{display:block;color:#727b76;text-decoration:line-through;font-size:.86rem}.offer strong{display:block;color:#087a3d;font-size:1.25rem}.cta{display:flex;align-items:center;justify-content:center;margin-top:12px;background:var(--blue);color:#fff;padding:13px 17px;border-radius:9px;text-decoration:none;font-weight:900}.share-cta{width:100%;border:1px solid #9ab9a7;background:#fff;color:var(--green);padding:11px 15px;border-radius:9px;font:inherit;font-weight:850;cursor:pointer;margin-top:9px}.share-status{min-height:1.1em;color:var(--green);font-weight:800}.fine{font-size:.78rem;color:var(--muted);margin:9px 0 0}.facts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}.fact{border:1px solid var(--line);border-radius:10px;padding:12px}.fact span{display:block;color:var(--muted);font-size:.72rem;font-weight:850;text-transform:uppercase}.panels{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:26px}.panel{background:#fafcfb;border:1px solid var(--line);border-radius:13px;padding:20px}.panel h2{font-size:1.05rem;margin:0 0 8px}.positive h2{color:#267c31}.attention h2{color:#a94a16}.panel ul{padding-left:19px;margin:0}.source{margin-top:22px}.source a{color:var(--green)}footer{background:#10231c;color:#dfeae4;padding:30px 0;font-size:.82rem}footer a{color:#fff}@media(max-width:700px){.top,.panels{grid-template-columns:1fr}.photo{height:300px}.facts{grid-template-columns:1fr}header .wrap{padding:15px 0;align-items:flex-start}}</style>

  <script defer src="/growth-tools.js"></script>

  <script async src="https://www.googletagmanager.com/gtag/js?id=G-NBKRX8TTR6"></script>

  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-NBKRX8TTR6',{anonymize_ip:true});</script>

</head>

<body>

  <header><div class="wrap"><a class="brand" href="${SITE}">Ranking da Compra</a><a class="back" href="${SITE}#promocoes">Ver promoções do dia</a></div></header>

  <main class="wrap">

    <nav class="crumb" aria-label="Navegação estrutural"><a href="${SITE}">Início</a> / <a href="${SITE}?cat=${encodeURIComponent(product.categoria || "")}">${escapeHtml(categoryName)}</a> / ${escapeHtml(title)}</nav>

    <article><div class="top"><img class="photo" src="${escapeHtml(image)}" width="480" height="390" alt="${escapeHtml(title)}"><div><div class="eyebrow">Análise para decidir melhor</div><h1>${escapeHtml(title)}</h1>${editorial && Number.isFinite(rating) && rating >= 1 && rating <= 5 ? `<div class="rating">Custo-benefício editorial: ${"★".repeat(Math.round(rating))}${"☆".repeat(5 - Math.round(rating))} ${escapeHtml(rating.toFixed(1))} de 5 · <a href="${SITE}como-avaliamos.html">entenda a avaliação</a></div>` : ""}<p class="summary">${escapeHtml(summary)}</p><div class="offer">${priceHtml}${offerUrl !== "#" ? `<a class="cta" id="affiliate-offer" href="${escapeHtml(offerUrl)}" target="_blank" rel="sponsored noopener noreferrer">Comprar agora no Mercado Livre</a>` : ""}<button class="share-cta" id="share-product" type="button">↗ Compartilhar produto</button><p class="fine share-status" id="share-status" aria-live="polite"></p><p class="fine">${modified ? `Informações atualizadas em ${escapeHtml(new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(`${modified}T12:00:00-03:00`)))}. ` : ""}Preço, estoque, frete e condições finais são definidos pelo vendedor.</p></div><div class="facts"><div class="fact"><span>Categoria</span>${escapeHtml(categoryName)}</div><div class="fact"><span>Transparência</span>Link de afiliado identificado</div></div></div></div><div class="panels"><section class="panel positive"><h2>✓ Pontos positivos</h2><ul>${positiveHtml}</ul></section><section class="panel attention"><h2>! Pontos de atenção</h2><ul>${attentionHtml}</ul></section></div>${sourceUrl !== "#" ? `<p class="fine source">Fonte técnica consultada: <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="nofollow noopener noreferrer">anúncio do produto</a>. A equipe não afirma ter testado o item.</p>` : ""}</article>

  </main>

  <footer><div class="wrap"><b>Ranking da Compra</b> — escolhas mais claras para comprar melhor. Alguns links são de afiliados; podemos receber comissão sem custo adicional para você. <a href="${SITE}politica-afiliados.html">Entenda nossa política</a>.</div></footer>

  <script>document.getElementById('affiliate-offer')?.addEventListener('click',function(){gtag('event','select_item',{item_list_name:'pagina_produto',items:[{item_id:${JSON.stringify(product.id)},item_name:${JSON.stringify(title)}}],affiliate:'mercado_livre'})});document.getElementById('share-product')?.addEventListener('click',async function(){const status=document.getElementById('share-status'),data={title:${JSON.stringify(title)},text:${JSON.stringify(`Confira esta análise no Ranking da Compra: ${title}`)},url:${JSON.stringify(shareUrl)}};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.text+'\\n'+data.url);status.textContent='Texto e link copiados!'}gtag('event','share',{method:navigator.share?'system':'copy',content_type:'product',item_id:${JSON.stringify(product.id)}})}catch(error){if(error?.name!=='AbortError')status.textContent='Não foi possível compartilhar agora.'}});</script>

</body>

</html>

`;

}



function renderUrl(entry) {

  const lastModified = entry.lastModified

    ? `\n    <lastmod>${escapeXml(entry.lastModified)}</lastmod>` : "";

  return `  <url>\n    <loc>${escapeXml(entry.location)}</loc>${lastModified}\n    <changefreq>${entry.frequency}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`;

}



// As páginas dos produtos são prioridade. Categorias nunca podem bloquear sua criação.

let allProducts = [];

try {

  allProducts = await listCollection("produtos", 2);

} catch (error) {

  partialProductSource = true;

  console.warn("Produtos: limite temporário do Firebase detectado. " + String(error?.message || error));

  if (process.env.GITHUB_ACTIONS === "true") {
    allProducts = await listPublishedProducts();
  } else {
    try {
      allProducts = await listPublicOffers();
    } catch (publicError) {
      console.warn("Vitrine dinâmica indisponível: " + String(publicError?.message || publicError));
      allProducts = await listPublishedProducts();
    }
  }

}

const marketplaceProducts = await marketplaceStatus();



let allCategories = [];

try {

  await wait(1500);

  allCategories = await listCollection("categorias", 2);

} catch (error) {

  console.warn(

    "Categorias temporariamente indisponíveis; as páginas dos produtos continuarão sendo criadas. " +

    String(error?.message || error),

  );

  const categoryIds = [...new Set(

    allProducts.map((product) => String(product.categoria || "").trim()).filter(Boolean),

  )];

  allCategories = categoryIds.map((id) => ({

    id,

    nome: id.replace(/[-_]+/g, " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()),

    criadoEm: "",

  }));

}



// As páginas usadas por WhatsApp, Facebook e Instagram devem existir para todo

// produto ativo. As regras editoriais continuam valendo somente para o sitemap.

const rawShareProducts = allProducts

  .filter((product) => marketplaceProducts[product.id]?.visible !== false)

  .sort((a, b) => a.id.localeCompare(b.id));

function normalizedProductTitle(product) {
  const title = repairPortugueseEncoding(product?.titulo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return title || "id:" + String(product?.id || "");
}

function normalizedUrlIdentity(value) {
  try {
    const url = new URL(String(value || "").trim());
    url.hash = "";
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
      url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.hostname.toLowerCase() + url.pathname + (url.searchParams.size ? "?" + url.searchParams.toString() : "");
  } catch {
    return "";
  }
}

function productIdentityKeys(product) {
  const identityText = [
    product?.codigoMLB, product?.codigoMlb, product?.mlb, product?.idMLB,
    product?.link, product?.linkAfiliado, product?.dadosTecnicos,
  ].filter(Boolean).join(" ");
  const mlbKeys = [...identityText.matchAll(/\\bMLB[-_\\s]?(\\d{6,})\\b/gi)]
    .map((match) => "mlb:" + match[1]);
  const affiliate = normalizedUrlIdentity(product?.linkAfiliado);
  const source = normalizedUrlIdentity(product?.link);
  const stableKeys = [
    ...mlbKeys,
    affiliate ? "affiliate:" + affiliate : "",
    source ? "source:" + source : "",
  ].filter(Boolean);
  return [...new Set(stableKeys.length ? stableKeys : ["title:" + normalizedProductTitle(product)])];
}

function sanitizeEditorialSummary(value) {
  return repairPortugueseEncoding(value)
    .replace(/\b(?:comercializado|vendido|ofertado|disponível)\s+(?:pelo\s+)?(?:valor|preço)\s+de\s+R?\$?\s*[\d.,]+/gi, "com preço sujeito a alteração pelo vendedor")
    .replace(/\b(?:preço|valor)\s*(?:atual|informado)?\s*(?:de|:)\s*R\$\s*[\d.,]+/gi, "preço sujeito a alteração no anúncio")
    .replace(/\s+/g, " ")
    .trim();
}

function productCategoryName(product, categoryNames) {
  const normalizedTitle = normalizedProductTitle(product);
  if (/\b(?:bicicleta|bike)\b/.test(normalizedTitle)) return "Bicicletas";
  return categoryNames.get(product.categoria) || "Produtos";
}

function productSeoScore(product) {
  const updated = Math.max(
    0,
    Date.parse(product?.atualizadoEm || "") || 0,
    Date.parse(product?.dataCadastro || "") || 0,
  );
  const affiliate = String(product?.linkAfiliado || product?.link || "").startsWith("https://") ? 1 : 0;
  const image = absoluteImage(product?.foto) !== SITE + "og-ranking-da-compra.png" ? 1 : 0;
  return (promotionIsValid(product) ? 1e16 : 0) + affiliate * 1e15 + image * 1e14 + updated;
}

function deduplicateProducts(products) {
  const groups = new Set();
  const aliases = new Map();
  for (const product of products) {
    const keys = productIdentityKeys(product);
    const matchedGroups = [...new Set(keys.map((key) => aliases.get(key)).filter(Boolean))];
    let group = matchedGroups[0];
    if (!group) {
      group = { products: [], keys: new Set() };
      groups.add(group);
    } else {
      for (const other of matchedGroups.slice(1)) {
        if (other === group) continue;
        group.products.push(...other.products);
        for (const key of other.keys) {
          group.keys.add(key);
          aliases.set(key, group);
        }
        groups.delete(other);
      }
    }
    group.products.push(product);
    for (const key of keys) {
      group.keys.add(key);
      aliases.set(key, group);
    }
  }
  const selected = [...groups].map((group) => group.products.reduce((best, product) =>
    !best || productSeoScore(product) > productSeoScore(best) ? product : best, null));
  if (selected.length !== products.length) {
    console.warn(
      "SEO: " + (products.length - selected.length) +
      " produto(s) duplicado(s) do mesmo anúncio removido(s) das páginas e do sitemap.",
    );
  }
  return selected.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

const shareProducts = deduplicateProducts(rawShareProducts);
const products = shareProducts.filter(editorialProduct);

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

const categoryNames = new Map(allCategories.map((category) => [

  category.id,

  String(category.nome || category.id).replace(/air\s+frayer/gi, "Air Fryer"),

]));



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

  ...products.map((product) => ({

    location: productDetailUrl(product),

    lastModified: newestDate([product.atualizadoEm, product.dataCadastro]),

    frequency: promotionIsValid(product) ? "daily" : "weekly",

    priority: promotionIsValid(product) ? "0.9" : "0.7",

  })),

];



const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(renderUrl).join("\n")}\n</urlset>\n`;

await writeFile(resolve("sitemap.xml"), xml, "utf8");

if (partialProductSource) {
  console.warn("Sitemap reconstruído com segurança a partir das páginas de produto já publicadas.");
}



const productDirectory = resolve("produto");

const imageDirectory = resolve(productDirectory, "imagens");

await mkdir(imageDirectory, { recursive: true });



const validProducts = shareProducts.filter((product) => {

  const valid = /^[A-Za-z0-9_-]+$/.test(product.id);

  if (!valid) console.warn(`Página social ignorada por ID inválido: ${product.id}`);

  return valid;

});

let socialImages = partialProductSource
  ? new Map()
  : await cacheProductImages(validProducts, imageDirectory);

let pendingSocialImages = partialProductSource
  ? []
  : validProducts.filter((product) => !socialImages.get(product.id)?.fileName);

for (let repairAttempt = 1; pendingSocialImages.length && repairAttempt <= 2; repairAttempt += 1) {

  console.warn(`Autorreparo de fotos: tentativa ${repairAttempt}/2 para ${pendingSocialImages.length} produto(s).`);

  await wait(repairAttempt * 4000);

  const repairedImages = await cacheProductImages(pendingSocialImages, imageDirectory);

  for (const [productId, image] of repairedImages) socialImages.set(productId, image);

  pendingSocialImages = pendingSocialImages.filter((product) => !socialImages.get(product.id)?.fileName);

}

if (pendingSocialImages.length) {
  console.warn(
    `Fotos não armazenadas localmente para ${pendingSocialImages.map((product) => product.id).join(", ")}; ` +
    "usando a imagem remota ou a imagem padrão sem interromper a criação das páginas.",
  );
}



let weeklyTop = null;

if (!partialProductSource) {

  weeklyTop = await generateWeeklyTop(validProducts, socialImages);

  console.log("Top 6 semanal atualizado: " + weeklyTop.products.length + " produto(s), semana " + weeklyTop.weekStart + ".");

} else {

  console.warn("Top 6 semanal anterior preservado porque a fonte de produtos está parcial.");

}



const expectedPages = new Set();

for (const product of validProducts) {
  const fileName = `${product.id}-${SHARE_VERSION}.html`;
  expectedPages.add(fileName);

  if (!partialProductSource) {
    await writeFile(
      resolve(productDirectory, fileName),
      renderSharePage(product, socialImages.get(product.id), categoryNames),
      "utf8",
    );
  }
}

if (partialProductSource) {
  console.warn("Páginas de produto anteriores preservadas; nenhuma página foi sobrescrita pela contingência.");
}



if (!partialProductSource) {

  for (const entry of await readdir(productDirectory, { withFileTypes: true })) {

    if (entry.isFile() && entry.name.endsWith(".html") && !expectedPages.has(entry.name)) {

      await rm(resolve(productDirectory, entry.name), { force: true });

    }

  }

}

const expectedImages = new Set(

  [...socialImages.values()].map((image) => image.fileName).filter(Boolean),

);

if (!partialProductSource) {

  for (const entry of await readdir(imageDirectory, { withFileTypes: true })) {

    if (entry.isFile() && !expectedImages.has(entry.name)) {

      await rm(resolve(imageDirectory, entry.name), { force: true });

    }

  }

}



const locallyHostedImages = expectedImages.size;

console.log(

  `Sitemap e páginas sociais atualizados: ${urls.length} URLs (${products.length} produtos, ${categories.length} categorias e ${locallyHostedImages} fotos locais).`,

);


