import test from 'node:test';
import assert from 'node:assert/strict';
import {correctProductData} from './product-title-corrections.mjs';
test('triagem65 preserva operação e só aplica aos modelos conhecidos',()=>{for(const [id,titulo] of [['Bf3ccSwSiVkLw1Z8k2Hu','Liquidificador Turbo Power Mondial 550W - L-99 FB'],['bjRcUhAfXiIDliNXbqwE','NAC 600mg - Fórmula Exclusiva com Máxima Concentração e Pureza - N'],['Bp4dNosktHQXiSy3r9S0','Tapete Decorativo Casa Laura']]){const p={id,titulo,preco:'preservar',linkAfiliado:'https://meli.la/preservar'},x=correctProductData(p);assert.equal(x.preco,p.preco);assert.equal(x.linkAfiliado,p.linkAfiliado);assert.deepEqual(correctProductData(x),x);assert.equal(correctProductData({...p,titulo:'Outro produto',comentario:'manter'}).comentario,'manter');}});
