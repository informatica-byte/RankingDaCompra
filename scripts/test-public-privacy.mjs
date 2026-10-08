import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {protectPublicHtml} from './public-privacy.mjs';

const source = await readFile(new URL('../privacy-controls.js', import.meta.url), 'utf8');
function browser() {
  const stored = new Map(), listeners = new Map(), loaded = [];
  const window = {addEventListener(type, cb) {listeners.set(type, [...(listeners.get(type) || []), cb]);}, removeEventListener(type, cb) {listeners.set(type, (listeners.get(type) || []).filter(x => x !== cb));}, dispatchEvent(event) {for (const cb of [...(listeners.get(event.type) || [])]) cb(event);}};
  const document = {readyState: 'loading', cookie: '_ga=old', addEventListener() {}, getElementById() {return null;}, createElement() {return {};}, head: {appendChild(tag) {loaded.push(tag);}}};
  vm.runInNewContext(source, {window, document, location: {hostname: 'rankingdacompra.com.br'}, localStorage: {getItem: key => stored.get(key) || null, setItem: (key, val) => stored.set(key, val)}, Date, CustomEvent: class {constructor(type, options = {}) {this.type = type; this.detail = options.detail;}}});
  return {window, loaded, stored};
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
