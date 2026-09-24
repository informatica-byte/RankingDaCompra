import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const html = readFileSync(resolve("painel-celular.html"), "utf8");
const start = html.indexOf("function linkPrecoAssistido(produto)");
const end = html.indexOf("function campoPrecoFila(produto)", start);
assert.ok(start >= 0 && end > start, "Funções da janela de conferência não encontradas");
const code = html.slice(start, end);

function setup({ mobile = false, blocked = false } = {}) {
  const opened = [];
  const messages = [];
  const popup = {
    closed: false,
    opener: {},
    location: { href: "" },
    focusCount: 0,
    focus() { this.focusCount++; }
  };
  const context = {
    URL,
    screen: { availWidth: mobile ? 390 : 1440, availHeight: mobile ? 800 : 900 },
    window: {
      innerWidth: mobile ? 390 : 1200,
      matchMedia: () => ({ matches: mobile }),
      open(url, name, options) {
        opened.push({ url, name, options });
        return blocked ? null : popup;
      }
    },
    filaPrecosDados: { todos: [
      { id: "primeiro", link: "https://www.mercadolivre.com.br/primeiro" },
      { id: "segundo", link: "https://www.mercadolivre.com.br/segundo" }
    ] },
    filaPrecosIdAtual: "primeiro",
    msg: (...args) => messages.push(args)
  };
  runInNewContext(code, context);
  return { context, opened, popup, messages };
}

function click() {
  return { prevented: false, preventDefault() { this.prevented = true; } };
}

test("reutiliza uma só janela e conserva a fila no computador", () => {
  const { context, opened, popup } = setup();
  const first = click();
  context.abrirAnuncioConferencia(first);
  assert.equal(first.prevented, true);
  assert.equal(opened.length, 1);
  assert.match(opened[0].options, /popup=yes/);
  assert.equal(popup.opener, null);
  assert.equal(popup.location.href, "https://www.mercadolivre.com.br/primeiro");
  context.filaPrecosIdAtual = "segundo";
  const second = click();
  context.abrirAnuncioConferencia(second);
  assert.equal(second.prevented, true);
  assert.equal(opened.length, 1);
  assert.equal(popup.location.href, "https://www.mercadolivre.com.br/segundo");
  assert.equal(popup.focusCount, 2);
});

test("no celular tenta reutilizar a aba sem solicitar janela pequena", () => {
  const { context, opened } = setup({ mobile: true });
  context.abrirAnuncioConferencia(click());
  assert.equal(opened.length, 1);
  assert.equal(opened[0].options, "");
});

test("se o navegador bloquear a janela, o link comum continua funcionando", () => {
  const { context, opened } = setup({ blocked: true });
  const event = click();
  context.abrirAnuncioConferencia(event);
  assert.equal(opened.length, 1);
  assert.equal(event.prevented, false);
});

test("não abre endereço inválido ou fora do Mercado Livre", () => {
  const { context, opened, messages } = setup();
  context.filaPrecosDados.todos[0].link = "https://example.com/oferta";
  const event = click();
  context.abrirAnuncioConferencia(event);
  assert.equal(event.prevented, true);
  assert.equal(opened.length, 0);
  assert.equal(messages.length, 1);
});
