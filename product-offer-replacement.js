(function (root) {
  "use strict";
  function millis(value) {
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    return Date.parse(value || "");
  }
  function url(value, affiliate = false) {
    try {
      const parsed = new URL(String(value || "").trim());
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port
        || parsed.href.length > 1000) return null;
      const domains = affiliate ? ["mercadolivre.com.br", "mercadolibre.com", "meli.la"] : ["mercadolivre.com.br"];
      return domains.some(domain => parsed.hostname === domain || parsed.hostname.endsWith("." + domain)) ? parsed : null;
    } catch { return null; }
  }
  function listing(value) {
    const parsed = url(value, true);
    if (!parsed) return "";
    const values = [parsed.searchParams.get("item_id"), parsed.searchParams.get("wid"),
      parsed.searchParams.get("pdp_filters"), new URLSearchParams(parsed.hash.slice(1)).get("wid"),
      /\/p\/MLB\d+/i.test(parsed.pathname) ? "" : parsed.pathname];
    const ids = [...new Set(values.flatMap(value => [...String(value || "").matchAll(/MLB-?(\d{6,})/gi)].map(match => "MLB" + match[1])))];
    if (ids.length > 1) throw new Error("O link contém códigos de anúncios diferentes. Cole o endereço do anúncio escolhido.");
    return ids[0] || "";
  }
  function validate(product, input) {
    if (input.sameProduct !== true) throw new Error("Confirme que é exatamente o mesmo produto, modelo e versão. Para outro produto, use um novo cadastro.");
    const source = url(input.link), affiliate = url(input.linkAfiliado, true);
    if (!source) throw new Error("Cole o link completo HTTPS do novo anúncio no Mercado Livre, não o link curto de afiliado.");
    if (!affiliate) throw new Error("Cole um link de afiliado HTTPS válido do Mercado Livre, gerado pela sua conta.");
    if (source.href === affiliate.href) throw new Error("Informe o link de afiliado, não repita o link comum do anúncio.");
    const itemId = listing(source.href), affiliateId = listing(affiliate.href);
    if (itemId && affiliateId && itemId !== affiliateId) throw new Error("Os dois links apontam para anúncios diferentes. Gere o link de afiliado do anúncio escolhido.");
    if (source.href === String(product.link || "").trim() && affiliate.href === String(product.linkAfiliado || "").trim()) {
      throw new Error("Os links continuam iguais. Cole os novos links ou cancele.");
    }
    return { link: source.href, linkAfiliado: affiliate.href, mercadoLivreItemId: itemId || affiliateId };
  }
  function previousOffer(product, replacedAt) {
    // Archive the source and its proof, not the product's analysis or identity.
    const fields = ["link", "linkAfiliado", "mercadoLivreItemId", "preco", "precoAnterior", "precoPromocional",
      "precoAtualizadoManualmente", "precoAtualizadoManualmenteEm", "precoConferenciaId", "precoConferidoPor",
      "precoProvaVersao", "precoProvaAnuncio", "precoConferenciaIAFonte", "precoConferenciaIAEvidencia",
      "precoConferenciaIATitulo", "promocaoAtiva", "ofertaRelampagoAtiva", "anuncioSubstituidoEm"];
    return { substituidoEm: replacedAt, ...Object.fromEntries(fields.filter(field => product[field] !== undefined).map(field => [field, product[field]])) };
  }
  function buildPatch(product, input, replacedAt) {
    const links = validate(product, input);
    return { ...links, anuncioSubstituidoEm: replacedAt,
      precoAtualizadoManualmente: false, precoAtualizadoManualmenteEm: null, precoConferenciaId: "",
      precoConferidoPor: "", precoProvaVersao: 0, precoProvaAnuncio: "", precoConferenciaIAFonte: "",
      precoConferenciaIAEvidencia: "", precoConferenciaIATitulo: "",
      promocaoAtiva: false, ofertaRelampagoAtiva: false };
  }
  function statusFor(product, status) {
    if (!product?.anuncioSubstituidoEm || !status) return status || null;
    const replaced = millis(product.anuncioSubstituidoEm), checked = millis(status.checkedAt);
    // A result from the old offer is neither a price nor an availability proof for the new one.
    return Number.isFinite(replaced) && Number.isFinite(checked) && checked > replaced ? status : null;
  }
  const api = { validate, listing, previousOffer, buildPatch, statusFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RDCOfferReplacement = api;
})(typeof window === "undefined" ? globalThis : window);
