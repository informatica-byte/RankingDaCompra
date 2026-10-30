import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import decision from '../decision-brief.js';
import home from '../informational-home.js';
import integrity from '../comparison-integrity.js';
import {informationalHtml,affiliateLinks} from './informational-site.mjs';
const review={fit:'Para quem prefere um encaixe intra-auricular documentado.',alternative:'Se precisa de ANC, esta ficha não o confirma.',check:'Confira a variante e a compatibilidade.',advantages:['Estojo USB-C documentado na fonte.'],limitations:['A duração depende dos recursos ligados.'],sources:[{url:'https://www.mi.com/global/',label:'Fabricante'}]};
const product={id:'a',title:'Fone Redmi Buds 6 Play',url:'/produto/a.html',comparison:{features:[{label:'Bluetooth',value:'5.4',state:'yes',basis:'fabricante',sourceUrl:'https://www.mi.com/global/'},{label:'ANC',value:'Não confirmado',state:'unknown',basis:'cadastro'}]}};

test('metodologia distingue cadastro, revisão documental e fabricante sem alegar teste ou cobertura total',()=>{
 const input='<html><head><title>Critérios</title></head><body><main><h1>Anterior</h1></main></body></html>';
 const output=informationalHtml(input,null,'como-avaliamos.html');
 assert.match(output,/data-editorial-scope/);
 for(const text of ['Ficha descritiva','Análise documental','Informação do fabricante','Data do texto não é data de estoque','Não cobrimos todo o mercado'])assert.ok(output.includes(text),text);
 assert.match(output,/não vira confirmação do fabricante nem experiência de uso/);
 assert.equal(informationalHtml(output,null,'como-avaliamos.html'),output);
});
test('resumo reaproveita fatos e revisão, preserva pendências e nunca altera o produto',()=>{
 const before=JSON.stringify(product),b=decision.make(product,review),html=decision.render(b);assert.equal(b.reviewed,true);assert.deepEqual(b.pending,['ANC']);assert.match(html,/Para quem pode servir/);assert.match(html,/Quando considerar outra opção/);assert.match(html,/sem teste|não teste/);assert.equal(JSON.stringify(product),before);
 const empty=decision.make({id:'x'},null);assert.equal(empty.reviewed,false);assert.equal(empty.advantages.length,0);assert.match(decision.render(empty),/Informações ainda limitadas/);assert.doesNotMatch(decision.render(empty),/Vantagens documentadas/);
});
test('frases promocionais não viram conclusão, mas ressalvas e fatos concretos são preservados',()=>{
 assert.equal(decision.sober('Excelente desempenho. Bluetooth 5.4 segundo o anúncio.'),'Bluetooth 5.4 segundo o anúncio.');assert.equal(decision.sober('Alta absorção e máxima pureza.'),'');assert.equal(decision.sober('Não confirmamos alta absorção.'),'Não confirmamos alta absorção.');
 const b=decision.make(product,{...review,advantages:['Qualidade incomparável.'],sources:[{url:'javascript:alert(1)'}]});assert.equal(b.reviewed,false);assert.doesNotMatch(decision.render(b),/javascript:|incomparável/);
});
test('prioridade editorial só reorganiza os selecionados completos, sem remover ou inventar produtos',()=>{
 const good={...product,decisionBrief:decision.make(product,review)},basic={...product,id:'basic',title:'Cadastro sem revisão',decisionBrief:decision.make({},null)};
 const data={editorialSelectionVersion:1,selected:['basic','a','missing'],products:[basic,good],guides:[]},before=JSON.stringify(data);assert.deepEqual(home.selection(data).map(p=>p.id),['a']);assert.equal(JSON.stringify(data),before);assert.equal(data.products.length,2);
});
test('rotulagem informativa remove promessa de preços e conserva exatamente os afiliados',()=>{
 const source='<html><head><title>Análises de produtos, preços e ofertas</title></head><body><h1>Produtos</h1><a href="/produto/a.html">Ver preço, prós e contras →</a><a id="affiliate-offer" href="https://meli.la/unchanged">Ver produto</a></body></html>';
 const html=informationalHtml(source,null,'analises.html');assert.match(html,/Análises de produtos, vantagens e limitações/);assert.match(html,/Ver análise, vantagens e limitações/);assert.doesNotMatch(html,/Ver preço/);assert.deepEqual(affiliateLinks(html),affiliateLinks(source));assert.equal(informationalHtml(html,null,'analises.html'),html);
});
test('atalhos por necessidade não substituem a validação de equivalência ou usam preço',async()=>{
 const window={RDCComparisonIntegrity:integrity};vm.runInNewContext(await readFile(new URL('../buyer-tools.js',import.meta.url),'utf8'),{window,URL,URLSearchParams,Intl});const api=window.RDCBuyerTools;
 assert.equal(api.needMatches({title:'Notebook ASUS'},'study'),true);assert.equal(api.needMatches({title:'Cabo para Notebook'},'study'),false);assert.equal(api.needMatches({title:'Roteador TP-Link'},'wifi'),true);assert.equal(api.needMatches({title:'Fone Redmi Buds 6 Play'},'wifi'),false);assert.equal(api.needMatches({title:'Câmera de segurança Tapo C200'},'monitor'),true);
 assert.equal(api.comparable([{title:'JBL Tune 520BT Bluetooth'},{title:'Redmi Buds 6 Play'}]),false);
});
test('abertura de análise exige consentimento e transmite apenas ID/nome, nunca venda, URL ou banco',async()=>{
 const source=await readFile(new URL('../growth-tools.js',import.meta.url),'utf8'),helper=source.slice(source.indexOf('  function recordAnalysisAnalytics('),source.indexOf('  function setupFunnelTracking(')),calls=[];
 const window={gtag:(...args)=>calls.push(args)},context=vm.createContext({window});vm.runInContext(helper,context);assert.equal(context.recordAnalysisAnalytics({id:'a',title:'Modelo'}),false);window.RDCPrivacy={analyticsAllowed:()=>true};assert.equal(context.recordAnalysisAnalytics({id:'a',title:'<b>Modelo</b>'}),true);
 assert.equal(calls[0][1],'analysis_view');assert.deepEqual(Object.keys(calls[0][2]).sort(),['product_id','product_name']);assert.equal(calls[0][2].product_name,'Modelo');assert.doesNotMatch(helper,/fetch\(|collection\(|purchase|transaction_id|href/);
});
