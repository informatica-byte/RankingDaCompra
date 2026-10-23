/* Medidor administrativo: agregado público sem credenciais; manual como contingência. */
(function (root) {
  "use strict";

  const TIME_ZONE = "America/Los_Angeles";
  const STORAGE_KEY = "rdc-firestore-usage-manual-v1";
  const LIMITS = { reads: 50000 };
  const PUBLIC_USAGE_URL = 'https://raw.githubusercontent.com/informatica-byte/RankingDaCompra/metricas-consumo-firebase/firebase-consumo.json';
  const STALE_MS = 45 * 60 * 1000;
  // Teste real interrompido em 23/10/2026: HTTP 403 relacionado a faturamento.
  // Não tentar novamente automaticamente nem pedir OAuth no navegador.
  const AUTOMATIC_ENABLED = false;
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

  function automaticSnapshot(raw, now = new Date()) {
    try {
      const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!value || Object.keys(value).sort().join(',') !== 'at,reads') return null;
      const snapshot = currentSnapshot({ ...value, day: pacificDate(value.at) }, now);
      return snapshot ? { ...snapshot, automatic: true, stale: now.getTime() - Date.parse(snapshot.at) > STALE_MS } : null;
    } catch (_) { return null; }
  }
  function localGaugeStatus({ present = false, paused = false, reading = false, stale = false } = {}) {
    if (!present) return { state: 'absent', label: 'Tanque via Tampermonkey não detectado nesta aba', level: '' };
    if (paused) return { state: 'paused', label: 'Tanque via Tampermonkey pausado', level: 'atencao' };
    if (!reading) return { state: 'waiting', label: 'Tampermonkey ativo — aguardando leitura de hoje', level: 'atencao' };
    if (stale) return { state: 'stale', label: 'Tampermonkey ativo — leitura antiga', level: 'atencao' };
    return { state: 'active', label: 'Tanque via Tampermonkey ativo — leitura recebida', level: 'ativo' };
  }
  const helpers = { pacificDate, gaugeState, parseReads, currentSnapshot, automaticSnapshot, localGaugeStatus, LIMITS, STALE_MS, PUBLIC_USAGE_URL };
  if (typeof module !== "undefined" && module.exports) module.exports = helpers;
  if (typeof document === "undefined") return;

  const $ = (id) => document.getElementById(id);
  const form = $("consumo-form");
  if (!form) return;
  const field = $("consumo-leituras-informadas");
  const button = $("btn-consumo-salvar");
  let authorizedAdmin = false;
  let renderedDay = pacificDate(new Date());
  let automatic = null, requestInFlight = null, lastAttempt = 0;

  function updateLocalIndicator() {
    if (!authorizedAdmin) return;
    const element = $('consumo-local-status');
    if (!element) return;
    // Somente sinais DOM já exibidos pelo userscript instalado. Não troca dados,
    // não lê o armazenamento da extensão e não registra listeners do Firebase.
    const note = $('rdc-tanque-local');
    const message = note?.querySelector?.('[role="status"]')?.textContent || '';
    const action = note?.querySelector?.('button')?.textContent || '';
    const day = message.match(/Dia da cota no Pacífico:\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
    const state = localGaugeStatus({ present: Boolean(note), paused: /Retomar tanque local/.test(action),
      reading: /Tela lida em/.test(message) && day === pacificDate(new Date()), stale: /Leitura antiga/i.test(message) });
    if (element.textContent !== state.label) element.textContent = state.label;
    const className = 'consumo-status' + (state.level ? ' ' + state.level : '');
    if (element.className !== className) element.className = className;
    element.setAttribute('data-state', state.state);
  }

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
    $("consumo-medidor").setAttribute("aria-label", "Sem medição válida de leituras para o dia atual da cota");
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
    if (snapshot.automatic) {
      setStatus(snapshot.stale ? 'Medição atrasada — confira no Firebase' : state.level === 'critico'
        ? 'Automático — atenção ao limite estimado' : 'Atualização automática — métricas com atraso', snapshot.stale ? 'atencao' : state.level === 'normal' ? '' : state.level);
      $("consumo-medidor").setAttribute('aria-label', `${formatter.format(state.remaining)} leituras restantes estimadas até a medição, não em tempo real`);
      $("consumo-hora").textContent = `Métricas cobrem até ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(at)}. Dia da cota no Pacífico: ${snapshot.day}. Estimativa do monitoramento, não faturamento exato. Google e GitHub podem atrasar; o consumo posterior não está incluído.`;
    }
  }

  function loadSnapshot() {
    if (!authorizedAdmin) return;
    renderedDay = pacificDate(new Date());
    const measured = automaticSnapshot(automatic);
    if (measured) { showReading(measured); return; }
    automatic = null;
    let stored = "";
    try { stored = root.localStorage.getItem(STORAGE_KEY) || ""; } catch { /* Armazenamento indisponível. */ }
    const snapshot = currentSnapshot(stored);
    if (snapshot) {
      field.value = String(snapshot.reads);
      showReading(snapshot);
    } else {
      field.value = "";
      clearReading("Aguardando uma leitura de hoje pelo Tampermonkey ou pelo registro manual opcional.");
      setStatus(AUTOMATIC_ENABLED ? "Aguardando medição automática de hoje" : "Aguardando leitura local ou registro manual");
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

  function refreshAutomatic() {
    if (!AUTOMATIC_ENABLED || !authorizedAdmin || document.hidden || requestInFlight || Date.now() - lastAttempt < 30000) return requestInFlight;
    lastAttempt = Date.now();
    // Apenas um JSON público do GitHub; nunca a API de métricas, OAuth ou Firestore.
    requestInFlight = root.fetch(PUBLIC_USAGE_URL, { cache: 'no-store', credentials: 'omit', redirect: 'error',
      signal: root.AbortSignal.timeout(10000) }).then(async response => {
      if (!response.ok) throw Error('Medição indisponível.');
      const text = await response.text();
      if (text.length > 1000) throw Error('Arquivo inválido.');
      const value = automaticSnapshot(text);
      if (!value) throw Error('Medição de outro dia ou inválida.');
      if (authorizedAdmin) { automatic = { reads: value.reads, at: value.at }; loadSnapshot(); }
    }).catch(() => {
      if (!authorizedAdmin) return;
      loadSnapshot();
      const value = automaticSnapshot(automatic);
      if (value) setStatus('Atualização indisponível — última medição preservada', 'atencao');
    }).finally(() => { requestInFlight = null; });
    return requestInFlight;
  }
  $('btn-consumo-automatico')?.addEventListener('click', refreshAutomatic);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { loadSnapshot(); refreshAutomatic(); updateLocalIndicator(); } });

  const localContainer = document.querySelector?.('.painel-consumo');
  const localObserver = localContainer && root.MutationObserver ? new root.MutationObserver(updateLocalIndicator) : null;
  localObserver?.observe(localContainer, { childList: true, characterData: true, subtree: true });

  if (root.firebase?.auth) {
    root.firebase.auth().onAuthStateChanged((user) => {
      authorizedAdmin = Boolean(user);
      field.disabled = !authorizedAdmin;
      button.disabled = !authorizedAdmin;
      if (authorizedAdmin) { loadSnapshot(); refreshAutomatic(); updateLocalIndicator(); }
      else {
        automatic = null;
        field.value = "";
        clearReading("Entre no painel para registrar as leituras.");
        setStatus("Sem registro");
      }
    });
  }
  const intervalId = root.setInterval(() => {
    if (authorizedAdmin) {
      if (pacificDate(new Date()) !== renderedDay || automatic) loadSnapshot();
      updateLocalIndicator();
      if (Date.now() - lastAttempt >= 5 * 60 * 1000) refreshAutomatic();
    }
  }, 60 * 1000);
  root.addEventListener("beforeunload", () => { root.clearInterval(intervalId); localObserver?.disconnect(); }, { once: true });
})(typeof window === "undefined" ? globalThis : window);
