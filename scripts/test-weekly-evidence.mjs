import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const safety = createRequire(import.meta.url)('../weekly-comparison-safety.js');
test('ausência, instruções genéricas e repetição do título não são evidência semanal', () => {
  assert.deepEqual(safety.specificEvidence([
    'A ficha cadastrada ainda não traz pontos positivos específicos suficientes',
    'Confirme compatibilidade, garantia, frete e vendedor',
    'Configuração que exige atenção às diretrizes do fabricante',
    'Roteador Mercusys MR80X Wi-Fi 6',
  ], 'Roteador Mercusys MR80X Wi-Fi 6'), []);
});
test('características concretas são preservadas sem copiar elogios genéricos', () => {
  assert.deepEqual(safety.specificEvidence('Excelente relação custo-benefício, Possui portas Gigabit LAN e WAN, Não possui portas USB integradas'), [
    'Possui portas Gigabit LAN e WAN', 'Não possui portas USB integradas',
  ]);
});
test('uma única visita ou poucos cliques não pontuam como procura comprovada', () => {
  assert.equal(safety.demandScore(0, 1, 1), 60);
  assert.equal(safety.demandScore(0, 0, 1), 60);
  assert.equal(safety.demandScore(2, 0, 8), 60);
  assert.ok(safety.demandScore(5, 20, 40) > safety.demandScore(0, 0, 40));
});
