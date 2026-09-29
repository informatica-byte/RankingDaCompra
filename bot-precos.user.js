// ==UserScript==
// @name         Ranking da Compra - Bot local de preços
// @namespace    https://rankingdacompra.com.br/
// @version      2.0.0
// @description  Confere preços no navegador logado, pausa em verificações humanas e entrega os resultados ao painel.
// @match        https://rankingdacompra.com.br/dashboard.html*
// @match        https://rankingdacompra.com.br/painel-celular.html*
// @match        https://*.mercadolivre.com.br/*
// @match        https://mercadolivre.com.br/*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @connect      mercadolivre.com.br
// @connect      www.mercadolivre.com.br
// @connect      produto.mercadolivre.com.br
// @connect      meli.la
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  const BOT_VERSION = "2.0.0";
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
    const text = String(value || "").trim();
    if (!text) return null;
    const normalized = text.replace(/R\$/gi, "").replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".").replace(/[^\d.]/g, "");
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
    const expectedWords = normalizeText(expectedTitle).split(" ").filter((word) => word.length >= 4);
    const found = normalizeText(foundTitle);
    if (!expectedWords.length || !found) return false;
    const matches = expectedWords.filter((word) => found.includes(word)).length;
    return matches >= Math.min(2, expectedWords.length);
  }

  function securityCheck(source) {
    return /(captcha|n[aã]o sou um rob[oô]|confirme que voc[eê] [eé] humano|verifique sua identidade|access denied|acesso negado|automated access)/i.test(source);
  }

  function unavailableCheck(source) {
    return /(este produto est[aá] indispon[ií]vel|an[uú]ncio pausado|an[uú]ncio finalizado|produto sem estoque|n[aã]o est[aá] dispon[ií]vel)/i.test(source);
  }

  function extractStructuredPrice(documentHtml) {
    const offers = [];
    for (const script of documentHtml.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(script.textContent || "null");
        walkJson(parsed, (node) => {
          if (String(node["@type"] || "").toLowerCase() !== "product") return;
          const values = Array.isArray(node.offers) ? node.offers : [node.offers];
          for (const offer of values.filter(Boolean)) offers.push(offer);
        });
      } catch {
        // Alguns anúncios possuem blocos auxiliares incompletos.
      }
    }
    for (const offer of offers) {
      const availability = String(offer.availability || "").toLowerCase();
      if (/outofstock|soldout|discontinued/.test(availability)) return { unavailable: true };
      const price = parsePrice(offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price);
      if (price) return { price, origin: "pagina_json_ld" };
    }
    return {};
  }

  function extractDocumentOffer(documentHtml, expectedTitle, finalUrl) {
    const source = String(documentHtml.body?.innerText || documentHtml.documentElement?.innerText || "");
    if (securityCheck(source)) return { status: "security", motivo: "O Mercado Livre pediu confirmação humana." };
    const pageTitle = String(
      documentHtml.querySelector('meta[property="og:title"]')?.content ||
      documentHtml.querySelector("h1")?.textContent || documentHtml.title || "",
    ).replace(/\s+/g, " ").trim();
    if (!matchingProduct(expectedTitle, pageTitle)) return { status: "loading", motivo: "A página ainda não confirmou o mesmo produto." };
    if (unavailableCheck(source)) return { status: "unavailable", tituloEncontrado: pageTitle, fonteConsultada: finalUrl };
    const structured = extractStructuredPrice(documentHtml);
    if (structured.unavailable) return { status: "unavailable", tituloEncontrado: pageTitle, fonteConsultada: finalUrl };
    if (structured.price) {
      return {
        status: "ok", preco: structured.price,
        evidencia: `Preço estruturado da página: R$ ${structured.price.toFixed(2).replace(".", ",")}`,
        tituloEncontrado: pageTitle, fonteConsultada: finalUrl, origem: structured.origin,
      };
    }
    const candidates = [
      documentHtml.querySelector('meta[property="product:price:amount"]')?.content,
      documentHtml.querySelector('[itemprop="price"]')?.getAttribute("content"),
      documentHtml.querySelector('[itemprop="price"]')?.textContent,
    ];
    for (const candidate of candidates) {
      const price = parsePrice(candidate);
      if (price) {
        return {
          status: "ok", preco: price,
          evidencia: `Preço principal da página: R$ ${price.toFixed(2).replace(".", ",")}`,
          tituloEncontrado: pageTitle, fonteConsultada: finalUrl, origem: "pagina_meta",
        };
      }
    }
    const markup = String(documentHtml.documentElement?.innerHTML || "");
    const ariaPrice = markup.match(/aria-label=["']Agora:\s*([\d.]+)\s*reais(?:\s+com\s+(\d+)\s+centavos)?/i);
    const accessiblePrice = ariaPrice
      ? parsePrice(`${ariaPrice[1]},${String(ariaPrice[2] || "00").padStart(2, "0")}`)
      : null;
    if (accessiblePrice) {
      return {
        status: "ok", preco: accessiblePrice,
        evidencia: `Preço acessível da página: R$ ${accessiblePrice.toFixed(2).replace(".", ",")}`,
        tituloEncontrado: pageTitle, fonteConsultada: finalUrl, origem: "pagina_aria",
      };
    }
    return { status: "loading", motivo: "O preço principal ainda não apareceu." };
  }

  function extractOffer(html, expectedTitle, finalUrl) {
    const source = String(html || "");
    if (!source || source.length < 5000) throw new Error("A página retornou conteúdo insuficiente.");
    if (securityCheck(source)) throw new Error("O Mercado Livre solicitou uma verificação de segurança. Abra a oferta manualmente e tente novamente depois.");
    const documentHtml = new DOMParser().parseFromString(source, "text/html");
    const result = extractDocumentOffer(documentHtml, expectedTitle, finalUrl);
    if (result.status === "ok") return result;
    if (result.status === "unavailable") throw new Error("O anúncio está sem estoque ou encerrado.");
    throw new Error(result.motivo || "O bot não encontrou um preço principal que pudesse ser comprovado.");
  }

  function fetchOffer(url, expectedTitle) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET", url, timeout: 25000,
        headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "pt-BR,pt;q=0.9" },
        onload(response) {
          if (response.status < 200 || response.status >= 400) return reject(new Error(`Mercado Livre respondeu HTTP ${response.status}.`));
          try { resolve(extractOffer(response.responseText, expectedTitle, response.finalUrl || url)); }
          catch (error) { reject(error); }
        },
        ontimeout() { reject(new Error("A página demorou demais para responder.")); },
        onerror() { reject(new Error("Não foi possível abrir a página pelo navegador.")); },
      });
    });
  }

  function installPanelBridge() {
    let offerWindow = null;
    unsafeWindow.__RDC_BOT_PRECOS_LOCAL__ = { version: BOT_VERSION, ready: true, assisted: true };
    unsafeWindow.conferirPrecoPelaFonteLocal = async ({ titulo, url }) => {
      if (!/^https?:\/\//i.test(String(url || ""))) throw new Error("O produto não possui um link público utilizável.");
      return fetchOffer(String(url), String(titulo || ""));
    };
    unsafeWindow.conferirPrecoNaAbaLocal = ({ produtoId, titulo, url }) => new Promise((resolve, reject) => {
      if (!/^https:\/\/(?:[^/]+\.)?mercadolivre\.com\.br\//i.test(String(url || ""))) {
        reject(new Error("O produto não possui um link completo do Mercado Livre."));
        return;
      }
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let timer = 0;
      const listener = GM_addValueChangeListener(RESULT_KEY, (_key, _oldValue, value) => {
        if (!value || value.requestId !== requestId) return;
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
    const deadline = Date.now() + 18000;
    let result = { status: "loading" };
    while (Date.now() < deadline) {
      result = extractDocumentOffer(document, command.titulo, location.href);
      if (result.status !== "loading") break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (result.status === "loading") result = { status: "error", motivo: result.motivo || "O preço principal não apareceu." };
    GM_setValue(RESULT_KEY, { ...result, requestId: command.requestId, produtoId: command.produtoId, checkedAt: Date.now() });
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
