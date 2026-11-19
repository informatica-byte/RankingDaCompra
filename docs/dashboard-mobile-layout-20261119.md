# Dashboard móvel: legibilidade — 19/11/2026

Base `bdb8fe608`. Alterações somente em CSS e no rótulo do botão de IA (“Gerar textos com IA”, removendo a quantidade fixa incorreta). Nenhum script de aplicação ou link existente alterado.

- Campos de formulário passam de 14 para 16 px até 700 px; rótulos com pelo menos 14 px.
- Ações do cabeçalho em uma coluna e controles com altura mínima de 44 px.
- Menor desperdício de margens no celular, mais espaço para títulos e foto de 72 px.
- Em telas de 901 a 1100 px, dois cartões por linha; preservados uma coluna nas menores e três nas maiores.
- Foco visível, tabelas e ações preservados. Não oculta conteúdo, não altera estados de segurança e não consulta dados.

QA isolada em 360/390/768/1024/1280 px: sem rolagem lateral; medidas de fontes/controles e colunas verificadas. Dados fictícios e rede bloqueada. Scripts e hrefs anteriores comparados com a base e idênticos. Nenhum botão de cópia, IA, publicação ou salvamento foi acionado. Não repetidos os testes manuais de cópia já concluídos.

Três testes focados e validador de 627 URLs/571 produtos aprovados. Evidências em `outputs/dashboard-mobile-layout-20261119/qa.json` e capturas, na raiz do Codex. Após publicação, confirmar arquivos e repetir somente QA de layout com HTML publicado, mantendo a mesma limitação de teste isolado. Cadastros, preços, afiliados, vitrine e consultas SEO/GA4 intactos.
