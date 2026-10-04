import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const [home, dashboard, mobile, growth, generator] = await Promise.all([
  "../index.html", "../dashboard.html", "../painel-celular.html",
  "../growth-tools.js", "./generate-sitemap.mjs"
].map(path => readFile(new URL(path, import.meta.url), "utf8")));

test("vitrine consulta datas válidas sem reler todas as promoções vencidas", () => {
  const publicHome = home.slice(home.indexOf('async function homeComPromocoes'), home.indexOf('async function home(){'));
  assert.match(publicHome, /RDCPublicData\.json\('\/vitrine-publica\.json'\)/);
  assert.doesNotMatch(publicHome, /db\.collection/);
  assert.match(publicHome, /todos\.filter\(ofertaRelampagoValida\)/);
  assert.match(home, /todos\.filter\(\(produto\) => produto\.promocaoAtiva === true[^]*?promocaoValida\(produto\)\)/);
  assert.match(dashboard, /CACHE_METRICAS_PAINEL_MS = 4 \* 60 \* 60 \* 1000/);
});

test("promoção vencida desativa só a marcação, preservando cadastro e preço", () => {
  const source = dashboard.match(/        function promocaoVencida\(produto,[^]*?\n        \}/)?.[0];
  assert.ok(source);
  const expired = vm.runInNewContext(source + "\npromocaoVencida", {
    diaBrasilRotina: () => "2026-09-29"
  });
  assert.equal(expired({ promocaoAtiva: true, promocaoValidaAte: "2026-09-28" }), true);
  assert.equal(expired({ promocaoAtiva: true, promocaoValidaAte: "2026-09-29" }), false);
  assert.equal(expired({ promocaoAtiva: true, promocaoValidaAte: "" }), false);
  assert.match(dashboard, /lote\.update\(doc\.ref, \{ promocaoAtiva: false \}\)/);
  assert.match(dashboard, /vencidas\.slice\(inicio, inicio \+ 400\)/);
  assert.match(dashboard, /botao\.dataset\.confirmando !== String\(vencidas\.length\)/);
  assert.doesNotMatch(dashboard, /if \(!confirm\(`Encerrar/);
});

test("App Check é preparado em todos os clientes sem ativar enforcement", () => {
  assert.match(home, /firebase\.appCheck\(\)\.activate\(new firebase\.appCheck\.ReCaptchaEnterpriseProvider/);
  assert.match(dashboard, /firebase\.appCheck\(\)\.activate\(new firebase\.appCheck\.ReCaptchaEnterpriseProvider/);
  assert.match(mobile, /initializeAppCheck\(app, \{/);
  assert.match(growth, /firebase\.appCheck\(\)\.activate\(new firebase\.appCheck\.ReCaptchaEnterpriseProvider/);
  assert.match(generator, /growth-tools\.js\?v=20261004-repairs/);
});

test("histórico fica identificado como comparação, sem contradizer preço conferido", () => {
  assert.match(growth, /Histórico para comparar com o preço conferido acima/);
  assert.match(growth, /Último registro no histórico:/);
  assert.match(growth, /proofMarkup\(summary, cardHasConfirmedPrice\(card\)\)/);
  assert.match(growth, /\.deal-validity,\.deal-check,\.offer > strong/);
});

test("scripts clássicos da página inicial e do painel continuam válidos", () => {
  for (const [file, html] of [["index.html", home], ["dashboard.html", dashboard]]) {
    for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!match[2].trim() || /type=["'](?:module|application\/ld\+json)["']/.test(match[1])) continue;
      assert.doesNotThrow(() => new vm.Script(match[2]), `${file}: script inline inválido`);
    }
  }
});
