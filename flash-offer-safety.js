(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RDCFlashOfferSafety = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const MAX_AGE = 24 * 60 * 60 * 1000;
  function price(value) {
    const raw = String(value ?? '').replace(/R\$|\s/g, '');
    const parsed = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
    return raw && Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  function millis(value) {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (value && typeof value.toDate === 'function') return value.toDate().getTime();
    if (value && typeof value === 'object' && Number.isFinite(value.seconds)) return value.seconds * 1000;
    const parsed = value instanceof Date ? value.getTime() : Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  function recentPrice(product, status = null, now = Date.now()) {
    const replacedAt = millis(product?.anuncioSubstituidoEm);
    const manualAt = millis(product?.precoAtualizadoManualmenteEm);
    const apiAt = millis(status?.checkedAt);
    const fresh = time => Number.isFinite(time) && now - time >= 0 && now - time <= MAX_AGE
      && (!Number.isFinite(replacedAt) || time > replacedAt);
    // Bind a promotional confirmation to the value actually checked. A fresh
    // regular-price timestamp alone cannot prove a newly edited discount.
    const promotional = product?.ofertaRelampagoAtiva === true
      && millis(product?.ofertaRelampagoTerminaEm) > now
      && price(product?.precoAnterior) > price(product?.precoPromocional)
      && price(product?.precoPromocional) > 0;
    const boundPrice = price(product?.precoConferenciaValor);
    const manualPrice = boundPrice > 0 && (!promotional || product?.precoConferenciaCampo === 'precoPromocional')
      ? boundPrice : price(product?.preco ?? product?.price);
    const apiPrice = price(status?.price);
    const manual = product?.precoAtualizadoManualmente === true && fresh(manualAt) && manualPrice > 0;
    const api = status?.managed === true && status?.status === 'active' && status?.available === true
      && fresh(apiAt) && apiPrice > 0;
    if (manual && (!api || manualAt >= apiAt)) return { confirmed: true, price: manualPrice, checkedAt: manualAt, source: 'manual' };
    if (api) return { confirmed: true, price: apiPrice, checkedAt: apiAt, source: 'api' };
    return { confirmed: false, price: 0, checkedAt: null, source: null };
  }
  function evaluate(product, status = null, now = Date.now()) {
    const confirmation = recentPrice(product, status, now);
    const apiOffer = confirmation.source === 'api' && status?.lightningActive === true;
    const configured = apiOffer || product?.ofertaRelampagoAtiva === true;
    const endsAt = millis(apiOffer ? status.lightningEndsAt : product?.ofertaRelampagoTerminaEm);
    const startValue = apiOffer ? status.lightningStartsAt : product?.ofertaRelampagoComecaEm;
    const startsAt = startValue ? millis(startValue) : null;
    const current = price(apiOffer ? status.lightningPrice ?? status.price : product?.precoPromocional);
    const regular = price(apiOffer ? status.regularPrice : product?.precoAnterior);
    let reason = '';
    if (!configured) reason = 'not-configured';
    else if (!Number.isFinite(endsAt) || endsAt <= now) reason = 'expired-or-missing-deadline';
    else if (startValue && (!Number.isFinite(startsAt) || startsAt > now)) reason = 'not-started';
    else if (!(regular > current && current > 0) || Math.round((1 - current / regular) * 100) < 1) reason = 'invalid-discount';
    else if (!confirmation.confirmed) reason = 'awaiting-confirmation';
    else if (Math.abs(confirmation.price - current) > 0.011) reason = 'price-mismatch';
    return {
      eligible: reason === '', reason, configured,
      price: current, regularPrice: regular,
      discount: regular > current && current > 0 ? Math.round((1 - current / regular) * 100) : 0,
      endsAt: Number.isFinite(endsAt) ? new Date(endsAt).toISOString() : null,
      checkedAt: confirmation.checkedAt, source: confirmation.source,
    };
  }
  return { evaluate, recentPrice, price, millis };
});
