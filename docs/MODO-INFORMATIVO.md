# Modo informativo — 26/10/2026

O Ranking da Compra passa a apresentar informações, comparações e demonstrações,
sem preços, descontos, notas editoriais numéricas ou contadores de oferta públicos.
As condições de compra são consultadas nas lojas parceiras. Os links de afiliado
dos cadastros são preservados; cliques continuam sendo cliques, não vendas.

## Preservação

- Não são apagados preços salvos, históricos, produtos ou URLs existentes.
- Não são modificados o userscript de preços, regras, App Check ou cobrança.
- Os controles de duplicação, exclusão confirmada, identidade e fontes continuam.
- Novos cadastros podem ser publicados sem preço. Uma edição informativa de um
  cadastro existente não sobrescreve seus preços históricos.
- A conferência diária de preços deixa de ser necessária para a vitrine.
  O histórico automático fica sem agendamento e seu script não grava no novo modo.
  Verificar links indisponíveis e alterações reais de produto ainda é importante.

## Informação legítima

O comparador mantém separados tipos incompatíveis e variantes contraditórias.
Cada ficha mantém as fontes e limitações já registradas. Perguntas adicionais
usam apenas características existentes, distinguindo anúncio e fabricante.
O que não pode ser confirmado permanece sinalizado; não é completado por palpite.
Isso não representa um novo teste físico ou uma nova verificação de todos os anúncios.

## Arquitetura e publicação

`site-mode.json` declara o modo. `informational-mode.js` atende a navegação pública
e os controles dos painéis. O catálogo `informational-catalogue.json` não inclui
campos financeiros e é gerado a partir dos dados já publicados.
`scripts/informational-site.mjs` é a última transformação de geração: remove
preços públicos e schemas de oferta/avaliação, preserva links de monetização e
produz artigos informativos, sem prometer resultados de testes não realizados.
O sitemap mantém endereços e registra a migração sem renovar a data das fontes.

O pipeline continua validando identidade, URLs, dados, metadados, conteúdo e
preservação dos preços internos. A atualização de publicação deve incluir
`informational-catalogue.json`. Nunca publique uma geração intermediária antes
da transformação informativa e dos validadores.

## Verificação

`node --test scripts/test-*.mjs` e `node scripts/validate-site.mjs` são obrigatórios.
`node scripts/qa-informational-ui.mjs` faz um teste local adicional, com Playwright:
celular, desktop, busca, seleção comparável e links, bloqueando APIs e Analytics.
Esse teste não salva produtos, não inicia lotes e não registra vendas.

Conteúdo editorial ainda pode ser melhorado aos poucos, priorizando os destaques
e dúvidas reais. Não use promessas universais de desempenho, garantia ou economia.
