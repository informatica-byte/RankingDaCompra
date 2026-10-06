import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const bot = readFileSync(new URL('../bot-precos.user.js', import.meta.url), 'utf8');
const safetyCode = readFileSync(new URL('../assisted-price-safety.js', import.meta.url), 'utf8');
const url = 'https://produto.mercadolivre.com.br/MLB-2926671021-tenis-_JM?searchVariation=175705466645';
const title = 'Tênis Nike Court Legacy Lift Feminino';
function money(value, options = {}) {
  const [fraction, cents] = String(value).split('.');
  return {
    closest: () => options.excluded ? {} : null,
    getClientRects: () => options.hidden ? [] : [{}],
    getAttribute: () => options.label || '',
    querySelector: selector => ({ textContent: selector.endsWith('__fraction') ? fraction : selector.endsWith('__cents') ? cents || '00' : options.currency || 'R$' }),
  };
}
function visibleText(textContent, options = {}) {
  return { textContent, closest: () => null, getClientRects: () => options.hidden ? [] : [{}], getAttribute: () => options.href || '' };
}
function page({ prices = [money(358.79)], structured = [], foundTitle = title, text = '', listing = '2926671021', attributes = [], selected = [url], specs = [] } = {}) {
  return {
    body: { innerText: text }, defaultView: { getComputedStyle: () => ({ display: 'inline', visibility: 'visible' }) },
    querySelector: selector => selector.startsWith('h1') ? { textContent: foundTitle } : null,
    querySelectorAll: selector => selector.includes('ld+json') ? structured.map(value => ({ textContent: JSON.stringify(value) }))
      : selector.startsWith('.ui-pdp-price__second-line') ? prices
      : selector.includes('denounce__info') ? (listing ? [visibleText('Anúncio #' + listing)] : [])
      : selector.includes('variations__title') ? attributes.map(a => visibleText(a.name + ':' + a.value))
      : selector.includes('--SELECTED') ? selected.map(href => visibleText('', {href}))
      : selector === 'table tr' ? specs.map(a => ({...visibleText(''),querySelectorAll:()=>[{textContent:a.name},{textContent:a.value}]})) : [],
  };
}
function setup(doc = page()) {
  const writes = []; let current;
  const context = vm.createContext({ URL, URLSearchParams, document: doc, location: { hostname: 'test.invalid', href: url }, unsafeWindow: {},
    Date, setTimeout: callback => queueMicrotask(callback), GM_setValue: (key, value) => writes.push(value), GM_getValue: () => current,
  });
  vm.runInContext(bot.replace(/\}\)\(\);\s*$/, 'Object.assign(globalThis, {parsePrice, matchingProduct, sameOffer, offerIdentity, extractMainPrice, variantMismatch, extractDocumentOffer, publishCurrentPageResult}); })();'), context);
  vm.runInContext(safetyCode, context);
  return { context, writes, setCommand: value => { current = value; } };
}
const structuredOffer = (price, name = title, offerUrl = url, type = 'Offer') => ({ '@type': 'Product', name, offers: { '@type': type, priceCurrency: 'BRL', price, lowPrice: 85.40, url: offerUrl } });

test('preço principal não é parcela, cashback, preço riscado ou oferta recomendada', () => {
  const { context } = setup(page({ prices: [money(649.99, { excluded: true }), money(358.79), money(6.95, { excluded: true })],
    structured: [structuredOffer(85.40, 'Tênis Nike Downshifter Feminino', 'https://produto.mercadolivre.com.br/MLB-1111111111-tenis-_JM'), structuredOffer(358.79)] }));
  const result = context.extractDocumentOffer(context.document, title, url);
  assert.equal(result.preco, 358.79);
  assert.equal(result.offerKey, 'MLB2926671021');
  assert.equal(result.robotVersion, '2.3.0');
});
test('números monetários rejeitam parcelas e intervalos em vez de concatená-los', () => {
  const { context: c } = setup();
  for (const [input, output] of [['R$ 1.299,90',1299.90], ['1299.9',1299.9], ['85,40',85.40], ['1.299',1299], ['12x 85,40',null], ['de 10 até 20',null], ['85,40 90,00',null], ['-1',null], ['0',null]]) assert.equal(c.parsePrice(input), output, input);
});
test('AggregateOffer lowPrice e metadados isolados nunca substituem o preço principal', () => {
  const { context: c } = setup(page({ prices: [], structured: [structuredOffer(85.40, title, url, 'AggregateOffer')] }));
  assert.equal(c.extractDocumentOffer(c.document, title, url).status, 'loading');
});
test('preço principal tem prioridade sobre JSON-LD e cópias Pix, sem escolher o menor', () => {
  for (const doc of [page({structured:[structuredOffer(85.40)]}), page({prices:[money(358.79),money(349.90)]})]) {
    const { context: c } = setup(doc); assert.equal(c.extractDocumentOffer(doc, title, url).preco, 358.79);
  }
  for (const doc of [page({prices:[money(358.79,{currency:'US$'})]})]) {
    const { context: c } = setup(doc); assert.equal(c.extractDocumentOffer(doc, title, url).status, 'loading');
  }
});
test('anúncio não renderizado e preço oculto não comprovam uma cotação', () => {
  const detached = page(); detached.defaultView = null;
  for (const doc of [detached, page({prices:[money(358.79,{hidden:true})]})]) {
    const { context:c }=setup(doc); assert.equal(c.extractDocumentOffer(doc,title,url).status,'loading');
  }
});
test('modelo diferente não passa por duas palavras genéricas em comum', () => {
  const { context:c }=setup();
  assert.equal(c.matchingProduct('Fone JBL Tune 520BT Preto Bluetooth','Fone JBL Tune 720BT Preto Bluetooth'),false);
  assert.equal(c.sameOffer(url,'https://produto.mercadolivre.com.br/MLB-1111111111-tenis-_JM'),false);
  assert.equal(c.sameOffer(url,url.replace('175705466645','175705466646')),false);
  assert.equal(c.sameOffer(url,'https://mercadolivre.com.br.evil.invalid/MLB-2926671021'),false);
});
test('aba antiga não responde a novo pedido mesmo com título idêntico', async () => {
  const {context:c,writes,setCommand}=setup();
  const command={requestId:'next',produtoId:'outro',titulo:title,url:url.replace('2926671021','1111111111'),createdAt:Date.now()};
  setCommand(command); await c.publishCurrentPageResult(command); assert.equal(writes.length,0);
});
test('pedido cancelado durante a estabilização não publica resultado tardio', async () => {
  const {context:c,writes,setCommand}=setup();
  const command={requestId:'old',produtoId:'a',titulo:title,url,createdAt:Date.now()};
  setCommand(command); c.setTimeout=callback=>{setCommand({...command,requestId:'new'});queueMicrotask(callback)};
  await c.publishCurrentPageResult(command); assert.equal(writes.length,0);
});
test('resultado estável carrega evidência, produto, pedido e URL para validação anterior à escrita', async () => {
  const {context:c,writes,setCommand}=setup();
  const command={requestId:'now',produtoId:'a',titulo:title,url,createdAt:Date.now()};
  setCommand(command); await c.publishCurrentPageResult(command);
  assert.equal(writes.length,1);
  assert.equal(c.RDCAssistedPriceSafety.validate(writes[0],{produtoId:'a',url,titulo:title,previousPrice:358.79}), '');
});
test('preço que oscila até o prazo acabar não é publicado como confirmado', async () => {
  const doc=page();const {context:c,writes,setCommand}=setup(doc);
  let now=Date.now(), toggle=false;c.Date={now:()=>now};
  c.setTimeout=callback=>{now+=500;toggle=!toggle;doc.querySelectorAll=selector=>selector.startsWith('.ui-pdp-price__second-line')?[money(toggle ? 350 : 358.79)]:[];queueMicrotask(callback)};
  const command={requestId:'changing',produtoId:'a',titulo:title,url,createdAt:now};
  setCommand(command);await c.publishCurrentPageResult(command);
  assert.equal(writes.length,1);assert.equal(writes[0].status,'error');
});
test('validador recusa robô antigo e pedido trocado, mas corrige preço antigo muito divergente', async () => {
  const {context:c,writes,setCommand}=setup();
  const command={requestId:'now',produtoId:'a',titulo:title,url,createdAt:Date.now()};
  setCommand(command); await c.publishCurrentPageResult(command);
  for (const result of [{...writes[0],robotVersion:'2.2.0'},{...writes[0],produtoId:'b'},{...writes[0],requestedUrl:'https://example.com/'},{...writes[0],checkedAt:Date.now()-125000},{...writes[0],mainPrice:85.40}]) assert.ok(c.RDCAssistedPriceSafety.validate(result,{produtoId:'a',url,titulo:title,previousPrice:358.79}));
  for(const previousPrice of [85.40,1500]) assert.equal(c.RDCAssistedPriceSafety.validate(writes[0],{produtoId:'a',url,titulo:title,previousPrice}), '');
});
test('os dois painéis validam antes de escrever no Firebase e preservam conferência manual', () => {
  const mobile=readFileSync(new URL('../painel-celular.html',import.meta.url),'utf8');
  const dashboard=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
  for(const html of [mobile,dashboard]) assert.match(html,/assisted-price-safety.js\?v=20261006-3/);
  const save=mobile.slice(mobile.indexOf('async function salvarFilaPrecoAssistida'),mobile.indexOf('function separarProdutoAutomacao'));
  assert.ok(save.indexOf('RDCAssistedPriceSafety.validate')<save.indexOf('await updateDoc'));
  assert.match(save,/if \(opcoes.automatico\)/);
  assert.match(mobile,/if \(!automacaoPrecosAtiva \|\| rodada !== automacaoPrecosRodada\) return/);
  const batch=dashboard.slice(dashboard.indexOf('async function salvarPrecoConferidoEmLote'),dashboard.indexOf('async function iniciarConferenciaPrecosIAEmLote'));
  assert.ok(batch.indexOf('RDCAssistedPriceSafety.validate')<batch.indexOf("await db.collection"));
});

test('wid no fragmento/query fixa o vendedor; identificadores conflitantes são recusados', () => {
  const {context:c}=setup();
  const catalog='https://www.mercadolivre.com.br/gerador/p/MLB57289720';
  for(const raw of [catalog+'?wid=MLB5296312807',catalog+'#position=12&wid=MLB5296312807',catalog+'?pdp_filters=item_id%3AMLB5296312807']) {
    assert.equal(c.offerIdentity(raw).key,'MLB5296312807');
    assert.equal(c.RDCAssistedPriceSafety.identity(raw).key,'MLB5296312807');
    assert.equal(c.sameOffer(raw,catalog+'?wid=MLB7685968580'),false);
  }
  for(const raw of [catalog+'?wid=MLB5296312807#wid=MLB7685968580',catalog+'?wid=INVALID',url+'&wid=MLB7685968580']) {
    assert.equal(c.offerIdentity(raw),null);assert.equal(c.RDCAssistedPriceSafety.identity(raw),null);
  }
});

test('regressão Lotus: bloquear cor explicitamente diferente, não exigir código do rodapé', () => {
  const expected='Gerador De Espuma A Bateria 2l Lotus 7.4v 3 Bar Lavagem Automotiva Branco';
  const catalog='https://www.mercadolivre.com.br/gerador/p/MLB57289720';
  const doc=page({foundTitle:expected,listing:'7685968580',attributes:[{name:'Cor',value:'Bege'}],selected:[],prices:[money(139.49)]});
  const {context:c}=setup(doc);
  assert.match(c.extractDocumentOffer(doc,expected,catalog+'#wid=MLB5296312807').motivo,/cor/);
  assert.match(c.extractDocumentOffer(doc,expected,catalog).motivo,/cor/);
  const missingFooter=page({foundTitle:expected,listing:'',attributes:[],selected:[],prices:[money(139.49)]});
  assert.equal(c.extractDocumentOffer(missingFooter,expected,catalog).preco,139.49);
});

test('preços dos chips de variantes não contam como preço principal', () => {
  const variationMoney=value=>({...money(value),closest:selector=>selector.includes('variations')?{}:null});
  const doc=page({prices:[variationMoney(139.49),variationMoney(119.99),money(139.49)]});
  const {context:c}=setup(doc);assert.equal(c.extractMainPrice(doc).length,1);assert.equal(c.extractMainPrice(doc)[0],139.49);
});

test('JBL: cotação de outros vendedores não bloqueia nem substitui o preço principal',()=>{
  const otherSeller=value=>({...money(value),closest:selector=>selector.includes('.ui-pdp-other-sellers')?{}:null});
  const doc=page({prices:[otherSeller(269.90),money(232.65),otherSeller(199.90)]});
  const {context:c}=setup(doc);assert.equal(c.extractMainPrice(doc)[0],232.65);
});

test('mesmo produto e preço principal dispensam seletor obrigatório e repetição da query no controle', () => {
  for(const doc of [page({attributes:[{name:'Tamanho',value:'Escolha'}]}),page({selected:[]})]) {
    const {context:c}=setup(doc);assert.equal(c.extractDocumentOffer(doc,title,url).preco,358.79);
  }
});

test('característica explícita diferente preserva cadastro; ausência da ficha não bloqueia', () => {
  const {context:c}=setup();
  const cases=[
    ['Fone JBL Tune 520BT Preto',[{name:'Cor',value:'Branco'}],/cor/],
    ['Tênis Nike tamanho 34',[{name:'Tamanho',value:'39 BR'}],/tamanho/],
    ['Air fryer 220V',[{name:'Voltagem',value:'127V'}],/voltagem/],
  ];
  for(const [expected,attrs,reason] of cases) {
    assert.match(c.variantMismatch(expected,attrs),reason);assert.match(c.RDCAssistedPriceSafety.variantMismatch(expected,attrs),reason);
  }
  for(const [expected,attrs] of [
    ['Fone JBL Tune 520BT Preto',[{name:'Cor',value:'Preta'},{name:'Modelo',value:'Tune 520BT'}]],
    ['Tênis Nike tamanho 34',[{name:'Tamanho',value:'34 BR'}]],
    ['Air fryer 220V',[{name:'Voltagem',value:'220 V'}]],
    ['Fone JBL Tune 520BT Preto',[]],
    ['Multimídia 7 Carplay Android Mp5 RS-7007BR',[{name:'Modelo',value:'RS-7007BR'}]],
    ['Notebook Asus Vivobook Ryzen 5 7520u 16gb 512ssd',[{name:'Modelo',value:'E1504'}]],
  ]) {assert.equal(c.variantMismatch(expected,attrs),'');assert.equal(c.RDCAssistedPriceSafety.variantMismatch(expected,attrs),'');}
});

test('ficha e seletor incompletos não impedem preço principal do mesmo produto', () => {
  const expected='Fone JBL Tune 520BT Preto';const raw='https://produto.mercadolivre.com.br/MLB-2926671021-fone-_JM';
  const specs=[{name:'Cor',value:'Preto'},{name:'Modelo',value:'Tune 520BT'}];
  const doc=page({foundTitle:expected,selected:[],specs});const {context:c}=setup(doc);
  assert.equal(c.extractDocumentOffer(doc,expected,raw).status,'ok');
  const incomplete=page({foundTitle:expected,specs,attributes:[{name:'Cor',value:'Escolha'}]});
  assert.equal(c.extractDocumentOffer(incomplete,expected,raw).status,'ok');
});

test('painel recusa prova antiga, ausente, título de outro pedido ou produto diferente', async () => {
  const {context:c,writes,setCommand}=setup();
  const command={requestId:'variant',produtoId:'a',titulo:title,url,createdAt:Date.now()};setCommand(command);await c.publishCurrentPageResult(command);
  const result=writes[0];assert.equal(result.proofVersion,3);
  for(const invalid of [{...result,proofVersion:1},{...result,variantProof:null},
    {...result,proofVersion:2},{...result,tituloEncontrado:'Tênis Adidas Superstar Masculino'},
    {...result,variantProof:{...result.variantProof,expectedTitle:'Outro produto'}}]) {
    assert.ok(c.RDCAssistedPriceSafety.validate(invalid,{produtoId:'a',url,titulo:title,previousPrice:358.79}));
  }
});

test('comparação leve aceita formatação e ficha incompleta, não outro modelo no título',()=>{
  const {context:c}=setup();
  const same=[
    ['Gerador De Espuma A Bateria 2l Lotus 74v 3 Bar Lavagem Automotiva Branco','Gerador de Espuma a Bateria 2L Lotus 7.4V 3 Bar Lavagem Automotiva Branco'],
    ['Multimídia 7 Polegadas Carplay Android auto sem fio Mp5 Rs-7007br 7 cor preto','Multimídia 7 Polegadas Carplay Android Auto sem fio MP5 RS7007BR Preto'],
    ['Notebook Asus Vivobook Go 15 Amd Ryzen 5 7520u 16gb 512ssd Mixed Black','Notebook Asus Vivobook Go 15 AMD Ryzen 5 7520U 16GB 512GB SSD Mixed Black'],
  ];
  for(const [expected,found] of same) {assert.equal(c.matchingProduct(expected,found),true);assert.equal(c.RDCAssistedPriceSafety.matchingProduct(expected,found),true);}
  for(const [expected,found] of [['Fone JBL Tune 520BT Preto Bluetooth','Fone JBL Tune 720BT Preto Bluetooth'],['Notebook Asus Vivobook Ryzen 5','Impressora HP Laser 135A'],
    ['Notebook Dell Inspiron Intel Core i5 Preto','Notebook Dell Inspiron Intel Core i7 Preto'],
    ['Smartphone Samsung Galaxy A55 128GB Preto','Smartphone Samsung Galaxy A55 256GB Preto']]) {
    assert.equal(c.matchingProduct(expected,found),false);assert.equal(c.RDCAssistedPriceSafety.matchingProduct(expected,found),false);
  }
});

test('dashboard mantém o link com searchVariation/attributes em vez de convertê-lo para genérico', () => {
  const html=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
  const code=html.slice(html.indexOf('function urlDiretaParaConferenciaIA'),html.indexOf('async function salvarPrecoConferidoEmLote'));
  const {context:c}=setup();c.window=c;c.statusMercadoLivreAdmin={};vm.runInContext(code,c);
  for(const raw of [url,url+'&attributes=SIZE:MzQgQlI=', 'https://www.mercadolivre.com.br/fone/p/MLB57289720#wid=MLB5296312807']) {
    assert.equal(c.urlDiretaParaConferenciaIA({link:raw,mercadoLivreItemId:'MLB7685968580'},'a'),raw);
  }
});
