(function () {
  "use strict";

  const STORAGE_KEY = "rdc-search-console-opportunities-v1";
  const SEARCH_CONSOLE_URL = "https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Arankingdacompra.com.br";

  function normalizeHeader(value) {
    return String(value || "")
      .replace(/^\uFEFF/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function parseCsvWithDelimiter(text, delimiter) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    const source = String(text || "").replace(/^\uFEFF/, "");
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (char === '"') {
        if (quoted && source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === delimiter && !quoted) {
        row.push(field);
        field = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && source[index + 1] === "\n") index += 1;
        row.push(field);
        if (row.some((item) => String(item).trim())) rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
    row.push(field);
    if (row.some((item) => String(item).trim())) rows.push(row);
    return rows;
  }

  function parseCsv(text) {
    const comma = parseCsvWithDelimiter(text, ",");
    const semicolon = parseCsvWithDelimiter(text, ";");
    const commaColumns = comma[0]?.length || 0;
    const semicolonColumns = semicolon[0]?.length || 0;
    return semicolonColumns > commaColumns ? semicolon : comma;
  }

  function localizedNumber(value, integer) {
    let source = String(value ?? "").replace(/\s|\u00a0/g, "").replace(/%$/, "");
    if (!source) return 0;
    const lastComma = source.lastIndexOf(",");
    const lastDot = source.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
      source = lastComma > lastDot
        ? source.replace(/\./g, "").replace(",", ".")
        : source.replace(/,/g, "");
    } else if (lastComma >= 0) {
      source = source.replace(/\./g, "").replace(",", ".");
    } else if (integer && /^\d{1,3}(\.\d{3})+$/.test(source)) {
      source = source.replace(/\./g, "");
    }
    const number = Number(source.replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(number) ? number : 0;
  }

  function findColumn(headers, pattern) {
    return headers.findIndex((header) => pattern.test(header));
  }

  function parseSearchConsoleCsv(text) {
    const table = parseCsv(text);
    if (table.length < 2) throw new Error("O arquivo não contém linhas suficientes.");
    const headers = table[0].map(normalizeHeader);
    const clicksIndex = findColumn(headers, /^(clique|cliques|click|clicks)$/);
    const impressionsIndex = findColumn(headers, /^(impressao|impressoes|impression|impressions)$/);
    const ctrIndex = findColumn(headers, /^ctr$/);
    const positionIndex = findColumn(headers, /posicao|position/);
    const metricIndexes = new Set([clicksIndex, impressionsIndex, ctrIndex, positionIndex]);
    const dimensionIndex = headers.findIndex((header, index) => header && !metricIndexes.has(index));
    if ([clicksIndex, impressionsIndex, ctrIndex, positionIndex, dimensionIndex].some((index) => index < 0)) {
      throw new Error("Use o CSV exportado da tabela de Consultas ou Páginas do Search Console.");
    }
    const dimensionHeader = headers[dimensionIndex];
    const kind = /consulta|query/.test(dimensionHeader) ? "consulta" : /pagina|page/.test(dimensionHeader) ? "pagina" : "item";
    const rows = table.slice(1).map((columns) => {
      const label = String(columns[dimensionIndex] || "").trim();
      const clicks = Math.max(0, Math.round(localizedNumber(columns[clicksIndex], true)));
      const impressions = Math.max(0, Math.round(localizedNumber(columns[impressionsIndex], true)));
      const rawCtr = String(columns[ctrIndex] || "");
      let ctr = Math.max(0, localizedNumber(rawCtr, false));
      if (!rawCtr.includes("%") && ctr > 0 && ctr <= 1) ctr *= 100;
      const position = Math.max(0, localizedNumber(columns[positionIndex], false));
      return { label, clicks, impressions, ctr, position, kind };
    }).filter((row) => row.label && row.impressions > 0 && row.position > 0);
    if (!rows.length) throw new Error("Nenhuma consulta ou página com impressões foi encontrada.");
    return rows;
  }

  function opportunityAction(item) {
    if (item.position <= 3 && item.ctr < 3) return "Já aparece no topo: melhorar título e descrição para conquistar mais cliques.";
    if (item.position <= 10) return "Vitória rápida: alinhar título, introdução e comparação exatamente com esta procura.";
    if (item.position <= 20) return "Reforçar resposta, critérios reais e links internos de páginas relacionadas.";
    return "Avaliar uma pauta específica somente se a procura combinar com os produtos disponíveis.";
  }

  function analyzeRows(rows) {
    const clicks = rows.reduce((total, row) => total + row.clicks, 0);
    const impressions = rows.reduce((total, row) => total + row.impressions, 0);
    const ctr = impressions ? clicks / impressions * 100 : 0;
    const opportunities = rows
      .filter((row) => row.impressions >= 2 && (row.ctr < 5 || row.position > 10))
      .map((row) => {
        const positionWeight = row.position <= 3 ? 1.15 : row.position <= 10 ? 1.5 : row.position <= 20 ? 1.25 : row.position <= 40 ? 0.7 : 0.25;
        const clickGap = Math.max(0.5, 5 - row.ctr);
        return { ...row, score: row.impressions * clickGap * positionWeight, action: opportunityAction(row) };
      })
      .sort((a, b) => b.score - a.score || b.impressions - a.impressions)
      .slice(0, 50);
    return {
      importedAt: new Date().toISOString(),
      sourceRows: rows.length,
      clicks,
      impressions,
      ctr,
      quickWins: opportunities.filter((item) => item.position >= 4 && item.position <= 15 && item.ctr < 3).length,
      opportunities
    };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function formatNumber(value, maximumFractionDigits = 0) {
    return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits });
  }

  function shortLabel(value) {
    const text = String(value || "").trim();
    if (text.length <= 84) return text;
    return text.slice(0, 81).trimEnd() + "…";
  }

  function suggestedTitle(item) {
    if (item.kind !== "consulta") return "";
    const query = String(item.label || "").replace(/\s+/g, " ").trim();
    if (!query) return "";
    const prefix = query.charAt(0).toUpperCase() + query.slice(1);
    const suffix = /melhor|vale a pena|compar/i.test(prefix) ? "" : ": comparação e melhores opções";
    const title = prefix + suffix + " em 2026";
    return title.length <= 70 ? title : title.slice(0, 67).replace(/\s+\S*$/, "") + "…";
  }

  function storageRead() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return value?.opportunities ? value : null;
    } catch {
      return null;
    }
  }

  function storageWrite(report) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
    } catch (error) {
      console.warn("Não foi possível guardar a análise SEO neste navegador.", error);
    }
  }

  function storageClear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  function renderReport(root, report) {
    const result = root.querySelector("[data-seo-result]");
    const clearButton = root.querySelector("[data-seo-clear]");
    if (!result) return;
    if (!report) {
      result.innerHTML = '<div class="seo-empty"><b>Nenhum relatório importado.</b><span>O arquivo só será analisado neste aparelho e não será enviado ao Firebase.</span></div>';
      if (clearButton) clearButton.hidden = true;
      return;
    }
    if (clearButton) clearButton.hidden = false;
    const date = new Date(report.importedAt).toLocaleString("pt-BR");
    const top = report.opportunities.slice(0, 10);
    const rows = top.map((item, index) => {
      const title = suggestedTitle(item);
      const value = encodeURIComponent(JSON.stringify({ label: item.label, title }));
      const priority = item.position <= 15 && item.ctr < 3 ? "Alta" : item.position <= 20 ? "Média" : "Analisar";
      return '<tr><td><span class="seo-rank">#' + (index + 1) + '</span><span class="seo-priority seo-priority-' + priority.toLowerCase().replace("é", "e") + '">' + priority + '</span></td><td><b>' + escapeHtml(shortLabel(item.label)) + '</b><small>' + escapeHtml(item.action) + '</small></td><td>' + formatNumber(item.impressions) + '</td><td>' + formatNumber(item.ctr, 1) + '%</td><td>' + formatNumber(item.position, 1) + '</td><td><button type="button" data-seo-use="' + value + '">' + (item.kind === "consulta" ? "Usar como pauta" : "Abrir página") + '</button></td></tr>';
    }).join("");
    result.innerHTML = '<div class="seo-summary"><div><strong>' + formatNumber(report.impressions) + '</strong><span>Impressões no arquivo</span></div><div><strong>' + formatNumber(report.clicks) + '</strong><span>Cliques</span></div><div><strong>' + formatNumber(report.ctr, 1) + '%</strong><span>CTR calculado</span></div><div><strong>' + formatNumber(report.quickWins) + '</strong><span>Vitórias rápidas</span></div></div><div class="seo-recommendation"><b>Prioridade recomendada:</b> trabalhe primeiro nas linhas “Alta”. Elas já aparecem perto da primeira página, mas ainda recebem poucos cliques. Nenhuma alteração é publicada automaticamente.</div><div class="seo-table"><table><thead><tr><th>Prioridade</th><th>Consulta ou página</th><th>Impressões</th><th>CTR</th><th>Posição</th><th>Ação</th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="seo-date">Importado em ' + escapeHtml(date) + ' · ' + formatNumber(report.sourceRows) + ' linha(s) analisada(s). Pontuação combina impressões, CTR abaixo de 5% e posição atual.</p>';
  }

  function useOpportunity(root, encoded) {
    let item;
    try { item = JSON.parse(decodeURIComponent(encoded)); } catch { return; }
    if (/^https?:\/\//i.test(item.label)) {
      window.open(item.label, "_blank", "noopener,noreferrer");
      return;
    }
    const queryFields = [document.getElementById("weekly-ranking-query"), document.getElementById("ranking-termo")].filter(Boolean);
    const titleFields = [document.getElementById("weekly-ranking-seo-title"), document.getElementById("ranking-titulo-seo")].filter(Boolean);
    queryFields.forEach((field) => { field.value = item.label; field.dispatchEvent(new Event("input", { bubbles: true })); });
    titleFields.forEach((field) => { if (item.title) field.value = item.title; field.dispatchEvent(new Event("input", { bubbles: true })); });
    const destination = document.getElementById("weekly-ranking-admin") || document.getElementById("ranking-mobile");
    destination?.scrollIntoView({ behavior: "smooth", block: "start" });
    const status = root.querySelector("[data-seo-status]");
    if (status) status.textContent = "Pauta preenchida no ranking. Confira os produtos e aprove antes de publicar.";
  }

  function injectStyles() {
    if (document.getElementById("rdc-seo-opportunities-style")) return;
    const style = document.createElement("style");
    style.id = "rdc-seo-opportunities-style";
    style.textContent = '.seo-opportunities{color:#173e2f}.seo-opportunities h3,.seo-opportunities h2{margin:0 0 6px}.seo-opportunities p{margin:0 0 12px;color:#62736b;line-height:1.45}.seo-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.seo-toolbar a,.seo-toolbar label,.seo-toolbar button,.seo-table button{display:inline-flex;align-items:center;justify-content:center;border:1px solid #9dcbb6;border-radius:8px;padding:10px 12px;background:#fff;color:#075f42;font:800 12px inherit;text-decoration:none;cursor:pointer}.seo-toolbar label{background:#087a4d;color:#fff;border-color:#087a4d}.seo-toolbar input{position:absolute;inline-size:1px;block-size:1px;opacity:0}.seo-status{min-height:18px;color:#075f42;font-size:12px;font-weight:800}.seo-empty{padding:14px;background:#f0f8f4;border-radius:10px}.seo-empty span{display:block;margin-top:4px;color:#62736b;font-size:12px}.seo-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0}.seo-summary div{padding:12px;background:#f3faf6;border:1px solid #d7e9df;border-radius:10px}.seo-summary strong{display:block;color:#087a4d;font-size:22px}.seo-summary span{display:block;margin-top:4px;color:#64756d;font-size:10px;font-weight:800}.seo-recommendation{padding:12px;border-left:5px solid #d49a00;border-radius:9px;background:#fff6df;color:#664f0a;font-size:12px;line-height:1.45}.seo-table{overflow:auto;margin-top:12px}.seo-table table{width:100%;min-width:760px;border-collapse:collapse;background:#fff}.seo-table th,.seo-table td{padding:8px 7px;border-bottom:1px solid #e6eee9;text-align:left;font-size:11px;vertical-align:top}.seo-table th{background:#f3f7f5;color:#5c6c64}.seo-table td small{display:block;margin-top:4px;color:#63736b;line-height:1.35}.seo-rank{font-weight:900;margin-right:5px}.seo-priority{display:inline-block;border-radius:999px;padding:3px 6px;font-size:9px;font-weight:900}.seo-priority-alta{background:#fee2e2;color:#991b1b}.seo-priority-media{background:#fef3c7;color:#7c5700}.seo-priority-analisar{background:#e8f1ff;color:#24528d}.seo-date{margin-top:8px!important;font-size:10px!important}.card .seo-toolbar>*{flex:1;min-height:44px}.card .seo-summary{grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:650px){.seo-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.seo-toolbar>*{flex:1 1 145px}}';
    document.head.appendChild(style);
  }

  function mount(root) {
    if (!root || root.dataset.seoMounted === "true") return;
    root.dataset.seoMounted = "true";
    root.classList.add("seo-opportunities");
    const mobile = root.id.includes("mobile");
    root.innerHTML = (mobile ? '<div class="etapa">Visibilidade no Google</div><h2>🔎 Oportunidades SEO</h2>' : '<h3>🔎 Central SEO de oportunidades</h3>')
      + '<p>Importe o CSV de <b>Consultas</b> ou <b>Páginas</b> do Search Console. A central encontra impressões com poucos cliques e sugere onde agir primeiro.</p>'
      + '<div class="seo-toolbar"><a href="' + SEARCH_CONSOLE_URL + '" target="_blank" rel="noopener noreferrer">1. Abrir Search Console</a><label>2. Escolher CSV<input type="file" accept=".csv,text/csv" data-seo-file></label><button type="button" data-seo-clear hidden>Limpar relatório</button></div>'
      + '<div class="seo-status" data-seo-status role="status" aria-live="polite">Nenhum dado é enviado ao Firebase.</div><div data-seo-result></div>';
    renderReport(root, storageRead());
    root.querySelector("[data-seo-file]")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      const status = root.querySelector("[data-seo-status]");
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        if (status) status.textContent = "O arquivo é muito grande. Exporte apenas Consultas ou Páginas em CSV.";
        return;
      }
      try {
        if (status) status.textContent = "Analisando o arquivo neste aparelho...";
        const report = analyzeRows(parseSearchConsoleCsv(await file.text()));
        storageWrite(report);
        document.querySelectorAll("#seo-opportunities-dashboard,#seo-opportunities-mobile").forEach((item) => renderReport(item, report));
        if (status) status.textContent = "Análise concluída. Revise as oportunidades antes de alterar ou publicar.";
      } catch (error) {
        if (status) status.textContent = "Não foi possível analisar: " + String(error?.message || error);
      } finally {
        event.target.value = "";
      }
    });
    root.addEventListener("click", (event) => {
      const clear = event.target.closest?.("[data-seo-clear]");
      const use = event.target.closest?.("[data-seo-use]");
      if (clear) {
        storageClear();
        document.querySelectorAll("#seo-opportunities-dashboard,#seo-opportunities-mobile").forEach((item) => renderReport(item, null));
      } else if (use) {
        useOpportunity(root, use.dataset.seoUse);
      }
    });
  }

  const api = { parseSearchConsoleCsv, analyzeRows, opportunityAction };
  if (typeof window !== "undefined") window.RankingSEOOpportunities = api;
  if (typeof document !== "undefined") {
    const start = () => {
      injectStyles();
      [document.getElementById("seo-opportunities-dashboard"), document.getElementById("seo-opportunities-mobile")].forEach(mount);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})();
