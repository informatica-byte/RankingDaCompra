import test from 'node:test';
import assert from 'node:assert/strict';
import {correctProductData} from './product-title-corrections.mjs';
const rows=[["RiCj7wC1QDBSMgPUQWD1","Mini Ventilador Soprador Ar Turbo 130000rpm Assoprador Sem Fio Recarregável Usb 3 Níveis Jato Forte Portátil Multiuso Limpeza Teclado Carro Acende Churrasqueira Davely","Mini soprador portátil Davely — recarga USB anunciada","https://www.mercadolivre.com.br/p/MLB69649128?pdp_filters=item_id%3AMLB6781687878"],["rjkXSj5wDd3i4spfoHet","Software Rede Manutenção Windows Titanium Tech Toolkit","Software Rede Manutenção Windows Titanium Tech Toolkit","https://produto.mercadolivre.com.br/MLB-5041220911-software-rede-manutenco-windows-titanium-tech-toolkit-_JM"],["rkEqyfJAguQZwMzfh25s","Perfume Billion Casino Royal Paris Elysees Masculino Intense 100ml Original","Billion Casino Royal Paris Elysees — 100 mL anunciados","https://www.mercadolivre.com.br/p/MLB6138946?pdp_filters=item_id%3AMLB2084718645"]];
test('triagem 132 altera somente o editorial das ofertas identificadas',()=>{
 for(const [id,titulo,expected,link] of rows){
  const p={id,titulo,link,linkAfiliado:'https://meli.la/preservar',preco:'preservar'};
  const x=correctProductData(p);
  assert.equal(x.titulo,expected);
  assert.ok(x.comentario.length>=180);
  for(const k of ['id','link','linkAfiliado','preco']) assert.equal(x[k],p[k]);
  assert.deepEqual(correctProductData(x),x);
  const other={...p,link:'https://produto.mercadolivre.com.br/MLB-9876543210-outro-_JM'};
  const untouched=correctProductData(other);
  assert.equal(untouched.titulo,other.titulo);
  assert.equal(untouched.comentario,'');
 }
});
