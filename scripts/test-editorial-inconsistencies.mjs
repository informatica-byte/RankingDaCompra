import test from "node:test";
import assert from "node:assert/strict";
import {correctProductData} from "./product-title-corrections.mjs";
test("fichas inconsistentes têm limites explícitos sem alterar preço, data ou links",()=>{
 for(const [id,titulo,bad] of [["UCDnByA5YaWN9eiyA5IM","Cama Elástica Infantil 3,0m","Suporta 120kg"],["Kyw9WRrxRLj36DL50JfQ","PlayStation 5 Edição Digital","inclui 4 controles"]]) {
 const p={id,titulo,comentario:bad,preco:"299,00",precoAtualizadoManualmenteEm:"2026-10-09T12:00:00Z",linkAfiliado:"https://meli.la/test",pros:"antigo",contras:"antigo"};
 const c=correctProductData(p);
 assert.notEqual(c.comentario,p.comentario);assert.equal(c.preco,p.preco);assert.equal(c.precoAtualizadoManualmenteEm,p.precoAtualizadoManualmenteEm);assert.equal(c.linkAfiliado,p.linkAfiliado);assert.match(c.contras,/confirm|comprovad/i);
 }
});
