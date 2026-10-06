import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const panel = await readFile(new URL("../painel-celular.html", import.meta.url), "utf8");
const bot = await readFile(new URL("../bot-precos.user.js", import.meta.url), "utf8");

test("robô atua no painel móvel e nas páginas logadas do Mercado Livre", () => {
  assert.match(bot, /@match\s+https:\/\/rankingdacompra\.com\.br\/painel-celular\.html\*/);
  assert.match(bot, /@match\s+https:\/\/\*\.mercadolivre\.com\.br\/\*/);
  assert.match(bot, /GM_addValueChangeListener/);
  assert.match(bot, /conferirPrecoNaAbaLocal/);
});

test("leitura exige preço principal visível e reconhece bloqueio e indisponibilidade", () => {
  assert.match(bot, /extractStructuredPrice/);
  assert.match(bot, /pagina_principal_visivel/);
  assert.match(bot, /status:\s*"security"/);
  assert.match(bot, /status:\s*"unavailable"/);
  assert.match(bot, /status:\s*"ok",\s*preco/);
});

test("painel oferece iniciar, continuar após CAPTCHA e parar", () => {
  assert.match(panel, /id="precos-auto-iniciar"/);
  assert.match(panel, /id="precos-auto-continuar"/);
  assert.match(panel, /id="precos-auto-parar"/);
  assert.match(panel, /pausarAutomacaoPrecosAssistida/);
});

test("automação separa indisponíveis sem excluir automaticamente", () => {
  const start = panel.indexOf("async function executarAutomacaoPrecosAssistida");
  const end = panel.indexOf("function iniciarAutomacaoPrecosAssistida", start);
  assert.ok(start >= 0 && end > start, "rotina automática não encontrada");
  const automation = panel.slice(start, end);
  assert.match(automation, /automacaoPrecosIndisponiveis/);
  assert.doesNotMatch(automation, /deleteDoc\s*\(/);
});

test("salvamento automático preserva o mesmo validador da conferência manual", () => {
  assert.match(panel, /salvarFilaPrecoAssistida\(resultadoLocal\.preco, \{ automatico: true, produtoId: produto.id, resultado: resultadoLocal \}\)/);
  assert.match(panel, /RDCAssistedPriceSafety.validate\(opcoes.resultado/);
  assert.match(panel, /preço anterior da promoção/i);
});
