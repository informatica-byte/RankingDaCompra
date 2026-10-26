import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import pause from '../pending-review-pause.js';

async function fixture(){
 const rows=pause.TARGETS.map(t=>({id:t.id,data:{titulo:t.label,link:'https://www.mercadolivre.com.br/p/MLB12345678?wid=MLB1234567890',linkAfiliado:'https://meli.la/Fixture',foto:'https://http2.mlstatic.com/fixture.jpg',preco:'99,90',precoAnterior:'150,00',precoPromocional:'89,90',precoConferenciaId:'preservado',historicoAnuncios:[{id:'anterior'}]}}));
 const manifest=await Promise.all(rows.map(async r=>({...pause.TARGETS.find(t=>t.id===r.id),digest:await pause.fingerprint(r.data)})));
 return {rows,manifest};
}
function adapterFor(rows){
 const store=new Map(rows.map(r=>[r.id,structuredClone(r.data)])),reads=[],writes=[],busy=[];
 const state={uid:'owner',blocked:false,transactions:0};
 const adapter={session:()=>state.uid,assertReady(){if(state.blocked)throw Error('busy');},busy:v=>busy.push(v),timestamp:()=> 'SERVER_TIMESTAMP',
  transaction:async work=>{state.transactions++;const staged=[];const result=await work({get:async id=>{assert.equal(staged.length,0,'all reads precede writes');reads.push(id);return {id,data:store.get(id)||null};},update:(id,patch)=>staged.push({id,patch})});for(const w of staged){writes.push(w);Object.assign(store.get(w.id),w.patch);}return result;}};
 return {adapter,store,reads,writes,busy,state};
}
test('allowlist has exactly 21 immutable reviewed IDs, no broad matching',()=>{
 assert.equal(pause.TARGETS.length,21);assert.equal(new Set(pause.TARGETS.map(t=>t.id)).size,21);
 assert.ok(Object.isFrozen(pause.TARGETS));assert.ok(pause.TARGETS.every(Object.isFrozen));
 assert.equal(pause.TARGETS.filter(t=>t.label.startsWith('Starlink')).length,4);
 assert.equal(pause.TARGETS.filter(t=>t.label.startsWith('Galaxy')).length,4);
});
test('identity digest is independently reproducible and excludes price and proof fields',async()=>{
 const {rows}=await fixture(),p=rows[0].data;
 const json=JSON.stringify([p.titulo.normalize('NFC').trim(),p.link,p.linkAfiliado,p.foto]);
 assert.equal(await pause.fingerprint(p),createHash('sha256').update(json).digest('hex'));
 assert.equal(await pause.fingerprint({...p,preco:'7,00',precoConferenciaId:'outra'}),await pause.fingerprint(p));
});
test('atomic pause reads only 21 records and changes only the two pause fields',async()=>{
 const {rows,manifest}=await fixture(),original=JSON.stringify(rows),c=adapterFor(rows);
 const result=await pause.commitPause(c.adapter,manifest);
 assert.equal(c.reads.length,21);assert.equal(c.writes.length,21);assert.equal(result.pauseIds.length,21);
 for(const w of c.writes){assert.ok(pause.TARGETS.some(t=>t.id===w.id));assert.deepEqual(Object.keys(w.patch).sort(),['conferenciaPausada','conferenciaPausadaEm']);assert.equal(w.patch.conferenciaPausada,true);const saved={...c.store.get(w.id)};delete saved.conferenciaPausada;delete saved.conferenciaPausadaEm;assert.deepEqual(saved,rows.find(r=>r.id===w.id).data);}
 assert.equal(JSON.stringify(rows),original);assert.deepEqual(c.busy,[true,false]);
});
test('already paused entries are idempotent and their pause date is not reset',async()=>{
 const {rows,manifest}=await fixture();rows[0].data.conferenciaPausada=true;rows[0].data.conferenciaPausadaEm='ORIGINAL';const c=adapterFor(rows);
 const first=await pause.commitPause(c.adapter,manifest);assert.equal(first.alreadyPausedIds.length,1);assert.equal(c.writes.length,20);assert.equal(c.store.get(rows[0].id).conferenciaPausadaEm,'ORIGINAL');
 const again=await pause.commitPause(c.adapter,manifest);assert.equal(again.pauseIds.length,0);assert.equal(c.writes.length,20);
});
for(const field of ['titulo','link','linkAfiliado','foto'])test('changed identity aborts the complete transaction: '+field,async()=>{
 const {rows,manifest}=await fixture(),c=adapterFor(rows);c.store.get(rows[20].id)[field]+='changed';
 await assert.rejects(pause.commitPause(c.adapter,manifest),/alterado desde a revisão/);assert.equal(c.writes.length,0);assert.deepEqual(c.busy,[true,false]);
});
test('missing record is never recreated and no partial writes are committed',async()=>{
 const {rows,manifest}=await fixture(),c=adapterFor(rows);c.store.delete(rows[20].id);
 await assert.rejects(pause.commitPause(c.adapter,manifest),/Cadastro ausente/);assert.equal(c.writes.length,0);assert.equal(c.store.size,20);
});
test('invalid manifests and incomplete/duplicated results cannot select other records',async()=>{
 const {rows,manifest}=await fixture();
 for(const bad of [manifest.slice(1),[...manifest.slice(1),manifest[1]],manifest.map((m,i)=>i?m:{...m,id:'outside'})])await assert.rejects(pause.planPauses(rows,bad),/Lista de revisão inválida/);
 for(const bad of [rows.slice(1),[...rows.slice(1),rows[1]]])await assert.rejects(pause.planPauses(bad,manifest),/Leitura incompleta/);
});
test('logout before confirmation, busy workflow or permission failure never writes',async()=>{
 const {rows,manifest}=await fixture();
 for(const mode of ['logout','busy','permission']){const c=adapterFor(rows);if(mode==='logout')c.state.uid='';if(mode==='busy')c.state.blocked=true;if(mode==='permission')c.adapter.transaction=async()=>{throw Error('permission-denied');};await assert.rejects(pause.commitPause(c.adapter,manifest));assert.equal(c.writes.length,0);}
});
test('session swap during reads is rejected before the first update',async()=>{
 const {rows,manifest}=await fixture(),c=adapterFor(rows),run=c.adapter.transaction;c.adapter.transaction=work=>run(async tx=>{const get=tx.get;tx.get=async id=>{const value=await get(id);c.state.uid='another-owner';return value;};return work(tx);});
 await assert.rejects(pause.commitPause(c.adapter,manifest),/sessão mudou/);assert.equal(c.writes.length,0);
});
test('refused operation does not unlock another save or touch its busy state',async()=>{
 const {rows,manifest}=await fixture(),c=adapterFor(rows);c.state.blocked=true;
 await assert.rejects(pause.commitPause(c.adapter,manifest));assert.deepEqual(c.busy,[]);assert.equal(c.state.blocked,true);
});
test('duplicate clicks do not start a second transaction',async()=>{
 const {rows,manifest}=await fixture(),c=adapterFor(rows),run=c.adapter.transaction;let release;const gate=new Promise(r=>release=r);c.adapter.transaction=async work=>{await gate;return run(work);};
 const first=pause.commitPause(c.adapter,manifest);await assert.rejects(pause.commitPause(c.adapter,manifest),/já está sendo salva/);release();await first;assert.equal(c.state.transactions,1);
});

function dom(){
 class Node{constructor(tag,ownerDocument){this.tag=tag;this.ownerDocument=ownerDocument;this.children=[];this.listeners={};this.style={};this.checked=false;this.disabled=false;this.textContent='';}append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this[k]=v;}addEventListener(k,fn){this.listeners[k]=fn;}}
 const document={createElement:tag=>new Node(tag,document),createTextNode:text=>({textContent:text})};const container=new Node('div',document);
 const all=()=>{const out=[];const visit=n=>{out.push(n);for(const c of n.children||[])visit(c);};visit(container);return out;};return {container,all,byId:id=>all().find(n=>n.id===id)};
}
test('mount, prepare and cancellation make no reads or writes; explicit checkbox is required',async()=>{
 const {rows}=await fixture(),c=adapterFor(rows),d=dom();pause.mount(d.container,c.adapter);assert.equal(c.reads.length,0);
 d.byId('revisao-pausa-preparar').listeners.click();assert.equal(c.reads.length,0);assert.equal(d.byId('revisao-pausa-confirmar').disabled,true);
 await d.byId('revisao-pausa-confirmar').listeners.click();assert.equal(c.reads.length,0);
 d.byId('revisao-pausa-confirmacao').checked=true;d.byId('revisao-pausa-confirmacao').listeners.change();assert.equal(d.byId('revisao-pausa-confirmar').disabled,false);
 d.all().find(n=>n.textContent==='Cancelar sem salvar').listeners.click();assert.equal(c.reads.length,0);assert.equal(c.writes.length,0);assert.equal(d.byId('revisao-pausa-confirmar').disabled,true);
});
test('UI review is invalidated by logout/session change and all labels use textContent',async()=>{
 const {rows}=await fixture(),c=adapterFor(rows),d=dom(),ui=pause.mount(d.container,c.adapter);d.byId('revisao-pausa-preparar').listeners.click();c.state.uid='';ui.refresh();assert.equal(d.byId('revisao-pausa-preparar').disabled,true);await d.byId('revisao-pausa-confirmar').listeners.click();assert.equal(c.reads.length,0);
 const source=readFileSync(new URL('../pending-review-pause.js',import.meta.url),'utf8');assert.doesNotMatch(source,/innerHTML|fetch\(|localStorage|setInterval|setTimeout|deleteDoc|addDoc/);
});

const html=readFileSync(new URL('../painel-celular.html',import.meta.url),'utf8');
const integration=html.slice(html.indexOf('const pausaRevisaoMovel ='),html.indexOf('onAuthStateChanged(auth, async (u) =>'));
function panel(){
 let adapter;const local={id:pause.TARGETS[0].id,preco:'99,90',precoConferenciaId:'old'};const progress=new Set([local.id]);
 const context=vm.createContext({window:{RDCPendingReviewPause:{TARGETS:pause.TARGETS,mount:(_el,a)=>{adapter=a;return {refresh(){}};}}},$:()=>null,auth:{currentUser:{uid:'owner'}},automacaoPrecosAtiva:false,automacaoPrecosPausada:false,filaPrecosSalvando:false,publicacaoExpressaEmAndamento:false,cadastroExistenteExpressa:{isBusy:()=>false},ofertasRelampagoExistentesMovel:{isBusy:()=>false},serverTimestamp:()=> 'SERVER',db:{},doc:(_db,col,id)=>({col,id}),runTransaction:async(_db,work)=>work({get:async ref=>({exists:()=>true,data:()=>({titulo:ref.id})}),update(){}}),atualizarControlesAutomacaoPrecos(){},filaPrecosDados:{todos:[local],produtos:[local]},rankingDadosMovel:null,produtosRelampagoCacheMobile:null,filaPrecosIdAtual:local.id,filaPrecosConferidos:progress,guardarPosicaoFilaPrecos(){},renderizarFilaPrecosAssistida(){}});
 vm.runInContext(integration,context);return {adapter,context,local,progress};
}
test('panel adapter keeps auth, transaction and exact two-field/21-ID scope',async()=>{
 const c=panel();for(const key of ['automacaoPrecosAtiva','automacaoPrecosPausada','filaPrecosSalvando','publicacaoExpressaEmAndamento']){c.context[key]=true;assert.throws(()=>c.adapter.assertReady(false));c.context[key]=false;}
 c.context.filaPrecosSalvando=true;assert.doesNotThrow(()=>c.adapter.assertReady(true));c.context.filaPrecosSalvando=false;
 await assert.rejects(c.adapter.transaction(tx=>tx.get('outside')),/fora da lista/);
 await assert.rejects(c.adapter.transaction(tx=>tx.update(pause.TARGETS[0].id,{preco:'1,00'})),/fora do escopo/);
 assert.match(html,/pending-review-pause\.js\?v=20261026-1/);assert.match(html,/pausaRevisaoMovel.refresh\(\)/);
});
test('local acknowledgement preserves confirmed IDs, prices, proof and old pause dates',()=>{
 const c=panel();c.adapter.committed({pauseIds:[c.local.id],alreadyPausedIds:[]});assert.equal(c.local.conferenciaPausada,true);assert.equal(c.local.preco,'99,90');assert.equal(c.local.precoConferenciaId,'old');assert.equal(c.progress.has(c.local.id),true);assert.equal(c.context.filaPrecosIdAtual,'');
 const before=c.local.conferenciaPausadaEm;c.adapter.committed({pauseIds:[],alreadyPausedIds:[c.local.id]});assert.equal(c.local.conferenciaPausadaEm,before);
 assert.doesNotMatch(integration,/\.delete\(|\.clear\(|preco\s*=/);
});
