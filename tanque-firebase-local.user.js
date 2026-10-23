// ==UserScript==
// @name         Ranking da Compra — Tanque Firebase local
// @namespace    rankingdacompra.tanque-local
// @version      1.0.0
// @description  Lê somente o total já exibido no console e atualiza o tanque neste navegador. Não faz consultas à rede.
// @match        https://console.firebase.google.com/project/rankingdacompra/firestore/*
// @match        https://console.firebase.google.com/u/*/project/rankingdacompra/firestore/*
// @match        https://rankingdacompra.com.br/dashboard.html*
// @match        https://rankingdacompra.com.br/painel-celular.html*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// @noframes
// @sandbox      DOM
// @updateURL    none
// @downloadURL  none
// ==/UserScript==

/* Independente do bot-precos. Sem chamadas HTTP, credenciais, SDK ou submissão de formulários.
   O único compartilhamento é o armazenamento local privado DESTE userscript entre suas abas. */
(function () {
  'use strict';
  const KEY = 'rdc-tanque-local-leitura-v1';
  const PAUSED = 'rdc-tanque-local-pausado-v1';
  const LIMIT = 50000;
  const STALE = 45 * 60 * 1000;
  const EVERY = 15000;
  const ZONE = 'America/Los_Angeles';
  const fmt = new Intl.NumberFormat('pt-BR');
  const normalize = value => String(value || '').replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();

  function quotaDay(value = new Date()) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k).value).join('-');
  }

  function route(href) {
    try {
      const url = new URL(href);
      if (url.protocol !== 'https:') return '';
      if (url.hostname === 'console.firebase.google.com' && /^\/(?:u\/\d+\/)?project\/rankingdacompra\/firestore\/databases\/-default-\/usage\/[^/]+\/?$/.test(url.pathname)) return 'console';
      if (url.hostname === 'rankingdacompra.com.br' && url.pathname === '/dashboard.html') return 'dashboard';
      if (url.hostname === 'rankingdacompra.com.br' && url.pathname === '/painel-celular.html') return 'mobile';
    } catch { /* Endereço fora do escopo. */ }
    return '';
  }

  // Não converte travessão/ausência em zero. Preserva a informação de arredondamento.
  function counter(raw, language = 'pt') {
    const value = normalize(raw).toLowerCase();
    const match = value.match(/^(\d[\d.,]*)(?:\s*(mil|k|mi|m))?$/);
    if (!match) return null;
    const suffix = match[2] || '';
    let number = match[1];
    if (!suffix) {
      const grouped = /^pt/i.test(language) ? /^\d{1,3}(?:\.\d{3})+$/ : /^\d{1,3}(?:,\d{3})+$/;
      if (grouped.test(number)) number = number.replace(/[.,]/g, '');
      else if (!/^\d+$/.test(number)) return null;
    } else {
      // Uma unidade abreviada é sempre uma estimativa, mesmo quando resulta em inteiro.
      if (!/^\d+(?:[.,]\d{1,3})?$/.test(number)) return null;
      // Não confunde separador de milhares com decimal quando há uma unidade abreviada.
      if (/^pt/i.test(language) ? number.includes('.') : number.includes(',')) return null;
      number = number.replace(',', '.');
    }
    const total = Number(number) * (suffix === 'mi' || suffix === 'm' ? 1000000 : suffix ? 1000 : 1);
    const reads = Math.round(total);
    if (!Number.isSafeInteger(reads) || Math.abs(total - reads) > 0.00001) return null;
    return { reads, rounded: Boolean(suffix) };
  }

  function correctRange(label, range, now = new Date()) {
    if (!/^(current quota period|período atual da cota|período de cota atual|cota atual)$/i.test(normalize(label))) return false;
    const months = { jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12 };
    const match = normalize(range).toLowerCase().match(/^([a-z]{3})\.?\s+(\d{1,2})\s*[-–]\s*([a-z]{3})\.?\s+(\d{1,2})\s*\(gmt([+-]\d{1,2})(?::00)?\)$/);
    if (!match || ![-7, -8].includes(Number(match[5]))) return false;
    const day = quotaDay(now);
    if (!day) return false;
    const date = new Date(day + 'T12:00:00Z');
    const next = new Date(date); next.setUTCDate(next.getUTCDate() + 1);
    // Compara as datas do seletor: uma aba antiga não vira uma leitura nova à meia-noite.
    return months[match[1]] === date.getUTCMonth() + 1 && Number(match[2]) === date.getUTCDate()
      && months[match[3]] === next.getUTCMonth() + 1 && Number(match[4]) === next.getUTCDate();
  }

  function visible(element) {
    if (!element || element.hidden || !element.getClientRects().length) return false;
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function readScreen(doc, href, now = new Date()) {
    if (route(href) !== 'console') return null;
    const pickers = Array.from(doc.querySelectorAll('fire-date-range-picker-button')).filter(visible);
    if (pickers.length !== 1) return null;
    const picker = pickers[0];
    if (!correctRange(picker.querySelector('selected-value')?.textContent, picker.querySelector('selected-range')?.textContent, now)) return null;
    const metrics = Array.from(doc.querySelectorAll('fire-c13g-multi-time-series-selector .metric-toggle')).filter(element =>
      visible(element) && /^(leituras|reads|document reads)$/i.test(normalize(element.querySelector('.metric-label')?.textContent)));
    if (metrics.length !== 1) return null;
    const metric = metrics[0];
    const totals = Array.from(metric.querySelectorAll('.metric-aggregation-label')).filter(visible);
    const values = Array.from(metric.querySelectorAll('.metric-value')).filter(visible);
    if (totals.length !== 1 || normalize(totals[0].textContent).toLowerCase() !== 'total' || values.length !== 1) return null;
    const card = metric.closest('mat-card');
    if (!card || Array.from(card.querySelectorAll('[role="progressbar"],mat-progress-spinner,.fire-spinner')).some(visible)) return null;
    const parsed = counter(values[0].textContent, doc.documentElement.lang);
    return parsed ? { day: quotaDay(now), ...parsed } : null;
  }

  function snapshot(value, now = new Date()) {
    if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'at,day,reads,rounded') return null;
    const at = new Date(value.at);
    if (typeof value.at !== 'string' || !Number.isSafeInteger(value.reads) || value.reads < 0 || typeof value.rounded !== 'boolean'
      || value.day !== quotaDay(now) || quotaDay(at) !== value.day || !Number.isFinite(at.getTime()) || at.getTime() > now.getTime()) return null;
    return { day: value.day, reads: value.reads, rounded: value.rounded, at: at.toISOString() };
  }

  function nextSnapshot(previous, reading, now = new Date(), explicitRead = false) {
    if (!reading) return null;
    const proposed = snapshot({ ...reading, at: now.toISOString() }, now);
    if (!proposed) return null;
    const last = snapshot(previous, now);
    // Duas abas não podem fazer um valor menor sobrescrever a última leitura do mesmo dia.
    if (last && proposed.reads < last.reads) return null;
    if (!explicitRead && last && last.reads === proposed.reads && last.rounded === proposed.rounded) return last;
    return proposed;
  }

  function model(value, now = new Date()) {
    const data = snapshot(value, now);
    if (!data) return null;
    return { ...data, remaining: Math.max(0, LIMIT - data.reads), angle: -180 * Math.min(1, data.reads / LIMIT),
      stale: now.getTime() - Date.parse(data.at) > STALE, critical: data.reads >= 42500 };
  }

  const helpers = { quotaDay, route, counter, correctRange, readScreen, snapshot, nextSnapshot, model, LIMIT, STALE };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (typeof document === 'undefined' || typeof GM_getValue !== 'function') return;

  const startedRoute = route(location.href);
  if (!startedRoute) return;
  let note, status, action, readButton, mobileValue, mobileProgress, managed = false;
  let rendered = '', previousMode = null;
  const $ = id => document.getElementById(id);
  const get = key => { try { return GM_getValue(key, null); } catch { return null; } };
  const put = (key, value) => { try { GM_setValue(key, value); return true; } catch { return false; } };
  const paused = () => get(PAUSED) === true;
  const text = (element, value) => { if (element && element.textContent !== value) element.textContent = value; };

  function panel() {
    if (note?.isConnected) return true;
    let host;
    if (startedRoute === 'console') host = document.querySelector('main,[role="main"]');
    if (startedRoute === 'dashboard') host = document.querySelector('.painel-consumo');
    if (startedRoute === 'mobile') host = $('app');
    if (!host) return false;
    note = document.createElement('aside'); note.id = 'rdc-tanque-local';
    note.style.cssText = 'box-sizing:border-box;position:relative;margin:12px 0;padding:14px;border:1px solid #a9c1b7;border-radius:12px;background:#f2faf6;color:#173f30;font:14px/1.5 system-ui;max-width:100%;overflow-wrap:anywhere;';
    const title = document.createElement('strong'); title.textContent = '⛽ Tanque Firebase local — Tampermonkey';
    status = document.createElement('p'); status.setAttribute('role', 'status'); status.style.margin = '8px 0';
    note.append(title, status);
    if (startedRoute === 'mobile') {
      mobileValue = document.createElement('p'); mobileProgress = document.createElement('progress');
      mobileProgress.max = LIMIT; mobileProgress.style.cssText = 'width:100%;height:16px;';
      mobileProgress.setAttribute('aria-label', 'Leituras estimadas do dia da cota'); note.append(mobileValue, mobileProgress);
    }
    const help = document.createElement('p'); help.style.cssText = 'font-size:12px;margin:6px 0';
    help.textContent = 'Somente neste perfil do navegador. Lê a tela do console, sem atualizar a página, consultar documentos ou chamar APIs. As métricas do Google podem atrasar.';
    action = document.createElement('button'); action.type = 'button';
    action.style.cssText = 'padding:9px 12px;min-height:44px;border:1px solid #a9c1b7;border-radius:8px;background:white;color:#173f30;cursor:pointer;margin:6px 8px 0 0;';
    action.addEventListener('click', () => { if (!put(PAUSED, !paused())) text(status, 'Armazenamento local indisponível.'); else tick(); });
    note.append(help, action);
    if (startedRoute === 'console') {
      readButton = document.createElement('button'); readButton.type = 'button'; readButton.textContent = 'Ler esta tela agora (sem consultar a rede)'; readButton.style.cssText = action.style.cssText;
      readButton.addEventListener('click', () => tick(true)); note.append(readButton);
    }
    if (startedRoute === 'mobile' || startedRoute === 'console') host.prepend(note); else host.append(note);
    return true;
  }

  function render(data) {
    const value = model(data);
    const stamp = value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value.at)) : '';
    const label = !value ? 'Aguardando leitura válida do período atual da cota no console do Firebase.'
      : `${value.stale ? 'Leitura antiga — confira/atualize o console pessoalmente. ' : ''}${value.rounded ? 'Total arredondado pelo Google. ' : ''}Tela lida em ${stamp}. Dia da cota no Pacífico: ${value.day}. Isto não é o horário de atualização do Google.`;
    text(status, label);
    if (startedRoute === 'mobile') {
      text(mobileValue, value ? `${value.rounded ? '≈ ' : ''}${fmt.format(value.reads)} / 50.000 leituras; ${value.rounded ? '≈ ' : ''}${fmt.format(value.remaining)} restantes estimadas.` : 'Consumo desconhecido — não é zero.');
      if (value) mobileProgress.value = Math.min(LIMIT, value.reads); else mobileProgress.removeAttribute('value');
    }
    if (startedRoute !== 'dashboard') return;
    const signature = JSON.stringify(value);
    if (signature === rendered && $('consumo-status')?.textContent?.startsWith('Tanque local')) return;
    rendered = signature;
    text(document.querySelector('.painel-consumo .consumo-subtitulo'), 'Tanque local via Tampermonkey. Sem API de métricas; o modo automático em nuvem continua desativado.');
    if (!value && !managed) return; // Não apaga um registro manual antes da primeira leitura local.
    managed = true;
    text($('consumo-leituras'), value ? `${value.rounded ? '≈ ' : ''}${fmt.format(value.reads)} / 50.000 leituras` : '— / 50.000 leituras');
    text($('consumo-restante'), value ? `${value.rounded ? '≈ ' : ''}${fmt.format(value.remaining)}` : '—');
    text($('consumo-status'), !value ? 'Tanque local — aguardando a cota de hoje' : value.stale ? 'Tanque local — leitura antiga' : value.critical ? 'Tanque local — atenção ao limite estimado' : 'Tanque local — estimativa do console');
    if ($('consumo-status')) $('consumo-status').className = 'consumo-status' + (value?.critical ? ' critico' : value?.stale ? ' atencao' : '');
    text($('consumo-hora'), label);
    if ($('consumo-ponteiro')) {
      $('consumo-ponteiro').style.visibility = value ? 'visible' : 'hidden';
      if (value) $('consumo-ponteiro').setAttribute('transform', `rotate(${value.angle} 120 119)`);
    }
    $('consumo-medidor')?.setAttribute('aria-label', value ? `${fmt.format(value.remaining)} leituras restantes estimadas; ${value.stale ? 'leitura antiga' : 'tela do console'}; não em tempo real` : 'Sem medição válida de hoje');
  }

  function tick(explicitRead = false) {
    if (!panel()) return;
    const mode = paused();
    text(action, mode ? 'Retomar tanque local' : 'Pausar tanque local');
    if (readButton) readButton.disabled = mode;
    if (startedRoute === 'console') {
      if (mode) { text(status, 'Tanque local pausado. Nenhuma leitura da tela será compartilhada.'); return; }
      const reading = readScreen(document, location.href);
      const previous = get(KEY);
      const next = nextSnapshot(previous, reading, new Date(), explicitRead);
      if (!next) { text(status, 'Sem leitura segura: abra Uso do banco padrão, escolha “Current quota period” e aguarde o total de Leituras. Última leitura preservada; nenhum zero inventado.'); return; }
      if (JSON.stringify(previous) !== JSON.stringify(next) && !put(KEY, next)) { text(status, 'Não foi possível salvar o agregado no armazenamento local do userscript.'); return; }
      text(status, `${next.rounded ? '≈ ' : ''}${fmt.format(next.reads)} leituras no dia ${next.day}. Tela observada em ${new Date(next.at).toLocaleString('pt-BR')}. ${model(next)?.stale ? 'Leitura antiga; atualize o console pessoalmente. ' : ''}Apenas total, dia, horário e indicação de arredondamento ficam neste navegador.`);
      return;
    }
    // Verifica apenas os controles visíveis; nunca lê usuário, senha ou sessão da aplicação.
    const logged = startedRoute === 'dashboard' ? visible($('admin-content')) && $('btn-consumo-salvar')?.disabled === false : visible($('app'));
    note.hidden = !logged;
    if (!logged) { previousMode = mode; return; }
    if (mode) {
      text(status, 'Tanque local pausado. O registro manual continua disponível; nenhuma conferência foi interrompida.');
      if (previousMode !== true && managed) text($('consumo-status'), 'Tanque local pausado — registro manual disponível');
      previousMode = true; return;
    }
    previousMode = false;
    render(get(KEY));
  }

  GM_addValueChangeListener(KEY, () => tick());
  GM_addValueChangeListener(PAUSED, () => tick());
  tick();
  const timer = setInterval(() => tick(), EVERY); // Só relê o DOM/armazenamento; nenhuma recarga de página.
  addEventListener('pagehide', () => clearInterval(timer), { once: true });
})();
