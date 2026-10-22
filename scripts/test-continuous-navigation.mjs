import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {protectPublicHtml} from './public-privacy.mjs';
const source = await readFile(new URL('../continuous-navigation.js',import.meta.url),'utf8');

function fixture() {
  const timers=new Map(), replacements=[], assignments=[], pushes=[], observers=[];
  let root, frame;
  class Node {
    constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.childNodes=[];this.attributes={};this.events=new Map();this.dataset={};this.style={setProperty(){}};this.textContent='';}
    setAttribute(key,value){this.attributes[key]=value;}
    getAttribute(key){return this.attributes[key]??null;}
    hasAttribute(key){return key in this.attributes;}
    addEventListener(name,fn){this.events.set(name,fn);}
    appendChild(node){node.remove();this.childNodes.push(node);node.parentNode=this;node.ownerDocument=this.ownerDocument;return node;}
    prepend(node){node.remove();this.childNodes.unshift(node);node.parentNode=this;node.ownerDocument=this.ownerDocument;}
    after(node){const parent=this.parentNode;node.remove();parent.childNodes.splice(parent.childNodes.indexOf(this)+1,0,node);node.parentNode=parent;node.ownerDocument=parent.ownerDocument;}
    before(node){const parent=this.parentNode;node.remove();parent.childNodes.splice(parent.childNodes.indexOf(this),0,node);node.parentNode=parent;node.ownerDocument=parent.ownerDocument;}
    remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(n=>n!==this);this.parentNode=null;}
    querySelectorAll(selector){return this.childNodes.filter(n=>n.selector===selector);}
    focus(){this.focused=true;}
    scrollIntoView(){this.scrolled=true;}
  }
  const makeLocation = href => {
    const url=new URL(href);
    return {href:url.href,origin:url.origin,pathname:url.pathname,assign(to){assignments.push(to);},replace(to){replacements.push(to);frame.contentDocument=makeDocument(to);frame.contentWindow=frame.contentDocument.defaultView;}};
  };
  function makeDocument(href='https://example.test/') {
    const events=new Map(),doc={events,location:makeLocation(href),title:'Title '+href,head:null,body:null};
    doc.head=new Node('head',doc);doc.body=new Node('body',doc);doc.documentElement=new Node('html',doc);
    doc.documentElement.lang='pt-BR';
    const header=new Node('header',doc);doc.body.appendChild(header);
    const heading=new Node('h1',doc);doc.body.appendChild(heading);doc.heading=heading;
    for(const selector of ['meta[name="description"]','meta[name="robots"]','link[rel="canonical"]','script[type="application/ld+json"]']){
      const node=new Node('meta',doc);node.selector=selector;node.textContent=href;doc.head.appendChild(node);
    }
    doc.querySelector=selector=>selector==='body > header'?header:selector==='h1'?heading:selector==='script[src*="ambient-music.js"]'?{}:null;
    doc.getElementById=id=>[...doc.body.childNodes,...header.childNodes].find(node=>node.id===id)||null;
    doc.addEventListener=(name,fn)=>events.set(name,fn);
    doc.importNode=node=>{const copy=new Node(node.tagName,doc);copy.selector=node.selector;copy.textContent=node.textContent;return copy;};
    doc.createElement=tag=>{
      const node=new Node(tag,doc);
      if(tag==='iframe'){
        frame=node;
        Object.defineProperty(node,'src',{set(value){node.contentDocument=makeDocument(value);node.contentWindow=node.contentDocument.defaultView;}});
      }
      return node;
    };
    doc.defaultView={document:doc,location:doc.location,scrollY:0,history:{replaceState(state,unused,url){doc.location=makeLocation(url);doc.defaultView.location=doc.location;}},scrollTo(x,y){this.scrollY=y;}};
    return doc;
  }
  root=makeDocument();
  const history={state:{existing:'kept'},replaceState(state,unused,url){this.state=state;root.location.href=url;root.location.pathname=new URL(url).pathname;},pushState(state,unused,url){this.state=state;pushes.push({state,url});root.location.href=url;root.location.pathname=new URL(url).pathname;}};
  const window={events:new Map(),addEventListener(name,fn){this.events.set(name,fn);}};window.parent=window;
  class MutationObserver {constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  class FormData {constructor(form){this.form=form;}get(key){return this.form.values[key];}}
  const context={window,document:root,history,location:root.location,URL,MutationObserver,FormData,setTimeout(fn){const id=timers.size+1;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
  vm.runInNewContext(source,context);
  const api=window.RDCContinuousNavigation;
  const panel=new Node('section',root);panel.id='rdc-ambient-music';root.body.appendChild(panel);
  const style=new Node('style',root);style.textContent='player styles';let media=0,toggles=0,volumes=0;
  api.bind({panel,style,onMedia(){media++;},detachDirectListeners(){},onToggle(){toggles++;},onVolume(){volumes++;}});
  function click(href,{doc=root,attrs={},...options}={}) {
    const link=new Node('a',doc);link.href=new URL(href,doc.location.href).href;link.attributes=attrs;
    const event={button:0,target:{ownerDocument:doc,closest:selector=>selector==='a[href]'?link:null},defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...options};
    doc.events.get('click')(event);return event;
  }
  return {api,root,window,history,panel,timers,replacements,assignments,pushes,observers,click,
    get frame(){return frame;},get media(){return media;},get toggles(){return toggles;},get volumes(){return volumes;},loaded(){frame.events.get('load')();},
    submit(term,{doc=root,method='get',role=true,prevented=false}={}){
      const form={ownerDocument:doc,method,values:{busca:term},matches:()=>role};
      const event={target:form,defaultPrevented:prevented,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;}};
      doc.events.get('submit')(event);return event;
    }
  };
}
test('without opt-in the original links, documents, metadata and history are untouched',()=>{
  const f=fixture();assert.equal(f.click('/comparar.html').defaultPrevented,false);
  assert.equal(f.frame,undefined);assert.equal(f.pushes.length,0);assert.equal(f.timers.size,0);
  assert.equal(f.root.body.childNodes.includes(f.panel),true);
});
test('opted-in navigation keeps one exact player and isolates each complete public document',()=>{
  const f=fixture();f.api.enable();
  assert.equal(f.click('/comparar.html').defaultPrevented,true);f.loaded();
  const frame=f.frame,firstDoc=frame.contentDocument;
  assert.equal(frame.hidden,false);assert.equal(firstDoc.getElementById('rdc-ambient-music'),f.panel);
  assert.equal(f.root.getElementById('rdc-original-page').hidden,true);
  assert.equal(f.history.state.existing,'kept');assert.equal(f.pushes.length,1);assert.equal(f.timers.size,0);
  f.click('/analises.html',{doc:firstDoc});f.loaded();
  assert.equal(f.frame,frame);assert.notEqual(frame.contentDocument,firstDoc);
  assert.equal(frame.contentDocument.getElementById('rdc-ambient-music'),f.panel);
  assert.equal(f.replacements.length,1);assert.equal(f.pushes.length,2);
  assert.equal(f.api.owns(frame.contentWindow),true);assert.equal(f.api.owns({}),false);
  assert.equal(f.api.referrerFor({}),'');
  assert.doesNotMatch(source,/AudioContext|\.suspend\(|\.resume\(|\.close\(/);
});
test('title, canonical, robots and JSON-LD match the shown destination, with no eval or script replay',()=>{
  const f=fixture();f.api.enable();f.click('/produto/example-1.html');f.loaded();
  assert.equal(f.root.title,f.frame.contentDocument.title);
  for(const selector of ['meta[name="description"]','meta[name="robots"]','link[rel="canonical"]','script[type="application/ld+json"]']){
    assert.equal(f.root.head.querySelectorAll(selector)[0].textContent,f.frame.contentDocument.head.querySelectorAll(selector)[0].textContent);
  }
  assert.equal(f.frame.title,f.root.title);assert.equal(f.frame.contentDocument.heading.focused,true);
  assert.doesNotMatch(source,/\beval\(|new Function|document\.write|innerHTML|srcdoc/);
});
test('the inert host suspends metrics before history changes; the visible page has its actual previous URL',()=>{
  const f=fixture();let suspended=false;
  f.window.RDCPrivacy={suspendDocumentMetrics(){assert.equal(f.pushes.length,0);suspended=true;}};
  f.api.enable();f.click('/comparar.html');assert.equal(suspended,true);
  assert.equal(f.api.referrerFor(f.frame.contentWindow),'https://example.test/');f.loaded();
  f.click('/analises.html',{doc:f.frame.contentDocument});
  assert.equal(f.api.referrerFor(f.frame.contentWindow),'https://example.test/comparar.html');
});
test('external/affiliate, new-tab, modified, cancelled and download links keep native behavior',()=>{
  for(const [href,opts] of [['https://meli.la/example',{}],['/dashboard.html',{}],['/privacy-controls.js',{}],
    ['/produto/a.html',{attrs:{target:'_blank'}}],['/produto/a.html',{attrs:{download:''}}],
    ['/produto/a.html',{ctrlKey:true}],['/produto/a.html',{metaKey:true}],['/produto/a.html',{shiftKey:true}],
    ['/produto/a.html',{button:1}],['/produto/a.html',{defaultPrevented:true}],['mailto:contact@example.test',{}]]){
    const f=fixture();f.api.enable();const event=f.click(href,opts);
    assert.equal(f.frame,undefined,href);assert.equal(f.pushes.length,0,href);
    if(!opts.defaultPrevented)assert.equal(event.defaultPrevented,false,href);
  }
});
test('same-tab external and admin links from continuous content leave the shell normally',()=>{
  for(const href of ['https://meli.la/example','/dashboard.html','/painel-celular.html']){
    const f=fixture();f.api.enable();f.click('/comparar.html');f.loaded();
    assert.equal(f.click(href,{doc:f.frame.contentDocument}).defaultPrevented,true);
    assert.equal(f.assignments.at(-1),new URL(href,'https://example.test/').href);
  }
});
test('public GET search retains the term and URL, but never intercepts editing or login forms',()=>{
  const f=fixture();f.api.enable();const event=f.submit('Redmi Buds & JBL');
  assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);
  assert.equal(f.pushes.at(-1).url,'https://example.test/?busca=Redmi+Buds+%26+JBL');
  for(const opts of [{method:'post'},{role:false},{prevented:true}]){
    const other=fixture();other.api.enable();other.submit('x',opts);assert.equal(other.frame,undefined);
  }
});
test('back and forward restore the URL/scroll without adding nested history or restarting audio',()=>{
  const f=fixture();f.api.enable();f.click('/comparar.html');f.loaded();
  const saved=f.history.state;f.frame.contentDocument.defaultView.scrollY=450;
  f.click('/analises.html',{doc:f.frame.contentDocument});f.loaded();
  const count=f.pushes.length;
  f.root.location.href='https://example.test/comparar.html';
  f.window.events.get('popstate')({state:{...saved,rdcContinuous:{url:f.root.location.href,scroll:450}}});f.loaded();
  assert.equal(f.pushes.length,count);assert.equal(f.frame.contentDocument.defaultView.scrollY,450);
});
test('hash links keep audio and current document, and native media is forwarded to the one player',()=>{
  const f=fixture();f.api.enable();f.click('/analises.html');f.loaded();const doc=f.frame.contentDocument;
  assert.equal(f.click('#fones',{doc}).defaultPrevented,true);assert.equal(f.frame.contentDocument,doc);
  assert.equal(f.pushes.at(-1).url,'https://example.test/analises.html#fones');
  doc.events.get('play')({target:{tagName:'VIDEO'}});assert.equal(f.media,1);
});
test('pause and volume are delegated from every new document after repeated navigations',()=>{
  const f=fixture();f.api.enable();
  for(const url of ['/comparar.html','/analises.html','/produto/a.html']){
    f.click(url,{doc:f.frame?.contentDocument || f.root});f.loaded();
    const doc=f.frame.contentDocument;
    const event={target:{ownerDocument:doc,closest:selector=>selector==='#rdc-music-toggle'?{}:null},preventDefault(){this.prevented=true;}};
    doc.events.get('click')(event);assert.equal(event.prevented,true);
    doc.events.get('input')({target:{id:'rdc-music-volume'}});
  }
  assert.equal(f.toggles,3);assert.equal(f.volumes,3);
});
test('timeout, failed page and unsupported redirects recover via ordinary navigation',()=>{
  const timeout=fixture();timeout.api.enable();timeout.click('/comparar.html');[...timeout.timers.values()][0]();
  assert.equal(timeout.assignments[0],'https://example.test/comparar.html');
  const invalid=fixture();invalid.api.enable();invalid.click('/produto/missing.html');
  invalid.frame.contentDocument.querySelector=()=>null;invalid.loaded();
  assert.equal(invalid.assignments[0],'https://example.test/produto/missing.html');
});
test('generators add one router before the audio script, exclude noindex and remain idempotent',()=>{
  const before='<html><head></head><body>Original price</body></html>',after=protectPublicHtml(before);
  assert.equal((after.match(/continuous-navigation\.js/g)||[]).length,1);
  assert.ok(after.indexOf('continuous-navigation.js')<after.indexOf('ambient-music.js'));
  assert.equal(protectPublicHtml(after),after);assert.ok(after.includes('Original price'));
  assert.doesNotMatch(protectPublicHtml('<html><head><meta name="robots" content="noindex,nofollow"></head></html>'),/continuous-navigation/);
  assert.doesNotMatch(source,/localStorage|sessionStorage|fetch\(|XMLHttpRequest|gtag\(|firebase\./);
});
