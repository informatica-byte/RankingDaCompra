(function (root) {
  "use strict";
  const MIN_VERSION = "2.4.1";
  function robotReady(info) {
    if (!/^\d+\.\d+\.\d+$/.test(String(info?.version || ""))) return false;
    const version = String(info.version).split(".").map(Number);
    const minimum = MIN_VERSION.split(".").map(Number);
    if (info?.ready !== true || !version.every(Number.isFinite)) return false;
    for (let index = 0; index < minimum.length; index++) {
      if (version[index] !== minimum[index]) return version[index] > minimum[index];
    }
    return true;
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
    const aliases = { branca: "branco", preta: "preto", vermelha: "vermelho", amarela: "amarelo", roxa: "roxo", dourada: "dourado", black: "preto", white: "branco" };
    return [...new Set(normalized(value).split(/\s+/).map(word => aliases[word] || word)
      .filter(word => /^(branco|preto|azul|vermelho|verde|amarelo|bege|cinza|prata|dourado|rosa|roxo|marrom|laranja|transparente)$/.test(word)))];
  }
  function matchingProduct(expectedTitle, foundTitle) {
    // Mesmo contrato do userscript: bloquear contradição explícita, não ficha
    // incompleta nem números de desconto/frete/prazo do texto promocional.
    const numericFeatures = value => {
      const text = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/(?<=\d),(?=\d)/g, ".");
      const features = new Map();
      const add = (name, number) => {
        if (!features.has(name)) features.set(name, new Set());
        features.get(name).add(String(Number(number)));
      };
      for (const match of text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:polegadas?\b|pol\b|inch(?:es)?\b|["\u2033])/g)) add("tela", match[1]);
      for (const match of text.matchAll(/\b(?:monitor|televisor|smart\s*tv|tv|tela)((?:\s+[a-z]+){0,4})\s+(\d{2}(?:\.\d+)?)(?![a-z0-9%])/g)) {
        if (!/promocao|oferta|desconto|cupom|frete|prazo/.test(match[1])) add("tela", match[2]);
      }
      for (const match of text.matchAll(/\b(iphone|ipad|airpods|ryzen|instax|forerunner|fenix|hero|playstation|redmi(?:\s+note)?|vivobook\s+go)\s+(\d+(?:\.\d+)?)(?![a-z0-9])/g)) add(match[1].replace(/\s+/g, " "), match[2]);
      for (const match of text.matchAll(/\b(ipad|airpods)\s+(?:pro|max|mini|air)\s+(\d+(?:\.\d+)?)(?![a-z0-9])/g)) add(match[1], match[2]);
      for (const match of text.matchAll(/\b(\d+)(?:a|o|\u00aa|\u00ba)?\s*(?:geracao|generation)\b/g)) add("geracao", match[1]);
      for (const match of text.matchAll(/\b(\d+)\s*(?:gb\s*)?ssd\b(?!\s*(?:de\s+)?\d)|\bssd\s*(?:de\s+)?(\d+)\s*gb\b/g)) add("ssd", match[1] || match[2]);
      return features;
    };
    const expectedFeatures = numericFeatures(expectedTitle), foundFeatures = numericFeatures(foundTitle);
    for (const [name, values] of expectedFeatures) {
      const actual = foundFeatures.get(name);
      if (actual?.size && ![...values].some(value => actual.has(value))) return false;
    }
    // Mesmo contrato do userscript: edição vinculada a família/geração conhecida.
    const editions = value => {
      const text = normalized(value), result = new Map();
      for (const match of text.matchAll(/\b(iphone|ipad|airpods|redmi(?:\s+note)?|galaxy)\s+([a-z]?\d+[a-z]?)\b(?:\s+((?:pro|max|plus|mini|ultra|fe)(?:\s+(?:pro|max|plus|mini|ultra|fe))*))?/g)) {
        result.set(match[1] + " " + match[2], match[3] || "base");
      }
      for (const match of text.matchAll(/\b(ipad|airpods)\s+(?:(pro|max|mini|air)\s+)?(\d+)\b/g)) {
        const key = match[1] + " " + match[3];
        if (match[2] || !result.has(key)) result.set(key, match[2] || "base");
      }
      return result;
    };
    const expectedEditions = editions(expectedTitle), foundEditions = editions(foundTitle);
    for (const [model, edition] of expectedEditions) {
      if (foundEditions.has(model) && foundEditions.get(model) !== edition) return false;
    }
    const expectedColors = colors(expectedTitle), foundColors = colors(foundTitle);
    if (expectedColors.length && foundColors.length && !expectedColors.some(color => foundColors.includes(color))) return false;
    const words = value => normalized(String(value || "").replace(/\b(?:em|at[eé])\s+\d{1,2}\s*x\b/gi, "").replace(/\b\d{1,2}\s*x\b/gi, "")
      .replace(/(?<=\d)[.,](?=\d)/g, "").replace(/([a-z0-9])[-/]([a-z0-9])/gi, "$1$2"))
      .replace(/\b(\d+)\s+(gb|tb|mb|ssd|hz|w|v)\b/g, "$1$2")
      .split(" ").filter(word => (word.length >= 3 || /[a-z]\d|\d[a-z]/.test(word)) && !/^(com|sem|para|preto|branco|produto|original|promocao)$/.test(word));
    const expected = [...new Set(words(expectedTitle))], found = new Set(words(foundTitle));
    if (!expected.length || !found.size) return false;
    const models = values => values.filter(word => /^[a-z]+\d[a-z0-9]*$/.test(word) || /^\d+[a-z]+$/.test(word));
    const foundModels = models([...found]);
    for (const model of models(expected)) {
      const family = model.replace(/\d+/g, "#");
      if (foundModels.some(other => other.replace(/\d+/g, "#") === family) && !found.has(model)) return false;
    }
    const matches = expected.filter(word => found.has(word)).length;
    return matches >= Math.min(3, expected.length) && matches / expected.length >= 0.5;
  }
  function variantMismatch(title, attributes) {
    const selected = (Array.isArray(attributes) ? attributes : []).filter(a => a && typeof a.name === "string" && typeof a.value === "string" && a.value.trim() && !/\b(escolha|selecione|selecionar)\b/.test(normalized(a.value)));
    const color = selected.filter(a => /^cor(?:es)?$/.test(normalized(a.name)));
    const expectedColors = colors(title);
    if (expectedColors.length && color.some(a => colors(a.value).length && expectedColors.some(c => !colors(a.value).includes(c)))) return "A cor selecionada é diferente da indicada no produto. Confira manualmente.";
    const expectedSize = normalized(title).match(/\b(?:tamanho|tam|numero|numeracao)\s+(\d{1,3}|x{0,3}[pmg]{1,3})\b/)?.[1];
    const sizes = selected.filter(a => /^tamanho|numeracao/.test(normalized(a.name)));
    if (expectedSize && sizes.length && !sizes.some(a => normalized(a.value).split(/\s+/).includes(expectedSize))) return "O tamanho selecionado não corresponde ao cadastro. Confira manualmente.";
    const voltages = normalized(title).match(/\b(?:110|127|220|240)\s*v\b/g) || [];
    const voltage = selected.filter(a => /voltagem|tensao/.test(normalized(a.name)));
    if (voltage.length && voltages.some(v => voltage.some(a => !normalized(a.value).replace(/\s/g, "").includes(v.replace(/\s/g, ""))))) return "A voltagem selecionada não corresponde ao cadastro. Confira manualmente.";
    return "";
  }
  function validate(result, { produtoId, url, titulo, previousPrice = 0, now = Date.now() }) {
    const requested = identity(url), found = identity(result?.fonteConsultada);
    if (!robotReady({ version: result?.robotVersion, ready: true }) || result?.proofVersion !== 3) return "Atualize o robô para a versão " + MIN_VERSION + " ou superior e recarregue o painel.";
    if (result.status !== "ok" || result.produtoId !== produtoId || result.requestedUrl !== url || !result.requestId) return "Resposta não pertence a este produto ou pedido. Preço preservado.";
    if (!requested || !found || requested.key !== found.key || result.offerKey !== found.key || (requested.variation && requested.variation !== found.variation)
      || (requested.attributes && requested.attributes !== found.attributes)) return "O anúncio ou a variação não corresponde ao cadastro. Confira manualmente.";
    const proof = result.variantProof;
    if (!titulo || !proof || proof.expectedTitle !== titulo || proof.verified !== true || !matchingProduct(titulo, result.tituloEncontrado)) return "O título não confirma o mesmo produto. Preço preservado.";
    const expectedListing = requested.listing || found.listing;
    if (expectedListing && proof.listingId && proof.listingId !== expectedListing) return "O anúncio visível não corresponde ao vendedor cadastrado. Confira manualmente.";
    const mismatch = variantMismatch(titulo, proof.attributes);
    if (mismatch) return mismatch;
    const value = result.preco;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || result.mainPrice !== value || result.currency !== "BRL" || result.priceSelector !== ".ui-pdp-price__second-line .andes-money-amount" || !result.evidencia) return "Preço principal sem comprovação. Confira manualmente.";
    if (!Number.isFinite(result.checkedAt) || result.checkedAt > now + 5000 || now - result.checkedAt > 120000) return "Resposta antiga: o preço não foi salvo. Consulte novamente.";
    return "";
  }
  root.RDCAssistedPriceSafety = { MIN_VERSION, robotReady, identity, matchingProduct, variantMismatch, validate };
})(typeof window !== "undefined" ? window : globalThis);
