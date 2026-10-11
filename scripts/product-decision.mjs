import { featureState, featureEvidence, evidenceClauses, isAdviceClause } from './discovery-editorial.mjs';
import { manufacturerEvidence } from './product-title-corrections.mjs';
const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const profiles = [
  { match: /roteador/i, audience: 'quem precisa distribuir a conexão de internet entre os aparelhos da casa', criteria: [ ['Wi-Fi 6', /wi[ -]?fi\s*6|802\.11ax|\bax\d{3,4}\b/i, 'É uma geração de rede sem fio; o ganho depende também dos aparelhos e do ambiente.'], ['Portas Gigabit', /gigabit|1000\s*mbps/i, 'Vale conferir as portas de entrada e de saída para não limitar uma conexão cabeada rápida.'], ['Rede Mesh', /\bmesh\b/i, 'Confirme quais unidades são compatíveis e se o preço inclui mais de uma unidade.'] ], missing: 'alcance real no seu imóvel, número de aparelhos simultâneos e quantidade/velocidade das portas' },
  { match: /fone|headphone|headset/i, audience: 'quem procura áudio para música, chamadas ou jogos e precisa escolher o formato adequado', criteria: [ ['Bluetooth', /bluetooth/i, 'Confira compatibilidade, estabilidade e latência; a versão anunciada não comprova a qualidade do áudio.'], ['Cancelamento ativo de ruído', /\banc\b|cancelamento ativo/i, 'Isolamento passivo e redução de ruído no microfone não são ANC para ouvir.'], ['Microfone', /microfone/i, 'Para chamadas, procure amostras de voz e confirme funcionamento no aparelho que você usa.'] ], missing: 'conforto após longos períodos, latência, qualidade de voz e autonomia medida em uso real' },
  { match: /smartwatch|rel[oó]gio.*smart/i, audience: 'quem deseja notificações e acompanhar atividades pelo relógio, conforme os recursos informados', criteria: [ ['GPS integrado', /gps integrado|gps embutido|gps independente/i, 'Confirme se registra o trajeto sem levar o celular; GPS conectado depende do telefone.'], ['Chamadas Bluetooth', /chamadas? bluetooth|liga[cç][oõ]es bluetooth/i, 'Normalmente exige o celular conectado; não equivale a um relógio com linha móvel própria.'], ['Proteção IP', /\bip\d{2}\b/i, 'Confira o grau e as condições de uso; a sigla não garante que seja adequado para natação.'] ], missing: 'autonomia com os recursos ligados, compatibilidade com o celular e precisão dos sensores' },
  { match: /power bank|carregador port[aá]til/i, audience: 'quem precisa de energia extra fora de casa', criteria: [ ['USB-C', /usb[ -]?c|tipo[ -]?c/i, 'Confirme se a porta serve para entrada, saída ou ambas.'], ['Carga rápida', /\d+(?:[.,]\d+)?\s*w\b|carga r[aá]pida|turbo/i, 'A potência máxima depende do protocolo, do cabo e do aparelho conectado.'] ], missing: 'capacidade útil de saída, peso, protocolos de carga e carregamento simultâneo' },
  { match: /politriz/i, audience: 'quem precisa fazer polimento com ferramenta adequada à superfície e à sua experiência', criteria: [ ['Roto-orbital', /roto[ -]?orbital/i, 'O tipo de movimento muda a técnica de trabalho; confirme órbita, boinas e orientação de uso.'], ['Potência informada', /\d+\s*w\b/i, 'Watts informados não comprovam acabamento nem desempenho sob carga.'] ], missing: 'peso em uso, faixa de velocidade, acessórios incluídos e assistência técnica' },
];

const UNKNOWN = 'Não informado / a confirmar';
const AUTONOMY = /(?:bateria|autonomia|reprodu[cç][aã]o)[^;.!?]{0,45}?((?:at[eé]\s*)?\d+(?:[.,]\d+)?\s*(?:horas?\b|h\b))|((?:at[eé]\s*)?\d+(?:[.,]\d+)?\s*(?:horas?\b|h\b))\s*(?:de\s*)?(?:bateria|autonomia|reprodu[cç][aã]o)/i;

function provenance(product, evidence) {
  const source = manufacturerEvidence(product);
  // The model-guarded editorial correction supplies the manufacturer source.
  // A keyword in a title alone is never attributed to that source.
  return source && evidence.some(item => ['comentario', 'pros', 'contras'].includes(item.field))
    ? {basis: 'fabricante', sourceUrl: source.sourceUrl} : {basis: 'cadastro'};
}

function booleanFeature(product, label, pattern) {
  const result = featureEvidence(product, pattern);
  return {label, value: result.state === 'yes' ? 'Informado' : result.state === 'no' ? 'Não possui, segundo a ficha' : UNKNOWN,
    state: result.state, ...provenance(product, result.evidence)};
}

function specification(product, label, pattern, format, accept = () => true) {
  const result = featureEvidence(product, pattern);
  if (result.state !== 'yes') return {label, value: result.state === 'no' ? 'Ausência informada' : UNKNOWN, state: result.state, basis: 'cadastro'};
  const values = new Map();
  const evidence = [];
  for (const item of result.evidence.filter(accept)) {
    for (const match of item.text.matchAll(new RegExp(pattern.source, 'gi'))) {
      const value = format(match, item.text);
      if (value) {values.set(value, value); evidence.push(item);}
    }
  }
  // Two differing values are not resolved by choosing the larger number or by
  // prioritising a sales title. Keep the conflict visible as unknown.
  if (values.size !== 1) return {label, value: UNKNOWN, state: 'unknown', basis: 'cadastro'};
  return {label, value: [...values.values()][0], state: 'yes', ...provenance(product, evidence)};
}

const numberText = value => String(value).replace(',', '.').replace(/\.0+$/, '').replace('.', ',');
const accessoryTitle = title => /^(?:kit\s+(?:de\s+)?)?(?:capa|bolsa|mochila|case|estojo|suporte|almofada|espuma|adaptador|fonte|carregador|bateria para)\b/i.test(String(title || '').replace(/^[^\p{L}\p{N}]+/u, '').trim());
const PROCESSOR = /\b(?:Intel\s+)?Core\s+i[3579](?:[ -]\d{4,5}[A-Z]{0,3})?\b|\b(?:AMD\s+)?Ryzen\s+[3579](?:\s+\d{4}[A-Z]{0,3})?\b|\b(?:Intel\s+)?Celeron\s+[A-Z]?\d{3,5}\b/i;

function processorFeature(product) {
  const result = featureEvidence(product, PROCESSOR);
  const unknown = () => ({label: 'Processador', value: UNKNOWN, state: 'unknown', basis: 'cadastro'});
  if (result.state !== 'yes') return unknown();
  const families = new Set(), models = new Set(), brands = new Set(), evidence = [...result.evidence];
  const addProcessor = value => {
    const family = value.match(/Core\s+i([3579])|Ryzen\s+([3579])|Celeron/i);
    if (!family) return;
    const familyName = family[1] ? `Core i${family[1]}` : family[2] ? `Ryzen ${family[2]}` : 'Celeron';
    families.add(familyName);
    const model = value.slice(family.index + family[0].length).match(/^\s*[- ]?\s*(\d{4,5}[A-Z]{0,3}|[A-Z]\d{3,5})\b/i)?.[1];
    if (model) models.add(model.toUpperCase());
    const brand = value.match(/\b(?:Intel|AMD)\b/i)?.[0];
    if (brand) brands.add(brand.toLowerCase() === 'amd' ? 'AMD' : 'Intel');
  };
  for (const item of result.evidence) {
    for (const match of item.text.matchAll(new RegExp(PROCESSOR.source, 'gi'))) addProcessor(match[0]);
  }
  // Join only labelled fields of this product, not arbitrary numbers in a
  // sales summary (Go 15, 16 GB and 512 are not processor model numbers).
  let invalidField = false;
  for (const item of evidenceClauses(product).filter(item => !isAdviceClause(item.text))) {
    const field = item.text.match(/^(Modelo|Linha|Marca) (?:do|de) processador\s*:\s*(.*?)\s*$/i);
    if (!field) continue;
    const label = field[1].toLowerCase(), value = field[2];
    if (/a confirmar|n[aã]o inform|incert|n[aã]o confirm/i.test(value)) { invalidField = true; continue; }
    if (label === 'modelo') {
      const model = value.match(/^(\d{4,5}[A-Z]{0,3}|[A-Z]\d{3,5})$/i)?.[1];
      if (model) models.add(model.toUpperCase());
      else if (new RegExp(PROCESSOR.source, 'i').test(value)) addProcessor(value);
      else invalidField = true;
    } else if (label === 'linha') {
      if (/^(?:Core\s+i[3579]|Ryzen\s+[3579]|Celeron)$/i.test(value)) addProcessor(value);
      else invalidField = true;
    } else if (/^(?:Intel|AMD)$/i.test(value)) brands.add(value.toLowerCase() === 'amd' ? 'AMD' : 'Intel');
    else invalidField = true;
    evidence.push(item);
  }
  // A generic "Ryzen 5" and a model "Ryzen 5 7520U" are compatible
  // refinements, but differing lines/models/vendors stay unknown.
  if (invalidField || families.size !== 1 || models.size > 1 || brands.size > 1) return unknown();
  const family = [...families][0], model = [...models][0], brand = [...brands][0];
  const value = `${brand ? brand + ' ' : ''}${family}${model ? (family.startsWith('Core') ? '-' : ' ') + model : ''}`;
  return {label: 'Processador', value, state: 'yes', ...provenance(product, evidence)};
}

export function comparisonFamily(product) {
  const title = String(product?.titulo || '');
  if (accessoryTitle(title)) return null;
  if (/roteador/i.test(title) && !/repetidor|access\s*point|starlink/i.test(title)) return 'roteador';
  if (/headset/i.test(title)) return 'headset';
  if (/fone|headphone/i.test(title)) {
    const headphone = featureState(product, /\bon[ -]?ear\b|\bover[ -]?ear\b|supra[ -]?auricular|circum[ -]?auricular/i) === 'yes';
    const intra = featureState(product, /\bin[ -]?ear\b|intra[ -]?auricular|\bear\s*clip\b/i) === 'yes';
    if ((headphone || /headphone/i.test(title)) && intra) return 'fone';
    if (headphone || /headphone/i.test(title)) return 'headphone';
    if (featureState(product, /\btws\b|true wireless/i) === 'yes') return 'fone-tws';
    if (/\bcom fio\b|\bp2\b|3[.,]5\s*mm/i.test(title) && !/bluetooth|sem fio/i.test(title)) return 'fone-com-fio';
    return 'fone'; // Unknown form factor does not establish equivalence with TWS/headphones.
  }
  if (/^(?:notebook|laptop)\b/i.test(title.replace(/^[^\p{L}\p{N}]+/u, '').trim()) && !/capa|bolsa|mochila|suporte|carregador|bateria para|para notebook/i.test(title)) return 'notebook';
  return null;
}

export function comparisonData(product) {
  const family = comparisonFamily(product);
  if (!family) return null;
  let features;
  if (family === 'roteador') {
    features = [
      booleanFeature(product, 'Wi-Fi 6', /wi[ -]?fi\s*6|802\.11ax|\bax\d{3,4}\b/i),
      booleanFeature(product, 'Banda de 5 GHz', /dual[ -]?band|duas bandas|5\s*ghz/i),
      booleanFeature(product, 'Portas Gigabit', /gigabit|1000\s*mbps|1\s*gbps/i),
      specification(product, 'Quantidade de portas', /(\d+)\s*portas?\s*(?:de\s*)?(?:ethernet|gigabit|LAN|WAN|10\/100)/i, match => `${match[1]} portas anunciadas`),
      booleanFeature(product, 'Rede Mesh', /\bmesh\b|easymesh/i),
    ];
  } else if (family === 'notebook') {
    features = [
      specification(product, 'Memória RAM', /(\d+)\s*gb\s*(?:de\s*)?(?:ram|ddr\d)|(?:ram|mem[oó]ria ram)\s*(?:de\s*)?[:—-]?\s*(\d+)\s*gb/i, match => `${match[1] || match[2]} GB`),
      specification(product, 'Armazenamento SSD', /(?:ssd\s*(?:de\s*)?[:—-]?\s*(\d+)\s*(gb|tb))|(?:(\d+)\s*(gb|tb)\s*(?:de\s*)?ssd)/i, match => `${match[1] || match[3]} ${(match[2] || match[4]).toUpperCase()}`),
      processorFeature(product),
    ];
  } else {
    const autonomy = label => specification(product, label, AUTONOMY, match => {
      const duration = (match[1] || match[2]).match(/(\d+(?:[.,]\d+)?)\s*(?:horas?|h)/i)?.[1];
      return duration ? `${/at[eé]\s*\d/i.test(match[1] || match[2]) ? 'Até ' : ''}${numberText(duration)} h anunciadas` : null;
    }, item => label === 'Autonomia com estojo' ? /estojo/i.test(item.text) : !/estojo|recarga|carregamento|recarregar/i.test(item.text));
    features = [
      specification(product, 'Formato', /\bon[ -]?ear\b|\bover[ -]?ear\b|\bin[ -]?ear\b|intra[ -]?auricular|supra[ -]?auricular|circum[ -]?auricular|\bear\s*clip\b/i, match => {
        const format = match[0].toLowerCase().replace(/[ -]/g, '');
        return /onear|supraauricular/.test(format) ? 'On-ear (sobre as orelhas)' : /overear|circumauricular/.test(format) ? 'Over-ear (ao redor das orelhas)' : /earclip/.test(format) ? 'Ear clip' : 'Intra-auricular';
      }),
      specification(product, 'Versão Bluetooth', /bluetooth\s*(?:vers[aã]o\s*)?(\d(?:[.,]\d{1,2})?)/i, match => `Bluetooth ${match[1].replace(',', '.')}`),
      booleanFeature(product, 'Cancelamento ativo de ruído', /\banc\b|cancelamento (?:ativo|de ru[ií]do ativo)/i),
      booleanFeature(product, 'Microfone', /microfone/i),
      autonomy('Autonomia no fone'),
      ...(family === 'fone-tws' ? [autonomy('Autonomia com estojo')] : []),
    ];
  }
  return {family, features};
}

export function decisionData(product) {
  if (accessoryTitle(product?.titulo)) return null;
  const profile = profiles.find(item => item.match.test(product.titulo || ''));
  if (!profile) return null; // Avoid adding generic template text to unrelated products.
  const comparison = comparisonData(product);
  const comparisonByLabel = new Map((comparison?.features || []).map(item => [item.label, item]));
  const criteria = profile.criteria.map(([label, pattern, explanation]) => ({ label, state: featureState(product, pattern), explanation, ...comparisonByLabel.get(label) }));
  for (const item of comparison?.features || []) {
    if (!criteria.some(criterion => criterion.label === item.label)) criteria.push({...item, explanation: item.label.startsWith('Autonomia') ? 'Duração anunciada, não medida pela equipe; o resultado depende do volume, dos recursos ligados e do uso.' : 'Informação cadastrada para o modelo; confirme a variante oferecida pelo vendedor.'});
  }
  const positive = criteria.filter(item => item.state === 'yes').map(item => item.label);
  return { audience: profile.audience, criteria, comparison, distinction: positive.length ? 'Recursos identificados na ficha: ' + positive.join(', ') + '. Compare esses mesmos critérios em alternativas do mesmo tipo.' : 'A ficha não confirma recursos suficientes para justificar um diferencial frente a concorrentes.', limitation: 'Não comprovamos em teste próprio: ' + profile.missing + '.' };
}
export function renderProductDecision(product) {
  const data = decisionData(product);
  if (!data) return '';
  const compareQuery = new URLSearchParams();
  if (data.comparison) compareQuery.set('family', data.comparison.family);
  if (/^[A-Za-z0-9_-]{1,100}$/.test(String(product?.id || ''))) compareQuery.set('produto', product.id);
  const compareUrl = '/comparar.html' + (compareQuery.size ? '?' + compareQuery.toString() : '');
  return `<section class="panel" data-product-decision style="margin-top:24px"><h2>Este produto faz sentido para você?</h2><p><b>Para quem considerar:</b> ${escape(data.audience)}.</p><p><b>Informações para comparar:</b> ${escape(data.distinction)}</p><ul>${data.criteria.map(item => `<li><b>${escape(item.label)} — ${item.value ? escape(item.value) : item.state === 'yes' ? 'informado na ficha' : item.state === 'no' ? 'não possui, segundo a ficha' : 'não confirmado'}:</b> ${escape(item.explanation)}${item.state !== 'unknown' ? `<span class="fine"> Fonte: ${item.basis === 'fabricante' ? `especificação anunciada pelo fabricante${item.sourceUrl ? ` (<a href="${escape(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">consultar fonte</a>)` : ''}` : 'cadastro do produto'}.</span>` : ''}</li>`).join('')}</ul><p><b>Limitação da análise:</b> ${escape(data.limitation)}</p><p class="fine">Leitura das informações cadastradas, não teste prático. Recursos não informados não são tratados como presentes. <a href="${escape(compareUrl)}">Comparar alternativas do mesmo tipo</a></p></section>`;
}
