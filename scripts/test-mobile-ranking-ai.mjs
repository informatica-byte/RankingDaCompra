import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const html = (await readFile(resolve("painel-celular.html"), "utf8")).replace(/\r\n/g, "\n");
const match = html.match(/      async function rankingGerarIA\(r\) \{[\s\S]*?\n      \}\n      function rankingMostrarRevisao/);
assert.ok(match, "gerador do ranking semanal não encontrado");
const code = match[0].replace(/\n      function rankingMostrarRevisao$/, "");

test("o JavaScript do painel móvel continua sintaticamente válido", () => {
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "script do painel móvel não encontrado");
  assert.doesNotThrow(() => new Function(script.replace(/^\s*import .*;\s*$/gm, "")));
});

function ranking() {
  return {
    produtos: Array.from({ length: 5 }, (_, index) => ({
      id: `produto-${index + 1}`,
      position: index + 1,
      titulo: `Produto ${index + 1}`,
      preco: 100 + index,
      scoreTotal: 8,
      criterios: {},
      nota: 4,
      clicks: 1,
      views: 2,
      pros: [],
      cons: [],
      motivo: "Critérios matemáticos preservados",
      productUrl: `https://rankingdacompra.com.br/produto/${index + 1}.html`,
    })),
  };
}

test("falha da revisora mantém a primeira análise e a tentativa seguinte revisa somente ela", async () => {
  let chamadasAnalista = 0;
  let chamadasRevisora = 0;
  const candidata = { resumoGeral: "Análise inicial", produtos: [] };
  const revisada = { resumoGeral: "Análise revisada", produtos: [] };
  const contexto = {
    rankingCandidataMovel: null,
    modelRapido: {
      async generateContent() {
        chamadasAnalista++;
        return {
          response: {
            text: () => JSON.stringify(candidata),
            candidates: [{ urlContextMetadata: { urlMetadata: [{ urlRetrievalStatus: "SUCCESS" }] } }],
          },
        };
      },
    },
    modelReserva: {
      async generateContent(prompt) {
        chamadasRevisora++;
        assert.match(prompt, /Análise inicial/);
        if (chamadasRevisora === 1) throw Error("A IA revisora demorou mais de 20 segundos.");
        return { response: { text: () => JSON.stringify(revisada) } };
      },
    },
    comPrazo: (promise) => promise,
    json: (value) => value,
    fonte: () => true,
  };
  runInNewContext(`${code}\nthis.gerar = rankingGerarIA;`, contexto);
  const draft = ranking();

  await assert.rejects(contexto.gerar(draft), /revisora demorou/);
  assert.equal(chamadasAnalista, 1, "a primeira análise não deve ser descartada após responder");
  assert.equal(contexto.rankingCandidataMovel.ranking, draft);

  const resultado = await contexto.gerar(draft);
  assert.equal(chamadasAnalista, 1, "a segunda tentativa não deve repetir a primeira análise");
  assert.equal(chamadasRevisora, 2);
  assert.equal(resultado.resumoGeral, revisada.resumoGeral);
  assert.equal(resultado.fonte, "paginas_publicas_e_dados_consolidados");

  await contexto.gerar(ranking());
  assert.equal(chamadasAnalista, 2, "outra seleção precisa de uma nova análise");
});

test("o botão permite retomar só a revisão e volta ao estado inicial para outra comparação", () => {
  assert.match(html, /rankingCandidataMovel = null;\s*\$\("ranking-ia"\)\.textContent = "🤖 Gerar análise humanizada"/);
  assert.match(html, /b\.textContent = "🔁 Tentar somente revisão"/);
  assert.match(html, /rankingCandidataMovel = null;\s*b\.textContent = "🤖 Gerar análise humanizada"/);
});
