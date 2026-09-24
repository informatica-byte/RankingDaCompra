import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../dashboard.html", import.meta.url), "utf8");
const start = html.indexOf("function numeroPreco(valor) {");
const end = html.indexOf("function cartaoProdutoPreco(doc) {", start);
assert.ok(start >= 0 && end > start, "diagnóstico de preço não encontrado no painel");
const source = html.slice(start, end);

function diagnosticar(produto, status) {
  const id = "produto-teste";
  const context = vm.createContext({
    Date,
    statusMercadoLivreAdmin: status ? { [id]: status } : {},
  });
  vm.runInContext(source, context);
  return context.diagnosticoPreco({ id, data: () => produto });
}

const agora = Date.now();
const minutosAtras = minutos => new Date(agora - minutos * 60_000).toISOString();
const produto = {
  preco: "100,00",
  precoAtualizadoManualmente: true,
  precoAtualizadoManualmenteEm: { toMillis: () => agora - 10 * 60_000 },
};
const consulta = checkedAt => ({
  itemId: "MLB123456789",
  managed: true,
  status: "active",
  available: true,
  price: 90,
  checkedAt,
});

test("conferência manual posterior elimina divergência de preço antigo", () => {
  const status = { ...consulta(minutosAtras(120)), lastError: "HTTP 403" };
  const resultado = diagnosticar(produto, status);
  assert.equal(resultado.pendente, false);
  assert.equal(resultado.tipo, "");
  assert.equal(resultado.automaticoMaisNovo, false);
});

test("falha 403 sem conferência manual é não concluída, não preço divergente", () => {
  const resultado = diagnosticar({ preco: "100,00" }, {
    ...consulta(minutosAtras(120)), lastError: "HTTP 403",
  });
  assert.equal(resultado.tipo, "nao_confirmado");
  assert.equal(resultado.pendente, false);
});

test("confirmação automática anterior não substitui conferência manual mais recente", () => {
  const resultado = diagnosticar(produto, consulta(minutosAtras(20)));
  assert.equal(resultado.pendente, false);
});

test("confirmação automática recente e posterior pode detectar diferença real", () => {
  const resultado = diagnosticar(produto, consulta(minutosAtras(5)));
  assert.equal(resultado.pendente, true);
  assert.equal(resultado.tipo, "divergente");
});

test("preço automático antigo não é sugerido como divergência atual", () => {
  const resultado = diagnosticar({ preco: "100,00" }, consulta(minutosAtras(300)));
  assert.equal(resultado.pendente, false);
  assert.equal(resultado.tipo, "nao_confirmado");
});

test("preço cadastrado inválido continua exigindo correção", () => {
  const resultado = diagnosticar({ ...produto, preco: "" }, consulta(minutosAtras(20)));
  assert.equal(resultado.pendente, true);
  assert.equal(resultado.tipo, "divergente");
});

test("promoção encerrada usa o preço normal, como a fila móvel", () => {
  const resultado = diagnosticar({
    ...produto,
    preco: "100,00",
    precoAnterior: "120,00",
    precoPromocional: "90,00",
    promocaoAtiva: true,
    promocaoValidaAte: "2026-01-01",
  }, null);
  assert.equal(resultado.campo, "preco");
  assert.equal(resultado.pendente, false);
});

test("promoção válida usa o preço promocional", () => {
  const resultado = diagnosticar({
    ...produto,
    precoAnterior: "120,00",
    precoPromocional: "90,00",
    promocaoAtiva: true,
    promocaoValidaAte: "2099-01-01",
  }, null);
  assert.equal(resultado.campo, "precoPromocional");
});
