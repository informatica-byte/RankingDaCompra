/* Medidor privado e gratuito: usa somente o número informado pelo administrador. */
(function (root) {
  "use strict";

  const TIME_ZONE = "America/Los_Angeles";
  const STORAGE_KEY = "rdc-firestore-usage-manual-v1";
  const LIMITS = { reads: 50000 };
  const formatter = new Intl.NumberFormat("pt-BR");

  function pacificDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const part = (type) => parts.find((item) => item.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  function gaugeState(reads) {
    if (!Number.isSafeInteger(reads) || reads < 0) return null;
    const remaining = Math.max(0, LIMITS.reads - reads);
    const ratio = Math.min(1, reads / LIMITS.reads);
    return {
      remaining,
      angle: -180 * ratio,
      level: ratio >= 0.85 ? "critico" : ratio >= 0.65 ? "atencao" : "normal"
    };
  }

  function parseReads(value) {
    const raw = String(value).trim();
    if (!/^\d+$/.test(raw)) return null;
    const reads = Number(raw);
    return Number.isSafeInteger(reads) ? reads : null;
  }

  function currentSnapshot(raw, now = new Date()) {
    try {
      const snapshot = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!snapshot || snapshot.day !== pacificDate(now) || !gaugeState(snapshot.reads)) return null;
      const at = new Date(snapshot.at);
      if (!Number.isFinite(at.getTime()) || at.getTime() > now.getTime() || pacificDate(at) !== snapshot.day) return null;
      return { day: snapshot.day, reads: snapshot.reads, at: at.toISOString() };
    } catch { return null; }
  }

  const helpers = { pacificDate, gaugeState, parseReads, currentSnapshot, LIMITS };
  if (typeof module !== "undefined" && module.exports) module.exports = helpers;
  if (typeof document === "undefined") return;

  const $ = (id) => document.getElementById(id);
  const form = $("consumo-form");
  if (!form) return;
  const field = $("consumo-leituras-informadas");
  const button = $("btn-consumo-salvar");
  let authorizedAdmin = false;
  let renderedDay = pacificDate(new Date());

  function setStatus(message, level = "") {
    const element = $("consumo-status");
    element.textContent = message;
    element.className = "consumo-status" + (level ? " " + level : "");
  }

  function clearReading(message) {
    $("consumo-ponteiro").style.visibility = "hidden";
    $("consumo-restante").textContent = "—";
    $("consumo-leituras").textContent = "— / 50.000 leituras";
    $("consumo-hora").textContent = message;
    $("consumo-medidor").setAttribute("aria-label", "Sem registro manual de leituras para o dia atual da cota");
  }

  function showReading(snapshot) {
    const state = gaugeState(snapshot.reads);
    if (!state) return;
    $("consumo-ponteiro").setAttribute("transform", `rotate(${state.angle} 120 119)`);
    $("consumo-ponteiro").style.visibility = "visible";
    $("consumo-restante").textContent = formatter.format(state.remaining);
    $("consumo-leituras").textContent = `${formatter.format(snapshot.reads)} / 50.000 leituras`;
    const label = state.level === "critico" ? "Atenção: valor informado próximo do limite" :
      state.level === "atencao" ? "Registro manual: acompanhe no Firebase" : "Registro manual, não atualizado automaticamente";
    setStatus(label, state.level === "normal" ? "" : state.level);
    $("consumo-medidor").setAttribute("aria-label", `${formatter.format(state.remaining)} leituras restantes na hora do registro manual, não em tempo real`);
    const at = new Date(snapshot.at);
    $("consumo-hora").textContent = `Valor anotado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(at)}. Dia da cota no horário do Pacífico: ${snapshot.day}. O consumo posterior não está incluído.`;
  }

  function loadSnapshot() {
    if (!authorizedAdmin) return;
    renderedDay = pacificDate(new Date());
    let stored = "";
    try { stored = root.localStorage.getItem(STORAGE_KEY) || ""; } catch { /* Armazenamento indisponível. */ }
    const snapshot = currentSnapshot(stored);
    if (snapshot) {
      field.value = String(snapshot.reads);
      showReading(snapshot);
    } else {
      field.value = "";
      clearReading("Informe o número de leituras exibido hoje no painel oficial do Firebase.");
      setStatus("Aguardando registro de hoje");
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!authorizedAdmin) { setStatus("Entre no painel para registrar", "atencao"); return; }
    const reads = parseReads(field.value);
    if (reads === null) { setStatus("Informe um número inteiro de leituras", "atencao"); field.focus(); return; }
    const at = new Date();
    const snapshot = { day: pacificDate(at), reads, at: at.toISOString() };
    let saved = false;
    try { root.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); saved = true; } catch { /* Mostra o dado sem persistir. */ }
    showReading(snapshot);
    if (!saved) setStatus("Valor exibido, mas o navegador não conseguiu salvá-lo", "atencao");
  });

  if (root.firebase?.auth) {
    root.firebase.auth().onAuthStateChanged((user) => {
      authorizedAdmin = Boolean(user);
      field.disabled = !authorizedAdmin;
      button.disabled = !authorizedAdmin;
      if (authorizedAdmin) loadSnapshot();
      else {
        field.value = "";
        clearReading("Entre no painel para registrar as leituras.");
        setStatus("Sem registro");
      }
    });
  }
  const intervalId = root.setInterval(() => {
    if (authorizedAdmin && pacificDate(new Date()) !== renderedDay) loadSnapshot();
  }, 60 * 1000);
  root.addEventListener("beforeunload", () => root.clearInterval(intervalId), { once: true });
})(typeof window === "undefined" ? globalThis : window);
