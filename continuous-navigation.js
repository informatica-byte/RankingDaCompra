(function () {
  'use strict';
  // Only the audio-owning top document lives on. Every public destination gets
  // its own complete document/JS realm; no eval, script replay or cloned app UI.
  try { if (window.parent !== window && window.parent.RDCContinuousNavigation?.owns(window)) return; } catch {}
  if (window.RDCContinuousNavigation || window.parent !== window) return;
  const KEY = 'rdcContinuous', docs = new WeakSet();
  let controls = null, optedIn = false, frame = null, currentDoc = document;
  let pending = null, deadline = null, headObserver = null;
  const supported = value => {
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin && /^\/(?:index\.html|comparar\.html|analises\.html|melhores-[a-z0-9-]+\.html|produto\/[a-zA-Z0-9_-]+\.html|presentes\/(?:[a-z0-9-]+\.html)?)?$/.test(url.pathname);
    } catch { return false; }
  };
  const owns = view => Boolean(frame && frame.contentWindow === view);
  const currentScroll = () => currentDoc.defaultView?.scrollY || 0;
  function remember() {
    history.replaceState({...history.state, [KEY]:{url:location.href, scroll:currentScroll()}}, '', location.href);
  }
  function syncHead(doc) {
    document.title = doc.title;
    document.documentElement.lang = doc.documentElement.lang || 'pt-BR';
    for (const selector of ['meta[name="description"]','meta[name="robots"]','meta[property^="og:"]','meta[name^="twitter:"]','link[rel="canonical"]','script[type="application/ld+json"]']) {
      document.head.querySelectorAll(selector).forEach(node=>node.remove());
      doc.head.querySelectorAll(selector).forEach(node=>document.head.appendChild(document.importNode(node, true)));
    }
    frame.title = doc.title || 'Conteúdo do Ranking da Compra';
  }
  function placePlayer(doc) {
    if (!controls || doc.getElementById(controls.panel.id)) return;
    const css = doc.createElement('style'); css.textContent = controls.style.textContent;
    css.dataset.rdcContinuousStyle = 'true'; doc.head.appendChild(css);
    const header = doc.querySelector('body > header'), main = doc.querySelector('body > main, #app');
    if (header) header.after(controls.panel);
    else if (main) main.before(controls.panel);
    else doc.body.prepend(controls.panel);
    controls.detachDirectListeners();
  }
  function attach(doc) {
    if (doc !== document && !owns(doc.defaultView)) return;
    if (doc !== document) placePlayer(doc);
    if (docs.has(doc)) return;
    docs.add(doc);
    doc.addEventListener('click', onClick);
    doc.addEventListener('submit', onSubmit, true);
    if (doc !== document) {
      doc.addEventListener('play', event=>controls?.onMedia(event), true);
      doc.addEventListener('input', event=>{
        if (event.target?.id === 'rdc-music-volume') controls?.onVolume();
      });
    }
  }
  function fallBack(url) {
    if (deadline !== null) { clearTimeout(deadline); deadline = null; }
    pending = null;
    // Normal navigation is the recovery path, not an empty or misleading page.
    location.assign(url);
  }
  function loaded() {
    let request = pending;
    // Also synchronize a public-page redirect initiated by that page's own JS.
    if (!request) {
      try { request = {url:frame.contentWindow.location.href,scroll:0}; }
      catch { fallBack(location.href); return; }
    }
    try {
      const doc = frame.contentDocument, url = frame.contentWindow.location.href;
      if (!doc?.body || !supported(url) || !doc.querySelector('script[src*="ambient-music.js"]')) throw new Error('Not a public page');
      if (deadline !== null) { clearTimeout(deadline); deadline = null; }
      attach(doc);
      if (currentDoc === document) {
        // Keep the original DOM inert: its existing closures cannot mutate the
        // destination, trigger duplicate app initializers or lose form data.
        const original = document.createElement('div');
        original.hidden = true; original.inert = true; original.id = 'rdc-original-page';
        original.style.setProperty('display','none','important');
        for (const node of [...document.body.childNodes]) if (node !== frame) original.appendChild(node);
        original.querySelectorAll('video,audio').forEach(media=>media.pause());
        original.querySelectorAll('iframe').forEach(embed=>embed.remove());
        document.body.appendChild(original);
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
      }
      currentDoc = doc;
      frame.hidden = false;
      history.replaceState({...history.state,[KEY]:{url,scroll:request.scroll || 0}}, '', url);
      syncHead(doc);
      headObserver?.disconnect();
      headObserver = new MutationObserver(()=>syncHead(doc));
      headObserver.observe(doc.head,{childList:true,subtree:true,characterData:true,attributes:true});
      const target = new URL(url).hash;
      let anchor = null;
      try { anchor = target ? doc.getElementById(decodeURIComponent(target.slice(1))) : null; } catch {}
      if (anchor) anchor.scrollIntoView();
      else doc.defaultView.scrollTo(0, request.scroll || 0);
      const heading = doc.querySelector('h1');
      if (heading) { heading.setAttribute('tabindex','-1'); heading.focus({preventScroll:true}); }
      pending = null;
    } catch { fallBack(request.url); }
  }
  function navigate(value, {pop = false, scroll = 0} = {}) {
    const url = new URL(value, currentDoc.location.href);
    const from = currentDoc.location.href;
    if (!supported(url.href)) { fallBack(url.href); return; }
    if (deadline !== null) clearTimeout(deadline);
    if (!frame) window.RDCPrivacy?.suspendDocumentMetrics?.();
    if (!pop) {
      remember();
      history.pushState({...history.state,[KEY]:{url:url.href,scroll:0}}, '', url.href);
    }
    pending = {url:url.href,scroll,from};
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'rdc-continuous-page'; frame.title = 'Conteúdo do Ranking da Compra';
      frame.hidden = true; frame.setAttribute('allow','fullscreen');
      frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;height:100dvh;border:0;margin:0;padding:0;background:#fff;z-index:2147483000';
      frame.addEventListener('load',loaded);
      frame.addEventListener('error',()=>{ if (pending) fallBack(pending.url); });
      frame.src = url.href; document.body.appendChild(frame);
    } else {
      // replace avoids a second, nested browser-history entry for each page.
      frame.contentWindow.location.replace(url.href);
    }
    deadline = setTimeout(()=>{if (pending) fallBack(pending.url);},15000);
  }
  function onClick(event) {
    if (event.target?.ownerDocument !== document && event.target?.closest?.('#rdc-music-toggle')) {
      event.preventDefault(); void controls?.onToggle(); return;
    }
    if (!optedIn || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const link = event.target?.closest?.('a[href]');
    if (!link || link.hasAttribute('download')) return;
    const doc = link.ownerDocument;
    const target = link.getAttribute('target') || doc.querySelector('base[target]')?.getAttribute('target') || '_self';
    if (target.toLowerCase() !== '_self') return;
    const url = new URL(link.href, doc.location.href), from = new URL(doc.location.href);
    if (!/^https?:$/.test(url.protocol)) return;
    if (url.pathname === from.pathname && url.search === from.search && url.origin === from.origin) {
      if (doc === document) return; // Native anchors do not reload the first page.
      event.preventDefault(); remember();
      history.pushState({...history.state,[KEY]:{url:url.href,scroll:currentScroll()}},'',url.href);
      doc.defaultView.history.replaceState(null,'',url.href);
      try { doc.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView(); } catch {}
      return;
    }
    if (!supported(url.href) && doc === document) return;
    event.preventDefault();
    navigate(url.href);
  }
  function onSubmit(event) {
    if (!optedIn || event.defaultPrevented) return;
    const form = event.target;
    // These are the site's public GET searches, not logins or editing forms.
    if (!form.matches?.('form[role="search"]') || form.method.toLowerCase() !== 'get') return;
    const term = String(new FormData(form).get('busca') || '').trim();
    if (!term) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const url = new URL('/', form.ownerDocument.location.href);
    url.searchParams.set('busca',term); navigate(url.href);
  }
  window.addEventListener('popstate',event=>{
    if (!frame) return;
    const saved = event.state?.[KEY];
    if (saved && supported(location.href)) navigate(location.href,{pop:true,scroll:saved.scroll});
    else fallBack(location.href);
  });
  window.RDCContinuousNavigation = Object.freeze({
    owns, attach,
    referrerFor(view) { return owns(view) ? pending?.from || '' : ''; },
    bind(value) { controls = value; attach(document); },
    enable() { optedIn = true; }
  });
})();
