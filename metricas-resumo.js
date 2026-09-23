(function (root) {
  "use strict";

  const VERSION = 1;

  function quantidade(item) {
    const value = Number(item && item.quantidade);
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
  }

  function total(items) {
    return items.reduce((sum, item) => sum + quantidade(item), 0);
  }

  function resumirDocumentos(docs, decodificar) {
    const grupos = new Map();
    docs.forEach((doc) => {
      const dados = doc.data();
      const dia = String(dados.dia || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return;
      const origem = String(dados.origem || "");
      let evento;
      if ((!dados.tipo || dados.tipo === "visita") && !origem.startsWith("evento:")) {
        evento = { dia, tipo: "visita" };
      } else {
        const comercial = decodificar(dados, doc.id);
        if (!comercial) return;
        evento = {
          dia,
          tipo: String(comercial.tipo || ""),
          produtoId: String(comercial.produtoId || ""),
          titulo: String(comercial.titulo || "").slice(0, 180),
          categoria: String(comercial.categoria || "").slice(0, 100),
          canal: String(comercial.canal || "").slice(0, 40),
          campanha: String(comercial.campanha || "").slice(0, 80)
        };
      }
      const chave = JSON.stringify(evento);
      const anterior = grupos.get(chave);
      if (anterior) anterior.quantidade += 1;
      else grupos.set(chave, { ...evento, quantidade: 1 });
    });
    return [...grupos.values()];
  }

  function combinar(cache, registros, desde, inicio, hoje, atualizadoEm) {
    const anteriores = cache && cache.versao === VERSION && Array.isArray(cache.registros)
      ? cache.registros.filter((item) => item.dia >= inicio && item.dia < desde && item.dia <= hoje)
      : [];
    const atuais = registros.filter((item) => item.dia >= desde && item.dia >= inicio && item.dia <= hoje);
    return { versao: VERSION, atualizadoEm, ultimoDia: hoje, registros: [...anteriores, ...atuais] };
  }

  function instantaneo(cache, doCache = false) {
    // A interface antiga recebe os mesmos eventos individuais. Somente o
    // armazenamento local é compacto; rankings e contagens não mudam.
    const docs = [];
    cache.registros.forEach((registro, indice) => {
      const dados = { ...registro, quantidade: 1, criadoEm: `${registro.dia}T12:00:00-03:00` };
      for (let copia = 0; copia < quantidade(registro); copia += 1) {
        docs.push({ id: `resumo:${indice}:${copia}`, data: () => dados });
      }
    });
    return { docs, doCache, forEach: (callback) => docs.forEach(callback) };
  }

  root.RankingMetricasResumo = { VERSION, quantidade, total, resumirDocumentos, combinar, instantaneo };
})(typeof window !== "undefined" ? window : globalThis);
