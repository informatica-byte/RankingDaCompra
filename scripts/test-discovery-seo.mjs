import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const site = "https://rankingdacompra.com.br/";
const directory = await mkdtemp(join(tmpdir(), "ranking-discovery-seo-"));
const categories = [
  { id: "roteador", nome: "Roteador" },
  { id: "relogio-smartwatch", nome: "Relógio Smartwatch" },
  { id: "fones-de-ouvido", nome: "Fones de ouvido" },
];
const records = [
  ["router-a", "Roteador TP-Link AX1500 Wi-Fi 6", "roteador", 180, "2026-09-12"],
  ["router-b", "Roteador Mercusys AX3000 Wi-Fi 6", "roteador", 240, "2026-09-12"],
  ["router-c", "Roteador Intelbras Mesh Wi-Fi 6", "roteador", 290, "2026-09-12"],
  ["repeater", "Repetidor TP-Link 300 Mbps", "roteador", 80, "2026-09-12"],
  ["watch-a", "Smartwatch Amazfit Bip 6", "relogio-smartwatch", 450, "2026-09-10"],
  ["watch-b", "Smartwatch Huawei Watch Fit", "relogio-smartwatch", 570, "2026-09-10"],
  ["watch-c", "Relógio Inteligente Samsung Galaxy Watch", "relogio-smartwatch", 650, "2026-09-10"],
  ["casio", "Relógio Digital Casio G-Shock", "relogio-smartwatch", 350, "2026-09-10"],
  ["fone-a", "Fone Bluetooth Redmi Buds 6", "fones-de-ouvido", 100, "2026-09-08"],
  ["fone-b", "Fone de Ouvido Sem Fio QCY T13", "fones-de-ouvido", 130, "2026-09-08"],
  ["fone-c", "Fone Bluetooth JBL Tune 520BT", "fones-de-ouvido", 210, "2026-09-08"],
  ["wired", "Fone Gamer com Fio P2", "fones-de-ouvido", 70, "2026-09-08"],
];

try {
  await mkdir(join(directory, "produto"));
  const products = records.map(([id, titulo, categoria, preco, atualizadoEm]) => ({
    id, titulo, categoria, preco, atualizadoEm,
    comentario: `Comparação editorial de ${titulo}. Esta análise apresenta aplicações práticas, características verificáveis, limitações de uso e cuidados antes da compra para ajudar o leitor a escolher o modelo adequado às suas necessidades.`,
    nota: 4.5,
    pros: "Recurso técnico confirmado no anúncio; Compatibilidade informada pelo fabricante; Uso adequado à categoria",
    contras: "Conferir condições de garantia e disponibilidade",
    foto: `${site}assets/logo.png`,
    __productUrl: `${site}produto/${id}-20260810-1.html`,
  }));
  const urls = products.map((product) => `<url><loc>${product.__productUrl}</loc></url>`).join("");
  await writeFile(join(directory, "sitemap.xml"), `<?xml version="1.0"?><urlset>${urls}</urlset>`, "utf8");
  await writeFile(join(directory, "fixture.json"), JSON.stringify({ categories, products }), "utf8");
  for (const product of products) {
    await writeFile(join(directory, "produto", `${product.id}-20260810-1.html`),
      `<!doctype html><html><body><article><h1>${product.titulo}</h1></article></body></html>`, "utf8");
  }
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./generate-discovery.mjs", import.meta.url))], {
    cwd: directory,
    env: { ...process.env, DISCOVERY_FIXTURE: join(directory, "fixture.json") },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const router = await readFile(join(directory, "melhores-roteador.html"), "utf8");
  const watch = await readFile(join(directory, "melhores-relogio-smartwatch.html"), "utf8");
  const fones = await readFile(join(directory, "melhores-fones-de-ouvido.html"), "utf8");
  const sitemap = await readFile(join(directory, "sitemap.xml"), "utf8");
  assert.doesNotMatch(router, /Repetidor TP-Link/);
  assert.doesNotMatch(watch, /Relógio Digital Casio/);
  assert.doesNotMatch(fones, /Fone Gamer com Fio/);
  assert.match(router, /3 produtos comparados/);
  assert.match(fones, /<title>Melhores fones bluetooth custo-benefício de 2026 \| Ranking da Compra<\/title>/i);
  assert.match(watch, /<title>Melhores smartwatches custo-benefício de 2026 \| Ranking da Compra<\/title>/i);
  assert.match(router, /Maior pontuação de qualidade por real/);
  assert.match(sitemap, /melhores-roteador\.html<\/loc>\s*<lastmod>2026-09-12<\/lastmod>/);
  assert.match(sitemap, /melhores-relogio-smartwatch\.html<\/loc>\s*<lastmod>2026-09-10<\/lastmod>/);
  console.log("Guias SEO: produtos comparáveis, títulos completos, selo calculado e datas por categoria validados.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
