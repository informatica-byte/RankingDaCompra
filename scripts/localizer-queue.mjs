export const PAGE_SIZE = 10;
export const QUEUE_QUOTA_BACKOFF_MS = 2 * 60 * 60 * 1000;

// Metadados públicos e limitados: nenhum corpo de erro, URL ou credencial.
// Um estado inválido/futuro demais nunca impede a fila indefinidamente.
export function queueQuotaRetry(state, now = Date.now()) {
  const failure = state?.readFailure;
  const at = Date.parse(failure?.at), retry = Date.parse(failure?.retryAfter);
  if (failure?.http !== 429 || !Number.isFinite(at) || !Number.isFinite(retry)
    || at > now || retry <= now || retry - at !== QUEUE_QUOTA_BACKOFF_MS) return null;
  return { http: 429, at: new Date(at).toISOString(), retryAfter: new Date(retry).toISOString() };
}

export function queueQuotaFailure(now = Date.now()) {
  return { http: 429, at: new Date(now).toISOString(), retryAfter: new Date(now + QUEUE_QUOTA_BACKOFF_MS).toISOString() };
}

export function resolutionSummary(ids, results, maxAttempts = 3) {
  const current = ids.map(id => results[id]).filter(Boolean);
  return {
    processed: current.length,
    succeeded: current.filter(result => result.status === 'ok').length,
    failed: current.filter(result => result.status === 'erro').length,
    exhausted: Object.values(results).filter(result => result.status === 'erro'
      && Number(result.tentativas || 0) >= maxAttempts).length,
  };
}

export function queueQuery(cursor = null) {
  return { structuredQuery: {
    from: [{ collectionId: 'mlbSolicitacoes' }],
    orderBy: [{ field: { fieldPath: 'criadoEm' }, direction: 'DESCENDING' }, { field: { fieldPath: '__name__' }, direction: 'DESCENDING' }],
    limit: PAGE_SIZE,
    ...(cursor ? { startAt: { values: cursor, before: false } } : {}),
  } };
}

export function nextCursor(documents) {
  const last = documents.at(-1);
  if (documents.length < PAGE_SIZE || !last?.fields?.criadoEm) return null;
  return [last.fields.criadoEm, { referenceValue: last.name }];
}

export function pendingRequests(requests, results, maxAttempts = 3) {
  return requests.filter(request => request.status === 'pendente' && request.link)
    .filter(request => !results[request.id] || (results[request.id].status === 'erro' && Number(results[request.id].tentativas || 0) < maxAttempts))
    .sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm))).slice(0, PAGE_SIZE);
}
