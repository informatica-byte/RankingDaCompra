import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PRODUCT_CORRECTIONS = new Map([
  ["GjHJtzdsIhbmSINvhPeX", {
    model: /\btune\s*520\s*bt\b/i,
    sourceLabel: "JBL Tune 520BT",
    metaSummary: "JBL Tune 520BT: fone on-ear Bluetooth 5.3, até 57 h anunciadas e sem ANC. Compare vantagens, limitações e preço com data de conferência.",
    summary: "O JBL Tune 520BT é um fone on-ear Bluetooth 5.3 para música e chamadas. O fabricante informa até 57 horas de bateria; a duração real varia com volume e uso. Não possui cancelamento ativo de ruído (ANC): o isolamento é passivo. Considere-o para uso cotidiano se você aceita o formato apoiado nas orelhas; para ambientes muito ruidosos, compare alternativas com ANC. Não realizamos testes de conforto ou de qualidade do microfone.",
    positiveNotes: ["Bluetooth 5.3 informado na ficha técnica da JBL.", "Autonomia anunciada de até 57 horas; resultado real depende do uso."],
    negativeNotes: ["Sem cancelamento ativo de ruído (ANC), conforme o fabricante.", "Formato on-ear apoiado nas orelhas: conforto após longos períodos não foi testado pela equipe."],
    sourceUrl: "https://www.jbl.com.br/blog/comparativo-jbl-tune-530bt-e-520bt.html",
    specUrl: "https://www.jbl.com.br/on/demandware.static/-/Sites-masterCatalog_Harman/default/dwbfd4b4ce/pdfs/JBL%20Tune%20520BT_%20Specsheet_PTBR.pdf",
    fileReplacements: [["Cancelamento ativo de ruído — não confirmado", "Cancelamento ativo de ruído — ausente, conforme a JBL"]],
  }],
  ["hrVMdybD738SpffBFQIq", {
    incorrect: "00mlgarrafa Térmica Água Squeeze Inox Academiaquente E Frio",
    correct: "Garrafa Térmica 800 ml em Aço Inox para Academia — Quente e Frio",
    replacements: [
      ["00mlgarrafa Térmica Água Squeeze Inox Academiaquente E Frio", "Garrafa Térmica 800 ml em Aço Inox para Academia — Quente e Frio"],
      ["00mlgarrafa Térmica Água Squeeze Inox…", "Garrafa Térmica 800 ml em Aço Inox…"],
    ],
  }],
  ["dvJusdTpbTVn5ID62YpK", {
    model: /\bmatepad\s*se\s*11\b/i,
    incorrect: "ablet HUAWEI MatePad SE 11 Wifi 6+128GB Tela HUAWEI FullView de 11\" para Conforto Visual, Superbateria de 7700 mAh 225W Câmera Traseira 8 MP, Câmera Frontal 5 MP Cinza Nebula",
    correct: "Tablet HUAWEI MatePad SE 11 Wifi 6+128GB Tela HUAWEI FullView de 11\" para Conforto Visual, Superbateria de 7700 mAh 225W Câmera Traseira 8 MP, Câmera Frontal 5 MP Cinza Nebula",
    replacements: [
      ["ablet HUAWEI MatePad SE 11", "Tablet HUAWEI MatePad SE 11"],
      ["7700 mAh 225W", "7700 mAh 22,5 W"],
    ],
    summary: "O HUAWEI MatePad SE 11 tem tela de 11 polegadas com resolução de 1920 × 1200 e corpo em metal, conforme a ficha oficial. O fabricante informa bateria de 7.700 mAh e carregamento de até 22,5 W. Pode ser considerado para leitura e vídeos; confirme a compatibilidade dos aplicativos que você usa e a configuração de memória do anúncio. Não medimos desempenho, autonomia real ou conforto visual em testes próprios.",
    metaSummary: "HUAWEI MatePad SE 11: tela de 11 polegadas, 1920 × 1200 e bateria de 7.700 mAh. Confira limitações e compatibilidade antes de comprar.",
    sourceUrl: "https://consumer.huawei.com/br/tablets/matepad-se-11/",
    specUrl: "https://consumer.huawei.com/br/tablets/matepad-se-11/specs/",
    sourceLabel: "HUAWEI MatePad SE 11",
    positiveNotes: [
      "Tela de 11 polegadas e resolução de 1920 × 1200 informadas pela HUAWEI.",
      "Bateria de 7.700 mAh e carregamento de até 22,5 W anunciados pelo fabricante.",
      "Corpo em metal; peso anunciado de 475 g.",
    ],
    negativeNotes: ["Confirme a compatibilidade dos aplicativos e acessórios antes da compra.", "Desempenho e autonomia real não foram medidos pela equipe."],
  }],
  ["EmrdwlcDgCCM5suoz8dB", {
    model: /\bepson\b.*\bl3250\b/i,
    incorrect: "mpressora 3x1 Multifuncional Epson Ecotank L3250 Wifi Bivol Preto",
    correct: "Impressora 3x1 Multifuncional Epson Ecotank L3250 Wifi Bivol Preto",
    replacements: [
      ["mpressora 3x1 Multifuncional Epson Ecotank L3250", "Impressora 3x1 Multifuncional Epson Ecotank L3250"],
    ],
    summary: "A Epson EcoTank L3250 imprime, copia e digitaliza com tanque de tinta, USB, Wi-Fi e Wi-Fi Direct. A Epson anuncia até 4.500 páginas em preto ou 7.500 coloridas com tintas de reposição originais; o rendimento real varia com o documento e o uso. O aplicativo Epson Smart Panel permite configurar e operar a impressora. Compare o custo da tinta e a compatibilidade com seu sistema antes de comprar. Não medimos rendimento, velocidade ou qualidade de impressão; comandos de voz não foram confirmados nesta revisão.",
    metaSummary: "Epson EcoTank L3250: tanque de tinta, USB, Wi-Fi Direct e rendimento anunciado. Compare recursos, limitações e preço conferido.",
    sourceUrl: "https://epson.com.br/Para-casa/Impressoras/Impressoras-jato-de-tinta/Impressora-Multifuncional-3-em-1-Epson-EcoTank%C2%AE-L3250/p/C11CJ67303",
    sourceLabel: "Epson EcoTank L3250",
    positiveNotes: ["USB, Wi-Fi e Wi-Fi Direct informados pela Epson.", "Até 4.500 páginas em preto ou 7.500 coloridas anunciadas com tintas de reposição originais; o rendimento real varia.", "Configuração e operação pelo Epson Smart Panel, conforme o fabricante."],
    negativeNotes: ["Rendimento e qualidade de impressão não foram medidos pela equipe.", "Confirme custos de tinta, compatibilidade do sistema e os recursos necessários antes de comprar."],
  }],
  ["TLWfr8q21DK8xDKMh01u", {
    model: /celimax.*retinal\s*shot/i,
    summary: "Este cadastro identifica o Celimax Retinal Shot Tightening Booster de 15 ml. A identidade, os ingredientes e as orientações de uso devem ser confirmados na embalagem original e nas instruções do fabricante. Não tratamos a expressão do anúncio como indicação para todos os tipos de pele, uso diurno ou garantia de resultado. Não realizamos teste dermatológico e esta página não substitui orientação profissional.",
    metaSummary: "Celimax Retinal Shot Tightening Booster 15 ml: confira identidade, embalagem original e instruções do fabricante antes de comprar.",
    positiveNotes: ["O anúncio identifica o produto e a embalagem de 15 ml; confira a unidade recebida."],
    negativeNotes: ["Adequação ao seu tipo de pele e instruções de uso não foram verificadas nesta revisão.", "Resultados cosméticos e tolerância não foram testados pela equipe."],
    incorrect: "Celimax Retinal Shot Tightening Booster 15ml Pele Corean clip-icon Celimax Retinal Shot Tightening Booster 15ml Pele Corean Celimax Retinal Shot Tightening Booster 15ml Pele CoreanCelimax Retinal Shot Tightening Booster 15ml Pele Corean Celimax Retinal Shot Tightening Booster 15ml Pele Corean Conferir mais produtos da marca Celimax Novo | +5 mil vendidos Celimax Retinal Shot Tightening Booster 15ml Pele Corean",
    correct: "Celimax Retinal Shot Tightening Booster 15 ml",
    replacements: [
      ["Celimax Retinal Shot Tightening Booster 15ml Pele Corean clip-icon Celimax Retinal Shot Tightening Booster 15ml Pele Corean Celimax Retinal Shot Tightening Booster 15ml Pele CoreanCelimax Retinal Shot Tightening Booster 15ml Pele Corean Celimax Retinal Shot Tightening Booster 15ml Pele Corean Conferir mais produtos da marca Celimax Novo | +5 mil vendidos Celimax Retinal Shot Tightening Booster 15ml Pele Corean", "Celimax Retinal Shot Tightening Booster 15 ml"],
      ["Celimax Retinal Shot Tightening Booster 15 ml para Todos os Tipos de Pele", "Celimax Retinal Shot Tightening Booster 15 ml"],
    ],
  }],
  ["5MGE98tYssH9nEfBeHoW", {
    category: "relogio-smartwatch",
    categoryReplacements: [
      ["Beleza  Cuidados e Saúde", "relógio/smartwatch"],
      ["?cat=belezaecuidados", "?cat=relogio-smartwatch"],
      ["<li>82&quot; com brilho de 2500 nits para visualização sob luz solar.</li>", "<li>Tela AMOLED de 1,82&quot; com brilho de 2500 nits para visualização sob luz solar.</li>"],
      ["\"name\":\"82\\\" com brilho de 2500 nits para visualização sob luz solar.\"", "\"name\":\"Tela AMOLED de 1,82\\\" com brilho de 2500 nits para visualização sob luz solar.\""],
    ],
  }],
  ["avV2oOE8xcX9ioG4GNnT", {
    fileReplacements: [
      ["apenas que é alumínio.", "O anúncio informa que o quadro é de alumínio, mas não especifica a liga utilizada."],
    ],
  }],
  ["c3K3tq0esVOpmKeSLd9a", {
    model: /\bquad\s*fry\b/i,
    correct: "Air Fryer Elgin Quad Fry 4,2 L 1.400 W Preta",
    replacements: [["Fritadeira Elétrica Air Fryer Quad Fry 4,2 L,1400w Preto Elgi", "Air Fryer Elgin Quad Fry 4,2 L 1.400 W Preta"]],
    summary: "A Elgin Quad Fry tem capacidade de 4,2 litros e potência de 1.400 W, conforme o fabricante. Compare o tamanho das porções e o espaço disponível na cozinha; a capacidade nominal não informa quantas pessoas cada preparo atende. Confirme a tensão da unidade escolhida e as orientações do manual. Não realizamos testes de tempo de preparo, consumo de energia ou resultado dos alimentos.",
    metaSummary: "Elgin Quad Fry: air fryer de 4,2 litros e 1.400 W anunciados. Confira tensão, espaço e limitações antes de comprar.",
    sourceUrl: "https://www.elgin.com.br/Fritadeira-Air-fryer-Quad-Fry-1400W-42L-Preta-com-Tecnologia-Air-Circuit-360/p",
    sourceLabel: "Elgin Quad Fry",
    fileReplacements: [
      ["potência de 1400W para um aquecimento rápido. Características informadas no cadastro: Fritadeira Elétrica Air Fryer Quad Fry 4", "Capacidade de 4,2 litros e potência de 1.400 W para aquecimento rápido."],
      ["capacidade limitada para preparos em grande escala. A ficha cadastrada não detalha outras limitações além das informações apresentadas", "A capacidade de 4,2 litros pode ser limitada para preparos em grande escala."],
    ],
    positiveNotes: [
      "Capacidade nominal de 4,2 litros anunciada pela Elgin.",
      "Potência de 1.400 W informada pelo fabricante; não é medição de velocidade ou consumo.",
    ],
    negativeNotes: [
      "Confira a tensão da unidade e as dimensões antes da compra.",
      "Tempo de preparo, consumo real e resultado dos alimentos não foram medidos pela equipe.",
    ],
  }],
  ["Ct4VSBOaVTJkcxhiAyGJ", {
    fileReplacements: [
      ["memória RAM de 6GB para fluidez, tela ampla de 11 polegadas. Características informadas no cadastro: Tablet Samsung Galaxy Tab A11+", "Memória RAM de 6 GB para maior fluidez e tela ampla de 11 polegadas."],
    ],
    positiveNotes: [
      "Memória RAM de 6 GB para maior fluidez nas tarefas do dia a dia.",
      "Tela ampla de 11 polegadas para vídeos, leitura e produtividade.",
    ],
    negativeNotes: [
      "Confirme no anúncio a compatibilidade de acessórios e a versão do sistema antes da compra.",
    ],
  }],
  ["6kC1jJj7i4kRtYyp3SZr", {
    incorrect: "Patinete Elétrico",
    correct: "Patinete Elétrico Ydtech M187 Dobrável com Bluetooth",
    suppressRating: true,
    fileReplacements: [
      ["Patinete Elétrico Ydtech M187 Dobrável com Bluetooth Ydtech M187 Dobrável com Bluetooth", "Patinete Elétrico Ydtech M187 Dobrável com Bluetooth"],
      ["<span>Categoria</span>Patinete Elétrico Ydtech M187 Dobrável com Bluetooth", "<span>Categoria</span>Patinete Elétrico"],
      ["\"position\":2,\"name\":\"Patinete Elétrico Ydtech M187 Dobrável com Bluetooth\",\"item\"", "\"position\":2,\"name\":\"Patinete Elétrico\",\"item\""],
      ["\"category\":\"Patinete Elétrico Ydtech M187 Dobrável com Bluetooth\",\"url\"", "\"category\":\"Patinete Elétrico\",\"url\""],
    ],
  }],
  ["VyYiww5HVcBRIH8SD5SD", {
    suppressRating: true,
  }],
  ["qZUWO8WSrcOKWVrAqTW7", {
    model: /\bex\s*1500\b/i,
    summary: "O TP-Link EX1500 é um roteador AX1500 dual band com Wi-Fi 6, portas Gigabit e compatibilidade EasyMesh anunciados pela TP-Link. EasyMesh requer outros equipamentos compatíveis; um roteador sozinho não garante sinal em todos os cômodos. A classe AX1500 não equivale à velocidade medida em um único aparelho. Compare a posição do modem, paredes, portas e compatibilidade antes de comprar. Não medimos alcance, estabilidade ou latência.",
    metaSummary: "TP-Link EX1500: Wi-Fi 6, Gigabit e EasyMesh anunciados. Compare compatibilidade e limitações; cobertura real não foi medida.",
    sourceUrl: "https://www.tp-link.com/br/home-networking/wifi-router/ex1500/",
    sourceLabel: "TP-Link EX1500",
    positiveNotes: ["Wi-Fi 6 dual band e portas Gigabit informados pela TP-Link.", "Compatibilidade EasyMesh anunciada para uso com outros equipamentos compatíveis."],
    negativeNotes: ["Cobertura, latência e estabilidade não foram medidas em teste próprio.", "A velocidade real depende do aparelho, posição, interferência e plano de internet; AX1500 não é velocidade garantida."],
  }],
]);

function correctionFor(product) {
  const correction = PRODUCT_CORRECTIONS.get(String(product?.id || ""));
  // Um cadastro pode ser reutilizado. Nunca aplicar a ficha do modelo anterior
  // só porque o ID continua igual; a identidade atual precisa corresponder.
  return correction?.model && !correction.model.test(String(product?.titulo || "")) ? undefined : correction;
}

export function manufacturerEvidence(product) {
  const correction = correctionFor(product);
  return correction?.summary && correction.sourceUrl
    ? {sourceUrl: correction.sourceUrl, model: correction.sourceLabel, checkedAt: "2026-10-06", kind: "manufacturer-specification", independentTest: false}
    : null;
}

export function correctProductData(product) {
  const correction = correctionFor(product);
  const applyReplacements = (value) => (correction?.replacements || []).reduce(
    (current, [incorrect, correct]) => replaceKnownText(String(current || ""), incorrect, correct),
    String(value || ""),
  );
  return {
    ...product,
    titulo: applyReplacements(correction?.correct || product?.titulo).replace(/\s+/g, " ").trim(),
    comentario: correction?.summary || applyReplacements(product?.comentario),
    pros: correction?.summary ? correction.positiveNotes.join("\n") : applyReplacements(product?.pros),
    contras: correction?.summary ? correction.negativeNotes.join("\n") : applyReplacements(product?.contras),
    categoria: correction?.category || product?.categoria,
    nota: correction?.suppressRating ? "" : product?.nota,
  };
}

export const correctProductTitle = correctProductData;

function visibleText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}

function continuation(value) {
  return /^[a-záàâãéêíóôõúüç]/u.test(visibleText(value));
}

function capitalizeEditorialItem(value) {
  return String(value || "").replace(
    /^(\s*)([a-záàâãéêíóôõúüç])/u,
    (_, spaces, letter) => spaces + letter.toLocaleUpperCase("pt-BR"),
  );
}

function mergeEditorialItems(items) {
  const merged = [];
  for (const rawItem of items.map((item) => String(item || "").trim()).filter(Boolean)) {
    if (merged.length && continuation(rawItem)) {
      const previous = merged.pop();
      const separator = /[,;:]$/.test(visibleText(previous)) ? " " : ", ";
      merged.push(previous + separator + rawItem);
    } else {
      merged.push(capitalizeEditorialItem(rawItem));
    }
  }
  return merged;
}

function repairStructuredEditorialItems(content) {
  return content.replace(
    /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (full, start, source, end) => {
      let payload;
      try { payload = JSON.parse(source); } catch { return full; }
      const nodes = Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [payload];
      const product = nodes.find((node) => node?.["@type"] === "Product");
      const review = Array.isArray(product?.review) ? product.review[0] : product?.review;
      let changed = false;
      for (const key of ["positiveNotes", "negativeNotes"]) {
        const list = review?.[key];
        if (!Array.isArray(list?.itemListElement)) continue;
        const original = list.itemListElement.map((item) => String(item?.name || "")).filter(Boolean);
        const repaired = mergeEditorialItems(original);
        if (JSON.stringify(original) === JSON.stringify(repaired)) continue;
        list.itemListElement = repaired.map((name, index) => ({ "@type": "ListItem", position: index + 1, name }));
        changed = true;
      }
      return changed ? start + JSON.stringify(payload).replace(/</g, "\\u003c") + end : full;
    },
  );
}

function repairVisibleEditorialItems(content) {
  return content.replace(
    /(<section\b[^>]*class=["'][^"']*panel\s+(?:positive|attention)[^"']*["'][^>]*>[\s\S]*?<ul>)([\s\S]*?)(<\/ul>)/gi,
    (full, start, list, end) => {
      const items = [...list.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((match) => match[1]);
      if (!items.length) return full;
      return start + mergeEditorialItems(items).map((item) => `<li>${item}</li>`).join("") + end;
    },
  );
}

function replaceKnownText(content, incorrect, correct) {
  const escaped = String(incorrect).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Alguns textos incorretos começam sem a primeira letra ("ablet",
  // "mpressora"). A borda à esquerda impede que uma nova execução encontre
  // esse trecho dentro de "Tablet"/"Impressora" e duplique a letra.
  return content.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}`, "gu"), correct);
}

function repairRepeatedInitials(content) {
  return content
    .replace(/\bT+Tablet HUAWEI MatePad SE 11/gu, "Tablet HUAWEI MatePad SE 11")
    .replace(/\bI+Impressora 3x1 Multifuncional Epson Ecotank L3250/gu, "Impressora 3x1 Multifuncional Epson Ecotank L3250");
}

function applyEditorialOverrides(content, correction) {
  for (const [property, sectionClass] of [["positiveNotes", "positive"], ["negativeNotes", "attention"]]) {
    const notes = correction?.[property];
    if (!Array.isArray(notes) || !notes.length) continue;
    content = content.replace(
      /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
      (full, start, source, end) => {
        let payload;
        try { payload = JSON.parse(source); } catch { return full; }
        const nodes = Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [payload];
        const product = nodes.find((node) => node?.["@type"] === "Product");
        const review = Array.isArray(product?.review) ? product.review[0] : product?.review;
        if (!review) return full;
        review[property] = {
          "@type": "ItemList",
          itemListElement: notes.map((name, index) => ({ "@type": "ListItem", position: index + 1, name })),
        };
        return start + JSON.stringify(payload).replace(/</g, "\\u003c") + end;
      },
    );
    const sectionPattern = new RegExp(`(<section\\b[^>]*class=["'][^"']*panel\\s+${sectionClass}[^"']*["'][^>]*>[\\s\\S]*?<ul>)[\\s\\S]*?(<\\/ul>)`, "gi");
    content = content.replace(sectionPattern, (_, start, end) =>
      start + notes.map((note) => `<li>${note}</li>`).join("") + end,
    );
  }
  return content;
}

function suppressUnreliableRating(content) {
  const withoutVisibleRating = content.replace(/<div\b[^>]*class=["'][^"']*rating[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "");
  return withoutVisibleRating.replace(
    /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (full, start, source, end) => {
      let payload;
      try { payload = JSON.parse(source); } catch { return full; }
      const nodes = Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [payload];
      const product = nodes.find((node) => node?.["@type"] === "Product");
      const reviews = Array.isArray(product?.review) ? product.review : product?.review ? [product.review] : [];
      if (!reviews.length) return full;
      for (const review of reviews) delete review.reviewRating;
      return start + JSON.stringify(payload).replace(/</g, "\\u003c") + end;
    },
  );
}

export async function correctGeneratedProductTitles(rootDirectory = process.cwd()) {
  const files = [resolve(rootDirectory, "analises.html"), resolve(rootDirectory, "top5-semanal.json")];
  const productDirectory = resolve(rootDirectory, "produto");
  try {
    for (const entry of await readdir(productDirectory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".html")) files.push(resolve(productDirectory, entry.name));
    }
  } catch {
    // O diretório ainda pode não existir na primeira execução do gerador.
  }

  let updatedFiles = 0;
  const catalogueFile = resolve(rootDirectory, "vitrine-publica.json");
  try {
    const catalogue = JSON.parse(await readFile(catalogueFile, "utf8"));
    if (Array.isArray(catalogue.products)) {
      const before = JSON.stringify(catalogue.products);
      catalogue.products = catalogue.products.map(p => PRODUCT_CORRECTIONS.has(String(p.id)) ? correctProductData(p) : p);
      if (JSON.stringify(catalogue.products) !== before) {
        await writeFile(catalogueFile, JSON.stringify(catalogue, null, 2) + "\n", "utf8");
        updatedFiles += 1;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const file of files) {
    let content;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    let corrected = repairRepeatedInitials(content);
    for (const correction of PRODUCT_CORRECTIONS.values()) {
      for (const [incorrect, correct] of correction.replacements || []) {
        corrected = replaceKnownText(corrected, incorrect, correct);
      }
    }
    const fileName = basename(file);
    for (const [productId, correction] of PRODUCT_CORRECTIONS) {
      if (!fileName.startsWith(productId + "-")) continue;
      const heading = visibleText(corrected.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
        || corrected.match(/<title>([\s\S]*?)<\/title>/i)?.[1]
        || (() => { try { const payload = JSON.parse(corrected.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)?.[1] || '{}'); return (payload['@graph'] || [payload]).find(n => n['@type'] === 'Product')?.name || ''; } catch { return ''; } })());
      if (correction.model && !correction.model.test(heading)) continue;
      for (const [incorrect, correct] of correction.categoryReplacements || []) {
        corrected = corrected.split(incorrect).join(correct);
      }
      for (const [incorrect, correct] of correction.fileReplacements || []) {
        corrected = corrected.split(incorrect).join(correct);
      }
      corrected = applyEditorialOverrides(corrected, correction);
      if (correction.summary) corrected = applyVerifiedSummary(corrected, correction);
      if (correction.suppressRating) corrected = suppressUnreliableRating(corrected);
    }
    if (fileName.endsWith(".html") && fileName !== "analises.html") {
      corrected = repairStructuredEditorialItems(corrected);
      corrected = repairVisibleEditorialItems(corrected);
    }
    if (corrected !== content) {
      await writeFile(file, corrected, "utf8");
      updatedFiles += 1;
    }
  }
  return updatedFiles;
}

function applyVerifiedSummary(content, correction) {
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const short = correction.metaSummary || correction.summary;
  content = content.replace(/(<p class="summary">)[\s\S]*?(<\/p>)/, (_, a, b) => a + esc(correction.summary) + b);
  content = content.replace(/(<meta (?:name="(?:description|twitter:description)"|property="og:description") content=")[^"]*(">)/g, (_, a, b) => a + esc(short) + b);
  content = content.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (full, a, source, b) => {
    let payload; try { payload = JSON.parse(source); } catch { return full; }
    const nodes = payload['@graph'] || [payload], product = nodes.find(n => n['@type'] === 'Product');
    if (!product) return full;
    product.description = correction.summary;
    for (const review of Array.isArray(product.review) ? product.review : product.review ? [product.review] : []) review.reviewBody = correction.summary;
    return a + JSON.stringify(payload).replace(/</g, "\\u003c") + b;
  });
  const source = correction.sourceUrl
    ? `<p class="fine" data-verified-manufacturer>Fonte do fabricante: <a href="${esc(correction.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(correction.sourceLabel)}</a>${correction.specUrl ? ` e <a href="${esc(correction.specUrl)}" target="_blank" rel="noopener noreferrer">ficha técnica oficial</a>` : ''}. Especificações anunciadas, não medição independente.</p>`
    : `<p class="fine" data-editorial-limit>Esta revisão remove afirmações sem comprovação; não significa validação técnica ou teste do produto.</p>`;
  content = content.replace(/<p class="fine" data-(?:verified-manufacturer|editorial-limit)>[\s\S]*?<\/p>/g, "");
  return content.replace(/(<p class="fine source">[\s\S]*?<\/p>)/, "$1" + source);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const updatedFiles = await correctGeneratedProductTitles();
  console.log(`Títulos conhecidos corrigidos em ${updatedFiles} arquivo(s).`);
}
