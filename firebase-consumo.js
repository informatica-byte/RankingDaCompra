/* Medidor privado: consulta Cloud Monitoring somente após autorização do administrador. */
(function (root) {
  "use strict";

  const PROJECT = "rankingdacompra";
  const TIME_ZONE = "America/Los_Angeles";
  const SCOPE = "https://www.googleapis.com/auth/monitoring.read";
  const LIMITS = { reads: 50000, writes: 20000, deletes: 20000 };
  const METRICS = {
    reads: "firestore.googleapis.com/document/read_ops_count",
    writes: "firestore.googleapis.com/document/write_ops_count",
    deletes: "firestore.googleapis.com/document/delete_ops_count"
  };
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

  function sumForPacificDay(series, day) {
    let sum = 0;
    let points = 0;
    for (const item of series || []) {
      const database = item?.resource?.labels?.database_id;
      if (database && database !== "(default)") continue;
      for (const point of item.points || []) {
        const start = Date.parse(point?.interval?.startTime || point?.interval?.endTime);
        const end = Date.parse(point?.interval?.endTime);
        if (!Number.isFinite(end)) continue;
        const midpoint = Number.isFinite(start) ? (start + end) / 2 : end;
        if (pacificDate(midpoint) !== day) continue;
        const value = Number(point?.value?.int64Value ?? point?.value?.doubleValue);
        if (!Number.isFinite(value) || value < 0) continue;
        sum += value;
        points++;
      }
    }
    return { count: Math.round(sum), points };
  }

  function gaugeState(reads) {
    if (!Number.isFinite(reads) || reads < 0) return null;
    const remaining = Math.max(0, LIMITS.reads - Math.round(reads));
    const ratio = Math.min(1, reads / LIMITS.reads);
    return {
      remaining,
      angle: -180 * ratio,
      level: ratio >= 0.85 ? "critico" : ratio >= 0.65 ? "atencao" : "normal"
    };
  }

  const helpers = { pacificDate, sumForPacificDay, gaugeState, LIMITS, METRICS };
  if (typeof module !== "undefined" && module.exports) module.exports = helpers;
  if (typeof document === "undefined") return;

  const $ = (id) => document.getElementById(id);
  const button = $("btn-consumo-google");
  if (!button) return;
  const clientField = $("consumo-client-id");
  let token = "";
  let tokenExpiresAt = 0;
  let authorizedAdmin = false;
  let busy = false;
  let intervalId = null;

  function safeStorageGet(key) {
    try { return localStorage.getItem(key) || ""; } catch { return ""; }
  }
  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  }
  function clientId() {
    return (clientField.value || "").trim() || safeStorageGet("rdc-monitoring-oauth-client-id") ||
      safeStorageGet("rdc-youtube-oauth-client-id");
  }
  function validClientId(value) {
    return /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value);
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
    $("consumo-gravacoes").textContent = "Gravações: — / 20.000";
    $("consumo-exclusoes").textContent = "Exclusões: — / 20.000";
    $("consumo-hora").textContent = message;
    $("consumo-medidor").setAttribute("aria-label", "Consumo ainda não medido");
  }
  function showReading(result, at) {
    const state = gaugeState(result.reads.count);
    if (!state) throw new Error("Leituras indisponíveis");
    $("consumo-ponteiro").setAttribute("transform", `rotate(${state.angle} 120 119)`);
    $("consumo-ponteiro").style.visibility = "visible";
    $("consumo-restante").textContent = formatter.format(state.remaining);
    $("consumo-leituras").textContent = `${formatter.format(result.reads.count)} / 50.000 leituras`;
    $("consumo-gravacoes").textContent = `Gravações: ${result.writes ? formatter.format(result.writes.count) : "—"} / 20.000`;
    $("consumo-exclusoes").textContent = `Exclusões: ${result.deletes ? formatter.format(result.deletes.count) : "—"} / 20.000`;
    const label = state.level === "critico" ? "Cota gratuita quase esgotada" :
      state.level === "atencao" ? "Atenção ao consumo" : "Dentro da cota gratuita";
    setStatus(label, state.level === "normal" ? "" : state.level);
    $("consumo-medidor").setAttribute("aria-label", `${formatter.format(state.remaining)} leituras restantes de 50.000, estimativa`);
    $("consumo-hora").textContent = `Estimativa consultada às ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(at)}. Período diário do Pacífico: ${pacificDate(at)}. Dados podem atrasar alguns minutos.`;
  }

  async function fetchMetric(metric, start, end) {
    const all = [];
    let next = "";
    for (let page = 0; page < 10; page++) {
      const url = new URL(`https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries`);
      url.searchParams.set("filter", `metric.type = "${metric}" AND resource.type = "firestore.googleapis.com/Database"`);
      url.searchParams.set("interval.startTime", start);
      url.searchParams.set("interval.endTime", end);
      url.searchParams.set("view", "FULL");
      url.searchParams.set("pageSize", "10000");
      if (next) url.searchParams.set("pageToken", next);
      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) {
        if (response.status === 401) { token = ""; tokenExpiresAt = 0; }
        throw new Error(`Monitoring HTTP ${response.status}`);
      }
      const data = await response.json();
      all.push(...(Array.isArray(data.timeSeries) ? data.timeSeries : []));
      next = data.nextPageToken || "";
      if (!next) return all;
    }
    throw new Error("Muitas páginas de métricas; consulta incompleta");
  }

  async function measure() {
    if (busy || !authorizedAdmin || !token || Date.now() >= tokenExpiresAt || document.hidden) return;
    busy = true;
    button.disabled = true;
    setStatus("Consultando métricas…");
    try {
      const now = new Date();
      const start = new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString();
      const end = now.toISOString();
      const day = pacificDate(now);
      const settled = await Promise.allSettled(Object.values(METRICS).map((metric) => fetchMetric(metric, start, end)));
      if (settled[0].status !== "fulfilled") throw settled[0].reason;
      const reads = sumForPacificDay(settled[0].value, day);
      if (!reads.points) throw new Error("Sem métricas de leitura disponíveis para hoje");
      const writes = settled[1].status === "fulfilled" ? sumForPacificDay(settled[1].value, day) : null;
      const deletes = settled[2].status === "fulfilled" ? sumForPacificDay(settled[2].value, day) : null;
      showReading({ reads, writes, deletes }, now);
    } catch (error) {
      clearReading("Não foi possível confirmar o consumo. Abra o painel oficial acima e tente novamente.");
      const message = String(error?.message || error);
      setStatus(/HTTP 403/.test(message) ? "Sem permissão para ler métricas" :
        /HTTP 401/.test(message) ? "Acesso expirou; conecte novamente" :
        /Sem métricas/.test(message) ? "Métricas de hoje ainda indisponíveis" : "Medição indisponível", "atencao");
    } finally {
      busy = false;
      button.disabled = false;
    }
  }

  function requestGoogleAccess() {
    if (!authorizedAdmin) { setStatus("Entre no painel para medir", "atencao"); return; }
    if (token && Date.now() < tokenExpiresAt) { void measure(); return; }
    const id = clientId();
    if (!validClientId(id)) { setStatus("Configure um Client ID OAuth web válido", "atencao"); $("consumo-client-id").focus(); return; }
    if (!root.google?.accounts?.oauth2?.initTokenClient) { setStatus("Autorização Google não carregou; recarregue a página", "atencao"); return; }
    try {
      const oauth = root.google.accounts.oauth2.initTokenClient({
        client_id: id,
        scope: SCOPE,
        include_granted_scopes: false,
        callback: (response) => {
          if (response.error || !response.access_token) { setStatus("Autorização não concluída", "atencao"); return; }
          token = response.access_token;
          tokenExpiresAt = Date.now() + Math.max(0, (Number(response.expires_in) - 60) * 1000);
          void measure();
        },
        error_callback: () => setStatus("Janela de autorização não concluiu", "atencao")
      });
      oauth.requestAccessToken({ prompt: "consent" });
    } catch {
      setStatus("Não foi possível abrir a autorização Google", "atencao");
    }
  }

  clientField.value = safeStorageGet("rdc-monitoring-oauth-client-id") || safeStorageGet("rdc-youtube-oauth-client-id");
  $("btn-consumo-client-id").addEventListener("click", () => {
    const id = (clientField.value || "").trim();
    if (!validClientId(id)) { setStatus("Client ID OAuth web inválido", "atencao"); return; }
    setStatus(safeStorageSet("rdc-monitoring-oauth-client-id", id) ? "Client ID salvo neste aparelho" : "O navegador não permitiu salvar o Client ID");
  });
  button.addEventListener("click", requestGoogleAccess);
  if (root.firebase?.auth) {
    root.firebase.auth().onAuthStateChanged((user) => {
      authorizedAdmin = Boolean(user);
      if (!user) {
        token = "";
        tokenExpiresAt = 0;
        clearReading("Entre no painel para medir o consumo.");
        setStatus("Sem medição");
      }
    });
  }
  intervalId = root.setInterval(() => { if (authorizedAdmin && token && Date.now() < tokenExpiresAt) void measure(); }, 15 * 60 * 1000);
  root.addEventListener("beforeunload", () => root.clearInterval(intervalId), { once: true });
})(typeof window === "undefined" ? globalThis : window);
