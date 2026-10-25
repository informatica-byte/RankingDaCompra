import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,deleteDoc,serverTimestamp} from 'firebase/firestore';
// Fail closed before initializing or clearing anything. No production project or endpoint.
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8089','Use somente o emulador local em 127.0.0.1:8089');
const rules=await readFile(new URL('../../firestore.rules',import.meta.url),'utf8');
const uid=rules.match(/request.auth.uid == '([^']+)'/)?.[1];
const email=rules.match(/request.auth.token.email == '([^']+)'/)?.[1];
assert.ok(uid&&email);
let env,anon,user,admin;
before(async()=>{
 env=await initializeTestEnvironment({projectId:'demo-ranking-audit',firestore:{host:'127.0.0.1',port:8089,rules}});
 anon=env.unauthenticatedContext().firestore();
 user=env.authenticatedContext('ordinary-user',{email:'ordinary@example.invalid'}).firestore();
 admin=env.authenticatedContext(uid,{email}).firestore();
});
after(async()=>{await env?.cleanup();});
const visit=()=>({criadoEm:serverTimestamp(),dia:'2026-10-25',origem:'/audit'});
test('conteúdo público continua legível; escrita exige administrador',async()=>{
 for(const collection of ['produtos','categorias','configuracoes']){
  await assertSucceeds(getDoc(doc(anon,collection,'sample')));
  for(const db of [anon,user])await assertFails(setDoc(doc(db,collection,'sample'),{titulo:'Fixture'}));
  await assertSucceeds(setDoc(doc(admin,collection,'sample'),{titulo:'Fixture'}));
  await assertSucceeds(deleteDoc(doc(admin,collection,'sample')));
 }
});
test('UID ou email isolados não concedem administração',async()=>{
 for(const [id,address] of [[uid,'wrong@example.invalid'],['other-user',email]]){
  const db=env.authenticatedContext(id,{email:address}).firestore();
  await assertFails(setDoc(doc(db,'produtos','wrong-admin'),{titulo:'Fixture'}));
 }
});
test('visita legítima passa; campos extras, comprimentos e timestamp falsos são negados',async()=>{
 await assertSucceeds(setDoc(doc(anon,'visitas','valid'),visit()));
 for(const [id,data] of [ ['extra',{...visit(),extra:true}],['oversized',{...visit(),origem:'x'.repeat(81)}],['date',{...visit(),dia:'invalid'}],['time',{...visit(),criadoEm:new Date(0)}],['missing',{dia:'2026-10-25',origem:'/audit'}] ])await assertFails(setDoc(doc(anon,'visitas',id),data));
 for(const db of [anon,user]){
  await assertFails(getDoc(doc(db,'visitas','valid')));
  await assertFails(updateDoc(doc(db,'visitas','valid'),{origem:'/changed'}));
  await assertFails(deleteDoc(doc(db,'visitas','valid')));
 }
 await assertSucceeds(getDoc(doc(admin,'visitas','valid')));
 await assertSucceeds(deleteDoc(doc(admin,'visitas','valid')));
});
test('evento comercial valida tipo e tamanho de campos',async()=>{
 const event={tipo:'clique_oferta',produtoId:'fixture',titulo:'Fixture',canal:'site',dia:'2026-10-25',criadoEm:serverTimestamp()};
 await assertSucceeds(setDoc(doc(anon,'visitas','event'),event));
 for(const [id,data] of [['type',{...event,tipo:'invented'}],['title',{...event,titulo:'x'.repeat(181)}],['extra',{...event,token:'fixture-not-a-token'}]])await assertFails(setDoc(doc(anon,'visitas','bad-'+id),data));
});
test('fila só aceita criação administrativa válida; cliente não altera ou exclui pedido',async()=>{
 const request={link:'https://produto.mercadolivre.com.br/MLB-1234567890',status:'pendente',criadoEm:serverTimestamp()};
 for(const db of [anon,user])await assertFails(setDoc(doc(db,'mlbSolicitacoes','request'),request));
 await assertFails(setDoc(doc(admin,'mlbSolicitacoes','extra'),{...request,extra:true}));
 await assertFails(setDoc(doc(admin,'mlbSolicitacoes','wrong-status'),{...request,status:'concluido'}));
 await assertSucceeds(setDoc(doc(admin,'mlbSolicitacoes','request'),request));
 await assertSucceeds(getDoc(doc(anon,'mlbSolicitacoes','request')));
 for(const db of [anon,user,admin]){
  await assertFails(updateDoc(doc(db,'mlbSolicitacoes','request'),{status:'concluido'}));
  await assertFails(deleteDoc(doc(db,'mlbSolicitacoes','request')));
 }
});
test('coleções desconhecidas permanecem negadas inclusive ao cliente administrador',async()=>{
 for(const db of [anon,user,admin]){
  await assertFails(getDoc(doc(db,'unknown','sample')));
  await assertFails(setDoc(doc(db,'unknown','sample'),{value:1}));
 }
});
