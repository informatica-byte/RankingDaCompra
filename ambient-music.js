(function () {
  'use strict';
  // Original, locally synthesized instrumental. No recordings, streams or trackers.
  const VOLUME_KEY = 'rdc-ambient-volume-v1';
  const chords = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 57, 62]];
  const melody = [76, 72, 69, 74, 71, 67, 69, 74];
  const frequency = note => 440 * Math.pow(2, (note - 69) / 12);
  const clampVolume = value => Number.isFinite(Number(value)) ? Math.min(100, Math.max(0, Number(value))) : 20;

  function mount() {
    if (document.getElementById('rdc-ambient-music') || !document.body) return;
    if (/\/(?:dashboard|painel-celular|admin|login|studio)(?:[./-]|$)/i.test(location.pathname)
      || /noindex/i.test(document.querySelector('meta[name="robots"]')?.content || '')) return;
    const style = document.createElement('style');
    style.textContent = `
      #rdc-ambient-music{box-sizing:border-box;position:static;isolation:isolate;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:6px 12px;width:calc(100% - 32px);max-width:1100px;margin:10px auto;padding:10px 14px;border:1px solid #c8d9ce;border-radius:10px;background:#f4f8f4;color:#173d2d;font:14px/1.5 system-ui,sans-serif}
      #rdc-ambient-music *{box-sizing:border-box;min-width:0}
      #rdc-ambient-music strong{font-size:16px}#rdc-ambient-music p{margin:4px 0 0}
      #rdc-ambient-music button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;max-width:100%;padding:10px 12px;border:1px solid #15563d;border-radius:8px;background:#15563d;color:#fff;font:600 14px/1.4 system-ui,sans-serif;cursor:pointer;white-space:normal}
      #rdc-ambient-music button:disabled{opacity:.65;cursor:default}
      #rdc-ambient-music label{display:grid;grid-template-columns:1fr auto;align-items:center;gap:2px 8px;font-weight:600}
      #rdc-ambient-music input{grid-column:1/-1;display:block;width:100%;height:44px;margin:0;accent-color:#15563d;cursor:pointer}
      #rdc-ambient-music details{align-self:start}#rdc-ambient-music details[open]{grid-column:1/-1}
      #rdc-ambient-music summary{display:flex;align-items:center;justify-content:center;min-height:44px;width:max-content;max-width:100%;padding:8px 10px;border:1px solid #9cb9a8;border-radius:8px;background:#fff;color:#173d2d;font-weight:600;cursor:pointer;list-style:none}
      #rdc-ambient-music summary::-webkit-details-marker{display:none}#rdc-ambient-music details[open] label{max-width:320px;margin-top:8px}
      #rdc-ambient-music button:focus-visible,#rdc-ambient-music input:focus-visible,#rdc-ambient-music summary:focus-visible{outline:3px solid #1769e0;outline-offset:3px}
      #rdc-ambient-music .rdc-music-status{grid-column:1/-1;margin:0;color:#47604d;font-size:12px}
      @media(max-width:700px){#rdc-ambient-music{gap:6px 8px;padding:10px}#rdc-ambient-music strong{font-size:14px}#rdc-ambient-music .rdc-music-title-extra{display:none}#rdc-ambient-music button{padding:8px 10px}#rdc-ambient-music summary{padding:8px}#rdc-ambient-music label{width:100%}}
      @media(prefers-contrast:more){#rdc-ambient-music{border:2px solid currentColor}#rdc-ambient-music .rdc-music-status{color:inherit}}
    `;
    document.head.appendChild(style);
    const panel = document.createElement('section');
    panel.id = 'rdc-ambient-music';
    panel.setAttribute('aria-label', 'Música ambiente opcional');
    panel.innerHTML = '<strong>♫ Música<span class="rdc-music-title-extra"> ambiente</span></strong>'
      + '<button type="button" id="rdc-music-toggle" aria-pressed="false">Ativar música</button>'
      + '<details><summary>Volume</summary><label for="rdc-music-volume">Volume <output id="rdc-music-volume-value" for="rdc-music-volume">20%</output>'
      + '<input id="rdc-music-volume" type="range" min="0" max="100" step="1" value="20" aria-label="Volume da música ambiente"></label></details>'
      + '<p class="rdc-music-status" id="rdc-music-status" role="status" aria-live="polite">Desligada. Só começa ao ativar; pausa ao sair da aba ou da página.</p>';
    // Separate row in document flow: never insert into search/navigation or over offers.
    const header = document.querySelector('body > header');
    const main = document.querySelector('body > main, #app');
    if (header) header.after(panel);
    else if (main) main.before(panel);
    else document.body.prepend(panel);
    const toggle = panel.querySelector('#rdc-music-toggle');
    const slider = panel.querySelector('#rdc-music-volume');
    const valueLabel = panel.querySelector('#rdc-music-volume-value');
    const status = panel.querySelector('#rdc-music-status');
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    let volume = 20, context = null, master = null, playing = false, busy = false;
    let timer = null, nextChord = 0, chordIndex = 0, everPlayed = false, generation = 0;
    try {
      const saved = localStorage.getItem(VOLUME_KEY);
      if (saved !== null && saved !== '') volume = clampVolume(saved);
    } catch {} // Storage is optional; login and other preferences are never touched.

    function render(message) {
      toggle.textContent = playing ? 'Pausar música' : everPlayed ? 'Continuar música' : 'Ativar música';
      toggle.setAttribute('aria-pressed', String(playing));
      status.textContent = message || (playing
        ? volume === 0 ? 'Música em reprodução, com volume zerado.' : 'Música em reprodução. Pause quando quiser.'
        : 'Pausada. Para ouvir novamente, clique em Continuar música.');
    }
    function stopTimer() {
      if (timer !== null) { window.clearInterval(timer); timer = null; }
    }
    function voice(note, at, duration, amplitude, harmonic = false) {
      const osc = context.createOscillator(), envelope = context.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency(note);
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(amplitude, at + (harmonic ? .06 : 1.8));
      envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
      osc.connect(envelope);
      envelope.connect(master);
      osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
      osc.start(at);
      osc.stop(at + duration + .03);
    }
    function schedule() {
      if (!playing || !context || context.state !== 'running') return;
      // Schedule a short look-ahead only while playing; never build an unbounded loop.
      while (nextChord < context.currentTime + 2) {
        const at = Math.max(nextChord, context.currentTime + .04);
        for (const note of chords[chordIndex % chords.length]) voice(note, at, 8.6, .035);
        voice(melody[chordIndex % melody.length], at + 2.5, 3, .028, true);
        voice(melody[(chordIndex + 2) % melody.length], at + 5, 2.5, .018, true);
        chordIndex += 1;
        nextChord = at + 8;
      }
    }
    async function pause(message) {
      generation += 1;
      playing = false;
      stopTimer();
      render(message);
      try { if (context?.state === 'running') await context.suspend(); } catch {}
    }
    function release() {
      generation += 1;
      playing = false;
      stopTimer();
      const previous = context;
      context = null; master = null;
      if (previous && previous.state !== 'closed') void previous.close().catch(() => {});
      render('Pausada. A música não recomeça automaticamente.');
    }
    function updateVolume() {
      volume = clampVolume(slider.value);
      slider.value = String(volume);
      slider.setAttribute('aria-valuetext', volume + '%');
      valueLabel.textContent = volume + '%';
      if (context && master) master.gain.setTargetAtTime(volume / 100 * .3, context.currentTime, .06);
      try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch {}
      if (playing) render();
    }
    slider.value = String(volume);
    valueLabel.textContent = volume + '%';
    slider.setAttribute('aria-valuetext', volume + '%');
    slider.addEventListener('input', updateVolume);
    if (!AudioContextClass) {
      toggle.disabled = true;
      slider.disabled = true;
      status.textContent = 'Este navegador não oferece música ambiente. A navegação continua normalmente.';
      return;
    }
    toggle.addEventListener('click', async () => {
      if (busy) return;
      if (playing) { await pause(); return; }
      busy = true;
      toggle.disabled = true;
      const attempt = ++generation;
      try {
        if (!context || context.state === 'closed') {
          context = new AudioContextClass();
          master = context.createGain();
          master.gain.value = 0;
          master.connect(context.destination);
          nextChord = context.currentTime + .06; chordIndex = 0;
          context.addEventListener('statechange', () => {
            if (playing && context?.state !== 'running') {
              playing = false; stopTimer(); render('Pausada pelo navegador. Clique em Continuar música para retomar.');
            }
          });
        }
        // This is the only resume path, directly triggered by the user's button.
        await context.resume();
        if (attempt !== generation || document.hidden) {
          if (context?.state === 'running') await context.suspend();
          return;
        }
        if (context.state !== 'running') throw new Error('Audio unavailable');
        playing = true; everPlayed = true;
        master.gain.setTargetAtTime(volume / 100 * .3, context.currentTime, .15);
        schedule();
        timer = window.setInterval(schedule, 1000);
        render();
      } catch {
        release();
        status.textContent = 'Não foi possível iniciar a música. Tente ativar novamente; o restante do site funciona normalmente.';
      } finally { busy = false; toggle.disabled = false; }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void pause('Pausada ao sair da aba. Clique em Continuar música para retomar.');
    });
    document.addEventListener('play', event => {
      if (/^(?:VIDEO|AUDIO)$/.test(event.target?.tagName || '')) void pause('Pausada para não disputar áudio com o vídeo ou anúncio.');
    }, true);
    window.addEventListener('pagehide', release);
    // Deliberately no persisted "playing" state, automatic resume, network or analytics.
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})();
