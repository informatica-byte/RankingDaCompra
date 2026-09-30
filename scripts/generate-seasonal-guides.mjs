import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SITE = "https://rankingdacompra.com.br/";
const GUIDE_DIR = "presentes";
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Os temas reaproveitam o calendário e as ilustrações já usados pelo Ranking.
export const GUIDE_THEMES = [
  { id: "criancas", slug: "dia-das-criancas", name: "Dia das Crianças", icon: "🧸", image: "criancas", color: "#6b2f95", categories: ["brinquedos"], terms: /brinqued|blocos de montar|bonec|carrinho|lousa magica|jogo de tabuleiro|educativ/i, title: "Presentes para o Dia das Crianças: ideias para brincar e aprender", intro: "Brinquedos e jogos para escolher com atenção à idade indicada, ao espaço disponível e ao interesse da criança.", tip: "Confira a faixa etária e as peças pequenas no anúncio antes de comprar." },
  { id: "natal", slug: "natal", name: "Natal", icon: "🎄", image: "natal", color: "#08634c", categories: ["brinquedos", "beleza", "perfumes", "fones", "casa", "smartwatch"], terms: /presente|kit|brinqued|perfume|fone|relogio|relógio/i, title: "Presentes de Natal: ideias para diferentes pessoas e bolsos", intro: "Uma seleção para comparar presentes de estilos diferentes sem depender de uma oferta que acaba amanhã.", tip: "Veja o prazo de entrega e confirme o valor final no vendedor." },
  { id: "maes", slug: "dia-das-maes", name: "Dia das Mães", icon: "💐", image: "maes", color: "#9b315b", categories: ["beleza", "perfumes", "casa", "malas", "smartwatch"], terms: /perfume|bolsa|beleza|cabelo|cozinha|maquiagem/i, title: "Presentes para o Dia das Mães: opções úteis e especiais", intro: "Ideias para diferentes rotinas, com características e limitações para ajudar você a escolher sem adivinhar o gosto de quem vai receber.", tip: "Prefira produtos que combinem com hábitos e preferências reais de quem será presenteada." },
  { id: "pais", slug: "dia-dos-pais", name: "Dia dos Pais", icon: "💙", image: "pais", color: "#15588e", categories: ["ferramentas", "carro", "esporte", "fones", "perfumes", "smartwatch"], terms: /ferramenta|perfume|fone|carro|relogio|relógio/i, title: "Presentes para o Dia dos Pais: escolhas para cada estilo", intro: "Tecnologia, cuidados pessoais e itens práticos para comparar de acordo com o que ele gosta de fazer.", tip: "Confira compatibilidade, tamanho e voltagem quando fizerem diferença." },
  { id: "namorados", slug: "dia-dos-namorados", name: "Dia dos Namorados", icon: "💝", image: "namorados", color: "#9d2258", categories: ["perfumes", "beleza", "fones", "smartwatch", "malas"], terms: /perfume|fone|bolsa|relógio|relogio/i, title: "Presentes para o Dia dos Namorados: ideias para surpreender", intro: "Opções para gostos e orçamentos diferentes, com informações práticas antes de decidir.", tip: "Um presente adequado ao gosto da pessoa vale mais que uma promoção chamativa." },
  { id: "pascoa", slug: "pascoa", name: "Páscoa", icon: "🐰", image: "pascoa", color: "#714082", categories: ["brinquedos", "casa", "super mercado"], terms: /brinqued|jogo|cozinha|chocolate|pote|forma/i, title: "Ideias para a Páscoa: presentes e itens para celebrar", intro: "Brincadeiras e itens úteis para reunir a família, além das opções tradicionais da data.", tip: "Para alimentos, confira composição, validade e condições de entrega diretamente na loja." },
  { id: "volta-aulas", slug: "volta-as-aulas", name: "Volta às aulas", icon: "🎒", image: "volta-aulas", color: "#175f8c", categories: ["informatica", "notebook", "tablet", "impressoras", "malas"], terms: /mochila|tablet|notebook|impressora|teclado|estud/i, title: "Volta às aulas: tecnologia e itens úteis para estudar", intro: "Compare o que realmente ajuda nos estudos antes de investir em tecnologia ou acessórios.", tip: "Verifique os requisitos da escola ou do curso antes de escolher eletrônicos." },
  { id: "consumidor", slug: "dia-do-consumidor", name: "Dia do Consumidor", icon: "🛍️", image: "consumidor", color: "#08728d", categories: ["casa", "beleza", "fones", "celular", "ferramentas"], terms: /fone|celular|air fryer|fritadeira|ferramenta/i, title: "Dia do Consumidor: produtos para comparar antes de comprar", intro: "Escolhas de várias categorias para avaliar uso, limitações e preço confirmado, sem prometer descontos que não foram comprovados.", tip: "Compare o preço final e o histórico quando houver dados suficientes." },
  { id: "festa-junina", slug: "festa-junina", name: "Festa Junina", icon: "🌽", image: "festa-junina", color: "#a3481c", categories: ["casa", "super mercado", "roupas"], terms: /cozinha|panela|festa|roupa|decora|fogareiro/i, title: "Festa Junina: itens para preparar e aproveitar a comemoração", intro: "Utensílios, decoração e opções práticas para planejar a festa sem compras por impulso.", tip: "Confira medidas e capacidade dos itens antes de montar sua lista." },
  { id: "carnaval", slug: "carnaval", name: "Carnaval", icon: "🎭", image: "carnaval", color: "#8b227c", categories: ["beleza", "roupas", "caixas", "malas"], terms: /caixa de som|bolsa|maquiagem|roupa|protetor/i, title: "Carnaval: itens úteis para curtir com conforto", intro: "Acessórios, cuidados pessoais e produtos para diferentes formas de aproveitar o feriado.", tip: "Para usar na rua, confira peso, autonomia e resistência quando forem relevantes." },
  { id: "black-friday", slug: "black-friday", name: "Black Friday", icon: "⚡", image: "black-friday", color: "#222222", categories: ["celular", "notebook", "smart tv", "casa", "fones"], terms: /celular|notebook|tv|fone|air fryer/i, title: "Black Friday: como escolher produtos sem cair em preço ilusório", intro: "Uma seleção para comparar características, limitações e registros de preço antes de decidir.", tip: "Desconto anunciado não substitui a comparação do preço final e do histórico." },
  { id: "ano-novo", slug: "ano-novo", name: "Ano-Novo", icon: "✨", image: "ano-novo", color: "#176074", categories: ["casa", "esporte", "beleza", "informatica"], terms: /organiza|academia|exercicio|exercício|cozinha|agenda/i, title: "Ano-Novo: produtos úteis para começar novos planos", intro: "Ideias práticas para organizar a rotina, cuidar de si e tirar projetos do papel.", tip: "Escolha pelo uso que você realmente pretende dar ao produto." },
];

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const plain = value => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const normalize = value => plain(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const priceNumber = value => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").replace(/[^\d,.]/g, "");
  const number = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
  return Number.isFinite(number) ? number : 0;
};
const priceDate = value => {
  if (value?.toDate) return value.toDate();
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date;
};
export function confirmedPrice(product, now = new Date()) {
  const recorded = recordedPrice(product, now);
  return recorded?.fresh ? { amount: recorded.amount, date: recorded.date } : null;
}

export function recordedPrice(product, now = new Date()) {
  if (product.precoAtualizadoManualmente !== true) return null;
  const date = priceDate(product.precoAtualizadoManualmenteEm);
  if (!date || date.getTime() > now.getTime()) return null;
  const validPromo = product.promocaoAtiva === true && String(product.promocaoValidaAte || "").slice(0, 10) >= now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const amount = priceNumber(validPromo ? product.precoPromocional : product.preco);
  return amount > 0 ? { amount, date, fresh: now.getTime() - date.getTime() <= 24 * 60 * 60 * 1000 } : null;
}

function productUrl(product) {
  const existing = String(product.url || "");
  if (/^https:\/\/rankingdacompra\.com\.br\/produto\/[a-zA-Z0-9_-]+\.html(?:\?|$)/.test(existing)) return existing;
  return `${SITE}produto/${encodeURIComponent(product.id)}-20260810-1.html`;
}

export function selectGuideProducts(products, theme, now = new Date()) {
  return products.map(product => {
    const title = normalize(product.titulo || product.title);
    const category = normalize(product.categoriaNome || product.category || product.categoria);
    const categoryMatch = theme.categories.some(item => category.includes(normalize(item)));
    const termMatch = theme.terms.test(title);
    const summary = plain(product.comentario || product.summary);
    const url = productUrl(product);
    const image = String(product.foto || product.image || "");
    const confirmed = confirmedPrice(product, now);
    const recorded = recordedPrice(product, now);
    return { product, title, category, summary, url, image, confirmed, recorded, score: Number(categoryMatch) * 10 + Number(termMatch) * 4 + Number(Boolean(confirmed)) * 2 + Math.min(Number(product.nota || product.rating || 0), 5) };
  }).filter(item => item.product.id && item.summary.length >= 80 && item.image.startsWith("https://") && item.url.startsWith(`${SITE}produto/`) && item.score >= 10)
    .sort((a, b) => b.score - a.score || (a.confirmed?.amount || Infinity) - (b.confirmed?.amount || Infinity) || a.title.localeCompare(b.title, "pt-BR"))
    .slice(0, 30);
}

function checkedBudget(title, selected) {
  const match = normalize(title).match(/ate\s*r?\$?\s*(\d[\d.]*(?:,\d{1,2})?)/);
  if (!match) return true;
  const limit = priceNumber(match[1]);
  return limit > 0 && selected.filter(item => item.confirmed && item.confirmed.amount <= limit).length >= 5;
}

export function guideTitle(theme, configuredTitle, selected) {
  const candidate = plain(configuredTitle).replace(/[<>]/g, "").slice(0, 85);
  return candidate.length >= 25 && normalize(candidate).includes(normalize(theme.name)) && checkedBudget(candidate, selected) ? candidate : theme.title;
}

function card(item) {
  const product = item.product;
  const recorded = item.recorded || item.confirmed;
  const checkedOn = recorded?.date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const price = recorded
    ? `<span class="category">${item.confirmed ? "Preço conferido" : "Último preço registrado"}</span><p class="price">${escapeHtml(BRL.format(recorded.amount))}</p><p class="checked">${item.confirmed ? "Conferido" : "Registrado"} em ${escapeHtml(checkedOn)}; confirme o valor final no vendedor.</p>`
    : `<p class="checked">Sem preço conferido. Veja o valor atual na análise.</p>`;
  return `<article class="product"><a href="${escapeHtml(item.url)}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(product.titulo || product.title)}" loading="lazy" width="320" height="240"></a><div class="product-copy"><span class="category">${escapeHtml(product.categoriaNome || product.category || product.categoria || "Produto")}</span><h3><a href="${escapeHtml(item.url)}">${escapeHtml(product.titulo || product.title)}</a></h3><p>${escapeHtml(item.summary.slice(0, 190))}${item.summary.length > 190 ? "…" : ""}</p>${price}<a class="product-cta" href="${escapeHtml(item.url)}">Ver análise e oferta</a></div></article>`;
}

function shell({ title, description, canonical, body, themeColor = "#0b604d" }) {
  const structured = JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", name: title, description, url: canonical, inLanguage: "pt-BR" }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} | Ranking da Compra</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><link rel="stylesheet" href="/presentes/presentes.css"><script type="application/ld+json">${structured}</script></head><body style="--theme:${themeColor}"><a class="skip" href="#conteudo">Pular para o conteúdo</a><header class="topbar"><a class="brand" href="/presentes/">Presentes & escolhas</a><nav aria-label="Navegação"><a href="/presentes/">Todas as datas</a><a href="/como-avaliamos.html">Como avaliamos</a><a href="/">Ranking da Compra</a></nav></header>${body}<footer><p>Seleção editorial do Ranking da Compra. Podemos receber comissão se você comprar pelos links, sem custo adicional. Preço, frete e estoque são definidos pela loja.</p><a href="/politica-afiliados.html">Política de afiliados</a> · <a href="/contato.html">Contato</a></footer></body></html>`;
}

function renderGuide(theme, selected, configuredTitle, now) {
  const title = guideTitle(theme, configuredTitle, selected);
  const canonical = `${SITE}${GUIDE_DIR}/${theme.slug}.html`;
  const budget = selected.filter(item => item.confirmed && item.confirmed.amount <= 100);
  const budgetSection = budget.length >= 3 ? `<section class="budget"><h2>Opções com preço conferido até R$ 100</h2><p>Esta seleção pode mudar. Confirme o preço final antes de comprar.</p><div class="mini-links">${budget.slice(0, 8).map(item => `<a href="${escapeHtml(item.url)}">${escapeHtml(item.product.titulo || item.product.title)} <strong>${escapeHtml(BRL.format(item.confirmed.amount))}</strong></a>`).join("")}</div></section>` : "";
  const description = `${theme.intro} Veja produtos cadastrados, pontos de atenção e o preço quando houver conferência recente.`;
  const body = `<main id="conteudo"><div class="hero"><div class="hero-copy"><p class="eyebrow">Guia de ${escapeHtml(theme.name)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(theme.intro)}</p><a class="hero-cta" href="#escolhas">Ver ${selected.length} escolhas</a></div><img class="mascot" src="/assets/ranki/${theme.image}.png" alt="Ranki em tema de ${escapeHtml(theme.name)}" width="362" height="362"></div><div class="content"><nav class="crumb" aria-label="Você está aqui"><a href="/presentes/">Presentes</a> / ${escapeHtml(theme.name)}</nav><p class="updated">Catálogo gerado em ${escapeHtml(now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }))}. ${escapeHtml(theme.tip)}</p>${budgetSection}<section id="escolhas"><div class="section-head"><div><p class="eyebrow">Escolhas para comparar</p><h2>Encontre uma opção adequada</h2></div><span>${selected.length} produtos</span></div><div class="grid">${selected.map(card).join("")}</div></section><aside class="method"><h2>Como escolher</h2><p>Reunimos produtos já cadastrados no Ranking da Compra e mostramos informações úteis para comparar. Não afirmamos ter testado pessoalmente itens que não testamos. Preços aparecem aqui apenas quando a conferência manual é recente; nos demais casos, consulte a análise e a loja.</p><a href="/como-avaliamos.html">Conheça a metodologia</a></aside></div></main>`;
  return shell({ title, description, canonical, body, themeColor: theme.color });
}

function activeTheme(config, now) {
  const manual = config.seasonalThemeMode === "manual" && GUIDE_THEMES.some(theme => theme.id === config.seasonalThemeId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (manual && (!config.seasonalThemeStart || today >= config.seasonalThemeStart) && (!config.seasonalThemeEnd || today <= config.seasonalThemeEnd)) return config.seasonalThemeId;
  const month = Number(now.toLocaleDateString("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" }));
  return ({ 1: "volta-aulas", 2: "carnaval", 3: "consumidor", 4: "pascoa", 5: "maes", 6: "namorados", 7: "pais", 8: "pais", 9: "criancas", 10: "criancas", 11: "black-friday", 12: "natal" })[month] || "natal";
}

function renderHub(theme, guides, now) {
  const title = "Guias de presentes e datas especiais";
  const description = "Encontre ideias para presentear em datas especiais. Compare produtos, limitações e preços conferidos recentemente no Ranking da Compra.";
  const featured = guides.find(item => item.theme.id === theme.id) || guides[0];
  const links = guides.map(item => `<a class="occasion" href="/presentes/${item.theme.slug}.html"><span>${item.theme.icon}</span><strong>${escapeHtml(item.theme.name)}</strong><small>${item.count} escolhas para comparar</small></a>`).join("");
  const body = `<main id="conteudo"><div class="hero hub-hero"><div class="hero-copy"><p class="eyebrow">Datas especiais, escolhas melhores</p><h1>${title}</h1><p>${description}</p><a class="hero-cta" href="/presentes/${featured.theme.slug}.html">Ver guia de ${escapeHtml(featured.theme.name)}</a></div><img class="mascot" src="/assets/ranki/${featured.theme.image}.png" alt="Ranki em tema de ${escapeHtml(featured.theme.name)}" width="362" height="362"></div><div class="content"><p class="updated">Guias atualizados em ${escapeHtml(now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }))}. Os preços podem mudar na loja.</p><section><div class="section-head"><div><p class="eyebrow">Escolha a ocasião</p><h2>O que você está procurando?</h2></div></div><div class="occasion-grid">${links}</div></section><aside class="method"><h2>Escolhas com contexto</h2><p>Usamos as análises e os produtos cadastrados no Ranking da Compra. Cada guia tem endereço próprio e continua disponível fora da temporada; preços só são exibidos quando a conferência é recente.</p><a href="/como-avaliamos.html">Veja nossa metodologia</a></aside></div></main>`;
  return shell({ title, description, canonical: `${SITE}presentes/`, body, themeColor: featured.theme.color });
}

export async function generateSeasonalGuides(products, config = {}, { root = process.cwd(), now = new Date() } = {}) {
  const directory = resolve(root, GUIDE_DIR);
  await mkdir(directory, { recursive: true });
  const guides = [];
  for (const theme of GUIDE_THEMES) {
    const selected = selectGuideProducts(products, theme, now);
    if (selected.length < 5) continue;
    const configuredTitle = config[`giftGuideTitle_${theme.id.replaceAll("-", "_")}`];
    await writeFile(resolve(directory, `${theme.slug}.html`), renderGuide(theme, selected, configuredTitle, now), "utf8");
    guides.push({ theme, count: selected.length, url: `${SITE}${GUIDE_DIR}/${theme.slug}.html` });
  }
  if (!guides.length) throw new Error("Nenhum guia sazonal tem produtos suficientes para publicar.");
  const theme = GUIDE_THEMES.find(item => item.id === activeTheme(config, now)) || guides[0].theme;
  await writeFile(resolve(directory, "index.html"), renderHub(theme, guides, now), "utf8");
  return [{ url: `${SITE}${GUIDE_DIR}/`, count: guides.length }, ...guides];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const index = JSON.parse(await readFile(resolve("search-index.json"), "utf8"));
  const config = JSON.parse(await readFile(resolve("site-config.json"), "utf8"));
  const guides = await generateSeasonalGuides(index.products || [], config);
  console.log(`Guias sazonais iniciais: ${guides.length} páginas estáticas geradas sem ler o Firebase.`);
}
