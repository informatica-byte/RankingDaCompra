import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const html = readFileSync(new URL('../painel-celular.html', import.meta.url), 'utf8');
const handler = html.slice(html.indexOf('async function preencherRevisaoIA()'), html.indexOf('function mlb(v)')) + '\n$("revisao-ia").onclick = preencherRevisaoIA;';
const link = 'https://example.invalid/anuncio?variante=1';
function fixture(source = link) {
  const fields = Object.fromEntries(['revisao-ia','revisao-ia-status','link','link-afiliado','titulo','preview','dados','resumo','pros','contras'].map(id => [id, { value: '', getClientRects: () => [1] }]));
  fields.link.value = link;
  let finish;
  const result = new Promise(resolve => { finish = resolve; });
  const ctx = { URL, $: id => fields[id], auth: {currentUser:{}}, resultado:{link}, marketplaceAtual:()=>'', linkMarketplaceValido:()=>true,
    modelRapido:{generateContent:()=>result}, comPrazo:x=>x, json:x=>x, lista:x=>x,
    mensagemIA:e=>e.message, textoEditorial:x=>Array.isArray(x)?x.join('\n'):x,
    window:{RDCEditorialPolicy:{assertDraft(){}}} };
  runInNewContext(handler, ctx);
  return { fields, start: fields['revisao-ia'].onclick, finish: () => finish({response:{
    candidates:[{urlContextMetadata:{urlMetadata:[{urlRetrievalStatus:'URL_RETRIEVAL_STATUS_SUCCESS',retrievedUrl:source}]}}],
    text:()=>JSON.stringify({status:'ok',dadosTecnicos:['Especificação A'.repeat(4),'Especificação B'.repeat(4),'Especificação C'.repeat(4)],comentario:'Resumo',pros:['Vantagem'],contras:['Limitação']}) }}) };
}
test('preenche os quatro campos vazios com a resposta do anúncio exato', async () => {
  const f=fixture(), done=f.start();
  f.finish(); await done;
  assert.match(f.fields.dados.value,/Especificação/);
  assert.equal(f.fields.resumo.value,'Resumo');
  assert.equal(f.fields.pros.value,'Vantagem');
  assert.equal(f.fields.contras.value,'Limitação');
});
test('preenche vazios e preserva texto anterior e texto digitado durante a consulta', async () => {
  const f=fixture();
  f.fields.resumo.value='Anterior';
  const done=f.start();
  f.fields.pros.value='Digitado';
  f.finish(); await done;
  assert.match(f.fields.dados.value,/Especificação/);
  assert.equal(f.fields.contras.value,'Limitação');
  assert.equal(f.fields.resumo.value,'Anterior');
  assert.equal(f.fields.pros.value,'Digitado');
});
test('não preenche para fonte diferente ou revisão trocada', async () => {
  for (const source of [link, link.replace('=1','=2')]) {
    const f=fixture(source), done=f.start();
    if (source===link) f.fields.link.value='https://example.invalid/outro';
    f.finish(); await done;
    assert.equal(f.fields.dados.value,'');
    assert.equal(f.fields.contras.value,'');
  }
});
