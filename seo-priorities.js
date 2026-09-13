(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RDC_SEO_PRIORITIES = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const priorities = [
    {
      id: "celular",
      label: "Celulares",
      aliases: ["celular", "smartphone"],
      reason: "Procura ampla e muitas decisões por faixa de preço, câmera e bateria.",
      budgets: [1000, 1500, 2000],
      phrases: ["melhores celulares custo-benefício", "melhor celular até {price}", "celular 5G barato e bom", "{model} vale a pena"]
    },
    {
      id: "notebook",
      label: "Notebooks",
      aliases: ["notebook"],
      reason: "Compra de maior valor e buscas específicas para estudo, trabalho e jogos.",
      budgets: [2500, 3000, 4000],
      phrases: ["melhores notebooks custo-benefício", "melhor notebook até {price}", "notebook para estudar e trabalhar", "{model} é bom"]
    },
    {
      id: "air-fryer",
      label: "Air fryers",
      aliases: ["air fryer", "fritadeira air fryer eletrica", "fritadeira"],
      reason: "Produto doméstico popular com dúvidas claras sobre tamanho, consumo e capacidade.",
      budgets: [400, 600, 1000],
      phrases: ["melhores air fryers custo-benefício", "melhor air fryer até {price}", "air fryer para família", "air fryer forno vale a pena"]
    },
    {
      id: "patinete-eletrico",
      label: "Patinetes elétricos",
      aliases: ["patinete eletrico", "patinete"],
      reason: "Menor concorrência em dúvidas específicas e boa intenção comercial.",
      budgets: [2000, 3000, 5000],
      phrases: ["melhores patinetes elétricos custo-benefício", "melhor patinete elétrico até {price}", "patinete elétrico para subir ladeira", "patinete elétrico 500W vale a pena"]
    },
    {
      id: "smart-tv",
      label: "Smart TVs",
      aliases: ["smart tv", "televisao", "tv"],
      reason: "Busca recorrente por tamanho, tecnologia e uso com videogames.",
      budgets: [2000, 3000, 4000],
      phrases: ["melhores smart TVs custo-benefício", "melhor smart TV até {price}", "smart TV para PS5", "smart TV Samsung ou LG"]
    },
    {
      id: "fone-bluetooth",
      label: "Fones Bluetooth",
      aliases: ["fones de ouvido", "fone bluetooth", "fone"],
      reason: "Muitos modelos, preços acessíveis e forte potencial para comparações objetivas.",
      budgets: [200, 500, 1000],
      phrases: ["melhores fones Bluetooth custo-benefício", "melhor fone Bluetooth até {price}", "{model} vale a pena", "fone Bluetooth barato e bom"]
    },
    {
      id: "smartwatch",
      label: "Smartwatches",
      aliases: ["relogio smartwatch", "smartwatch"],
      reason: "Buscas específicas por recursos, compatibilidade, bateria e faixa de preço.",
      budgets: [300, 500, 1000],
      phrases: ["melhores smartwatches custo-benefício", "melhor smartwatch até {price}", "{model} vale a pena", "smartwatch barato e bom"]
    }
  ];

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function find(category, label) {
    const haystack = normalize(category + " " + label);
    return priorities.find((plan) => plan.aliases.some((alias) => haystack.includes(normalize(alias)))) || null;
  }

  function money(value) {
    const number = Number(value) || 0;
    return number > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(number) : "";
  }

  function headline(plan, maxPrice) {
    if (!plan) return "";
    const limit = Number(maxPrice) || 0;
    return limit > 0
      ? `5 melhores ${plan.label.toLowerCase()} até ${money(limit)}: comparação e custo-benefício`
      : `5 melhores ${plan.label.toLowerCase()} custo-benefício: comparação atualizada`;
  }

  function phrase(plan, maxPrice) {
    if (!plan) return "";
    const template = Number(maxPrice) > 0 ? plan.phrases.find((item) => item.includes("{price}")) : plan.phrases[0];
    return String(template || plan.phrases[0]).replace("{price}", money(maxPrice));
  }

  return Object.freeze({ version: "20260913-1", priorities, normalize, find, headline, phrase });
});
