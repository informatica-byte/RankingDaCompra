import test from 'node:test';
import assert from 'node:assert/strict';
import {renderIntegrityGuide} from './comparison-guides.mjs';
const page=(title,description)=>renderIntegrityGuide({file:'melhores-casa.html',title,description,products:[],urls:new Map(),date:'2026-10-22'});
const meta=html=>html.match(/<meta name="description" content="([^"]*)"/)[1];
test('descrições genéricas dos guias identificam a categoria sem inventar benefícios, notas ou preços',()=>{
 const a=page('Opções para Casa'),b=page('Opções de Bicicletas');
 assert.notEqual(meta(a),meta(b));assert.match(meta(a),/Casa/);assert.match(meta(b),/Bicicletas/);
 assert.doesNotMatch(meta(a),/R\$|testamos|melhor desempenho|frete grátis/);
});
test('descrição editorial específica é preservada e texto da categoria é escapado',()=>{
 assert.equal(meta(page('Título','Descrição específica confirmada.')),'Descrição específica confirmada.');
 assert.match(meta(page('Casa <exemplo>')),/Casa &lt;exemplo&gt;/);
});
