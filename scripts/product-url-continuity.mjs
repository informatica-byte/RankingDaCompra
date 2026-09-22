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
  ${head}
  <style>body{font:16px/1.5 system-ui,sans-serif;background:#f7faf8;color:#12392d;margin:0}main{max-width:680px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #d9e8df;border-radius:18px}a{color:#075a3b;font-weight:700}h1{line-height:1.2}</style>
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

export function unavailableProductPage(previousHtml) {
  const oldTitle = String(previousHtml || "").match(/<title>([^<]*)<\/title>/i)?.[1] || "Produto anteriormente analisado";
  const title = oldTitle.replace(/:\s*R\$[\s\S]*$/i, "").replace(/\s*[|—-]\s*Ranking da Compra.*$/i, "").trim();
  return pageShell(
    "Análise não disponível",
    `<link rel="canonical" href="${SITE}analises.html">`,
    `<h1>Esta análise não está disponível</h1><p>${escapeHtml(title || "O produto consultado")} não consta na seleção atual. O preço e o anúncio antigos não são exibidos porque podem estar desatualizados.</p><p><a href="${SITE}analises.html">Ver análises e produtos atuais →</a></p>`,
  );
}
