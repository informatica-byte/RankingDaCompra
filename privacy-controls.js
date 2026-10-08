(function () {
  'use strict';
  if (window.RDCPrivacy) return;
  const KEY = 'rdc-privacy-choice-v1', TTL = 180 * 86400000;
  const GA = 'G-NBKRX8TTR6';
  let memory = null, loaded = false;
  function choice() {
    let value = memory;
    try { value = JSON.parse(localStorage.getItem(KEY) || 'null') || memory; } catch {}
    return value?.version === 1 && typeof value.analytics === 'boolean'
      && Number(value.expiresAt) > Date.now() ? value : null;
  }
  const analyticsAllowed = () => choice()?.analytics === true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    if (arguments[0] === 'consent' || analyticsAllowed()) window.dataLayer.push(arguments);
  };
  const consent = granted => ({analytics_storage: granted ? 'granted' : 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
  window.gtag('consent', 'default', consent(false));
  function clearAnalyticsCookies() {
    for (const cookie of String(document.cookie || '').split(';')) {
      const name = cookie.trim().split('=')[0];
      if (!/^_ga(?:_|$)|^_gid$|^_gat(?:_|$)/.test(name)) continue;
      for (const domain of ['', location.hostname, '.rankingdacompra.com.br']) {
        document.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : '') + '; SameSite=Lax';
      }
    }
  }
  function apply() {
    const allowed = analyticsAllowed();
    window['ga-disable-' + GA] = !allowed;
    window.gtag('consent', 'update', consent(allowed));
    if (!allowed) { clearAnalyticsCookies(); return; }
    if (loaded) return;
    loaded = true;
    window.gtag('js', new Date());
    window.gtag('config', GA, {allow_google_signals: false, allow_ad_personalization_signals: false});
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA;
    document.head.appendChild(tag);
  }
  function save(analytics) {
    memory = {version: 1, analytics: analytics === true, expiresAt: Date.now() + TTL};
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch {}
    apply();
    const banner = document.getElementById('rdc-privacy-banner');
    if (banner) banner.hidden = true;
    window.dispatchEvent(new CustomEvent('rdc-privacy-change', {detail: {analytics: analyticsAllowed()}}));
  }
  function whenAnalyticsAllowed(callback) {
    if (analyticsAllowed()) { callback(); return; }
    const listener = () => {
      if (!analyticsAllowed()) return;
      window.removeEventListener('rdc-privacy-change', listener);
      callback();
    };
    window.addEventListener('rdc-privacy-change', listener);
  }
  function render() {
    if (!document.body || document.getElementById('rdc-privacy-banner')) return;
    const style = document.createElement('style');
    style.textContent = '.rdc-privacy-banner{position:fixed;z-index:20000;bottom:88px;left:16px;right:16px;max-width:700px;margin:auto;padding:18px;background:#fff;color:#16312a;border:1px solid #a6c3b6;border-radius:12px;box-shadow:0 5px 25px #0003;font:15px/1.5 system-ui}.rdc-privacy-banner[hidden]{display:none}.rdc-privacy-actions{display:flex;flex-wrap:wrap;gap:10px}.rdc-privacy-actions button,.rdc-privacy-settings{min-height:44px;padding:9px 13px;border:1px solid #075b49;border-radius:7px;background:#fff;color:#075b49;font-weight:700;cursor:pointer}.rdc-privacy-settings{position:fixed;z-index:15000;bottom:12px;left:12px;font-size:12px}.rdc-privacy-banner a{color:#075b49}.rdc-privacy-banner button:focus-visible,.rdc-privacy-settings:focus-visible{outline:3px solid #1769e0;outline-offset:3px}';
    document.head.appendChild(style);
    // No celular, manter o controle acima do botão fixo de compra, sem cobri-lo.
    style.textContent += '@media(max-width:700px){.rdc-privacy-settings{bottom:76px}}';
    const banner = document.createElement('section');
    banner.id = 'rdc-privacy-banner'; banner.className = 'rdc-privacy-banner';
    banner.setAttribute('aria-label', 'Escolhas de privacidade');
    banner.innerHTML = '<strong>Suas escolhas de privacidade</strong><p>O site funciona sem métricas opcionais. Com sua autorização, usamos Google Analytics e registros de visitas e cliques para melhorar os comparativos. Login, segurança e suas preferências locais continuam funcionando ao recusar.</p><div class="rdc-privacy-actions"><button type="button" data-privacy-accept>Aceitar métricas</button><button type="button" data-privacy-reject>Recusar métricas</button><a href="/privacidade.html">Ler a política</a></div>';
    banner.hidden = Boolean(choice());
    banner.querySelector('[data-privacy-accept]').addEventListener('click', () => save(true));
    banner.querySelector('[data-privacy-reject]').addEventListener('click', () => save(false));
    document.body.appendChild(banner);
    const settings = document.createElement('button');
    settings.type = 'button'; settings.className = 'rdc-privacy-settings'; settings.textContent = 'Privacidade';
    settings.setAttribute('aria-controls', banner.id);
    settings.addEventListener('click', () => { banner.hidden = false; banner.querySelector('button').focus(); });
    document.body.appendChild(settings);
  }
  window.RDCPrivacy = Object.freeze({analyticsAllowed, whenAnalyticsAllowed, setAnalytics: save});
  window.addEventListener('storage', event => { if (event.key === KEY) { memory = null; apply(); window.dispatchEvent(new CustomEvent('rdc-privacy-change')); } });
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, {once: true});
  else render();
})();
