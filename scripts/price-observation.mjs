// O histórico registra a observação, não a execução do gerador.
export function observationFromHtml(html, price, now = Date.now()) {
  const meta = name => String(html).match(new RegExp(`<meta\\b[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))?.[1] || '';
  const selected = meta('rdc-price-checked-at');
  const manualPrice = Number(meta('rdc-manual-price'));
  const checkedAt = selected || (Math.abs(manualPrice - price) < 0.005 ? meta('rdc-manual-checked-at') : '');
  const timestamp = Date.parse(checkedAt);
  if (!price || !Number.isFinite(timestamp) || timestamp > now) return null;
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp));
  const proofVersion = Number(meta('rdc-price-proof-version')) || 0;
  const source = selected ? meta('rdc-price-source') || 'confirmed' : 'manual';
  const verified = source === 'api' || proofVersion >= 3 || meta('rdc-price-reviewed') === 'true';
  return { date, checkedAt: new Date(timestamp).toISOString(), source, price, proofVersion, verified, offerUrl: meta('rdc-offer-url') };
}

export function addObservation(current, observation) {
  const points = Array.isArray(current.points) ? current.points.map(point => [...point]) : [];
  if (!observation) return { ...current, points };
  const previous = current.observations?.[observation.date];
  if (previous && Date.parse(previous.checkedAt) > Date.parse(observation.checkedAt)) return { ...current, points };
  const remaining = points.filter(point => String(point[0]) !== observation.date);
  remaining.push([observation.date, observation.price]);
  remaining.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return { ...current, points: remaining, observations: { ...(current.observations || {}), [observation.date]: { checkedAt: observation.checkedAt, source: observation.source, verified: observation.verified === true, proofVersion: observation.proofVersion || 0, offerUrl: observation.offerUrl || '' } } };
}
