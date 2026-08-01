// ==UserScript==
// @name         Ranking da Compra - Bot local de preços
// @namespace    https://rankingdacompra.com.br/
// @version      1.0.0
// @description  Confere preços do Mercado Livre pelo navegador e entrega os resultados ao painel administrativo.
// @match        https://rankingdacompra.com.br/dashboard.html*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      mercadolivre.com.br
// @connect      www.mercadolivre.com.br
// @connect      produto.mercadolivre.com.br
// @connect      meli.la
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  const BOT_VERSION = "1.0.0";
  const REQUEST_TIMEOUT = 25000;

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parsePrice(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) && value > 0 ? value : null;
    }
    const text = String(value || "").trim();
    if (!text) return null;
    const normalized = text
      .replace(/R\$/gi, "")
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".")
      .replace(/[^\d.]/g, "");
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
    const expectedWords = normalizeText(expectedTitle)
      .split(" ")
      .filter((word) => word.length >= 4);
    const found = normalizeText(foundTitle);
    if (!expectedWords.length || !found) return false;
    const matches = expectedWords.filter((word) => found.includes(word)).length;
    return matches >= Math.min(2, expectedWords.length);
  }

  function extractOffer(html, expectedTitle, finalUrl) {
    const source = String(html || "");
    if (!source || source.length < 5000) {
      throw new Error("A página retornou conteúdo insuficiente.");
    }
    if (/(captcha|não sou um robô|nao sou um robo|access denied|acesso negado|automated access)/i.test(source)) {
      throw new Error("O Mercado Livre solicitou uma verificação de segurança. Abra a oferta manualmente e tente novamente depois.");
    }

    const documentHtml = new DOMParser().parseFromString(source, "text/html");
    const pageTitle = String(
      documentHtml.querySelector('meta[property="og:title"]')?.content ||
      documentHtml.querySelector("h1")?.textContent ||
      documentHtml.title ||
      "",
    ).replace(/\s+/g, " ").trim();

    if (!matchingProduct(expectedTitle, pageTitle)) {
      throw new Error("A página aberta não comprovou que se trata do mesmo produto.");
    }

    const structuredOffers = [];
    for (const script of documentHtml.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(script.textContent || "null");
        walkJson(parsed, (node) => {
          if (String(node["@type"] || "").toLowerCase() !== "product") return;
          const offers = Array.isArray(node.offers) ? node.offers : [node.offers];
          for (const offer of offers.filter(Boolean)) structuredOffers.push(offer);
        });
      } catch {
        // Alguns anúncios incluem blocos incompletos; os metadados abaixo continuam disponíveis.
      }
    }

    for (const offer of structuredOffers) {
      const availability = String(offer.availability || "").toLowerCase();
      if (/outofstock|soldout|discontinued/.test(availability)) {
        throw new Error("O anúncio está sem estoque ou encerrado.");
      }
      const price = parsePrice(offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price);
      if (price) {
        return {
          preco: price,
          evidencia: `Preço estruturado da oferta: R$ ${price.toFixed(2).replace(".", ",")}`,
          tituloEncontrado: pageTitle,
          fonteConsultada: finalUrl,
          origem: "bot_local_json_ld",
        };
      }
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
          preco: price,
          evidencia: `Preço principal encontrado: R$ ${price.toFixed(2).replace(".", ",")}`,
          tituloEncontrado: pageTitle,
          fonteConsultada: finalUrl,
          origem: "bot_local_meta",
        };
      }
    }

    const ariaPrice = source.match(/aria-label=["']Agora:\s*([\d.]+)\s*reais(?:\s+com\s+(\d+)\s+centavos)?/i);
    const price = ariaPrice
      ? parsePrice(`${ariaPrice[1]},${String(ariaPrice[2] || "00").padStart(2, "0")}`)
      : null;
    if (price) {
      return {
        preco: price,
        evidencia: `Preço principal da página: R$ ${price.toFixed(2).replace(".", ",")}`,
        tituloEncontrado: pageTitle,
        fonteConsultada: finalUrl,
        origem: "bot_local_aria",
      };
    }

    throw new Error("O bot não encontrou um preço principal que pudesse ser comprovado.");
  }

  function fetchOffer(url, expectedTitle) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: REQUEST_TIMEOUT,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
        onload(response) {
          if (response.status < 200 || response.status >= 400) {
            reject(new Error(`Mercado Livre respondeu HTTP ${response.status}.`));
            return;
          }
          try {
            resolve(extractOffer(response.responseText, expectedTitle, response.finalUrl || url));
          } catch (error) {
            reject(error);
          }
        },
        ontimeout() {
          reject(new Error("A página demorou demais para responder."));
        },
        onerror() {
          reject(new Error("Não foi possível abrir a página pelo navegador."));
        },
      });
    });
  }

  unsafeWindow.__RDC_BOT_PRECOS_LOCAL__ = {
    version: BOT_VERSION,
    ready: true,
  };
  unsafeWindow.conferirPrecoPelaFonteLocal = async ({ titulo, url }) => {
    if (!/^https?:\/\//i.test(String(url || ""))) {
      throw new Error("O produto não possui um link público utilizável.");
    }
    return fetchOffer(String(url), String(titulo || ""));
  };
})();
