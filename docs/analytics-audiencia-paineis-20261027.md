# Audiência GA4 nos dois painéis — 27/10/2026

## Escopo e fontes

O componente `analytics-audience.js` consulta exclusivamente `properties/545546219:batchRunReports` da Google Analytics Data API v1beta. Pede apenas `analytics.readonly`, via Google Identity Services. Usa o cliente web existente do projeto, com origem já autorizada `https://rankingdacompra.com.br`; não cria cliente, segredo, conta de serviço, servidor ou função. O `clientId` no JSON é um identificador público de aplicativo web, não uma chave secreta e não permite consultar dados sem autorização pessoal do Google. Não usar uma API key, token de acesso ou client secret nesse arquivo.

O proprietário ativou a Data API pela interface do Google Cloud. Não foi ativado faturamento, não foram alterados plano, regras ou App Check. A integração não usa Firestore, Windsor pago, BigQuery, Analytics 360 nem infraestrutura adicional. Mantém as cotas padrão. Se a resposta indicar faturamento, bloqueio, limite, erro de acesso ou de configuração, pausa e preserva o resumo anterior; não tenta contratar, ampliar cotas ou simular zero.

## Métricas

Apresenta sessões, usuários GA4 e visualizações da página inicial (`/` e `/index.html`, nos hosts apex/www) para hoje, sete e quatorze dias, com datas e horário de consulta. Hoje é parcial; os relatórios do GA4 podem atrasar e incluir testes ou acessos próprios. Não usa eventos de compra, receita, transações, conversão ou vendas, não define eventos principais e não envia eventos ao Google.

O antigo contador de entradas da vitrine foi desativado no modo informativo em 26/10. Seus registros continuam no Firebase sem exclusão, mas os painéis agora sinalizam que são históricos e nunca mostram zero como “visitas atuais de hoje”. Eventos internos de visualização de produto, clique e compartilhar permanecem separados. Nenhum número dessas fontes é somado ao GA4 ou tratado como venda.

## Operação e privacidade

Após o login normal do painel, o administrador clica em Conectar Google Analytics e autoriza pessoalmente somente a leitura no Google. O token fica numa closure em memória, vai apenas no cabeçalho Authorization da Data API e nunca é salvo no armazenamento, logs, arquivos, GitHub, Firebase ou outra aba. Não existe refresh token. Ao expirar (normalmente cerca de uma hora), requer novo gesto do administrador; não há renovação silenciosa, popup automático ou coleta 24/7 com computador desligado.

Enquanto a aba autorizada estiver visível, tenta atualizar no máximo a cada quinze minutos; o botão manual respeita um minuto. As outras abas reutilizam apenas totais e datas no cache local, separado por usuário autenticado e propriedade. Nenhum dado de audiência é publicado num JSON público. Troca/logout do usuário interrompe a requisição e limpa a exibição; respostas tardias não repõem estado nem cache. Uma consulta indisponível mantém a data real anterior. Resumo de outro dia mostra “—” para hoje, nunca zero inventado.

## Testes e referências

`node --test scripts/test-analytics-audience.mjs` cobre payload de leitura, filtragem da página inicial, consentimento, expiração, cache por usuário, token apenas em memória, respostas inválidas, cobrança, quota e respostas tardias. `scripts/qa-analytics-audience.mjs` usa exclusivamente SDK/respostas locais simulados, testa os dois layouts em 360/390/768/1366 px e bloqueia APIs reais, Firebase e registro de eventos. Não usar fixtures como dados de produção.

Referências oficiais: https://developers.google.com/identity/oauth2/web/guides/use-token-model e https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/batchRunReports e https://developers.google.com/analytics/devguides/reporting/data/v1/quotas .
