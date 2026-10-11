import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { publishedEditorialNotes } from './published-editorial.mjs';
import { routerCapabilities, featureState } from './discovery-editorial.mjs';
import { decisionData } from './product-decision.mjs';
import { correctProductData } from './product-title-corrections.mjs';
import { resolutionSummary, pendingRequests } from './localizer-queue.mjs';

test('descoberta preserva análise visível sem inventar Review ou nota', async () => {
  const html='<section class="panel positive"><h2>Pontos positivos</h2><ul><li>Portas Gigabit &amp; Wi-Fi 6 anunciados.</li><li>Compatibilidade &quot;EasyMesh&quot; anunciada.</li></ul></section><section class="panel attention"><ul><li>Alcance não medido.</li></ul></section>';
  assert.deepEqual(publishedEditorialNotes(html,'positive'), ['Portas Gigabit & Wi-Fi 6 anunciados.','Compatibilidade "EasyMesh" anunciada.']);
  assert.deepEqual(publishedEditorialNotes(html,'attention'), ['Alcance não medido.']);
  assert.deepEqual(publishedEditorialNotes('', 'positive', {itemListElement:[{name:'Dado legado'}]}), ['Dado legado']);
  assert.deepEqual(publishedEditorialNotes('<section class="panel positive-other"><ul><li>Não pertence</li></ul></section>', 'positive'), []);
  const source=await readFile(new URL('./generate-discovery.mjs',import.meta.url),'utf8');
  assert.match(source,/pros: publishedEditorialNotes\(html, "positive"/);
  assert.match(source,/contras: publishedEditorialNotes\(html, "attention"/);
});

test('avisos de velocidade e cobertura não negam Wi-Fi 6 ou Mesh', () => {
  const product={titulo:'Roteador AX1500 Wi-Fi 6 Dual Band Gigabit EasyMesh',contras:'AX1500 não é velocidade garantida. EasyMesh não garante cobertura em todos os cômodos.'};
  assert.ok(routerCapabilities(product).includes('Wi-Fi 6'));
  assert.ok(routerCapabilities(product).includes('rede Mesh'));
  assert.equal(decisionData(product).criteria.find(item=>item.label==='Wi-Fi 6').state, 'yes');
  assert.equal(featureState({titulo:'Roteador',contras:'Não possui Wi-Fi 6'}, /wi.?fi\s*6/), 'no');
  assert.equal(featureState({titulo:'Roteador Wi-Fi 6',contras:'Wi-Fi 6 não foi confirmado'}, /wi.?fi\s*6/), 'unknown');
  assert.equal(featureState({titulo:'Roteador Gigabit',contras:'Portas Gigabit não foram confirmadas'}, /gigabit/), 'unknown');
});

test('correções editoriais preservam preço, links, foto e prova da conferência', () => {
  const original={id:'uc5ynLQTGAPKkIMIyzQ2',titulo:'Lanterna Tática Farolete Sabre De Luz Potente 2km Led Laser',comentario:'Potência: 10000000000000000lm',dadosTecnicos:'Potência: 10000000000000000lm',preco:'200,47',link:'https://produto.mercadolivre.com.br/MLB-1234567890',foto:'https://http2.mlstatic.com/foto.webp',precoAtualizadoManualmenteEm:'2026-10-08T21:44:13.696Z',precoConferenciaId:'prova-original'};
  const corrected=correctProductData(original);
  for(const key of ['preco','link','foto','precoAtualizadoManualmenteEm','precoConferenciaId'])assert.equal(corrected[key],original[key]);
  assert.doesNotMatch(corrected.titulo,/2km/i);
  assert.doesNotMatch(corrected.comentario+corrected.dadosTecnicos,/10000000000000000/);
  assert.match(corrected.comentario,/sem comprovação/);
  assert.equal(original.comentario,'Potência: 10000000000000000lm');
  assert.match(correctProductData({id:'Bp4dNosktHQXiSy3r9S0',titulo:'apete Decorativo Casa Laura'}).titulo,/^Tapete/);
  assert.doesNotMatch(correctProductData({id:'YuOWci2UixF5GuQE6IYS',titulo:'Roteador HUAWEI AX2S EasyMeshVisualização de Diagnósticos do'}).titulo,/Visualização/);
  assert.equal(correctProductData({...original,titulo:'Outro produto'}).titulo,'Outro produto');
});

test('resumo do localizador distingue falhas recentes e histórico esgotado', () => {
  const results={a:{status:'ok',tentativas:1},b:{status:'erro',tentativas:1},old:{status:'erro',tentativas:3}};
  assert.deepEqual(resolutionSummary(['a','b'],results),{processed:2,succeeded:1,failed:1,exhausted:1});
  assert.deepEqual(resolutionSummary([],results),{processed:0,succeeded:0,failed:0,exhausted:1});
  assert.deepEqual(pendingRequests([{id:'old',status:'pendente',link:'https://www.mercadolivre.com.br/'}],results),[]);
});

test('seleção detecta referências ausentes sem apagar produtos ou configuração', async () => {
  const context={window:{RDCBestChoices:{}}};
  runInNewContext(await readFile(new URL('../best-choices-admin.js',import.meta.url),'utf8'),context);
  const ids=['existente','retirado'],products=[{id:'existente'}];
  assert.deepEqual(Array.from(context.window.RDCBestChoicesAdmin.missingSelectionIds(ids,products)),['retirado']);
  assert.deepEqual(ids,['existente','retirado']);
  assert.deepEqual(products,[{id:'existente'}]);
});

test('workflow sinaliza consulta incompleta somente após preservar/publicar resultados', async () => {
  const workflow=await readFile(new URL('../.github/workflows/localizar-mlb.yml',import.meta.url),'utf8');
  assert.match(workflow,/id: resolver/);
  assert.match(workflow,/steps\.resolver\.outputs\.incomplete == 'true'/);
  assert.ok(workflow.indexOf('Sinalizar dados não obtidos')>workflow.indexOf('git push origin HEAD:main'));
  const resolver=await readFile(new URL('./resolve-affiliate-links.mjs',import.meta.url),'utf8');
  assert.match(resolver,/incomplete=\$\{summary\.failed > 0 \|\| !head\.readSucceeded\}/);
});
