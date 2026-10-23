# Tanque de consumo automático

Solicitação do proprietário: automatizar atualização sem alterar produtos, preços, regras ou cobrança. Aprovados acesso somente leitura às métricas, fluxo específico do GitHub e publicação somente do total agregado e horário.

## Fluxo

1. `firebase-consumo.yml`: a cada quinze minutos (8/23/38/53), ou execução manual, usa identidade temporária de 300 segundos, sem chave, apenas escopo `monitoring.read`.
2. Consulta única da métrica de documentos lidos do banco padrão. O intervalo começa à meia-noite de `America/Los_Angeles`, inclusive dias de 23/25 horas. Agregação no servidor evita a multiplicação de séries retornadas.
3. Resposta deve ser completa, DELTA/INT64, sem paginação e sem duplicação de pontos. Ausência de série não é zero. Qualquer falha preserva o último arquivo, sem retentativas de Google, habilitação de API ou cobrança automática.
4. Saída allowlist `{reads, at}` em branch órfã `metricas-consumo-firebase`. Isso evita 96 reconstruções diárias do site, execução de testes integrais em cada atualização e leituras de catálogo para manter um ponteiro.
5. Dashboard autenticado lê o JSON público do GitHub no máximo a cada cinco minutos enquanto estiver visível. Não envia credenciais e não consulta Google Monitoring ou Firestore no navegador. Registro manual local permanece como contingência.

## Privacidade e segurança

- Papel personalizado de uma única permissão: `monitoring.timeSeries.list`.
- Condição WIF mantém IDs exatos do repositório e proprietário, branch main e lista explícita de workflows; só acrescenta `firebase-consumo.yml`.
- Nenhum token no site, JSON, logs, commits ou artefatos. O token GitHub não é persistido pelo checkout.
- Publicador valida novamente os dois campos e escreve uma árvore de um único arquivo numa branch separada, nunca força push nem altera main/catálogo.
- A consulta não cria dashboards pagos, alertas, exportações, métricas personalizadas, Cloud Functions ou qualquer outro recurso de cobrança. Se acesso exigir cobrança, parar e pedir decisão; não tentar contornar.

## O que os números significam

O horário público é o fim da amostra mais recente incluída, não a hora em que um job rodou. O saldo usa a referência gratuita de 50 mil leituras/dia e é estimado: métricas e faturamento podem divergir. Atrasos de métricas, GitHub e cache são possíveis. Após 45 minutos o painel sinaliza atraso; após virar o dia da cota não apresenta o registro de ontem como saldo de hoje.

Frequência nominal: aproximadamente 2.976 consultas por mês de 31 dias, uma série agregada por consulta. Isso fica abaixo da franquia publicada de um milhão de séries retornadas/mês, mas essa franquia pode ser compartilhada por outros usos. Não se deve prometer gratuidade irrestrita de qualquer volume. O projeto permanece Spark e não se habilita faturamento.

Fontes oficiais: https://firebase.google.com/docs/firestore/monitor-usage ; https://docs.cloud.google.com/monitoring/api/metrics_gcp_d_h ; https://cloud.google.com/products/observability/pricing .
