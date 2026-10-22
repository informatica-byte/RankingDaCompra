// Editorial review of the existing exported records, 22/10/2026.
// These codes identify offers, not different models, colours or tested features.
const novante = /^(?=.*\bnovante\b)(?=.*\balexa\b)(?=.*\bchamadas\b)(?=.*\bbluetooth\b)/i;
const shoe = (id, item) => [id, {
  model: /^(?=.*\bfeminino\b)(?!.*\b(?:masculino|infantil)\b).*(?:flyer\s+runner\s+mesh.*puma|puma.*flyer\s+runner\s+mesh)/i,
  expectedListing: item,
  correct: 'Tênis Puma Flyer Runner Mesh feminino — anúncio ' + item,
  summary: 'Este cadastro identifica o Tênis Puma Flyer Runner Mesh feminino, anúncio ' + item + '. Há outra oferta do mesmo nome no site; o código diferencia os anúncios, não comprova um modelo ou uma cor diferente. Confira a numeração e a tabela de medidas na oferta. Não testamos conforto, amortecimento, aderência ou durabilidade e não atribuímos tecnologias de outra versão a este cadastro.',
  positiveNotes: ['Marca e nome do produto identificados no cadastro, com o código do anúncio para distinguir a oferta.'],
  negativeNotes: ['Numeração, medidas, materiais e condições de troca precisam ser conferidos na oferta.', 'Conforto, aderência e durabilidade não foram testados pela equipe.'],
  sourceKind: 'existing-record', suppressRating: true,
}];
const watch = (id, item) => [id, {
  model: novante, expectedListing: item,
  correct: 'Smartwatch NOVANTE Alexa e chamadas Bluetooth — anúncio ' + item,
  summary: 'O cadastro anuncia um smartwatch NOVANTE com Alexa e chamadas, anúncio ' + item + '. O código distingue esta oferta de outra com o mesmo nome; não confirma um modelo diferente. Compatibilidade, recursos e condições de uso devem ser conferidos no anúncio. Não verificamos precisão dos sensores, ECG, autonomia nem adequação à natação. A menção a IP68 no cadastro não comprova essas condições de uso.',
  positiveNotes: ['Alexa e chamadas anunciadas no cadastro, sem teste independente da equipe.'],
  negativeNotes: ['Modelo alfanumérico e compatibilidade precisam ser confirmados na oferta.', 'Não apresentamos ECG, sensores, autonomia ou uso na água como resultados testados ou garantidos.'],
  sourceKind: 'existing-record', suppressRating: true,
}];
export const EXISTING_OFFER_REVIEWS = new Map([
  shoe('rMsMd9YWawi1darKVapn', 'MLB6254967576'),
  shoe('TaSttysuiLO2i5Rrb9hV', 'MLB4091855423'),
  watch('UkgpEmnU2nSDUmOujW6W', 'MLB6162191874'),
  watch('Znhr4d5uhDKsj5poLEmZ', 'MLB4460735385'),
]);

export function matchesExistingOffer(product, expected) {
  if (!product?.link) return true; // Public projections omit the source URL.
  try {
    const u = new URL(product.link), hash = new URLSearchParams(u.hash.slice(1));
    if (u.protocol !== 'https:' || u.username || u.password || !['www.mercadolivre.com.br', 'produto.mercadolivre.com.br'].includes(u.hostname)) return false;
    const item = u.searchParams.get('pdp_filters')?.match(/item_id[:=](MLB\d+)/)?.[1]
      || u.searchParams.get('wid') || hash.get('wid') || u.pathname.match(/\/MLB-(\d+)(?:-|\/|$)/)?.[1]?.replace(/^(\d)/, 'MLB$1');
    return item === expected;
  } catch (_) { return false; }
}
