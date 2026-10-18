import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../assisted-report-recovery.js',import.meta.url),'utf8');
const context=vm.createContext({Date,JSON,Map,Set,Number,String,Array,Boolean});
vm.runInContext(code,context);const helper=context.RDCAssistedReportRecovery;
const day='2026-10-18',key='ranking-fila-precos-assistida-v1';
function storage(value=null,fail=false){
 const values=new Map(value?[[key,value]]:[]),writes=[];
 return{values,writes,getItem:k=>values.get(k)||null,setItem(k,v){if(fail)throw new Error('QuotaExceededError');values.set(k,v);writes.push(k);},removeItem(){throw new Error('Nunca apagar histórico');}};
}
const snapshot=(date,extra={})=>JSON.stringify({dia:day,atualizadoEm:date,conferidos:[],resultados:[],falhas:[],indisponiveis:[],...extra});
test('quota cheia preserva fallback de sessão sem sobrescrever cópia antiga ou apagar dados',()=>{
 const old=snapshot('2026-10-18T11:01:18Z',{conferidos:['a']}),fresh=snapshot('2026-10-18T11:10:00Z',{conferidos:['a','b']});
 const local=storage(old,true),session=storage();
 const result=helper.persist({local,session,key,roundKey:key+':rodada:teste',snapshot:fresh});
 assert.equal(result.primary,false);assert.equal(result.session,true);assert.equal(local.values.get(key),old);
 assert.equal(session.values.get(key),fresh);assert.equal(helper.latest({local,session,key,day}).conferidos.length,2);
});
test('cópia local mais recente vence sessão antiga e ambos os armazenamentos bloqueados são tolerados',()=>{
 const local=storage(snapshot('2026-10-18T12:00:00Z')),session=storage(snapshot('2026-10-18T11:00:00Z'));
 assert.equal(helper.latest({local,session,key,day}).atualizadoEm,'2026-10-18T12:00:00Z');
 const blocked={getItem(){throw new Error('disabled');},setItem(){throw new Error('disabled');}};
 assert.equal(helper.latest({local:blocked,session:blocked,key,day}),null);
 assert.equal(helper.persist({local:blocked,session:blocked,key,roundKey:'round',snapshot:'{}'}).session,false);
});
test('fallback existente acompanha novas gravações mesmo quando local volta a funcionar',()=>{
 const local=storage(),session=storage(snapshot('2026-10-18T13:00:00Z'));
 const fresh=snapshot('2026-10-18T14:00:00Z');
 helper.persist({local,session,key,roundKey:'round',snapshot:fresh});assert.equal(session.values.get(key),fresh);
});
test('relatórios corrompidos, de outro dia e sem data não são usados para retomar',()=>{
 for(const invalid of ['{','null','[]',JSON.stringify({dia:'2026-10-17',atualizadoEm:'2026-10-18T11:00:00Z'}),JSON.stringify({dia:day})]){
  assert.equal(helper.latest({local:storage(invalid),session:storage(),key,day}),null);
 }
});
const product=(id='a',extra={})=>({id,titulo:'Produto '+id,precoAtualizadoManualmenteEm:'2026-10-18T11:10:00Z',precoConferenciaValor:129.9,
 precoConferenciaId:'confirmed-'+id,precoConferidoPor:'robo_assistido_2.4.8',precoProvaVersao:3,precoConferenciaIAFonte:'https://www.mercadolivre.com.br/produto/p/MLB12345678',
 precoConferenciaIAEvidencia:'Preço total em destaque: R$ 129,90; anúncio visível MLB1234567890',...extra});
const options=(products,results=new Map(),extra={})=>({products,day,reviewToday:false,results,millis:value=>Date.parse(value)||0,
 dayOf:ms=>new Date(ms).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),number:Number,source:()=> 'https://www.mercadolivre.com.br/produto/p/MLB12345678',...extra});
test('reconstrói somente confirmações reais salvas, sem repetir consulta nem inventar preço anterior',()=>{
 const existing=new Map([['a',{status:'confirmado',confirmacaoId:'confirmed-a',precoAnterior:100}]]);
 const recovered=helper.recover(options([product('a'),product('b')],existing));
 assert.equal(recovered.length,1);assert.equal(recovered[0][0],'b');assert.equal(recovered[0][1].preco,129.9);
 assert.equal(recovered[0][1].precoAnterior,null);assert.equal(recovered[0][1].recuperadoDoCadastro,true);
 assert.equal(recovered[0][1].evidencia,product().precoConferenciaIAEvidencia);assert.equal(existing.size,1);
});
test('não reconstrói confirmação antiga, preço inválido, sem id, pausado ou reativado depois da conferência',()=>{
 for(const p of [product('a',{precoAtualizadoManualmenteEm:'2026-10-17T11:00:00Z'}),product('a',{precoConferenciaValor:0}),
 product('a',{precoConferenciaId:''}),product('a',{conferenciaPausada:true}),product('a',{conferenciaReativadaEm:'2026-10-18T12:00:00Z'})]){
  assert.equal(helper.recover(options([p])).length,0);
 }
 assert.equal(helper.recover(options([product()],new Map(),{reviewToday:true})).length,0);
});
test('relatório filtra erros já resolvidos, mantém histórico e identifica pendente sem resultado recuperado',()=>{
 const all=[product('a'),product('b'),product('c',{conferenciaPausada:true}),product('d')],pending=[all[1],all[3]];
 const old=snapshot('2026-10-18T11:01:18Z',{conferidos:['a','deleted'],falhas:[['a',{id:'a',motivo:'pop-up antigo'}]]});
 const report=helper.report({snapshot:old,all,pending,failures:[{id:'a',motivo:'pop-up antigo'}],unavailable:[{id:'b',motivo:'sem estoque'}],active:false,paused:false,generatedAt:'2026-10-18T12:00:00Z'});
 assert.equal(report.versao,3);assert.equal(report.resumoAtual.total,3);assert.equal(report.resumoAtual.conferidos,1);assert.equal(report.resumoAtual.restantes,2);
 assert.equal(report.resumoAtual.pausados,1);assert.equal(report.falhas.length,0);assert.equal(report.historicoFalhas.length,1);
 assert.equal(report.conferidos.length,1);assert.equal(report.conferidos[0],'a');assert.equal(report.pendenciasAtuais.length,2);
 assert.equal(report.pendenciasAtuais[1].tipo,'sem_resultado_recuperado');assert.equal(report.pendenciasAtuais[1].tentativaEm,null);
});
test('regressão 379 no arquivo antigo contra 391 de 533 já confirmados nos produtos carregados',()=>{
 const all=Array.from({length:533},(_,index)=>product(String(index),index<391?{}:{precoAtualizadoManualmenteEm:'2026-10-17T11:00:00Z'}));
 const results=new Map(all.slice(0,379).map(p=>[p.id,{status:'confirmado',confirmacaoId:p.precoConferenciaId,precoAnterior:100}]));
 const recovered=helper.recover(options(all,results));assert.equal(recovered.length,12);
 for(const [id,result] of recovered)results.set(id,result);
 const report=helper.report({snapshot:snapshot('2026-10-18T11:01:18Z',{resultados:[...results],conferidos:all.slice(0,379).map(p=>p.id)}),
  all,pending:all.slice(391),failures:all.slice(379).map(p=>({id:p.id,motivo:'janela bloqueada na tentativa anterior'})),unavailable:[],active:false,paused:false,generatedAt:'2026-10-18T12:00:00Z'});
 assert.equal(report.resumoAtual.conferidos,391);assert.equal(report.resumoAtual.restantes,142);assert.equal(report.conferidos.length,391);
 assert.equal(report.resultados.length,391);assert.equal(report.falhas.length,142);assert.equal(report.historicoConferidos.length,379);
});
test('script não consulta Firebase/rede, cria temporizadores ou remove histórico',()=>{
 assert.doesNotMatch(code.replace(/^\s*\/\/.*$/gm,''),/fetch\s*\(|XMLHttpRequest|setInterval|setTimeout|removeItem|indexedDB|firebase|token|secret/i);
});
test('integração recupera antes de renderizar fila e preserva conferência explícita de hoje',()=>{
 const panel=readFileSync(new URL('../painel-celular.html',import.meta.url),'utf8');
 const load=panel.slice(panel.indexOf('async function carregarFilaPrecosAssistida()'),panel.indexOf('async function salvarFilaPrecoAssistida('));
 assert.ok(load.indexOf('RDCAssistedReportRecovery.recover')<load.indexOf('renderizarFilaPrecosAssistida()'));
 assert.match(load,/reviewToday: filaPrecosDados.reconferirHoje/);
 assert.match(load,/automacaoPrecosFalhas.delete\(id\)/);
});
