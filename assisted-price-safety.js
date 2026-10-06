(function (root) {
  "use strict";
  const MIN_VERSION = "2.1.0";
  function robotReady(info) {
    if (!/^\d+\.\d+\.\d+$/.test(String(info?.version || ""))) return false;
    const version = String(info.version).split(".").map(Number);
    return info?.ready === true && version.length === 3 && version.every(Number.isFinite)
      && (version[0] > 2 || (version[0] === 2 && version[1] >= 1));
  }
  function identity(raw) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || !/(^|\.)mercadolivre\.com\.br$/i.test(url.hostname)) return null;
      const listing = (url.searchParams.get("pdp_filters") || "").match(/item_id:(MLB\d+)/i)?.[1]
        || url.pathname.match(/(?:^|\/)MLB-(\d+)/i)?.[0]?.replace(/^\//, "").replace("-", "");
      return { key: String(listing || url.pathname.match(/\/p\/(MLB\d+)/i)?.[1] || url.hostname + url.pathname).toUpperCase(), variation: url.searchParams.get("searchVariation") || "" };
    } catch { return null; }
  }
  function validate(result, { produtoId, url, previousPrice = 0, now = Date.now() }) {
    const requested = identity(url), found = identity(result?.fonteConsultada);
    if (!robotReady({ version: result?.robotVersion, ready: true }) || result?.proofVersion !== 1) return "Atualize o robô para a versão 2.1.0 ou superior e recarregue o painel.";
    if (result.status !== "ok" || result.produtoId !== produtoId || result.requestedUrl !== url || !result.requestId) return "Resposta não pertence a este produto ou pedido. Preço preservado.";
    if (!requested || !found || requested.key !== found.key || result.offerKey !== found.key || (requested.variation && requested.variation !== found.variation)) return "O anúncio ou a variação não corresponde ao cadastro. Confira manualmente.";
    const value = result.preco;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || result.mainPrice !== value || result.currency !== "BRL" || result.priceSelector !== ".ui-pdp-price__second-line .andes-money-amount" || !result.evidencia) return "Preço principal sem comprovação. Confira manualmente.";
    if (!Array.isArray(result.structuredPrices) || result.structuredPrices.some(p => typeof p !== "number" || !Number.isFinite(p) || Math.abs(p - value) > 0.005)) return "Preço visível e dados do anúncio não concordam. Confira manualmente.";
    if (!Number.isFinite(result.checkedAt) || result.checkedAt > now + 5000 || now - result.checkedAt > 120000) return "Resposta antiga: o preço não foi salvo. Consulte novamente.";
    if (previousPrice > 0 && Math.abs(value - previousPrice) / previousPrice >= 0.35) return "Mudança de 35% ou mais: confirme o valor manualmente no anúncio. O robô preservou o cadastro.";
    return "";
  }
  root.RDCAssistedPriceSafety = { MIN_VERSION, robotReady, identity, validate };
})(typeof window !== "undefined" ? window : globalThis);
