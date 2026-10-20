import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {publishLocalizer} from './publish-localizer.mjs';
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function fixture() {
  const dir=mkdtempSync(join(tmpdir(),'rdc-localizer-'));
  const remote=join(dir,'remote.git'),a=join(dir,'a'),b=join(dir,'b');
  mkdirSync(remote);git(remote,'init','--bare');
  git(dir,'clone',remote,a);
  git(a,'config','user.name','Test');git(a,'config','user.email','test@example.invalid');
  git(a,'checkout','-b','main');
  writeFileSync(join(a,'mlb-resolucoes.json'),JSON.stringify({resultados:{old:{status:'ok'}}}));
  writeFileSync(join(a,'.mercadolivre-token.enc'),'opaque-test-v1');
  git(a,'add','.');git(a,'commit','-m','initial');git(a,'push','origin','main');
  git(dir,'clone','-b','main',remote,b);
  git(b,'config','user.name','Test');git(b,'config','user.email','test@example.invalid');
  return {a,b};
}
const edit=a=>writeFileSync(join(a,'mlb-resolucoes.json'),JSON.stringify({resultados:{old:{status:'ok'},new:{status:'ok'}}}));
test('publica resultados preservando os antigos e sem sobrescrever mudanças não relacionadas',()=>{
  const {a,b}=fixture();edit(a);
  writeFileSync(join(b,'site.txt'),'new site');git(b,'add','.');git(b,'commit','-m','site');git(b,'push','origin','main');
  assert.equal(publishLocalizer(a).changed,true);
  assert.equal(readFileSync(join(a,'site.txt'),'utf8'),'new site');
  const remote=JSON.parse(git(a,'show','origin/main:mlb-resolucoes.json'));
  assert.ok(remote.resultados.old);assert.ok(remote.resultados.new);
  assert.equal(publishLocalizer(a).changed,false);
});
test('token remoto renovado impede sobrescrita e preserva os resultados locais',()=>{
  const {a,b}=fixture();edit(a);writeFileSync(join(a,'.mercadolivre-token.enc'),'opaque-local-v2');
  writeFileSync(join(b,'.mercadolivre-token.enc'),'opaque-remote-v3');git(b,'add','.');git(b,'commit','-m','refresh');git(b,'push','origin','main');
  assert.throws(()=>publishLocalizer(a),/mudaram no remoto/);
  assert.equal(git(a,'show','origin/main:.mercadolivre-token.enc'),'opaque-remote-v3');
  assert.ok(JSON.parse(readFileSync(join(a,'mlb-resolucoes.json'),'utf8')).resultados.new);
  assert.equal(readFileSync(join(a,'.mercadolivre-token.enc'),'utf8'),'opaque-local-v2');
});
test('remoção de resultado existente é bloqueada sem publicar',()=>{
  const {a}=fixture();writeFileSync(join(a,'mlb-resolucoes.json'),JSON.stringify({resultados:{}}));
  assert.throws(()=>publishLocalizer(a),/removeria resultados/);
  assert.ok(JSON.parse(git(a,'show','origin/main:mlb-resolucoes.json')).resultados.old);
});
test('workflow parte do main atual e preserva artefato só em falhas',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/localizar-mlb.yml',import.meta.url),'utf8');
  assert.match(workflow,/ref: main/);assert.match(workflow,/fetch-depth: 0/);
  assert.match(workflow,/group: rankingdacompra-publicacao/);
  assert.match(workflow,/steps\.publicar\.outcome == 'failure'/);
  assert.match(workflow,/include-hidden-files: true/);
  assert.doesNotMatch(workflow,/git pull --rebase|git push --force/);
});
