import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('política em meta bloqueia objetos/base/form externo antes dos scripts sem bloquear Firebase',()=>{
 for(const file of ['index.html','dashboard.html','painel-celular.html','estudio-videos.html','oauth-mercadolivre.html']){
  const html=read(file),policy=html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(policy,file); assert.ok(html.indexOf(policy[0])<html.indexOf('<script'),file);
  assert.match(policy[1],/object-src 'none'/);assert.match(policy[1],/base-uri 'self'/);assert.match(policy[1],/form-action 'self'/);
  assert.doesNotMatch(policy[1],/default-src|script-src|connect-src|frame-ancestors|sandbox/);
  assert.match(html,/<meta name="referrer" content="strict-origin-when-cross-origin">/);
 }
});
test('painéis carregam validador novo e orientam preservar campos antes de recarregar',()=>{
 for(const file of ['dashboard.html','painel-celular.html']){
  const html=read(file);assert.match(html,/assisted-price-safety.js\?v=20261026-min2415/);
  assert.doesNotMatch(html,/2\.4\.4 ou superior/);assert.match(html,/Salve ou copie os campos preenchidos antes de recarregar/);
 }
});
test('suíte de autorização é isolada de produção e tem execução própria no CI',()=>{
 const source=read('tests/firestore-rules/rules.test.mjs'),workflow=read('.github/workflows/test-firestore-rules.yml');
 assert.match(source,/assert.equal\(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8089'/);
 assert.match(source,/projectId:'demo-ranking-audit'/);
 assert.match(workflow,/--project demo-ranking-audit/);assert.match(workflow,/--frozen-lockfile/);
 assert.doesNotMatch(workflow,/id-token:|secrets\.|firebase deploy|workflow_run/);
});
