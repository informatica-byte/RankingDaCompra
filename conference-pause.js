(function (root) {
  "use strict";
  const DAY = 24 * 60 * 60 * 1000;
  function millis(value) {
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (typeof value === "number") return value;
    return Date.parse(value || "");
  }
  function isPaused(product) { return product?.conferenciaPausada === true; }
  function deadline(product) {
    const started = millis(product?.conferenciaPausadaEm);
    return Number.isFinite(started) ? started + 30 * DAY : NaN;
  }
  function state(product, now = Date.now()) {
    const until = deadline(product);
    const valid = Number.isFinite(until);
    return { paused: isPaused(product), deadline: valid ? until : null,
      expired: isPaused(product) && valid && now >= until,
      remainingDays: valid ? Math.max(0, Math.ceil((until - now) / DAY)) : null };
  }
  function pausePatch(now) {
    return { conferenciaPausada: true, conferenciaPausadaEm: now };
  }
  function resumePatch(now) {
    return { conferenciaPausada: false, conferenciaReativadaEm: now };
  }
  const api = { isPaused, state, pausePatch, resumePatch };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RDCConferencePause = api;
})(typeof window !== "undefined" ? window : null);
