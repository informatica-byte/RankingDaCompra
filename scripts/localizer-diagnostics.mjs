// Somente metadados seguros; nunca registrar corpo da API, headers ou mensagens
// arbitrárias de exceções, que podem conter URLs, tokens ou credenciais.
const STAGES = new Set(['pagina', 'espelho', 'navegador', 'anuncio', 'catalogo', 'imagem']);
const FIELDS = { titulo: 'título', preco: 'preço válido', imagem: 'imagem válida' };

export function recordResponse(diagnostic, stage, response) {
  const status = Number(response?.status);
  if (diagnostic && STAGES.has(stage) && Number.isInteger(status) && status >= 100 && status <= 599) {
    diagnostic.events.push({ stage, http: status });
  }
}

export function recordNetworkFailure(diagnostic, stage, error) {
  if (diagnostic && STAGES.has(stage)) diagnostic.events.push({ stage, failure: /^(TimeoutError|AbortError)$/.test(error?.name) ? 'timeout' : error?.name === 'SyntaxError' ? 'dados_invalidos' : 'rede' });
}

export function recordPageChallenge(diagnostic, html) {
  const markup = String(html || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const text = markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  if (/confirme que voce|verify you are human|verifique se voce|robot check|robot_check/i.test(text)
    || /<title\b[^>]*>[^<]*(?:captcha|robot)/i.test(markup)
    || /<form\b[^>]*action=["'][^"']*(?:captcha|robot_check)/i.test(markup)) diagnostic.challenge = true;
}

export function safeDiagnostic(input = {}) {
  const events = (Array.isArray(input.events) ? input.events : []).flatMap(event => {
    if (!STAGES.has(event?.stage)) return [];
    if (Number.isInteger(event.http) && event.http >= 100 && event.http <= 599) return [{ stage: event.stage, http: event.http }];
    return ['timeout', 'rede', 'dados_invalidos'].includes(event.failure) ? [{ stage: event.stage, failure: event.failure }] : [];
  }).slice(-32);
  const missingFields = (Array.isArray(input.missingFields) ? input.missingFields : []).filter(field => Object.hasOwn(FIELDS, field));
  return { version: 1, identified: input.identified === true, challenge: input.challenge === true, missingFields: [...new Set(missingFields)], events };
}

export function diagnosticReason(input = {}) {
  const diagnostic = safeDiagnostic(input);
  const lines = [diagnostic.identified
    ? `Anúncio identificado; faltam ${diagnostic.missingFields.map(field => FIELDS[field]).join(', ') || 'dados obrigatórios'}.`
    : 'O link não retornou um anúncio identificável.'];
  const http = [...new Set(diagnostic.events.filter(event => event.http >= 400).map(event => `${event.stage}: HTTP ${event.http}`))];
  if (http.length) lines.push(http.join('; ') + '.');
  if (diagnostic.events.some(event => event.failure === 'timeout')) lines.push('Houve tempo limite de consulta.');
  else if (diagnostic.events.some(event => event.failure === 'rede')) lines.push('Houve falha de rede/navegador.');
  if (diagnostic.events.some(event => event.failure === 'dados_invalidos')) lines.push('A API retornou dados em formato inválido.');
  if (diagnostic.challenge) lines.push('A página mostrou indício de verificação humana; não foi contornada.');
  lines.push('Confira o anúncio no navegador e complete os campos manualmente no painel.');
  return lines.join(' ');
}

export class LocalizerError extends Error {
  constructor(diagnostic) {
    const safe = safeDiagnostic(diagnostic);
    super(diagnosticReason(safe));
    this.name = 'LocalizerError';
    this.diagnostic = safe;
  }
}

// Remover SOMENTE rastreamento conhecido. Variante, cupom, vendedor e demais
// parâmetros desconhecidos permanecem: preços de versões diferentes não se misturam.
const TRACKING = /^(utm_.+|matt_.+|tracking_id|deal_print_id|polycard_client|position|sid)$/i;
export function resolutionKey(link) {
  try {
    const url = new URL(String(link));
    if (url.protocol !== 'https:' || !/^(?:[\w-]+\.)*(?:mercadolivre\.com\.br|mercadolibre\.com|meli\.la)$/i.test(url.hostname)) return String(link);
    // Em indicação/lista/link curto a posição e a query podem escolher o item.
    // Sem identidade explícita, reaproveitar apenas a URL completa idêntica.
    if (!/(?:\/p\/|\/)(?:MLB-?\d{6,})(?:-|\/|$)/i.test(url.pathname)) return url.href;
    for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    if (url.hash.includes('=')) {
      const hash = new URLSearchParams(url.hash.slice(1));
      for (const key of [...hash.keys()]) if (TRACKING.test(key)) hash.delete(key);
      hash.sort();
      url.hash = hash.toString() ? '#' + hash.toString() : '';
    }
    return url.href;
  } catch { return String(link); }
}

export async function resolveQueuedRequests(queue, results, resolveRequest, { now = () => new Date().toISOString(), onResult = () => {} } = {}) {
  const cache = new Map();
  let reused = 0;
  for (const request of queue) {
    const previousAttempts = Number(results[request.id]?.tentativas || 0);
    const key = resolutionKey(request.link);
    let shared = cache.get(key);
    if (!shared) {
      try { shared = { sourceId: request.id, sourceLink: request.link, result: await resolveRequest(request) }; }
      catch (error) { shared = { sourceId: request.id, sourceLink: request.link, result: { status: 'erro', motivo: diagnosticReason(error?.diagnostic), diagnostico: safeDiagnostic(error?.diagnostic) } }; }
      cache.set(key, shared);
    } else reused += 1;
    const result = { ...shared.result, linkOriginal: request.link, resolvidoEm: now(), tentativas: previousAttempts + 1 };
    if (shared.sourceId !== request.id) {
      result.reaproveitadoDe = shared.sourceId;
      if (result.urlProduto === shared.sourceLink) result.urlProduto = request.link;
    }
    results[request.id] = result;
    onResult(request, result);
  }
  return { uniqueQueries: cache.size, reused };
}

export function diagnosticTable(queue, results) {
  return '| Pedido | Resultado | Detalhe |\n|---|---|---|\n' + queue.map(request => {
    const result = results[request.id];
    const id = String(request.id).replace(/[^\w-]/g, '').slice(0, 128);
    const detail = result?.status === 'ok' ? 'Dados obtidos para revisão no painel.' : diagnosticReason(result?.diagnostico);
    return `| ${id} | ${result?.status === 'ok' ? 'Obtido' : 'Não obtido'}${result?.reaproveitadoDe ? ' (reaproveitado)' : ''} | ${detail} |`;
  }).join('\n') + '\n';
}
