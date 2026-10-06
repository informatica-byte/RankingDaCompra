(function (root) {
  "use strict";
  const MIN_VERSION = "2.2.0";
  function robotReady(info) {
    if (!/^\d+\.\d+\.\d+$/.test(String(info?.version || ""))) return false;
    const version = String(info.version).split(".").map(Number);
    return info?.ready === true && version.length === 3 && version.every(Number.isFinite)
      && (version[0] > 2 || (version[0] === 2 && version[1] >= 2));
  }
  function identity(raw) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" || !/(^|\.)mercadolivre\.com\.br$/i.test(url.hostname)) return null;
      const item = value => String(value || "").match(/^MLB-?(\d{6,})$/i)?.[1];
      const hash = new URLSearchParams(url.hash.slice(1));
      const ids = [(url.searchParams.get("pdp_filters") || "").match(/(?:^|[|,])item_id:(MLB-?\d+)/i)?.[1],
        url.pathname.match(/(?:^|\/)(MLB-\d+)/i)?.[1], url.searchParams.get("wid"), hash.get("wid")]
        .filter(Boolean).map(item);
      if (ids.some(id => !id) || new Set(ids).size > 1) return null;
      const listing = ids[0] ? "MLB" + ids[0] : "";
      const catalog = url.pathname.match(/\/p\/(MLB\d+)/i)?.[1]?.toUpperCase() || "";
      return { key: String(listing || catalog || url.hostname + url.pathname).toUpperCase(), listing, catalog,
        variation: url.searchParams.get("searchVariation") || "", attributes: url.searchParams.get("attributes") || "" };
    } catch { return null; }
  }
  function normalized(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function colors(value) {
    const aliases = { branca: "branco", preta: "preto", vermelha: "vermelho", amarela: "amarelo", roxa: "roxo", dourada: "dourado" };
    return [...new Set(normalized(value).split(/\s+/).map(word => aliases[word] || word)
      .filter(word => /^(branco|preto|azul|vermelho|verde|amarelo|bege|cinza|prata|dourado|rosa|roxo|marrom|laranja|transparente)$/.test(word)))];
  }
  function variantMismatch(title, attributes) {
    if (!Array.isArray(attributes) || attributes.some(a => !a || typeof a.name !== "string" || typeof a.value !== "string" || !a.value.trim() || /\b(escolha|selecione|selecionar)\b/.test(normalized(a.value)))) return "Selecione e confirme a variação no anúncio. Preço preservado.";
    const color = attributes.filter(a => /^cor(?:es)?$/.test(normalized(a.name)));
    const expectedColors = colors(title);
    if (expectedColors.length && (!color.length || color.some(a => expectedColors.some(c => !colors(a.value).includes(c))))) return "A cor selecionada não corresponde ao cadastro ou não foi comprovada. Confira manualmente.";
    const expectedSize = normalized(title).match(/\b(?:tamanho|tam|numero|numeracao)\s+(\d{1,3}|x{0,3}[pmg]{1,3})\b/)?.[1];
    if (expectedSize && !attributes.some(a => /^tamanho|numeracao/.test(normalized(a.name)) && normalized(a.value).split(/\s+/).includes(expectedSize))) return "O tamanho selecionado não corresponde ao cadastro. Confira manualmente.";
    const voltages = normalized(title).match(/\b(?:110|127|220|240)\s*v\b/g) || [];
    const voltage = attributes.filter(a => /voltagem|tensao/.test(normalized(a.name)));
    if (voltage.length && voltages.some(v => voltage.some(a => !normalized(a.value).replace(/\s/g, "").includes(v.replace(/\s/g, ""))))) return "A voltagem selecionada não corresponde ao cadastro. Confira manualmente.";
    const modelCodes = normalized(title).split(/\s+/).filter(word => /[a-z]/.test(word) && /\d/.test(word)
      && !/^\d+(?:v|w|kw|gb|tb|mb|mm|cm|ml|l|kg|g|cc|mah|ah|hz|khz|mhz|ghz|bar|psi|btus?|g)$/.test(word));
    const models = attributes.filter(a => /^modelo(?: detalhado| alfanumerico)?$/.test(normalized(a.name)));
    if (modelCodes.length && models.length && modelCodes.some(code => !models.some(a => normalized(a.value).split(/\s+/).includes(code)))) return "O modelo selecionado não corresponde ao cadastro. Confira manualmente.";
    return "";
  }
  function validate(result, { produtoId, url, titulo, previousPrice = 0, now = Date.now() }) {
    const requested = identity(url), found = identity(result?.fonteConsultada);
    if (!robotReady({ version: result?.robotVersion, ready: true }) || result?.proofVersion !== 2) return "Atualize o robô para a versão 2.2.0 ou superior e recarregue o painel.";
    if (result.status !== "ok" || result.produtoId !== produtoId || result.requestedUrl !== url || !result.requestId) return "Resposta não pertence a este produto ou pedido. Preço preservado.";
    if (!requested || !found || requested.key !== found.key || result.offerKey !== found.key || (requested.variation && requested.variation !== found.variation)
      || (requested.attributes && requested.attributes !== found.attributes)) return "O anúncio ou a variação não corresponde ao cadastro. Confira manualmente.";
    const proof = result.variantProof;
    if (!titulo || !proof || proof.expectedTitle !== titulo || proof.verified !== true || !/^MLB\d{6,}$/.test(proof.listingId || "")
      || (requested.listing && proof.listingId !== requested.listing) || (found.listing && proof.listingId !== found.listing)
      || (requested.variation && proof.selectedVariation !== requested.variation)
      || (requested.attributes && proof.selectedAttributes !== requested.attributes)) return "O anúncio e a variante selecionada não foram comprovados. Preço preservado.";
    const mismatch = variantMismatch(titulo, proof.attributes);
    if (mismatch) return mismatch;
    const value = result.preco;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || result.mainPrice !== value || result.currency !== "BRL" || result.priceSelector !== ".ui-pdp-price__second-line .andes-money-amount" || !result.evidencia) return "Preço principal sem comprovação. Confira manualmente.";
    if (!Array.isArray(result.structuredPrices) || result.structuredPrices.some(p => typeof p !== "number" || !Number.isFinite(p) || Math.abs(p - value) > 0.005)) return "Preço visível e dados do anúncio não concordam. Confira manualmente.";
    if (!Number.isFinite(result.checkedAt) || result.checkedAt > now + 5000 || now - result.checkedAt > 120000) return "Resposta antiga: o preço não foi salvo. Consulte novamente.";
    if (previousPrice > 0 && Math.abs(value - previousPrice) / previousPrice >= 0.35) return "Mudança de 35% ou mais: confirme o valor manualmente no anúncio. O robô preservou o cadastro.";
    return "";
  }
  root.RDCAssistedPriceSafety = { MIN_VERSION, robotReady, identity, variantMismatch, validate };
})(typeof window !== "undefined" ? window : globalThis);
