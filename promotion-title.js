(function () {
  'use strict';
  const DEFAULT = 'Ofertas do dia: compare preços e produtos';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function money(value) {
    const raw = String(value ?? '').replace(/R\$|\s/g, '');
    const number = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
    return raw && Number.isFinite(number) && number > 0 ? number : 0;
  }
  const groups = [
    [/\b(calcados?|tenis|sapatos?|botas?|sandalias?|chinelos?|sapatilhas?)\b/, /\b(calcados?|tenis|sapatos?|botas?|sandalias?|chinelos?|sapatilhas?)\b/],
    [/\b(fones?|headphones?|headsets?|earbuds?|tws)\b/, /\b(fones?|headphones?|headsets?|earbuds?|tws)\b/],
    [/\b(celulares?|smartphones?|iphones?)\b/, /\b(celulares?|smartphones?|iphones?|galaxy|redmi|motorola)\b/],
    [/\b(notebooks?|laptops?|chromebooks?)\b/, /\b(notebooks?|laptops?|chromebooks?)\b/],
    [/\b(roteadores?|routers?)\b/, /\b(roteadores?|routers?)\b/],
    [/\b(smartwatches|smartwatch|smartbands?|pulseiras inteligentes)\b/, /\b(smartwatches|smartwatch|smartbands?|pulseiras inteligentes)\b/],
    [/\b(air fryers?|fritadeiras?)\b/, /\b(air fryers?|fritadeiras?)\b/],
    [/\b(patinetes?)\b/, /\b(patinetes?)\b/],
    [/\b(bicicletas?|bikes?)\b/, /\b(bicicletas?|bikes?)\b/],
    [/\b(perfumes?|colonias?)\b/, /\b(perfumes?|colonias?)\b/],
  ];
  function check(value, offers = []) {
    const title = String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
    if (title.length < 20 || title.length > 75 || !/(oferta|promo[cç][aã]o|promo[cç][oõ]es|achado|pre[cç]o|desconto)/i.test(title)) {
      return { valid: false, title: DEFAULT, reason: 'Use um título entre 20 e 75 caracteres relacionado às ofertas.' };
    }
    if (!offers.length) return { valid: true, title, reason: '' };
    const text = normalize(title), claimed = groups.filter(([pattern]) => pattern.test(text));
    if (claimed.length && offers.some(p => !claimed.some(([,pattern]) => pattern.test(normalize(p.titulo || p.title))))) {
      return { valid: false, title: DEFAULT, reason: 'A categoria do título não corresponde a todos os produtos desta seleção.' };
    }
    if (/\b(fones?|headphones?|headsets?|earbuds?|tws)\b/.test(text) && claimed.length === 1 && /bluetooth/.test(text)
      && offers.some(p => !/bluetooth|\bbt\d|\btws\b/.test(normalize(p.titulo || p.title)))) {
      return { valid: false, title: DEFAULT, reason: 'Bluetooth não está confirmado no título de todos os fones desta seleção.' };
    }
    const limit = title.match(/\bat[eé]\s*(?:R\$\s*)?(\d[\d.,]*)(?!\w)/i);
    if (limit && !/^\s*(horas?|dias?|meses|anos|gb|mb|metros|m²|dispositivos)/i.test(title.slice(limit.index + limit[0].length))) {
      const ceiling = money(limit[1]);
      if (ceiling && offers.some(p => !(money(p.preco ?? p.price) > 0) || money(p.preco ?? p.price) > ceiling)) {
        return { valid: false, title: DEFAULT, reason: 'Há produto sem preço conhecido ou acima do valor máximo anunciado no título.' };
      }
    }
    return { valid: true, title, reason: '' };
  }
  const api = { check, resolve: (value, offers) => check(value, offers).title, money, DEFAULT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.RDCPromotionTitle = api;
})();
