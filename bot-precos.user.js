// ==UserScript==
// @name         Ranking da Compra - Bot local de preços
// @namespace    https://rankingdacompra.com.br/
// @version      2.4.11
// @description  Confere preços no navegador logado, pausa em verificações humanas e entrega os resultados ao painel.
// @match        https://rankingdacompra.com.br/dashboard.html*
// @match        https://rankingdacompra.com.br/painel-celular.html*
// @match        https://*.mercadolivre.com.br/*
// @match        https://mercadolivre.com.br/*
// @grant        unsafeWindow
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_getTab
// @grant        GM_saveTab
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  "use strict";

  const BOT_VERSION = "2.4.11";
  const REQUEST_TIMEOUT = 45000;
  const COMMAND_KEY = "rdc_preco_command_v2";
  const RESULT_KEY = "rdc_preco_result_v2";
  const CONTROLLER_KEY = "rdc_preco_controller_v3";
  const NAVIGATION_KEY = "rdc_preco_navigation_v1";
  const PANEL_HOST = "rankingdacompra.com.br";
  let tabSession = "", tabNavigation = null;

  // Tampermonkey keeps this metadata in this tab, across subdomains. Never
  // recover a session from global storage: that would capture unrelated tabs.
  function readControllerTab() {
    return new Promise(resolve => {
      if (typeof GM_getTab !== "function") { resolve(null); return; }
      try { GM_getTab(tab => resolve(tab || {})); } catch { resolve(null); }
    });
  }
  async function restoreControllerTab() {
    const tab = await readControllerTab();
    if (/^[a-z0-9-]{8,100}$/i.test(String(tab?.rdcPriceSession || ""))) {
      tabSession = tab.rdcPriceSession;
      tabNavigation = tab.rdcPriceNavigation || null;
    }
  }
  async function persistControllerTab(sessionId, navigation = tabNavigation) {
    if (typeof GM_getTab !== "function" || typeof GM_saveTab !== "function") return false;
    const tab = await readControllerTab();
    if (!tab) return false;
    return new Promise(resolve => {
      try { GM_saveTab({ ...tab, rdcPriceSession: sessionId, rdcPriceNavigation: navigation }, () => resolve(true)); }
      catch { resolve(false); }
    });
  }

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function parsePrice(value) {
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
    const text = String(value || "").replace(/^\s*R\$\s*/i, "").replace(/\s/g, "");
    // Não transformar parcelas, intervalos ou textos em um valor aparentemente válido.
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text) && !/^\d+\.\d{1,2}$/.test(text)) return null;
    const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/\.(?=\d{3}(?:\.|$))/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function walkJson(value, visitor) {
    if (!value || typeof value !== "object") return;
    visitor(value);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach((item) => walkJson(item, visitor));
      else walkJson(child, visitor);
    }
  }

  // A conferência verifica nome/modelo e preço, não uma variante específica.
  function nameForPrice(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(?:(?:cor|cores)\s*:?\s*)?(?:mixed\s+black|branc[oa]|pret[oa]|azul|vermelh[oa]|verde|amarel[oa]|bege|cinza|prata|dourad[oa]|rosa|rox[oa]|marrom|laranja|transparente|black|white)\b/gi, " ")
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:v|volts?)\b|\bbivolt\b/gi, " ")
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:polegadas?\b|pol\b|inch(?:es)?\b|["\u2033]|mm\b|cm\b|m\b)/gi, " ")
      .replace(/\b(?:tamanho|tam|numero|numeracao)\s*[:#]?\s*(?:\d{1,3}\s*(?:br|eu|us)?|x{0,3}[pmg]{1,3}|xs|xl|xxl)\b/gi, " ")
      .replace(/\b\d{1,3}\s*(?:br|eu|us)\b/gi, " ");
  }
  function matchingProduct(expectedTitle, foundTitle) {
    expectedTitle = nameForPrice(expectedTitle);
    foundTitle = nameForPrice(foundTitle);
    // Números só são identidade quando ligados a modelo/medida. Descontos,
    // frete e prazo promocional não podem transformar o mesmo produto em outro.
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
      // A maior capacidade (>=64 GB) preserva armazenamento sem confundir
      // RAM física/virtual: 128 GB + 4 GB + 8 GB continua sendo 128 GB.
      const storage = [...text.matchAll(/\b(\d+)\s*(gb|tb)\b/g)]
        .map(match => Number(match[1]) * (match[2] === "tb" ? 1024 : 1)).filter(value => value >= 64);
      if (storage.length) add("armazenamento", Math.max(...storage));
      return features;
    };
    const expectedFeatures = numericFeatures(expectedTitle), foundFeatures = numericFeatures(foundTitle);
    for (const [name, values] of expectedFeatures) {
      if (name === "tela") continue; // Tamanho não é um bloqueio nesta conferência.
      const actual = foundFeatures.get(name);
      if (actual?.size && ![...values].some(value => actual.has(value))) return false;
    }
    // Uma edição só é comparada quando ambos os títulos identificam a mesma
    // família e geração. "Pro" de uma oferta promocional não é identidade.
    const editions = value => {
      const text = normalizeText(value), result = new Map();
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
    const expectedColors = variantColors(expectedTitle), foundColors = variantColors(foundTitle);
    if (expectedColors.length && foundColors.length && !expectedColors.some(color => foundColors.includes(color))) return false;
    const words = value => normalizeText(String(value || "").replace(/\b(?:em|at[eé])\s+\d{1,2}\s*x\b/gi, "").replace(/\b\d{1,2}\s*x\b/gi, "")
      .replace(/(?<=\d)[.,](?=\d)/g, "").replace(/([a-z0-9])[-/]([a-z0-9])/gi, "$1$2"))
      .replace(/\b(\d+)\s+(gb|tb|mb|ssd|hz|w|v)\b/g, "$1$2")
      .split(" ").filter(word => (word.length >= 3 || /[a-z]\d|\d[a-z]/.test(word)) && !/^(com|sem|para|preto|branco|produto|original|promocao)$/.test(word));
    const expected = [...new Set(words(expectedTitle))], found = new Set(words(foundTitle));
    if (!expected.length || !found.size) return false;
    // GB de RAM/Boost, potência e outras unidades não são códigos de modelo.
    // Ex.: 12 GB anunciados = 4 GB físicos + 8 GB de expansão no mesmo Moto G35.
    const models = values => values.filter(word => !/^\d+(?:gb|tb|mb|hz|w|mah|mp|ml|kg|g|l)$/.test(word)
      && (/^[a-z]+\d[a-z0-9]*$/.test(word) || /^\d+[a-z]+$/.test(word)));
    const foundModels = models([...found]);
    // Modelo realmente divergente no título é outro produto; ausência na ficha não é divergência.
    for (const model of models(expected)) {
      const family = model.replace(/\d+/g, "#");
      if (foundModels.some(other => other.replace(/\d+/g, "#") === family) && !found.has(model)) return false;
    }
    const matches = expected.filter(word => found.has(word)).length;
    // Títulos cadastrados podem ter muitos complementos ausentes no título
    // curto do anúncio. Exigir ao menos cinco termos e 80% do título curto
    // evita rejeitar o mesmo kit por descrições extras; modelos divergentes
    // continuam recusados acima e a identidade da URL é validada separadamente.
    return matches >= Math.min(3, expected.length) && (matches / expected.length >= 0.5
      || (matches >= 5 && matches / found.size >= 0.8));
  }

  function offerIdentity(rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:" || !/(^|\.)mercadolivre\.com\.br$/i.test(url.hostname)) return null;
      const item = value => String(value || "").match(/^MLB-?(\d{6,})$/i)?.[1];
      const hash = new URLSearchParams(url.hash.slice(1));
      const ids = [(url.searchParams.get("pdp_filters") || "").match(/(?:^|[|,])item_id:(MLB-?\d+)/i)?.[1],
        url.pathname.match(/(?:^|\/)(MLB-\d+)/i)?.[1], url.searchParams.get("wid"), hash.get("wid")]
        .filter(Boolean).map(item);
      if (ids.some(id => !id) || new Set(ids).size > 1) return null;
      const listing = ids[0] ? "MLB" + ids[0] : "";
      const catalog = url.pathname.match(/\/(?:p|up)\/(MLBU?\d+)/i)?.[1]?.toUpperCase() || "";
      return { key: String(listing || catalog || url.hostname + url.pathname).toUpperCase(), listing, catalog,
        variation: url.searchParams.get("searchVariation") || "", attributes: url.searchParams.get("attributes") || "" };
    } catch { return null; }
  }

  function sameOffer(expectedUrl, actualUrl) {
    const expected = offerIdentity(expectedUrl), actual = offerIdentity(actualUrl);
    return !!expected && !!actual && (expected.key === actual.key
      || Boolean(expected.catalog && actual.catalog && expected.catalog === actual.catalog));
  }

  function visibleNode(documentHtml, node) {
    if (!node || node.closest('[hidden], [aria-hidden="true"]')) return false;
    const view = documentHtml.defaultView;
    if (!view) return false;
    const style = view.getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
  }

  function variantColors(value) {
    const aliases = { branca: "branco", preta: "preto", vermelha: "vermelho", amarela: "amarelo", roxa: "roxo", dourada: "dourado", black: "preto", white: "branco" };
    return [...new Set(normalizeText(value).split(/\s+/).map(word => aliases[word] || word)
      .filter(word => /^(branco|preto|azul|vermelho|verde|amarelo|bege|cinza|prata|dourado|rosa|roxo|marrom|laranja|transparente)$/.test(word)))];
  }

  function variantMismatch(_title, _attributes) {
    // Preferência do responsável: conferir nome e preço, sem validar variantes.
    return "";
  }
  function extractVariantProof(documentHtml, expectedTitle, requestedUrl, finalUrl) {
    const listingIds = [...documentHtml.querySelectorAll('.ui-vpp-denounce__info, .ui-pdp-denounce__info')]
      .filter(node => visibleNode(documentHtml, node)).map(node => String(node.textContent || "").match(/An[uú]ncio\s*#?\s*(?:MLB-?)?(\d{6,})/i)?.[1]).filter(Boolean);
    const ids = [...new Set(listingIds)];
    const listingId = ids.length === 1 ? "MLB" + ids[0] : "";
    const expectedListing = offerIdentity(requestedUrl)?.listing || offerIdentity(finalUrl)?.listing;
    const sameCatalog = offerIdentity(requestedUrl)?.catalog && offerIdentity(requestedUrl).catalog === offerIdentity(finalUrl)?.catalog;
    if (!sameCatalog && expectedListing && ids.some(id => "MLB" + id !== expectedListing)) {
      return { motivo: "O anúncio visível não corresponde ao vendedor cadastrado. Confira manualmente." };
    }
    return { verified: true, listingId, expectedTitle, attributes: [] };
  }

  function securityCheck(source) {
    return /(captcha|n[aã]o sou um rob[oô]|confirme que voc[eê] [eé] humano|verifique sua identidade|access denied|acesso negado|automated access)/i.test(source);
  }

  function unavailableCheck(source) {
    return /(este produto est[aá] indispon[ií]vel|an[uú]ncio pausado|an[uú]ncio finalizado|produto sem estoque|n[aã]o est[aá] dispon[ií]vel)/i.test(source);
  }

  function extractStructuredPrice(documentHtml, pageTitle, finalUrl) {
    const offers = [];
    for (const script of documentHtml.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(script.textContent || "null");
        walkJson(parsed, (node) => {
          if (![node["@type"]].flat().some((type) => String(type).toLowerCase() === "product")) return;
          if (!matchingProduct(pageTitle, node.name)) return;
          const values = Array.isArray(node.offers) ? node.offers : [node.offers];
          for (const offer of values.filter(Boolean)) {
            // Um lowPrice ou uma recomendação nunca comprova a oferta selecionada.
            if (String(offer["@type"] || "").toLowerCase() !== "offer" || offer.priceCurrency !== "BRL") continue;
            if (!offer.url || offerIdentity(offer.url)?.key !== offerIdentity(finalUrl)?.key) continue;
            offers.push(offer);
          }
        });
      } catch {
        // Alguns anúncios possuem blocos auxiliares incompletos.
      }
    }
    const prices = [];
    for (const offer of offers) {
      const availability = String(offer.availability || "").toLowerCase();
      if (/outofstock|soldout|discontinued/.test(availability)) continue;
      const price = parsePrice(offer.price);
      if (price) prices.push(price);
    }
    return { prices: [...new Set(prices)] };
  }

  function extractMainPrice(documentHtml) {
    // Melhor total visível no bloco principal, independentemente do pagamento.
    // Valores de parcela, preço antigo, cashback e recomendações continuam excluídos.
    const candidates = [];
    for (const node of documentHtml.querySelectorAll('.ui-pdp-price__second-line .andes-money-amount')) {
      if (node.closest('.andes-money-amount--previous, .ui-pdp-price__original-value, .ui-pdp-price__installments, .ui-pdp-promotions-pill-label, .ui-pdp-outside_variations, .ui-pdp-variations, .ui-pdp-other-sellers, .ui-pdp-other-sellers-item, .ui-pdp-recommendations, [class*="recommendations"], [class*="carousel"], [hidden], [aria-hidden="true"]')) continue;
      if (documentHtml.defaultView) {
        const style = documentHtml.defaultView.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || !node.getClientRects().length) continue;
      }
      const fractionNode = node.querySelector('.andes-money-amount__fraction');
      const fraction = fractionNode?.textContent;
      const cents = node.querySelector('.andes-money-amount__cents')?.textContent || "00";
      const currency = node.querySelector('.andes-money-amount__currency-symbol')?.textContent;
      const label = node.getAttribute('aria-label') || "";
      const installment = /\bparcelas?\b|\b\d{1,2}\s*(?:x|vezes)\b/i.test(label);
      if (/\bantes\b|cashback|a partir|cupom|primeira compra|frete/i.test(label) || (installment && !/\btotal\b/i.test(label)) || currency?.trim() !== "R$") continue;
      const price = parsePrice(`${fraction},${cents.padStart(2, "0")}`);
      if (!price) continue;
      candidates.push(price);
    }
    // Só compara totais principais já filtrados. Não é o menor valor da página:
    // parcelas, cashback, preço anterior, recomendações e outros vendedores não entram.
    return candidates.length ? [Math.min(...candidates)] : [];
  }

  function extractDocumentOffer(documentHtml, expectedTitle, finalUrl, requestedUrl = finalUrl) {
    if (!sameOffer(requestedUrl, finalUrl)) return { status: "loading", motivo: "A aba ainda está em outro anúncio. Nenhum preço será aproveitado." };
    const source = String(documentHtml.body?.innerText || documentHtml.documentElement?.innerText || "");
    if (securityCheck(source)) return { status: "security", motivo: "O Mercado Livre pediu confirmação humana." };
    const pageTitle = String(
      documentHtml.querySelector("h1.ui-pdp-title")?.textContent ||
      documentHtml.querySelector("h1")?.textContent || "",
    ).replace(/\s+/g, " ").trim();
    if (!matchingProduct(expectedTitle, pageTitle)) return { status: "loading", motivo: "A página ainda não confirmou o mesmo produto." };
    if (!documentHtml.defaultView) return { status: "loading", motivo: "É necessário conferir a página renderizada na aba logada." };
    const variantProof = extractVariantProof(documentHtml, expectedTitle, requestedUrl, finalUrl);
    if (!variantProof.verified) return { status: "loading", motivo: variantProof.motivo };
    const mainPrices = extractMainPrice(documentHtml);
    if (!mainPrices.length) {
      // O catálogo pode mostrar falta de estoque fora do buybox, junto às variações.
      // Só aceita avisos visíveis do produto, nunca mensagens das recomendações.
      const unavailableMessages = [...documentHtml.querySelectorAll('.ui-pdp-buybox, .ui-pdp-shipping-message__text')]
        .filter(node => visibleNode(documentHtml, node) && !node.closest('.ui-pdp-other-sellers, .ui-pdp-other-sellers-item, .ui-pdp-recommendations, [class*="recommendations"], [class*="carousel"]'))
        .map(node => node.innerText || node.textContent || "").join(" ");
      if (unavailableCheck(unavailableMessages)) return {
        status: "unavailable", tituloEncontrado: pageTitle, fonteConsultada: finalUrl,
        motivo: /escolha outra varia[cç][aã]o/i.test(unavailableMessages)
          ? "A opção aberta está indisponível. Preço preservado; confira outra opção do mesmo produto."
          : "O anúncio aberto está indisponível ou sem estoque. Preço preservado.",
      };
      // Alguns anúncios de calçados não mostram buybox/aviso: somente opções
      // explicitamente bloqueadas. Não confundir uma opção esgotada com todas.
      const options = [...documentHtml.querySelectorAll('.ui-pdp-outside_variations__thumbnails__item')]
        .filter(node => visibleNode(documentHtml, node));
      if (options.length && options.every(node => node.classList?.contains('ui-pdp-outside_variations__thumbnails__item--BLOCKED')
        || /n[aã]o dispon[ií]vel/i.test(node.getAttribute('aria-label') || ''))) return {
        status: "unavailable", tituloEncontrado: pageTitle, fonteConsultada: finalUrl,
        motivo: "Todas as opções exibidas estão indisponíveis e o anúncio não mostra preço. Preço preservado.",
      };
    }
    if (!documentHtml.defaultView) return { status: "loading", motivo: "É necessário conferir a página renderizada na aba logada." };
    const structured = extractStructuredPrice(documentHtml, pageTitle, finalUrl);
    if (mainPrices.length !== 1) return { status: "loading", motivo: "Preço principal ausente ou ambíguo. Confira manualmente." };
    const mainPrice = mainPrices[0];
    const highlightedOfferKey = variantProof.listingId || offerIdentity(finalUrl).key;
    // JSON-LD pode trazer preço padrão enquanto a tela mostra Pix/promoção.
    // É registrado para diagnóstico, não substitui nem veta o valor visível.
    if (mainPrice) {
      return {
        status: "ok", preco: mainPrice, comparisonPolicy: "name_price", priceBasis: "highlighted_total",
        evidencia: `Preço total em destaque: R$ ${mainPrice.toFixed(2).replace(".", ",")}; anúncio visível ${highlightedOfferKey}`,
        tituloEncontrado: pageTitle, fonteConsultada: finalUrl, origem: "pagina_principal_visivel",
        robotVersion: BOT_VERSION, proofVersion: 3, requestedUrl, offerKey: highlightedOfferKey, variantProof,
        mainPrice, structuredPrices: structured.prices, currency: "BRL", priceSelector: ".ui-pdp-price__second-line .andes-money-amount",
      };
    }
    return { status: "loading", motivo: "O preço principal ainda não apareceu." };
  }


  function conferenceUrl(rawUrl, sessionId) {
    const url = new URL(rawUrl);
    if (!offerIdentity(rawUrl) || !/^[a-z0-9-]{8,100}$/i.test(String(sessionId || ""))) throw new Error("Sessão de conferência inválida.");
    // Um filtro de campanha vencida pode esconder estoque do MESMO anúncio.
    // Limpar apenas deal; manter wid, item_id, variante e a URL original na prova.
    const filters = url.searchParams.get("pdp_filters");
    if (filters && /(?:^|[|,])deal:/i.test(filters)) {
      const retained = filters.split(/[|,]/).filter(part => !/^deal:/i.test(part));
      if (retained.length) url.searchParams.set("pdp_filters", retained.join("|"));
      else url.searchParams.delete("pdp_filters");
    }
    const hash = new URLSearchParams(url.hash.slice(1));
    hash.set("_rdc_conferencia", sessionId);
    url.hash = hash.toString();
    return url.href;
  }

  function controllerSession() {
    const marker = new URLSearchParams(new URL(location.href).hash.slice(1)).get("_rdc_conferencia") || "";
    if (marker && /^[a-z0-9-]{8,100}$/i.test(marker)) {
      tabSession = marker;
      try { sessionStorage.setItem(CONTROLLER_KEY, marker); unsafeWindow.name = "rdc_conferencia_" + marker; } catch {}
      return marker;
    }
    try {
      const stored = sessionStorage.getItem(CONTROLLER_KEY) || "";
      return tabSession || (stored && unsafeWindow.name === "rdc_conferencia_" + stored ? stored : "");
    } catch { return tabSession; }
  }

  async function handleConferenceCommand(command) {
    if (!command?.requestId || Date.now() - Number(command.createdAt || 0) > 120000) return false;
    // Uma aba comum do Mercado Livre não pode ser sequestrada pela fila.
    if (!command.sessionId) {
      if (sameOffer(command.url, location.href)) { await publishCurrentPageResult(command); return true; }
      return false;
    }
    if (controllerSession() !== command.sessionId || !offerIdentity(command.url)) return false;
    if (GM_getValue(COMMAND_KEY, null)?.requestId !== command.requestId) return false;
    GM_setValue(CONTROLLER_KEY, { sessionId: command.sessionId, requestId: command.requestId, seenAt: Date.now() });
    if (!sameOffer(command.url, location.href)) {
      // Catálogos antigos podem redirecionar a outro catálogo. Uma navegação
      // por pedido é suficiente: repetir após cada reload criava um ciclo até
      // o timeout. Não aceitar o preço de uma identidade diferente.
      let navigation = tabNavigation;
      if (!navigation) try { navigation = JSON.parse(sessionStorage.getItem(NAVIGATION_KEY) || "null"); } catch {}
      if (navigation?.requestId === command.requestId && navigation?.sessionId === command.sessionId) {
        const security = securityCheck(String(document.body?.innerText || ""));
        GM_setValue(RESULT_KEY, { status: security ? "security" : "error", code: security ? "RDC_HUMAN_VERIFICATION" : "RDC_PRODUCT_REDIRECT",
          motivo: security ? "O Mercado Livre pediu confirmação humana. Resolva pessoalmente na aba do anúncio."
            : "O Mercado Livre redirecionou para outra página ou catálogo. Revise o link do mesmo produto; preço preservado.",
          robotVersion: BOT_VERSION, requestedUrl: command.url, requestId: command.requestId,
          produtoId: command.produtoId, checkedAt: Date.now() });
        return true;
      }
      const nextNavigation = { requestId: command.requestId, sessionId: command.sessionId };
      let stored = false;
      try { sessionStorage.setItem(NAVIGATION_KEY, JSON.stringify(nextNavigation)); stored = true; } catch {}
      if (typeof GM_getTab === "function" && typeof GM_saveTab === "function") {
        stored = await persistControllerTab(command.sessionId, nextNavigation);
        if (GM_getValue(COMMAND_KEY, null)?.requestId !== command.requestId) return false;
      }
      if (!stored) {
        GM_setValue(RESULT_KEY, { status: "error", code: "RDC_NAVIGATION_STORAGE",
          motivo: "Não foi possível preservar a navegação nesta aba. Preço preservado; confira manualmente.",
          robotVersion: BOT_VERSION, requestedUrl: command.url, requestId: command.requestId,
          produtoId: command.produtoId, checkedAt: Date.now() });
        return true;
      }
      tabNavigation = nextNavigation;
      // Navegar a própria aba evita depender de WindowProxy/opener antigos,
      // perdidos por COOP ou pela restauração de janelas do Chrome.
      location.assign(conferenceUrl(command.url, command.sessionId));
      return true;
    }
    await publishCurrentPageResult(command);
    return true;
  }

  function installOfferChannel() {
    let processing = "", completed = "";
    const run = async () => {
      const command = GM_getValue(COMMAND_KEY, null);
      // O heartbeat deve continuar mesmo após responder. Antes, 90 segundos
      // sem pedido expiravam a aba viva e provocavam novas janelas assíncronas.
      if (command?.sessionId && controllerSession() === command.sessionId) {
        GM_setValue(CONTROLLER_KEY, { sessionId: command.sessionId, requestId: command.requestId, seenAt: Date.now() });
      }
      if (!command?.requestId || command.requestId === processing || command.requestId === completed) return;
      const id = command.requestId;
      processing = id;
      try { if (await handleConferenceCommand(command)) completed = id; }
      finally { if (processing === id) processing = ""; }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void run(), { once: true });
    else void run();
    GM_addValueChangeListener(COMMAND_KEY, () => void run());
    // A notificação pode se perder entre domínios/abas em segundo plano.
    // Recuperação local: não consulta a rede nem o Firebase e só opera a aba vinculada.
    if (controllerSession() && typeof setInterval === "function") setInterval(() => void run(), 1500);
  }

  function installPanelBridge() {
    let offerWindow = null;
    const sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    unsafeWindow.__RDC_BOT_PRECOS_LOCAL__ = { version: BOT_VERSION, ready: true, assisted: true };
    unsafeWindow.conferirPrecoPelaFonteLocal = async (request) => {
      const result = await unsafeWindow.conferirPrecoNaAbaLocal(request);
      if (result.status !== "ok") throw new Error(result.motivo || "Preço principal não comprovado. Confira a aba do Mercado Livre.");
      return result;
    };
    const consultarUmaVez = ({ produtoId, titulo, url }) => new Promise((resolve, reject) => {
      if (!/^https:\/\/(?:[^/]+\.)?mercadolivre\.com\.br\//i.test(String(url || ""))) {
        reject(new Error("O produto não possui um link completo do Mercado Livre."));
        return;
      }
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let timer = 0;
      let poll = 0, listener = 0;
      const acceptResult = (value) => {
        if (!value || value.requestId !== requestId || value.produtoId !== produtoId || value.requestedUrl !== url) return;
        clearTimeout(timer);
        if (poll) clearInterval(poll);
        GM_removeValueChangeListener(listener);
        resolve(value);
      };
      listener = GM_addValueChangeListener(RESULT_KEY, (_key, _oldValue, value) => acceptResult(value));
      if (typeof setInterval === "function") poll = setInterval(() => acceptResult(GM_getValue(RESULT_KEY, null)), 500);
      timer = setTimeout(() => {
        if (poll) clearInterval(poll);
        GM_removeValueChangeListener(listener);
        if (GM_getValue(COMMAND_KEY, null)?.requestId === requestId) GM_setValue(COMMAND_KEY, null);
        reject(Object.assign(new Error("O anúncio demorou mais de 45 segundos. Confira a aba do Mercado Livre."), { code: "RDC_CHANNEL_TIMEOUT" }));
      }, REQUEST_TIMEOUT);
      const controller = typeof GM_getValue === "function" ? GM_getValue(CONTROLLER_KEY, null) : null;
      const hasController = controller?.sessionId === sessionId && Date.now() - Number(controller.seenAt || 0) >= 0
        && Date.now() - Number(controller.seenAt || 0) < 90000;
      GM_setValue(COMMAND_KEY, { requestId, produtoId, titulo, url, sessionId, createdAt: Date.now() });
      const features = unsafeWindow.innerWidth >= 900
        ? `popup=yes,width=620,height=850,left=${Math.max(0, unsafeWindow.screen.availWidth - 632)},top=20`
        : "";
      try {
        if (!hasController) {
          offerWindow = unsafeWindow.open(conferenceUrl(url, sessionId), "rdc_conferencia_" + sessionId, features);
          if (!offerWindow) throw Object.assign(new Error("O navegador bloqueou a janela do anúncio. Toque novamente em iniciar para reabrir a aba."), { code: "RDC_POPUP_BLOCKED" });
          try { offerWindow.focus(); } catch {}
        }
      } catch (error) {
        clearTimeout(timer);
        if (poll) clearInterval(poll);
        GM_removeValueChangeListener(listener);
        if (typeof GM_getValue === "function" && GM_getValue(COMMAND_KEY, null)?.requestId === requestId) GM_setValue(COMMAND_KEY, null);
        reject(error);
      }
    });
    unsafeWindow.conferirPrecoNaAbaLocal = async request => {
      const result = await consultarUmaVez(request);
      // Uma página transitória pode ter respondido antes da navegação estabilizar.
      // Novo pedido, mesma URL e mesmas validações: só repete falha, nunca sucesso,
      // indisponibilidade, CAPTCHA ou erro global de comunicação. Não grava preços.
      if (result?.status === "error" && ["RDC_PRODUCT_REDIRECT", "RDC_OFFER_NOT_READY"].includes(result.code)) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (GM_getValue(COMMAND_KEY, null)?.requestId !== result.requestId) return result;
        return consultarUmaVez(request);
      }
      return result;
    };
  }

  async function publishCurrentPageResult(command) {
    if (!command?.requestId || !command?.titulo || Date.now() - Number(command.createdAt || 0) > 120000) return;
    // A mudança da fila chega às abas antigas antes da navegação da janela reutilizada.
    if (!sameOffer(command.url, location.href)) return;
    const deadline = Date.now() + 18000;
    let result = { status: "loading" };
    let previousPrice = null;
    let stable = false;
    while (Date.now() < deadline) {
      if (GM_getValue(COMMAND_KEY, null)?.requestId !== command.requestId || !sameOffer(command.url, location.href)) return;
      result = extractDocumentOffer(document, command.titulo, location.href, command.url);
      if (result.status === "ok") {
        if (previousPrice === result.preco) { stable = true; break; }
        previousPrice = result.preco;
      } else {
        previousPrice = null;
        if (result.status !== "loading") break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (result.status === "loading" || (result.status === "ok" && !stable)) result = { status: "error", code: "RDC_OFFER_NOT_READY", motivo: result.motivo || "O preço principal não estabilizou. Confira manualmente." };
    if (GM_getValue(COMMAND_KEY, null)?.requestId !== command.requestId || !sameOffer(command.url, location.href)) return;
    GM_setValue(RESULT_KEY, { ...result, robotVersion: BOT_VERSION, requestedUrl: command.url, requestId: command.requestId, produtoId: command.produtoId, checkedAt: Date.now() });
  }

  async function initializeOfferChannel() {
      // Capture the URL marker synchronously, before page scripts can redirect.
      const markedSession = controllerSession();
      if (!markedSession) await restoreControllerTab();
      const sessionId = controllerSession();
      if (sessionId) {
        const command = GM_getValue(COMMAND_KEY, null);
        if (command?.sessionId === sessionId && sameOffer(command.url, location.href)) {
          tabNavigation = { requestId: command.requestId, sessionId };
        }
        await persistControllerTab(sessionId);
      }
      installOfferChannel();
  }

  if (location.hostname === PANEL_HOST) {
    installPanelBridge();
    return;
  }
  if (/mercadolivre\.com\.br$/i.test(location.hostname)) {
    void initializeOfferChannel();
  }
})();
