import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import choices from '../best-choices.js';
import { historyIdentity } from './history-identity.mjs';
import { observationFromHtml, addObservation } from './price-observation.mjs';
import '../metricas-resumo.js';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const dashboard = read('dashboard.html'), mobile = read('painel-celular.html');

test('IA não é motor automático e todos os resultados passam pelo contrato antes da gravação', () => {
  const motor = dashboard.slice(dashboard.indexOf('function motorConferenciaPrecoDisponivel'), dashboard.indexOf('function atualizarStatusBotPrecosLocal'));
  assert.doesNotMatch(motor, /conferir:\s*window\.conferirPrecoPelaFonteIA/);
  const save = dashboard.slice(dashboard.indexOf('async function salvarPrecoConferidoEmLote'), dashboard.indexOf('async function iniciarConferenciaPrecosIAEmLote'));
  assert.doesNotMatch(save, /if \(resultado\.robotVersion/);
  assert.ok(save.indexOf('RDCAssistedPriceSafety.validate') < save.indexOf('await db.collection'));
});

test('IA recusa modelo trocado e número que contradiz a evidência', async () => {
  const start = dashboard.indexOf('window.conferirPrecoPelaFonteIA = async'), end = dashboard.indexOf('window.gerarTextoDivulgacaoIA', start);
  const source = dashboard.slice(start, end);
  for (const returned of [
    {tituloEncontrado:'Notebook Lenovo Ideapad Intel Core i7 8gb 256gb',preco:2999,evidencia:'R$ 2.999,00'},
    {tituloEncontrado:'Notebook Lenovo Ideapad Intel Core i5 16gb 512gb',preco:999,evidencia:'R$ 232,65'},
  ]) {
    const ctx = vm.createContext({window:{RDCAssistedPriceSafety:globalThis.RDCAssistedPriceSafety,RDCBestChoices:choices},
      fonteRecuperadaComSucesso:()=>true,limparJsonDaIA:value=>value,
      modelComFontePublica:{generateContent:async()=>({response:{text:()=>JSON.stringify({status:'ok',...returned})}})}});
    vm.runInContext(source, ctx);
    await assert.rejects(ctx.window.conferirPrecoPelaFonteIA({titulo:'Notebook Lenovo Ideapad Intel Core i5 16gb 512gb',url:'https://www.mercadolivre.com.br/p/MLB12345678'}));
  }
});

test('tentativa global não renova item antigo, erro não confirma API e data futura não é atual', () => {
  const source = dashboard.match(/function precoAtualCentral\(produto\)\{[^\n]+/)[0];
  const now = Date.now(), ctx = vm.createContext({window:{RDCBestChoices:choices},statusMercadoLivreAdmin:{a:{managed:true,price:100,checkedAt:new Date(now).toISOString(),status:'active',available:true,lastError:'HTTP 403'}},statusMercadoLivreAtualizadoEm:new Date(now).toISOString()});
  vm.runInContext(source, ctx);
  assert.equal(ctx.precoAtualCentral({id:'a',preco:100,precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:new Date(now-25*3600000).toISOString()}),false);
  assert.equal(ctx.precoAtualCentral({id:'a',preco:100,precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:new Date(now-3600000).toISOString()}),true);
  assert.equal(choices.priceState({preco:100,precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:new Date(now+3600000).toISOString()},{},now).confirmed,false);
});

test('histórico distingue anúncio e variante, incluindo wid no fragmento', () => {
  const html = url => '<a href="' + url + '">Fonte</a>';
  const url = 'https://www.mercadolivre.com.br/p/MLB12345678';
  assert.notEqual(historyIdentity(html(url+'?wid=MLB1111111111&searchVariation=12')),historyIdentity(html(url+'?wid=MLB2222222222&searchVariation=34')));
  assert.equal(historyIdentity(html(url+'#wid=MLB1111111111')),'MLB1111111111');
  assert.notEqual(historyIdentity(html(url+'?wid=MLB1111111111&searchVariation=12')),historyIdentity(html(url+'?wid=MLB1111111111&searchVariation=34')));
});

test('histórico preserva legado e armazena a procedência da nova confirmação', () => {
  const html = '<meta name="rdc-price-checked-at" content="2026-10-06T12:00:00Z"><meta name="rdc-price-source" content="manual"><meta name="rdc-price-proof-version" content="3">';
  const observed = observationFromHtml(html,100,Date.parse('2026-10-06T13:00:00Z'));
  assert.equal(observed.verified,true);
  const history = addObservation({points:[['2026-10-05',25]]},observed);
  assert.equal(history.points.length,2);
  assert.equal(history.observations['2026-10-06'].proofVersion,3);
  assert.equal(observationFromHtml(html.replace('content="3"','content="0"'),100,Date.parse('2026-10-06T13:00:00Z')).verified,false);
});

test('mínimo comercial exclui legado sem apagar sua observação', () => {
  const growth = read('growth-tools.js');
  const start = growth.indexOf('  function historySummary('), end = growth.indexOf('  function currentPriceFromCard(',start);
  const ctx = vm.createContext({state:{history:{products:{a:{points:[['2026-10-05',25],['2026-10-06',100]],observations:{'2026-10-06':{verified:true}}}}}},HISTORY_DAYS:30,numberPrice:Number,Date});
  vm.runInContext(growth.slice(start,end),ctx);
  const result = ctx.historySummary('a',100);
  assert.equal(result.points.length,2);assert.equal(result.minimum,100);assert.equal(result.pendingReview,1);
});

test('fila persiste concluídos, erros e retomada, mostrando todas as pendências', () => {
  const save = mobile.slice(mobile.indexOf('function guardarPosicaoFilaPrecos'),mobile.indexOf('function millisPrecoAssistido'));
  for(const marker of ['conferidos:', 'falhas:', 'indisponiveis:', 'reconferirHoje:', 'salvo.conferidos']) assert.ok(save.includes(marker),marker);
  assert.doesNotMatch(mobile.slice(mobile.indexOf('function resumoAutomacaoPrecos'),mobile.indexOf('function atualizarControlesAutomacaoPrecos')),/separados\.slice\(0,\s*10\)/);
});

test('recarga restaura resultados e motivos sem repetir concluídos ou reativar reconferência', () => {
  const code = mobile.slice(mobile.indexOf('let filaPrecosDados = null;'), mobile.indexOf('function millisPrecoAssistido('));
  const values = new Map(), localStorage = {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const setup = () => { const ctx=vm.createContext({localStorage,hoje:()=> '2026-10-06'});vm.runInContext(code,ctx);return ctx; };
  const first=setup();
  vm.runInContext('filaPrecosConferidos.add("ok");filaPrecosResultados.set("ok",{preco:100,origem:"manual"});automacaoPrecosFalhas.set("erro",{motivo:"403",tentativaEm:"agora"});filaPrecosReconferirSalvo=true;filaPrecosDados={reconferirHoje:false};guardarPosicaoFilaPrecos()',first);
  const resumed=setup();
  assert.equal(vm.runInContext('filaPrecosConferidos.has("ok")',resumed),true);
  assert.equal(vm.runInContext('filaPrecosResultados.get("ok").preco',resumed),100);
  assert.equal(vm.runInContext('automacaoPrecosFalhas.get("erro").motivo',resumed),'403');
  assert.equal(vm.runInContext('filaPrecosReconferirSalvo',resumed),false);
  assert.ok([...values.keys()].some(key=>key.includes(':rodada:')),'diário anterior deve continuar recuperável');
});

test('segunda abertura da fila reutiliza métricas compactas sem consultar eventos novamente', async () => {
  const code=mobile.slice(mobile.indexOf('let metricasMovelPromise = null;'),mobile.indexOf('function rankingCategoriaNome('));
  const values=new Map();let queries=0;
  const ctx=vm.createContext({window:{RankingMetricasResumo:globalThis.RankingMetricasResumo},hoje:()=> '2026-10-06',
    localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},
    getDocs:async()=>{queries++;return {docs:[{id:'1',data:()=>({dia:'2026-10-06',tipo:'visualizacao_produto',produtoId:'a'})}]};},
    query:(...args)=>args,collection:()=>null,where:(...args)=>args,db:{},msg:()=>{},
    rankingTipoMetrica:e=>e.tipo,rankingMetricaProdutoId:e=>e.produtoId,rankingMetricaCanal:()=>''});
  vm.runInContext(code,ctx);
  assert.equal((await ctx.obterMetricasMovel('2026-09-30')).docs.length,1);
  assert.equal((await ctx.obterMetricasMovel('2026-09-30')).docs.length,1);
  assert.equal(queries,1);
});

test('alteração humana não herda a prova automática e prova vencida não grava nada', async () => {
  const code=dashboard.slice(dashboard.indexOf('async function salvarPrecoManual(id)'),dashboard.indexOf('function diaBrasilRotina('));
  async function run(value, motivo) {
    const writes=[],alerts=[];
    const ctx=vm.createContext({document:{getElementById:()=>({value,closest:()=>null})},numeroPreco:Number,
      formatarPrecoCampo:n=>String(n),campoPrecoExibido:()=> 'preco',conferenciasPrecoIA:{a:{preco:100,proofVersion:3,offerKey:'MLB123'}},
      db:{collection:()=>({doc:()=>({get:async()=>({exists:true,data:()=>({titulo:'Produto',link:'https://www.mercadolivre.com.br/p/MLB12345678'})}),update:async data=>writes.push(data)})})},
      window:{RDCAssistedPriceSafety:{validate:()=>motivo}},firebase:{firestore:{FieldValue:{serverTimestamp:()=> 'data'}}},
      alert:message=>alerts.push(message),console:{error:()=>{}}});
    vm.runInContext(code,ctx);await ctx.salvarPrecoManual('a');return {writes,alerts};
  }
  const manual=await run('110','prova vencida');
  assert.equal(manual.writes[0].precoConferidoPor,'manual');assert.equal(manual.writes[0].precoProvaVersao,0);
  const expired=await run('100','prova vencida');assert.equal(expired.writes.length,0);assert.match(expired.alerts[0],/prova vencida/);
  const proven=await run('100','');assert.equal(proven.writes[0].precoProvaVersao,3);
});

test('patinete barato sem evidência não recebe selo de custo-benefício', () => {
  const source = read('scripts/generate-discovery.mjs');
  const code = source.slice(source.indexOf('function chooseScooterValue('),source.indexOf('function renderScooterGuide('));
  const ctx = vm.createContext({numberPrice:Number,scooterScore:p=>p.score,scooterSpecs:p=>p.specs||{},usefulEditorialItems:(p,key)=>p[key]||[]});
  vm.runInContext(code,ctx);
  const winner={id:'winner',score:100},cheapest={id:'cheapest',score:10},weak={id:'weak',score:20,preco:10,specs:{power:100}},good={id:'good',score:70,preco:200,specs:{power:350,range:30},pros:['Motor informado'],contras:['Peso informado']};
  assert.equal(ctx.chooseScooterValue([winner,cheapest,weak,good],winner,cheapest),good);
  assert.equal(ctx.chooseScooterValue([winner,cheapest,weak],winner,cheapest),null);
});

test('cota não entra no retry do gerador e há timeout para requisições', () => {
  const generator = read('scripts/generate-sitemap.mjs');
  assert.doesNotMatch(generator.match(/const RETRYABLE_HTTP_STATUS[^\n]+/)[0],/429/);
  assert.match(generator,/AbortSignal\.timeout\(15000\)/);
  assert.match(read('.github/workflows/update-sitemap.yml'),/timeout 100s/);
});
