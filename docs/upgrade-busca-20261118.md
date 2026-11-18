# Busca e filtros — 18/11/2026

Base: `0063cac27`. Escopo autorizado: busca, categoria e finalidade na vitrine e resultados, sem editar produtos, afiliados ou consultas SEO/GA4.

- Formulário GET com rótulos, termo opcional e filtros combináveis, preservados na URL e ao recarregar.
- Categorias extraídas somente do catálogo público local; finalidade é agrupamento editorial de categorias, não promessa de adequação de modelos.
- Busca ignora acentos e prioriza correspondência no título. Mantém todos os resultados acessíveis: 72 iniciais e mais 24 por acionamento, sem nova leitura do catálogo.
- Estado vazio, limpeza dos filtros e acesso de retorno ao Top 6, comparativos e vídeos. A vitrine não é substituída na rota inicial.
- Resultados internos permanecem `noindex,follow`, inclusive filtros sem termo; não criam páginas no sitemap.
- Nenhum novo serviço, evento, API, leitura Firebase ou dependência de execução.

Validação: 1.594 testes aprovados; validador de 627 URLs/571 produtos aprovado. Chrome isolado com 360 e 390 px: controles com pelo menos 44 px, sem rolagem horizontal, filtros combinados, estado vazio, limpeza, paginação, persistência no recarregamento e seções da vitrine preservadas. Requisições externas bloqueadas no teste; nenhuma sessão autenticada ou gravação usada.

Evidências locais: `outputs/upgrade-busca-20261118/qa.json`, capturas de filtros/resultados nas duas larguras e `tests.log` (na raiz de trabalho do Codex).

Ponto de parada: implementação e testes locais concluídos; confirmar implantação e os quatro arquivos públicos antes de registrar como publicado. Não reabrir fichas nem gerar catálogo amplo para este upgrade.
