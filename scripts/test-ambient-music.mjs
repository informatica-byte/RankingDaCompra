import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {protectPublicHtml} from './public-privacy.mjs';

const source = await readFile(new URL('../ambient-music.js', import.meta.url), 'utf8');
function fixture({saved=null, path='/', robots='', unsupported=false, fail=false, blockedStorage=false, deferred=false, layout='header', carry=null, referrer='', href='https://example.test/', navigationType='navigate'}={}) {
  const stored = new Map(saved === null ? [] : [['rdc-ambient-volume-v1', saved]]);
  const session = new Map(carry === null ? [] : [['rdc-ambient-navigation-v1',typeof carry==='string'?carry:JSON.stringify(carry)]]);
  const timeouts = new Map();
  const nodes = new Map(), docEvents = new Map(), winEvents = new Map(), intervals = new Map();
  const contexts = [], notes = [], ramps = [];
  let finishResume, placement;
  const element = () => ({
    attributes:{},textContent:'',value:'',events:new Map(),disabled:false,
    setAttribute(key, value) {this.attributes[key]=value;},
    addEventListener(name, handler) {this.events.set(name,handler);},
    async fire(name, event={}) {await this.events.get(name)?.(event);},
    querySelector(selector) {return nodes.get(selector.slice(1));},
    set innerHTML(value) {
      for (const id of ['rdc-music-toggle','rdc-music-volume','rdc-music-volume-value','rdc-music-status']) nodes.set(id,element());
      nodes.get('rdc-music-volume').value='20';
      nodes.get('rdc-music-status').textContent='Desligada. Só começa ao ativar; pausa ao sair da aba ou da página.';
    }
  });
  const document = {
    hidden:false,readyState:'complete',referrer,head:{appendChild(){}},
    body:{prepend(node){nodes.set(node.id,node);placement='body';}},
    getElementById:id=>nodes.get(id), createElement:element,
    querySelector:selector=>selector==='meta[name="robots"]'?{content:robots}
      :selector==='body > header'&&layout==='header'?{after(node){nodes.set(node.id,node);placement='after-header';}}
      :selector==='body > main, #app'&&layout==='main'?{before(node){nodes.set(node.id,node);placement='before-main';}}:null,
    addEventListener(name, handler){docEvents.set(name,handler);}
  };
  const param = () => ({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(value){ramps.push(value);}});
  class FakeContext {
    constructor(){if(fail)throw new Error('unavailable');this.state='suspended';this.currentTime=0;this.destination={};this.events=new Map();contexts.push(this);}
    addEventListener(name,handler){this.events.set(name,handler);}
    createGain(){return {gain:param(),connect(){},disconnect(){}};}
    createOscillator(){const note={frequency:{value:0},connect(){},disconnect(){},start(at){this.startAt=at;},stop(at){this.stopAt=at;}};notes.push(note);return note;}
    async resume(){if(deferred)await new Promise(resolve=>{finishResume=resolve;});this.state='running';}
    async suspend(){this.state='suspended';}
    async close(){this.state='closed';}
  }
  const window = {
    AudioContext:unsupported?undefined:FakeContext,
    setInterval(handler){const id=intervals.size+1;intervals.set(id,handler);return id;},
    clearInterval(id){intervals.delete(id);},
    setTimeout(handler){const id=timeouts.size+1;timeouts.set(id,handler);return id;},
    clearTimeout(id){timeouts.delete(id);},
    addEventListener(name,handler){winEvents.set(name,handler);}
  };
  const context={window,document,URL,performance:{getEntriesByType(){return [{type:navigationType}];}},location:{pathname:path,href,origin:new URL(href).origin},sessionStorage:{getItem(key){if(blockedStorage)throw new Error('storage blocked');return session.get(key)??null;},removeItem(key){session.delete(key);},setItem(key,value){if(blockedStorage)throw new Error('storage blocked');session.set(key,value);}},localStorage:{getItem(key){if(blockedStorage)throw new Error('storage blocked');return stored.get(key)??null;},setItem(key,value){if(blockedStorage)throw new Error('storage blocked');stored.set(key,value);}}};
  vm.runInNewContext(source,context);
  return {window,document,nodes,contexts,notes,stored,session,timeouts,ramps,intervals,docEvents,winEvents,get placement(){return placement;},runAgain(){vm.runInNewContext(source,context);},finishResume(){finishResume();}};
}

test('music is off by default, including with a saved volume; audio is created only on activation',async()=>{
  const f=fixture({saved:'37'});
  assert.equal(f.contexts.length,0);assert.equal(f.intervals.size,0);
  assert.match(f.nodes.get('rdc-music-status').textContent,/Desligada/);
  assert.equal(f.nodes.get('rdc-music-volume').value,'37');
  await f.nodes.get('rdc-music-toggle').fire('click');
  assert.equal(f.contexts.length,1);assert.equal(f.contexts[0].state,'running');
  assert.equal(f.nodes.get('rdc-music-toggle').textContent,'Pausar música');
  assert.equal(f.nodes.get('rdc-music-toggle').attributes['aria-pressed'],'true');
  assert.equal(f.intervals.size,1);assert.equal(f.notes.length,6);
  assert.ok(f.notes.every(n=>n.startAt>=0&&n.stopAt>n.startAt&&n.frequency.value>0));
});
test('pause suspends audio and scheduler; user can resume without another context',async()=>{
  const f=fixture(), button=f.nodes.get('rdc-music-toggle');
  await button.fire('click');await button.fire('click');
  assert.equal(f.contexts[0].state,'suspended');assert.equal(f.intervals.size,0);
  assert.equal(button.attributes['aria-pressed'],'false');
  await button.fire('click');assert.equal(f.contexts.length,1);assert.equal(f.intervals.size,1);
});
test('volume is bounded, can mute completely, and stores no playback state or unrelated data',async()=>{
  const f=fixture(), slider=f.nodes.get('rdc-music-volume');
  f.stored.set('firebase-auth-existing','preserved');
  await f.nodes.get('rdc-music-toggle').fire('click');
  for(const value of ['0','80','200','-3','invalid']){
    slider.value=value;await slider.fire('input');
    const expected=value==='invalid'?20:Math.max(0,Math.min(100,Number(value)));
    assert.equal(f.nodes.get('rdc-music-volume-value').textContent,expected+'%');
    assert.equal(f.stored.get('rdc-ambient-volume-v1'),String(expected));
    assert.equal(f.ramps.at(-1),expected/100*.3);
  }
  assert.equal(f.stored.get('firebase-auth-existing'),'preserved');
  assert.equal(f.stored.size,2);assert.ok(f.ramps.every(v=>v>=0&&v<=.3));
});
test('hidden tab and native video pause music; returning never automatically resumes',async()=>{
  const f=fixture();await f.nodes.get('rdc-music-toggle').fire('click');
  f.document.hidden=true;await f.docEvents.get('visibilitychange')();
  assert.equal(f.contexts[0].state,'suspended');assert.equal(f.intervals.size,0);
  f.document.hidden=false;await f.docEvents.get('visibilitychange')();
  assert.equal(f.contexts[0].state,'suspended');
  await f.nodes.get('rdc-music-toggle').fire('click');
  await f.docEvents.get('play')({target:{tagName:'VIDEO'}});
  assert.equal(f.contexts[0].state,'suspended');
});
test('leaving the page releases audio; restoration is paused and can be activated anew',async()=>{
  const f=fixture(), button=f.nodes.get('rdc-music-toggle');await button.fire('click');
  f.winEvents.get('pagehide')();assert.equal(f.contexts[0].state,'closed');assert.equal(f.intervals.size,0);
  assert.equal(button.textContent,'Continuar música');await button.fire('click');
  assert.equal(f.contexts.length,2);assert.equal(f.contexts[1].state,'running');
});
test('page hiding during startup cannot leave a late-playing context',async()=>{
  const f=fixture({deferred:true});const pending=f.nodes.get('rdc-music-toggle').fire('click');
  f.document.hidden=true;await f.docEvents.get('visibilitychange')();f.finishResume();await pending;
  assert.equal(f.contexts[0].state,'suspended');assert.equal(f.intervals.size,0);
  assert.equal(f.notes.length,0);
});
test('unsupported audio, storage refusal and audio startup errors never break navigation',async()=>{
  const unsupported=fixture({unsupported:true});assert.equal(unsupported.nodes.get('rdc-music-toggle').disabled,true);
  const blocked=fixture({blockedStorage:true});await blocked.nodes.get('rdc-music-toggle').fire('click');
  assert.equal(blocked.contexts[0].state,'running');
  const failed=fixture({fail:true});await failed.nodes.get('rdc-music-toggle').fire('click');
  assert.equal(failed.nodes.get('rdc-music-toggle').disabled,false);assert.match(failed.nodes.get('rdc-music-status').textContent,/Não foi possível/);
});
test('mount is idempotent, excludes administrative/noindex pages and has no network or analytics',()=>{
  const f=fixture();f.runAgain();assert.equal(f.nodes.size,5);assert.equal(f.contexts.length,0);
  for(const path of ['/dashboard.html','/painel-celular.html','/login.html','/admin/'])assert.equal(fixture({path}).nodes.size,0);
  assert.equal(fixture({robots:'noindex,follow'}).nodes.size,0);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|gtag\(|firebase\.|https?:\/\//);
  assert.doesNotMatch(source,/position:\s*(?:fixed|sticky)|autoplay|requestAnimationFrame/);
  assert.match(source,/min-height:44px/);assert.match(source,/aria-live="polite"/);
});
test('public generation adds one versioned music script and preserves existing content',()=>{
  const before='<html><head><meta name="robots" content="index,follow"></head><body><a href="https://meli.la/example">Preço: R$ 100</a></body></html>';
  const after=protectPublicHtml(before);
  assert.equal((after.match(/ambient-music\.js/g)||[]).length,1);
  assert.match(after,/defer src="\/ambient-music\.js\?v=20261022-3"/);
  assert.equal(protectPublicHtml(after),after);
  assert.ok(after.includes('<a href="https://meli.la/example">Preço: R$ 100</a>'));
  assert.doesNotMatch(protectPublicHtml('<html><head><meta name="robots" content="noindex,nofollow"></head></html>'),/ambient-music/);
});
test('compact player is below the header without changing navigation; volume starts collapsed',()=>{
  assert.equal(fixture().placement,'after-header');
  assert.equal(fixture({layout:'main'}).placement,'before-main');
  assert.equal(fixture({layout:'body'}).placement,'body');
  assert.match(source,/<details><summary>Volume<\/summary>/);
  assert.doesNotMatch(source,/<details\s+open|header\.append|header\.innerHTML|header\.prepend/);
  assert.match(source,/details\[open\]\{grid-column:1\/-1\}/);
  const prior='<html><head><script defer src="/ambient-music.js?v=20261022-1"></script></head><body>Preço original</body></html>';
  const after=protectPublicHtml(prior);
  assert.equal((after.match(/ambient-music\.js/g)||[]).length,1);
  assert.ok(after.includes('ambient-music.js?v=20261022-3'));
});

const settle = () => new Promise(resolve=>setImmediate(resolve));
const navClick = (f,href,attributes={},event={}) => f.docEvents.get('click')({button:0,target:{closest(){return {href,hasAttribute:key=>key in attributes,getAttribute:key=>attributes[key]??null};}},...event});
test('only an opted-in same-tab internal link hands music to the next public page',async()=>{
  const f=fixture({href:'https://example.test/#ofertas'});
  await f.nodes.get('rdc-music-toggle').fire('click');
  navClick(f,'https://example.test/produto/one.html');
  assert.equal(f.session.size,0); // Opening/copying another tab cannot inherit intent.
  f.document.hidden=true;await f.docEvents.get('visibilitychange')();
  f.winEvents.get('pagehide')();
  const carry=JSON.parse(f.session.get('rdc-ambient-navigation-v1'));
  assert.equal(carry.from,'https://example.test/');
  const next=fixture({carry,href:carry.to,path:'/produto/one.html',referrer:carry.from});
  await settle();
  assert.equal(next.contexts[0].state,'running');
  assert.equal(next.nodes.get('rdc-music-toggle').attributes['aria-pressed'],'true');
  assert.equal(next.session.size,0);assert.equal(next.timeouts.size,0);
});
test('new visits, reload, history restoration, external referrer and stale or invalid handoffs stay off',async()=>{
  const carry={from:'https://example.test/',to:'https://example.test/produto/one.html',at:Date.now()};
  const valid={carry,href:carry.to,path:'/produto/one.html',referrer:carry.from};
  for(const overrides of [{carry:null},{navigationType:'reload'},{navigationType:'back_forward'},
    {referrer:''},{referrer:'https://elsewhere.test/'},{href:'https://example.test/produto/two.html'},
    {carry:{...carry,at:Date.now()-31000}},{carry:{...carry,at:Date.now()+10000}},{carry:'bad JSON'},
    {blockedStorage:true},{path:'/dashboard.html'},{robots:'noindex,nofollow'}]){
    const f=fixture({...valid,...overrides});await settle();
    assert.equal(f.contexts.length,0,JSON.stringify(overrides));
  }
});
test('external, new-tab, modified, cancelled, hash and admin navigation never creates handoff',async()=>{
  for(const [href,attributes,event] of [
    ['https://elsewhere.test/p.html',{},{}],['https://example.test/p.html',{target:'_blank'},{}],
    ['https://example.test/p.html',{download:''},{}],['https://example.test/p.html',{}, {ctrlKey:true}],
    ['https://example.test/p.html',{}, {button:1}],['https://example.test/p.html',{}, {defaultPrevented:true}],
    ['https://example.test/#ofertas',{},{}],['https://example.test/dashboard.html',{},{}],
    ['https://example.test/data.json',{},{}]]){
    const f=fixture();await f.nodes.get('rdc-music-toggle').fire('click');
    navClick(f,href,attributes,event);f.winEvents.get('pagehide')();assert.equal(f.session.size,0,href);
  }
  const off=fixture();navClick(off,'https://example.test/p.html');off.winEvents.get('pagehide')();assert.equal(off.session.size,0);
});
test('manual pause and native media cancel navigation intent, back cache returns paused',async()=>{
  for(const action of ['pause','video']){
    const f=fixture();await f.nodes.get('rdc-music-toggle').fire('click');navClick(f,'https://example.test/p.html');
    if(action==='pause')await f.nodes.get('rdc-music-toggle').fire('click');
    else await f.docEvents.get('play')({target:{tagName:'VIDEO'}});
    f.winEvents.get('pagehide')();assert.equal(f.session.size,0);
  }
  const f=fixture();await f.nodes.get('rdc-music-toggle').fire('click');
  f.winEvents.get('pageshow')({persisted:true});assert.equal(f.contexts[0].state,'closed');assert.equal(f.intervals.size,0);
});
test('blocked automatic restart releases context and offers explicit continue without a late sound',async()=>{
  const carry={from:'https://example.test/',to:'https://example.test/p.html',at:Date.now()};
  const f=fixture({carry,href:carry.to,referrer:carry.from,deferred:true});
  assert.equal(f.contexts.length,1);assert.equal(f.notes.length,0);
  [...f.timeouts.values()][0]();await settle();
  assert.equal(f.contexts[0].state,'closed');assert.equal(f.intervals.size,0);
  assert.equal(f.nodes.get('rdc-music-toggle').textContent,'Continuar música');
  f.finishResume();await settle();assert.equal(f.notes.length,0);assert.equal(f.intervals.size,0);
});
