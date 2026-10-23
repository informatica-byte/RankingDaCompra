export const METRIC = 'firestore.googleapis.com/document/read_ops_count';
export const ENDPOINT = 'https://monitoring.googleapis.com/v3/projects/rankingdacompra/timeSeries';
const ZONE = 'America/Los_Angeles';
const parts = date => Object.fromEntries(new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
}).formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
export function quotaStart(now) {
  const p = parts(now), wall = Date.UTC(p.year, p.month - 1, p.day);
  let guess = wall;
  for (let n = 0; n < 3; n++) {
    const z = parts(new Date(guess));
    const offset = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second) - guess;
    guess = wall - offset;
  }
  return new Date(guess);
}
export function metricRequest(now = new Date()) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('filter', `metric.type="${METRIC}" AND resource.type="firestore.googleapis.com/Database" AND resource.labels.database_id="(default)"`);
  url.searchParams.set('interval.startTime', quotaStart(now).toISOString());
  url.searchParams.set('interval.endTime', now.toISOString());
  url.searchParams.set('aggregation.alignmentPeriod', '60s');
  url.searchParams.set('aggregation.perSeriesAligner', 'ALIGN_SUM');
  url.searchParams.set('aggregation.crossSeriesReducer', 'REDUCE_SUM');
  url.searchParams.set('view', 'FULL');
  url.searchParams.set('pageSize', '2000');
  return url;
}
export function publicUsage(payload, now = new Date()) {
  if (!payload || payload.error || payload.nextPageToken || !Array.isArray(payload.timeSeries)
      || payload.timeSeries.length !== 1) throw Error('Métrica ausente, parcial ou não agregada; último total preservado.');
  const series = payload.timeSeries[0];
  if (series.metric?.type !== METRIC || series.metricKind !== 'DELTA' || series.valueType !== 'INT64' || !Array.isArray(series.points)
      || series.points.length === 0 || series.points.length > 1500) throw Error('Formato da métrica não confirmado.');
  let reads = 0, at = 0;
  const seen = new Set(), start = quotaStart(now).getTime();
  for (const point of series.points) {
    const end = Date.parse(point.interval?.endTime), from = Date.parse(point.interval?.startTime);
    const raw = point.value?.int64Value;
    if (!/^\d+$/.test(String(raw)) || !Number.isSafeInteger(Number(raw))
        || !Number.isFinite(end) || !Number.isFinite(from) || end <= from || from < start
        || end > now.getTime() || seen.has(end)) throw Error('Amostra da métrica inválida; último total preservado.');
    seen.add(end); reads += Number(raw); at = Math.max(at, end);
  }
  if (!Number.isSafeInteger(reads)) throw Error('Total de leituras fora do intervalo seguro.');
  // Nada de IDs, séries, nomes de conta, cabeçalhos ou corpos de erro no arquivo.
  return { reads, at: new Date(at).toISOString() };
}
export async function collectUsage({ token, now = new Date(), request = fetch } = {}) {
  if (!token || /[\r\n]/.test(token)) throw Error('Token temporário de métricas ausente ou inválido.');
  const response = await request(metricRequest(now), {
    method: 'GET', headers: { authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    let reason = '';
    try {
      const body = await response.json();
      const reasons = (body.error?.details || []).map(detail => detail.reason);
      if (reasons.some(value => ['BILLING_DISABLED', 'BILLING_NOT_ACTIVE', 'BILLING_REQUIRED'].includes(value))
          || /billing|faturamento|cobrança/i.test(String(body.error?.message || ''))) reason = ' BILLING_REQUIRED: parar; cobrança não autorizada.';
      else if (reasons.includes('SERVICE_DISABLED')) reason = ' SERVICE_DISABLED: API não será ativada automaticamente.';
    } catch (_) {}
    throw Error(`Consulta de métricas HTTP ${response.status};${reason} último total preservado, sem retentativa automática.`);
  }
  return publicUsage(await response.json(), now);
}
