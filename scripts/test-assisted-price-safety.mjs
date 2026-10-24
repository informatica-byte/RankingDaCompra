import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const bot = readFileSync(new URL('../bot-precos.user.js', import.meta.url), 'utf8');
const safetyCode = readFileSync(new URL('../assisted-price-safety.js', import.meta.url), 'utf8');
const url = 'https://produto.mercadolivre.com.br/MLB-2926671021-tenis-_JM?searchVariation=175705466645';
const title = 'Tênis Nike Court Legacy Lift Feminino';
function money(value, options = {}) {
  const [fraction, cents] = (typeof value === 'number' ? value.toFixed(2) : String(value)).split('.');
  return {
    closest: () => options.excluded ? {} : null,
    getClientRects: () => options.hidden ? [] : [{}],
    getAttribute: () => options.label || '',
    querySelector: selector => ({ textContent: selector.endsWith('__fraction') ? fraction : selector.endsWith('__cents') ? cents || '00' : options.currency || 'R$' }),
  };
}
function visibleText(textContent, options = {}) {
  return { textContent, closest: () => options.excluded ? {} : null, getClientRects: () => options.hidden ? [] : [{}], getAttribute: () => options.href || '' };
}
function page({ prices = [money(358.79)], structured = [], foundTitle = title, text = '', listing = '2926671021', attributes = [], selected = [url], specs = [], unavailable = [] } = {}) {
  return {
    body: { innerText: text }, defaultView: { getComputedStyle: () => ({ display: 'inline', visibility: 'visible' }) },
    querySelector: selector => selector.startsWith('h1') ? { textContent: foundTitle } : null,
    querySelectorAll: selector => selector.includes('ld+json') ? structured.map(value => ({ textContent: JSON.stringify(value) }))
      : selector.startsWith('.ui-pdp-price__second-line') ? prices
      : selector === '.ui-pdp-buybox, .ui-pdp-shipping-message__text' ? unavailable
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
  vm.runInContext(bot.replace(/\}\)\(\);\s*$/, 'Object.assign(globalThis, {parsePrice, matchingProduct, sameOffer, offerIdentity, extractMainPrice, variantMismatch, extractDocumentOffer, publishCurrentPageResult, restoreControllerTab, handleConferenceCommand}); })();'), context);
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
  assert.equal(result.robotVersion, '2.4.14');
});
test('números monetários rejeitam parcelas e intervalos em vez de concatená-los', () => {
  const { context: c } = setup();
  for (const [input, output] of [['R$ 1.299,90',1299.90], ['1299.9',1299.9], ['85,40',85.40], ['1.299',1299], ['12x 85,40',null], ['de 10 até 20',null], ['85,40 90,00',null], ['-1',null], ['0',null]]) assert.equal(c.parsePrice(input), output, input);
});

test('pendência i5-6º corresponde a i5 de sexta geração sem aceitar outra geração ou SSD', () => {
  const {context:c}=setup();
  const expected='Computador Pc Completo Intel I5-6º Ssd 240gb 8gb Ram Ddr4';
  const actual='Computador Completo Amorim Intel Core i5 6ª Geração Windows 10 Home 8GB RAM SSD 240GB HD';
  for(const match of [c.matchingProduct,c.RDCAssistedPriceSafety.matchingProduct]) {
    assert.equal(match(expected,actual),true);
    assert.equal(match(expected,actual.replace('6ª','8ª')),false);
    assert.equal(match(expected,actual.replace('240GB','512GB')),false);
  }
});

test('redirecionamento só recupera o anúncio exato visível, com título e preço comprovados', () => {
  const {context:c}=setup();
  const final='https://www.mercadolivre.com.br/tenis/up/MLBU999999999';
  const result=c.extractDocumentOffer(page(),title,final,url);
  assert.equal(result.status,'ok');assert.equal(result.offerKey,'MLB2926671021');
  Object.assign(result,{produtoId:'a',requestId:'request-proof',checkedAt:Date.now()});
  assert.equal(c.RDCAssistedPriceSafety.validate(result,{produtoId:'a',url,titulo:title}),'');
  for(const doc of [page({listing:''}),page({listing:'1111111111'}),page({foundTitle:'Tênis Adidas Superstar'})]) {
    assert.equal(c.extractDocumentOffer(doc,title,final,url).status,'loading');
  }
  assert.equal(c.extractDocumentOffer(page(),title,final+'?wid=MLB1111111111',url).status,'loading');
  assert.match(c.RDCAssistedPriceSafety.validate({...result,variantProof:{...result.variantProof,listingId:'MLB1111111111'}},{produtoId:'a',url,titulo:title}),/não corresponde/);
});

test('anúncio oculto ou recomendado não comprova um redirecionamento', () => {
  const final='https://www.mercadolivre.com.br/tenis/up/MLBU999999999';
  for(const opts of [{hidden:true},{excluded:true}]) {
    const doc=page(),original=doc.querySelectorAll;
    doc.querySelectorAll=selector=>selector.includes('denounce__info')?[visibleText('Anúncio #2926671021',opts)]:original(selector);
    const {context:c}=setup(doc);assert.equal(c.extractDocumentOffer(doc,title,final,url).status,'loading');
  }
});

test('vínculo da aba sobrevive ao catálogo novo sem navegar de novo ou repetir produto confirmado',async()=>{
  const final='https://www.mercadolivre.com.br/tenis/up/MLBU999999999';
  const s=setup(),c=s.context,sessionId='redirect-session-2414';
  const command={sessionId,requestId:'redirect-now',produtoId:'a',titulo:title,url,createdAt:Date.now()};
  s.setCommand(command);c.location.href=final+'#_rdc_conferencia='+sessionId;
  c.GM_getTab=callback=>callback({rdcPriceSession:sessionId,rdcPriceNavigation:{sessionId,requestId:command.requestId}});
  await c.restoreControllerTab();await c.handleConferenceCommand(command);
  const results=s.writes.filter(value=>value.status);
  assert.equal(results.length,1);assert.equal(results[0].status,'ok');assert.equal(results[0].preco,358.79);
  assert.equal(c.RDCAssistedPriceSafety.validate(results[0],{produtoId:'a',url,titulo:title}),'');
});

test('diagnóstico das falhas contém só prova pública limitada, sem query ou corpo da página',()=>{
  const doc=page({prices:[]}),{context:c}=setup(doc);
  const final=url+'#private_test=must-not-export';
  const result=c.extractDocumentOffer(doc,title,final,url);
  assert.equal(result.diagnostico.etapa,'preco_principal');
  assert.equal(result.diagnostico.tituloEncontrado,title);
  assert.equal(result.diagnostico.blocosPreco,0);
  assert.equal(result.diagnostico.anunciosVisiveis[0],'MLB2926671021');
  assert.doesNotMatch(JSON.stringify(result.diagnostico),/private_test|must-not-export|searchVariation/);
  const other=c.extractDocumentOffer(page({foundTitle:'Outro produto'}),title,url);
  assert.equal(other.diagnostico.etapa,'titulo');
});

test('identidade valida todos os ids repetidos e não toma campanha deal por anúncio',()=>{
  const {context:c}=setup();
  for(const identity of [c.offerIdentity,c.RDCAssistedPriceSafety.identity]) {
    const base='https://www.mercadolivre.com.br/produto/p/MLB12345678';
    assert.equal(identity(base+'?pdp_filters=deal:MLB779362-1|item_id:MLB2926671021|item_id:MLB2926671021').listing,'MLB2926671021');
    assert.equal(identity(base+'#item_id=MLB2926671021').listing,'MLB2926671021');
    for(const tail of ['?wid=MLB2926671021&wid=MLB1111111111','?pdp_filters=item_id:MLB2926671021|item_id:MLB1111111111','?item_id=MLBabc']) assert.equal(identity(base+tail),null);
    assert.equal(identity('https://user:password@www.mercadolivre.com.br/p/MLB12345678'),null);
  }
});
test('AggregateOffer lowPrice e metadados isolados nunca substituem o preço principal', () => {
  const { context: c } = setup(page({ prices: [], structured: [structuredOffer(85.40, title, url, 'AggregateOffer')] }));
  assert.equal(c.extractDocumentOffer(c.document, title, url).status, 'loading');
});

test('catálogo sem preço reconhece aviso visível de opção indisponível fora do buybox', () => {
  const doc = page({ prices: [], unavailable: [visibleText('Este produto está indisponível. Por favor, escolha outra variação.')] });
  const { context: c } = setup(doc);
  const result = c.extractDocumentOffer(doc, title, url);
  assert.equal(result.status, 'unavailable');
  assert.match(result.motivo, /opção aberta está indisponível/);
  assert.equal(result.preco, undefined);
  assert.equal(result.tituloEncontrado, title);
});

test('aviso oculto, recomendação indisponível e texto solto não classificam o produto como indisponível', () => {
  for (const doc of [
    page({ prices: [], unavailable: [visibleText('Este produto está indisponível', { hidden: true })] }),
    page({ prices: [], unavailable: [visibleText('Este produto está indisponível', { excluded: true })] }),
    page({ prices: [], text: 'Este produto está indisponível' }),
  ]) {
    const { context: c } = setup(doc);
    assert.equal(c.extractDocumentOffer(doc, title, url).status, 'loading');
  }
});

test('aviso de estoque não sobrepõe preço principal nem autoriza outro produto', () => {
  const message = visibleText('Este produto está indisponível');
  const doc = page({ unavailable: [message] });
  const { context: c } = setup(doc);
  assert.equal(c.extractDocumentOffer(doc, title, url).preco, 358.79);
  assert.equal(c.extractDocumentOffer(page({ prices: [], foundTitle: 'Tênis Adidas Superstar', unavailable: [message] }), title, url).status, 'loading');
});

test('calçado sem buybox só é indisponível quando todas as opções visíveis estão bloqueadas', () => {
  for (const [blocked, expected] of [[[true], 'unavailable'], [[true,true], 'unavailable'], [[true,false], 'loading'], [[], 'loading']]) {
    const doc=page({prices:[]}), original=doc.querySelectorAll;
    doc.querySelectorAll=selector=>selector==='.ui-pdp-outside_variations__thumbnails__item'
      ? blocked.map(value=>({...visibleText('40 BR'),classList:{contains:()=>value}})) : original(selector);
    const {context:c}=setup(doc),result=c.extractDocumentOffer(doc,title,url);
    assert.equal(result.status,expected);assert.equal(result.preco,undefined);
  }
});

test('opções bloqueadas ocultas e com preço válido não vencem o preço visível', () => {
  for (const prices of [[],[money(74.90)]]) {
    const doc=page({prices}), original=doc.querySelectorAll;
    doc.querySelectorAll=selector=>selector==='.ui-pdp-outside_variations__thumbnails__item'
      ? [{...visibleText('40 BR',{hidden:true}),classList:{contains:()=>true}}] : original(selector);
    const {context:c}=setup(doc),result=c.extractDocumentOffer(doc,title,url);
    assert.equal(result.status,prices.length?'ok':'loading');
  }
});

test('anúncio pausado sem preço é separado sem inventar valor ou consultar metadados', () => {
  const doc = page({ prices: [], unavailable: [visibleText('Anúncio pausado')], structured: [structuredOffer(99.90)] });
  const { context: c } = setup(doc);
  const result = c.extractDocumentOffer(doc, title, url);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.preco, undefined);
  assert.match(result.motivo, /sem estoque/);
});
test('JSON-LD não substitui total visível; menor total principal inclui Pix', () => {
  for (const doc of [page({structured:[structuredOffer(85.40)]})]) {
    const { context: c } = setup(doc); assert.equal(c.extractDocumentOffer(doc, title, url).preco, 358.79);
  }
  const pix=setup(page({prices:[money(358.79),money(349.90)]}));
  assert.equal(pix.context.extractDocumentOffer(pix.context.document,title,url).preco,349.90);
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
  assert.equal(c.sameOffer(url,url.replace('175705466645','175705466646')),true);
  assert.equal(c.sameOffer(url,'https://mercadolivre.com.br.evil.invalid/MLB-2926671021'),false);
});

test('kit NTK com título abreviado mantém o mesmo produto sem aceitar PS5 de outra versão', () => {
  const {context:c}=setup();
  const expected='Kit 8 Latas Refil Nautika Ntk 227g Camping Maçarico Fogareiro Fogão Recarga Gás Acampamento Portátil Cozinha Flambar Cozinhar Vivara Laranja-claro';
  const found='Kit Camping Gás De Maçarico Fogareiro 8 Latas Refil Ntk 227g';
  for(const match of [c.matchingProduct,c.RDCAssistedPriceSafety.matchingProduct]){
    assert.equal(match(expected,found),true);
    assert.equal(match('PlayStation 5 Edição Digital 825 GB Slim CFI 2114B Novo Lacrado','Playstation 5 Slim Disk 1tb 1 Controle Branco Sony'),false);
    assert.equal(match('Notebook Asus Vivobook Go Ryzen 5 16GB SSD 512GB WiFi Windows','Notebook Asus Vivobook Go Ryzen 3 16GB SSD 512GB'),false);
    assert.equal(match('Kit Camping Gás de Maçarico Fogareiro 8 Latas Refil Ntk 227g','Cama Elástica Infantil Kit Com Rede De Proteção'),false);
  }
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
  for(const html of [mobile,dashboard]) assert.match(html,/assisted-price-safety.js\?v=20261024-pendencias/);
  const save=mobile.slice(mobile.indexOf('async function salvarFilaPrecoAssistida'),mobile.indexOf('function separarProdutoAutomacao'));
  assert.ok(save.indexOf('RDCAssistedPriceSafety.validate')<save.indexOf('await updateDoc'));
  assert.match(save,/if \(opcoes.automatico\)/);
  assert.match(mobile,/if \(!automacaoPrecosAtiva \|\| rodada !== automacaoPrecosRodada\) return/);
  const batch=dashboard.slice(dashboard.indexOf('async function salvarPrecoConferidoEmLote'),dashboard.indexOf('async function iniciarConferenciaPrecosIAEmLote'));
  assert.ok(batch.indexOf('RDCAssistedPriceSafety.validate')<batch.indexOf("await db.collection"));
});

test('catálogo mantém identidade do produto ao trocar vendedor; identificadores conflitantes são recusados', () => {
  const {context:c}=setup();
  const catalog='https://www.mercadolivre.com.br/gerador/p/MLB57289720';
  for(const raw of [catalog+'?wid=MLB5296312807',catalog+'#position=12&wid=MLB5296312807',catalog+'?pdp_filters=item_id%3AMLB5296312807']) {
    assert.equal(c.offerIdentity(raw).key,'MLB5296312807');
    assert.equal(c.RDCAssistedPriceSafety.identity(raw).key,'MLB5296312807');
    assert.equal(c.sameOffer(raw,catalog+'?wid=MLB7685968580'),true);
  }
  for(const raw of [catalog+'?wid=MLB5296312807#wid=MLB7685968580',catalog+'?wid=INVALID',url+'&wid=MLB7685968580']) {
    assert.equal(c.offerIdentity(raw),null);assert.equal(c.RDCAssistedPriceSafety.identity(raw),null);
  }
});

test('regressão Lotus: ignorar cor, manter identidade do anúncio e preço visível', () => {
  const expected='Gerador De Espuma A Bateria 2l Lotus 7.4v 3 Bar Lavagem Automotiva Branco';
  const catalog='https://www.mercadolivre.com.br/gerador/p/MLB57289720';
  const doc=page({foundTitle:expected,listing:'7685968580',attributes:[{name:'Cor',value:'Bege'}],selected:[],prices:[money(139.49)]});
  const {context:c}=setup(doc);
  assert.equal(c.extractDocumentOffer(doc,expected,catalog+'#wid=MLB5296312807').preco,139.49);
  assert.equal(c.extractDocumentOffer(doc,expected,catalog).preco,139.49);
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

test('cor, tamanho e voltagem não bloqueiam a conferência de nome e preço', () => {
  const {context:c}=setup();
  const cases=[
    ['Fone JBL Tune 520BT Preto',[{name:'Cor',value:'Branco'}],/cor/],
    ['Tênis Nike tamanho 34',[{name:'Tamanho',value:'39 BR'}],/tamanho/],
    ['Air fryer 220V',[{name:'Voltagem',value:'127V'}],/voltagem/],
  ];
  for(const [expected,attrs,reason] of cases) {
    assert.equal(c.variantMismatch(expected,attrs),'');assert.equal(c.RDCAssistedPriceSafety.variantMismatch(expected,attrs),'');
    assert.equal(c.extractDocumentOffer(page({foundTitle:expected,attributes:attrs}),expected,url).status,'ok');
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

test('identidade do nome mantém geração e armazenamento, sem bloquear pelo tamanho', () => {
  const {context:c}=setup();
  const cases=[
    ['Smartphone Apple iPhone 14 128GB','Smartphone Apple iPhone 15 128GB'],
    ['Notebook Asus Vivobook Go 15 Ryzen 5','Notebook Asus Vivobook Go 14 Ryzen 5'],
    ['Tablet Lenovo 10ª Geração 128GB','Tablet Lenovo 11ª Geração 128GB'],
    ['Notebook Dell 8GB SSD 256GB','Notebook Dell 8GB SSD 512GB'],
    ['Smartphone Samsung Galaxy A55 128 GB','Smartphone Samsung Galaxy A55 256GB'],
  ];
  for(const [expected,found] of cases) {
    assert.equal(c.matchingProduct(expected,found),false,expected+' / '+found);
    assert.equal(c.RDCAssistedPriceSafety.matchingProduct(expected,found),false,expected+' / '+found);
    const doc=page({foundTitle:found});
    assert.equal(c.extractDocumentOffer(doc,expected,url).status,'loading');
  }
});

test('descontos, prazos e ausência de informação continuam aceitos sem inventar variante', () => {
  const {context:c}=setup();
  const cases=[
    ['Monitor Samsung 24 Polegadas Full HD','Monitor Samsung 24 inch Full HD'],
    ['Monitor Samsung 24 Polegadas Full HD','Monitor Samsung Full HD'],
    ['Monitor Samsung 24 Polegadas Full HD 10% desconto em 12x','Monitor Samsung 24 Polegadas Full HD 20% desconto em 6x'],
    ['Monitor Samsung oferta 10% Full HD','Monitor Samsung oferta 20% Full HD'],
    ['Smartphone Apple iPhone 14 128 GB 12 meses garantia','Smartphone Apple iPhone 14 128GB 6 meses garantia'],
    ['Notebook Dell 8GB 256 SSD','Notebook Dell 8 GB SSD 256GB'],
  ];
  for(const [expected,found] of cases) {
    assert.equal(c.matchingProduct(expected,found),true,expected+' / '+found);
    assert.equal(c.RDCAssistedPriceSafety.matchingProduct(expected,found),true,expected+' / '+found);
  }
});

test('prova de preço do mesmo monitor não é bloqueada por tamanho, mas outro produto é recusado', async () => {
  const expected='Monitor Samsung 24 Polegadas Full HD';
  const {context:c,writes,setCommand}=setup(page({foundTitle:expected}));
  const command={requestId:'monitor',produtoId:'a',titulo:expected,url,createdAt:Date.now()};
  setCommand(command);await c.publishCurrentPageResult(command);
  assert.equal(c.RDCAssistedPriceSafety.validate(writes[0],{produtoId:'a',url,titulo:expected}), '');
  assert.equal(c.RDCAssistedPriceSafety.validate({...writes[0],tituloEncontrado:'Monitor Samsung 27 Polegadas Full HD'},
    {produtoId:'a',url,titulo:expected}), '');
  assert.match(c.RDCAssistedPriceSafety.validate({...writes[0],tituloEncontrado:'Impressora HP Laser 135A'},
    {produtoId:'a',url,titulo:expected}),/título não confirma/);
  assert.match(c.RDCAssistedPriceSafety.validate({...writes[0],robotVersion:'2.3.0'},
    {produtoId:'a',url,titulo:expected}),/versão 2\.4\.4/);
});

test('2.4.1 bloqueia modelos numéricos e edições Pro/Plus explicitamente diferentes', () => {
  const {context:c}=setup();
  const cases=[
    ['Smartphone Xiaomi Redmi 13 128GB Preto','Smartphone Xiaomi Redmi 14 128GB Preto'],
    ['Smartphone Xiaomi Redmi Note 13 128GB','Smartphone Xiaomi Redmi Note 14 128GB'],
    ['Smartphone Apple iPhone 14 Pro 128GB','Smartphone Apple iPhone 14 128GB'],
    ['Smartphone Apple iPhone 14 Plus 128GB','Smartphone Apple iPhone 14 Pro 128GB'],
    ['Smartphone Apple iPhone 14 Pro Max 128GB','Smartphone Apple iPhone 14 Pro 128GB'],
    ['Apple AirPods Pro 2ª Geração Branco','Apple AirPods 2ª Geração Branco'],
    ['Apple AirPods 2 Pro Branco','Apple AirPods 2 Branco'],
    ['Apple AirPods Pro 2 Branco','Apple AirPods Pro 3 Branco'],
    ['Tablet Apple iPad Pro 11 128GB','Tablet Apple iPad 11 128GB'],
    ['Tablet Apple iPad 11 Pro 128GB','Tablet Apple iPad 11 128GB'],
    ['Tablet Apple iPad Pro 12.9 128GB','Tablet Apple iPad Pro 11 128GB'],
    ['Smartphone Samsung Galaxy S24 Ultra 256GB','Smartphone Samsung Galaxy S24 256GB'],
  ];
  for(const [expected,found] of cases) {
    for(const [left,right] of [[expected,found],[found,expected]]) {
      assert.equal(c.matchingProduct(left,right),false,left+' / '+right);
      assert.equal(c.RDCAssistedPriceSafety.matchingProduct(left,right),false,left+' / '+right);
    }
    assert.equal(c.extractDocumentOffer(page({foundTitle:found}),expected,url).status,'loading');
  }
  for(const [expected,found] of [
    ['Smartphone Apple iPhone 14 Pro 128GB 10% desconto','Smartphone Apple iPhone 14 Pro 128GB 20% desconto'],
    ['Smartphone Xiaomi Redmi 13 128GB','Smartphone Xiaomi Redmi 128GB'],
    ['Apple AirPods Pro 2ª Geração Branco','Apple AirPods Pro Branco'],
  ]) {
    assert.equal(c.matchingProduct(expected,found),true);
    assert.equal(c.RDCAssistedPriceSafety.matchingProduct(expected,found),true);
  }
});

test('nome e preço ignoram cor diferente nos títulos', () => {
  const {context:c}=setup();
  for(const [expected,found] of [
    ['Fone JBL Tune 520BT Preto','Fone JBL Tune 520BT Branco'],
    ['Notebook Asus Vivobook Ryzen 5 16gb 512ssd Mixed Black','Notebook Asus Vivobook Ryzen 5 16gb 512ssd Branco'],
  ]) {
    assert.equal(c.matchingProduct(expected,found),true);
    assert.equal(c.RDCAssistedPriceSafety.matchingProduct(expected,found),true);
    assert.equal(c.extractDocumentOffer(page({foundTitle:found,attributes:[]}),expected,url).status,'ok');
  }
  for(const found of ['Fone JBL Tune 520BT Preta','Fone JBL Tune 520BT Black','Fone JBL Tune 520BT']) {
    assert.equal(c.matchingProduct('Fone JBL Tune 520BT Preto',found),true);
    assert.equal(c.RDCAssistedPriceSafety.matchingProduct('Fone JBL Tune 520BT Preto',found),true);
  }
});

test('nome e preço ignoram tamanho e voltagem nos títulos sem aceitar outro modelo', async () => {
  const {context:c,writes,setCommand}=setup();
  for(const [expected,found] of [
    ['Tênis Nike Court tamanho 34 Preto','Tênis Nike Court tamanho 39 Branco'],
    ['Tênis Nike Court 34 BR','Tênis Nike Court 39 BR'],
    ['Air fryer Mondial 220V Preto','Air fryer Mondial 127 V Branco'],
    ['Fone JBL Tune 520BT cor Azul','Fone JBL Tune 520BT Branco'],
    ['Gerador de Espuma Lotus 7.4V','Gerador de Espuma Lotus 12V'],
    ['Monitor Samsung 24 Polegadas Full HD','Monitor Samsung 27 Polegadas Full HD'],
    ['Monitor Samsung 24 Full HD','Monitor Samsung 27 Full HD'],
    ['Smart TV LG 55" 4K','Smart TV LG 65" 4K'],
    ['Escorredor de louça 85cm','Escorredor de louça 90cm'],
  ]) {
    assert.equal(c.matchingProduct(expected,found),true);
    assert.equal(c.RDCAssistedPriceSafety.matchingProduct(expected,found),true);
    const result=c.extractDocumentOffer(page({foundTitle:found}),expected,url);
    assert.equal(result.status,'ok');
    assert.equal(c.RDCAssistedPriceSafety.validate({...result,produtoId:'a',requestId:'name-price',checkedAt:Date.now()},
      {produtoId:'a',url,titulo:expected}), '');
  }
  const command={requestId:'variant-query',produtoId:'a',titulo:title,url,createdAt:Date.now()};
  setCommand(command);await c.publishCurrentPageResult(command);
  const result=writes[0];
  assert.equal(c.RDCAssistedPriceSafety.validate({...result,fonteConsultada:url.replace('175705466645','175705466646')},
    {produtoId:'a',url,titulo:title}), '');
  assert.match(c.RDCAssistedPriceSafety.validate({...result,requestedUrl:url.replace('175705466645','175705466646')},
    {produtoId:'a',url,titulo:title}), /pedido/);
});

test('MLB explícito diferente no anúncio visível preserva preço mesmo com URL e título iguais', async () => {
  const {context:c,writes,setCommand}=setup();
  assert.match(c.extractDocumentOffer(page({listing:'1111111111'}),title,url).motivo,/vendedor/);
  const catalog='https://www.mercadolivre.com.br/tenis/p/MLB57289720#wid=MLB2926671021';
  assert.equal(c.extractDocumentOffer(page({listing:'1111111111'}),title,catalog).status,'ok');
  assert.equal(c.extractDocumentOffer(page({listing:''}),title,url).status,'ok');
  assert.equal(c.extractDocumentOffer(page({listing:'1111111111'}),title,catalog.split('#')[0]).status,'ok');
  const command={requestId:'listing-proof',produtoId:'a',titulo:title,url,createdAt:Date.now()};
  setCommand(command);await c.publishCurrentPageResult(command);
  const result=writes[0];
  assert.match(c.RDCAssistedPriceSafety.validate({...result,variantProof:{...result.variantProof,listingId:'MLB1111111111'}},
    {produtoId:'a',url,titulo:title}),/vendedor|Oferta em destaque/);
  assert.equal(c.RDCAssistedPriceSafety.validate({...result,variantProof:{...result.variantProof,listingId:''}},
    {produtoId:'a',url,titulo:title}),'');
});

test('mínimo 2.4.4 exige robô com os critérios atuais', () => {
  const {context:c}=setup();
  for(const version of ['2.3.9','2.4.0','2.4.1','2.4.2','2.4.3','1.99.99','2.4','invalid']) {
    assert.equal(c.RDCAssistedPriceSafety.robotReady({version,ready:true}),false,version);
  }
  for(const version of ['2.4.4','2.4.6','2.5.0','3.0.0']) {
    assert.equal(c.RDCAssistedPriceSafety.robotReady({version,ready:true}),true,version);
    assert.equal(c.RDCAssistedPriceSafety.robotReady({version,ready:false}),false,version);
  }
});

test('consulta individual cancelada restaura entrada, elimina prova e não chama salvamento', async () => {
  const html=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
  const source=html.slice(html.indexOf('async function conferirPrecoComIA'),html.indexOf('function aguardarConferenciaPrecoIA'));
  const {context:c,writes,setCommand}=setup();
  const command={requestId:'preview',produtoId:'a',titulo:title,url,createdAt:Date.now()};
  setCommand(command);await c.publishCurrentPageResult(command);
  let saves=0,reads=0,confirms=0;
  const input={value:'199,99'};
  Object.assign(c,{
    window:c,
    db:{collection:()=>({doc:()=>({get:async()=>{reads++;return {exists:true,data:()=>({titulo:title,link:url})};}})})},
    document:{getElementById:()=>input},
    motorConferenciaPrecoDisponivel:()=>({nome:'Robô local',conferir:async()=>writes[0]}),
    numeroPreco:Number,formatarPrecoCampo:value=>Number(value).toFixed(2).replace('.',','),conferenciasPrecoIA:{},
    confirm:()=>{confirms++;return false;},salvarPrecoManual:async()=>{saves++;},
    alert:message=>assert.fail(message),console,
  });
  vm.runInContext(source,c);await c.conferirPrecoComIA('a',{textContent:'IA conferir'});
  assert.equal(reads,1);assert.equal(confirms,1);assert.equal(saves,0);assert.equal(input.value,'199,99');
  assert.equal(c.conferenciasPrecoIA.a,undefined);
});

test('teste puro no editor consulta e mostra resultado sem alterar preço, prova, cadastro ou salvar', async () => {
  const html=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
  const start=html.indexOf('async function testarRoboProdutoEdicao');
  const end=html.indexOf('async function conferirPrecoComIA',start);
  assert.ok(start>=0 && end>start,'teste puro do editor não encontrado');
  assert.match(html,/<button type="button"[^>]*onclick="testarRoboProdutoEdicao\(this\)"/);
  const source=html.slice(start,end);
  const {context:base,writes,setCommand}=setup();
  const command={requestId:'pure-editor',produtoId:'a',titulo:title,url,createdAt:Date.now()};
  setCommand(command);await base.publishCurrentPageResult(command);
  const result=writes[0];
  for(const scenario of [
    {name:'sucesso',result,requests:1,status:/Consulta sem gravação: R\$ 358,79/},
    {name:'outro produto',result:{...result,produtoId:'b'},requests:1,status:/Teste não concluído:/},
    {name:'outro título',result:{...result,tituloEncontrado:'Tênis Adidas Superstar Masculino'},requests:1,status:/Teste não concluído:/},
    {name:'robô antigo',result:{...result,robotVersion:'2.4.0'},requests:1,status:/Teste não concluído:/},
    {name:'falha da consulta',error:new Error('Mercado Livre indisponível'),requests:1,status:/Teste não concluído:/},
    {name:'sem produto aberto',id:null,requests:0,status:/Teste não concluído:/},
    {name:'sem link',link:'',requests:0,status:/Teste não concluído:/},
    {name:'sem robô',motor:false,requests:0,status:/Teste não concluído:/},
  ]) {
    const fields={titulo:{value:title},link:{value:scenario.link ?? url},preco:{value:'199,99'},
      precoAnterior:{value:'249,99'},precoPromocional:{value:'179,99'},'preco-manual-a':{value:'198,99'}};
    const original=Object.freeze({id:'a',titulo:title,link:url,preco:'199,99',precoProvaAnuncio:'MLB1234567890',precoProvaVersao:2});
    const proofCache=Object.freeze({a:Object.freeze({preco:198.99,evidencia:'prova anterior preservada'})});
    const requests=[],messages=[],forbiddenCalls=[];
    const forbidden=name=>(...args)=>{forbiddenCalls.push(name);throw new Error('Chamada proibida: '+name);};
    const c=vm.createContext({
      editProdId:Object.hasOwn(scenario,'id')?scenario.id:'a',produtoEdicaoOriginal:original,conferenciasPrecoIA:proofCache,
      document:{getElementById:id=>fields[id]},window:{RDCAssistedPriceSafety:base.RDCAssistedPriceSafety},
      motorConferenciaPrecoDisponivel:()=>scenario.motor===false?null:{conferir:async request=>{requests.push(JSON.parse(JSON.stringify(request)));if(scenario.error)throw scenario.error;return scenario.result;}},
      formatarPrecoCampo:value=>Number(value).toFixed(2).replace('.',','),informarStatusCadastro:text=>messages.push(text),
      db:{collection:forbidden('Firebase')},updateDoc:forbidden('updateDoc'),salvarPrecoManual:forbidden('salvarPrecoManual'),
      salvarEdicaoProdutoFilaPrecosAssistida:forbidden('salvarEdicaoProduto'),salvarFilaPrecoAssistida:forbidden('salvarFilaPrecoAssistida'),
      confirm:forbidden('confirm'),localStorage:{setItem:forbidden('localStorage')},console,
    });
    const snapshot=()=>JSON.stringify({fields,original:c.produtoEdicaoOriginal,proof:c.conferenciasPrecoIA,id:c.editProdId});
    const before=snapshot();
    const button={textContent:'Consultar com robô (não salva)',disabled:false};
    vm.runInContext(source,c);await c.testarRoboProdutoEdicao(button);
    assert.equal(requests.length,scenario.requests,scenario.name);
    if(requests.length)assert.deepEqual(requests[0],{produtoId:'a',titulo:title,url},scenario.name);
    assert.equal(messages.length,1,scenario.name);assert.match(messages[0],scenario.status,scenario.name);
    assert.equal(snapshot(),before,scenario.name);assert.deepEqual(forbiddenCalls,[],scenario.name);
    assert.equal(button.disabled,false,scenario.name);assert.equal(button.textContent,'Consultar com robô (não salva)',scenario.name);
  }
});

test('total principal aceita Pix, à vista ou parcelado, nunca o valor da parcela', () => {
  for(const label of ['R$ 199,90 à vista','R$ 199,90 no Pix','Preço total parcelado no cartão R$ 199,90']) {
    const doc=page({prices:[money(199.90,{label})]});const {context:c}=setup(doc);
    const result=c.extractDocumentOffer(doc,title,url);
    assert.equal(result.preco,199.90,label);
    assert.equal(result.priceBasis,'highlighted_total');
  }
  for(const label of ['10x de R$ 19,99','12 parcelas de R$ 19,99','6 vezes de R$ 19,99']) {
    const doc=page({prices:[money(19.99,{label})]});const {context:c}=setup(doc);
    assert.equal(c.extractDocumentOffer(doc,title,url).status,'loading',label);
  }
});
test('melhor total visível no bloco principal independe da ordem e do tamanho da fonte', () => {
  for(const totals of [[{value:199.90,size:22},{value:219.90,size:36}],[{value:219.90,size:22},{value:199.90,size:36}]]) {
    const nodes=totals.map(total=>{const node=money(total.value);node.fontSize=total.size;const query=node.querySelector;node.querySelector=selector=>({...query(selector),fontSize:total.size});return node;});
    const doc=page({prices:nodes});
    doc.defaultView.getComputedStyle=node=>({display:'inline',visibility:'visible',fontSize:String(node.fontSize)+'px'});
    const {context:c}=setup(doc);
    assert.equal(c.extractDocumentOffer(doc,title,url).preco,199.90);
  }
});

test('menor total não usa cupom condicional, frete, cashback, parcela ou preço fora do bloco válido',()=>{
 const doc=page({prices:[money(350),money(299.90,{label:'Total no Pix'}),money(10,{label:'Cupom de 10 reais'}),money(5,{label:'Frete 5 reais'}),money(3,{label:'Cashback'}),money(24.99,{label:'12x de 24,99'}),money(199.90,{excluded:true}),money(1,{hidden:true})]});
 const {context:c}=setup(doc),result=c.extractDocumentOffer(doc,title,url);
 assert.equal(result.preco,299.90);assert.equal(result.mainPrice,299.90);
 assert.equal(c.RDCAssistedPriceSafety.validate({...result,produtoId:'p',requestId:'best',checkedAt:Date.now()},{produtoId:'p',url,titulo:title}),'');
});

test('RAM física mais expansão e unidades não são confundidas com modelo do produto',()=>{
 const {context:c}=setup();
 for(const match of [c.matchingProduct,c.RDCAssistedPriceSafety.matchingProduct]){
  assert.equal(match('Smartphone Motorola Moto G35 5G 128GB 12GB RAM Boost Verde','Smartphone Motorola Moto G35 5G 128GB 4GB RAM 8GB Ram Boost Verde'),true);
  assert.equal(match('Motorola Edge 70 Pro 256GB 24GB RAM 12GB RAM 12GB RAM Boost','Motorola Edge 70 Pro 256GB 12GB RAM Boost'),true);
  assert.equal(match('Caixa De Som Basike Ba-RAD207 80W Rádio FM Bluetooth 5.3 TWS RGB','Caixa De Som Basike Ba-RAD207 120W Rádio FM Bluetooth 5.3 TWS RGB'),true);
  assert.equal(match('Smartphone Motorola Moto G35 5G 128GB','Smartphone Motorola Moto G17 5G 128GB'),false);
  assert.equal(match('Fone JBL Tune 520BT Preto Bluetooth','Fone JBL Tune 720BT Preto Bluetooth'),false);
  assert.equal(match('Notebook Asus Vivobook Go Ryzen 5 SSD 512GB','Notebook Asus Vivobook Go Ryzen 3 SSD 256GB'),false);
 }
});
test('mesmo catálogo pode exibir outra oferta; título/modelo e identidade do catálogo continuam exigidos', () => {
  const catalog='https://www.mercadolivre.com.br/fone/p/MLB57289720';
  const requested=catalog+'?wid=MLB2926671021',found=catalog+'?wid=MLB1111111111';
  const expected='Fone JBL Tune 520BT Preto',doc=page({foundTitle:'Fone JBL Tune 520BT Branco',listing:'1111111111',prices:[money(227.05)]});
  const {context:c}=setup(doc);
  const result=c.extractDocumentOffer(doc,expected,found,requested);
  assert.equal(result.status,'ok');assert.equal(result.offerKey,'MLB1111111111');
  const proof={...result,produtoId:'a',requestId:'catalog-main',checkedAt:Date.now()};
  assert.equal(c.RDCAssistedPriceSafety.validate(proof,{produtoId:'a',url:requested,titulo:expected}),'');
  assert.equal(c.sameOffer(requested,catalog.replace('57289720','98765432')+'?wid=MLB1111111111'),false);
  assert.equal(c.extractDocumentOffer(page({foundTitle:'Fone JBL Tune 720BT Branco',listing:'1111111111'}),expected,found,requested).status,'loading');
  assert.ok(c.RDCAssistedPriceSafety.validate({...proof,priceBasis:'installment'},{produtoId:'a',url:requested,titulo:expected}));
  assert.ok(c.RDCAssistedPriceSafety.validate({...proof,offerKey:'MLB9999999999'},{produtoId:'a',url:requested,titulo:expected}));
});
