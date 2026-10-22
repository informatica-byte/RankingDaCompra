const SITE = "https://rankingdacompra.com.br/";

export function selectCanonicalProducts(groups, scoreProduct) {
  const aliases = new Map();
  const selected = [...groups].map((group) => {
    const best = group.products.reduce((winner, product) =>
      !winner || scoreProduct(product) > scoreProduct(winner) ? product : winner, null);
    for (const product of group.products) {
      if (product.id !== best.id) aliases.set(product.id, best);
    }
    return best;
  });
  return { selected, aliases };
}

// Somente caminhos antigos observados e o mesmo cadastro (ou seu duplicado
// comprovado). Um produto retirado nunca é redirecionado à vitrine genérica.
export function legacyProductAliases(registry, validProducts, duplicateAliases = new Map()) {
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    throw new Error("Registro de endereços antigos inválido");
  }
  const byId = new Map(validProducts.map(product => [product.id, product]));
  const aliases = new Map();
  for (const [fileName, entry] of Object.entries(registry)) {
    const proof=typeof entry==='object' && entry!==null && !Array.isArray(entry)?entry:null;
    const id=proof?proof.id:entry;
    if (!/^[A-Za-z0-9_-]+\.html$/.test(fileName) || typeof id !== "string" || !/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new Error("Endereço antigo ou cadastro inválido");
    }
    const candidate = byId.get(id) || duplicateAliases.get(id);
    const target = candidate && byId.get(candidate.id);
    if (proof) {
      if (!/^MLB\d{6,}$/.test(proof.itemId||'') || !Array.isArray(proof.modelWords) || !proof.modelWords.length || proof.modelWords.some(word=>typeof word!=='string'||!/^[a-z0-9]+$/.test(word))) throw new Error('Prova de identidade do endereço antigo inválida');
      if (!target || !sameHistoricalOffer(target,proof)) continue;
    }
    if (target) aliases.set(fileName, target);
  }
  return aliases;
}

function sameHistoricalOffer(product,proof) {
  const title=String(product.titulo||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ');
  if (!proof.modelWords.every(word=>title.split(/\s+/).includes(word))) return false;
  try {
    const url=new URL(String(product.link||''));
    if (url.protocol!=='https:' || !/(?:^|\.)mercadolivre\.com\.br$/i.test(url.hostname)) return false;
    const evidence=decodeURIComponent(url.pathname+' '+url.search+' '+url.hash).replace(/MLB-/gi,'MLB');
    return [...evidence.matchAll(/\bMLB\d{6,}\b/gi)].some(match=>match[0].toUpperCase()===proof.itemId);
  } catch {return false;}
}

// Descobre somente versões que realmente existem no diretório publicado.
// A alteração da versão de compartilhamento não deve aposentar a análise do
// mesmo cadastro que continua publicável. IDs retirados continuam sem destino.
export function observedProductAliases(fileNames, validProducts, duplicateAliases = new Map()) {
  if (!Array.isArray(fileNames)) throw new Error("Lista de páginas antigas inválida");
  const registry = {};
  for (const fileName of fileNames) {
    if (typeof fileName !== "string" || /[\\/]/.test(fileName)) throw new Error("Página antiga inválida");
    const match = fileName.match(/^([A-Za-z0-9_-]+)-\d{8}-\d+\.html$/);
    if (match) registry[fileName] = match[1];
  }
  return legacyProductAliases(registry, validProducts, duplicateAliases);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeProductUrl(value) {
  const url = new URL(String(value || ""));
  if (url.origin !== new URL(SITE).origin || !/^\/produto\/[A-Za-z0-9_-]+\.html$/.test(url.pathname)) {
    throw new Error("Destino de produto inválido para página antiga");
  }
  return url.href;
}

function pageShell(title, head, body) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <title>${escapeHtml(title)} | Ranking da Compra</title>
${head ? `  ${head}` : ""}
  <style>*{box-sizing:border-box}body{font:16px/1.5 system-ui,sans-serif;background:#f7faf8;color:#12392d;margin:0}main{max-width:680px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #d9e8df;border-radius:18px;overflow-wrap:anywhere}a{color:#075a3b;font-weight:700}h1{line-height:1.2}form{display:grid;gap:10px;margin:24px 0;min-width:0}input,button{font:inherit;padding:12px;border:1px solid #b9cfc2;border-radius:8px;min-width:0;max-width:100%}button{background:#075a3b;color:#fff;font-weight:700;cursor:pointer}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #e2b63b;outline-offset:3px}@media(max-width:720px){main{margin:24px 12px;padding:22px}}</style>
</head>
<body><main>${body}</main></body>
</html>
`;
}

export function productAliasPage(title, canonicalUrl) {
  const target = safeProductUrl(canonicalUrl);
  const safeTarget = escapeHtml(target);
  return pageShell(
    "Análise atualizada",
    `<link rel="canonical" href="${safeTarget}"><meta http-equiv="refresh" content="0;url=${safeTarget}">`,
    `<h1>Esta análise foi atualizada</h1><p>O produto ${escapeHtml(title || "consultado")} agora tem uma página principal para evitar informações duplicadas.</p><p><a href="${safeTarget}">Abrir a análise atualizada →</a></p>`,
  );
}

function decodeTitleEntities(value) {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return String(value || "").replace(/&(?:#(\d+)|#x([a-f\d]+)|(amp|quot|apos|lt|gt|nbsp));/gi, (entity, decimal, hexadecimal, name) => {
    if (name) return named[name.toLowerCase()];
    const point = parseInt(decimal || hexadecimal, decimal ? 10 : 16);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : entity;
  });
}

// Guarda somente o nome para a recuperação do visitante, nunca o anúncio,
// preço ou detalhes comerciais. A próxima publicação pode reutilizar o stub
// sem substituir esse nome pelo título genérico "Análise não disponível".
export function retiredProductTitle(previousHtml) {
  const html = String(previousHtml || "");
  let savedTitle = "";
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = new Map([...tag[0].matchAll(/([\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(match => [match[1].toLowerCase(), match[3]]));
    if (attributes.get("name") === "rdc-retired-product-title") {
      savedTitle = attributes.get("content") || "";
      break;
    }
  }
  const oldTitle = savedTitle || html.match(/<title>([^<]*)<\/title>/i)?.[1] || "";
  let title = decodeTitleEntities(oldTitle)
    .replace(/\s*[|—-]\s*Ranking da Compra.*$/i, "")
    .replace(/:\s*R\$[\s\S]*$/i, "")
    .replace(/\s*R\$\s*[\d.,]+/gi, "")
    .replace(/\s+/g, " ").trim();
  if (/^(?:Análise não disponível|Esta análise não está disponível|Produto anteriormente analisado)$/i.test(title)) title = "";
  return Array.from(title).slice(0, 200).join("");
}

export function unavailableProductPage(previousHtml) {
  const title = retiredProductTitle(previousHtml);
  return pageShell(
    "Análise não disponível",
    title ? `<meta name="rdc-retired-product-title" content="${escapeHtml(title)}">` : "",
    `<h1>Esta análise não está disponível</h1><p>${escapeHtml(title || "O produto consultado")} não consta na seleção atual. O preço e o anúncio antigos não são exibidos porque podem estar desatualizados.</p><p>Este endereço não representa uma oferta atual. Você pode pesquisar outro anúncio ou comparar opções disponíveis, sem assumir que são o mesmo produto.</p><form action="${SITE}" method="get"><label for="retired-product-search">Buscar produtos e análises atuais</label><input id="retired-product-search" name="busca" type="search" value="${escapeHtml(title)}" placeholder="Nome ou tipo de produto" maxlength="200"><button type="submit">Buscar opções atuais</button></form><p><a href="${SITE}analises.html">Ver todas as análises atuais →</a></p>`,
  );
}

// Pause is an administrator's reversible decision, not proof that a seller's
// listing was deleted. Keep the same address without a stale price or redirect.
export function pausedProductPage(product) {
  const title = String(product?.titulo || '').trim();
  return pageShell('Anúncio em pausa',
    `<meta name="rdc-paused-product" content="true">`,
    `<h1>Anúncio em pausa</h1><p>${escapeHtml(title || 'O produto consultado')} está separado para revisão no Ranking da Compra.</p><p>O cadastro foi preservado. Enquanto estiver pausado, não exibimos preço ou botão de compra como oferta atual. Isso não confirma que o vendedor excluiu o anúncio.</p><p><a href="${SITE}analises.html">Consultar análises atuais →</a></p>`);
}
