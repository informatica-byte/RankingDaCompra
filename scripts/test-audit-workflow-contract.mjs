import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/auditar-site.yml', import.meta.url), 'utf8');

test('auditoria publica usa runner hospedado e actions compativeis com Node 24', () => {
  assert.match(workflow, /^    runs-on: ubuntu-latest\s*$/m);
  assert.match(workflow, /uses: actions\/setup-node@v5\s+with:\s+node-version: ["']24["']/);
  assert.match(workflow, /^        uses: actions\/upload-artifact@v6\.0\.0\s*$/m);
  assert.doesNotMatch(workflow, /actions\/upload-artifact@v[1-5](?:\b|\.)/);
});

test('auditoria continua manual, somente leitura e sem consultar Firebase', () => {
  assert.match(workflow, /^on:\s*\n  workflow_dispatch:\s*\npermissions:\s*\n  contents: read\s*\njobs:/m);
  assert.doesNotMatch(workflow, /\b(?:secrets|id-token|write-all)\b/);
  assert.match(workflow, /node --test scripts\/test-\*\.mjs/);
  assert.match(workflow, /node scripts\/validate-site\.mjs/);
  assert.match(workflow, /node scripts\/audit-site-integrity\.mjs --online/);
});

test('artefato preserva sempre o relatorio publico JSON por catorze dias', () => {
  const artifactStep = workflow.match(/      - name: Guardar relat[oó]rio sem dados privados\r?\n([\s\S]*?)(?=\r?\n      - |$)/)?.[1];
  assert.ok(artifactStep, 'Etapa de armazenamento do relatorio deve existir');
  assert.match(artifactStep, /^        if: always\(\)\s*$/m);
  assert.match(artifactStep, /^          name: auditoria-site-publico\s*$/m);
  assert.match(artifactStep, /^          path: audit-output\/integridade\.json\s*$/m);
  assert.match(artifactStep, /^          retention-days: 14\s*$/m);
  assert.doesNotMatch(artifactStep, /include-hidden-files\s*:\s*true/i);
  assert.doesNotMatch(artifactStep, /(?:^|\n)\s*path:\s*(?:\.|\*|\.\/|\*\*)\s*(?:\n|$)/);
});
