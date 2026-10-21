import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../growth-tools.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('  function recordAffiliateAnalytics('),source.indexOf('  function setupFunnelTracking('));

test('clique de afiliado tem consentimento, sem URL, credenciais ou evento de compra',()=>{
  const calls=[],window={gtag:(...args)=>calls.push(args)};
  const context={window,funnelProduct:()=>({id:'produto-123',title:'não enviar título',category:'não enviar'})};
  vm.runInNewContext(helper,context);
  for(const value of [undefined,false]){window.RDCPrivacy=value===undefined?undefined:{analyticsAllowed:()=>false};context.recordAffiliateAnalytics({id:'affiliate-offer',href:'https://meli.la/privado'});}
  assert.equal(calls.length,0);
  window.RDCPrivacy={analyticsAllowed:()=>true};
  for(const id of ['affiliate-offer','mobile-affiliate-offer','affiliate-offer-shopee','offer-link'])context.recordAffiliateAnalytics({id});
  assert.equal(calls.length,4);
  assert.ok(calls.every(call=>call[0]==='event'&&call[1]==='affiliate_click'));
  assert.deepEqual(Object.keys(calls[0][2]).sort(),['marketplace','placement','product_id']);
  assert.equal(calls[1][2].placement,'mobile');assert.equal(calls[2][2].marketplace,'shopee');
  assert.doesNotMatch(helper,/\.collection\(|fetch\(|['"]purchase['"]|transaction_id|href\b/);
  window.gtag=()=>{throw Error('bloqueado');};assert.doesNotThrow(()=>context.recordAffiliateAnalytics({id:'affiliate-offer'}));
});

test('painéis distinguem métricas futuras, dados históricos e vendas confirmadas sem novas consultas',async()=>{
  for(const file of ['dashboard.html','painel-celular.html']){
    const html=await readFile(new URL('../'+file,import.meta.url),'utf8');
    const guide=html.match(/<details[^>]*data-metrics-guide>[\s\S]*?<\/details>/)?.[0];
    assert.ok(guide,file);assert.match(guide,/comparison_interaction/);assert.match(guide,/affiliate_click/);
    assert.match(guide,/Não some affiliate_click com select_item/);assert.match(guide,/ausência de relatório não significa zero vendas/);
    assert.doesNotMatch(guide,/<script|<iframe|\son\w+=/);
  }
});
