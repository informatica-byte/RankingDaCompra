// Evidências anunciadas, não resultados de teste. Nunca infere um recurso negado.
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = (product) => [product.titulo, product.comentario, product.pros, product.contras, product.dadosTecnicos].filter(Boolean).join('; ');
const clauses = (product) => text(product).split(/[;!?\n]|(?<!\d)\.(?!\d)|\bmas\b|\bpor[eé]m\b/i);
export const EDITORIAL_REVIEWED_AT = '2026-10-01';

export function featureState(product, pattern) {
  let positive = false, absent = false, unknown = false;
  for (const clause of clauses(product)) {
    const match = new RegExp(pattern.source, 'i').exec(clause);
    if (!match) continue;
    // “sem fio com microfone” não nega o microfone ou outro recurso seguinte.
    const before = clause.slice(Math.max(0, match.index - 65), match.index).replace(/\bsem fio\b/gi, 'wireless');
    const after = clause.slice(match.index + match[0].length, match.index + match[0].length + 45);
    if (/n[aã]o (?:informa|confirm|especific|menciona)|sem (?:confirma[cç][aã]o|informa[cç][aã]o)|a confirmar|verifi(?:que|car)|confir(?:me|mar)|incert|n[aã]o [ée] confirm/i.test(before + after)
        || /n[aã]o (?:foi|foram) (?:confirmad|informad)/i.test(after)) unknown = true;
    else if (/(?:\bsem|\bn[aã]o(?: possui| tem| suporta| conta com| inclui| oferece)?|aus[eê]ncia de|carece de|falta de)(?:\s+[\wÀ-ÿ-]+){0,4}\s*$/i.test(before)
        || /^\s*(?:[:—-]\s*)?(?:ausente|indispon[ií]vel|inexistente|n[aã]o\s+(?:possui|tem|suporta|inclui|oferece|dispon[ií]vel|presente)|n[aã]o\s*[.;]?$)/i.test(after)) absent = true;
    else positive = true;
  }
  // Contradições e dúvidas do cadastro não viram bônus no ranking.
  if (unknown || (absent && positive)) return 'unknown';
  return absent ? 'no' : positive ? 'yes' : 'unknown';
}

export const ROUTER_FEATURES = [
  ['Wi-Fi 6', /wi.?fi\s*6|802\.11ax|\bax\d{3,4}\b/],
  ['banda de 5 GHz', /dual.?band|duas bandas|5\s*ghz/],
  ['portas Gigabit', /gigabit|1000\s*mbps|1\s*gbps/],
  ['rede Mesh', /\bmesh\b|easymesh/],
  ['classe AX1800 ou superior', /\bax(?:1[89]\d\d|[2-9]\d{3})\b/],
];

export function routerCapabilities(product) {
  return ROUTER_FEATURES.filter(([, pattern]) => featureState(product, pattern) === 'yes').map(([label]) => label);
}

const PROFILES = {
  router: {
    match: /roteador/i,
    columns: [['Wi-Fi 6', ROUTER_FEATURES[0][1]], ['5 GHz', ROUTER_FEATURES[1][1]], ['Gigabit', ROUTER_FEATURES[2][1]], ['Mesh', ROUTER_FEATURES[3][1]]],
    questions: [
      ['Qual roteador escolher para um apartamento?', 'Confira primeiro a posição do modem, paredes e cômodos que precisam de sinal. Não prometemos cobertura em m² nem número de aparelhos sem documentação ou teste. Wi-Fi 6 e Mesh são recursos diferentes; a presença de um não confirma o outro.'],
      ['Um roteador barato acompanha meu plano de internet?', 'Compare a velocidade das portas WAN e LAN com a do plano contratado. Não confunda a soma das velocidades Wi-Fi anunciadas com o desempenho medido em um aparelho. Se Gigabit não estiver confirmado, consulte a ficha antes de escolher para um plano mais rápido.'],
      ['Para quem NÃO é indicado?', 'Um roteador sem cobertura documentada não é uma escolha segura para quem precisa de sinal garantido em todos os cômodos. Repetidores, access points e terminais de internet via satélite não disputam este ranking de roteadores.'],
    ],
  },
  headphones: {
    match: /fone/i,
    columns: [['Bluetooth', /bluetooth|\bwireless\b|\bsem fio\b/], ['ANC anunciado', /\banc\b|cancelamento (?:ativo|de ru[ií]do ativo)/], ['Microfone', /microfone/], ['Resistência anunciada', /\bip[x\d]\d\b/]],
    questions: [
      ['Qual fone faz sentido para chamadas, música ou caminhada?', 'Para chamadas, confira microfone e compatibilidade com seu aparelho. Para caminhada, compare encaixe, peso e resistência anunciada. Para música por várias horas, procure autonomia do fone separado do total com estojo. Esses dados precisam estar na ficha do modelo; não inferimos conforto por uma foto.'],
      ['Cancelamento de ruído é sempre a mesma coisa?', 'ANC para ouvir e redução de ruído do microfone para chamadas não são equivalentes. Um anúncio com apenas ENC não confirma ANC. A tabela mostra somente o que está explicitamente cadastrado, sem transformar ausência de informação em vantagem.'],
      ['Para quem NÃO é indicado?', 'Se você depende de resistência à água, baixa latência para jogos ou cancelamento ativo, não escolha só pelo preço quando essa especificação estiver a confirmar. A qualidade do microfone e o conforto não foram medidos pela equipe.'],
    ],
  },
  watches: {
    match: /smartwatch|relogio-smart/i,
    columns: [['GPS próprio', /gps (?:integrado|embutido|pr[oó]prio)|\bgnss\b/], ['Notificações', /notifica[cç][oõ]es/], ['Bluetooth', /bluetooth/], ['Resistência anunciada', /\bip[x\d]\d\b|\b[1-9]\s*atm\b/]],
    questions: [
      ['Qual smartwatch escolher para caminhada?', 'Se quer registrar o trajeto sem levar o celular, confirme GPS próprio; GPS conectado depende do telefone. Compare compatibilidade com Android/iPhone, autonomia anunciada e o tamanho da pulseira. Contar passos não comprova precisão de distância ou frequência cardíaca.'],
      ['Ele substitui um equipamento médico?', 'Não apresentamos estimativas de sensores como diagnóstico nem garantimos precisão clínica. Para saúde, siga orientação profissional e confirme as limitações do fabricante. Resistência anunciada também não autoriza automaticamente qualquer atividade na água.'],
      ['Para quem NÃO é indicado?', 'Quem precisa de GPS independente ou compatibilidade específica deve descartar modelos sem essa confirmação. Relógios digitais comuns não são alternativas equivalentes a smartwatches e ficam fora desta comparação.'],
    ],
  },
};

export function practicalProfile(category) {
  return Object.values(PROFILES).find((profile) => profile.match.test(category));
}

export function renderPracticalSection(category, products, productUrls) {
  const profile = practicalProfile(category);
  if (!profile) return '';
  const stateLabel = {yes: 'Anunciado', no: 'Ausência informada', unknown: 'A confirmar'};
  const rows = products.map((product) => `<tr><th scope="row"><a href="${escape(productUrls.get(product.id))}">${escape(product.titulo)}</a></th>${profile.columns.map(([, pattern]) => `<td>${stateLabel[featureState(product, pattern)]}</td>`).join('')}</tr>`).join('');
  return `<section class="method practical-guide" data-practical-guide><h2>Escolha pelo seu uso, não só pelo preço</h2><p>Recursos anunciados no cadastro. “A confirmar” significa informação ausente, incerta ou conflitante, não uma reprovação do produto. Não realizamos teste prático.</p><details><summary>Comparar os recursos anunciados</summary><div class="table-wrap"><table><caption>O que conseguimos comparar neste cadastro</caption><thead><tr><th>Produto e análise</th>${profile.columns.map(([label]) => `<th>${escape(label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></details>${profile.questions.map(([question, answer]) => `<details><summary>${escape(question)}</summary><p>${escape(answer)}</p></details>`).join('')}</section>`;
}

export const FOCUSED_GUIDES = [
  {file: 'melhores-fones-bluetooth-ate-100.html', category: /fone/i, title: 'Fones Bluetooth até R$ 100: opções e cuidados antes de comprar', intro: 'Um orçamento de R$ 100 não dispensa conferir encaixe, microfone e autonomia. Aqui entram apenas fones sem fio com preço informado dentro desse teto; o frete pode alterar o total.', budget: 100},
  {file: 'melhores-roteadores-wifi-6-apartamento.html', category: /roteador/i, title: 'Roteadores Wi-Fi 6 para apartamento: como escolher', intro: 'Compare roteadores com Wi-Fi 6 anunciado e veja o que falta confirmar para seu apartamento. Não prometemos alcance através de paredes ou cobertura total sem medição.', wifi6: true},
  {file: 'melhores-smartwatches-caminhada.html', category: /smartwatch|relogio-smart/i, title: 'Smartwatch para caminhada: compare GPS e recursos anunciados', intro: 'Veja smartwatches cadastrados e confirme se o GPS funciona sem celular, a compatibilidade e a autonomia. Esta seleção não afirma teste de precisão dos sensores nem adequação médica.'},
];

export function focusedProducts(config, products, price) {
  return products.filter((product) => (!config.budget || (price(product) > 0 && price(product) <= config.budget))
    && (!config.wifi6 || featureState(product, ROUTER_FEATURES[0][1]) === 'yes'));
}

export function renderFocusedGuide(config, products, productUrls, parentFile, date, site, price, money) {
  const ranked = [...products].sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), 'pt-BR'));
  const rows = ranked.map((product) => `<tr><th scope="row"><a href="${escape(productUrls.get(product.id))}">${escape(product.titulo)}</a></th><td>${price(product) ? escape(money(price(product))) : 'Preço a confirmar'}</td><td><a href="${escape(productUrls.get(product.id))}">Ver análise e oferta</a></td></tr>`).join('');
  const canonical = site + config.file;
  const schema = JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:config.title,url:canonical,dateModified:date,author:{'@type':'Organization',name:'Equipe Ranking da Compra',url:site+'sobre.html'},mainEntity:{'@type':'ItemList',itemListElement:ranked.map((p,i)=>({'@type':'ListItem',position:i+1,name:p.titulo,url:productUrls.get(p.id)}))}}).replace(/</g,'\\u003c');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow,max-image-preview:large"><title>${escape(config.title)} | Ranking da Compra</title><meta name="description" content="${escape(config.intro)}"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${escape(config.title)}"><meta property="og:description" content="${escape(config.intro)}"><meta property="og:type" content="article"><meta property="og:url" content="${canonical}"><script type="application/ld+json">${schema}</script><style>body{margin:0;background:#f6faf8;color:#16312a;font:16px/1.65 system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:24px}h1{font-size:clamp(1.7rem,5vw,2.7rem);line-height:1.2}a{color:#075b49}p{max-width:80ch}.notice,.method{padding:18px;background:white;border:1px solid #d8e5de;border-radius:12px;margin:20px 0}.notice{border-left:4px solid #b08018}.table-wrap{overflow-x:auto}table{border-collapse:collapse;min-width:680px;width:100%;background:#fff}th,td{padding:12px;text-align:left;border-bottom:1px solid #d8e5de}caption{text-align:left;font-weight:700;padding:12px}summary{cursor:pointer;font-weight:700}details{margin:15px 0}</style></head><body><main data-focused-guide><nav><a href="${site}">Ranking da Compra</a> · <a href="${site}${parentFile}">Comparativo da categoria</a> · <a href="${site}analises.html">Todas as análises</a></nav><h1>${escape(config.title)}</h1><p>${escape(config.intro)}</p><p class="notice">${ranked.length ? `${ranked.length} opções cadastradas para esta seleção.` : 'No momento não há opções com os requisitos e preço necessários confirmados. Veja o comparativo da categoria e confira os critérios abaixo.'} Preços são registros informados, não garantia de valor em tempo real. Confirme preço final, estoque e frete no vendedor.</p><div class="table-wrap"><table><caption>Opções em ordem alfabética, sem vencedor artificial</caption><thead><tr><th>Produto</th><th>Preço informado</th><th>Próximo passo</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Nenhum produto elegível neste momento.</td></tr>'}</tbody></table></div>${renderPracticalSection(config.category.source, ranked, productUrls)}<section class="method"><h2>Como classificamos</h2><p>Não atribuímos posições de qualidade nesta página. Filtramos os registros pela proposta anunciada${config.budget ? ' e pelo preço informado de até R$ 100, sem frete' : ''}, mantendo apenas produtos com análise publicada. A lista usa ordem alfabética e reaproveita o mesmo cadastro e conferência de preços do site.</p><p>Revisão editorial: <a href="${site}sobre.html">Equipe Ranking da Compra</a>. <a href="${site}como-avaliamos.html">Leia nossa metodologia</a>. Referência dos cadastros: ${escape(date)}.</p></section><footer>Links de afiliados podem gerar comissão sem custo adicional. <a href="${site}politica-afiliados.html">Política de afiliados</a>.</footer></main></body></html>\n`;
}
