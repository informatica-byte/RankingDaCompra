# GLOBAL-05 — orientação de decisão nos guias

Escopo desta rodada: notebooks, celulares e Smart TVs. Os títulos e resumos de categoria já estavam corrigidos; não foram refeitos. A falta identificada era a ausência de roteiro específico para avaliar a própria necessidade antes de escolher as fichas.

Adicionados três pontos de conferência e três perguntas/respostas por guia, como seleção manual e não recomendação automática. Conteúdo não atribui novas especificações a produtos, não inventa testes, notas ou vantagens, e não afirma qual modelo comprar.

Implementação estática e idempotente em `scripts/guide-decision-support.mjs`, integrada à transformação informativa usada pelo gerador. Sem novo serviço, SDK, API, consulta Firestore ou evento de Analytics.

Verificações locais:

- 1.577 testes automatizados passaram.
- 12 combinações página/largura em 360, 390, 768 e 1366 px, perguntas nativas abrindo e sem overflow; rede bloqueada.
- Validação geral: 568 produtos e 621 URLs.
- Catálogo público, índice, histórico e sitemap preservados.

Estado: preparado; confirmar implantação e conteúdo público antes de marcar publicado.

GLOBAL-05 continua parcial: este lote não declara revisão profunda de todos os 31 guias. Próxima necessidade candidata: orientar os guias de impressoras, air fryers e ferramentas, somente após verificar lacuna equivalente. Não refazer as três páginas acima sem mudança ou falha nova.
