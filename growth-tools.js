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

  const SEASONAL_THEMES = {
    "ano-novo": { name: "Ano-Novo", icon: "✨", title: "Um novo ano de boas escolhas", message: "Comece o ano economizando em produtos selecionados para renovar sua rotina.", colors: ["#071a2e", "#164e63", "#f6c85f"], particles: ["✨", "✦", "NOVO", "✧", "✨", "✦"] },
    "volta-aulas": { name: "Volta às aulas", icon: "🎒", title: "Volta às aulas com economia", message: "Materiais, tecnologia e itens úteis para estudar melhor sem pesar no orçamento.", colors: ["#123c69", "#1f8a70", "#ffd166"], particles: ["✏️", "📚", "📐", "⭐", "📝", "🎒"] },
    carnaval: { name: "Carnaval", icon: "🎭", title: "Carnaval de ofertas", message: "Uma seleção alegre e colorida para aproveitar preços que entram no ritmo da economia.", colors: ["#6a0572", "#e91e63", "#ffd600"], particles: ["🎊", "✨", "🎭", "🎉", "💜", "💛"] },
    consumidor: { name: "Dia do Consumidor", icon: "🛍️", title: "Semana do Consumidor", message: "Ofertas selecionadas com histórico de preço e transparência para você decidir melhor.", colors: ["#063970", "#0b7fab", "#7de2d1"], particles: ["%", "✓", "🛍️", "★", "%", "✓"] },
    pascoa: { name: "Páscoa", icon: "🐰", title: "Páscoa cheia de boas escolhas", message: "Ofertas especiais para presentear, celebrar e economizar nesta época tão doce.", colors: ["#5b2c6f", "#b565a7", "#f8d7e8"], particles: ["🐰", "🥚", "🌷", "✨", "🍫", "🐣"] },
    maes: { name: "Dia das Mães", icon: "💐", title: "Presentes para quem merece tudo", message: "Uma seleção carinhosa de oportunidades para surpreender sua mãe gastando melhor.", colors: ["#7d2948", "#c94c78", "#ffd6e3"], particles: ["🌷", "💗", "💐", "✨", "🌸", "♥"] },
    namorados: { name: "Dia dos Namorados", icon: "💝", title: "Ofertas para celebrar o amor", message: "Presentes especiais para todos os estilos, escolhidos para encantar sem complicação.", colors: ["#6e1235", "#d6295d", "#ffcad8"], particles: ["♥", "💝", "✨", "💕", "🌹", "♥"] },
    "festa-junina": { name: "Festa Junina", icon: "🌽", title: "Arraiá de ofertas boas demais", message: "Prepare a festa e aproveite uma seleção arretada de preços e oportunidades.", colors: ["#7a3218", "#d2691e", "#ffd166"], particles: ["🌽", "🔥", "🎏", "⭐", "🤠", "🌻"] },
    pais: { name: "Dia dos Pais", icon: "💙", title: "Boas escolhas para um pai incrível", message: "Tecnologia, ferramentas e presentes selecionados para acertar na homenagem.", colors: ["#0c2d48", "#145da0", "#b1d4e0"], particles: ["💙", "⭐", "🎁", "✨", "🏆", "💙"] },
    criancas: { name: "Dia das Crianças", icon: "🧸", title: "Diversão para todas as idades", message: "Brinquedos, jogos e presentes escolhidos para tornar o Dia das Crianças inesquecível.", colors: ["#5b2a86", "#f05d5e", "#ffd166"], particles: ["🎈", "🧸", "⭐", "🎮", "🎨", "🚀"] },
    "black-friday": { name: "Black Friday", icon: "⚡", title: "Black Friday sem preço maquiado", message: "Compare o histórico e encontre as oportunidades que realmente merecem sua atenção.", colors: ["#050505", "#262626", "#f7c948"], particles: ["⚡", "%", "BLACK", "★", "%", "⚡"] },
    natal: { name: "Natal", icon: "🎄", title: "Natal de presentes e boas escolhas", message: "Encontre oportunidades para presentear toda a família com carinho e economia.", colors: ["#064e3b", "#a4161a", "#f6c85f"], particles: ["❄", "🎄", "✦", "🎁", "❄", "⭐"] }
  };

  const RANKI_THEME_IMAGES = Object.fromEntries(
    Object.keys(SEASONAL_THEMES).map(id => [id, `/assets/ranki/${id}.png`])
  );
  let rankiPreviousFocus = null;

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

  const METRICS_FIREBASE_CONFIG = {
    apiKey: "AIzaSyChRBmFfokCPPec7oTdC1u9obQg6M83Epk",
    authDomain: "rankingdacompra.firebaseapp.com",
    projectId: "rankingdacompra",
    storageBucket: "rankingdacompra.firebasestorage.app",
    messagingSenderId: "300637600463",
    appId: "1:300637600463:web:671c78dc47d5f8b39f15ba"
  };
  const METRICS_VIEW_INTERVAL_MS = 30 * 60 * 1000;
  let metricsDbPromise = null;

  function loadMetricsScript(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const absolute = new URL(src, location.href).href;
      const existing = [...document.scripts].find(script => script.src === absolute);
      const script = existing || document.createElement("script");
      const done = () => ready() ? resolve() : reject(new Error("Biblioteca de métricas indisponível."));
      script.addEventListener("load", done, { once: true });
      script.addEventListener("error", () => reject(new Error("Falha ao carregar métricas.")), { once: true });
      if (!existing) {
        script.src = src;
        script.async = true;
        document.head.appendChild(script);
      } else if (ready()) {
        resolve();
      }
    });
  }

  async function metricsDb() {
    if (metricsDbPromise) return metricsDbPromise;
    metricsDbPromise = (async () => {
      await loadMetricsScript(
        "https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js",
        () => Boolean(window.firebase)
      );
      await loadMetricsScript(
        "https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js",
        () => Boolean(window.firebase?.firestore)
      );
      if (!window.firebase.apps.length) window.firebase.initializeApp(METRICS_FIREBASE_CONFIG);
      return window.firebase.firestore();
    })().catch(error => {
      metricsDbPromise = null;
      throw error;
    });
    return metricsDbPromise;
  }

  function funnelProduct(link) {
    const categoryFact = [...document.querySelectorAll(".fact")].find(item =>
      /^categoria$/i.test(item.querySelector("span")?.textContent?.trim() || "")
    );
    const title = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() || "Produto";
    const category = categoryFact?.textContent?.replace(/categoria/i, "").replace(/\s+/g, " ").trim() || "";
    return {
      id: String(link?.dataset?.productId || productIdFromUrl(location.href)).slice(0, 100),
      title: String(link?.dataset?.productTitle || title).slice(0, 180),
      category: String(link?.dataset?.productCategory || category).slice(0, 100)
    };
  }

  function funnelSource() {
    const params = new URLSearchParams(location.search);
    const tagged = params.get("utm_source");
    if (tagged) return String(tagged).slice(0, 40);
    try {
      if (!document.referrer) return "direto";
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      return host === location.hostname.replace(/^www\./, "") ? "site" : host.slice(0, 40);
    } catch {
      return "direto";
    }
  }

  async function recordFunnelMetric(type, link, channel = "") {
    const product = funnelProduct(link);
    if (!product.id) return;
    const params = new URLSearchParams(location.search);
    const database = await metricsDb();
    await database.collection("visitas").add({
      tipo: String(type).slice(0, 40),
      produtoId: product.id,
      titulo: product.title,
      categoria: product.category,
      canal: String(channel || funnelSource()).slice(0, 40),
      campanha: String(params.get("utm_campaign") || "site").slice(0, 80),
      dia: todayKey(),
      origem: location.pathname.slice(0, 80),
      criadoEm: window.firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function setupFunnelTracking() {
    if (document.documentElement.dataset.funnelTrackingReady) return;
    document.documentElement.dataset.funnelTrackingReady = "true";
    document.addEventListener("click", event => {
      const offer = event.target.closest?.("#affiliate-offer");
      if (!offer) return;
      void recordFunnelMetric("clique_oferta", offer).catch(error =>
        console.warn("Não foi possível registrar o clique comercial.", error)
      );
    });
    const offer = document.getElementById("affiliate-offer");
    if (!offer) return;
    const product = funnelProduct(offer);
    const storageKey = "ranking-funnel-view:" + product.id;
    let lastView = 0;
    try { lastView = Number(localStorage.getItem(storageKey) || 0); } catch {}
    if (Date.now() - lastView < METRICS_VIEW_INTERVAL_MS) return;
    const register = () => void recordFunnelMetric("clique_secao", offer, "view:" + funnelSource())
      .then(() => { try { localStorage.setItem(storageKey, String(Date.now())); } catch {} })
      .catch(error => console.warn("Não foi possível registrar a visualização comercial.", error));
    if ("requestIdleCallback" in window) window.requestIdleCallback(register, { timeout: 2500 });
    else setTimeout(register, 1200);
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

  function repairPortugueseText(value) {
    return String(value || "")
      .replace(/Informa\uFFFD+es/gi, "Informações")
      .replace(/Caracter\uFFFDsticas/gi, "Características")
      .replace(/Condi\uFFFD+o/gi, "Condição")
      .replace(/extra\uFFFDdas/gi, "extraídas")
      .replace(/p\uFFFDblicos/gi, "públicos")
      .replace(/an\uFFFDncio/gi, "anúncio")
      .replace(/pre\uFFFDo/gi, "preço")
      .replace(/varia\uFFFD+es/gi, "variações")
      .replace(/n\uFFFDo/gi, "não")
      .replace(/\uFFFD+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizedWords(value) {
    return repairPortugueseText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(word => word.length > 2);
  }

  function repairVisibleEditorial() {
    document.querySelectorAll(".summary,.panel li").forEach(element => {
      const repaired = repairPortugueseText(element.textContent);
      if (repaired && repaired !== element.textContent.trim()) element.textContent = repaired;
    });
    const titleWords = new Set(normalizedWords(document.querySelector(".top h1,.detail h1")?.textContent));
    document.querySelectorAll(".panels .panel,.detail-sections .panel").forEach(panel => {
      const items = [...panel.querySelectorAll("li")];
      items.forEach(item => {
        const text = repairPortugueseText(item.textContent);
        const words = normalizedWords(text);
        const overlap = words.length ? words.filter(word => titleWords.has(word)).length / words.length : 1;
        const generic = /informa[cç][oõ]es? (?:extra[ií]das?|obtidas?)|dados p[uú]blicos|recursos descritos|produto identificado/i.test(text);
        if (text.length < 18 || words.length < 3 || generic || overlap >= 0.8) item.remove();
      });
      const list = panel.querySelector("ul");
      if (list && !list.querySelector("li")) {
        const fallback = document.createElement("li");
        fallback.textContent = panel.classList.contains("positive")
          ? "A ficha cadastrada ainda não traz pontos positivos específicos suficientes."
          : "Confirme compatibilidade, garantia, frete e vendedor antes da compra.";
        list.appendChild(fallback);
      }
    });
    const rating = document.querySelector(".rating");
    if (rating && /Nota editorial:/i.test(rating.textContent) && !rating.querySelector("a")) {
      rating.firstChild.textContent = rating.firstChild.textContent.replace(/Nota editorial:/i, "Custo-benefício editorial:");
      rating.append(" · ");
      const method = document.createElement("a");
      method.href = `${SITE}/como-avaliamos.html`;
      method.textContent = "entenda a avaliação";
      rating.appendChild(method);
    }
  }

  function dateAtNoon(year, month, day) {
    return new Date(year, month, day, 12, 0, 0, 0);
  }

  function easterDate(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = (h + l - 7 * m + 114) % 31 + 1;
    return dateAtNoon(year, month, day);
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function nthWeekday(year, month, weekday, occurrence) {
    const first = dateAtNoon(year, month, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return dateAtNoon(year, month, 1 + offset + (occurrence - 1) * 7);
  }

  function betweenDates(date, start, end) {
    const time = date.getTime();
    return time >= start.getTime() && time <= end.getTime();
  }

  function automaticThemeId(now = new Date()) {
    const year = now.getFullYear(), month = now.getMonth(), day = now.getDate();
    if ((month === 11 && day >= 27) || (month === 0 && day <= 6)) return "ano-novo";
    if ((month === 0 && day >= 15) || (month === 1 && day <= 15)) return "volta-aulas";
    const easter = easterDate(year);
    if (betweenDates(now, addDays(easter, -55), addDays(easter, -46))) return "carnaval";
    if (month === 2 && day >= 8 && day <= 15) return "consumidor";
    if (betweenDates(now, addDays(easter, -14), easter)) return "pascoa";
    const mothersDay = nthWeekday(year, 4, 0, 2);
    if (betweenDates(now, addDays(mothersDay, -14), mothersDay)) return "maes";
    if (month === 5 && day <= 12) return "namorados";
    if (month === 5 && day >= 13) return "festa-junina";
    const fathersDay = nthWeekday(year, 7, 0, 2);
    if (betweenDates(now, addDays(fathersDay, -14), fathersDay)) return "pais";
    if (month === 9 && day <= 12) return "criancas";
    const blackFriday = nthWeekday(year, 10, 5, 4);
    if (betweenDates(now, dateAtNoon(year, 10, 15), addDays(blackFriday, 3))) return "black-friday";
    if (month === 11 && day <= 26) return "natal";
    return "";
  }

  function configuredThemeId(config, now = new Date()) {
    const preview = new URLSearchParams(location.search).get("tema-preview");
    if (SEASONAL_THEMES[preview]) return preview;
    const mode = String(config?.seasonalThemeMode || "off");
    if (mode === "auto") return automaticThemeId(now);
    if (mode !== "manual") return "";
    const id = String(config?.seasonalThemeId || "");
    if (!SEASONAL_THEMES[id]) return "";
    const today = todayKey();
    const start = String(config?.seasonalThemeStart || "");
    const end = String(config?.seasonalThemeEnd || "");
    if ((start && today < start) || (end && today > end)) return "";
    return id;
  }

  function renderSeasonalTheme(config) {
    document.querySelector("[data-seasonal-banner]")?.remove();
    document.body.removeAttribute("data-seasonal-theme");
    for (const property of ["--seasonal-a", "--seasonal-b", "--seasonal-accent"]) document.body.style.removeProperty(property);
    const id = configuredThemeId(config);
    const theme = SEASONAL_THEMES[id];
    updateMascotTheme(theme ? id : "");
    if (!theme || /dashboard\.html|painel-celular\.html/i.test(location.pathname)) return;
    document.body.dataset.seasonalTheme = id;
    document.body.style.setProperty("--seasonal-a", theme.colors[0]);
    document.body.style.setProperty("--seasonal-b", theme.colors[1]);
    document.body.style.setProperty("--seasonal-accent", theme.colors[2]);
    const banner = document.createElement("section");
    banner.className = "seasonal-banner";
    banner.dataset.seasonalBanner = id;
    banner.style.setProperty("--season-a", theme.colors[0]);
    banner.style.setProperty("--season-b", theme.colors[1]);
    banner.style.setProperty("--season-accent", theme.colors[2]);
    banner.innerHTML = `<div class="seasonal-banner-inner"><div class="seasonal-icon" aria-hidden="true">${escapeHtml(theme.icon)}</div><div class="seasonal-copy"><small>${escapeHtml(theme.name)} no Ranking da Compra</small><h2>${escapeHtml(theme.title)}</h2><p>${escapeHtml(theme.message)}</p></div><a class="seasonal-cta" href="#promocoes">Ver ofertas da temporada</a></div>${theme.particles.map((particle) => `<span class="seasonal-particle" aria-hidden="true">${escapeHtml(particle)}</span>`).join("")}`;
    const hero = document.querySelector(".hero");
    if (hero) hero.insertAdjacentElement("afterend", banner);
    else (document.querySelector("header") || document.body.firstElementChild)?.insertAdjacentElement("afterend", banner);
  }

  function updateMascotTheme(id = "") {
    const image = document.querySelector("[data-ranki-image]");
    if (!image) return;
    const theme = SEASONAL_THEMES[id];
    image.src = RANKI_THEME_IMAGES[id] || "/ranki.png";
    image.width = theme ? 362 : 512;
    image.height = theme ? 362 : 768;
    image.alt = theme
      ? `Ranki com roupa de ${theme.name}, assistente de ofertas do Ranking da Compra`
      : "Ranki, a raposa assistente de ofertas do Ranking da Compra";
    image.closest("[data-ranki-mascot]")?.toggleAttribute("data-ranki-themed", Boolean(theme));
  }

  function renderMascot() {
    const hero = document.querySelector(".hero");
    const wrap = hero?.querySelector(".wrap");
    if (!wrap || wrap.querySelector("[data-ranki-mascot]") || /dashboard\.html|painel-celular\.html/i.test(location.pathname)) return;
    const mascot = document.createElement("div");
    mascot.className = "ranki-hero";
    mascot.dataset.rankiMascot = "hero";
    mascot.innerHTML = `<button class="ranki-trigger" type="button" aria-expanded="false" aria-controls="ranki-help" aria-label="Abrir o Ranki Ajuda"><img src="/ranki.png" width="512" height="768" decoding="async" alt="Ranki, a raposa assistente de ofertas do Ranking da Compra" data-ranki-image><span class="ranki-caption"><strong>Ranki</strong><span>posso ajudar?</span></span></button>`;
    wrap.appendChild(mascot);
    updateMascotTheme(document.body.dataset.seasonalTheme || "");
    ensureRankiHelp();
  }

  function trackRanki(action) {
    try { window.gtag?.("event", "ranki_help", { action }); } catch {}
    try {
      window.registrarMetricaComercial?.("ranki_ajuda", { id: action, titulo: "Ranki Ajuda" }, "site");
    } catch {}
  }

  function rankiNormalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function rankiAnswer(message, links = []) {
    const target = document.querySelector("[data-ranki-answer]");
    if (!target) return;
    target.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    target.appendChild(paragraph);
    if (links.length) {
      const list = document.createElement("div");
      list.className = "ranki-results";
      links.forEach(item => {
        const link = document.createElement("a");
        link.href = item.href;
        link.textContent = item.label;
        link.addEventListener("click", () => trackRanki("resultado_produto"));
        list.appendChild(link);
      });
      target.appendChild(list);
    }
  }

  function visibleProductMatches(term) {
    const normalized = rankiNormalize(term);
    if (!normalized) return [];
    const terms = normalized.split(/\s+/).filter(word => word.length > 1);
    const matches = new Map();
    document.querySelectorAll("article,.deal-card,.product-card-wrap").forEach(card => {
      const title = card.querySelector("h3,h2")?.textContent?.trim();
      const link = card.querySelector('a[href*="/produto/"],a[href*="produto/"]');
      const normalizedTitle = rankiNormalize(title);
      if (!title || !link || !terms.every(word => normalizedTitle.includes(word))) return;
      const href = new URL(link.getAttribute("href"), location.href).href;
      if (!matches.has(href)) matches.set(href, { href, label: title });
    });
    return [...matches.values()].slice(0, 3);
  }

  function focusSiteSearch(query = "") {
    const input = document.getElementById("search-input");
    if (!input) {
      location.href = `/?busca=${encodeURIComponent(query)}`;
      return;
    }
    document.getElementById("search-toggle")?.click();
    if (query) input.value = query;
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    input.focus({ preventScroll: true });
  }

  function handleRankiQuestion(rawQuestion) {
    const question = String(rawQuestion || "").trim();
    const normalized = rankiNormalize(question);
    if (!normalized) {
      rankiAnswer("Escreva o produto ou a dúvida que você quer consultar.");
      return;
    }
    trackRanki("pergunta");
    if (/oferta|promocao|desconto/.test(normalized)) {
      rankiAnswer("As ofertas exibidas são selecionadas e o preço final deve ser confirmado no Mercado Livre. Vou levar você às promoções de hoje.");
      document.getElementById("promocoes")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (/historico|menor preco|preco antigo|comprovad/.test(normalized)) {
      rankiAnswer("O histórico usa registros recentes do próprio site para comparar o valor atual. Ele ajuda a identificar uma boa oportunidade, mas o preço final, o frete e o estoque devem ser confirmados no Mercado Livre.");
      document.querySelector("[data-offer-proof]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (/como aval|nota|criterio|avaliacao/.test(normalized)) {
      rankiAnswer("Nossas análises consideram ficha técnica, utilidade, pontos positivos, limitações e custo-benefício. Você pode consultar a metodologia completa.", [{ href: "/como-avaliamos.html", label: "Ver como avaliamos" }]);
      return;
    }
    if (/afiliad|comissao|custo extra/.test(normalized)) {
      rankiAnswer("Alguns links são de afiliados. O Ranking da Compra pode receber uma comissão, sem custo adicional para você. Isso não altera o preço nem compra nossa opinião.", [{ href: "/politica-afiliados.html", label: "Ler política de afiliados" }]);
      return;
    }
    if (/segur|golpe|confiavel|comprar/.test(normalized)) {
      rankiAnswer("A compra e o pagamento são concluídos no Mercado Livre. Antes de pagar, confirme vendedor, reputação, frete, prazo, garantia e se o endereço continua no domínio oficial mercadolivre.com.br.");
      return;
    }
    if (/whatsapp|canal|clube/.test(normalized)) {
      const club = document.querySelector('[data-whatsapp-club="section"] a,[data-whatsapp-club="floating"]');
      rankiAnswer(club ? "O Clube de Ofertas envia as promoções mais fortes e ofertas relâmpago verificadas." : "O convite do Clube de Ofertas está temporariamente indisponível.", club ? [{ href: club.href, label: "Entrar no Clube de Ofertas" }] : []);
      return;
    }
    const matches = visibleProductMatches(question);
    if (matches.length) {
      rankiAnswer(`Encontrei ${matches.length} resultado${matches.length > 1 ? "s" : ""} visível${matches.length > 1 ? "is" : ""} para “${question}”.`, matches);
      return;
    }
    focusSiteSearch(question);
    rankiAnswer(`Coloquei “${question}” na busca do site. Confira os resultados e tente também a marca ou o modelo do produto.`);
  }

  function closeRankiHelp(restoreFocus = true) {
    const help = document.getElementById("ranki-help");
    if (!help || help.hidden) return;
    help.hidden = true;
    document.body.classList.remove("ranki-help-open");
    document.querySelector(".ranki-trigger")?.setAttribute("aria-expanded", "false");
    if (restoreFocus === true) rankiPreviousFocus?.focus?.();
  }

  function openRankiHelp() {
    const help = ensureRankiHelp();
    if (!help) return;
    rankiPreviousFocus = document.activeElement;
    help.hidden = false;
    document.body.classList.add("ranki-help-open");
    document.querySelector(".ranki-trigger")?.setAttribute("aria-expanded", "true");
    help.querySelector("[data-ranki-close]")?.focus();
    trackRanki("abrir");
  }

  function handleRankiAction(action) {
    trackRanki(action);
    if (action === "ofertas") {
      const target = document.getElementById("promocoes");
      closeRankiHelp(false);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      else location.href = "/#promocoes";
      rankiAnswer("Aqui estão as promoções selecionadas para hoje. Confirme preço, frete e estoque antes de comprar.");
    } else if (action === "procurar") {
      rankiAnswer("Digite a marca, o modelo ou o tipo de produto na busca do site.");
      closeRankiHelp(false);
      focusSiteSearch();
    } else if (action === "avaliamos") {
      location.href = "/como-avaliamos.html";
    } else if (action === "historico") {
      const proof = document.querySelector("[data-offer-proof]");
      if (proof) proof.scrollIntoView({ behavior: "smooth", block: "center" });
      rankiAnswer("O histórico compara registros recentes e destaca quando o valor está perto do menor preço observado. O valor final deve ser confirmado no Mercado Livre.");
    } else if (action === "whatsapp") {
      const club = document.querySelector('[data-whatsapp-club="section"] a,[data-whatsapp-club="floating"]');
      if (club?.href) window.open(club.href, "_blank", "noopener,noreferrer");
      else rankiAnswer("O convite do Clube de Ofertas está temporariamente indisponível.");
    }
  }

  function ensureRankiHelp() {
    let help = document.getElementById("ranki-help");
    const trigger = document.querySelector(".ranki-trigger");
    if (trigger && !trigger.dataset.rankiReady) {
      trigger.dataset.rankiReady = "true";
      trigger.addEventListener("click", () => help?.hidden ? openRankiHelp() : closeRankiHelp());
    }
    if (help || /dashboard\.html|painel-celular\.html/i.test(location.pathname)) return help;
    help = document.createElement("aside");
    help.id = "ranki-help";
    help.className = "ranki-help";
    help.hidden = true;
    help.setAttribute("role", "dialog");
    help.setAttribute("aria-modal", "false");
    help.setAttribute("aria-labelledby", "ranki-help-title");
    help.innerHTML = `<div class="ranki-help-head"><div><span>🦊 RANKI AJUDA</span><h2 id="ranki-help-title">Como posso ajudar?</h2></div><button type="button" data-ranki-close aria-label="Fechar o Ranki Ajuda">×</button></div><div class="ranki-answer" data-ranki-answer aria-live="polite"><p>Olá! Eu sou o Ranki. Posso ajudar você a encontrar ofertas e entender como verificamos os preços.</p></div><div class="ranki-actions"><button type="button" data-ranki-action="ofertas">🔥 Ofertas de hoje</button><button type="button" data-ranki-action="procurar">🔎 Procurar produto</button><button type="button" data-ranki-action="avaliamos">✓ Como avaliamos?</button><button type="button" data-ranki-action="historico">📉 Histórico de preço</button><button type="button" data-ranki-action="whatsapp">💚 WhatsApp</button></div><form class="ranki-question"><label for="ranki-question-input">Pergunte ao Ranki</label><div><input id="ranki-question-input" type="search" maxlength="90" autocomplete="off" placeholder="Ex.: notebook, preço ou segurança"><button type="submit">Enviar</button></div></form><p class="ranki-disclaimer">Respostas baseadas nas informações públicas e verificadas do Ranking da Compra. Preço, frete e estoque podem mudar.</p>`;
    document.body.appendChild(help);
    help.querySelector("[data-ranki-close]").addEventListener("click", closeRankiHelp);
    help.querySelectorAll("[data-ranki-action]").forEach(button => button.addEventListener("click", () => handleRankiAction(button.dataset.rankiAction)));
    help.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      handleRankiQuestion(help.querySelector("#ranki-question-input").value);
    });
    help.querySelector("#ranki-question-input").addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleRankiQuestion(event.currentTarget.value);
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeRankiHelp(); });
    if (trigger && !trigger.dataset.rankiReady) {
      trigger.dataset.rankiReady = "true";
      trigger.addEventListener("click", () => help.hidden ? openRankiHelp() : closeRankiHelp());
    }
    return help;
  }

  function themeOptions() {
    return Object.entries(SEASONAL_THEMES).map(([id, theme]) => `<option value="${escapeHtml(id)}">${escapeHtml(theme.icon)} ${escapeHtml(theme.name)}</option>`).join("");
  }

  function renderThemePreview(container, id) {
    const preview = container.querySelector("#seasonal-preview");
    const theme = SEASONAL_THEMES[id] || SEASONAL_THEMES.natal;
    preview.style.setProperty("--season-a", theme.colors[0]);
    preview.style.setProperty("--season-b", theme.colors[1]);
    preview.style.setProperty("--season-accent", theme.colors[2]);
    preview.innerHTML = `<img src="${escapeHtml(RANKI_THEME_IMAGES[id])}" width="362" height="362" alt="Prévia da roupa do Ranki para ${escapeHtml(theme.name)}"><div><strong>${escapeHtml(theme.icon)} ${escapeHtml(theme.title)}</strong><span>${escapeHtml(theme.message)}</span></div>`;
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
      .offer-proof.is-near{border-color:#9dbdd8;background:#f2f8fd;color:#294f70}
      .offer-proof.is-near strong{color:#185d91}
      .offer-proof.is-warning{border-color:#e2ad90;background:#fff5ef;color:#7a3c20}
      .offer-proof.is-warning strong{color:#a33e16}
      .club-whatsapp{width:min(1180px,calc(100% - 32px));margin:24px auto;padding:22px;border:1px solid #98d7af;border-radius:18px;background:linear-gradient(135deg,#eaf9ef,#fff);display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;box-shadow:0 12px 34px rgba(17,97,73,.09)}
      .club-whatsapp h2{margin:0 0 6px;color:#0f5132;font-size:clamp(1.25rem,3vw,1.8rem)}
      .club-whatsapp p{margin:0;color:#4f665c;max-width:720px}
      .club-whatsapp a{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:12px 20px;border-radius:12px;background:#168a48;color:#fff;text-decoration:none;font-weight:900;box-shadow:0 8px 20px rgba(22,138,72,.2)}
      .club-whatsapp a:hover{background:#10733b}
      .club-floating{position:fixed;right:18px;bottom:18px;z-index:850;display:inline-flex;align-items:center;gap:7px;padding:12px 15px;border-radius:999px;background:#168a48;color:#fff;text-decoration:none;font-weight:900;box-shadow:0 12px 32px rgba(0,0,0,.22)}
      .hero .wrap{position:relative;padding-right:210px}.hero .wrap>:not(.ranki-hero){position:relative;z-index:1}.ranki-hero{position:absolute;z-index:2;right:3px;bottom:-31px;width:clamp(138px,17vw,194px);margin:0;filter:drop-shadow(0 17px 18px rgba(17,34,29,.18))}.ranki-trigger{position:relative;display:block;width:100%;margin:0;padding:0;border:0;background:transparent;color:inherit;cursor:pointer;transition:transform .18s ease}.ranki-trigger:hover{transform:translateY(-4px) scale(1.015)}.ranki-trigger:focus-visible{outline:3px solid #f6c85f;outline-offset:5px;border-radius:22px}.ranki-hero img{display:block;width:100%;height:auto}.ranki-hero[data-ranki-themed] img{width:145%;max-width:none;margin-left:-22.5%}.ranki-caption{position:absolute;right:50%;bottom:24px;transform:translateX(50%);min-width:132px;padding:7px 10px;border:1px solid rgba(17,97,73,.18);border-radius:999px;background:rgba(255,255,255,.94);color:#116149;text-align:center;box-shadow:0 8px 20px rgba(17,34,29,.12);backdrop-filter:blur(7px);pointer-events:none}.ranki-caption strong,.ranki-caption span{display:block;line-height:1.1}.ranki-caption strong{font-size:.82rem}.ranki-caption span{margin-top:2px;color:#52645b;font-size:.58rem;font-weight:800;letter-spacing:.035em;text-transform:uppercase}
      .ranki-help[hidden]{display:none!important}.ranki-help{position:fixed;z-index:1100;right:18px;bottom:78px;width:min(390px,calc(100vw - 28px));max-height:calc(100vh - 105px);overflow:auto;padding:18px;border:1px solid #a8cab8;border-radius:20px;background:#fff;color:#17251f;box-shadow:0 24px 70px rgba(12,45,34,.28)}.ranki-help-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.ranki-help-head span{display:block;color:#0b7550;font-size:.66rem;font-weight:950;letter-spacing:.12em}.ranki-help-head h2{margin:3px 0 0;color:#123a2d;font-size:1.35rem}.ranki-help-head button{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;padding:0;border:1px solid #c8d9d0;border-radius:50%;background:#f5faf7;color:#24483b;font-size:1.45rem;cursor:pointer}.ranki-answer{margin:14px 0;padding:13px 14px;border-left:4px solid #129462;border-radius:11px;background:#eef9f3;color:#355b4c;line-height:1.48}.ranki-answer p{margin:0}.ranki-results{display:grid;gap:7px;margin-top:10px}.ranki-results a{display:block;padding:9px 10px;border:1px solid #b6d8c6;border-radius:9px;background:#fff;color:#0b6647;font-weight:800;text-decoration:none}.ranki-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ranki-actions button{min-height:44px;padding:9px;border:1px solid #b7d1c4;border-radius:10px;background:#fff;color:#24483b;font:inherit;font-size:.8rem;font-weight:850;cursor:pointer}.ranki-actions button:hover,.ranki-actions button:focus-visible{border-color:#0d8a5a;background:#effaf4}.ranki-actions button:last-child{grid-column:1/-1;background:#168a48;color:#fff;border-color:#168a48}.ranki-question{margin-top:14px}.ranki-question label{display:block;margin-bottom:6px;color:#274d3f;font-size:.76rem;font-weight:900}.ranki-question>div{display:grid;grid-template-columns:1fr auto}.ranki-question input{min-width:0;padding:11px;border:1px solid #afc9b9;border-radius:10px 0 0 10px;font:inherit}.ranki-question button{padding:10px 13px;border:0;border-radius:0 10px 10px 0;background:#0d7650;color:#fff;font:inherit;font-weight:900;cursor:pointer}.ranki-disclaimer{margin:11px 0 0;color:#66776f;font-size:.67rem;line-height:1.4}.ranki-help-open .club-floating{opacity:0;pointer-events:none}
      .seasonal-banner{--season-a:#123c69;--season-b:#1f8a70;--season-accent:#ffd166;position:relative;isolation:isolate;overflow:hidden;width:min(1180px,calc(100% - 32px));margin:22px auto 6px;border:1px solid color-mix(in srgb,var(--season-accent) 62%,transparent);border-radius:22px;background:linear-gradient(120deg,var(--season-a),var(--season-b));color:#fff;box-shadow:0 18px 45px color-mix(in srgb,var(--season-a) 28%,transparent)}
      .seasonal-banner::before{content:"";position:absolute;inset:-80%;z-index:-2;background:conic-gradient(from 90deg at 50% 50%,transparent,var(--season-accent),transparent 18%);opacity:.14;animation:seasonGlow 18s linear infinite}.seasonal-banner::after{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(circle at 82% 12%,color-mix(in srgb,var(--season-accent) 42%,transparent),transparent 34%),linear-gradient(100deg,rgba(255,255,255,.1),transparent 45%)}
      .seasonal-banner-inner{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px;padding:22px 26px}.seasonal-icon{display:grid;place-items:center;width:66px;height:66px;border:1px solid rgba(255,255,255,.32);border-radius:19px;background:rgba(255,255,255,.15);font-size:2.15rem;box-shadow:inset 0 1px 0 rgba(255,255,255,.25);backdrop-filter:blur(8px)}
      .seasonal-copy small{display:block;margin-bottom:3px;color:var(--season-accent);font-size:.7rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.seasonal-copy h2{margin:0;font-size:clamp(1.35rem,3vw,2rem);line-height:1.12;letter-spacing:-.025em;color:#fff}.seasonal-copy p{max-width:720px;margin:6px 0 0;color:rgba(255,255,255,.88);font-size:.92rem}.seasonal-cta{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 15px;border-radius:11px;background:var(--season-accent);color:var(--season-a);font-weight:950;text-decoration:none;white-space:nowrap;box-shadow:0 8px 22px rgba(0,0,0,.16)}
      .seasonal-particle{position:absolute;z-index:-1;color:var(--season-accent);font-weight:950;opacity:.24;pointer-events:none;animation:seasonFloat 7s ease-in-out infinite}.seasonal-particle:nth-child(1){left:3%;top:9%;font-size:1.1rem}.seasonal-particle:nth-child(2){left:19%;bottom:4%;animation-delay:-2s}.seasonal-particle:nth-child(3){right:31%;top:8%;font-size:.72rem;animation-delay:-4s}.seasonal-particle:nth-child(4){right:15%;bottom:5%;font-size:1.2rem;animation-delay:-1s}.seasonal-particle:nth-child(5){right:3%;top:8%;animation-delay:-3s}.seasonal-particle:nth-child(6){left:47%;bottom:1%;animation-delay:-5s}
      body[data-seasonal-theme] .hero{background:radial-gradient(circle at 86% 8%,color-mix(in srgb,var(--seasonal-accent,#ffd166) 36%,transparent),transparent 34%),linear-gradient(145deg,color-mix(in srgb,var(--seasonal-a,#123c69) 8%,#f4f8f2),#f4f8f2)}body[data-seasonal-theme] .hero .primary{background:var(--seasonal-a,#116149)}body[data-seasonal-theme] .daily-deals,body[data-seasonal-theme] .weekly-top{border-color:color-mix(in srgb,var(--seasonal-accent,#ffd166) 45%,#dfe7e2)}
      @keyframes seasonGlow{to{transform:rotate(360deg)}}@keyframes seasonFloat{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-10px) rotate(6deg)}}
      .growth-admin{margin:24px 0;padding:20px;border:1px solid #96c9aa;border-radius:14px;background:#f1fbf5}
      .growth-admin h2{margin:0 0 5px;color:#0b5b39}.growth-admin p{color:#54675e;margin:0 0 13px}
      .growth-admin label{display:block;font-weight:850;margin:10px 0 5px}.growth-admin input[type=url]{width:100%;padding:11px;border:1px solid #afc9b9;border-radius:8px;font:inherit}
      .growth-admin .growth-row{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:12px}
      .growth-admin button,.growth-admin a{border:0;border-radius:8px;padding:10px 14px;font:inherit;font-weight:850;cursor:pointer;text-decoration:none}
      .growth-admin button{background:#087a3d;color:#fff}.growth-admin a{background:#fff;color:#0b5b39;border:1px solid #9dc6ae}
      .growth-admin-status{min-height:1.3em;margin-top:10px!important;font-weight:800!important;color:#0b6b3a!important}
      .seasonal-admin{margin-top:22px;padding-top:20px;border-top:1px solid #b9d8c5}.seasonal-admin h2{display:flex;align-items:center;gap:8px}.seasonal-admin-grid{display:grid;grid-template-columns:1fr 1.3fr;gap:12px}.seasonal-admin select,.seasonal-admin input[type=date]{width:100%;padding:11px;border:1px solid #afc9b9;border-radius:8px;background:#fff;font:inherit}.seasonal-preview{--season-a:#123c69;--season-b:#1f8a70;--season-accent:#ffd166;position:relative;overflow:hidden;display:grid;grid-template-columns:96px 1fr;align-items:center;gap:14px;margin-top:14px;padding:10px 17px;border-radius:14px;background:linear-gradient(120deg,var(--season-a),var(--season-b));color:#fff}.seasonal-preview img{display:block;width:96px;height:96px;object-fit:contain;filter:drop-shadow(0 7px 8px rgba(0,0,0,.2))}.seasonal-preview strong{display:block;font-size:1.08rem}.seasonal-preview span{display:block;margin-top:4px;color:rgba(255,255,255,.86);font-size:.82rem}.seasonal-admin-help{font-size:.78rem;color:#607068}.seasonal-admin-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.seasonal-admin-actions button{margin:0}.seasonal-status{min-height:1.3em;margin:9px 0 0!important;font-weight:850!important;color:#0b6b3a!important}
      @media(max-width:900px){.hero .wrap{padding-right:145px}.ranki-hero{right:2px;width:130px}}
      @media(max-width:700px){.hero .wrap{padding-right:0}.ranki-hero{right:-5px;bottom:-8px;width:88px;opacity:.94;filter:drop-shadow(0 8px 9px rgba(17,34,29,.16))}.ranki-hero[data-ranki-themed] img{width:100%;max-width:100%;margin-left:0}.ranki-caption{display:none}.ranki-help{left:10px;right:10px;bottom:10px;width:auto;max-height:calc(100vh - 20px);border-radius:17px}.ranki-actions{grid-template-columns:1fr 1fr}.club-whatsapp{grid-template-columns:1fr}.club-whatsapp a{width:100%}.club-floating{right:12px;bottom:12px;font-size:.82rem}.seasonal-banner-inner{grid-template-columns:auto 1fr;padding:17px;gap:12px}.seasonal-icon{width:52px;height:52px;border-radius:15px;font-size:1.65rem}.seasonal-cta{grid-column:1/-1;width:100%}.seasonal-copy p{font-size:.82rem}.seasonal-admin-grid{grid-template-columns:1fr}.seasonal-preview{grid-template-columns:76px 1fr}.seasonal-preview img{width:76px;height:76px}}
      @media(prefers-reduced-motion:reduce){.seasonal-banner::before,.seasonal-particle{animation:none!important}}
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
    const ratio = summary.minimum > 0 && summary.currentPrice > 0 ? summary.currentPrice / summary.minimum : 0;
    const atMinimum = enough && ratio > 0 && ratio <= 1.03;
    const nearMinimum = enough && ratio > 1.03 && ratio <= 1.10;
    const aboveMinimum = enough && ratio > 1.10;
    const title = atMinimum
      ? "✓ Oferta comprovada — perto do menor preço"
      : nearMinimum
        ? "✓ Preço competitivo no histórico recente"
        : aboveMinimum
          ? "⚠ Preço atual acima do menor valor recente"
          : "Preço registrado — histórico iniciado";
    const stateClass = atMinimum ? "is-good" : nearMinimum ? "is-near" : aboveMinimum ? "is-warning" : "is-learning";
    const detail = summary.minimum > 0
      ? `Menor preço em até ${HISTORY_DAYS} dias: ${brl.format(summary.minimum)}`
      : "Estamos formando o histórico deste produto.";
    return `<div class="offer-proof ${stateClass}" data-offer-proof data-price-history-state="${stateClass}"><strong>${escapeHtml(title)}</strong>${escapeHtml(detail)}<small>Último registro: ${escapeHtml(dateText)} · confirme o valor final no Mercado Livre.</small></div>`;
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
    const [published, remote, seasonal] = await Promise.all([
      (async () => {
        try {
          const response = await fetch("/site-config.json", { cache: "no-store" });
          return response.ok ? await response.json() : {};
        } catch { return {}; }
      })(),
      (async () => {
        try {
          if (typeof db === "undefined") return {};
          const doc = await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get();
          return doc.exists ? doc.data() : {};
        } catch (error) {
          console.warn("Não foi possível ler a configuração do Clube de Ofertas.", error);
          return {};
        }
      })(),
      (async () => {
        try {
          if (typeof db === "undefined") return {};
          const doc = await db.collection("produtos").doc(".site-theme").get();
          return doc.exists ? doc.data() : {};
        } catch (error) {
          console.warn("Não foi possível ler o tema sazonal da vitrine.", error);
          return {};
        }
      })()
    ]);
    const config = { ...published, ...remote, ...seasonal };
    state.config = config;
    return state.config;
  }

  function validWhatsAppUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return url.protocol === "https:" && /(^|\.)((chat\.)?whatsapp\.com|wa\.me)$/i.test(url.hostname);
    } catch { return false; }
  }

  async function loadPublishedConfig() {
    try {
      const response = await fetch(`/site-config.json?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return null;
      const config = await response.json();
      return config && typeof config === "object" ? config : null;
    } catch {
      return null;
    }
  }

  function sameClubConfig(config, url, enabled) {
    return String(config?.whatsappClubUrl || "").trim() === url
      && (config?.whatsappClubEnabled !== false) === enabled;
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
      <p class="growth-admin-status" id="growth-admin-status" role="status" aria-live="polite"></p>
      <div class="seasonal-admin">
        <h2>🎨 Temas para datas comemorativas</h2>
        <p>Deixe a vitrine com uma campanha especial sem alterar produtos, links ou configurações importantes.</p>
        <div class="seasonal-admin-grid">
          <div><label for="seasonal-mode">Funcionamento</label><select id="seasonal-mode"><option value="off">Desativado — tema normal</option><option value="manual">Manual — eu escolho o tema</option><option value="auto">Automático — seguir o calendário</option></select></div>
          <div><label for="seasonal-theme">Tema para visualizar ou ativar</label><select id="seasonal-theme">${themeOptions()}</select></div>
          <div><label for="seasonal-start">Começar em (opcional)</label><input id="seasonal-start" type="date"></div>
          <div><label for="seasonal-end">Encerrar em (opcional)</label><input id="seasonal-end" type="date"></div>
        </div>
        <p class="seasonal-admin-help">No modo automático, o site escolhe a campanha comercial adequada e a remove sozinho ao terminar. No modo manual, as datas vazias mantêm o tema ativo até você desligar.</p>
        <div class="seasonal-preview" id="seasonal-preview" aria-live="polite"></div>
        <div class="seasonal-admin-actions"><button id="seasonal-save" type="button">Salvar tema da vitrine</button><a id="seasonal-open-preview" href="/" target="_blank" rel="noopener noreferrer">Abrir prévia completa</a></div>
        <p class="seasonal-status" id="seasonal-status" role="status" aria-live="polite"></p>
      </div>`;
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
    const seasonalMode = container.querySelector("#seasonal-mode");
    const seasonalTheme = container.querySelector("#seasonal-theme");
    const seasonalStart = container.querySelector("#seasonal-start");
    const seasonalEnd = container.querySelector("#seasonal-end");
    const seasonalPreviewLink = container.querySelector("#seasonal-open-preview");
    const seasonalStatus = container.querySelector("#seasonal-status");
    seasonalMode.value = ["off", "manual", "auto"].includes(config?.seasonalThemeMode) ? config.seasonalThemeMode : "off";
    seasonalTheme.value = SEASONAL_THEMES[config?.seasonalThemeId] ? config.seasonalThemeId : "natal";
    seasonalStart.value = String(config?.seasonalThemeStart || "");
    seasonalEnd.value = String(config?.seasonalThemeEnd || "");
    const refreshThemeControls = () => {
      const manual = seasonalMode.value === "manual";
      seasonalStart.disabled = !manual;
      seasonalEnd.disabled = !manual;
      renderThemePreview(container, seasonalTheme.value);
      seasonalPreviewLink.href = `/?tema-preview=${encodeURIComponent(seasonalTheme.value)}`;
    };
    seasonalMode.addEventListener("change", refreshThemeControls);
    seasonalTheme.addEventListener("change", refreshThemeControls);
    refreshThemeControls();
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
        if (typeof auth !== "undefined" && !auth.currentUser) {
          throw Object.assign(new Error("Sessão administrativa não encontrada."), { code: "auth/no-current-user" });
        }
        await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).set({
          whatsappClubUrl: value,
          whatsappClubEnabled: enabled.checked,
          whatsappClubUpdatedAt: typeof firebase !== "undefined" ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
        }, { merge: true });
        state.config = { ...(state.config || {}), whatsappClubUrl: value, whatsappClubEnabled: enabled.checked };
        status.textContent = value ? "✓ Clube salvo. O convite já pode aparecer na vitrine." : "✓ Configuração salva. O convite ficará oculto até você informar um link.";
      } catch (error) {
        console.error(error);
        const publishedConfig = await loadPublishedConfig();
        if (sameClubConfig(publishedConfig, value, enabled.checked)) {
          state.config = { ...(state.config || {}), ...publishedConfig };
          status.textContent = "✓ Clube já está publicado e ativo na vitrine.";
        } else {
          const code = String(error?.code || "").replace(/^firestore\//, "");
          status.textContent = code === "permission-denied"
            ? "O Firebase recusou a alteração. O convite que já está publicado continua ativo."
            : code === "auth/no-current-user"
              ? "Sua sessão expirou. Saia do painel, entre novamente e tente salvar."
              : `Não foi possível salvar${code ? ` (${code})` : ""}. O convite publicado continua protegido.`;
        }
      } finally { button.disabled = false; }
    });
    container.querySelector("#seasonal-save").addEventListener("click", async event => {
      const button = event.currentTarget;
      const mode = seasonalMode.value;
      const themeId = seasonalTheme.value;
      const start = seasonalStart.value;
      const end = seasonalEnd.value;
      if (mode === "manual" && start && end && start > end) {
        seasonalStatus.textContent = "A data de encerramento precisa ser igual ou posterior à data inicial.";
        return;
      }
      if (typeof db === "undefined" || (typeof auth !== "undefined" && !auth.currentUser)) {
        seasonalStatus.textContent = "Sua sessão não está pronta. Entre novamente no painel e tente salvar.";
        return;
      }
      button.disabled = true;
      seasonalStatus.textContent = "Salvando o tema...";
      try {
        const settings = {
          seasonalThemeMode: mode,
          seasonalThemeId: themeId,
          seasonalThemeStart: mode === "manual" ? start : "",
          seasonalThemeEnd: mode === "manual" ? end : "",
          seasonalThemeUpdatedAt: typeof firebase !== "undefined" ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
        };
        await db.collection("produtos").doc(".site-theme").set({
          ...settings,
          sistema: true,
          tipo: "configuracao_tema"
        }, { merge: true });
        state.config = { ...(state.config || {}), ...settings };
        const activeId = configuredThemeId(state.config);
        seasonalStatus.textContent = mode === "off"
          ? "✓ Tema normal restaurado na vitrine."
          : mode === "auto"
            ? `✓ Calendário automático ativado${activeId ? ` — ${SEASONAL_THEMES[activeId].name} está em exibição.` : ". Nenhuma campanha está na data de exibição hoje."}`
            : `✓ Tema ${SEASONAL_THEMES[themeId].name} salvo${activeId ? " e ativo na vitrine." : " para o período informado."}`;
      } catch (error) {
        console.error(error);
        seasonalStatus.textContent = String(error?.code || "").includes("permission-denied")
          ? "O Firebase recusou a alteração. Confirme seu login administrativo."
          : "Não foi possível salvar agora. A configuração anterior foi preservada.";
      } finally {
        button.disabled = false;
      }
    });
    await setupWeeklyRankingAdmin(container);
    return true;
  }


  const WEEKLY_COMPARISON_DOC = "ranking-semanal";
  let weeklyRankingDraft = null;

  function weeklyMondayKey(date = new Date()) {
    const local = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date);
    const monday = new Date(local + "T12:00:00Z");
    const weekday = monday.getUTCDay() || 7;
    monday.setUTCDate(monday.getUTCDate() - weekday + 1);
    return monday.toISOString().slice(0, 10);
  }

  function weeklyValidUntil(weekStart) {
    const end = new Date(String(weekStart) + "T12:00:00Z");
    end.setUTCDate(end.getUTCDate() + 6);
    return end.toISOString().slice(0, 10);
  }

  function weeklyTextList(value, limit = 3) {
    const items = Array.isArray(value) ? value : String(value || "").split(/\n|;|\|/);
    return items.map(item => repairPortugueseText(item)).filter(item => item.length >= 8).slice(0, limit);
  }

  function weeklyProductPrice(product) {
    return numberPrice(product.precoPromocional) || numberPrice(product.preco) || numberPrice(product.precoAtual);
  }

  function weeklyProductUrl(product) {
    const direct = String(product.productUrl || product.paginaUrl || "").trim();
    if (/^https:\/\/rankingdacompra\.com\.br\/produto\//i.test(direct)) return direct;
    return SITE + "/produto/" + encodeURIComponent(String(product.id)) + "-20260810-1.html";
  }

  function weeklyProductImage(product) {
    const value = String(product.foto || product.imagem || product.image || "").trim();
    try {
      const url = new URL(value, location.origin);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function weeklyProductEligible(product) {
    return product && product.sistema !== true && product.disponivel !== false
      && String(product.titulo || "").trim() && weeklyProductPrice(product) > 0
      && weeklyProductImage(product) && String(product.linkAfiliado || product.link || "").trim();
  }

  function weeklyMetricKind(metric) {
    const type = String(metric?.tipo || "");
    const channel = String(metric?.canal || "");
    if (type === "clique_secao" && channel.startsWith("view:")) return "visualizacao_produto";
    return type;
  }

  function weeklyNormalize(value) {
    return repairPortugueseText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function weeklyClamp(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }

  function weeklyScoreProducts(items) {
    const normalized = items.map(item => ({
      ...item,
      preco: numberPrice(item.preco ?? item.price),
      nota: numberPrice(item.nota ?? item.rating),
      clicks: Number(item.clicks ?? item.cliques) || 0,
      views: Number(item.views ?? item.visitas) || 0,
      pros: weeklyTextList(item.pros || item.pontosPositivos),
      cons: weeklyTextList(item.cons || item.pontosNegativos)
    }));
    const prices = normalized.map(item => item.preco).filter(value => value > 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const averagePrice = prices.reduce((total, value) => total + value, 0) / Math.max(1, prices.length);
    const maxDemand = Math.max(0, ...normalized.map(item => item.clicks * 4 + item.views));
    const ranked = normalized.map(item => {
      const priceRange = maxPrice - minPrice;
      const costBenefit = item.preco > 0
        ? (priceRange > 0 ? 100 - ((item.preco - minPrice) / priceRange) * 45 : 100)
        : 0;
      const rating = item.nota > 0 ? weeklyClamp((item.nota / 5) * 100) : 55;
      const demandRaw = item.clicks * 4 + item.views;
      const demand = maxDemand > 0 ? 30 + (Math.log1p(demandRaw) / Math.log1p(maxDemand)) * 70 : 60;
      const evidence = weeklyClamp(35 + item.pros.length * 12 + item.cons.length * 10 + (item.nota > 0 ? 12 : 0));
      const total = costBenefit * 0.35 + rating * 0.30 + demand * 0.15 + evidence * 0.20;
      return {
        ...item,
        scoreTotal: Number((total / 10).toFixed(1)),
        criterios: {
          custoBeneficio: Number((costBenefit / 10).toFixed(1)),
          avaliacao: Number((rating / 10).toFixed(1)),
          interesse: Number((demand / 10).toFixed(1)),
          evidencia: Number((evidence / 10).toFixed(1))
        }
      };
    }).sort((a, b) => b.scoreTotal - a.scoreTotal || b.nota - a.nota || a.preco - b.preco);
    return ranked.map((item, index, group) => {
      const position = index + 1;
      const previous = group[index - 1] || null;
      return { ...item, position, motivo: weeklyReason(item, position, { averagePrice, previous }) };
    });
  }

  function weeklyReason(item, position, context = {}) {
    const price = numberPrice(item.preco ?? item.price);
    const average = numberPrice(context.averagePrice);
    const previous = context.previous;
    const difference = average > 0 ? Math.round(Math.abs(price - average) / average * 100) : 0;
    const priceFact = price > 0 && average > 0
      ? (price <= average ? difference + "% abaixo da média dos cinco" : difference + "% acima da média dos cinco")
      : "preço ainda sujeito a confirmação";
    const ratingFact = item.nota > 0 ? "nota informada de " + item.nota.toFixed(1).replace(".", ",") + "/5" : "sem nota disponível";
    const demandFact = item.clicks || item.views
      ? item.clicks + " clique(s) em Comprar e " + item.views + " visualização(ões) nos últimos 7 dias"
      : "ainda sem interação suficiente nos últimos 7 dias";
    const mainPro = item.pros[0] || "ficha com os dados comparáveis disponíveis";
    const mainCon = item.cons[0] || "faltam detalhes adicionais para uma conclusão mais ampla";
    let placement = "Lidera porque obteve o melhor resultado ponderado entre custo-benefício, avaliação, interesse e evidências cadastradas.";
    if (position > 1 && previous) {
      const gaps = [
        ["custo-benefício", previous.criterios.custoBeneficio - item.criterios.custoBeneficio],
        ["avaliação", previous.criterios.avaliacao - item.criterios.avaliacao],
        ["interesse observado", previous.criterios.interesse - item.criterios.interesse],
        ["qualidade das evidências", previous.criterios.evidencia - item.criterios.evidencia]
      ].sort((a, b) => b[1] - a[1]);
      const decisive = gaps[0][1] > 0.05 ? gaps[0][0] : "avaliação e preço";
      const scoreGap = Math.max(0, previous.scoreTotal - item.scoreTotal);
      placement = scoreGap < 0.1
        ? "Ficou em " + position + "º após empate técnico na nota final; o desempate considerou " + decisive + "."
        : "Ficou atrás do " + (position - 1) + "º colocado principalmente em " + decisive
          + ", com diferença de " + scoreGap.toFixed(1).replace(".", ",") + " ponto(s) na nota final.";
    }
    return placement + " Dados objetivos: " + priceFact + "; " + ratingFact + "; " + demandFact
      + ". Principal vantagem: " + mainPro + ". Limitação considerada: " + mainCon + ".";
  }

  function weeklyRankingCard(item) {
    const displayedPrice = numberPrice(item.preco ?? item.price);
    const pros = item.pros.length ? item.pros : ["Pontos positivos específicos em revisão editorial."];
    const cons = item.cons.length ? item.cons : ["Pontos de atenção específicos em revisão editorial."];
    const criteria = item.criterios || {};
    return '<article class="weekly-ranking-card">'
      + '<div class="weekly-ranking-position">' + item.position + 'º lugar</div>'
      + '<img src="' + escapeHtml(item.foto) + '" alt="' + escapeHtml(item.titulo) + '" loading="lazy" decoding="async">'
      + '<h3>' + escapeHtml(item.titulo) + '</h3>'
      + '<strong class="weekly-ranking-price">' + escapeHtml(displayedPrice > 0 ? brl.format(displayedPrice) : "Preço a confirmar") + '</strong>'
      + '<div class="weekly-ranking-score"><b>Nota comparativa ' + escapeHtml(Number(item.scoreTotal || 0).toFixed(1).replace(".", ",")) + '/10</b>'
      + '<span>Custo-benefício ' + escapeHtml(Number(criteria.custoBeneficio || 0).toFixed(1).replace(".", ",")) + '</span>'
      + '<span>Avaliação ' + escapeHtml(Number(criteria.avaliacao || 0).toFixed(1).replace(".", ",")) + '</span>'
      + '<span>Interesse ' + escapeHtml(Number(criteria.interesse || 0).toFixed(1).replace(".", ",")) + '</span>'
      + '<span>Evidências ' + escapeHtml(Number(criteria.evidencia || 0).toFixed(1).replace(".", ",")) + '</span></div>'
      + '<h4 class="weekly-ranking-why">Por que está em ' + item.position + 'º?</h4>'
      + '<p class="weekly-ranking-reason">' + escapeHtml(item.motivo) + '</p>'
      + '<div class="weekly-ranking-points"><div><b>✓ Pontos positivos</b><ul>'
      + pros.map(value => '<li>' + escapeHtml(value) + '</li>').join("")
      + '</ul></div><div><b>⚠ Pontos de atenção</b><ul>'
      + cons.map(value => '<li>' + escapeHtml(value) + '</li>').join("")
      + '</ul></div></div>'
      + '<a href="' + escapeHtml(item.productUrl) + '" data-weekly-ranking-product="' + escapeHtml(item.id) + '">Ver análise e comprar</a>'
      + '</article>';
  }

  async function loadWeeklyComparison() {
    try {
      const database = typeof db !== "undefined" ? db : await metricsDb();
      const snapshot = await database.collection(CONFIG_COLLECTION).doc(WEEKLY_COMPARISON_DOC).get();
      return snapshot.exists ? snapshot.data() : null;
    } catch (error) {
      console.warn("Ranking comparativo semanal temporariamente indisponível.", error);
      return null;
    }
  }

  function renderWeeklyComparison(config) {
    document.querySelector("[data-weekly-comparison]")?.remove();
    const storedProducts = Array.isArray(config?.produtos) ? config.produtos.slice(0, 5) : [];
    if (config?.publicado !== true || storedProducts.length !== 5 || !/^\/(?:index\.html)?$/.test(location.pathname)) return;
    const products = weeklyScoreProducts(storedProducts);
    const section = document.createElement("section");
    section.className = "weekly-comparison";
    section.id = "ranking-da-semana";
    section.dataset.weeklyComparison = config.semana || "ativo";
    const subtitle = config.precoMaximo > 0
      ? "Cinco opções comparadas até " + brl.format(numberPrice(config.precoMaximo)) + "."
      : "Cinco opções da mesma categoria comparadas lado a lado.";
    section.innerHTML = '<div class="weekly-comparison-head"><div><small>COMPARATIVO EDITORIAL ATUALIZADO SEMANALMENTE</small>'
      + '<h2>🏆 ' + escapeHtml(config.titulo || "Ranking da Semana") + '</h2>'
      + '<p>' + escapeHtml(subtitle) + ' Confira preço, frete e estoque antes da compra.</p></div>'
      + '<a href="/como-avaliamos.html">Como classificamos</a></div>'
      + '<div class="weekly-ranking-grid">' + products.map(weeklyRankingCard).join("") + '</div>'
      + '<p class="weekly-ranking-method"><b>Metodologia:</b> nota de 0 a 10 calculada com custo-benefício (35%), avaliação informada (30%), interesse observado nos últimos 7 dias (15%) e qualidade das evidências cadastradas (20%). Preço, frete, estoque e avaliações podem mudar; confira o anúncio antes da compra. A aprovação final é sempre feita pelo administrador.</p>';
    const anchor = document.getElementById("top5-semanal") || document.querySelector("#promocoes") || document.querySelector("main");
    if (anchor?.parentNode) anchor.insertAdjacentElement(anchor.matches("main") ? "afterbegin" : "afterend", section);
  }

  async function weeklyAdminData(status) {
    const database = typeof db !== "undefined" ? db : await metricsDb();
    if (status) status.textContent = "Carregando produtos e sinais dos últimos sete dias...";
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const startKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(start);
    const [productsSnapshot, categoriesSnapshot, metricsSnapshot, publishedSnapshot] = await Promise.all([
      database.collection("produtos").get(),
      database.collection("categorias").get(),
      database.collection("visitas").where("dia", ">=", startKey).get(),
      database.collection(CONFIG_COLLECTION).doc(WEEKLY_COMPARISON_DOC).get()
    ]);
    const categories = {};
    categoriesSnapshot.forEach(doc => { categories[doc.id] = String(doc.data()?.nome || doc.id); });
    const products = [];
    productsSnapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
    const metrics = [];
    metricsSnapshot.forEach(doc => metrics.push({ id: doc.id, ...doc.data() }));
    return { products: products.filter(weeklyProductEligible), categories, metrics, published: publishedSnapshot.exists ? publishedSnapshot.data() : null };
  }

  function weeklyChooseTheme(data) {
    const byId = new Map(data.products.map(product => [String(product.id), product]));
    const categoryScores = new Map();
    for (const metric of data.metrics) {
      const product = byId.get(String(metric.produtoId || ""));
      if (!product) continue;
      const kind = weeklyMetricKind(metric);
      const weight = kind === "clique_oferta" ? 5 : kind === "visualizacao_produto" ? 1 : 0;
      if (!weight) continue;
      const category = String(product.categoria || "ofertas");
      categoryScores.set(category, (categoryScores.get(category) || 0) + weight);
    }
    const eligibleCounts = new Map();
    for (const product of data.products) {
      const category = String(product.categoria || "ofertas");
      eligibleCounts.set(category, (eligibleCounts.get(category) || 0) + 1);
    }
    const choices = [...eligibleCounts].filter(([, count]) => count >= 5)
      .sort((a, b) => (categoryScores.get(b[0]) || 0) - (categoryScores.get(a[0]) || 0) || b[1] - a[1]);
    const category = choices[0]?.[0] || "";
    return { category, label: data.categories[category] || category };
  }

  function weeklyBuildDraft(data, query, maxPrice) {
    const normalizedQuery = weeklyNormalize(query);
    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
    const metricScores = new Map();
    for (const metric of data.metrics) {
      const id = String(metric.produtoId || "");
      if (!id) continue;
      const kind = weeklyMetricKind(metric);
      const current = metricScores.get(id) || { clicks: 0, views: 0 };
      if (kind === "clique_oferta") current.clicks += 1;
      if (kind === "visualizacao_produto") current.views += 1;
      metricScores.set(id, current);
    }
    const candidates = data.products.map(product => {
      const label = data.categories[String(product.categoria || "")] || String(product.categoria || "");
      const haystack = weeklyNormalize([product.titulo, product.categoria, label].join(" "));
      const price = weeklyProductPrice(product);
      const rating = numberPrice(product.nota || product.avaliacao);
      const signals = metricScores.get(String(product.id)) || { clicks: 0, views: 0 };
      const match = !queryWords.length || queryWords.every(word => haystack.includes(word));
      const withinBudget = !(maxPrice > 0) || price <= maxPrice;
      return {
        id: String(product.id), titulo: repairPortugueseText(product.titulo),
        categoria: String(product.categoria || ""), categoriaNome: label,
        preco: price, foto: weeklyProductImage(product), productUrl: weeklyProductUrl(product),
        linkAfiliado: String(product.linkAfiliado || product.link || ""), nota: rating,
        pros: weeklyTextList(product.pros || product.pontosPositivos),
        cons: weeklyTextList(product.contras || product.pontosNegativos),
        clicks: signals.clicks, views: signals.views, match, withinBudget
      };
    }).filter(item => item.match && item.withinBudget);
    if (candidates.length < 5) throw new Error("Encontrei somente " + candidates.length + " produto(s) válido(s) nesse filtro. Amplie o preço máximo ou use um termo mais geral.");
    const selected = weeklyScoreProducts(candidates).slice(0, 5);
    const finalSelection = weeklyScoreProducts(selected);
    const label = query || finalSelection[0].categoriaNome || "produtos";
    return {
      versao: 2, semana: weeklyMondayKey(), validoAte: weeklyValidUntil(weeklyMondayKey()),
      titulo: "Top 5 " + String(label).trim() + (maxPrice > 0 ? " até " + brl.format(maxPrice) : ""),
      termo: String(query || "").trim(), precoMaximo: maxPrice || 0, produtos: finalSelection,
      metodologia: { custoBeneficio: 35, avaliacao: 30, interesse: 15, evidencia: 20 }
    };
  }

  function weeklyDraftMarkup(draft) {
    return '<div class="weekly-admin-draft"><h3>' + escapeHtml(draft.titulo) + '</h3><p>Semana de '
      + escapeHtml(dateBr.format(new Date(draft.semana + "T12:00:00-03:00"))) + ' · revise os cinco colocados antes de publicar.</p>'
      + '<ol>' + draft.produtos.map(item => '<li><strong>' + escapeHtml(item.position + "º — " + item.titulo)
        + '</strong><span>' + escapeHtml(brl.format(item.preco)) + ' · ' + escapeHtml(item.motivo) + '</span></li>').join("") + '</ol></div>';
  }

  async function setupWeeklyRankingAdmin(container) {
    const section = document.createElement("section");
    section.className = "weekly-ranking-admin";
    section.id = "weekly-ranking-admin";
    section.innerHTML = '<h2>🏆 Ranking comparativo da semana</h2>'
      + '<p>Escolha um produto ou categoria e o preço máximo. O sistema usa procura, cliques e dados cadastrados para ordenar cinco opções. Nada vai para a vitrine sem sua aprovação.</p>'
      + '<div class="weekly-admin-grid"><div><label for="weekly-ranking-query">Produto ou categoria</label>'
      + '<input id="weekly-ranking-query" type="text" placeholder="Ex.: celular, patinete, air fryer"></div>'
      + '<div><label for="weekly-ranking-price">Preço máximo (opcional)</label>'
      + '<input id="weekly-ranking-price" type="number" min="1" step="0.01" inputmode="decimal" placeholder="Ex.: 1000,00"></div></div>'
      + '<div class="weekly-admin-actions"><button id="weekly-ranking-suggest" type="button">✨ Sugerir pelo interesse da semana</button>'
      + '<button id="weekly-ranking-prepare" type="button">Preparar comparação</button>'
      + '<button id="weekly-ranking-publish" type="button" disabled>Publicar após aprovação</button>'
      + '<a href="/#ranking-da-semana" target="_blank" rel="noopener">Ver na vitrine</a></div>'
      + '<p id="weekly-ranking-status" class="weekly-ranking-status" role="status" aria-live="polite">Pronto para preparar o próximo ranking.</p>'
      + '<div id="weekly-ranking-review"></div>';
    container.appendChild(section);
    const query = section.querySelector("#weekly-ranking-query");
    const price = section.querySelector("#weekly-ranking-price");
    const status = section.querySelector("#weekly-ranking-status");
    const review = section.querySelector("#weekly-ranking-review");
    const publish = section.querySelector("#weekly-ranking-publish");
    let cachedData = null;
    const ensureData = async () => cachedData || (cachedData = await weeklyAdminData(status));
    section.querySelector("#weekly-ranking-suggest").addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const data = await ensureData();
        const suggestion = weeklyChooseTheme(data);
        if (!suggestion.category) throw new Error("Ainda não há uma categoria com cinco produtos válidos.");
        query.value = suggestion.label;
        status.textContent = "Sugestão da semana: " + suggestion.label + ". Você pode ajustar o termo e o limite de preço.";
      } catch (error) {
        status.textContent = "Não foi possível sugerir agora: " + error.message;
      } finally { button.disabled = false; }
    });
    section.querySelector("#weekly-ranking-prepare").addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      publish.disabled = true;
      status.textContent = "Preparando o comparativo...";
      try {
        const data = await ensureData();
        const maxPrice = numberPrice(price.value);
        let term = query.value.trim();
        if (!term) {
          const suggestion = weeklyChooseTheme(data);
          term = suggestion.label;
          query.value = term;
        }
        weeklyRankingDraft = weeklyBuildDraft(data, term, maxPrice);
        review.innerHTML = weeklyDraftMarkup(weeklyRankingDraft);
        publish.disabled = false;
        status.textContent = "Comparação pronta. Confira a ordem e publique somente se estiver de acordo.";
      } catch (error) {
        weeklyRankingDraft = null;
        review.innerHTML = "";
        status.textContent = error.message;
      } finally { button.disabled = false; }
    });
    publish.addEventListener("click", async event => {
      if (!weeklyRankingDraft) return;
      const button = event.currentTarget;
      button.disabled = true;
      status.textContent = "Publicando o ranking aprovado...";
      try {
        if (typeof auth !== "undefined" && !auth.currentUser) throw new Error("Sua sessão administrativa expirou.");
        const database = typeof db !== "undefined" ? db : await metricsDb();
        await database.collection(CONFIG_COLLECTION).doc(WEEKLY_COMPARISON_DOC).set({
          ...weeklyRankingDraft, publicado: true,
          atualizadoEm: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        status.textContent = "✓ Ranking aprovado e publicado. A vitrine já pode exibir os cinco colocados.";
        cachedData = null;
      } catch (error) {
        status.textContent = "Não foi possível publicar: " + error.message + " A versão anterior foi preservada.";
        button.disabled = false;
      }
    });
    try {
      const current = await loadWeeklyComparison();
      if (current?.publicado) {
        const expired = String(current.semana || "") !== weeklyMondayKey();
        status.textContent = expired
          ? "O ranking publicado é da semana anterior. Prepare e aprove a nova seleção."
          : "✓ O ranking desta semana está publicado. Você pode preparar outro sem afetar o atual.";
      }
    } catch {}
  }

  function injectWeeklyRankingStyles() {
    if (document.getElementById("weekly-ranking-style")) return;
    const style = document.createElement("style");
    style.id = "weekly-ranking-style";
    style.textContent = '.weekly-comparison{max-width:1180px;margin:28px auto;padding:24px;border:1px solid #b8d7ca;border-radius:22px;background:linear-gradient(145deg,#f4fff9,#fff);box-sizing:border-box}.weekly-comparison-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-bottom:18px}.weekly-comparison-head small{font-weight:900;letter-spacing:.08em;color:#08784f}.weekly-comparison-head h2{margin:5px 0 6px;font-size:clamp(1.45rem,3vw,2.2rem);color:#073b2b}.weekly-comparison-head p{margin:0;color:#405a50}.weekly-comparison-head>a{font-weight:800;color:#086e4a}.weekly-ranking-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.weekly-ranking-card{position:relative;display:flex;flex-direction:column;padding:13px;border:1px solid #cfe1d8;border-radius:15px;background:#fff;box-shadow:0 8px 24px rgba(5,74,51,.07)}.weekly-ranking-position{align-self:flex-start;margin-bottom:8px;padding:5px 9px;border-radius:999px;background:#0b7a53;color:#fff;font-size:.78rem;font-weight:900}.weekly-ranking-card:first-child{border:2px solid #e4ae18;background:linear-gradient(180deg,#fffbea,#fff)}.weekly-ranking-card:first-child .weekly-ranking-position{background:#a86d00}.weekly-ranking-card img{width:100%;aspect-ratio:1/1;object-fit:contain;border-radius:10px;background:#fff}.weekly-ranking-card h3{font-size:.98rem;line-height:1.28;margin:11px 0 7px;color:#10251e}.weekly-ranking-price{font-size:1.14rem;color:#08784f}.weekly-ranking-score{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:9px 0;padding:9px;border:1px solid #b9d7ca;border-radius:9px;background:#f4fbf7;font-size:.72rem;color:#31594a}.weekly-ranking-score b{grid-column:1/-1;color:#075f40;font-size:.86rem}.weekly-ranking-why{margin:8px 0 2px;font-size:.84rem;color:#173f31}.weekly-ranking-reason{font-size:.82rem;line-height:1.42;color:#465a52}.weekly-ranking-points{font-size:.78rem;line-height:1.35}.weekly-ranking-points b{display:block;color:#174c3a}.weekly-ranking-points ul{margin:4px 0 10px;padding-left:17px}.weekly-ranking-card>a{margin-top:auto;padding:10px;border-radius:9px;background:#1468d4;color:#fff;text-align:center;text-decoration:none;font-weight:900}.weekly-ranking-method{margin:16px 0 0;font-size:.78rem;color:#557066}.weekly-ranking-admin{margin-top:26px;padding-top:24px;border-top:2px solid #d7eadf}.weekly-admin-grid{display:grid;grid-template-columns:2fr 1fr;gap:12px}.weekly-admin-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px}.weekly-admin-actions button,.weekly-admin-actions a{border:1px solid #0a7850;border-radius:9px;padding:10px 12px;background:#fff;color:#075a3e;font-weight:800;text-decoration:none;cursor:pointer}.weekly-admin-actions button:nth-child(2),.weekly-admin-actions button:nth-child(3){background:#087a52;color:#fff}.weekly-admin-actions button:disabled{opacity:.5;cursor:not-allowed}.weekly-ranking-status{font-weight:700;color:#285c49}.weekly-admin-draft{margin-top:14px;padding:14px;border-radius:12px;background:#f2faf6}.weekly-admin-draft h3{margin:0 0 5px}.weekly-admin-draft ol{padding-left:24px}.weekly-admin-draft li{margin:10px 0}.weekly-admin-draft li span{display:block;font-size:.85rem;color:#4c625a}@media(max-width:980px){.weekly-ranking-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.weekly-comparison{margin:18px 10px;padding:16px}.weekly-comparison-head{display:block}.weekly-comparison-head>a{display:inline-block;margin-top:10px}.weekly-ranking-grid,.weekly-admin-grid{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }

  async function init() {
    injectStyles();
    injectWeeklyRankingStyles();
    repairVisibleEditorial();
    renderMascot();
    setupFunnelTracking();
    if (/dashboard\.html$/i.test(location.pathname)) {
      if (await renderAdmin()) return;
      const observer = new MutationObserver(async () => {
        if (await renderAdmin()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 120000);
      return;
    }
    if (new URLSearchParams(location.search).has("tema-preview")) renderSeasonalTheme({});
    await Promise.all([loadHistory(), loadConfig()]);
    decorateVisibleProducts();
    renderClub(state.config);
    renderSeasonalTheme(state.config);
    if (/^\/(?:index\.html)?$/.test(location.pathname)) loadWeeklyComparison().then(renderWeeklyComparison);
    const observer = new MutationObserver(() => {
      repairVisibleEditorial();
      decorateVisibleProducts();
      renderMascot();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();



