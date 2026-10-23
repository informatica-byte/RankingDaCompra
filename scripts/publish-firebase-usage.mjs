import { readFile } from 'node:fs/promises';
export const ROOT = 'https://api.github.com/repos/informatica-byte/RankingDaCompra';
export const BRANCH = 'metricas-consumo-firebase';
export function validateUsage(data) {
  if (!data || Object.keys(data).sort().join(',') !== 'at,reads' || !Number.isSafeInteger(data.reads)
      || data.reads < 0 || typeof data.at !== 'string' || !Number.isFinite(Date.parse(data.at))) throw Error('Arquivo público inválido.');
  return { reads: data.reads, at: new Date(data.at).toISOString() };
}
export async function publishUsage({ data, token, request = fetch }) {
  const safe = validateUsage(data);
  if (!token || /[\r\n]/.test(token)) throw Error('Identidade GitHub temporária ausente.');
  async function api(path, method = 'GET', body) {
    const response = await request(ROOT + path, { method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'rankingdacompra-usage', 'X-GitHub-Api-Version': '2022-11-28' },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (method === 'GET' && response.status === 404) return null;
    if (!response.ok) throw Error('Publicação do agregado: HTTP ' + response.status);
    return response.json();
  }
  const reference = await api('/git/ref/heads/' + BRANCH);
  const content = JSON.stringify(safe, null, 2) + '\n';
  if (reference) {
    const previous = await api('/contents/firebase-consumo.json?ref=' + BRANCH);
    if (previous?.content && Buffer.from(previous.content, 'base64').toString('utf8') === content) return false;
  }
  const blob = await api('/git/blobs', 'POST', { content, encoding: 'utf-8' });
  // Árvore de um único arquivo. Nunca replica o catálogo ou os arquivos do site.
  const tree = await api('/git/trees', 'POST', { tree: [{ path: 'firebase-consumo.json', mode: '100644', type: 'blob', sha: blob.sha }] });
  const commit = await api('/git/commits', 'POST', { message: 'Atualiza total agregado de leituras', tree: tree.sha, parents: reference ? [reference.object.sha] : [] });
  if (reference) await api('/git/refs/heads/' + BRANCH, 'PATCH', { sha: commit.sha, force: false });
  else await api('/git/refs', 'POST', { ref: 'refs/heads/' + BRANCH, sha: commit.sha });
  return true;
}
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/publish-firebase-usage.mjs')) {
  try {
    await publishUsage({ data: JSON.parse(await readFile('.firebase-usage-public.json', 'utf8')), token: process.env.GITHUB_TOKEN });
    console.log('Arquivo agregado verificado/publicado na branch exclusiva, sem reconstruir o site.');
  } catch (_) { console.error('Falha ao publicar agregado; arquivo anterior preservado.'); process.exitCode = 1; }
}
