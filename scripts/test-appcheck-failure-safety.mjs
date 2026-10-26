import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const safety=read('appcheck-error-safety.js'),desk=read('dashboard.html'),mobile=read('painel-celular.html');
function slice(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert.ok(a>=0&&b>a,start);return text.slice(a,b);}
function boot(extra={}){const context={window:{},console:{warn(){},error(){}},...extra};vm.runInNewContext(safety,context);return context;}
const failure=(code='appCheck/fetch-network-error',message='Falha de rede')=>Object.assign(Error(message),{code});
const reply=text=>({response:{text:()=>text}});
const product={titulo:'Produto cadastrado',preco:'100,00',descricao:'Ficha preservada',especificacoes:['Especificação original']};
function deskBoot({primary=async()=>reply('{}'),review=async()=>({comentario:'texto validado'}),source=async()=>reply('{}')}={}){
  const ctx=boot({model:{generateContent:primary},modelComFontePublica:{generateContent:source},modelRevisor:{generateContent:async()=>reply('{}')},normalizarSugestaoIA:()=>({comentario:'texto validado'}),revisarComSegundaIA:review,fonteRecuperadaComSucesso:()=>true,limparJsonDaIA:text=>text});
  vm.runInNewContext(slice(desk,'        function mensagemDoErro(erro) {','        function textoUtil('),ctx);
  vm.runInNewContext(slice(desk,'        window.preencherComIA = async','        window.gerarAnaliseRankingIA = async'),ctx);
  return ctx;
}
test('classifica códigos estruturados, mensagens do SDK e causa; não lê token, stack ou mensagem quando o código basta',()=>{
  const ctx=boot(),api=ctx.window.RDCAppCheckSafety;
  for(const code of ['initial-throttle','throttled','recaptcha-error','fetch-network-error','fetch-status-error']){
    const e=failure('appCheck/'+code);for(const field of ['message','token','stack'])Object.defineProperty(e,field,{get(){throw Error('não ler '+field);}});
    assert.equal(api.isFailure(e),true);
  }
  assert.equal(api.isFailure({message:'AppCheck: ReCAPTCHA error.'}),true);
  assert.equal(api.isFailure({message:'App Check não concluído'}),true);
  assert.equal(api.isFailure({code:'AI/error',cause:failure()}),true);
  const cycle={};cycle.cause=cycle;assert.equal(api.isFailure(cycle),false);
  for(const e of [null,{},Error('429 quota'),Error('JSON inválido'),Error('network unavailable')])assert.equal(api.isFailure(e),false);
  assert.doesNotMatch(safety,/\bfetch\s*\(|getToken|localStorage|sessionStorage|console\.|setTimeout|setInterval/);
});
test('móvel interrompe a primeira IA em qualquer falha App Check, sem chamar reserva ou anunciar repetição',async()=>{
  for(const error of [failure(),failure('appCheck/recaptcha-error','Falha genérica'),{message:'AppCheck: ReCAPTCHA error.'}]){
    let first=0,reserve=0,status=0;
    const ctx=boot({modelRapido:{generateContent:async()=>{first++;throw error;}},modelReserva:{generateContent:async()=>{reserve++;throw Error('reserva proibida');}},comPrazo:p=>p,fonte:()=>false,msg(){status++;}});
    vm.runInNewContext(slice(mobile,'      async function gerarIA(prompt) {','      function mensagemIA(e) {')+';window.run=gerarIA;',ctx);
    await assert.rejects(ctx.window.run('ficha'),e=>e===error);
    assert.equal(first,1);assert.equal(reserve,0);assert.equal(status,0);
  }
});
test('móvel mantém a reserva para falha comum de modelo, sem mascarar erro de validação',async()=>{
  let reserve=0;const expected=reply('reserva');
  const ctx=boot({modelRapido:{generateContent:async()=>{throw Error('modelo indisponível');}},modelReserva:{generateContent:async()=>{reserve++;return expected;}},comPrazo:p=>p,fonte:()=>false,msg(){}});
  vm.runInNewContext(slice(mobile,'      async function gerarIA(prompt) {','      function mensagemIA(e) {')+';window.run=gerarIA;',ctx);
  assert.equal(await ctx.window.run('ficha'),expected);assert.equal(reserve,1);
});
test('principal preserva erro App Check na primeira ou segunda chamada em vez de convertê-lo em quota/indisponibilidade',async()=>{
  for(const second of [false,true]){
    let primary=0,reviews=0;const error=failure();
    const ctx=deskBoot({primary:async()=>{primary++;if(second&&primary===1)return reply('JSON inválido');throw error;},review:async()=>{reviews++;}});
    await assert.rejects(ctx.window.preencherComIA({produto:product,categorias:[]}),e=>e===error);
    assert.equal(primary,second?2:1);assert.equal(reviews,0);
  }
});
test('falha App Check na revisora interrompe o resultado, sem aceitar contingência; quota legítima mantém tratamento anterior',async()=>{
  const error=failure('appCheck/initial-throttle','401');
  const blocked=deskBoot({review:async()=>{throw error;}});
  await assert.rejects(blocked.window.preencherComIA({produto:product,categorias:[]}),e=>e===error);
  const quota=deskBoot({primary:async()=>{throw Error('429 quota exceeded');}});
  await assert.rejects(quota.window.preencherComIA({produto:product,categorias:[]}),e=>e.code==='AI_QUOTA');
});
test('ranking não chama outro modelo quando a consulta com fontes falha por App Check',async()=>{
  let sourced=0,primary=0,review=0;const error=failure();
  const ctx=boot({modelComFontePublica:{generateContent:async()=>{sourced++;throw error;}},model:{generateContent:async()=>{primary++;}},modelRevisor:{generateContent:async()=>{review++;}},fonteRecuperadaComSucesso:()=>true,limparJsonDaIA:x=>x});
  vm.runInNewContext(slice(desk,'        window.gerarAnaliseRankingIA = async','        function limparJsonDaIA('),ctx);
  const draft={produtos:[1,2,3].map(id=>({id,titulo:'Produto '+id,position:id,preco:100,productUrl:'https://rankingdacompra.com.br/produto/'+id+'.html'}))},before=JSON.stringify(draft);
  await assert.rejects(ctx.window.gerarAnaliseRankingIA(draft),e=>e===error);
  assert.equal(sourced,1);assert.equal(primary,0);assert.equal(review,0);assert.equal(JSON.stringify(draft),before);
});
test('formulário manual mantém todos os valores e não produz contingência após falha App Check',async()=>{
  const ids=['titulo','dados-tecnicos-manual','preco','foto','comentario','pros','contras','texto-ia-paste','categoria','btn-gerar-analise'];
  const fields=Object.fromEntries(ids.map(id=>[id,{value:'Valor original '+id,disabled:false,innerText:'original',options:[]}]));
  fields['dados-tecnicos-manual'].value=['Característica técnica original suficientemente detalhada 1','Característica técnica original suficientemente detalhada 2','Característica técnica original suficientemente detalhada 3'].join(';');
  fields.categoria.options=[{value:'categoria',textContent:'Categoria'}];
  let fallback=0,logs=0;const alerts=[],before=ids.map(id=>fields[id].value),ctx=boot({document:{getElementById:id=>fields[id]},alert:x=>alerts.push(x),console:{error(){logs++;}}});
  ctx.window.preencherComIA=async()=>{throw failure();};ctx.window.criarAnaliseSemIA=()=>{fallback++;throw Error('contingência proibida');};
  vm.runInNewContext(slice(desk,'        async function gerarAnaliseManualComIA() {','        async function buscarPorNomeML() {')+';window.run=gerarAnaliseManualComIA;',ctx);
  await ctx.window.run();assert.deepEqual(ids.map(id=>fields[id].value),before);assert.equal(fallback,0);assert.equal(logs,0);assert.equal(fields['btn-gerar-analise'].disabled,false);
  assert.match(alerts[0],/campos foram preservados/);assert.doesNotMatch(alerts[0],/Falha de rede/);
});
test('os dois painéis carregam o classificador antes da IA sem mudar a renovação ou introduzir debug token',()=>{
  for(const html of [desk,mobile]){
    assert.ok(html.indexOf('/appcheck-error-safety.js?v=20261026-1')<html.indexOf('initializeAppCheck(aiApp'));
    assert.match(html,/isTokenAutoRefreshEnabled: true/);
    assert.doesNotMatch(html,/FIREBASE_APPCHECK_DEBUG_TOKEN|getToken\(true\)/);
  }
});
