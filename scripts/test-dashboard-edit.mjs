import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
const validators=html.slice(html.indexOf('function validarConteudoEditorial('),html.indexOf('function extrairIdMercadoLivreCadastro('));
const edit=html.slice(html.indexOf('function camposCadastroAlterados('),html.indexOf('function informarStatusCadastro('));
const c=vm.createContext({Date});vm.runInContext(validators+'\n'+edit,c);
const old={titulo:'Teclado',preco:'88,01',comentario:'Descrição antiga',pros:'Antigo',contras:'Antigo',dadosTecnicos:'Ficha antiga.',promocaoAtiva:true,precoAnterior:'199,00',precoPromocional:'78,90',promocaoValidaAte:'2020-01-01',ofertaRelampagoAtiva:false,ofertaRelampagoDuracao:''};

test('edição editorial preserva preço, promoção e links atualizados em outra sessão',()=>{
 const original={...old,link:'https://www.mercadolivre.com.br/p/MLB12345678',linkAfiliado:'https://meli.la/original',mercadoLivreItemId:'MLB12345678'};
 const patch=c.camposCadastroParaAtualizar({...original,comentario:'Resumo corrigido',atualizadoEm:{}},original);
 assert.deepEqual(JSON.parse(JSON.stringify(patch)),{comentario:'Resumo corrigido'});
 const atual={...original,preco:'70,00',precoPromocional:'60,00',linkAfiliado:'https://meli.la/novo',precoAtualizadoManualmenteEm:'2026-10-14T12:00:00Z'};
 const salvo={...atual,...patch};
 assert.equal(salvo.preco,'70,00');
 assert.equal(salvo.precoPromocional,'60,00');
 assert.equal(salvo.linkAfiliado,'https://meli.la/novo');
 assert.equal(salvo.precoAtualizadoManualmenteEm,atual.precoAtualizadoManualmenteEm);
});

test('patch omite campos vazios legados, undefined, autor e objetos equivalentes',()=>{
 const original={...old,metadados:{b:2,a:[1,{x:true}]}},dados={...original,linkShopee:'',precoShopee:'',outro:undefined,autor:'Padrão',metadados:{a:[1,{x:true}],b:2}};
 assert.deepEqual(JSON.parse(JSON.stringify(c.camposCadastroParaAtualizar(dados,original))),{});
});

test('preço e identidade entram no patch somente quando o responsável os altera',()=>{
 const original={...old,link:'https://www.mercadolivre.com.br/p/MLB12345678',linkAfiliado:'https://meli.la/original',mercadoLivreItemId:'MLB12345678',marketplace:'mercado_livre'};
 const preco=c.camposCadastroParaAtualizar({...original,preco:'80,00'},original);
 assert.deepEqual(JSON.parse(JSON.stringify(preco)),{preco:'80,00'});
 const link=c.camposCadastroParaAtualizar({...original,link:'https://www.mercadolivre.com.br/p/MLB87654321',mercadoLivreItemId:'MLB87654321'},original);
 assert.equal(link.mercadoLivreItemId,'MLB87654321');
 assert.equal(link.preco,undefined);
});
test('edição só do preço preserva conteúdo legado e promoção vencida sem reativar',()=>{
 const data={...old,preco:'65,90'};
 assert.equal(c.validarAlteracaoCadastro(data,old),'');
 assert.equal(data.promocaoValidaAte,'2020-01-01');
 assert.equal(data.precoAtualizadoManualmenteEm,undefined);
});
test('edição de título ou ficha continua exigindo validação editorial',()=>{
 assert.match(c.validarAlteracaoCadastro({...old,titulo:'Novo título'},old),/resumo/);
});
test('preço inválido nunca é aceito mesmo em cadastro antigo',()=>{
 for(const preco of ['0','-1','texto',''])assert.match(c.validarAlteracaoCadastro({...old,preco},old),/preço válido/);
});
test('alterar uma promoção exige validade atual; desativar a vencida é permitido',()=>{
 assert.match(c.validarAlteracaoCadastro({...old,precoPromocional:'65,90'},old),/passado/);
 assert.equal(c.validarAlteracaoCadastro({...old,promocaoAtiva:false},old),'');
});
test('novo cadastro continua passando por todas as regras editoriais',()=>{
 assert.match(c.validarAlteracaoCadastro(old,null),/resumo/);
});
test('oferta relâmpago antiga inalterada não impede edição e não reinicia o prazo',()=>{
 const original={...old,ofertaRelampagoAtiva:true,ofertaRelampagoTerminaEm:'2020-01-01T12:00:00Z'};
 const data={...original,preco:'65,90'};
 const code=html.match(/if \(original && !camposCadastroAlterados\(dadosProduto, original, \['ofertaRelampagoAtiva', 'ofertaRelampagoDuracao'\]\)\) \{[\s\S]*?\n            \}/)[0];
 c.original=original;c.dadosProduto={...data,ofertaRelampagoTerminaEm:'2099-01-01T12:00:00Z'};
 vm.runInContext(code,c);
 assert.equal(c.dadosProduto.ofertaRelampagoTerminaEm,original.ofertaRelampagoTerminaEm);
 assert.equal(c.validarAlteracaoCadastro(c.dadosProduto,original),'');
 assert.notEqual(c.validarAlteracaoCadastro({...data,ofertaRelampagoDuracao:'00:20:00'},original),'');
});
