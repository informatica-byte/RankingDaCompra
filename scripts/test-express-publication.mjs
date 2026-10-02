import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync("painel-celular.html", "utf8");
const start = html.indexOf("async function lerJsonResultados(");
const end = html.indexOf("let rankingDraftMovel", start);
assert.ok(start > 0 && end > start);
const code = html.slice(start, end);
const link = "https://www.mercadolivre.com.br/chaleira/p/MLB76591176?wid=MLB5039509567";
const affiliate = "https://meli.la/exemplo";

function setup() {
  const messages = [], applied = [], removed = [], shortcuts = [], listeners = {};
  const fields = { link: { value: link }, "link-afiliado": { value: affiliate }, titulo: { value: "Meu título" } };
  const ctx = {
    Date, URL, AbortController, setTimeout, clearTimeout,
    cacheResultadosApi: {}, ultimaConsultaResultadosApi: 0, ultimaConsultaResultadosPublicos: 0,
    consultaResultadosEmAndamento: null, roboMonitorId: 1, roboPedidoAtual: null, edicaoManual: false,
    RESULTADOS_API: "https://api.github.com/repos/informatica-byte/RankingDaCompra/contents/mlb-resolucoes.json?ref=main",
    $: id => fields[id],
    mlb: value => String(value).match(/MLB\d+/)?.[0] || "",
    msg: (...args) => messages.push(args),
    localStorage: { removeItem: key => removed.push(key) },
    mostrarAtalhoRobo: show => shortcuts.push(show),
    aplicarResultadoRobo: async (...args) => applied.push(args),
    esperar: async () => {},
    fetch: async () => ({ ok: false }),
    window: { addEventListener: (name, handler) => { listeners[name] = handler; } },
    document: { visibilityState: "visible", addEventListener: (name, handler) => { listeners[name] = handler; } },
  };
  runInNewContext(code, ctx);
  const pedido = { pedidoId: "chaleira", chave: "pendente:" + link, link, linkAfiliado: affiliate, tipo: "promocao", monitorId: 1 };
  ctx.roboPedidoAtual = pedido;
  return { ctx, pedido, messages, applied, removed, shortcuts, fields, listeners };
}

test("resultado de erro termina a espera e preserva os campos", async () => {
  const { ctx, pedido, messages, applied, removed, fields, shortcuts } = setup();
  ctx.cacheResultadosApi.chaleira = { status: "erro", motivo: "Os dados oficiais não ficaram disponíveis." };
  assert.equal(await ctx.conferirRetornoRobo(pedido), true);
  assert.equal(ctx.roboPedidoAtual, null);
  assert.equal(applied.length, 0);
  assert.equal(fields.titulo.value, "Meu título");
  assert.equal(fields.link.value, link);
  assert.equal(removed.length, 1);
  assert.deepEqual(shortcuts, [false]);
  assert.match(messages.at(-1)[1], /robô terminou sem conseguir preencher/);
  assert.doesNotMatch(messages.at(-1)[1], /continua trabalhando/);
});

test("resultado pronto nunca substitui edição manual", async () => {
  const { ctx, pedido, messages, applied, fields } = setup();
  ctx.cacheResultadosApi.chaleira = { status: "ok", titulo: "Título automático" };
  ctx.edicaoManual = true;
  assert.equal(await ctx.conferirRetornoRobo(pedido), true);
  assert.equal(applied.length, 0);
  assert.equal(fields.titulo.value, "Meu título");
  assert.match(messages.at(-1)[1], /campos editados foram preservados/);
});

test("resultado pronto é aplicado quando não houve edição", async () => {
  const { ctx, pedido, applied } = setup();
  ctx.cacheResultadosApi.chaleira = { status: "ok" };
  assert.equal(await ctx.conferirRetornoRobo(pedido), true);
  assert.equal(applied.length, 1);
  assert.equal(applied[0][1], link);
  assert.equal(applied[0][2], affiliate);
});

test("não aplica resultado de outro produto ao trocar o link", async () => {
  const { ctx, pedido, applied, messages, fields } = setup();
  ctx.cacheResultadosApi.chaleira = { status: "ok" };
  fields.link.value = "https://www.mercadolivre.com.br/outro";
  assert.equal(await ctx.conferirRetornoRobo(pedido), false);
  assert.equal(applied.length, 0);
  assert.equal(messages.length, 0);
});

test("revalida o pedido depois de uma consulta assíncrona", async () => {
  const { ctx, pedido, applied, messages } = setup();
  ctx.lerResultadoRobo = async () => {
    ctx.roboMonitorId += 1;
    return { status: "ok" };
  };
  assert.equal(await ctx.conferirRetornoRobo(pedido), true);
  assert.equal(applied.length, 0);
  assert.equal(messages.length, 0);
});

test("status pendente não é confundido com sucesso", async () => {
  const { ctx, pedido, applied } = setup();
  ctx.cacheResultadosApi.chaleira = { status: "pendente" };
  assert.equal(await ctx.conferirRetornoRobo(pedido), false);
  assert.equal(ctx.roboPedidoAtual, pedido);
  assert.equal(applied.length, 0);
});

test("checagens simultâneas de foco não duplicam a consulta", async () => {
  const { ctx, pedido } = setup();
  let release, count = 0;
  ctx.lerResultadoRobo = () => { count++; return new Promise(resolve => { release = resolve; }); };
  const first = ctx.conferirRetornoRobo(pedido);
  assert.equal(await ctx.conferirRetornoRobo(pedido), false);
  release(null);
  await first;
  assert.equal(count, 1);
  assert.equal(pedido.consultando, false);
});

test("falha de conexão é tratada sem apagar o rascunho", async () => {
  const { ctx, pedido, messages, fields } = setup();
  ctx.lerResultadoRobo = async () => { throw Error("offline"); };
  assert.equal(await ctx.conferirRetornoRobo(pedido), false);
  assert.match(messages.at(-1)[1], /consultar o retorno do robô agora/);
  assert.equal(fields.titulo.value, "Meu título");
});

test("retoma a checagem ao voltar à aba", async () => {
  const { ctx, pedido, listeners } = setup();
  let checks = 0;
  ctx.conferirRetornoRobo = async received => { assert.equal(received, pedido); checks++; };
  listeners.focus();
  listeners.visibilitychange();
  assert.equal(checks, 2);
  ctx.document.visibilityState = "hidden";
  listeners.visibilitychange();
  assert.equal(checks, 2);
});

test("a revisão manual é aberta antes do monitor para não sobrescrever o erro final", async () => {
  const { ctx } = setup();
  let monitorStarted = false;
  ctx.monitorarRoboSegundoPlano = async () => { monitorStarted = true; };
  ctx.lerResultadoRobo = async () => null;
  const pending = { pedidoId: "chaleira", chave: "pendente" };
  assert.equal(await ctx.aguardarRobo(link, affiliate, "promocao", "sem dados", pending), false);
  assert.equal(monitorStarted, false);
  assert.match(html, /if \(!concluido\)\s*\{\s*await abrirManual\([\s\S]*?monitorarRoboSegundoPlano\(roboPedidoAtual\)/);
});

test("monitor lê o erro já pronto imediatamente, sem mais espera", async () => {
  const { ctx, pedido, messages } = setup();
  ctx.cacheResultadosApi.chaleira = { status: "erro", motivo: "sem dados" };
  ctx.esperar = async () => { throw Error("não deveria esperar"); };
  await ctx.monitorarRoboSegundoPlano(pedido);
  assert.match(messages.at(-1)[1], /robô terminou sem conseguir preencher/);
});

test("prazo esgotado não afirma que o GitHub deixou de iniciar", async () => {
  const { ctx, pedido, messages } = setup();
  let now = 0;
  ctx.Date = { now: () => now, parse: Date.parse };
  ctx.lerResultadoRobo = async () => null;
  ctx.esperar = async ms => { now += ms; };
  await ctx.monitorarRoboSegundoPlano(pedido);
  assert.match(messages.at(-1)[1], /prazo de espera acabou/);
  assert.doesNotMatch(messages.at(-1)[1], /ainda não iniciou/);
});

test("fallback lê arquivos públicos, sem consultar o Firebase", async () => {
  const { ctx } = setup();
  const urls = [];
  ctx.fetch = async url => {
    urls.push(url);
    return url.startsWith("https://raw.githubusercontent.com/")
      ? { ok: true, json: async () => ({ resultados: { chaleira: { status: "erro" } } }) }
      : { ok: false };
  };
  assert.equal((await ctx.lerResultadoRobo("chaleira", true)).status, "erro");
  assert.equal(urls.length, 2);
  assert.ok(urls.every(url => !/firestore|firebase/.test(url)));
  await ctx.lerResultadoRobo("chaleira");
  assert.equal(urls.length, 2);
});

test("leituras sem resultado são limitadas a uma rodada a cada 15 segundos", async () => {
  const { ctx } = setup();
  let count = 0;
  ctx.fetch = async () => { count++; return { ok: false }; };
  await ctx.lerResultadoRobo("ausente", true);
  assert.equal(count, 3);
  await ctx.lerResultadoRobo("ausente");
  assert.equal(count, 3);
});

test("arquivo antigo não substitui resultado mais recente", () => {
  const { ctx } = setup();
  ctx.guardarResultadosRobo({ chaleira: { status: "erro", resolvidoEm: "2026-10-02T09:34:00Z" } });
  ctx.guardarResultadosRobo({ chaleira: { status: "ok", resolvidoEm: "2026-10-01T09:34:00Z" } });
  assert.equal(ctx.cacheResultadosApi.chaleira.status, "erro");
});

test("resultado pendente em cache pode evoluir para resultado final", async () => {
  const { ctx } = setup();
  ctx.cacheResultadosApi.chaleira = { status: "pendente" };
  ctx.fetch = async () => ({ ok: true, json: async () => ({ resultados: { chaleira: { status: "erro", resolvidoEm: "2026-10-02T10:00:00Z" } } }) });
  assert.equal((await ctx.lerResultadoRobo("chaleira")).status, "erro");
});

test("consulta forçada atualiza resultado anterior do mesmo pedido", async () => {
  const { ctx } = setup();
  ctx.cacheResultadosApi.chaleira = { status: "erro", resolvidoEm: "2026-10-02T09:00:00Z" };
  ctx.fetch = async () => ({ ok: true, json: async () => ({ resultados: { chaleira: { status: "ok", resolvidoEm: "2026-10-02T10:00:00Z" } } }) });
  assert.equal((await ctx.lerResultadoRobo("chaleira", true)).status, "ok");
});

test("requisição travada é abortada sem esperar indefinidamente", async () => {
  const { ctx } = setup();
  ctx.setTimeout = callback => { queueMicrotask(callback); return 1; };
  ctx.clearTimeout = () => {};
  ctx.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(Error("aborted")));
  });
  assert.equal(await ctx.lerJsonResultados("https://api.github.com/exemplo"), null);
});

test("403 de outra fonte não é apresentado como falha do App Check", () => {
  const functionCode = html.slice(html.indexOf("function mensagemIA("), html.indexOf("function mlb("));
  const ctx = {};
  runInNewContext(functionCode, ctx);
  assert.equal(ctx.mensagemIA(Error("Mercado Livre: 403 Forbidden")), "Mercado Livre: 403 Forbidden");
  assert.match(ctx.mensagemIA(Error("App Check token is invalid: 403")), /não foi validado pelo Firebase/);
});

test("revisão preserva segunda loja, validações e publicação somente por aprovação", () => {
  assert.match(html, /id="publicacao-abrir-produto"[^>]*rel="noopener noreferrer"/);
  assert.match(html, /id="link-shopee"/);
  assert.match(html, /id="preco-shopee"/);
  assert.match(html, /if\s*\(!\(await carregarFotoPrevia\(d\.foto\)\)\)\s*return msg\("pub-status"/);
  assert.doesNotMatch(code, /addDoc\(|setDoc\(|updateDoc\(|deleteDoc\(/);
});
