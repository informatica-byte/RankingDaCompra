import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {firestoreReadRequest} from './firestore-read-auth.mjs';
const root='https://firestore.googleapis.com/v1/projects/rankingdacompra/databases/(default)/documents';
test('WIF token is sent only in headers, strips client key and blocks redirects',()=>{
  const input={headers:{accept:'application/json'},signal:AbortSignal.timeout(1000)};
  const result=firestoreReadRequest(root+'/produtos?key=public&pageSize=1',input,{RDC_FIRESTORE_ACCESS_TOKEN:'ephemeral'});
  assert.equal(result.options.headers.get('authorization'),'Bearer ephemeral');assert.equal(result.options.headers.get('accept'),'application/json');
  assert.doesNotMatch(result.url,/ephemeral|key=/);assert.equal(result.options.redirect,'error');assert.equal(result.options.signal,input.signal);assert.equal(input.headers.authorization,undefined);
});
test('identity never permits writes or sends credentials to another destination',()=>{
  for(const url of ['https://example.com/','http://firestore.googleapis.com/'+root.split('/').slice(3).join('/'),root.replace('rankingdacompra','other')+'/produtos']){
    assert.throws(()=>firestoreReadRequest(url,{}, {RDC_FIRESTORE_ACCESS_TOKEN:'ephemeral'}),/não autorizado/);
  }
  for(const method of ['PATCH','DELETE','PUT','POST']) assert.throws(()=>firestoreReadRequest(root+'/produtos/a',{method},{}),/apenas leitura/);
  assert.equal(firestoreReadRequest(root+':runQuery',{method:'POST',body:'{}'},{}).options.method,'POST');
});
test('required auth fails closed and missing optional auth retains current read compatibility',()=>{
  assert.throws(()=>firestoreReadRequest(root+'/produtos',{}, {RDC_FIRESTORE_AUTH_REQUIRED:'true'}),/não será tentado/);
  assert.equal(firestoreReadRequest(root+'/produtos',{},{}).options.headers.has('authorization'),false);
  assert.throws(()=>firestoreReadRequest(root+'/produtos',{}, {RDC_FIRESTORE_ACCESS_TOKEN:'x\nb'}),/inválido/);
  assert.throws(()=>firestoreReadRequest(root+'/produtos',{headers:{Authorization:'Bearer other'}},{RDC_FIRESTORE_ACCESS_TOKEN:'x'}),/duplicada/);
});
test('all four Firestore jobs use shared authenticated reads and quota is not retried in price sync',async()=>{
  for(const file of ['generate-sitemap','generate-discovery','sync-mercadolivre','resolve-affiliate-links']){
    const source=await readFile(new URL(file+'.mjs',import.meta.url),'utf8');assert.match(source,/import \{ fetchFirestoreRead \}/);
  }
  const source=await readFile(new URL('sync-mercadolivre.mjs',import.meta.url),'utf8');assert.match(source,/const retryable = response.status >= 500;/);
});

test('workflow credentials are short-lived, keyless and required only in authorized jobs',async()=>{
  const action=await readFile('.github/actions/firestore-read-auth/action.yml','utf8');
  assert.match(action,/google-github-actions\/auth@[a-f0-9]{40}/);
  assert.match(action,/access_token_lifetime: 900s/);
  assert.match(action,/create_credentials_file: false/);
  assert.match(action,/export_environment_variables: false/);
  assert.match(action,/ranking-publication-reader@rankingdacompra\.iam\.gserviceaccount\.com/);
  for(const name of ['update-sitemap','sync-mercadolivre','localizar-mlb','testar-identidade-firestore']){
    const workflow=await readFile('.github/workflows/'+name+'.yml','utf8');
    assert.match(workflow,/id-token: write/);
    assert.match(workflow,/uses: \.\/\.github\/actions\/firestore-read-auth/);
    assert.match(workflow,/RDC_FIRESTORE_AUTH_REQUIRED: "true"/);
    assert.doesNotMatch(workflow,/credentials_json|PRIVATE_KEY/);
  }
});
