import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync('painel-celular.html','utf8');
function between(start,end){const first=html.indexOf(start),last=html.indexOf(end,first);assert.ok(first>=0&&last>first);return html.slice(first,last);}
const helpers=between('function mlb(v) {','function seg(v) {')
  +between('function mesmaIdentidadePublicacao(','async function aplicarResultadoRobo(');
const handler=between('async function revisarCadastroExistentePublicacao() {','$("analisar").onclick = async () => {');
const link='https://produto.mercadolivre.com.br/MLB-123456789-fone-_JM';
const product={id:'persisted',titulo:'Fone TWS existente',link,linkAfiliado:'https://meli.la/original',mercadoLivreItemId:'MLB123456789',categoria:'audio',preco:'150,00',precoAnterior:'180,00',precoPromocional:'130,00',foto:'https://example.com/foto.jpg',dadosTecnicos:'Dados cadastrados',comentario:'Texto original',pros:'Qualidade',contras:'Limitação',selo:'Mais Vendido'};
const plain=value=>JSON.parse(JSON.stringify(value));
const snapshot=(items=[],fromCache=false)=>({docs:items.map(item=>({id:item.id,data:()=>Object.fromEntries(Object.entries(item).filter(([key])=>key!=='id'))})),metadata:{fromCache}});
function setup({read,products=[product]}={}){
  const messages=[],reads=[],forbidden=[],images=[],shown=[];
  const ids=['link','link-afiliado','link-shopee','preco-shopee','titulo','categoria','selo','anterior','atual','foto','dados','resumo','pros','contras','duracao'];
  const fields=Object.fromEntries(ids.map(id=>[id,{id,value:'Rascunho '+id,checked:false}]));
  fields.link.value=link;fields['link-afiliado'].value='https://meli.la/draft';
  fields.preview={style:{display:'none'},scrollIntoView(){}};
  fields.analisar={disabled:false};fields['revisar-cadastro-existente']={disabled:false};
  const tipo={id:'tipo-promocao',value:'promocao',checked:true};
  const deny=name=>(...args)=>{forbidden.push({name,args});throw Error('Ação proibida: '+name);};
  const ctx={URL,URLSearchParams,Map,Promise,JSON,Array,Error,window:{},auth:{currentUser:{uid:'admin'}},db:{},
    imagemProdutoMovel:{clear(){},capture:()=>null},
    $:id=>fields[id],document:{querySelector:selector=>selector==='[name="tipo"]:checked'?tipo:null,querySelectorAll:()=>[...ids.map(id=>fields[id]),tipo]},
    msg:(...args)=>messages.push(args),automacaoPrecosAtiva:false,filaPrecosSalvando:false,publicacaoExpressaEmAndamento:false,
    roboPedidoAtual:null,edicaoManual:true,resultado:{draft:true},
    cadastroExistenteExpressa:{isBusy:()=>false,show:(...args)=>shown.push(args)},ofertasRelampagoExistentesMovel:{isBusy:()=>false},
    collection:(_db,name)=>{assert.equal(name,'produtos');return {collection:name};},where:(field,operator,value)=>({field,operator,value}),limit:value=>({limit:value}),query:(...parts)=>parts,
    getDocsFromServer:async query=>{const index=reads.push(query)-1;if(read)return read(query,index);const filter=query.find(part=>part.field);return snapshot(products.filter(item=>item[filter.field]===filter.value));},
    comPrazo:async promise=>promise,
    preco:value=>String(value||''),tituloDoLink:()=>'',limparFotoPrevia(){},atualizarAtalhoPublicacao(){},carregarFotoPrevia:async url=>{images.push(url);return true;},
    categoriasMovel:{prefer:value=>{fields.categoria.value=value;}},
    localStorage:{getItem:deny('storage-read'),setItem:deny('storage-write'),removeItem:deny('storage-remove')},
    sessionStorage:{getItem:deny('session-read'),setItem:deny('session-write')},
  };
  for(const name of ['getDocs','addDoc','setDoc','updateDoc','deleteDoc','runTransaction','criarPedidoRobo','gerarIA','aguardarRobo','lerResultadoRobo','lerResultadoRoboPorLink','monitorarRoboSegundoPlano','fetch'])ctx[name]=deny(name);
  for(const file of ['product-save-safety.js','assisted-price-safety.js'])runInNewContext(readFileSync(file,'utf8'),ctx);
  runInNewContext(helpers+handler,ctx);
  const state=()=>plain({values:Object.fromEntries(ids.map(id=>[id,fields[id].value])),preview:fields.preview.style,resultado:ctx.resultado,roboPedidoAtual:ctx.roboPedidoAtual,edicaoManual:ctx.edicaoManual});
  const click=()=>fields['revisar-cadastro-existente'].onclick();
  return {ctx,fields,messages,reads,forbidden,images,shown,state,click};
}
function assertNoGeneration(ui){assert.deepEqual(ui.forbidden,[]);assert.equal(ui.fields['revisar-cadastro-existente'].disabled,false);assert.equal(ui.ctx.publicacaoExpressaEmAndamento,false);}

test('botão separado não submete formulário e consulta o cadastro persistido sem geração ou escrita',async()=>{
  assert.match(html,/<button id="revisar-cadastro-existente"[^>]*type="button"[^>]*>📋 Revisar cadastro existente<\/button>/);
  const ui=setup(),before=JSON.stringify(product);
  await ui.click();
  assert.equal(ui.reads.length,3);assert.ok(ui.reads.every(query=>query.some(part=>part.limit===2)));
  assert.equal(ui.fields.preview.style.display,'block');
  assert.equal(ui.ctx.resultado.produtoExistenteId,product.id);
  for(const [field,name] of Object.entries({titulo:'titulo',categoria:'categoria',selo:'selo',anterior:'precoAnterior',atual:'precoPromocional',foto:'foto',dados:'dadosTecnicos',resumo:'comentario',pros:'pros',contras:'contras','link':'link','link-afiliado':'linkAfiliado'}))assert.equal(ui.fields[field].value,product[name],field);
  assert.equal(ui.ctx.resultado.linkAfiliado,product.linkAfiliado);
  assert.deepEqual(ui.shown,[[product.id,product.link]]);assert.deepEqual(ui.images,[product.foto]);
  assert.equal(JSON.stringify(product),before,'não altera campos de preço, links ou qualquer dado do produto');
  assertNoGeneration(ui);
});

test('ausência de cadastro preserva todos os campos, o preview e o resultado anterior',async()=>{
  const ui=setup({products:[]}),before=ui.state();await ui.click();
  assert.deepEqual(ui.state(),before);assert.deepEqual(ui.images,[]);assert.deepEqual(ui.shown,[]);
  assert.match(ui.messages.at(-1)[1],/Nenhum cadastro.*mantidos/);assertNoGeneration(ui);
});

test('falha total ou parcial das leituras não aceita nem um cadastro encontrado e mantém o formulário',async()=>{
  for(const failed of [[0,1,2],[1]]){
    const ui=setup({read:async(_query,index)=>{if(failed.includes(index))throw Error('permission-denied');return snapshot([product]);}}),before=ui.state();
    await ui.click();assert.deepEqual(ui.state(),before);assert.equal(ui.reads.length,3);
    assert.deepEqual(ui.images,[]);assert.deepEqual(ui.shown,[]);assert.match(ui.messages.at(-1)[1],/Não foi possível confirmar.*mantidos/);assertNoGeneration(ui);
  }
});

test('resposta de cache, resposta incompleta e cadastros ambíguos falham sem tocar no rascunho',async()=>{
  for(const read of [async()=>snapshot([product],true),async()=>({}),async()=>({docs:snapshot([product]).docs}),async()=>snapshot([product,{...product,id:'duplicate'}])]){
    const ui=setup({read}),before=ui.state();await ui.click();assert.deepEqual(ui.state(),before);assert.deepEqual(ui.shown,[]);assertNoGeneration(ui);
  }
});

test('anúncio diferente não é aberto mesmo que a consulta devolva outro produto',async()=>{
  const ui=setup({read:async()=>snapshot([{...product,link:'https://produto.mercadolivre.com.br/MLB-987654321-outro-_JM'}])}),before=ui.state();
  await ui.click();assert.deepEqual(ui.state(),before);assert.deepEqual(ui.shown,[]);assertNoGeneration(ui);
});

test('link inválido ou sessão ausente não inicia consultas nem muda o formulário',async()=>{
  for(const invalid of ['link','session']){
    const ui=setup();if(invalid==='link')ui.fields.link.value='javascript:alert(1)';else ui.ctx.auth.currentUser=null;
    const before=ui.state();await ui.click();assert.deepEqual(ui.state(),before);assert.equal(ui.reads.length,0);assertNoGeneration(ui);
  }
});

test('preparação, monitor de robô e conferência em andamento bloqueiam a revisão sem alterá-los',async()=>{
  for(const busy of ['preparar','monitor','conferencia']){
    const ui=setup();if(busy==='preparar')ui.fields.analisar.disabled=true;else if(busy==='monitor')ui.ctx.roboPedidoAtual={pedidoId:'preservar'};else ui.ctx.automacaoPrecosAtiva=true;
    const before=ui.state();await ui.click();assert.deepEqual(ui.state(),before);assert.equal(ui.reads.length,0);assertNoGeneration(ui);
  }
});

test('edição ou troca de sessão durante a consulta descarta o retorno sem sobrescrever campos',async()=>{
  for(const change of ['field','session','monitor']){
    const finish=[];const ui=setup({read:()=>new Promise(resolve=>finish.push(resolve))});const pending=ui.click();
    assert.equal(ui.fields['revisar-cadastro-existente'].disabled,true);
    assert.equal(ui.ctx.publicacaoExpressaEmAndamento,true,'os outros fluxos de publicação permanecem bloqueados durante a leitura');
    if(change==='field')ui.fields.titulo.value='Edição durante a leitura';else if(change==='session')ui.ctx.auth.currentUser={uid:'other'};else ui.ctx.roboPedidoAtual={pedidoId:'preservar'};
    const before=ui.state();finish.forEach(resolve=>resolve(snapshot([product])));await pending;
    assert.deepEqual(ui.state(),before);assert.deepEqual(ui.shown,[]);assert.match(ui.messages.at(-1)[1],/mudou durante a consulta/);assertNoGeneration(ui);
  }
});

test('cadastro existente aberto pelo botão continua impedido de criar nova publicação',async()=>{
  const ui=setup();await ui.click();ui.ctx.cats=[{id:product.categoria}];ui.fields.publicar={disabled:false};
  runInNewContext(between('$("preview").onsubmit = async (e) => {','$("limpar").onclick = () => {'),ui.ctx);
  let prevented=0;await ui.fields.preview.onsubmit({preventDefault(){prevented++;}});
  assert.equal(prevented,1);assert.match(ui.messages.at(-1)[1],/já está cadastrado/);assertNoGeneration(ui);
});


test('falha da foto não impede abertura e erro inesperado de renderização não promete preservar todos os campos',async()=>{
  const unavailable=setup();unavailable.ctx.carregarFotoPrevia=async()=>false;
  await unavailable.click();assert.equal(unavailable.fields.preview.style.display,'block');assertNoGeneration(unavailable);
  const unexpected=setup();unexpected.ctx.categoriasMovel.prefer=()=>{throw Error('DOM indisponível');};
  await unexpected.click();assert.match(unexpected.messages.at(-1)[1],/Nenhuma alteração foi salva; confira os campos/);
  assert.doesNotMatch(unexpected.messages.at(-1)[1],/campos.*mantidos/);assertNoGeneration(unexpected);
});

test('timeout de consulta preserva a revisão e não deixa caminho de geração ou gravação',async()=>{
  const ui=setup(),before=ui.state();ui.ctx.comPrazo=async promise=>{await promise;throw Error('timeout');};
  await ui.click();assert.deepEqual(ui.state(),before);assert.deepEqual(ui.shown,[]);assertNoGeneration(ui);
});
