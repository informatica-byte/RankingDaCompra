(() => {
  'use strict';
  if (window.RDCAppCheckSafety) return;
  function isFailure(error) {
    const seen = new Set();
    for (let current = error, depth = 0; current && depth < 4 && !seen.has(current); depth++) {
      seen.add(current);
      let code = '', message = '';
      try { if (typeof current.code === 'string') code = current.code; } catch (_) {}
      if (/^appCheck\//i.test(code)) return true;
      try { message = typeof current === 'string' ? current : typeof current.message === 'string' ? current.message : ''; } catch (_) {}
      if (/\bapp[\s_-]?check\b/i.test(code + ' ' + message)) return true;
      try { current = current.cause; } catch (_) { return false; }
    }
    return false;
  }
  window.RDCAppCheckSafety = Object.freeze({
    isFailure,
    guidance: 'A validação App Check não foi concluída. A operação foi interrompida e os campos foram preservados. Aguarde o prazo do SDK e consulte o diagnóstico local; não repita a ação nem recarregue esta aba enquanto a falha persistir.'
  });
})();
