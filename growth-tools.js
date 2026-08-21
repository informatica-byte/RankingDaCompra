(() => {
  "use strict";

  const SITE = "https://rankingdacompra.com.br";
  const HISTORY_URL = "/historico-precos.json";
  const HISTORY_DAYS = 30;
  const STYLE_ID = "ranking-growth-tools-style";
  const CONFIG_DOC = "site";
  const CONFIG_COLLECTION = "configuracoes";
  const HISTORY_CACHE_MS = 15 * 60 * 1000;

  const state = {
    history: null,
    config: null,
    decorated: new WeakSet()
  };

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const dateBr = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

  function todayKey() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
  }

  function numberPrice(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const raw = String(value ?? "").trim().replace(/[^\d,.-]/g, "");
    if (!raw) return 0;
    const normalized = raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function productIdFromUrl(value) {
    try {
      const filename = decodeURIComponent(new URL(value, location.href).pathname.split("/").pop() || "");
      return filename.replace(/-\d{8}-\d+\.html$/i, "").replace(/\.html$/i, "");
    } catch {
      return "";
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .offer-proof{margin:10px 0 3px;padding:10px 11px;border:1px solid #8fd0a9;background:#eefaf3;color:#164e35;border-radius:10px;font-size:.76rem;line-height:1.38}
      .offer-proof strong{display:block;color:#087a3d;font-size:.82rem;margin-bottom:2px}
      .offer-proof small{display:block;color:#557065;font-size:.69rem;margin-top:3px}
      .offer-proof.is-learning{border-color:#dfcb7b;background:#fff9df;color:#6f5a0a}
      .offer-proof.is-learning strong{color:#725900}
      .club-whatsapp{width:min(1180px,calc(100% - 32px));margin:24px auto;padding:22px;border:1px solid #98d7af;border-radius:18px;background:linear-gradient(135deg,#eaf9ef,#fff);display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;box-shadow:0 12px 34px rgba(17,97,73,.09)}
      .club-whatsapp h2{margin:0 0 6px;color:#0f5132;font-size:clamp(1.25rem,3vw,1.8rem)}
      .club-whatsapp p{margin:0;color:#4f665c;max-width:720px}
      .club-whatsapp a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:12px 20px;border-radius:12px;background:#168a48;color:#fff;text-decoration:none;font-weight:900;box-shadow:0 8px 20px rgba(22,138,72,.2)}
      .club-whatsapp a:hover{background:#10733b}
      .club-floating{position:fixed;right:18px;bottom:18px;z-index:850;display:inline-flex;align-items:center;gap:7px;padding:12px 15px;border-radius:999px;background:#168a48;color:#fff;text-decoration:none;font-weight:900;box-shadow:0 12px 32px rgba(0,0,0,.22)}
      .growth-admin{margin:24px 0;padding:20px;border:1px solid #96c9aa;border-radius:14px;background:#f1fbf5}
      .growth-admin h2{margin:0 0 5px;color:#0b5b39}.growth-admin p{color:#54675e;margin:0 0 13px}
      .growth-admin label{display:block;font-weight:850;margin:10px 0 5px}.growth-admin input[type=url]{width:100%;padding:11px;border:1px solid #afc9b9;border-radius:8px;font:inherit}
      .growth-admin .growth-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:12px}
      .growth-admin button,.growth-admin a{border:0;border-radius:8px;padding:10px 14px;font:inherit;font-weight:850;cursor:pointer;text-decoration:none}
      .growth-admin button{background:#087a3d;color:#fff}.growth-admin a{background:#fff;color:#0b5b39;border:1px solid #9dc6ae}
      .growth-admin-status{min-height:1.3em;margin-top:10px!important;font-weight:800!important;color:#0b6b3a!important}
      @media(max-width:700px){.club-whatsapp{grid-template-columns:1fr}.club-whatsapp a{width:100%}.club-floating{right:12px;bottom:12px;font-size:.82rem}}
    `;
    document.head.appendChild(style);
  }

  async function loadHistory() {
    if (state.history) return state.history;
    const cacheKey = "ranking-price-history-cache";
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      if (cached?.savedAt && Date.now() - cached.savedAt < HISTORY_CACHE_MS && cached.data) {
        state.history = cached.data;
        return state.history;
      }
    } catch {}
    try {
      const response = await fetch(`${HISTORY_URL}?v=${encodeURIComponent(todayKey())}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.history = await response.json();
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data: state.history })); } catch {}
    } catch (error) {
      console.warn("Histórico de preços temporariamente indisponível.", error);
      state.history = { products: {} };
    }
    return state.history;
  }

  function historySummary(id, currentPrice = 0) {
    const item = state.history?.products?.[id];
    const points = Array.isArray(item?.points) ? item.points
      .map(point => ({ date: String(point?.[0] || ""), price: numberPrice(point?.[1]) }))
      .filter(point => point.date && point.price > 0)
      .sort((a, b) => a.date.localeCompare(b.date)) : [];
    const prices = points.map(point => point.price);
    if (currentPrice > 0) prices.push(currentPrice);
    const minimum = prices.length ? Math.min(...prices) : 0;
    const latest = points.at(-1) || null;
    return { item, points, minimum, latest, currentPrice: currentPrice || latest?.price || 0 };
  }

  function currentPriceFromCard(card) {
    const preferred = card.querySelector(".deal-price,.weekly-price,.offer strong");
    if (preferred) return numberPrice(preferred.textContent);
    const candidates = [...card.querySelectorAll("strong,.price")].map(el => numberPrice(el.textContent)).filter(Boolean);
    return candidates.at(-1) || 0;
  }

  function proofMarkup(summary) {
    if (!summary.points.length && !summary.currentPrice) return "";
    const lastDate = summary.latest?.date;
    const dateText = lastDate ? dateBr.format(new Date(`${lastDate}T12:00:00-03:00`)) : "hoje";
    const enough = summary.points.length >= 2;
    const atMinimum = summary.minimum > 0 && summary.currentPrice > 0 && summary.currentPrice <= summary.minimum + 0.009;
    const title = enough
      ? (atMinimum ? "✓ Oferta comprovada — menor preço registrado" : "✓ Oferta comprovada pelo histórico")
      : "✓ Preço registrado — histórico iniciado";
    const detail = summary.minimum > 0
      ? `Menor preço em até ${HISTORY_DAYS} dias: ${brl.format(summary.minimum)}`
      : "Estamos formando o histórico deste produto.";
    return `<div class="offer-proof${enough ? "" : " is-learning"}" data-offer-proof><strong>${escapeHtml(title)}</strong>${escapeHtml(detail)}<small>Último registro: ${escapeHtml(dateText)} · confirme o valor final no Mercado Livre.</small></div>`;
  }

  function decorateProductCard(card) {
    if (!card || state.decorated.has(card) || card.querySelector("[data-offer-proof]")) return;
    const link = card.matches?.('a[href*="/produto/"]') ? card : card.querySelector('a[href*="/produto/"]');
    const id = productIdFromUrl(link?.href || location.href);
    if (!id || !state.history?.products?.[id]) return;
    const summary = historySummary(id, currentPriceFromCard(card));
    const markup = proofMarkup(summary);
    if (!markup) return;
    const target = card.querySelector(".deal-prices,.flash-timer,.offer") || card.querySelector("h3,h1");
    if (!target) return;
    if (target.classList.contains("offer")) target.insertAdjacentHTML("beforeend", markup);
    else target.insertAdjacentHTML("afterend", markup);
    state.decorated.add(card);
  }

  function decorateVisibleProducts() {
    document.querySelectorAll("article,.deal-card,.product-card-wrap").forEach(decorateProductCard);
  }

  async function loadConfig() {
    if (state.config) return state.config;
    let config = null;
    try {
      if (typeof db !== "undefined") {
        const doc = await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get();
        if (doc.exists) config = doc.data();
      }
    } catch (error) {
      console.warn("Não foi possível ler a configuração do Clube de Ofertas.", error);
    }
    if (!config) {
      try {
        const response = await fetch("/site-config.json", { cache: "no-store" });
        if (response.ok) config = await response.json();
      } catch {}
    }
    state.config = config || {};
    return state.config;
  }

  function validWhatsAppUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return url.protocol === "https:" && /(^|\.)((chat\.)?whatsapp\.com|wa\.me)$/i.test(url.hostname);
    } catch { return false; }
  }

  function trackClubClick(place) {
    try { window.gtag?.("event", "join_whatsapp_club", { placement: place }); } catch {}
    try {
      if (typeof window.registrarMetricaComercial === "function") {
        window.registrarMetricaComercial("clique_clube_whatsapp", { id: "clube", titulo: "Clube de Ofertas" }, "whatsapp");
      }
    } catch {}
  }

  function renderClub(config) {
    const url = String(config?.whatsappClubUrl || "").trim();
    if (config?.whatsappClubEnabled === false || !validWhatsAppUrl(url) || document.querySelector("[data-whatsapp-club]")) return;
    const section = document.createElement("section");
    section.className = "club-whatsapp";
    section.dataset.whatsappClub = "section";
    section.innerHTML = `<div><h2>💚 Clube de Ofertas no WhatsApp</h2><p>Receba somente as promoções mais fortes, cupons e ofertas relâmpago verificadas pelo Ranking da Compra.</p></div><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" data-club-place="section">Entrar gratuitamente</a>`;
    const hero = document.querySelector(".hero,header + section,main");
    if (hero?.parentNode) hero.insertAdjacentElement(hero.matches("main") ? "beforebegin" : "afterend", section);
    else document.body.prepend(section);
    const floating = document.createElement("a");
    floating.className = "club-floating";
    floating.dataset.whatsappClub = "floating";
    floating.dataset.clubPlace = "floating";
    floating.href = url;
    floating.target = "_blank";
    floating.rel = "noopener noreferrer";
    floating.textContent = "WhatsApp · receber ofertas";
    document.body.appendChild(floating);
    document.querySelectorAll("[data-club-place]").forEach(link => link.addEventListener("click", () => trackClubClick(link.dataset.clubPlace)));
  }

  async function renderAdmin() {
    if (!/dashboard\.html$/i.test(location.pathname) || document.getElementById("growth-admin")) return false;
    const logout = [...document.querySelectorAll("button,a")].find(el => /sair do sistema/i.test(el.textContent || ""));
    if (!logout) return false;
    const container = document.createElement("section");
    container.id = "growth-admin";
    container.className = "growth-admin";
    container.innerHTML = `
      <h2>💚 Clube de Ofertas no WhatsApp</h2>
      <p>Cole o link de convite do seu canal ou grupo. Depois de salvar, o convite aparecerá automaticamente na vitrine.</p>
      <label for="growth-whatsapp-url">Link de convite do WhatsApp</label>
      <input id="growth-whatsapp-url" type="url" inputmode="url" placeholder="https://whatsapp.com/channel/... ou https://chat.whatsapp.com/...">
      <div class="growth-row"><label><input id="growth-whatsapp-enabled" type="checkbox" checked> Exibir o Clube na vitrine</label></div>
      <div class="growth-row"><button id="growth-whatsapp-save" type="button">Salvar Clube de Ofertas</button><a id="growth-whatsapp-test" href="#" target="_blank" rel="noopener noreferrer">Testar link</a></div>
      <p class="growth-admin-status" id="growth-admin-status" role="status" aria-live="polite"></p>`;
    const anchor = logout?.closest("section,div") || document.querySelector("main") || document.body;
    if (logout?.parentNode) logout.parentNode.insertBefore(container, logout);
    else anchor.appendChild(container);

    const input = container.querySelector("#growth-whatsapp-url");
    const enabled = container.querySelector("#growth-whatsapp-enabled");
    const test = container.querySelector("#growth-whatsapp-test");
    const status = container.querySelector("#growth-admin-status");
    const config = await loadConfig();
    input.value = config?.whatsappClubUrl || "";
    enabled.checked = config?.whatsappClubEnabled !== false;
    test.href = validWhatsAppUrl(input.value) ? input.value : "#";
    input.addEventListener("input", () => { test.href = validWhatsAppUrl(input.value) ? input.value : "#"; });
    container.querySelector("#growth-whatsapp-save").addEventListener("click", async event => {
      const button = event.currentTarget;
      const value = input.value.trim();
      if (value && !validWhatsAppUrl(value)) {
        status.textContent = "Use um link oficial do WhatsApp: whatsapp.com, chat.whatsapp.com ou wa.me.";
        return;
      }
      if (typeof db === "undefined") {
        status.textContent = "O banco de dados ainda não carregou. Atualize o painel e tente novamente.";
        return;
      }
      button.disabled = true;
      status.textContent = "Salvando...";
      try {
        await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).set({
          whatsappClubUrl: value,
          whatsappClubEnabled: enabled.checked,
          whatsappClubUpdatedAt: typeof firebase !== "undefined" ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
        }, { merge: true });
        state.config = { ...(state.config || {}), whatsappClubUrl: value, whatsappClubEnabled: enabled.checked };
        status.textContent = value ? "✓ Clube salvo. O convite já pode aparecer na vitrine." : "✓ Configuração salva. O convite ficará oculto até você informar um link.";
      } catch (error) {
        console.error(error);
        status.textContent = "Não foi possível salvar. Confirme se você está conectado ao painel.";
      } finally { button.disabled = false; }
    });
    return true;
  }

  async function init() {
    injectStyles();
    if (/dashboard\.html$/i.test(location.pathname)) {
      if (await renderAdmin()) return;
      const observer = new MutationObserver(async () => {
        if (await renderAdmin()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 120000);
      return;
    }
    await Promise.all([loadHistory(), loadConfig()]);
    decorateVisibleProducts();
    renderClub(state.config);
    const observer = new MutationObserver(() => decorateVisibleProducts());
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
