import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync("scripts/validate-site.mjs","utf8");
const body = source.slice(source.indexOf("function hasPrimaryRankingHighlight"),source.indexOf("function productIdentityKeys"));
const valid = new Function(body + ";return hasPrimaryRankingHighlight;")();
test("validador aceita selo honesto de pontuação e compatibilidade com HTML anterior",()=>{
 assert.equal(valid("<span>🏆 Maior pontuação da seleção</span>"),true);
 assert.equal(valid("<span>🏆 Melhor geral</span>"),true);
 assert.equal(valid("<span>💰 Mais barato</span>"),false);
 assert.equal(valid("<span>Melhor geral</span>"),false);
 assert.match(source,/if \(!hasPrimaryRankingHighlight\(html\)\) fail/);
});
test("validador continua recusando selos em listas heterogêneas e guias neutros",()=>{
 const guards=source.match(/if \(\/🏆 \(\?:Melhor geral\|Maior pontuação da seleção\)\|💚 Melhor custo-benefício\|💰 Mais barato\/\.test\(html\)\)/g);
 assert.equal(guards?.length,3);
});
