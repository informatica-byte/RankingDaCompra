// Tokens de execução curta fornecidos por WIF. Nunca lê chaves privadas,
// grava credenciais, envia tokens a terceiros ou tenta acesso anônimo após 403.
export function firestoreReadRequest(url, options = {}, env = process.env) {
  const target = new URL(url);
  const root = '/v1/projects/rankingdacompra/databases/(default)/documents';
  if (target.origin !== 'https://firestore.googleapis.com' || target.username || target.password
      || !(target.pathname.startsWith(root + '/') || target.pathname === root + ':runQuery')) {
    throw new Error('Destino Firestore não autorizado para a identidade dos jobs');
  }
  const method = String(options.method || 'GET').toUpperCase();
  if (!(method === 'GET' || (method === 'POST' && target.pathname === root + ':runQuery'))) {
    throw new Error('Identidade dos jobs permite apenas leitura');
  }
  const token = String(env.RDC_FIRESTORE_ACCESS_TOKEN || '').trim();
  if (String(env.RDC_FIRESTORE_AUTH_REQUIRED).toLowerCase() === 'true' && !token) {
    throw new Error('Identidade Firestore obrigatória não foi disponibilizada; acesso público não será tentado');
  }
  if (/[\r\n]/.test(token)) throw new Error('Token Firestore inválido');
  const headers = new Headers(options.headers);
  if (token) {
    if (headers.has('authorization')) throw new Error('Credencial Firestore duplicada');
    headers.set('authorization', 'Bearer ' + token);
    target.searchParams.delete('key');
  }
  return {url: target.href, options: {...options, method, headers, redirect: 'error'}};
}

export function fetchFirestoreRead(url, options = {}) {
  const request = firestoreReadRequest(url, options);
  return fetch(request.url, request.options);
}
