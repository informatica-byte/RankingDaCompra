import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {protectPublicHtml} from './public-privacy.mjs';

test('publicadores incluem páginas institucionais normalizadas sem incluir configurações', async () => {
  for (const name of ['update-sitemap.yml', 'sync-mercadolivre.yml']) {
    const workflow = await readFile(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
    assert.match(workflow, /git status --porcelain -- [^\n]*':\(top,glob\)\*\.html'/);
    assert.match(workflow, /git add -A [^\n]*':\(top,glob\)\*\.html'/);
    assert.ok(!workflow.includes('git add -A .\n'));
  }
});

test('geração renova somente a referência do controle de privacidade existente', () => {
  const html = '<html><head><script defer src="/privacy-controls.js?v=antiga"></script><script src="/public-data.js?v=preservada"></script></head></html>';
  const fixed = protectPublicHtml(html);
  assert.equal((fixed.match(/privacy-controls\.js/g) || []).length, 1);
  assert.match(fixed, /defer src="\/privacy-controls\.js\?v=20261014-audit"/);
  assert.ok(fixed.includes('/public-data.js?v=preservada'));
  assert.equal(protectPublicHtml(fixed), fixed);
});

const source = await readFile(new URL('../privacy-controls.js', import.meta.url), 'utf8');
function browser({render=false}={}) {
  const stored = new Map(), listeners = new Map(), loaded = [];
  const window = {addEventListener(type, cb) {listeners.set(type, [...(listeners.get(type) || []), cb]);}, removeEventListener(type, cb) {listeners.set(type, (listeners.get(type) || []).filter(x => x !== cb));}, dispatchEvent(event) {for (const cb of [...(listeners.get(event.type) || [])]) cb(event);}};
  const nodes=new Map();
  const element=()=>{
    const node={controls:{},hidden:false,focus(){document.activeElement=this;},contains(target){return Object.values(this.controls).includes(target);},setAttribute(){},addEventListener(type,handler){this[type]=handler;},querySelector:selector=>node.controls[selector]||null};
    Object.defineProperty(node,'innerHTML',{set(){node.controls['[data-privacy-accept]']=element();node.controls['[data-privacy-reject]']=element();node.controls.button=node.controls['[data-privacy-accept]'];}});
    return node;
  };
  const document = {activeElement:null,readyState: render?'complete':'loading', cookie: '_ga=old', addEventListener() {}, getElementById:id=>nodes.get(id)||null,querySelector:selector=>selector==='.rdc-privacy-settings'?nodes.get('settings'):null, createElement:element,body:{appendChild(node){if(node.id)nodes.set(node.id,node);if(node.className==='rdc-privacy-settings')nodes.set('settings',node);}}, head: {appendChild(tag) {loaded.push(tag);}}};
  vm.runInNewContext(source, {window, document, location: {hostname: 'rankingdacompra.com.br'}, localStorage: {getItem: key => stored.get(key) || null, setItem: (key, val) => stored.set(key, val)}, Date, CustomEvent: class {constructor(type, options = {}) {this.type = type; this.detail = options.detail;}}});
  return {window, loaded, stored,document,nodes};
}
test('GA e eventos ficam desativados até uma escolha positiva; recusa não carrega GA', () => {
  const {window, loaded} = browser();
  assert.equal(window.RDCPrivacy.analyticsAllowed(), false);
  window.gtag('event', 'share');
  assert.ok(window.dataLayer.every(args => args[0] === 'consent'));
  window.RDCPrivacy.setAnalytics(false);
  assert.equal(loaded.length, 0);
  assert.equal(window['ga-disable-G-NBKRX8TTR6'], true);
});
test('aceite carrega uma vez; retirada bloqueia novos eventos sem apagar preferências essenciais', () => {
  const {window, loaded, stored} = browser();
  stored.set('firebase-auth-existing', 'preservado');
  let views = 0;
  window.RDCPrivacy.whenAnalyticsAllowed(() => views++);
  window.RDCPrivacy.setAnalytics(true);
  window.RDCPrivacy.setAnalytics(true);
  assert.equal(loaded.length, 1);
  assert.equal(views, 1);
  assert.equal(window.RDCPrivacy.analyticsAllowed(), true);
  window.RDCPrivacy.setAnalytics(false);
  const count = window.dataLayer.length;
  window.gtag('event', 'select_item');
  assert.equal(window.dataLayer.length, count);
  assert.equal(stored.get('firebase-auth-existing'), 'preservado');
});
test('HTML usa controle antes de outros scripts, sem GA automático, e é idempotente', () => {
  const html = `<html><head><script async src="https://www.googletagmanager.com/gtag/js?id=G-NBKRX8TTR6"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-NBKRX8TTR6',{anonymize_ip:true});</script><script src="firebase-auth.js"></script></head></html>`;
  const fixed = protectPublicHtml(html);
  assert.ok(fixed.indexOf('privacy-controls.js') < fixed.indexOf('firebase-auth.js'));
  assert.ok(!fixed.includes('googletagmanager.com'));
  assert.equal(protectPublicHtml(fixed), fixed);
});
test('contadores próprios também aguardam consentimento e não duplicam a proteção', () => {
  const html = '<html><head></head><script>async function registrarVisita(){db.write()}\nregistrarVisita();\nasync function registrarMetricaComercial(tipo,produto,canal){db.write()}\nwindow.registrarMetricaComercial=async function(tipo,produto,canal){db.write()}</script></html>';
  const fixed = protectPublicHtml(html);
  assert.equal((fixed.match(/analyticsAllowed\(\)/g) || []).length, 3);
  assert.match(fixed, /whenAnalyticsAllowed\(\(\)=>registrarVisita\(\)\)/);
  assert.equal(protectPublicHtml(fixed), fixed);
});

test('fechar escolhas de privacidade devolve foco ao controle visível sem roubar foco externo',()=>{
  const {window,document,nodes}=browser({render:true});
  const banner=nodes.get('rdc-privacy-banner'),settings=nodes.get('settings');
  for(const selector of ['[data-privacy-reject]','[data-privacy-accept]']){
    settings.click();
    assert.equal(document.activeElement,banner.querySelector('button'));
    const action=banner.querySelector(selector);action.focus();action.click();
    assert.equal(banner.hidden,true);
    assert.equal(document.activeElement,settings);
  }
  const outside={};document.activeElement=outside;
  window.RDCPrivacy.setAnalytics(false);
  assert.equal(document.activeElement,outside);
});
