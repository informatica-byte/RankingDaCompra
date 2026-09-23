import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import "./validate-blueprint.mjs";

const SITE = "https://rankingdacompra.com.br/";
const errors = [];

function fail(message) { errors.push(message); }
function has(html, pattern, label, file) { if (!pattern.test(html)) fail(file + ": " + label); }
function productIdentityKeys(html) {
  const mlbKeys = [...html.matchAll(/\bMLB[-_\s]?(\d{6,})\b/gi)]
    .map((match) => "mlb:" + match[1]);
  const affiliateKeys = [...html.matchAll(/https:\/\/meli\.la\/[A-Za-z0-9_-]+/gi)]
    .map((match) => "affiliate:" + match[0].toLowerCase());
  const shopeeKeys = [...html.matchAll(/https:\/\/(?:[a-z0-9-]+\.)?shopee\.com\.br\/[A-Za-z0-9_?&=.%/-]+/gi)]
    .map((match) => "affiliate:" + match[0].toLowerCase());
  return [...new Set([...mlbKeys, ...affiliateKeys, ...shopeeKeys])];
}

const homeHtml = await readFile(resolve("index.html"), "utf8");
has(homeHtml, /const rotaInicial=.*:homeComPromocoes\(\)/, "a vitrine inicial ainda espera serviços externos antes de aparecer", "index.html");
has(homeHtml, /qualidadeHistoricoSemanal/, "priorização do Top 6 pelo histórico ausente", "index.html");
has(homeHtml, /id="offers-loading"/, "estado visual de carregamento imediato ausente", "index.html");
has(homeHtml, /repetidoEmDestaque/, "preenchimento de segurança para manter seis produtos ausente", "index.html");
has(homeHtml, /seo-priorities\.js\?v=20260913-1/, "catálogo SEO compartilhado ausente da vitrine", "index.html");
has(homeHtml, /growth-tools\.js\?v=20260923-manual-price1/, "versão nova das ferramentas da vitrine não foi ativada", "index.html");
has(homeHtml, /class="hero-search"[\s\S]{0,300}name="busca"/, "busca principal visível ausente da primeira tela", "index.html");
has(homeHtml, /Ver todos os comparativos/, "atalho principal para comparativos ausente", "index.html");
if (/`#\$\{i\} no ranking`/.test(homeHtml)) fail("index.html: resultado comum ainda recebe posição de ranking sem comparação aprovada");
has(homeHtml, /fetch\(`\.\/search-index\.json\?v=/, "busca estática sem Firebase ausente", "index.html");
has(homeHtml, /window\.RANKING_CATEGORY_GUIDES=\{/, "mapa preventivo de categorias antigas ausente", "index.html");
has(homeHtml, /location\.replace\(new URL\(destino,/, "categorias antigas ainda podem gerar páginas duplicadas ou soft 404", "index.html");
has(homeHtml, /"fonesdeouvido":"melhores-fones-de-ouvido\.html"/, "redirecionamento da categoria antiga de fones ausente", "index.html");
has(homeHtml, /"fritadeiraairfrayereletrica":"melhores-fritadeira-air-fryer-eletrica\.html"/, "redirecionamento da categoria antiga de air fryer ausente", "index.html");
has(homeHtml, /const urlCategoria=.*RANKING_CATEGORY_GUIDES/, "links internos ainda podem recriar categorias duplicadas", "index.html");
if (/href="\?cat=\$\{encodeURIComponent\(catId\)\}"/.test(homeHtml)) fail("index.html: página de produto ainda aponta para filtro antigo de categoria");
const searchFunction = homeHtml.match(/async function search\(term\)\{[\s\S]*?\nconst formBusca=/)?.[0] || "";
if (!searchFunction) fail("index.html: função de busca não foi localizada");
if (/db\.collection\(/.test(searchFunction)) fail("index.html: a busca ainda lê o Firebase diretamente");
has(searchFunction, /relevancia:pontuar\(p\)/, "busca não ordena os resultados por relevância", "index.html");
has(homeHtml, /\.search-toggle\{[^}]*width:44px;height:44px/, "botão de busca menor que 44 pixels", "index.html");
has(homeHtml, /\.share-card-button,\.share-deal-button\{min-height:44px/, "botões de compartilhamento menores que 44 pixels", "index.html");

const growthTools = await readFile(resolve("growth-tools.js"), "utf8");
has(growthTools, /CONFIG_CACHE_TTL\s*=\s*12 \* 60 \* 60 \* 1000/, "cache econômico de configuração pública ausente", "growth-tools.js");
has(growthTools, /Object\.keys\(cached\)\.length \? Promise\.resolve\(cached\)/, "configuração ainda pode reler o Firebase em cada página", "growth-tools.js");
has(growthTools, /function persistConfigCache\(value\)/, "cache compartilhado da configuração pública ausente", "growth-tools.js");
has(growthTools, /function updateCachedConfig\(partial\)/, "alterações administrativas não atualizam o cache público", "growth-tools.js");
has(growthTools, /updateCachedConfig\(settings\)/, "título SEO salvo não fica disponível imediatamente na vitrine", "growth-tools.js");
has(growthTools, /ranking-da-compra-config-publica-v2/, "versão antiga do cache pode esconder o título SEO recém-salvo", "growth-tools.js");
has(homeHtml, /growth-tools\.js\?v=20260923-manual-price1/, "a vitrine ainda pode usar a versão antiga das ferramentas de configuração", "index.html");
const siteConfig = JSON.parse(await readFile(resolve("site-config.json"), "utf8"));
const videoStudioHtml = await readFile(resolve("estudio-videos.html"), "utf8");
const videoStudioJs = await readFile(resolve("ranki-video-studio.js"), "utf8");
has(videoStudioHtml, /name="robots" content="noindex,nofollow"/, "estúdio administrativo pode ser indexado", "estudio-videos.html");
has(videoStudioJs, /onAuthStateChanged/, "proteção de login ausente no estúdio", "ranki-video-studio.js");
has(videoStudioJs, /fetch\(`\/search-index\.json/, "catálogo estático econômico ausente", "ranki-video-studio.js");
has(videoStudioJs, /gemini-3\.1-flash-tts-preview/, "voz natural do Ranki ausente", "ranki-video-studio.js");
has(videoStudioJs, /captureStream\(30\)/, "gravação vertical pelo navegador ausente", "ranki-video-studio.js");
has(videoStudioJs, /youtube\.upload/, "autorização limitada ao envio para o YouTube ausente", "ranki-video-studio.js");
has(videoStudioJs, /youtubeVideoId:[\s\S]{0,260}youtubePublicadoEm:/, "referência econômica do vídeo não é ligada ao produto", "ranki-video-studio.js");
if (/firebase\.storage\(|getStorage\(|uploadBytes\(/.test(videoStudioJs)) fail("ranki-video-studio.js: o vídeo não deve ocupar Firebase Storage");
has(homeHtml, /data-promotion-title/, "título editável das promoções ausente", "index.html");
has(homeHtml, /tituloPromocoesPublicado\(siteConfig\)/, "título SEO publicado não é aplicado à vitrine", "index.html");
has(growthTools, /function youtubeVideoId\(value\)/, "validação dos links do YouTube ausente", "growth-tools.js");
has(growthTools, /youtubeShowcaseItems\(config\?\.youtubeShowcaseItems, config\?\.youtubeShowcaseLinks\)/, "relação entre vídeo e produto ausente", "growth-tools.js");
has(growthTools, /data-youtube-product-overlay/, "cartão clicável do produto sobre o vídeo ausente", "growth-tools.js");
has(growthTools, /width:min\(230px,calc\(100% - 72px\)\)/, "cartão do produto ainda ocupa área excessiva em vídeos menores", "growth-tools.js");
has(growthTools, /background:rgba\(255,255,255,\.8\)/, "cartão compacto do vídeo não está semitransparente", "growth-tools.js");
has(growthTools, /botão discreto sobre o vídeo/, "orientação do vídeo ainda descreve um cartão grande", "growth-tools.js");
has(growthTools, /overlay\.setAttribute\("aria-label"/, "botão compacto do produto perdeu identificação acessível", "growth-tools.js");
has(growthTools, /fetch\(`\/search-index\.json\?v=/, "cartão do vídeo não usa o índice estático econômico", "growth-tools.js");
has(growthTools, /getVideoData\(\)\?\.video_id/, "cartão do produto não acompanha o vídeo atual", "growth-tools.js");
has(growthTools, /id="growth-youtube-items"/, "campos separados de vídeo e produto ausentes", "growth-tools.js");
has(growthTools, /data-youtube-url/, "campo específico do YouTube ausente", "growth-tools.js");
has(growthTools, /data-product-url/, "campo específico do produto ausente", "growth-tools.js");
has(growthTools, /function youtubePairEntries\(/, "leitura conjunta dos campos de vídeo e produto ausente", "growth-tools.js");
has(growthTools, /entries\.length < 3 \|\| entries\.length > 10/, "limite entre três e dez vídeos não é protegido", "growth-tools.js");
has(growthTools, /rows\.length >= 10/, "botão de adicionar não respeita o máximo de dez vídeos", "growth-tools.js");
if (/id="growth-youtube-links"/.test(growthTools)) fail("growth-tools.js: campo único antigo de vídeos voltou ao painel");
has(growthTools, /youtube-nocookie\.com\/embed/, "player privado do YouTube ausente", "growth-tools.js");
has(growthTools, /playlist=\$\{encodeURIComponent\(ids\.join\(","\)\)\}/, "reprodução automática sequencial ausente", "growth-tools.js");
has(growthTools, /Salvando sem enviar arquivos de vídeo ao Firebase/, "proteção de armazenamento dos vídeos não está explícita", "growth-tools.js");
has(growthTools, /promotionSeoTitle/, "configuração do título SEO ausente", "growth-tools.js");
has(growthTools, /id="growth-promotion-ai"/, "botão de sugestão de título por IA ausente", "growth-tools.js");
has(growthTools, /window\.obterOfertasAtivasParaTitulo/, "sugestão não usa somente as promoções ativas", "growth-tools.js");
has(growthTools, /result\.pesquisaHtml/, "sugestões obrigatórias do Google Search não são exibidas", "growth-tools.js");
has(growthTools, /function promotionFallbackSuggestions\(offers\)/, "alternativa local para limite temporário da IA ausente", "growth-tools.js");
has(growthTools, /window\.gerarTitulosPromocaoSemIA = promotionFallbackSuggestions/, "alternativa local de títulos não pode ser testada", "growth-tools.js");
has(growthTools, /A pesquisa da IA atingiu o limite temporário/, "painel não informa a alternativa segura quando a IA atinge o limite", "growth-tools.js");
if (!siteConfig.promotionSeoTitle || !Array.isArray(siteConfig.youtubeShowcaseLinks) || !Array.isArray(siteConfig.youtubeShowcaseItems) || siteConfig.youtubeShowcaseEnabled !== false) {
  fail("site-config.json: configuração inicial segura da vitrine de vídeos ou do título SEO ausente");
}
const seoPriorities = await readFile(resolve("seo-priorities.js"), "utf8");
has(seoPriorities, /id:\s*"celular"/, "prioridade de celulares ausente", "seo-priorities.js");
has(seoPriorities, /id:\s*"notebook"/, "prioridade de notebooks ausente", "seo-priorities.js");
has(seoPriorities, /id:\s*"air-fryer"/, "prioridade de air fryers ausente", "seo-priorities.js");
has(seoPriorities, /id:\s*"patinete-eletrico"/, "prioridade de patinetes ausente", "seo-priorities.js");
has(seoPriorities, /melhor celular até \{price\}/, "pauta de cauda longa por preço ausente", "seo-priorities.js");
has(growthTools, /id="weekly-ranking-seo-title"/, "título de busca separado do filtro ausente", "growth-tools.js");
has(growthTools, /intencaoBusca:/, "intenção de busca não é preservada no ranking", "growth-tools.js");
has(growthTools, /kind === "compartilhamento" \? 2/, "compartilhamentos não participam da sugestão semanal", "growth-tools.js");
has(growthTools, /function weeklyUniqueMetrics\(metrics\)/, "métricas novas e legadas não são consolidadas antes do ranking", "growth-tools.js");
has(growthTools, /metrics: weeklyUniqueMetrics\(metrics\)/, "ranking semanal ainda pode contar a mesma métrica duas vezes", "growth-tools.js");
has(growthTools, /overallScore >= Math\.max\(10, priorityScore \* 1\.5\)/, "procura excepcional não consegue superar a pauta inicial", "growth-tools.js");
has(growthTools, /Histórico de preços registrados — não é cotação atual/, "histórico ainda pode parecer preço atual", "growth-tools.js");
has(growthTools, /const isProductPage = \/\\\/produto\\\//, "tratamento específico da página de produto ausente", "growth-tools.js");
has(growthTools, /\.product-detail-page \.club-floating\{display:none\}/, "WhatsApp flutuante ainda pode cobrir a compra no celular", "growth-tools.js");
if (growthTools.includes("✓ Oferta comprovada pelo histórico")) fail("growth-tools.js: afirmação genérica de oferta comprovada ainda presente");
const priceHistoryUpdater = await readFile(resolve("scripts/update-price-history.mjs"), "utf8");
has(priceHistoryUpdater, /function productIdentity\(html\)/, "identidade MLB não é registrada no histórico", "scripts/update-price-history.mjs");
has(priceHistoryUpdater, /const resetHistory = identityChanged \|\| \(!currentIdentity && titleChanged\)/, "histórico antigo não é reiniciado quando o produto muda", "scripts/update-price-history.mjs");
has(priceHistoryUpdater, /const sourcePoints = resetHistory \? \[\] : current\.points/, "pontos de outro produto ainda podem ser reaproveitados", "scripts/update-price-history.mjs");
has(growthTools, /const SEASONAL_THEMES = \{/, "catálogo de temas sazonais ausente", "growth-tools.js");
has(growthTools, /seasonalThemeMode/, "controle manual e automático de temas ausente", "growth-tools.js");
has(growthTools, /automaticThemeId/, "calendário automático de campanhas ausente", "growth-tools.js");
has(growthTools, /prefers-reduced-motion/, "acessibilidade das animações sazonais ausente", "growth-tools.js");
has(growthTools, /collection\("produtos"\)\.doc\("\.site-theme"\)/, "armazenamento seguro e invisível dos temas ausente", "growth-tools.js");
has(growthTools, /tipo:\s*"configuracao_tema"/, "identificação do registro técnico de temas ausente", "growth-tools.js");
has(growthTools, /function renderMascot\(\)/, "integração do mascote Ranki ausente", "growth-tools.js");
has(growthTools, /src="\/ranki\.png"/, "imagem do mascote Ranki não está ligada à vitrine", "growth-tools.js");
has(growthTools, /data-ranki-mascot/, "proteção contra duplicação do mascote ausente", "growth-tools.js");
has(growthTools, /const RANKI_THEME_IMAGES/, "roupas temáticas do Ranki ausentes", "growth-tools.js");
has(growthTools, /function ensureRankiHelp\(\)/, "janela do Ranki Ajuda ausente", "growth-tools.js");
has(growthTools, /data-ranki-action="ofertas"/, "atalhos do Ranki Ajuda ausentes", "growth-tools.js");
has(growthTools, /aria-controls="ranki-help"/, "controle acessível do Ranki Ajuda ausente", "growth-tools.js");
has(growthTools, /if \(event\.key === "Escape"\) closeRankiHelp\(\)/, "fechamento do Ranki Ajuda pelo teclado ausente", "growth-tools.js");
has(growthTools, /function setupFunnelTracking\(\)/, "rastreamento do funil comercial ausente", "growth-tools.js");
has(growthTools, /recordFunnelMetric\("clique_secao",\s*offer,\s*"view:"/, "visualizações de produto não são registradas de forma compatível com as regras", "growth-tools.js");
has(growthTools, /recordFunnelMetric\("clique_oferta"/, "cliques em Comprar não são registrados no funil", "growth-tools.js");
has(growthTools, /const WEEKLY_COMPARISON_DOC = "ranking-semanal"/, "documento do ranking comparativo semanal ausente", "growth-tools.js");
has(growthTools, /function weeklyBuildDraft\(/, "motor de seleção do ranking comparativo ausente", "growth-tools.js");
has(growthTools, /function weeklyMetricKind\(/, "uso de cliques e visualizações no ranking semanal ausente", "growth-tools.js");
has(growthTools, /function weeklyMetricProductId\(/, "compatibilidade com métricas históricas ausente no ranking", "growth-tools.js");
has(growthTools, /setupWeeklyRankingAdmin\(container\)/, "painel de revisão do ranking semanal ausente", "growth-tools.js");
has(growthTools, /Publicar após aprovação/, "aprovação obrigatória do ranking semanal ausente", "growth-tools.js");
has(growthTools, /config\?\.publicado !== true \|\| storedProducts\.length !== 5/, "proteção contra ranking incompleto ou não aprovado ausente", "growth-tools.js");
has(growthTools, /function renderWeeklyComparison\(/, "vitrine pública do ranking comparativo ausente", "growth-tools.js");
has(growthTools, /Como classificamos/, "transparência da metodologia do ranking ausente", "growth-tools.js");
has(growthTools, /numberPrice\(item\.preco \?\? item\.price\)/, "compatibilidade entre os campos preco e price ausente", "growth-tools.js");
has(growthTools, /Preço a confirmar/, "proteção visual contra preço inválido ausente", "growth-tools.js");
has(growthTools, /function weeklyScoreProducts\(/, "pontuação comparativa transparente ausente", "growth-tools.js");
has(growthTools, /custo-benefício \(35%\)/, "peso do custo-benefício não está declarado", "growth-tools.js");
has(growthTools, /avaliação informada \(30%\)/, "peso da avaliação não está declarado", "growth-tools.js");
has(growthTools, /interesse observado nos últimos 7 dias \(15%\)/, "peso do interesse semanal não está declarado", "growth-tools.js");
has(growthTools, /qualidade das evidências cadastradas \(20%\)/, "peso das evidências não está declarado", "growth-tools.js");
has(growthTools, /Por que está em /, "justificativa individual de posição ausente", "growth-tools.js");
has(growthTools, /ponto\(s\) atrás do produto anterior/, "comparação objetiva com o colocado anterior ausente", "growth-tools.js");
has(growthTools, /abaixo da média dos cinco/, "comparação de preço com a média ausente", "growth-tools.js");
has(growthTools, /Nota comparativa /, "nota comparativa de 0 a 10 ausente", "growth-tools.js");
has(growthTools, /function weeklyHighlights\(/, "motor de destaques rápidos do comparativo ausente", "growth-tools.js");
has(growthTools, /Melhor geral/, "destaque de vencedor ausente", "growth-tools.js");
has(growthTools, /Melhor custo-benefício/, "destaque de custo-benefício ausente", "growth-tools.js");
has(growthTools, /Menor preço registrado/, "destaque de menor preço histórico ausente", "growth-tools.js");
has(growthTools, /Mais procurado no site/, "destaque de interesse comprovado ausente", "growth-tools.js");
has(growthTools, /weekly-quick-picks/, "resumo visual dos destaques ausente", "growth-tools.js");
has(growthTools, /function weeklyCardSummary\(/, "resumo objetivo dos cartões do comparativo ausente", "growth-tools.js");
has(growthTools, /<details class="weekly-ranking-details"><summary>Mais informações<\/summary>/, "análises extensas não estão recolhidas atrás de Mais informações", "growth-tools.js");
has(growthTools, /<details class="weekly-ai-summary"><summary>Resumo da análise editorial<\/summary>/, "resumo editorial extenso não está recolhido", "growth-tools.js");
has(growthTools, /weekly-ranking-details summary/, "controle visual dos detalhes do comparativo ausente", "growth-tools.js");
if (/label:\s*["']Mais vendido/i.test(growthTools)) fail("growth-tools.js: não afirmar produto mais vendido sem dados de vendas");
has(growthTools, /id="weekly-ranking-ai"/, "botão de análise humanizada ausente", "growth-tools.js");
has(growthTools, /function weeklyApplyAIAnalysis\(/, "validação local da análise por IA ausente", "growth-tools.js");
has(growthTools, /Análise editorial com IA auditada/, "análise humanizada não aparece na vitrine", "growth-tools.js");
has(growthTools, /Fontes consolidadas:/, "fontes da análise humanizada não aparecem na vitrine", "growth-tools.js");
has(growthTools, /!routeParams\.has\("busca"\)[\s\S]{0,100}!routeParams\.has\("cat"\)[\s\S]{0,100}!routeParams\.has\("produto"\)/, "comparativo semanal ainda pode invadir busca, categoria ou produto", "growth-tools.js");
if (/pelo equilíbrio entre/.test(growthTools)) fail("growth-tools.js: justificativa vaga do ranking ainda presente");
if (/brl\.format\(item\.price\)/.test(growthTools)) fail("growth-tools.js: preço do ranking ainda pode renderizar NaN");

const mobilePanelHtml = await readFile(resolve("painel-celular.html"), "utf8");
has(mobilePanelHtml, /id="ranking-mobile"/, "painel do ranking comparativo ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /id="ranking-termo"/, "filtro por produto ou categoria ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /id="ranking-preco"/, "limite de preço do ranking ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /id="ranking-prioridade"/, "seletor de pauta SEO ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /id="ranking-titulo-seo"/, "título de busca separado do filtro ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /rankingSugerirTema/, "sugestão pelo interesse semanal ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /where\("dia",\s*">=",\s*chave\)/, "análise dos últimos sete dias ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /function rankingMetricaProdutoId\(/, "compatibilidade móvel com métricas históricas ausente", "painel-celular.html");
has(mobilePanelHtml, /Publicar após aprovação/, "aprovação obrigatória do ranking ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /doc\(db,\s*"configuracoes",\s*"ranking-semanal"\)/, "sincronização do ranking entre os painéis ausente", "painel-celular.html");
has(mobilePanelHtml, /rankingPontuar\(candidatos\)\.slice\(0,\s*5\)/, "limite de cinco colocados ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /id="ranking-ia"/, "botão de análise humanizada ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /function rankingGerarIA\(/, "gerador humanizado ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /function rankingAplicarIA\(/, "auditoria local da análise ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /id="focus-mobile"/, "resumo da Central de foco ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /function focusMobileRender\(/, "cálculo de foco por categoria ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /Usar categoria no ranking semanal/, "atalho móvel para o ranking ausente", "painel-celular.html");
has(mobilePanelHtml, /Modo econômico ativo/, "modo econômico não está explicado no painel celular", "painel-celular.html");
has(mobilePanelHtml, /focusMobileLeituraAutorizada\s*=\s*true/, "análise móvel não exige ação manual antes da leitura completa", "painel-celular.html");
has(mobilePanelHtml, /actions\/workflows\/sync-mercadolivre\.yml/, "atalho móvel para a conferência em lote ausente", "painel-celular.html");
has(mobilePanelHtml, /Conferir todos os preços agora/, "botão móvel da conferência manual ausente", "painel-celular.html");
has(mobilePanelHtml, /Nenhuma conferência começa sozinha/, "proteção móvel contra conferência automática ausente", "painel-celular.html");
has(mobilePanelHtml, /id="link-shopee"/, "link opcional da Shopee ausente no painel celular", "painel-celular.html");
has(mobilePanelHtml, /id="preco-shopee"/, "preço opcional da Shopee ausente no painel celular", "painel-celular.html");
has(mobilePanelHtml, /linkShopee,\s*\n\s*precoShopee:/, "segunda oferta não é salva no mesmo cadastro móvel", "painel-celular.html");
has(mobilePanelHtml, /id="seo-opportunities-mobile"/, "Central SEO de oportunidades ausente no celular", "painel-celular.html");
has(mobilePanelHtml, /seo-opportunities\.js\?v=20260914-1/, "versão da Central SEO ausente no celular", "painel-celular.html");

const dashboardHtml = await readFile(resolve("dashboard.html"), "utf8");
has(dashboardHtml, /<h1 class="sr-only">Painel administrativo do Ranking da Compra<\/h1>/, "título principal acessível ausente", "dashboard.html");
has(dashboardHtml, /tools:\s*\[\{ googleSearch:\s*\{\} \}\]/, "IA de títulos não pesquisa tendências na web", "dashboard.html");
has(dashboardHtml, /window\.sugerirTitulosPromocaoIA/, "integração da IA de títulos ausente", "dashboard.html");
has(dashboardHtml, /N[aã]o diga "mais buscado", "mais vendido"/, "proteção contra alegações de procura sem prova ausente", "dashboard.html");
has(dashboardHtml, /id="central-visualizacoes-semana"/, "contador de visualizações do funil ausente", "dashboard.html");
has(dashboardHtml, /id="central-taxa-clique"/, "taxa de avanço ao Mercado Livre ausente", "dashboard.html");
has(dashboardHtml, /Produtos vistos sem resultado/, "lista de produtos vistos sem resultado ausente", "dashboard.html");
has(dashboardHtml, /window\.gerarAnaliseRankingIA/, "integração Gemini do ranking humanizado ausente", "dashboard.html");
has(dashboardHtml, /id="linkShopee"/, "link opcional da Shopee ausente no painel completo", "dashboard.html");
has(dashboardHtml, /id="precoShopee"/, "preço opcional da Shopee ausente no painel completo", "dashboard.html");
has(dashboardHtml, /linkShopee:\s*linkShopeeProduto/, "segunda oferta não é salva no mesmo cadastro completo", "dashboard.html");
has(dashboardHtml, /id="seo-opportunities-dashboard"/, "Central SEO de oportunidades ausente no painel completo", "dashboard.html");
has(dashboardHtml, /seo-opportunities\.js\?v=20260914-1/, "versão da Central SEO ausente no painel completo", "dashboard.html");

const seoOpportunities = await readFile(resolve("seo-opportunities.js"), "utf8");
has(seoOpportunities, /function parseSearchConsoleCsv\(/, "leitor do CSV do Search Console ausente", "seo-opportunities.js");
has(seoOpportunities, /function analyzeRows\(/, "priorização de impressões, CTR e posição ausente", "seo-opportunities.js");
has(seoOpportunities, /rdc-search-console-opportunities-v1/, "histórico local da Central SEO ausente", "seo-opportunities.js");
has(seoOpportunities, /Nenhuma alteração é publicada automaticamente/, "revisão humana da Central SEO não está explícita", "seo-opportunities.js");
if (/db\.collection|firebase\.firestore|collection\(db/.test(seoOpportunities)) {
  fail("seo-opportunities.js: a Central SEO não deve consumir o Firebase");
}

const sitemapGenerator = await readFile(resolve("scripts/generate-sitemap.mjs"), "utf8");
has(sitemapGenerator, /function productMarketplace\(product\)/, "identificação da loja ausente no gerador", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /id="affiliate-offer-shopee"/, "segunda opção Shopee ausente nas páginas compartilháveis", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /product\.linkShopee/, "gerador não lê o link Shopee do cadastro existente", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /product\.linkShopee/, "gerador não preserva a indicação Shopee do cadastro existente", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /const shopeeLabel = hasShopeeOffer \? "Conferir preço atual na Shopee"/, "preço Shopee não confirmado não deve parecer atual", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /affiliate:'shopee'/, "métrica da segunda oferta Shopee ausente", "scripts/generate-sitemap.mjs");

const mercadoLivreSync = await readFile(resolve("scripts/sync-mercadolivre.mjs"), "utf8");
has(mercadoLivreSync, /products = allProducts\.filter\(isMercadoLivreProduct\)/, "robô de preços não exclui outras lojas", "scripts/sync-mercadolivre.mjs");
has(dashboardHtml, /segunda revisora independente/, "segunda IA revisora do ranking ausente", "dashboard.html");
has(dashboardHtml, /visualizacao_produto/, "painel não reconhece visualizações das páginas de produto", "dashboard.html");
has(dashboardHtml, /id="central-foco"/, "Central de foco por categoria e produto ausente", "dashboard.html");
has(dashboardHtml, /function renderizarFocoCentral\(/, "cálculo semanal da Central de foco ausente", "dashboard.html");
has(dashboardHtml, /1 por visualização, 5 por clique em Comprar e 2 por compartilhamento/, "pesos transparentes da Central de foco ausentes", "dashboard.html");
has(dashboardHtml, /eventosPorId=new Map\(\)/, "dashboard não protege a consolidação das métricas por documento", "dashboard.html");
has(mobilePanelHtml, /function rankingMetricasUnicas\(metricas\)/, "painel móvel não consolida métricas novas e legadas", "painel-celular.html");
has(dashboardHtml, /data-central-foco-ranking/, "atalho da categoria em evidência para o ranking ausente", "dashboard.html");
has(dashboardHtml, /seo-priorities\.js\?v=20260913-1/, "catálogo SEO compartilhado ausente do painel", "dashboard.html");
has(dashboardHtml, /growth-tools\.js\?v=20260923-manual-price1/, "painel e vitrine usam versões diferentes das ferramentas", "dashboard.html");
has(dashboardHtml, /Conferir todos os preços agora/, "botão da conferência manual ausente", "dashboard.html");
has(dashboardHtml, /Nenhuma conferência começa sozinha/, "proteção contra conferência automática ausente", "dashboard.html");
if (/onclick="iniciarConferenciaPrecosIAEmLote\(\)"/.test(dashboardHtml)) {
  fail("dashboard.html: botão antigo ainda pode gravar preços um por um e aumentar o consumo do Firebase");
}
if (/tentarIniciarConferenciaPrecosAutomatica|automatico:\s*true/.test(dashboardHtml)) {
  fail("dashboard.html: conferência de preços ainda pode iniciar automaticamente e consumir cota sem autorização");
}
const seasonalThemeIds = ["ano-novo", "volta-aulas", "carnaval", "consumidor", "pascoa", "maes", "namorados", "festa-junina", "pais", "criancas", "black-friday", "natal"];
for (const theme of seasonalThemeIds) {
  if (!growthTools.includes(`${theme}:`) && !growthTools.includes(`"${theme}":`)) fail(`growth-tools.js: tema sazonal ausente: ${theme}`);
  let themedRanki = null;
  try { themedRanki = await readFile(resolve(`assets/ranki/${theme}.png`)); } catch {}
  if (!themedRanki || themedRanki.length < 10000 || themedRanki[0] !== 0x89 || themedRanki.toString("ascii", 1, 4) !== "PNG") {
    fail(`assets/ranki/${theme}.png: roupa temática do Ranki ausente ou inválida`);
  }
}

const rankiImage = await readFile(resolve("ranki.png"));
if (rankiImage.length < 10000 || rankiImage[0] !== 0x89 || rankiImage.toString("ascii", 1, 4) !== "PNG") {
  fail("ranki.png: arquivo PNG do mascote ausente ou inválido");
}

has(sitemapGenerator, /Custo-benefício editorial:/, "explicação da avaliação editorial ausente", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /overlap < 0\.8/, "filtro contra pontos copiados do título ausente", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /seo-priorities\.js\?v=20260913-1/, "catálogo SEO ausente das novas páginas", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /<script defer src="\/growth-tools\.js\?v=20260923-manual-price1"><\/script>/, "versão atual do corretor editorial não foi incluída nas novas páginas de produto", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /id="mobile-affiliate-offer"/, "botão de compra fixo no celular ausente", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /\.top>div\{display:flex;flex-direction:column;order:-1\}/, "informações principais ainda aparecem depois da foto no celular", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /contentType === "image\/webp" \? "webp"/, "imagens WebP do catálogo ainda podem bloquear a publicação", "scripts/generate-sitemap.mjs");
const growthToolsVersionPattern = /growth-tools\.js\?v=([^"'<>]+)/;
const growthToolsVersions = [homeHtml, dashboardHtml, sitemapGenerator]
  .map((source) => source.match(growthToolsVersionPattern)?.[1] || "");
if (growthToolsVersions.some((version) => !version) || new Set(growthToolsVersions).size !== 1) {
  fail("index.html, dashboard.html e scripts/generate-sitemap.mjs: versões de cache das ferramentas não estão alinhadas");
}
has(sitemapGenerator, /id="affiliate-offer"/, "botão de compra rastreável ausente das páginas de produto", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /allProducts = allProducts\.map\(correctProductData\)/, "correções editoriais preventivas não são aplicadas aos produtos", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /const separated = repairPortugueseEncoding\(value\)/, "separação segura dos fatos editoriais ausente", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /const indexable = editorial && offerUrl !== "#"/, "produto com análise e indicação não pode sumir quando o preço estiver pendente", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /if \(offerUrl !== "#" && confirmed\) structuredOffers\.push/, "preço não confirmado não pode ir para os dados estruturados", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /editorialProduct\(product\) && price > 0/, "produto sem preço ainda pode entrar no sitemap", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /selectCanonicalProducts\(groups, productSeoScore\)/, "URLs duplicadas não são ligadas à página principal", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /productAliasPage\(canonicalProduct\.titulo, productDetailUrl\(canonicalProduct\)\)/, "páginas antigas duplicadas ainda podem virar 404", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /unavailableProductPage\(previousHtml\)/, "páginas retiradas ainda podem virar 404", "scripts/generate-sitemap.mjs");
has(sitemapGenerator, /previousSitemapMetadata/, "modo de contingência pode apagar datas e prioridades do sitemap", "scripts/generate-sitemap.mjs");
if (/flatMap\(\(part\) => part\.split\(","\)\)/.test(sitemapGenerator)) {
  fail("scripts/generate-sitemap.mjs: pontos editoriais ainda são quebrados em toda vírgula");
}

const discoveryGenerator = await readFile(resolve("scripts/generate-discovery.mjs"), "utf8");
has(discoveryGenerator, /DISCOVERY_USE_GENERATED/, "descoberta interna ainda pode duplicar centenas de leituras do Firebase", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /function upgradeProductExperience\(html\)/, "contingência visual das páginas existentes ausente", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /data-mobile-product-buy/, "contingência não protege a ordem das informações no celular", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /id=\\?"mobile-affiliate-offer\\?"/, "contingência não garante o botão móvel de preço", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /writeFile\([\s\S]{0,100}search-index\.json/, "geração preventiva do índice de busca ausente", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /function renderCategoryGuide\(/, "gerador automático de comparativos por categoria ausente", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /function categoryIntent\(/, "intenções de busca não orientam os comparativos", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /GUIDE_SLUGS_BY_LEGACY_ID/, "proteção dos endereços públicos de categorias antigas ausente", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /CATEGORY_LABELS_BY_LEGACY_ID/, "proteção dos nomes públicos de categorias antigas ausente", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /publicCategoryName\(category\.id, category\.nome\)/, "gerador ainda pode exibir o identificador interno como título", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /guideFileName\(category\.id, categoryName\)/, "gerador ainda pode publicar o identificador interno como URL", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /Dúvidas que este comparativo ajuda a responder/, "cauda longa não aparece nos guias prioritários", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /categoryProducts\.length < 3/, "comparativo pode ser criado sem opções suficientes", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /if \(!guidePages\.includes\(file\)\) await unlink/, "comparativo antigo pode permanecer publicado depois de perder opções suficientes", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /ranking:\s*0,/, "busca ainda pode herdar posições não aprovadas", "scripts/generate-discovery.mjs");
has(discoveryGenerator, /custo-benefício \(35%\)/, "pesos do comparativo automático não estão explicados", "scripts/generate-discovery.mjs");
const updateWorkflow = await readFile(resolve(".github/workflows/update-sitemap.yml"), "utf8");
has(updateWorkflow, /DISCOVERY_USE_GENERATED=true node scripts\/generate-discovery\.mjs/, "workflow ainda repete a leitura completa dos produtos", ".github/workflows/update-sitemap.yml");
has(updateWorkflow, /cron:\s*["']17 13,16,19,22 \* \* \*["']/, "sitemap deve usar somente as quatro janelas econômicas diárias", ".github/workflows/update-sitemap.yml");
if ((updateWorkflow.match(/\bcron:/g) || []).length !== 1) fail(".github/workflows/update-sitemap.yml: deve existir exatamente um agendamento econômico");
has(updateWorkflow, /git add -A sitemap\.xml produto analises\.html 'melhores-\*\.html' top5-semanal\.json search-index\.json/, "comparativos e índice de busca não estão incluídos na publicação", ".github/workflows/update-sitemap.yml");
has(updateWorkflow, /git pull --rebase origin main[\s\S]{0,100}git push origin HEAD:main/, "publicação do sitemap ainda pode falhar por concorrência no GitHub", ".github/workflows/update-sitemap.yml");
const priceWorkflow = await readFile(resolve(".github/workflows/sync-mercadolivre.yml"), "utf8");
has(priceWorkflow, /workflow_dispatch:/, "atualização manual de todos os preços ausente", ".github/workflows/sync-mercadolivre.yml");
if (/^  schedule:/m.test(priceWorkflow) || /^  push:/m.test(priceWorkflow)) fail(".github/workflows/sync-mercadolivre.yml: a conferência de preços deve iniciar somente pelo botão manual");
has(priceWorkflow, /node --test scripts\/test-sync-mercadolivre\.mjs/, "teste preventivo do identificador MLB ausente", ".github/workflows/sync-mercadolivre.yml");
has(priceWorkflow, /group:\s*rankingdacompra-publicacao/, "lote manual não compartilha a trava dos robôs publicadores", ".github/workflows/sync-mercadolivre.yml");
has(priceWorkflow, /RDC_PRODUCTS_SNAPSHOT:\s*\.price-sync-products\.json/, "snapshot para evitar releitura integral ausente", ".github/workflows/sync-mercadolivre.yml");
has(priceWorkflow, /RDC_BATCH_SKIP_MARKER:\s*\.price-sync-skipped/, "bloqueio integral de uma segunda execução diária ausente", ".github/workflows/sync-mercadolivre.yml");
has(priceWorkflow, /RDC_BATCH_PARTIAL_MARKER:\s*\.price-sync-partial/, "marcador de lote parcial ausente", ".github/workflows/sync-mercadolivre.yml");
has(priceWorkflow, /-f "\$RDC_BATCH_SKIP_MARKER"[\s\S]{0,220}exit 0/, "gerador ainda pode reler produtos após lote diário já concluído", ".github/workflows/sync-mercadolivre.yml");
has(priceWorkflow, /node --test scripts\/test-daily-price-batch\.mjs/, "teste preventivo do lote diário ausente", ".github/workflows/sync-mercadolivre.yml");
has(priceWorkflow, /DISCOVERY_USE_GENERATED=true node scripts\/generate-discovery\.mjs/, "lote diário não atualiza a busca estática", ".github/workflows/sync-mercadolivre.yml");
has(priceWorkflow, /git add -A mercadolivre-status\.json sitemap\.xml produto analises\.html 'melhores-\*\.html' top5-semanal\.json search-index\.json/, "lote diário não publica todos os arquivos gerados", ".github/workflows/sync-mercadolivre.yml");
has(priceWorkflow, /description:\s*["']Repetir mesmo se o lote de hoje já terminou["'][\s\S]{0,100}default:\s*false/, "execução manual pode repetir o lote por engano", ".github/workflows/sync-mercadolivre.yml");
has(priceWorkflow, /for tentativa in 1 2 3 4; do[\s\S]*git pull --rebase origin main[\s\S]*git push origin HEAD:main/, "publicação do lote manual não tenta novamente após concorrência no GitHub", ".github/workflows/sync-mercadolivre.yml");
has(priceWorkflow, /name: Sinalizar conferência parcial[\s\S]*RDC_BATCH_PARTIAL_MARKER[\s\S]*exit 1/, "lote parcial ainda aparece como sucesso no GitHub", ".github/workflows/sync-mercadolivre.yml");
const localizerWorkflow = await readFile(resolve(".github/workflows/localizar-mlb.yml"), "utf8");
const historyWorkflow = await readFile(resolve(".github/workflows/historico-precos.yml"), "utf8");
has(localizerWorkflow, /group:\s*rankingdacompra-publicacao/, "localizador MLB não compartilha a trava dos robôs publicadores", ".github/workflows/localizar-mlb.yml");
has(localizerWorkflow, /cron:\s*["']7,37 \* \* \* \*["']/, "localizador MLB ainda executa mais de duas vezes por hora", ".github/workflows/localizar-mlb.yml");
has(historyWorkflow, /group:\s*rankingdacompra-publicacao/, "histórico de preços não compartilha a trava dos robôs publicadores", ".github/workflows/historico-precos.yml");
const priceSync = await readFile(resolve("scripts/sync-mercadolivre.mjs"), "utf8");
has(priceSync, /function saoPauloDay\(value\)[\s\S]{0,120}value === undefined[\s\S]{0,120}return ""/, "lastBatchAt ausente ainda pode bloquear o primeiro lote do dia", "scripts/sync-mercadolivre.mjs");
has(priceSync, /function repairLegacyHiddenRecords\([\s\S]{0,500}status === "not_found"[\s\S]{0,500}itemDigits\.length < 10/, "falsos indisponíveis antigos não possuem migração segura", "scripts/sync-mercadolivre.mjs");
has(priceSync, /legacyRepair\.repaired[\s\S]{0,300}writeFile\(OUTPUT/, "reparo dos estados antigos não é persistido antes da leitura do Firebase", "scripts/sync-mercadolivre.mjs");
has(priceSync, /shouldTrustStoredItemId/, "proteção contra código de catálogo tratado como anúncio ausente", "scripts/sync-mercadolivre.mjs");
has(priceSync, /const direct = extractItemIdFromUrl\(value\);[\s\S]{0,80}if \(direct\) return direct;/, "wid do anúncio não tem prioridade sobre o cadastro antigo", "scripts/sync-mercadolivre.mjs");
has(priceSync, /shouldSkipDailyBatch/, "bloqueio contra repetição do lote no mesmo dia ausente", "scripts/sync-mercadolivre.mjs");
has(priceSync, /lastBatchAt:\s*batchComplete\s*\?\s*checkedAt/, "lote parcial ainda pode ser registrado como concluído", "scripts/sync-mercadolivre.mjs");
has(priceSync, /lastBatchAttemptAt:\s*checkedAt/, "horário da tentativa de lote ausente", "scripts/sync-mercadolivre.mjs");
has(priceSync, /batchSummary:\s*\{[\s\S]{0,280}confirmed:[\s\S]{0,140}failed:/, "resumo verificável do lote ausente", "scripts/sync-mercadolivre.mjs");
has(priceSync, /checkedAt:\s*relevantPrevious\.checkedAt\s*\|\|\s*""[\s\S]{0,90}lastAttemptAt:\s*checkedAt/, "falha temporária ainda pode renovar falsamente a confirmação", "scripts/sync-mercadolivre.mjs");
has(priceSync, /PRODUCT_SNAPSHOT[\s\S]{0,240}writeFile/, "snapshot único de produtos ausente", "scripts/sync-mercadolivre.mjs");
has(priceSync, /rejectedAccessTokenRefreshPromise/, "lote de preços não compartilha a renovação de token recusado", "scripts/sync-mercadolivre.mjs");
has(priceSync, /\[401, 403\]\.includes\(error\.httpStatus\)[\s\S]{0,180}refreshRejectedAccessToken\(\)/, "lote de preços não renova a autorização recusada", "scripts/sync-mercadolivre.mjs");
has(priceSync, /fetchMarketplaceCatalog\(catalogId\)/, "lote de preços não tenta o catálogo oficial quando o anúncio é bloqueado", "scripts/sync-mercadolivre.mjs");
has(priceSync, /catalogRecordFromPayload/, "lote de preços não interpreta o preço oficial do catálogo", "scripts/sync-mercadolivre.mjs");
has(priceSync, /recoverRetryableBulkOutcomes/, "lote de preços não recupera falhas temporárias do endpoint bulk", "scripts/sync-mercadolivre.mjs");
has(priceSync, /pending\.slice\(index, index \+ 5\)/, "contingência do Mercado Livre não reduz o lote temporariamente bloqueado", "scripts/sync-mercadolivre.mjs");
has(priceSync, /requestSingleMarketplaceItem/, "contingência individual oficial do Mercado Livre ausente", "scripts/sync-mercadolivre.mjs");
has(priceSync, /maxRetries:\s*1/, "contingência individual pode repetir chamadas excessivamente", "scripts/sync-mercadolivre.mjs");
has(sitemapGenerator, /readProductSnapshot/, "gerador ainda pode reler todos os produtos no mesmo lote", "scripts/generate-sitemap.mjs");
const affiliateResolver = await readFile(resolve("scripts/resolve-affiliate-links.mjs"), "utf8");
const marketplaceImage = await readFile(resolve("scripts/marketplace-image.mjs"), "utf8");
has(affiliateResolver, /documents:runQuery|\$\{FIRESTORE\}:runQuery/, "localizador ainda pode ler toda a fila MLB", "scripts/resolve-affiliate-links.mjs");
has(affiliateResolver, /limit:\s*10/, "consulta limitada da fila MLB ausente", "scripts/resolve-affiliate-links.mjs");
has(affiliateResolver, /fieldPath:\s*"criadoEm"[\s\S]{0,120}direction:\s*"DESCENDING"/, "fila MLB nao prioriza os pedidos mais recentes", "scripts/resolve-affiliate-links.mjs");
if (/\$\{FIRESTORE\}\/\$\{COLLECTION\}\?pageSize=300/.test(affiliateResolver)) {
  fail("scripts/resolve-affiliate-links.mjs: leitura integral de até 300 pedidos ainda está ativa");
}
has(affiliateResolver, /session\?\.accessToken\s*\|\|\s*session\?\.access_token/, "localizador não reconhece a sessão criptografada atual", "scripts/resolve-affiliate-links.mjs");
has(affiliateResolver, /session\?\.refreshToken\s*\|\|\s*session\?\.refresh_token/, "localizador não reconhece o refresh token atual", "scripts/resolve-affiliate-links.mjs");
has(affiliateResolver, /\[401, 403\]\.includes\(response\.status\)[\s\S]{0,160}accessToken\(true\)/, "localizador não renova a autorização recusada", "scripts/resolve-affiliate-links.mjs");
has(affiliateResolver, /MAX_REQUEST_ATTEMPTS\s*=\s*3/, "localizador sem limite de novas tentativas", "scripts/resolve-affiliate-links.mjs");
has(affiliateResolver, /previous\.status\s*===\s*"erro"[\s\S]{0,160}previous\.tentativas[\s\S]{0,100}MAX_REQUEST_ATTEMPTS/, "localizador não recupera erro temporário com limite", "scripts/resolve-affiliate-links.mjs");
has(affiliateResolver, /tentativas:\s*previousAttempts\s*\+\s*1/, "localizador não registra o número de tentativas", "scripts/resolve-affiliate-links.mjs");
has(affiliateResolver, /officialCatalogDetails\(catalogId/, "localizador não usa o catálogo oficial como alternativa", "scripts/resolve-affiliate-links.mjs");
has(affiliateResolver, /selectLoadableMarketplaceImage/, "localizador não comprova o carregamento da imagem", "scripts/resolve-affiliate-links.mjs");
has(affiliateResolver, /marketplaceImageCandidates\([\s\S]{0,180}item\.pictures/, "localizador não tenta as demais fotos oficiais", "scripts/resolve-affiliate-links.mjs");
has(affiliateResolver, /const verifiedPhoto = await selectLoadableMarketplaceImage/, "resultado MLB ainda pode guardar foto quebrada", "scripts/resolve-affiliate-links.mjs");
has(marketplaceImage, /contentType\.startsWith\("image\/"\)/, "verificação da foto não confirma o tipo de conteúdo", "scripts/marketplace-image.mjs");
has(marketplaceImage, /processing-image/, "imagem temporária de processamento do Mercado Livre não é descartada", "scripts/marketplace-image.mjs");

has(mobilePanelHtml, /idade\s*<\s*2\s*\*\s*60\s*\*\s*1000/, "painel celular ainda pode reutilizar pedido MLB antigo", "painel-celular.html");
has(mobilePanelHtml, /d\.dadosTecnicos\.length\s*<\s*70/, "validacao tecnica do painel celular esta desalinhada com o robo", "painel-celular.html");
has(mobilePanelHtml, /function carregarFotoPrevia\(/, "painel celular não testa a foto antes da revisão", "painel-celular.html");
has(mobilePanelHtml, /imagem\.onerror\s*=\s*\(\)\s*=>\s*concluir\(false\)/, "painel celular não reconhece imagem quebrada", "painel-celular.html");
has(mobilePanelHtml, /if\s*\(!fotoOk\)\s*throw Error\("A IA encontrou o produto,[\s\S]{0,120}robô oficial/, "painel celular não encaminha a imagem quebrada ao robô oficial", "painel-celular.html");
has(mobilePanelHtml, /if\s*\(!\(await carregarFotoPrevia\(d\.foto\)\)\)\s*return msg\("pub-status"/, "painel celular ainda pode publicar uma foto que não abriu", "painel-celular.html");

if (/collection\(["']visitas["']\)\.get\(\)/.test(dashboardHtml)) {
  fail("dashboard.html: leitura integral e ilimitada do histórico de visitas voltou a ser usada");
}
has(dashboardHtml, /obterMetricasPainel[\s\S]{0,1200}collection\(["']visitas["']\)\.where\(["']dia["'],\s*["']>=["']/, "consulta econômica compartilhada das métricas ausente", "dashboard.html");
const consultasRecentesVisitas = dashboardHtml.match(/collection\(["']visitas["']\)\.where\(["']dia["'],\s*["']>=["']/g) || [];
if (consultasRecentesVisitas.length !== 1) {
  fail("dashboard.html: deve existir exatamente uma consulta compartilhada do histórico recente de visitas");
}
has(dashboardHtml, /JANELA_METRICAS_PAINEL_DIAS\s*=\s*14/, "janela de 14 dias necessária para a comparação semanal ausente", "dashboard.html");
has(dashboardHtml, /tipo\s*=\s*['"]divergente['"]/, "painel não identifica divergência real de preço separadamente", "dashboard.html");
has(dashboardHtml, /tipo\s*\|\|\s*['"]nao_confirmado['"]/, "painel não identifica verificação temporariamente inconclusiva", "dashboard.html");
has(dashboardHtml, /pendente:\s*tipo\s*===\s*['"]divergente['"]/, "painel ainda inclui bloqueios temporários na fila de correções", "dashboard.html");
has(dashboardHtml, /diagnostico\.tipo\s*===\s*['"]nao_confirmado['"][\s\S]{0,80}verificacoesNaoConcluidas\s*\+=\s*1/, "painel não contabiliza separadamente as consultas inconclusivas", "dashboard.html");
has(dashboardHtml, /status\?\.itemId\s*\|\|\s*status\?\.catalogId/, "painel ignora o identificador oficial de catálogo", "dashboard.html");
has(dashboardHtml, /Preços realmente divergentes:[\s\S]{0,220}Verificações não concluídas:/, "resumo de preços ainda mistura divergências com bloqueios temporários", "dashboard.html");
has(dashboardHtml, /Conferência parcial:[\s\S]{0,300}bloqueio de acesso do Mercado Livre/, "painel não avisa quando o lote termina parcialmente", "dashboard.html");
has(dashboardHtml, /\.item-admin\.item-preco\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*24px minmax\(0,\s*1fr\)/, "cartão de preço pode voltar a esmagar o título do produto", "dashboard.html");

const sitemap = await readFile(resolve("sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
const uniqueUrls = new Set(urls);
if (!urls.length) fail("sitemap.xml: nenhum endereço encontrado");
if (uniqueUrls.size !== urls.length) fail("sitemap.xml: existem endereços duplicados");
for (const expectedGuide of [
  "melhores-fones-de-ouvido.html",
  "melhores-cameras-de-seguranca.html",
  "melhores-caixa-de-som.html",
  "melhores-smart-tv.html",
]) {
  if (!uniqueUrls.has(SITE + expectedGuide)) fail("sitemap.xml: comparativo público desapareceu: " + expectedGuide);
}
if (urls.some((url) => /melhores-(?:fonesdeouvido|camerasdeseguranca|caixadesom|smarttv)\.html/.test(url))) {
  fail("sitemap.xml: identificador interno sem hífens foi publicado como URL");
}

const identities = new Map();
for (const url of urls) {
  if (!url.startsWith(SITE)) { fail("Domínio inesperado no sitemap: " + url); continue; }
  if (!url.startsWith(SITE + "produto/")) continue;
  const relative = decodeURIComponent(url.slice(SITE.length));
  let html = "";
  try { html = await readFile(resolve(relative), "utf8"); }
  catch { fail(relative + ": arquivo informado no sitemap não existe"); continue; }

  has(html, /<title>[^<]{10,}<\/title>/i, "título ausente ou curto", relative);
  has(html, /<meta\s+name="description"\s+content="[^"]{50,}"/i, "descrição ausente ou curta", relative);
  has(html, /<meta\s+property="og:image"\s+content="https:\/\/rankingdacompra\.com\.br\/produto\/imagens\/[^"]+"/i, "imagem social local ausente", relative);
  has(html, /"@type":"Product"/i, "dados estruturados de produto ausentes", relative);
  if (!html.includes('rel="canonical" href="' + url + '"')) fail(relative + ": endereço canônico divergente");
  if (/name="robots"\s+content="[^"]*noindex/i.test(html)) fail(relative + ": página do sitemap marcada como noindex");
  if (html.includes("\uFFFD")) fail(relative + ": caractere corrompido encontrado");
  if (/<li>\s*[a-záàâãéêíóôõúüç]/u.test(html)) fail(relative + ": item editorial iniciado como fragmento de frase");
  if (/<li>[^<]*(?:\.,|,\.)[^<]*<\/li>/u.test(html)) fail(relative + ": pontuação editorial duplicada encontrada");
  const visibleH1 = (html.match(/<h1>([^<]+)<\/h1>/i)?.[1] || "")
    .replace(/&#\d+;|&[a-z]+;/gi, "x");
  if (visibleH1.length > 100) fail(relative + ": título visível maior que 100 caracteres");
  const structuredOffer = /"offers":(?:\{"@type":"Offer"|\[\{"@type":"Offer")/.test(html);
  const unconfirmedPrice = /<strong>(?:Último preço registrado em [^<]+|Preço a confirmar no vendedor)<\/strong>/i.test(html);
  if (!structuredOffer && !unconfirmedPrice) {
    fail(relative + ": oferta estruturada ou aviso de preço não confirmado ausente");
  }
  if (structuredOffer && !/"priceCurrency":"BRL"/.test(html)) {
    fail(relative + ": oferta estruturada sem moeda BRL");
  }
  has(html, /data-mobile-product-buy/, "ordem móvel protegida ausente", relative);
  has(html, /id="mobile-affiliate-offer"/, "botão fixo de preço ausente no celular", relative);
  has(html, /growth-tools\.js\?v=(?:20260913-seo1|20260919-video1|20260919-video2|20260919-title-ai1|20260919-video-min3|20260919-video-fields1|20260919-title-fallback1|20260919-title-fallback2|20260919-video-overlay1|20260919-metrics-compat1|20260920-config-sync1|20260923-manual-price1)/, "versão visual desconhecida carregada", relative);

  for (const identity of productIdentityKeys(html)) {
    const previous = identities.get(identity);
    if (previous && previous !== relative) {
      fail("Produto duplicado (" + identity + "): " + previous + " e " + relative);
    } else {
      identities.set(identity, relative);
    }
  }
}

const directoryHtml = await readFile(resolve("analises.html"), "utf8");
if (/\b(?:ablet HUAWEI|mpressora 3x1)\b/i.test(directoryHtml)) fail("analises.html: título conhecido ainda está truncado");
if (/\b(?:T{2,}Tablet HUAWEI|I{2,}Impressora 3x1)\b/u.test(directoryHtml)) fail("analises.html: correção de título foi aplicada mais de uma vez");
if ((directoryHtml.match(/Celimax Retinal Shot Tightening Booster 15ml Pele Corean/g) || []).length > 1) {
  fail("analises.html: título repetido do produto Celimax ainda está presente");
}
const directoryUrls = new Set(
  [...directoryHtml.matchAll(/href=["'](https:\/\/rankingdacompra\.com\.br\/produto\/[^"'?#]+)["']/gi)]
    .map((match) => match[1]),
);
const sitemapProductUrls = new Set(urls.filter((url) => url.startsWith(SITE + "produto/")));
const searchIndex = JSON.parse(await readFile(resolve("search-index.json"), "utf8"));
const searchProducts = Array.isArray(searchIndex.products) ? searchIndex.products : [];
if (searchProducts.length !== sitemapProductUrls.size) {
  fail("search-index.json: possui " + searchProducts.length + " produtos, mas o sitemap possui " + sitemapProductUrls.size);
}
const searchUrls = new Set();
for (const product of searchProducts) {
  if (!String(product?.title || "").trim()) fail("search-index.json: produto sem título");
  if (String(product?.summary || "").trim().length < 180) fail("search-index.json: resumo editorial curto em " + (product?.id || "produto desconhecido"));
  if (!sitemapProductUrls.has(product?.url)) fail("search-index.json: endereço fora do sitemap: " + product?.url);
  if (searchUrls.has(product?.url)) fail("search-index.json: endereço duplicado: " + product?.url);
  if (Number(product?.ranking) !== 0) fail("search-index.json: posição não aprovada exposta na busca: " + (product?.id || "produto desconhecido"));
  searchUrls.add(product?.url);
}

const guideFiles = (await readdir(resolve("."))).filter((file) => /^melhores-.+\.html$/.test(file));
if (guideFiles.length < 1) fail("comparativos automáticos: nenhuma página foi gerada");
for (const file of guideFiles) {
  const html = await readFile(resolve(file), "utf8");
  has(html, new RegExp(`<link rel="canonical" href="${SITE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">`), "endereço canônico incorreto", file);
  has(html, /🏆 Melhor geral/, "destaque de melhor geral ausente", file);
  has(html, /💚 Melhor custo-benefício/, "destaque de custo-benefício ausente", file);
  has(html, /💰 Mais barato/, "destaque de menor preço ausente", file);
  has(html, /Por que está nesta posição:/, "justificativa de posição ausente", file);
  has(html, /Não é a melhor escolha para:/, "limitação prática ausente", file);
  has(html, /<table>/, "tabela de comparação rápida ausente", file);
  has(html, /<h2>Como classificamos<\/h2>/, "metodologia resumida ausente", file);
  if (/\bNaN\b/.test(html)) fail(file + ": preço ou pontuação inválida aparece como NaN");
  if (!urls.includes(SITE + file)) fail(file + ": comparativo ausente do sitemap");
}

const correctedScooter = await readFile(resolve("produto/6kC1jJj7i4kRtYyp3SZr-20260810-1.html"), "utf8");
has(correctedScooter, /Patinete Elétrico Ydtech M187 Dobrável com Bluetooth/, "título genérico do patinete ainda aparece", "produto/6kC1jJj7i4kRtYyp3SZr-20260810-1.html");
if (/1\.0 de 5/.test(correctedScooter)) fail("produto/6kC1jJj7i4kRtYyp3SZr-20260810-1.html: nota contraditória ainda aparece");
const correctedScooterYoyo = await readFile(resolve("produto/VyYiww5HVcBRIH8SD5SD-20260810-1.html"), "utf8");
if (/1\.0 de 5/.test(correctedScooterYoyo)) fail("produto/VyYiww5HVcBRIH8SD5SD-20260810-1.html: nota contraditória ainda aparece");
for (const url of directoryUrls) {
  if (!sitemapProductUrls.has(url)) {
    fail("analises.html: produto fora do sitemap ou sem página publicada: " + url);
    continue;
  }
  const relative = decodeURIComponent(url.slice(SITE.length));
  try { await readFile(resolve(relative), "utf8"); }
  catch { fail("analises.html: link para arquivo inexistente: " + relative); }
}
if (directoryUrls.size !== sitemapProductUrls.size) {
  fail(
    "analises.html: catálogo possui " + directoryUrls.size +
    " produtos, mas o sitemap possui " + sitemapProductUrls.size,
  );
}

const methodHtml = await readFile(resolve("como-avaliamos.html"), "utf8");
has(methodHtml, /Custo-benefício — 35%/, "peso de custo-benefício ausente da metodologia pública", "como-avaliamos.html");
has(methodHtml, /Avaliação informada — 30%/, "peso de avaliação ausente da metodologia pública", "como-avaliamos.html");
has(methodHtml, /Interesse observado — 15%/, "peso de interesse ausente da metodologia pública", "como-avaliamos.html");
has(methodHtml, /Qualidade das evidências — 20%/, "peso de evidências ausente da metodologia pública", "como-avaliamos.html");
has(methodHtml, /não tratamos cliques como vendas/i, "limite editorial sobre cliques ausente", "como-avaliamos.html");
has(methodHtml, /Uma segunda IA audita/, "auditoria por IA não está explicada ao público", "como-avaliamos.html");
has(methodHtml, /não altera silenciosamente a ordem calculada/i, "limite da IA sobre a classificação ausente", "como-avaliamos.html");

for (const file of ["como-avaliamos.html", "sobre.html", "politica-afiliados.html", "privacidade.html", "contato.html"]) {
  const html = await readFile(resolve(file), "utf8");
  has(html, /property="og:image"\s+content="https:\/\/rankingdacompra\.com\.br\/og-ranking-da-compra\.png"/i, "imagem social ausente", file);
  has(html, /property="og:url"\s+content="https:\/\/rankingdacompra\.com\.br\//i, "endereço social ausente", file);
  has(html, /property="og:title"\s+content="[^"]+"/i, "título social ausente", file);
  has(html, /property="og:description"\s+content="[^"]+"/i, "descrição social ausente", file);
  has(html, /name="twitter:card"\s+content="summary_large_image"/i, "cartão social do Twitter ausente", file);
  has(html, /name="twitter:title"\s+content="[^"]+"/i, "título do Twitter ausente", file);
  has(html, /name="twitter:description"\s+content="[^"]+"/i, "descrição do Twitter ausente", file);
}

const notFoundHtml = await readFile(resolve("404.html"), "utf8");
has(notFoundHtml, /name="robots" content="noindex,follow"/, "página 404 deve ficar fora do índice e preservar a descoberta", "404.html");
has(notFoundHtml, /href="\/analises\.html"/, "página 404 não oferece caminho para as análises atuais", "404.html");

const weeklyTop = JSON.parse(await readFile(resolve("top5-semanal.json"), "utf8"));
const weeklyProducts = Array.isArray(weeklyTop.products) ? weeklyTop.products : [];
if (weeklyProducts.length !== 6) fail("top5-semanal.json: o Top 6 precisa conter exatamente 6 produtos válidos");
const weeklyIds = new Set();
for (const product of weeklyProducts) {
  const id = String(product?.id || "").trim();
  if (!id) fail("top5-semanal.json: produto sem identificador");
  else if (weeklyIds.has(id)) fail("top5-semanal.json: produto duplicado no Top 6: " + id);
  else weeklyIds.add(id);
  if (!String(product?.titulo || "").trim()) fail("top5-semanal.json: produto sem título: " + (id || "desconhecido"));
  if (!String(product?.foto || "").startsWith("https://")) fail("top5-semanal.json: produto sem imagem segura: " + (id || "desconhecido"));
  if (!String(product?.productUrl || "").startsWith(SITE + "produto/")) fail("top5-semanal.json: página de produto inválida: " + (id || "desconhecido"));
  if (!String(product?.linkAfiliado || "").startsWith("https://")) fail("top5-semanal.json: link de afiliado inválido: " + (id || "desconhecido"));
  const price = Number(String(product?.precoPromocional || product?.preco || "0").replace(/\./g, "").replace(",", "."));
  if (!(price > 0)) fail("top5-semanal.json: preço inválido: " + (id || "desconhecido"));
}

if (errors.length) {
  console.error("\nValidação bloqueou a publicação:");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}

console.log("Validação concluída: " + urls.length + " URLs, " + sitemapProductUrls.size + " produtos públicos e metadados sociais completos.");

