import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const PROJECT_ID = "rankingdacompra";
const FIREBASE_API_KEY = "AIzaSyChRBmFfokCPPec7oTdC1u9obQg6M83Epk";
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE = "https://rankingdacompra.com.br/";
const SHARE_VERSION = "20260810-1";
const GENERIC_TEXT = /(chama aten[cç][aã]o por|recursos descritos no pr[oó]prio t[ií]tulo|informa[cç][oõ]es em atualiza[cç][aã]o|produto identificado no an[uú]ncio|oferta para comparar|conhe[cç]a este produto)/i;
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

async function listCollection(collection) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300", key: FIREBASE_API_KEY });
    if (pageToken) query.set("pageToken", pageToken);
    const requestUrl = FIRESTORE + "/" + collection + "?" + query;
    const response = await fetchFirestore(requestUrl, collection);
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

function editorialProduct(product) {
  const summary = String(product.comentario || "").replace(/\s+/g, " ").trim();
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

function money(value) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function editorialItems(value) {
  return String(value || "").split(/\n|;/).flatMap((part) => part.split(","))
    .map((part) => part.replace(/^[\s•✓!+-]+/, "").trim()).filter(Boolean).slice(0, 6);
}

function renderSharePage(product, socialImage, categoryNames) {
  const title = String(product.titulo || "Produto recomendado").replace(/\s+/g, " ").trim();
  const summary = String(product.comentario || "Confira a análise no Ranking da Compra.")
    .replace(/\s+/g, " ").trim();
  const description = `${title}: veja preço informado, pontos positivos e pontos de atenção antes de comprar.`.slice(0, 158);
  const image = socialImage?.url || absoluteImage(product.foto);
  const imageType = socialImage?.mime || "image/jpeg";
  const detailUrl = productDetailUrl(product);
  const shareUrl = productShareUrl(product);
  const offerUrl = safeExternalUrl(product.linkAfiliado || product.link);
  const sourceUrl = safeExternalUrl(product.link);
  const categoryName = categoryNames.get(product.categoria) || "Produtos";
  const positive = editorialItems(product.pros);
  const attention = editorialItems(product.contras);
  const editorial = editorialProduct(product);
  const promotional = promotionIsValid(product);
  const currentPrice = promotional ? numberPrice(product.precoPromocional) : numberPrice(product.preco);
  const previousPrice = promotional ? numberPrice(product.precoAnterior) : 0;
  const modified = newestDate([product.atualizadoEm, product.dataCadastro]);
  const rating = Number(product.nota);
  const productSchema = { "@type": "Product", "@id": `${detailUrl}#product`, name: title, description: summary, image: [image], category: categoryName, url: detailUrl };
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
  const positiveHtml = positive.length ? positive.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>Confira a análise completa acima.</li>";
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
  <title>${escapeHtml(title)}: preço, prós e contras | Ranking da Compra</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(detailUrl)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Ranking da Compra">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:url" content="${escapeHtml(shareUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
  <meta property="og:image:type" content="${escapeHtml(imageType)}">
  <meta property="og:image:alt" content="Foto de ${escapeHtml(title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta name="theme-color" content="#0f3d2e">
  <script type="application/ld+json">${structuredData}</script>
  <style>:root{--green:#116149;--ink:#11221d;--muted:#66746d;--line:#dfe7e2;--cream:#fbfaf5;--blue:#1769e0}*{box-sizing:border-box}body{font-family:Inter,Segoe UI,Arial,sans-serif;background:var(--cream);color:var(--ink);margin:0;line-height:1.55}a{color:inherit}.wrap{width:min(1040px,calc(100% - 32px));margin:auto}header{background:#fff;border-bottom:1px solid var(--line)}header .wrap{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{color:var(--green);font-weight:900;text-decoration:none}.back{color:var(--green);font-weight:750;text-decoration:none;font-size:.9rem}main{padding:30px 0 56px}.crumb{color:var(--muted);font-size:.82rem;margin-bottom:16px}.crumb a{color:var(--green)}article{background:#fff;border:1px solid var(--line);border-radius:20px;padding:clamp(20px,4vw,42px)}.top{display:grid;grid-template-columns:minmax(240px,.85fr) minmax(0,1.15fr);gap:38px}.photo{width:100%;height:390px;object-fit:contain;background:#fafcfb;border-radius:14px}.eyebrow{color:var(--green);font-size:.75rem;text-transform:uppercase;letter-spacing:.09em;font-weight:900}h1{font-size:clamp(1.7rem,4vw,2.7rem);line-height:1.12;letter-spacing:-.04em;margin:9px 0 12px}.rating{color:#9b6000;font-weight:850}.summary{color:#43534b;font-size:1.03rem}.offer{background:#edf7f1;border:1px solid #cde4d5;border-radius:14px;padding:18px;margin-top:20px}.previous{display:block;color:#727b76;text-decoration:line-through;font-size:.86rem}.offer strong{display:block;color:#087a3d;font-size:1.25rem}.cta{display:flex;align-items:center;justify-content:center;margin-top:12px;background:var(--blue);color:#fff;padding:13px 17px;border-radius:9px;text-decoration:none;font-weight:900}.share-cta{width:100%;border:1px solid #9ab9a7;background:#fff;color:var(--green);padding:11px 15px;border-radius:9px;font:inherit;font-weight:850;cursor:pointer;margin-top:9px}.share-status{min-height:1.1em;color:var(--green);font-weight:800}.fine{font-size:.78rem;color:var(--muted);margin:9px 0 0}.facts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}.fact{border:1px solid var(--line);border-radius:10px;padding:12px}.fact span{display:block;color:var(--muted);font-size:.72rem;font-weight:850;text-transform:uppercase}.panels{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:26px}.panel{background:#fafcfb;border:1px solid var(--line);border-radius:13px;padding:20px}.panel h2{font-size:1.05rem;margin:0 0 8px}.positive h2{color:#267c31}.attention h2{color:#a94a16}.panel ul{padding-left:19px;margin:0}.source{margin-top:22px}.source a{color:var(--green)}footer{background:#10231c;color:#dfeae4;padding:30px 0;font-size:.82rem}footer a{color:#fff}@media(max-width:700px){.top,.panels{grid-template-columns:1fr}.photo{height:300px}.facts{grid-template-columns:1fr}header .wrap{padding:15px 0;align-items:flex-start}}</style>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-NBKRX8TTR6"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-NBKRX8TTR6',{anonymize_ip:true});</script>
</head>
<body>
  <header><div class="wrap"><a class="brand" href="${SITE}">Ranking da Compra</a><a class="back" href="${SITE}#promocoes">Ver promoções do dia</a></div></header>
  <main class="wrap">
    <nav class="crumb" aria-label="Navegação estrutural"><a href="${SITE}">Início</a> / <a href="${SITE}?cat=${encodeURIComponent(product.categoria || "")}">${escapeHtml(categoryName)}</a> / ${escapeHtml(title)}</nav>
    <article><div class="top"><img class="photo" src="${escapeHtml(image)}" width="480" height="390" alt="${escapeHtml(title)}"><div><div class="eyebrow">Análise para decidir melhor</div><h1>${escapeHtml(title)}</h1>${editorial && Number.isFinite(rating) && rating >= 1 && rating <= 5 ? `<div class="rating">Nota editorial: ${"★".repeat(Math.round(rating))}${"☆".repeat(5 - Math.round(rating))} ${escapeHtml(rating.toFixed(1))} de 5</div>` : ""}<p class="summary">${escapeHtml(summary)}</p><div class="offer">${priceHtml}${offerUrl !== "#" ? `<a class="cta" id="affiliate-offer" href="${escapeHtml(offerUrl)}" target="_blank" rel="sponsored noopener noreferrer">Ver preço atual no Mercado Livre</a>` : ""}<button class="share-cta" id="share-product" type="button">↗ Compartilhar produto</button><p class="fine share-status" id="share-status" aria-live="polite"></p><p class="fine">${modified ? `Informações atualizadas em ${escapeHtml(new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(`${modified}T12:00:00-03:00`)))}. ` : ""}Preço, estoque, frete e condições finais são definidos pelo vendedor.</p></div><div class="facts"><div class="fact"><span>Categoria</span>${escapeHtml(categoryName)}</div><div class="fact"><span>Transparência</span>Link de afiliado identificado</div></div></div></div><div class="panels"><section class="panel positive"><h2>✓ Pontos positivos</h2><ul>${positiveHtml}</ul></section><section class="panel attention"><h2>! Pontos de atenção</h2><ul>${attentionHtml}</ul></section></div>${sourceUrl !== "#" ? `<p class="fine source">Fonte técnica consultada: <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="nofollow noopener noreferrer">anúncio do produto</a>. A equipe não afirma ter testado o item.</p>` : ""}</article>
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

// Consulta uma coleção por vez para evitar o limite temporário HTTP 429 do Firebase.
const allCategories = await listCollection("categorias");
await wait(1500);
const allProducts = await listCollection("produtos");
const marketplaceProducts = await marketplaceStatus();

// As páginas usadas por WhatsApp, Facebook e Instagram devem existir para todo
// produto ativo. As regras editoriais continuam valendo somente para o sitemap.
const shareProducts = allProducts
  .filter((product) => marketplaceProducts[product.id]?.visible !== false)
  .sort((a, b) => a.id.localeCompare(b.id));
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
  ...categories.map((category) => ({
    location: `${SITE}?cat=${encodeURIComponent(CATEGORY_ALIASES.get(category.id) || category.id)}`,
    lastModified: newestDate([
      category.criadoEm,
      ...(productsByCategory.get(category.id) || []).flatMap((product) => [product.atualizadoEm, product.dataCadastro]),
    ]),
    frequency: "weekly",
    priority: "0.8",
  })),
  ...products.map((product) => ({
    location: productDetailUrl(product),
    lastModified: newestDate([product.atualizadoEm, product.dataCadastro]),
    frequency: promotionIsValid(product) ? "daily" : "weekly",
    priority: promotionIsValid(product) ? "0.9" : "0.7",
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(renderUrl).join("\n")}\n</urlset>\n`;
await writeFile(resolve("sitemap.xml"), xml, "utf8");

const productDirectory = resolve("produto");
const imageDirectory = resolve(productDirectory, "imagens");
await mkdir(imageDirectory, { recursive: true });

const validProducts = shareProducts.filter((product) => {
  const valid = /^[A-Za-z0-9_-]+$/.test(product.id);
  if (!valid) console.warn(`Página social ignorada por ID inválido: ${product.id}`);
  return valid;
});
const socialImages = await cacheProductImages(validProducts, imageDirectory);
const expectedPages = new Set();
for (const product of validProducts) {
  const fileName = `${product.id}-${SHARE_VERSION}.html`;
  expectedPages.add(fileName);
  await writeFile(
    resolve(productDirectory, fileName),
    renderSharePage(product, socialImages.get(product.id), categoryNames),
    "utf8",
  );
}

for (const entry of await readdir(productDirectory, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".html") && !expectedPages.has(entry.name)) {
    await rm(resolve(productDirectory, entry.name), { force: true });
  }
}
const expectedImages = new Set(
  [...socialImages.values()].map((image) => image.fileName).filter(Boolean),
);
for (const entry of await readdir(imageDirectory, { withFileTypes: true })) {
  if (entry.isFile() && !expectedImages.has(entry.name)) {
    await rm(resolve(imageDirectory, entry.name), { force: true });
  }
}

const locallyHostedImages = expectedImages.size;
console.log(
  `Sitemap e páginas sociais atualizados: ${urls.length} URLs (${products.length} produtos, ${categories.length} categorias e ${locallyHostedImages} fotos locais).`,
);
