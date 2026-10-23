import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

// Cache efêmero de respostas bem-sucedidas, exclusivo de uma execução/tentativa
// do GitHub. Não é restaurado entre publicações e não armazena credenciais.
export function createFirestoreReadCache({ env = process.env, request = globalThis.fetch, now = Date.now } = {}) {
  const stats = { requests: 0, documents: 0, reusedRequests: 0, reusedDocuments: 0, failures: 0 };
  const pending = new Map();
  const scope = `${env.GITHUB_RUN_ID || ''}-${env.GITHUB_RUN_ATTEMPT || ''}`;
  const directory = env.RUNNER_TEMP && env.RDC_FIRESTORE_READ_CACHE_SCOPE === scope
    && /^\d+-\d+$/.test(scope) ? join(env.RUNNER_TEMP, 'rdc-firestore-read-' + scope) : '';
  function eligible(url, options) {
    const parsed = new URL(url);
    return directory && String(options.method || 'GET').toUpperCase() === 'GET'
      && parsed.origin === 'https://firestore.googleapis.com'
      && /^\/v1\/projects\/rankingdacompra\/databases\/\(default\)\/documents\/(?:produtos|categorias|configuracoes(?:\/(?:site|ranking-semanal))?)$/.test(parsed.pathname);
  }
  function count(payload) { return Array.isArray(payload?.documents) ? payload.documents.length : payload?.name && payload?.fields ? 1 : 0; }
  async function read(url, options = {}) {
    // A validação de identidade/destino ocorre antes de chegar a este leitor.
    const cacheable = eligible(url, options);
    const identity = new URL(url); identity.searchParams.delete('key');
    const key = createHash('sha256').update(identity.href).digest('hex');
    if (cacheable && pending.has(key)) {
      const result = await pending.get(key); stats.reusedRequests++;
      return result.clone();
    }
    const operation = (async () => {
      const file = directory && join(directory, key + '.json');
      if (cacheable) try {
        const saved = JSON.parse(await readFile(file, 'utf8'));
        const age = now() - saved.at;
        if (saved.version === 1 && saved.scope === scope && age >= 0 && age < 15 * 60 * 1000
            && saved.hash === createHash('sha256').update(JSON.stringify(saved.payload)).digest('hex')) {
          stats.reusedRequests++; stats.reusedDocuments += count(saved.payload);
          return Response.json(saved.payload);
        }
      } catch (_) { /* Arquivo ausente/inválido nunca substitui uma leitura nova. */ }
      stats.requests++;
      let response;
      try { response = await request(url, options); }
      catch (error) { stats.failures++; throw error; }
      if (!response.ok) { stats.failures++; return response; }
      let payload;
      try { payload = await response.clone().json(); } catch (_) { return response; }
      stats.documents += count(payload);
      if (cacheable && payload && !payload.error
          && (Array.isArray(payload.documents) || payload.fields || Object.keys(payload).length === 0)) try {
        await mkdir(directory, { recursive: true });
        const saved = { version: 1, scope, at: now(), payload,
          hash: createHash('sha256').update(JSON.stringify(payload)).digest('hex') };
        const temporary = file + '.' + process.pid + '.tmp';
        await writeFile(temporary, JSON.stringify(saved), { mode: 0o600 });
        await rename(temporary, file);
      } catch (_) { /* Falta de cache não pode impedir uma publicação válida. */ }
      return response;
    })();
    if (cacheable) pending.set(key, operation);
    try { return (await operation).clone(); }
    finally { if (pending.get(key) === operation) pending.delete(key); }
  }
  return { read, summary: () => ({ ...stats }), enabled: Boolean(directory) };
}
