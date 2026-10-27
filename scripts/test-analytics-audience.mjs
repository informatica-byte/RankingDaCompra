import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ga from '../analytics-audience.js';
const cfg={propertyId:'545546219',clientId:'123-local.apps.googleusercontent.com',timeZone:'America/Sao_Paulo'};
const at=Date.parse('2026-10-27T18:00:00Z');
const token={access_token:'test-memory-only',expires_in:3600,scope:ga.SCOPE};
const response=()=>({reports:[1,7,14].map(n=>({metricHeaders:['sessions','totalUsers','screenPageViews'].map(name=>({name})),rows:[{metricValues:[n,n+1,n*2].map(n=>({value:String(n)}))}],rowCount:1}))});
function fixture(options={}){
 const values=options.values||new Map(),calls=[],states=[],time={at};
 const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const reader=ga.createReader({settings:cfg,userId:options.userId||'owner',storage,now:()=>time.at,fetch:async(...args)=>{calls.push(args);return options.send?options.send(...args):{ok:true,status:200,json:async()=>response()};},onChange:s=>states.push(s)});
 return {reader,values,calls,states,time};
}
test('consulta apenas audiência da página inicial com escopo somente leitura, sem métricas de venda',()=>{
 const body=ga.requestBody(at,cfg.timeZone);assert.equal(body.requests.length,3);
 for(const r of body.requests){assert.deepEqual(r.metrics.map(m=>m.name),['sessions','totalUsers','screenPageViews']);assert.equal(r.limit,'1');assert.equal(r.dimensionFilter.andGroup.expressions[1].filter.fieldName,'pagePath');}
 assert.equal(body.requests[2].dateRanges[0].startDate,'2026-10-14');
 assert.doesNotMatch(JSON.stringify(body),/purchase|revenue|conversions|keyEvents|eventCount|affiliate_click/);
 assert.equal(ga.day(Date.parse('2026-10-28T01:00:00Z')),'2026-10-27');
});
test('não consulta antes de consentimento; token fica só na memória e usa cabeçalho, nunca URL ou cache',async()=>{
 const f=fixture();await f.reader.refresh();assert.equal(f.calls.length,0);assert.equal(f.reader.readState().snapshot,null);
 assert.equal(f.reader.authorize(token),true);await f.reader.refresh();assert.equal(f.calls.length,1);
 assert.equal(f.calls[0][0],'https://analyticsdata.googleapis.com/v1beta/properties/545546219:batchRunReports');
 assert.equal(f.calls[0][1].credentials,'omit');assert.equal(f.calls[0][1].headers.Authorization,'Bearer test-memory-only');
 assert.ok(!f.calls[0][0].includes(token.access_token));
 const saved=[...f.values.values()].join('');assert.doesNotMatch(saved,/test-memory-only|access_token|refresh_token|Authorization|secret|email/);
 assert.doesNotMatch(JSON.stringify(f.states),/test-memory-only/);assert.equal(f.reader.readState().snapshot.ranges[0].views,2);
});
test('cache é privado por usuário e propriedade, compartilhado sem repetir consulta e sem autorização herdada',async()=>{
 const f=fixture();f.reader.authorize(token);await f.reader.refresh();
 const second=fixture({values:f.values});assert.equal(second.reader.readState().snapshot.at,at);assert.equal(second.reader.readState().connected,false);
 second.reader.authorize(token);await second.reader.refresh();assert.equal(second.calls.length,0);
 assert.equal(fixture({values:f.values,userId:'other'}).reader.readState().snapshot,null);
 f.time.at+=ga.REFRESH_MS;await f.reader.refresh();assert.equal(f.calls.length,2);
});
test('erro, API desativada, bloqueio, limite ou cobrança preservam o último resumo sem falsificar zero ou data',async()=>{
 for(const [status,reason,expected] of [[403,'BILLING_DISABLED','billing'],[403,'SERVICE_DISABLED','configuration'],[403,'ACCESS_DENIED','permission'],[429,'RESOURCE_EXHAUSTED','quota'],[401,'UNAUTHENTICATED','expired']]){
  let fail=false;const f=fixture({send:async()=>({ok:!fail,status:fail?status:200,json:async()=>fail?{error:{details:[{reason}]}}:response()})});
  f.reader.authorize(token);await f.reader.refresh();fail=true;f.time.at+=ga.REFRESH_MS;await f.reader.refresh();
  assert.equal(f.reader.readState().status,expected);assert.equal(f.reader.readState().snapshot.at,at);assert.equal(f.reader.readState().connected,false);
  const attempts=f.calls.length;await f.reader.refresh();assert.equal(f.calls.length,attempts);
 }
});
test('escopo excessivo ou ausente não é aceito; autorização expirada não envia requisição',async()=>{
 const f=fixture();assert.equal(f.reader.authorize({...token,scope:'https://www.googleapis.com/auth/analytics'}),false);
 assert.equal(f.reader.authorize({...token,scope:ga.SCOPE+' https://www.googleapis.com/auth/drive'}),false);await f.reader.refresh();assert.equal(f.calls.length,0);
 f.reader.authorize(token);f.time.at+=3600000;assert.equal(f.reader.readState().status,'expired');await f.reader.refresh();assert.equal(f.calls.length,0);
});
test('resposta tardia após sair ou desconectar não repõe estado, cache nem token',async()=>{
 let resolve;const f=fixture({send:()=>new Promise(done=>{resolve=done;})});f.reader.authorize(token);const pending=f.reader.refresh();
 f.reader.disconnect();resolve({ok:true,status:200,json:async()=>response()});await pending;
 assert.equal(f.reader.readState().status,'disconnected');assert.equal(f.values.size,0);assert.equal(f.reader.readState().snapshot,null);
});
test('valida cabeçalhos, cardinalidade e inteiros; somente uma resposta vazia válida representa zero',()=>{
 const ok=response();ok.reports[0].rows=[];ok.reports[0].rowCount=0;assert.equal(ga.parseReports(ok,cfg,at).ranges[0].views,0);
 const bad=response();bad.reports[0].metricHeaders[0].name='ecommercePurchases';assert.throws(()=>ga.parseReports(bad,cfg,at),/invalid_report/);
 const multiple=response();multiple.reports[0].rows.push(multiple.reports[0].rows[0]);assert.throws(()=>ga.parseReports(multiple,cfg,at),/invalid_report/);
 const negative=response();negative.reports[0].rows[0].metricValues[0].value='-1';assert.throws(()=>ga.parseReports(negative,cfg,at),/invalid_report/);
 const saved=ga.parseReports(response(),cfg,at);assert.equal(ga.snapshot({...saved,propertyId:'other'},cfg,at),null);
 assert.equal(ga.snapshot({...saved,at:at+3600000},cfg,at),null);
 assert.doesNotMatch(JSON.stringify(ga.snapshot({...saved,access_token:'unsafe'},cfg,at)),/unsafe|access_token/);
});
test('ambos os painéis têm o mesmo componente privado, histórico sinalizado e gancho de sessão sem Firebase adicional',async()=>{
 const settings=JSON.parse(await readFile(new URL('../analytics-audience-config.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(settings).sort(),['clientId','propertyId','timeZone','version']);assert.ok(ga.config(settings).clientId);
 for(const file of ['dashboard.html','painel-celular.html']){
  const html=await readFile(new URL('../'+file,import.meta.url),'utf8');
  assert.equal((html.match(/data-ga4-audience /g)||[]).length,1);assert.match(html,/analytics-audience\.js\?v=20261027-1/);
  assert.match(html,/RDCAnalyticsUserId = \(\) => auth.currentUser\?\.uid \|\| ''/);assert.match(html,/rdc-admin-auth/);
  assert.match(html,/data-metrica="visitasHoje" data-metrica-legado="true"/);assert.match(html,/26\/10\/2026/);
 }
 const source=await readFile(new URL('../analytics-audience.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/collection\(|getDocs\(|getDoc\(|\.gtag\(|sendBeacon|measurementProtocol|BigQuery/);
 assert.match(source,/include_granted_scopes:false/);assert.match(source,/REFRESH_MS=15\*60\*1000/);
 const shared=await readFile(new URL('../metricas-resumo.js',import.meta.url),'utf8'),context=vm.createContext({});vm.runInContext(shared,context);
 const el={dataset:{metrica:'visitasHoje',metricaLegado:'true'},textContent:'0',title:''};
 context.RankingMetricasResumo.exibir({registros:[],atualizadoEm:at,ultimoDia:'2026-10-27'},{querySelectorAll:selector=>selector==='[data-metrica]'?[el]:[]});assert.equal(el.textContent,'—');assert.match(el.title,/desativada/);
});
