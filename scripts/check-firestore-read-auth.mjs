import {fetchFirestoreRead} from './firestore-read-auth.mjs';
const base='https://firestore.googleapis.com/v1/projects/rankingdacompra/databases/(default)/documents';
if (!process.env.RDC_FIRESTORE_ACCESS_TOKEN || process.env.RDC_FIRESTORE_AUTH_REQUIRED !== 'true') {
  throw new Error('O diagnóstico exige identidade autenticada, não consulta pública');
}
for (const [name,url,options] of [
  ['produtos',base+'/produtos?pageSize=1',{}],
  ['configuração',base+'/configuracoes/site',{}],
  ['fila MLB',base+':runQuery',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:'mlbSolicitacoes'}],limit:1}})}],
]) {
  const response=await fetchFirestoreRead(url,{...options,signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error(name+': HTTP '+response.status+'; identidade não validada');
  // Não imprimir corpo de resposta, dados administrativos ou tokens.
  console.log(name+': leitura autenticada HTTP '+response.status);
}
console.log('Diagnóstico somente leitura concluído. Nenhum dado foi gravado ou excluído.');
