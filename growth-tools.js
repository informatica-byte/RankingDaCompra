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

  function themeOptions() {
    return Object.entries(SEASONAL_THEMES).map(([id, theme]) => `<option value="${escapeHtml(id)}">${escapeHtml(theme.icon)} ${escapeHtml(theme.name)}</option>`).join("");
  }

  function renderThemePreview(container, id) {
    const preview = container.querySelector("#seasonal-preview");
    const theme = SEASONAL_THEMES[id] || SEASONAL_THEMES.natal;
    preview.style.setProperty("--season-a", theme.colors[0]);
    preview.style.setProperty("--season-b", theme.colors[1]);
    preview.style.setProperty("--season-accent", theme.colors[2]);
    preview.innerHTML = `<strong>${escapeHtml(theme.icon)} ${escapeHtml(theme.title)}</strong><span>${escapeHtml(theme.message)}</span>`;
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
      .seasonal-admin{margin-top:22px;padding-top:20px;border-top:1px solid #b9d8c5}.seasonal-admin h2{display:flex;align-items:center;gap:8px}.seasonal-admin-grid{display:grid;grid-template-columns:1fr 1.3fr;gap:12px}.seasonal-admin select,.seasonal-admin input[type=date]{width:100%;padding:11px;border:1px solid #afc9b9;border-radius:8px;background:#fff;font:inherit}.seasonal-preview{--season-a:#123c69;--season-b:#1f8a70;--season-accent:#ffd166;position:relative;overflow:hidden;margin-top:14px;padding:17px;border-radius:14px;background:linear-gradient(120deg,var(--season-a),var(--season-b));color:#fff}.seasonal-preview strong{display:block;font-size:1.08rem}.seasonal-preview span{display:block;margin-top:4px;color:rgba(255,255,255,.86);font-size:.82rem}.seasonal-admin-help{font-size:.78rem;color:#607068}.seasonal-admin-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.seasonal-admin-actions button{margin:0}.seasonal-status{min-height:1.3em;margin:9px 0 0!important;font-weight:850!important;color:#0b6b3a!important}
      @media(max-width:700px){.club-whatsapp{grid-template-columns:1fr}.club-whatsapp a{width:100%}.club-floating{right:12px;bottom:12px;font-size:.82rem}.seasonal-banner-inner{grid-template-columns:auto 1fr;padding:17px;gap:12px}.seasonal-icon{width:52px;height:52px;border-radius:15px;font-size:1.65rem}.seasonal-cta{grid-column:1/-1;width:100%}.seasonal-copy p{font-size:.82rem}.seasonal-admin-grid{grid-template-columns:1fr}}
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
    let config = {};
    try {
      const response = await fetch("/site-config.json", { cache: "no-store" });
      if (response.ok) config = { ...config, ...(await response.json()) };
    } catch {}
    try {
      if (typeof db !== "undefined") {
        const doc = await db.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get();
        if (doc.exists) config = { ...config, ...doc.data() };
      }
    } catch (error) {
      console.warn("Não foi possível ler a configuração do Clube de Ofertas.", error);
    }
    try {
      if (typeof db !== "undefined") {
        const themeDoc = await db.collection("produtos").doc(".site-theme").get();
        if (themeDoc.exists) config = { ...config, ...themeDoc.data() };
      }
    } catch (error) {
      console.warn("Não foi possível ler o tema sazonal da vitrine.", error);
    }
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
    return true;
  }

  async function init() {
    injectStyles();
    repairVisibleEditorial();
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
    renderSeasonalTheme(state.config);
    const observer = new MutationObserver(() => {
      repairVisibleEditorial();
      decorateVisibleProducts();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

