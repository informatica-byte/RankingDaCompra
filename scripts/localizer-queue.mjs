export const PAGE_SIZE = 10;

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
