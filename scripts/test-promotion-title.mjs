import test from 'node:test';
import assert from 'node:assert/strict';
import title from '../promotion-title.js';
const headphones=[{titulo:'Fone JBL Bluetooth 5.3',preco:'74,00'},{titulo:'Fone TWS Bluetooth',preco:'99,16'}];
test('preserva título válido, categoria e teto comprovados',()=>{
 const configured='Ofertas do dia: fones Bluetooth até R$ 100';
 assert.equal(title.resolve(configured,headphones),configured);
 assert.equal(title.money('R$ 3.309,94'),3309.94);
});
test('seleção mista usa título neutro sem alterar configuração',()=>{
 const config={promotionSeoTitle:'Ofertas do dia: calçados até R$ 699'};
 const offers=[{titulo:'Mouse Logitech M170',preco:81.10},{titulo:'Notebook Lenovo',preco:3309.94}];
 assert.equal(title.resolve(config.promotionSeoTitle,offers),title.DEFAULT);
 assert.equal(config.promotionSeoTitle,'Ofertas do dia: calçados até R$ 699');
});
test('teto falso, preço ausente e Bluetooth não comprovado são recusados',()=>{
 assert.equal(title.check('Ofertas do dia: fones Bluetooth até R$ 70',headphones).valid,false);
 assert.equal(title.check('Ofertas do dia: produtos até R$ 100',[{titulo:'Produto',preco:''}]).valid,false);
 assert.equal(title.check('Ofertas do dia: fones Bluetooth até R$ 100',[{titulo:'Headset com fio',preco:70}]).valid,false);
});
test('categorias conjuntas e títulos neutros permanecem disponíveis',()=>{
 const offers=[{titulo:'Notebook Acer',preco:2500},{titulo:'Smartphone Motorola',preco:700}];
 assert.equal(title.check('Ofertas do dia: notebooks e celulares',offers).valid,true);
 assert.equal(title.check(title.DEFAULT,offers).valid,true);
});
