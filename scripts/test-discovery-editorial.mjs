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

test('guia informativo de fones não exige preços; filtros explícitos e Wi-Fi 6 continuam restritos', () => {
  const products = [{id:'a',titulo:'Fone Bluetooth',preco:99},{id:'b',titulo:'Fone Bluetooth',preco:101},{id:'c',titulo:'Fone Bluetooth',preco:0}];
  assert.deepEqual(focusedProducts(FOCUSED_GUIDES[0], products, ()=>{throw Error('Guia informativo não deve consultar preço');}).map(p=>p.id), ['a','b','c']);
  assert.deepEqual(focusedProducts({budget:100}, products, p=>p.preco).map(p=>p.id), ['a']);
  const routers = [{id:'a',titulo:'Roteador Wi-Fi 6'}, {id:'b',titulo:'Roteador',contras:'Não possui Wi-Fi 6'}];
  assert.deepEqual(focusedProducts(FOCUSED_GUIDES[1],routers,()=>0).map(p=>p.id), ['a']);
  const html = renderPracticalSection('fone',products,new Map(products.map(p=>[p.id,'https://rankingdacompra.com.br/produto/'+p.id+'.html'])));
  assert.match(html,/A confirmar/);
  assert.match(html,/Para quem NÃO é indicado/);
  assert.doesNotMatch(html,/microfone testado/);
});

test('orientação sobre alternativa e limitação de teste não contradizem a própria ficha', () => {
  const product = {titulo:'Fone Bluetooth',comentario:'Não possui cancelamento ativo de ruído (ANC). Para ambientes ruidosos, compare alternativas com ANC. Não realizamos testes de qualidade do microfone.'};
  assert.equal(featureState(product, /\banc\b|cancelamento ativo/), 'no');
  assert.equal(featureState(product, /microfone/), 'unknown');
  assert.equal(featureState({titulo:'Fone',comentario:'Para quem precisa de ANC, procure outro modelo com ANC'}, /\banc\b/), 'unknown');
  assert.equal(featureState({titulo:'Fone',comentario:'Possui microfone integrado'}, /microfone/), 'yes');
  assert.equal(featureState({titulo:'Fone',comentario:'Tem ANC?'}, /\banc\b/), 'unknown');
  assert.equal(featureState({titulo:'Fone com ANC',contras:'Não possui ANC'}, /\banc\b/), 'unknown');
  assert.equal(featureState({titulo:'Fone',comentario:'ENC para chamadas; isolamento passivo'}, /\banc\b/), 'unknown');
  assert.equal(featureState({titulo:'Roteador',pros:['Portas Gigabit anunciadas','EasyMesh para outros equipamentos compatíveis']}, /\bmesh\b|easymesh/), 'yes');
  assert.equal(featureState({titulo:'Fone',contras:'Não possui ANC, compare alternativas com ANC'}, /\banc\b/), 'no');
  assert.equal(featureState({titulo:'Fone',comentario:'Se tiver ANC, ajudará no ambiente ruidoso'}, /\banc\b/), 'unknown');
  assert.equal(featureState({titulo:'Fone',comentario:'O modelo pode ter ANC dependendo da variante'}, /\banc\b/), 'unknown');
});
