(function (root) {
  "use strict";

  const VERSION = 1;
  const CHAVE_CACHE = "ranking-metricas-painel-resumo-v1";
  const CACHE_MS = 4 * 60 * 60 * 1000;

  function diaBrasil(valor = Date.now()) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date(valor));
  }

  function inicio(hoje = diaBrasil(), dias = 14) {
    const data = new Date(hoje + "T12:00:00Z");
    data.setUTCDate(data.getUTCDate() - dias + 1);
    return data.toISOString().slice(0, 10);
  }

  function decodificar(dados, id) {
    const partes = String(dados.origem || "").split(":");
    const legado = partes[0] === "evento";
    let tipo = String(dados.tipo || (legado ? partes[1] : "") || "");
    let canal = String(dados.canal || (legado ? partes[3] : "") || "direto");
    if (tipo === "clique_secao" && canal.startsWith("view:")) {
      tipo = "visualizacao_produto";
      canal = canal.slice(5) || "direto";
    }
    if (!["clique_oferta", "compartilhamento", "clique_secao", "visualizacao_produto"].includes(tipo)) return null;
    const produtoId = String(dados.produtoId || (legado ? partes[2] : "") || "");
    if (!produtoId) return null;
    return { ...dados, id, tipo, produtoId, canal };
  }

  function quantidade(item) {
    const value = Number(item && item.quantidade);
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
  }

  function total(items) {
    return items.reduce((sum, item) => sum + quantidade(item), 0);
  }

  function resumirDocumentos(docs, decodificar) {
    const grupos = new Map();
    const vistos = new Set();
    docs.forEach((doc) => {
      if (doc.id && vistos.has(doc.id)) return;
      if (doc.id) vistos.add(doc.id);
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
    return { versao: VERSION, inicio, atualizadoEm, ultimoDia: hoje, registros: [...anteriores, ...atuais] };
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
    return { docs, doCache, atualizadoEm: cache.atualizadoEm, registros: cache.registros,
      forEach: (callback) => docs.forEach(callback) };
  }

  function contar(registros, hoje = diaBrasil()) {
    const sete = inicio(hoje, 7), quatorze = inicio(hoje, 14);
    const c = { visitas14: 0, visitasHoje: 0, visitas7: 0, visualizacoes7: 0,
      cliques7: 0, cliquesHoje: 0, produtosClicados7: 0, compartilhamentos7: 0, comerciais14: 0, taxa: null };
    const produtos = new Set();
    registros.forEach(item => {
      if (item.dia < quatorze || item.dia > hoje) return;
      const n = quantidade(item);
      if (item.tipo === "visita") {
        c.visitas14 += n;
        if (item.dia === hoje) c.visitasHoje += n;
        if (item.dia >= sete) c.visitas7 += n;
        return;
      }
      const evento = decodificar(item);
      if (!evento) return;
      c.comerciais14 += n;
      if (item.dia < sete) return;
      if (evento.tipo === "visualizacao_produto") c.visualizacoes7 += n;
      if (evento.tipo === "compartilhamento") c.compartilhamentos7 += n;
      if (evento.tipo === "clique_oferta") {
        c.cliques7 += n;
        if (item.dia === hoje) c.cliquesHoje += n;
        produtos.add(evento.produtoId);
      }
    });
    c.produtosClicados7 = produtos.size;
    // Relação entre eventos, não conversão em vendas nem percentual de pessoas.
    c.taxa = c.visualizacoes7 ? c.cliques7 / c.visualizacoes7 * 100 : null;
    return c;
  }

  function descricao(snapshot) {
    const em = Number(snapshot.atualizadoEm);
    const data = em > 0 ? new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short"
    }).format(new Date(em)) : "data desconhecida";
    return "Base atualizada em " + data + (snapshot.desatualizado ? " — última base preservada; consulta indisponível."
      : snapshot.doCache ? " — resumo local compartilhado." : " — dados consultados.");
  }

  function exibir(snapshot, alvo = root.document) {
    if (!alvo) return;
    const c = contar(snapshot.registros || snapshot.docs.map(doc => doc.data()));
    alvo.querySelectorAll("[data-metrica]").forEach(el => {
      const chave = el.dataset.metrica, valor = c[chave];
      el.textContent = chave === "taxa" ? valor === null ? "—"
        : valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"
        : Number(valor || 0).toLocaleString("pt-BR");
    });
    alvo.querySelectorAll("[data-metricas-status]").forEach(el => {
      el.textContent = descricao(snapshot) + " " + c.comerciais14.toLocaleString("pt-BR") +
        " eventos comerciais em 14 dias. Os indicadores de produtos usam 7 dias, exceto “hoje”.";
    });
    return c;
  }

  function criarLeitor({ lerDocumentos, armazenamento = root.localStorage, agora = Date.now, diaAtual = diaBrasil }) {
    let pendente = null, memoria = null;
    function cache() {
      const hoje = diaAtual(), primeiro = inicio(hoje);
      let salvo = null;
      try { salvo = JSON.parse(armazenamento.getItem(CHAVE_CACHE) || "null"); } catch {}
      // O cache antigo desta chave já abrangia 14 dias. O cache móvel de sete dias
      // não é importado como uma base completa e nunca substitui essa base.
      if (salvo?.versao !== VERSION || !Array.isArray(salvo.registros)
        || !/^\d{4}-\d{2}-\d{2}$/.test(String(salvo.ultimoDia || ""))
        || salvo.ultimoDia < primeiro || salvo.ultimoDia > hoje
        || (salvo.inicio && salvo.inicio > primeiro)) salvo = null;
      if (memoria?.ultimoDia >= primeiro && memoria.ultimoDia <= hoje
        && (!salvo || memoria.atualizadoEm > salvo.atualizadoEm)) salvo = memoria;
      return salvo;
    }
    async function ler(forcar = false) {
      if (pendente) return pendente;
      const hoje = diaAtual(), primeiro = inicio(hoje), resumo = cache();
      const idade = agora() - Number(resumo?.atualizadoEm || 0);
      if (resumo?.ultimoDia === hoje && idade >= 0 && idade < (forcar ? 60000 : CACHE_MS))
        return instantaneo(resumo, true);
      const desde = resumo ? resumo.ultimoDia : primeiro;
      pendente = Promise.resolve().then(() => lerDocumentos(desde)).then(snapshot => {
        const registros = resumirDocumentos(snapshot.docs, decodificar);
        memoria = combinar(resumo, registros, desde, primeiro, hoje, agora());
        try { armazenamento.setItem(CHAVE_CACHE, JSON.stringify(memoria)); } catch {}
        return instantaneo(memoria);
      }).catch(erro => {
        if (!resumo) throw erro;
        return { ...instantaneo(resumo, true), desatualizado: true };
      }).finally(() => { pendente = null; });
      return pendente;
    }
    return { ler, cache };
  }

  root.RankingMetricasResumo = { VERSION, CHAVE_CACHE, quantidade, total, resumirDocumentos,
    combinar, instantaneo, diaBrasil, inicio, decodificar, contar, descricao, exibir, criarLeitor };
  // Outra aba atualizou a mesma base: sincroniza só o DOM, sem consulta ao Firebase.
  root.addEventListener?.("storage", evento => {
    if (evento.key !== CHAVE_CACHE || !evento.newValue) return;
    try {
      const salvo = JSON.parse(evento.newValue);
      if (salvo.versao === VERSION && Array.isArray(salvo.registros))
        exibir(instantaneo(salvo, true));
    } catch {}
  });
})(typeof window !== "undefined" ? window : globalThis);
