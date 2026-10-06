// ==UserScript==
// @name         Ranking da Compra - Bot local de preços
// @namespace    https://rankingdacompra.com.br/
// @version      2.3.0
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
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  const BOT_VERSION = "2.3.0";
  const REQUEST_TIMEOUT = 45000;
  const COMMAND_KEY = "rdc_preco_command_v2";
  const RESULT_KEY = "rdc_preco_result_v2";
  const PANEL_HOST = "rankingdacompra.com.br";

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

  function matchingProduct(expectedTitle, foundTitle) {
    const words = value => normalizeText(String(value || "").replace(/(?<=\d)[.,](?=\d)/g, "").replace(/([a-z0-9])[-/]([a-z0-9])/gi, "$1$2"))
      .split(" ").filter(word => (word.length >= 3 || /[a-z]\d|\d[a-z]/.test(word)) && !/^(com|sem|para|preto|branco|produto|original|promocao)$/.test(word));
    const expected = [...new Set(words(expectedTitle))], found = new Set(words(foundTitle));
    if (!expected.length || !found.size) return false;
    const models = values => values.filter(word => /^[a-z]+\d[a-z0-9]*$/.test(word) || /^\d+[a-z]+$/.test(word));
    const foundModels = models([...found]);
    // Modelo realmente divergente no título é outro produto; ausência na ficha não é divergência.
    for (const model of models(expected)) {
      const family = model.replace(/\d+/g, "#");
      if (foundModels.some(other => other.replace(/\d+/g, "#") === family) && !found.has(model)) return false;
    }
    const matches = expected.filter(word => found.has(word)).length;
    return matches >= Math.min(3, expected.length) && matches / expected.length >= 0.5;
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
      const catalog = url.pathname.match(/\/p\/(MLB\d+)/i)?.[1]?.toUpperCase() || "";
      return { key: String(listing || catalog || url.hostname + url.pathname).toUpperCase(), listing, catalog,
        variation: url.searchParams.get("searchVariation") || "", attributes: url.searchParams.get("attributes") || "" };
    } catch { return null; }
  }

  function sameOffer(expectedUrl, actualUrl) {
    const expected = offerIdentity(expectedUrl), actual = offerIdentity(actualUrl);
    return !!expected && !!actual && expected.key === actual.key && (!expected.variation || expected.variation === actual.variation)
      && (!expected.attributes || expected.attributes === actual.attributes);
  }

  function visibleNode(documentHtml, node) {
    if (!node || node.closest('[hidden], [aria-hidden="true"]')) return false;
    const view = documentHtml.defaultView;
    if (!view) return false;
    const style = view.getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
  }

  function variantColors(value) {
    const aliases = { branca: "branco", preta: "preto", vermelha: "vermelho", amarela: "amarelo", roxa: "roxo", dourada: "dourado" };
    return [...new Set(normalizeText(value).split(/\s+/).map(word => aliases[word] || word)
      .filter(word => /^(branco|preto|azul|vermelho|verde|amarelo|bege|cinza|prata|dourado|rosa|roxo|marrom|laranja|transparente)$/.test(word)))];
  }

  function variantMismatch(title, attributes) {
    // Ficha incompleta e "Escolha" não impedem conferir o preço principal do produto.
    // Só bloquear uma característica explicitamente contraditória ao cadastro.
    const selected = (Array.isArray(attributes) ? attributes : []).filter(a => a && typeof a.name === "string" && typeof a.value === "string" && a.value.trim() && !/\b(escolha|selecione|selecionar)\b/.test(normalizeText(a.value)));
    const color = selected.filter(a => /^cor(?:es)?$/.test(normalizeText(a.name)));
    const expectedColors = variantColors(title);
    if (expectedColors.length && color.some(a => variantColors(a.value).length && expectedColors.some(c => !variantColors(a.value).includes(c)))) return "A cor selecionada é diferente da indicada no produto. Confira manualmente.";
    const expectedSize = normalizeText(title).match(/\b(?:tamanho|tam|numero|numeracao)\s+(\d{1,3}|x{0,3}[pmg]{1,3})\b/)?.[1];
    const sizes = selected.filter(a => /^tamanho|numeracao/.test(normalizeText(a.name)));
    if (expectedSize && sizes.length && !sizes.some(a => normalizeText(a.value).split(/\s+/).includes(expectedSize))) return "O tamanho selecionado não corresponde ao cadastro. Confira manualmente.";
    const voltages = normalizeText(title).match(/\b(?:110|127|220|240)\s*v\b/g) || [];
    const voltage = selected.filter(a => /voltagem|tensao/.test(normalizeText(a.name)));
    if (voltage.length && voltages.some(v => voltage.some(a => !normalizeText(a.value).replace(/\s/g, "").includes(v.replace(/\s/g, ""))))) return "A voltagem selecionada não corresponde ao cadastro. Confira manualmente.";
    return "";
  }

  function extractVariantProof(documentHtml, expectedTitle, requestedUrl, finalUrl) {
    const listingIds = [...documentHtml.querySelectorAll('.ui-vpp-denounce__info, .ui-pdp-denounce__info')]
      .filter(node => visibleNode(documentHtml, node)).map(node => String(node.textContent || "").match(/An[uú]ncio\s*#?\s*(?:MLB-?)?(\d{6,})/i)?.[1]).filter(Boolean);
    const ids = [...new Set(listingIds)];
    const listingId = ids.length === 1 ? "MLB" + ids[0] : "";
    const attributes = [];
    for (const node of documentHtml.querySelectorAll('.ui-pdp-outside_variations__title, .ui-pdp-variations__title')) {
      if (!visibleNode(documentHtml, node)) continue;
      const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
      const separator = text.indexOf(":");
      if (separator < 0) continue;
      attributes.push({ name: text.slice(0, separator).trim(), value: text.slice(separator + 1).trim() });
    }
    // Produtos de variante única podem comprovar cor/modelo na ficha visível.
    for (const row of documentHtml.querySelectorAll('table tr')) {
      if (!visibleNode(documentHtml, row) || row.closest('[class*="recommendations"], [class*="carousel"], [class*="review"]')) continue;
      const cells = [...row.querySelectorAll('th, td')];
      if (cells.length !== 2) continue;
      const name = String(cells[0].textContent || "").trim(), value = String(cells[1].textContent || "").trim();
      if (!/^(cor|cores|modelo(?: detalhado| alfanumerico)?|voltagem|tensao|tamanho|numeracao)$/.test(normalizeText(name))) continue;
      if (!attributes.some(a => normalizeText(a.name) === normalizeText(name))) attributes.push({ name, value });
    }
    const mismatch = variantMismatch(expectedTitle, attributes);
    if (mismatch) return { motivo: mismatch };
    return { verified: true, listingId, expectedTitle, attributes };
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
    // Ordem do bloco principal, nunca o menor preço entre opções. As cópias de
    // preço/Pix podem coexistir; a primeira cotação principal visível é a do anúncio.
    for (const node of documentHtml.querySelectorAll('.ui-pdp-price__second-line .andes-money-amount')) {
      if (node.closest('.andes-money-amount--previous, .ui-pdp-price__original-value, .ui-pdp-price__installments, .ui-pdp-promotions-pill-label, .ui-pdp-outside_variations, .ui-pdp-variations, .ui-pdp-other-sellers, .ui-pdp-other-sellers-item, .ui-pdp-recommendations, [class*="recommendations"], [class*="carousel"], [hidden], [aria-hidden="true"]')) continue;
      if (documentHtml.defaultView) {
        const style = documentHtml.defaultView.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || !node.getClientRects().length) continue;
      }
      const fraction = node.querySelector('.andes-money-amount__fraction')?.textContent;
      const cents = node.querySelector('.andes-money-amount__cents')?.textContent || "00";
      const currency = node.querySelector('.andes-money-amount__currency-symbol')?.textContent;
      const label = node.getAttribute('aria-label') || "";
      if (/antes|parcela|cashback|\d\s*x|a partir/i.test(label) || currency?.trim() !== "R$") continue;
      const price = parsePrice(`${fraction},${cents.padStart(2, "0")}`);
      if (price) return [price];
    }
    return [];
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
    if (!mainPrices.length && unavailableCheck(documentHtml.querySelector('.ui-pdp-buybox')?.innerText || "")) return { status: "unavailable", tituloEncontrado: pageTitle, fonteConsultada: finalUrl };
    if (!documentHtml.defaultView) return { status: "loading", motivo: "É necessário conferir a página renderizada na aba logada." };
    const structured = extractStructuredPrice(documentHtml, pageTitle, finalUrl);
    if (mainPrices.length !== 1) return { status: "loading", motivo: "Preço principal ausente ou ambíguo. Confira manualmente." };
    const mainPrice = mainPrices[0];
    // JSON-LD pode trazer preço padrão enquanto a tela mostra Pix/promoção.
    // É registrado para diagnóstico, não substitui nem veta o valor visível.
    if (mainPrice) {
      return {
        status: "ok", preco: mainPrice,
        evidencia: `Preço principal visível: R$ ${mainPrice.toFixed(2).replace(".", ",")}; anúncio ${offerIdentity(finalUrl).key}`,
        tituloEncontrado: pageTitle, fonteConsultada: finalUrl, origem: "pagina_principal_visivel",
        robotVersion: BOT_VERSION, proofVersion: 3, requestedUrl, offerKey: offerIdentity(finalUrl).key, variantProof,
        mainPrice, structuredPrices: structured.prices, currency: "BRL", priceSelector: ".ui-pdp-price__second-line .andes-money-amount",
      };
    }
    return { status: "loading", motivo: "O preço principal ainda não apareceu." };
  }


  function installPanelBridge() {
    let offerWindow = null;
    unsafeWindow.__RDC_BOT_PRECOS_LOCAL__ = { version: BOT_VERSION, ready: true, assisted: true };
    unsafeWindow.conferirPrecoPelaFonteLocal = async (request) => {
      const result = await unsafeWindow.conferirPrecoNaAbaLocal(request);
      if (result.status !== "ok") throw new Error(result.motivo || "Preço principal não comprovado. Confira a aba do Mercado Livre.");
      return result;
    };
    unsafeWindow.conferirPrecoNaAbaLocal = ({ produtoId, titulo, url }) => new Promise((resolve, reject) => {
      if (!/^https:\/\/(?:[^/]+\.)?mercadolivre\.com\.br\//i.test(String(url || ""))) {
        reject(new Error("O produto não possui um link completo do Mercado Livre."));
        return;
      }
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let timer = 0;
      const listener = GM_addValueChangeListener(RESULT_KEY, (_key, _oldValue, value) => {
        if (!value || value.requestId !== requestId || value.produtoId !== produtoId || value.requestedUrl !== url) return;
        clearTimeout(timer);
        GM_removeValueChangeListener(listener);
        resolve(value);
      });
      timer = setTimeout(() => {
        GM_removeValueChangeListener(listener);
        reject(new Error("O anúncio demorou mais de 45 segundos. Confira a aba do Mercado Livre."));
      }, REQUEST_TIMEOUT);
      GM_setValue(COMMAND_KEY, { requestId, produtoId, titulo, url, createdAt: Date.now() });
      const features = unsafeWindow.innerWidth >= 900
        ? `popup=yes,width=620,height=850,left=${Math.max(0, unsafeWindow.screen.availWidth - 632)},top=20`
        : "";
      try {
        if (!offerWindow || offerWindow.closed) offerWindow = unsafeWindow.open(url, "ranking_conferencia_mercado_livre", features);
        else offerWindow.location.href = url;
        if (!offerWindow) throw new Error("O navegador bloqueou a janela do anúncio. Permita pop-ups para o Ranking da Compra.");
        try { offerWindow.focus(); } catch {}
      } catch (error) {
        clearTimeout(timer);
        GM_removeValueChangeListener(listener);
        reject(error);
      }
    });
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
    if (result.status === "loading" || (result.status === "ok" && !stable)) result = { status: "error", motivo: result.motivo || "O preço principal não estabilizou. Confira manualmente." };
    if (GM_getValue(COMMAND_KEY, null)?.requestId !== command.requestId || !sameOffer(command.url, location.href)) return;
    GM_setValue(RESULT_KEY, { ...result, robotVersion: BOT_VERSION, requestedUrl: command.url, requestId: command.requestId, produtoId: command.produtoId, checkedAt: Date.now() });
  }

  if (location.hostname === PANEL_HOST) {
    installPanelBridge();
    return;
  }
  if (/mercadolivre\.com\.br$/i.test(location.hostname)) {
    const run = () => void publishCurrentPageResult(GM_getValue(COMMAND_KEY, null));
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
    else run();
    GM_addValueChangeListener(COMMAND_KEY, (_key, _oldValue, command) => {
      if (command?.requestId) void publishCurrentPageResult(command);
    });
  }
})();
