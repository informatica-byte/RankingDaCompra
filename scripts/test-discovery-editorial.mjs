import assert from 'node:assert/strict';
import { test } from 'node:test';
import { routerCapabilities, featureState, FOCUSED_GUIDES, focusedProducts, renderPracticalSection } from './discovery-editorial.mjs';

test('recursos negados, contraditórios e incertos não recebem pontos', () => {
  for (const contras of ['Não possui portas Gigabit', 'Sem Gigabit', 'Não informa se tem Gigabit', 'Gigabit: não disponível', 'Gigabit não foi confirmado']) {
    assert.ok(!routerCapabilities({titulo:'Roteador', contras}).includes('portas Gigabit'), contras);
    assert.ok(!routerCapabilities({titulo:'Roteador Gigabit', contras}).includes('portas Gigabit'), contras);
  }
  assert.deepEqual(routerCapabilities({titulo:'Roteador AX3000 Wi-Fi 6 Dual Band Gigabit Mesh'}),
    ['Wi-Fi 6','banda de 5 GHz','portas Gigabit','rede Mesh','classe AX1800 ou superior']);
  assert.equal(featureState({titulo:'Fone sem fio com microfone'}, /microfone/), 'yes');
  assert.equal(featureState({titulo:'Fone ENC'}, /\banc\b/), 'unknown');
  assert.equal(featureState({titulo:'Smartwatch GPS conectado'}, /gps integrado/), 'unknown');
});

test('guias específicos filtram teto de preço e Wi-Fi 6 sem usar dados incertos', () => {
  const products = [{id:'a',titulo:'Fone Bluetooth',preco:99},{id:'b',titulo:'Fone Bluetooth',preco:101},{id:'c',titulo:'Fone Bluetooth',preco:0}];
  assert.deepEqual(focusedProducts(FOCUSED_GUIDES[0], products, p=>p.preco).map(p=>p.id), ['a']);
  const routers = [{id:'a',titulo:'Roteador Wi-Fi 6'}, {id:'b',titulo:'Roteador',contras:'Não possui Wi-Fi 6'}];
  assert.deepEqual(focusedProducts(FOCUSED_GUIDES[1],routers,()=>0).map(p=>p.id), ['a']);
  const html = renderPracticalSection('fone',products,new Map(products.map(p=>[p.id,'https://rankingdacompra.com.br/produto/'+p.id+'.html'])));
  assert.match(html,/A confirmar/);
  assert.match(html,/Para quem NÃO é indicado/);
  assert.doesNotMatch(html,/microfone testado/);
});
