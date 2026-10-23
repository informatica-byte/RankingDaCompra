import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
const require=createRequire(import.meta.url);
require('../product-save-safety.js');
const flash=require('../flash-offer-safety.js');
const existing=require('../existing-flash-offer.js');
const now=Date.parse('2026-10-16T14:00:00Z');
const product=()=>({titulo:'Controle Bluetooth PC e Android',link:'https://www.mercadolivre.com.br/p/MLB123456',linkAfiliado:'https://meli.la/Exemplo',foto:'https://http2.mlstatic.com/foto.webp',preco:'120,00',comentario:'Análise editorial preservada.',categoria:'informatica',pros:'Pontos positivos originais',contras:'Limitações originais',historicoAnuncios:[{id:'anterior'}],conferenciaPausada:false});
const input=()=>({current:'100,00',regular:'150,00',duration:'03:30:00',confirmed:true,keepDeadline:false});
const options=()=>({now,timestamp:new Date(now),confirmationId:'confirmed-existing-1'});

test('ativa oferta no produto existente sem alterar identidade, análise, preço normal ou histórico',()=>{
 const original=product(),before=JSON.stringify(original),patch=existing.buildPatch(original,input(),options());
 assert.equal(JSON.stringify(original),before);
 assert.equal(patch.ofertaRelampagoAtiva,true);assert.equal(patch.precoPromocional,'100,00');
 assert.equal(patch.ofertaRelampagoTerminaEm,'2026-10-16T17:30:00.000Z');
 for(const key of ['id','titulo','link','linkAfiliado','foto','comentario','preco','categoria','pros','contras','historicoAnuncios','dataCadastro'])assert.equal(Object.hasOwn(patch,key),false,key);
 assert.equal(flash.evaluate({...original,...patch},null,now+1).eligible,true);
});
test('confirmação é humana e vinculada ao preço promocional correto, sem atribuir a uma IA',()=>{
 const patch=existing.buildPatch(product(),input(),options());
 assert.equal(patch.precoConferenciaCampo,'precoPromocional');assert.equal(patch.precoConferenciaValor,100);
 assert.equal(patch.precoConferenciaId,'confirmed-existing-1');assert.equal(patch.precoConferidoPor,'manual_oferta_relampago');assert.equal(patch.precoConferidoPorIA,false);
 assert.equal(flash.evaluate({...product(),...patch},null,now+86400001).eligible,false);
});
test('não inventa confirmação, desconto ou preço anterior',()=>{
 for(const change of [{confirmed:false},{confirmed:'true'},{regular:''},{current:0},{current:'-1'},{current:'abc'},{regular:100},{current:100,regular:100.1}])assert.throws(()=>existing.buildPatch(product(),{...input(),...change},options()));
 assert.throws(()=>existing.buildPatch(product(),input(),{...options(),confirmationId:''}));
});
test('prazo precisa ser informado corretamente, não se renova sozinho e não aceita minuto inválido',()=>{
 for(const value of ['', '03:60:00', '00:00:30','12:15','-01:00:00'])assert.throws(()=>existing.buildPatch(product(),{...input(),duration:value},options()));
 assert.equal(existing.duration('01:02:03'),3723);
});
test('preserva o horário final ao reaproveitar oferta existente sem editar o prazo',()=>{
 const original={...product(),ofertaRelampagoAtiva:true,ofertaRelampagoTerminaEm:'2026-10-16T18:00:00.000Z'};
 const patch=existing.buildPatch(original,{...input(),keepDeadline:true},options());
 assert.equal(patch.ofertaRelampagoTerminaEm,original.ofertaRelampagoTerminaEm);
 assert.equal(existing.remaining(original.ofertaRelampagoTerminaEm,now),'04:00:00');
 assert.throws(()=>existing.buildPatch({...original,ofertaRelampagoTerminaEm:'2026-10-16T13:00:00Z'},{...input(),keepDeadline:true},options()),/venceu/);
});
test('não recria cadastro excluído nem ativa produto pausado ou sem links',()=>{
 for(const original of [null,{...product(),conferenciaPausada:true},{...product(),indisponivel:true},{...product(),ativo:false},{...product(),linkAfiliado:''},{...product(),link:'javascript:alert(1)'},{...product(),sistema:true}])assert.throws(()=>existing.buildPatch(original,input(),options()));
 assert.throws(()=>existing.assertCurrent(null,product(),existing.buildPatch(product(),input(),options())),/excluído/);
});
test('conflito de outra sessão em preço, link, prazo, identidade ou confirmação impede gravação',()=>{
 const original=product(),patch=existing.buildPatch(original,input(),options());
 for(const change of [{titulo:'Outro produto'},{link:'https://example.com/outro'},{preco:'119,00'},{ofertaRelampagoTerminaEm:'2030-01-01T00:00:00Z'},{precoConferenciaId:'outra-confirmacao'},{conferenciaPausada:true}])assert.throws(()=>existing.assertCurrent({...original,...change},original,patch),/outra sessão/);
 assert.doesNotThrow(()=>existing.assertCurrent({...original,comentario:'Revisão editorial concorrente preservada'},original,patch));
});
test('busca usa nome ou código com acentos normalizados, sem mutar a lista',()=>{
 const data=[{id:'a',titulo:'Fone Áudio',mercadoLivreItemId:'MLB987654321'},{id:'b',titulo:'Controle'},{id:'x',titulo:'Sistema',sistema:true}];
 assert.deepEqual(existing.search(data,'audio').map(p=>p.id),['a']);assert.deepEqual(existing.search(data,'987654321').map(p=>p.id),['a']);assert.equal(existing.search(data,'').length,2);assert.equal(data.length,3);
});

function adapterFixture(panel){
 const mobile=panel==='mobile';const html=readFileSync(mobile?'painel-celular.html':'dashboard.html','utf8');
 const start=html.indexOf(mobile?'      let produtosRelampagoCacheMobile = null;':'        function autorizarOfertaExistenteDashboard()');
 const end=html.indexOf(mobile?'      function lista(v) {':'        // Evita que texto salvo',start);
 assert.ok(start>0&&end>start);const source=html.slice(start,end),records=new Map([['existing-id',product()]]),counts={list:0,read:0,update:0},context={};
 let hooks;const snapshot=id=>({id,exists:mobile?()=>records.has(id):records.has(id),data:()=>records.get(id)});
 const reference=id=>({id,get:async()=>{counts.read++;return snapshot(id);}});
 const list=()=>({docs:[...records].map(([id,data])=>({id,data:()=>data}))});
 const db={collection:()=>({doc:reference,get:async()=>{counts.list++;return list();}}),runTransaction:async fn=>fn({get:async ref=>snapshot(ref.id),update:(ref,changes)=>{counts.update++;records.set(ref.id,{...records.get(ref.id),...changes});}})};
 Object.assign(context,{auth:{currentUser:{uid:'owner'}},db,crypto:{randomUUID:()=> 'fixture-confirmation'},firebase:{firestore:{FieldValue:{serverTimestamp:()=>new Date(now)}}},serverTimestamp:()=>new Date(now),getDocs:async()=>{counts.list++;return list();},collection:()=>({}),doc:(_db,_collection,id)=>reference(id),getDoc:async ref=>{counts.read++;return snapshot(ref.id);},runTransaction:(_db,fn)=>db.runTransaction(fn),$:()=>({}),document:{getElementById:()=>({})},window:{RDCExistingFlashOffer:{...existing,mount:(_host,h)=>{hooks=h;return{reset(){},isBusy:()=>false};}},RDCPricePublication:{saved(){}}},automacaoPrecosAtiva:false,filaPrecosSalvando:false,publicacaoExpressaEmAndamento:false,cadastroExistenteExpressa:{isBusy:()=>false},filaPrecosDados:null,rankingDadosMovel:null,salvandoProduto:false,conferenciaPrecoIAEmAndamento:false,correcaoLoteEmAndamento:false,snapshotProdutosBackup:null,produtosCentralAtual:[]});
 if(mobile){
   context.getDocsFromServer=context.getDocs;
   runInNewContext(readFileSync('admin-read-economy.js','utf8'),context);
   context.economiaLeiturasMovel=context.window.RDCAdminReadEconomy.create({session:()=>context.auth.currentUser?.uid});
   const helperStart=html.indexOf('      function lerProdutosParaModulosMovel('),helperEnd=html.indexOf('      let cats =',helperStart);
   assert.ok(helperStart>0&&helperEnd>helperStart);
   runInNewContext(html.slice(helperStart,helperEnd),context);
 }
 runInNewContext(source,context);
 return{source,hooks,records,counts,context};
}
for(const panel of ['mobile','dashboard']){
 test(panel+': botão é montado sem consulta automática nem gravação e usa transação de atualização',()=>{
  const f=adapterFixture(panel);assert.deepEqual(f.counts,{list:0,read:0,update:0});assert.doesNotMatch(f.source,/addDoc|transaction\.set|\.add\(|getGenerativeModel|obterMetricas/);assert.match(f.source,/transaction\.update\(ref, changes\)/);
 });
 test(panel+': salvar mantém exatamente o mesmo documento e todos os campos não relacionados',async()=>{
  const f=adapterFixture(panel);await f.hooks.loadProducts();const baseline=await f.hooks.read('existing-id');await f.hooks.save('existing-id',baseline,input());
  assert.equal(f.records.size,1);assert.equal(f.counts.update,1);assert.equal(f.records.get('existing-id').titulo,baseline.titulo);assert.equal(f.records.get('existing-id').linkAfiliado,baseline.linkAfiliado);assert.deepEqual(f.records.get('existing-id').historicoAnuncios,baseline.historicoAnuncios);
 });
 test(panel+': produto alterado ou excluído após abrir não é sobrescrito nem recriado',async()=>{
  const f=adapterFixture(panel),baseline=await f.hooks.read('existing-id');f.records.set('existing-id',{...baseline,preco:'999,00'});await assert.rejects(f.hooks.save('existing-id',baseline,input()),/outra sessão/);assert.equal(f.counts.update,0);
  f.records.delete('existing-id');await assert.rejects(f.hooks.save('existing-id',baseline,input()),/excluído/);assert.equal(f.records.size,0);
 });
 test(panel+': sessão encerrada e conferência em execução impedem acesso e gravação',async()=>{
  const f=adapterFixture(panel);f.context.auth.currentUser=null;await assert.rejects(f.hooks.loadProducts(),/Entre/);assert.equal(f.counts.list,0);
  f.context.auth.currentUser={uid:'owner'};f.context[panel==='mobile'?'automacaoPrecosAtiva':'conferenciaPrecoIAEmAndamento']=true;await assert.rejects(f.hooks.read('existing-id'),/pause/);assert.equal(f.counts.read,0);
 });
}
test('integração nos dois painéis usa o mesmo componente e CSS responsivo sem formulários aninhados',()=>{
 for(const file of ['painel-celular.html','dashboard.html']){const html=readFileSync(file,'utf8');assert.match(html,/existing-flash-offer\.css\?v=20261016-1/);assert.match(html,/existing-flash-offer\.js\?v=20261016-1/);assert.match(html,/RDCExistingFlashOffer\.mount/);}
 const source=readFileSync('existing-flash-offer.js','utf8');assert.doesNotMatch(source,/<form\b/);assert.match(source,/type="button" data-save/);assert.match(source,/\.textContent = String\(product\.titulo\)/);assert.match(readFileSync('existing-flash-offer.css','utf8'),/grid-template-columns:1fr/);
});
