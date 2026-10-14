import test from 'node:test';
import assert from 'node:assert/strict';
import {auditOnline} from './audit-site-integrity.mjs';

const SITE='https://rankingdacompra.com.br';
const FILE='amostra.html';
const HTML='<!doctype html><html><head><link rel="canonical" href="'+SITE+'/'+FILE+'"></head><body>Produto</body></html>';
const timeout=()=>Object.assign(new Error('Request timed out'),{name:'TimeoutError'});

async function sequenceAudit(sequence,options={}) {
  const calls=[],waits=[],events=[],released=[];
  const request=async url=>{
    const probe=url.endsWith('/auditoria-url-inexistente-20261009.html');
    if(probe)return {status:404,ok:false,url,body:{async cancel(){events.push('release:probe');}}};
    const attempt=calls.push(url);
    events.push('request:'+attempt);
    const item=sequence[Math.min(attempt-1,sequence.length-1)];
    if(item instanceof Error)throw item;
    const status=typeof item==='number'?item:item.status;
    return {status,ok:status>=200&&status<300,url,async text(){if(item.textError)throw item.textError;return item.html??HTML;},body:{async cancel(){released.push(attempt);events.push('release:'+attempt);}}};
  };
  const offline={targets:[FILE],html:new Map([[FILE,HTML]])};
  const report=await auditOnline(offline,{request,concurrency:1,wait:async milliseconds=>{waits.push(milliseconds);events.push('wait:'+milliseconds);},...options});
  return {report,calls,waits,events,released};
}

for(const status of [429,502,503,504])test('HTTP '+status+' é retestado e recuperação fica registrada sem ocultar a primeira falha',async()=>{
  const {report,calls,waits,events,released}=await sequenceAudit([status,200]);
  assert.equal(calls.length,2);
  assert.deepEqual(waits,[250]);
  assert.deepEqual(released,[1]);
  assert.deepEqual(events.slice(0,4),['request:1','release:1','wait:250','request:2']);
  assert.equal(report.checked,1);
  assert.equal(report.requests,3,'duas tentativas do destino e uma sonda 404');
  assert.deepEqual(report.errors,[]);
  assert.equal(report.warnings.length,1);
  assert.equal(report.warnings[0].recovered,true);
  assert.deepEqual(report.rows[0].attempts.map(item=>item.status),[status,200]);
  assert.equal(report.rows[0].attempts[0].retryScheduled,true);
  assert.equal(report.probe.status,404);
  assert.equal(report.probe.attempts.length,1);
});

test('503 persistente encerra após três tentativas, conserva erro e libera cada resposta',async()=>{
  const {report,calls,waits,released}=await sequenceAudit([503],{maxRetries:99});
  assert.equal(calls.length,3,'nem configuração maior amplia o limite de duas retentativas');
  assert.deepEqual(waits,[250,500]);
  assert.deepEqual(released,[1,2,3]);
  assert.equal(report.errors.length,1);
  assert.equal(report.errors[0].status,503);
  assert.equal(report.errors[0].attempts.length,3);
  assert.equal(report.warnings.length,0);
});

for(const status of [404,403,500])test('HTTP definitivo '+status+' não é repetido nem convertido em aviso',async()=>{
  const {report,calls,waits}=await sequenceAudit([status,200]);
  assert.equal(calls.length,1);
  assert.deepEqual(waits,[]);
  assert.equal(report.errors[0].status,status);
  assert.equal(report.warnings.length,0);
});

test('timeout e falha de rede têm no máximo duas retentativas e preservam suas causas',async()=>{
  const {report,calls}=await sequenceAudit([timeout(),new TypeError('fetch failed'),200]);
  assert.equal(calls.length,3);
  assert.deepEqual(report.errors,[]);
  assert.match(report.rows[0].attempts[0].problem,/timed out/);
  assert.match(report.rows[0].attempts[1].problem,/fetch failed/);
  assert.equal(report.warnings[0].recovered,true);
  const persistent=await sequenceAudit([timeout()]);
  assert.equal(persistent.calls.length,3);
  assert.equal(persistent.report.checked,1,'destino sem resposta também é contado como verificado');
  assert.equal(persistent.report.errors[0].attempts.length,3);
  assert.equal(persistent.report.warnings.length,0);
});

test('timeout ao ler HTML libera o body antes da retentativa',async()=>{
  const {report,released,events}=await sequenceAudit([{status:200,textError:timeout()},200]);
  assert.deepEqual(released,[1]);
  assert.deepEqual(events.slice(0,4),['request:1','release:1','wait:250','request:2']);
  assert.deepEqual(report.errors,[]);
  assert.match(report.warnings[0].attempts[0].problem,/timed out/);
});

test('HTML inválido, canônico divergente e erro não relacionado à rede continuam definitivos',async()=>{
  for(const item of [{status:200,html:'serviço indisponível'},{status:200,html:HTML.replace('/amostra.html','/outra.html')},new Error('Configuração inválida')]){
    const {report,calls}=await sequenceAudit([item,200]);
    assert.equal(calls.length,1);
    assert.equal(report.errors.length,1);
    assert.equal(report.warnings.length,0);
  }
});

test('retentativa desativada conserva a primeira falha temporária como erro',async()=>{
  const {report,calls,waits}=await sequenceAudit([503,200],{maxRetries:0});
  assert.equal(calls.length,1);
  assert.deepEqual(waits,[]);
  assert.equal(report.errors[0].status,503);
});

test('sonda inexistente aceita apenas 404 e também registra recuperação temporária',async()=>{
  let calls=0;const waits=[];
  const report=await auditOnline({targets:[],html:new Map()},{request:async url=>{const status=++calls===1?503:404;return {status,ok:false,url,body:{async cancel(){}}};},wait:async milliseconds=>waits.push(milliseconds)});
  assert.equal(calls,2);
  assert.deepEqual(waits,[250]);
  assert.equal(report.checked,0);
  assert.equal(report.requests,2);
  assert.deepEqual(report.errors,[]);
  assert.equal(report.warnings[0].recovered,true);
  assert.deepEqual(report.probe.attempts.map(item=>item.status),[503,404]);
});
