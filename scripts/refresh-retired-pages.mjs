import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { unavailableProductPage } from "./product-url-continuity.mjs";

// Reparação offline e restrita a stubs já publicados. Não cria páginas para
// IDs ausentes, não restaura anúncios e não altera o catálogo/sitemap.
export function refreshedRetiredPage(fileName, previousHtml, catalogue, aliases = {}) {
  if (!/^[A-Za-z0-9_-]+\.html$/.test(fileName)) throw new Error("Arquivo de produto inválido");
  if (catalogue?.version !== 1 || !Array.isArray(catalogue.products) || !catalogue.products.length ||
      !Number.isFinite(Date.parse(catalogue.generatedAt || "")) ||
      catalogue.products.some(product => !/^[A-Za-z0-9_-]+$/.test(product?.id || ""))) {
    throw new Error("Snapshot público inválido; páginas existentes preservadas");
  }
  const id = fileName.replace(/-\d{8}-\d+\.html$/, "").replace(/\.html$/, "");
  const publicIds = new Set(catalogue.products.map(product => product.id));
  if (publicIds.has(id) || publicIds.has(aliases[fileName])) throw new Error("Produto atual ou alias preservado; stub recusado");
  if (!/<h1>Esta análise não está disponível<\/h1>/.test(previousHtml) ||
      !/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b/i.test(previousHtml)) {
    throw new Error("Arquivo não é uma página retirada reconhecida; conteúdo preservado");
  }
  return unavailableProductPage(previousHtml);
}

async function main(args) {
  const apply = args.includes("--apply");
  const fileNames = args.filter(argument => argument !== "--apply");
  if (!fileNames.length) throw new Error("Informe os nomes exatos dos stubs. Sem --apply, apenas valida e lista alterações.");
  const catalogue = JSON.parse(await readFile(resolve("vitrine-publica.json"), "utf8"));
  const aliases = JSON.parse(await readFile(resolve("product-url-aliases.json"), "utf8"));
  const planned = [];
  // Valida o lote inteiro antes da primeira gravação, inclusive caminhos.
  for (const fileName of [...new Set(fileNames)]) {
    if (!/^[A-Za-z0-9_-]+\.html$/.test(fileName)) throw new Error("Arquivo de produto inválido");
    const path = resolve("produto", fileName);
    const previousHtml = await readFile(path, "utf8");
    const html = refreshedRetiredPage(fileName, previousHtml, catalogue, aliases);
    if (previousHtml !== html) planned.push({ path, fileName, html });
  }
  if (apply) for (const page of planned) await writeFile(page.path, page.html, "utf8");
  console.log(JSON.stringify({ mode: apply ? "aplicado" : "somente validação", alteredFiles: planned.map(page => `produto/${page.fileName}`), firebaseQueries: 0 }, null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
