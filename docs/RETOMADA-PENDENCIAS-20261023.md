# Retomada das pendências — 23/10/2026

## Falha do localizador confirmada

Execução investigada: https://github.com/informatica-byte/RankingDaCompra/actions/runs/39901491450 .

O log da etapa de leitura informa limite de uso do Firestore (HTTP 429). Foram processados zero pedidos; a publicação dos resultados existentes terminou. Portanto, não é uma nova comprovação do erro 403 do Mercado Livre, nem evidência de que os produtos estejam indisponíveis. Os 237 pedidos históricos com tentativas esgotadas não são a quantidade de produtos ativos pendentes de conferência.

O console, no recorte de últimas 24 horas de 22–23/10, mostrou cerca de 52 mil leituras, 677 gravações, oito listeners no pico e quatro conexões no pico. Esses dados incluem uso do console e não correspondem necessariamente ao período de cota/faturamento. O HTTP 429 é confirmado; não se atribuiu todo o consumo ao localizador nem se afirmou que o período móvel equivale à cota diária.

## Correções implementadas

- Após HTTP 429 na leitura da fila, persiste apenas código, horário e prazo de espera de duas horas em `queueState.readFailure`. A execução seguinte respeita esse prazo sem consultar o Firestore nem os anúncios.
- A espera não é prorrogada a cada execução. Estado inválido, prazo vencido ou prazo diferente de duas horas não bloqueiam a fila indefinidamente. Após recuperação da leitura, remove-se o estado de espera.
- Cursor, resultados anteriores, tentativas e os resultados seguros obtidos antes de eventual falha da segunda página permanecem preservados.
- Logs, resumo e anotação do GitHub distinguem cota da fila de falha nos anúncios. Não orientam trocar links, editar produtos ou repetir conferências por causa de HTTP 429.
- Resposta inválida ou erro embutido no corpo da consulta não são convertidos em fila vazia.
- A execução incompleta continua sinalizada como falha depois de preservar/publicar os dados. Não se trocou uma falha real por sucesso aparente.

Nenhum novo serviço, agendamento, bloqueio, plano pago ou chamada adicional foi criado. Nenhum script de consulta a anúncios ou lote foi executado manualmente durante os testes. O comportamento será usado pelos próximos ciclos do agendamento existente; não garante que a cota estará disponível ao término da espera.

## App Check

Conferido apenas em leitura: projeto no Spark; Firestore e Authentication em Monitorando; AI Logic com Básico aplicado, mantido. O console mostrou 93% verificados e 787 inválidos (7%) no recorte exibido; o total absoluto de inválidos é igual ao registrado na revisão anterior. Percentual diferente, isoladamente, não comprova novas falhas.

O painel móvel aberto mostrou zero registros locais do diagnóstico. Não foi reproduzido erro novo. Não há evidência suficiente para alterar SDK, limiar de risco ou proteção. A causa dos registros inválidos continua dependendo de um erro real com contexto; o diagnóstico passivo já instalado permanece disponível. Nenhum token foi lido, copiado ou salvo.

## Fichas e dependências externas

O inventário da revisão de 30 anúncios permanece com 52 campos sem confirmação em 24 fichas, por ausência ou contradição no anúncio. Não preencher por semelhança. Nenhuma especificação, preço, imagem, link, ID ou prova de conferência foi alterado nesta retomada. O erro 403 continua dependendo da resposta oficial do Mercado Livre.

## Validação

- 791 testes locais aprovados, incluindo espera sem chamadas, retomada após expiração, preservação do cursor e resultados, separação entre HTTP 429 e HTTP 403 e rejeição de resposta inválida.
- Validador: 579 URLs e 527 produtos públicos.
- Integridade offline: 809 páginas, zero erros e zero avisos.
- Sem alteração nos arquivos de produtos, catálogo, preços, histórico, regras ou configurações do Firebase.

Publicação remota deve ser confirmada antes de declarar esta correção disponível no repositório.
