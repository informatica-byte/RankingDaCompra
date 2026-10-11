import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { LocalizerError, recordResponse, recordNetworkFailure, recordPageChallenge, safeDiagnostic, diagnosticReason, resolutionKey, resolveQueuedRequests, diagnosticTable } from './localizer-diagnostics.mjs';

test('diagnóstico separa HTTP, campo ausente e CAPTCHA sem registrar segredos', () => {
  const diagnostic = { events: [], identified: true, missingFields: ['preco', 'imagem'] };
  recordResponse(diagnostic, 'anuncio', {status:403, body:'TOKEN-SECRETO', headers:{authorization:'Bearer TOKEN-SECRETO'}});
  recordNetworkFailure(diagnostic, 'catalogo', {name:'TimeoutError',message:'senha=TOKEN-SECRETO'});
  recordPageChallenge(diagnostic, '<title>Verifique se você é humano</title>');
  const reason = diagnosticReason(diagnostic);
  assert.match(reason, /preço válido, imagem válida/);
  assert.match(reason, /anuncio: HTTP 403/);
  assert.match(reason, /tempo limite/);
  assert.match(reason, /verificação humana/);
  assert.doesNotMatch(JSON.stringify(safeDiagnostic(diagnostic)) + reason, /TOKEN-SECRETO/);
  assert.equal(safeDiagnostic(diagnostic).challenge, true);
});

test('deduplicação conserva variantes, vendedor, cupom e parâmetros desconhecidos', () => {
  const link = 'https://www.mercadolivre.com.br/p/MLB12345678?utm_source=whatsapp#tracking_id=a&wid=MLB6755589412';
  assert.equal(resolutionKey(link), resolutionKey(link.replace('whatsapp','mail').replace('tracking_id=a','tracking_id=b')));
  assert.notEqual(resolutionKey(link), resolutionKey(link.replace('MLB6755589412', 'MLB6755589413')));
  assert.notEqual(resolutionKey(link), resolutionKey(link + '&variation_id=123'));
  assert.notEqual(resolutionKey(link), resolutionKey(link.replace('?utm_source=whatsapp', '?coupon=OFF')));
  assert.notEqual(resolutionKey('https://meli.la/a'), resolutionKey('https://meli.la/b'));
  assert.notEqual(resolutionKey('https://meli.la/a?position=1'), resolutionKey('https://meli.la/a?position=2'));
  assert.notEqual(resolutionKey('https://lista.mercadolivre.com.br/indicacao?position=1'), resolutionKey('https://lista.mercadolivre.com.br/indicacao?position=2'));
  assert.notEqual(resolutionKey('https://www.mercadolivre.com.br/p/MLB1?unknown=1'), resolutionKey('https://www.mercadolivre.com.br/p/MLB1?unknown=2'));
});

test('pedidos duplicados consultam uma vez e mantêm IDs, tentativas e links originais', async () => {
  let calls = 0;
  const queue = [{id:'a',link:'https://produto.mercadolivre.com.br/MLB-6755589412-produto-_JM?utm_source=a'},{id:'b',link:'https://produto.mercadolivre.com.br/MLB-6755589412-produto-_JM?utm_source=b'}];
  const results = { old: {status:'ok',precoAtual:10,foto:'original'}, a:{status:'erro',tentativas:1} };
  const stats = await resolveQueuedRequests(queue, results, async request => {calls++;return {status:'ok',mlb:'MLB6755589412',precoAtual:25,foto:'valid',urlProduto:request.link};}, {now:()=>'2026-10-11T10:00:00Z'});
  assert.equal(calls,1);
  assert.deepEqual(stats,{uniqueQueries:1,reused:1});
  assert.equal(results.a.tentativas,2);
  assert.equal(results.b.tentativas,1);
  assert.equal(results.b.linkOriginal,queue[1].link);
  assert.equal(results.b.urlProduto,queue[1].link);
  assert.equal(results.b.reaproveitadoDe,'a');
  assert.deepEqual(results.old,{status:'ok',precoAtual:10,foto:'original'});
  assert.equal(results.a.precoAtual,results.b.precoAtual);
});

test('falha duplicada é reaproveitada sem segunda chamada ou falso sucesso', async () => {
  let calls = 0;
  const diagnostic={events:[{stage:'imagem',http:404}],identified:true,missingFields:['imagem']};
  const queue=[{id:'a',link:'https://meli.la/test'},{id:'b',link:'https://meli.la/test'}];
  const results={};
  await resolveQueuedRequests(queue,results,async()=>{calls++;throw new LocalizerError(diagnostic);});
  assert.equal(calls,1);
  assert.equal(results.a.status,'erro');
  assert.equal(results.b.status,'erro');
  assert.match(results.b.motivo,/imagem: HTTP 404/);
  assert.equal(results.b.reaproveitadoDe,'a');
  assert.match(diagnosticTable(queue,results),/Não obtido \(reaproveitado\)/);
});

test('URLs de variantes diferentes são processadas separadamente', async () => {
  let calls=0;
  const queue=[{id:'a',link:'https://www.mercadolivre.com.br/p/MLB12345678?variation_id=1'},{id:'b',link:'https://www.mercadolivre.com.br/p/MLB12345678?variation_id=2'}];
  const stats=await resolveQueuedRequests(queue,{},async()=>{calls++;return {status:'ok'};});
  assert.equal(calls,2);
  assert.equal(stats.reused,0);
});

test('relatório sanitiza ID e ignora mensagens/diagnósticos não confiáveis', async () => {
  const results={};
  const queue=[{id:'<script>|SECRET',link:'https://meli.la/test'}];
  await resolveQueuedRequests(queue,results,async()=>{throw new Error('password=NEVER-PUBLISH');});
  const report=diagnosticTable(queue,results);
  assert.doesNotMatch(report,/NEVER-PUBLISH|<script>/);
  assert.doesNotMatch(JSON.stringify(results),/NEVER-PUBLISH/);
  assert.ok(Object.hasOwn(results, queue[0].id), 'A identidade do pedido deve ser preservada, não renomeada.');
  const safe=safeDiagnostic({events:[{stage:'password',http:403},{stage:'anuncio',http:403,authorization:'secret'}],missingFields:['TOKEN'],secret:'secret'});
  assert.deepEqual(safe.events,[{stage:'anuncio',http:403}]);
  assert.deepEqual(safe.missingFields,[]);
});

test('biblioteca reCAPTCHA em página normal não comprova verificação humana', () => {
  const diagnostic={events:[],missingFields:[]};
  recordPageChallenge(diagnostic,'<title>Produto normal</title><script src="recaptcha.js">captcha</script><p>Produto disponível</p>');
  assert.notEqual(diagnostic.challenge,true);
  recordPageChallenge(diagnostic,'<title>Verificação CAPTCHA</title>');
  assert.equal(diagnostic.challenge,true);
});

test('integração do resolvedor lista precisamente campos ausentes após HTTP 403', async () => {
  const source=await readFile(new URL('./resolve-affiliate-links.mjs',import.meta.url),'utf8');
  const functionSource=source.slice(source.indexOf('async function resolveRequest(request)'),source.indexOf('let payload ='));
  const resolve=runInNewContext(functionSource+'\nresolveRequest;',{
    LocalizerError,recordPageChallenge,recordNetworkFailure,
    dump:async()=>'<title>Verificação CAPTCHA</title>',candidates:()=>[],fallback:()=>null,
    officialDetails:async(id,html,catalog,diagnostic)=>{recordResponse(diagnostic,'anuncio',{status:403});return {titulo:'Produto certo',precoAtual:0,foto:''};},
    selectLoadableMarketplaceImage:async()=>'',imageProbeOptions:()=>({}),
  });
  await assert.rejects(resolve({link:'https://www.mercadolivre.com.br/p/MLB12345678?wid=MLB6755589412'}),error=>{
    assert.equal(error.name,'LocalizerError');
    assert.deepEqual(error.diagnostic.missingFields,['preco','imagem']);
    assert.match(error.message,/HTTP 403/);return true;
  });
});

test('resposta positiva e imagem válida conservam dados sem inventar valores', async () => {
  const source=await readFile(new URL('./resolve-affiliate-links.mjs',import.meta.url),'utf8');
  const functionSource=source.slice(source.indexOf('async function resolveRequest(request)'),source.indexOf('let payload ='));
  const resolve=runInNewContext(functionSource+'\nresolveRequest;',{
    LocalizerError,recordPageChallenge,recordNetworkFailure,
    dump:async()=>'',candidates:()=>[],fallback:()=>null,
    officialDetails:async()=>({titulo:'Produto certo',precoAtual:32.15,foto:'https://http2.mlstatic.com/foto.webp'}),
    selectLoadableMarketplaceImage:async()=> 'https://http2.mlstatic.com/foto.webp',imageProbeOptions:()=>({}),
  });
  const result=await resolve({link:'https://produto.mercadolivre.com.br/MLB-6755589412-produto-_JM'});
  assert.equal(result.status,'ok');
  assert.equal(result.precoAtual,32.15);
  assert.equal(result.mlb,'MLB6755589412');
});

test('workflow continua a sinalizar falha só após preservar e publicar resultados', async () => {
  const workflow=await readFile(new URL('../.github/workflows/localizar-mlb.yml',import.meta.url),'utf8');
  assert.ok(workflow.indexOf('Sinalizar dados não obtidos')>workflow.indexOf('git push origin HEAD:main'));
  const source=await readFile(new URL('./resolve-affiliate-links.mjs',import.meta.url),'utf8');
  assert.match(source,/resolveQueuedRequests\(queue, payload.resultados, resolveRequest/);
  assert.match(source,/diagnosticTable\(queue, payload.resultados\)/);
  assert.equal((source.match(/await requests\(/g)||[]).length,2);
});
