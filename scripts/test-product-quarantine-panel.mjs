import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import q from '../product-quarantine.js';
import removal from '../product-removal-safety.js';

const source=await readFile(new URL('../product-quarantine-panel.js',import.meta.url),'utf8');
class Node {
 constructor(){this.dataset={};this.children=[];this.textContent='';this.disabled=false;this.hidden=false;}
 matches(selector){return selector==='[data-quarantine]'?'quarantine' in this.dataset:selector==='[data-quarantine-info]'?'quarantineInfo' in this.dataset:false;}
 querySelector(selector){return this.children.find(n=>n.matches(selector))||this.children.map(n=>n.querySelector(selector)).find(Boolean)||null;}
 append(node){this.children.push(node);}
 before(node){this.parent?.children.push(node);}
 closest(selector){return this.matches(selector)?this:null;}
}
async function fixture(statuses=['available','unavailable',null]){
 const products=new Map(),stored=new Map(),cards=[],writes=[],dialogs=[],messages=[];let busy=false,reads=0;
 const filter=new Node(),results=new Node(),listeners=new Map();
 const host={querySelector:s=>s==='[data-audit-filter]'?filter:results,querySelectorAll:()=>cards,addEventListener:(name,fn)=>listeners.set(name,fn)};
 for(const [i,status] of statuses.entries()){
  const id='demo'+i,p={id,titulo:'Produto fictício '+i,link:'https://produto.mercadolivre.com.br/MLB-'+(1234567890+i)+'-exemplo-_JM',linkAfiliado:'https://meli.la/demo'+i,foto:'https://http2.mlstatic.com/demo.jpg',preco:123+i};
  products.set(id,q.project(p));stored.set(id,structuredClone(p));
  const card=new Node(),box=new Node();card.dataset.auditRow=id+':mercado_livre';box.parent=card;card.children.push(box);
  const lookup=card.querySelector.bind(card);card.querySelector=s=>s==='.link-audit-result-actions'?box:lookup(s);cards.push(card);
 }
 const config={confirm:true,prompt:id=>'QUARENTENA 40 '+id};
 const adapter={authorize:()=> 'fixture-owner',read:async id=>{reads++;return stored.get(id);},now:()=>Date.now(),serverNow:async()=>Date.now(),timestamp:()=> 'fixture-time',transact:async(id,work)=>{
  const ops=[];const out=await work({read:async()=>stored.get(id),update:p=>ops.push(p),registry:async()=>{throw Error('Não ler registro de exclusões');},saveRegistry:()=>{throw Error('Não gravar registro de exclusões');},removeProduct:()=>{throw Error('Não excluir');}});
  for(const patch of ops){stored.set(id,{...stored.get(id),...patch});writes.push({id,patch});}return out;
 }};
 const api=q.create(adapter),root={RDCProductQuarantine:q,RDCProductRemoval:removal,RDCProductQuarantineAccess:api,dispatchEvent(){}};
 const context=vm.createContext({window:root,document:{createElement:()=>new Node()},MutationObserver:class{observe(){}},Event:class{},confirm:text=>{dialogs.push(text);return config.confirm;},prompt:text=>{dialogs.push(text);return config.prompt(text.split(' ').at(-1));}});
 vm.runInContext(source,context);
 const panel=root.RDCProductQuarantinePanel.mount({host,product:id=>products.get(id),result:key=>{const i=Number(key.split(':')[0].slice(4));return statuses[i]?{status:statuses[i]}:null;},busy:()=>busy,adopt:async p=>{products.set(p.id,p);},remove:()=>{throw Error('Não excluir');},status:text=>messages.push(text)});
 panel.decorate();
 return {panel,products,stored,cards,writes,dialogs,messages,config,adapter,root,get reads(){return reads;},set busy(value){busy=value;panel.decorate();},button:i=>cards[i].querySelector('[data-quarantine]'),click:async i=>listeners.get('click')({target:cards[i].querySelector('[data-quarantine]')})};
}

test('todos os estados e itens ainda não lidos têm botão; renderizar não lê nem grava cadastros',async()=>{
 const f=await fixture(['available','unavailable','security','login','error','unverified',null]);
 for(let i=0;i<f.cards.length;i++){assert.ok(f.button(i));assert.equal(f.button(i).hidden,false);assert.equal(f.button(i).disabled,false);assert.match(f.button(i).textContent,/40 dias/);}
 assert.equal(f.reads,0);assert.equal(f.writes.length,0);assert.equal(f.dialogs.length,0);
});
test('escolha manual aceita três cadastros seguidos sem indisponibilidade prévia e sem alterar preços, links ou relatório',async()=>{
 const f=await fixture(['available','security',null]),before=structuredClone([...f.stored]);
 for(let i=0;i<3;i++){await f.click(i);assert.equal(f.panel.isBusy(),false);assert.equal(f.button(i).textContent,'Cancelar quarentena');assert.equal(f.button((i+1)%3).disabled,false);}
 assert.equal(f.writes.length,3);
 for(const [id,p]of before){const saved=f.stored.get(id);for(const key of ['titulo','foto','preco','link','linkAfiliado'])assert.equal(saved[key],p[key]);assert.equal(q.state(saved).active,true);assert.equal(q.state(saved).remainingDays,40);assert.equal(saved.conferenciaPausada,true);}
 assert.match(f.dialogs[0],/mesmo que esteja disponível ou ainda não conferido/);assert.match(f.dialogs[0],/não declara o anúncio indisponível/);assert.match(f.dialogs[0],/somente após nova leitura segura do mesmo MLB/);
});
test('confirmação negada ou frase incorreta não colocam produto em quarentena',async()=>{
 for(const mode of ['cancel','wrong-phrase']){const f=await fixture(['available']);if(mode==='cancel')f.config.confirm=false;else f.config.prompt=()=> 'SIM';await f.click(0);assert.equal(f.writes.length,0);assert.equal(f.panel.isBusy(),false);assert.equal(f.button(0).disabled,false);assert.equal(q.state(f.stored.get('demo0')).active,false);}
});
test('operações em andamento e gravações simultâneas bloqueiam todos os botões até concluir',async()=>{
 const f=await fixture(['available','available']);f.busy=true;await f.click(0);assert.equal(f.reads,0);assert.equal(f.writes.length,0);f.busy=false;
 let release;f.adapter.read=()=>new Promise(resolve=>{release=()=>resolve(f.stored.get('demo0'));});
 const pending=f.click(0);assert.equal(f.panel.isBusy(),true);assert.equal(f.button(1).disabled,true);await f.click(1);release();await pending;
 assert.equal(f.writes.length,1);assert.equal(f.button(1).disabled,false);
});
test('sessão ausente, cadastro alterado e original sem MLB continuam recusados na entrada manual',async()=>{
 for(const mode of ['session','changed','missing-mlb']){const f=await fixture(['available']);
  if(mode==='session')f.adapter.authorize=()=>null;
  if(mode==='changed')f.stored.get('demo0').titulo='Outro produto';
  if(mode==='missing-mlb'){f.stored.get('demo0').link='https://www.mercadolivre.com.br/p/MLB23997257';f.products.set('demo0',q.project(f.stored.get('demo0')));}
  await f.click(0);assert.equal(f.writes.length,0,mode);assert.match(f.messages.at(-1),/Quarentena não alterada/);assert.equal(f.button(0).disabled,false);
 }
});
test('cancelamento manual restaura a pausa anterior sem reiniciar prazo ou excluir dados',async()=>{
 const f=await fixture(['available']);await f.click(0);const started=f.stored.get('demo0').quarentenaAnuncio.startedAt;
 f.panel.decorate();assert.equal(f.stored.get('demo0').quarentenaAnuncio.startedAt,started);await f.click(0);
 assert.equal(f.writes.length,2);assert.equal(q.state(f.stored.get('demo0')).active,false);assert.equal(f.stored.get('demo0').conferenciaPausada,false);assert.equal(f.stored.get('demo0').preco,123);
});
test('ambos os painéis carregam a mesma versão nova da interface, sem mudar o motor seguro',async()=>{
 for(const file of ['dashboard.html','painel-celular.html']){const html=await readFile(new URL('../'+file,import.meta.url),'utf8');assert.match(html,/product-quarantine-panel\.js\?v=20261027-2/);assert.match(html,/product-quarantine\.js\?v=20261027-1/);}
});
