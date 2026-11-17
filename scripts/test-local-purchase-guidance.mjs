import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {guidance} from './local-purchase-guidance.mjs';
import {affiliateLinks,informationalHtml,assertInformationalHtml} from './informational-site.mjs';

test('a geração informativa repõe as cinco orientações sem duplicar ou mudar afiliados',async()=>{
 for(const id of Object.keys(guidance)){
  const file='produto/'+id+'-20260810-1.html';
  const existing=await readFile(new URL('../'+file,import.meta.url),'utf8');
  const section=/<section data-local-purchase-guidance="[^"]+">[\s\S]*?<\/section>/g;
  const fresh=existing.replace(section,'');
  const baseline=informationalHtml(fresh,null,file);
  const out=informationalHtml(fresh,{id},file);
  assert.equal([...out.matchAll(section)].length,1,id);
  assert.ok(out.includes(guidance[id]),id);
  assert.deepEqual(affiliateLinks(out),affiliateLinks(fresh),id);
  assert.equal(out.replace(section,''),baseline,id);
  assertInformationalHtml(out,file);
  assert.equal(informationalHtml(out,{id},file),out,id);
 }
});

test('não acrescenta orientação a fichas pausadas, redirecionadas ou fora do lote',()=>{
 const id=Object.keys(guidance)[0],file='produto/'+id+'-20260810-1.html';
 for(const source of ['<meta name="rdc-paused-product">','<meta http-equiv="refresh" content="0;url=/">']){
  assert.equal(informationalHtml(source,{id},file),source);
 }
 const source='<html><head></head><body><article></article></body></html>';
 assert.doesNotMatch(informationalHtml(source,{id},'produto/outro.html'),/data-local-purchase-guidance/);
});
