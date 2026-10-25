# App Check — investigação de 25/10/2026

## Evidências e limites

Consulta passiva por volta de 13h11 BRT. O navegador conserva 33 registros agrupados, correspondentes a 52 ocorrências: 22 `initial-throttle` HTTP 401, 29 `throttled` HTTP 401 e um `recaptcha-error` de 22/10. Os 32 registros de 25/10 pertencem ao painel móvel; última falha registrada em 25/10 às 13:06:26.505 UTC (10h06 BRT). Todos os contextos preservados indicam online e script presente; isso não comprova sucesso do reCAPTCHA. Não foram induzidas falhas nem solicitados tokens para teste.

`initial-throttle` é lançado após recusa HTTP na troca de token. `throttled` é a espera local do SDK e reaproveita o status anterior, sem nova chamada ao servidor. Portanto, 52 ocorrências não equivalem a 52 recusas remotas, e o histórico não prova falha atual. Referência: [provedor oficial do SDK](https://github.com/firebase/firebase-js-sdk/blob/main/packages/app-check/src/providers.ts).

Console Firebase: Spark; Cloud Firestore 97% verificadas / 3% sem verificação, Monitorando; AI Logic 99% / 1%, Básico: aplicado; Authentication 100% / 0%, Monitorando. Percentuais agregados na tela, sem atribuição a uma operação específica. App web registrado com Fraud Defense/reCAPTCHA Enterprise, chave pública igual à usada pelos painéis e TTL de uma hora. Não houve salvamento de configurações. Nenhum erro AppCheck foi retornado pelo filtro de logs disponível na aba do dashboard; isso não exclui falhas anteriores em outra aba.

O console Google Cloud exige confirmação de identidade antes de permitir consultar domínios, avaliações e métricas da chave. A causa raiz do HTTP 401 permanece sem comprovação. Não atribuir a risco, domínio, quota, cobrança ou credencial sem evidência do provedor.

## Correção sustentada pela auditoria

A orientação móvel recomendava fechar/reabrir ou atualizar e usar o outro painel. Isso arriscava o formulário e não reparava a recusa. Agora reconhece também o código `initial-throttle` sem depender da mensagem em inglês, preserva a aba e orienta aguardar sem repetição. O diagnóstico informa data da última falha e separa recusas de espera local, preservando registros e formato de exportação.

Mantidos inicialização dos dois apps, provedores oficiais, SDK, renovação automática, enforcement, limiar de risco, regras, preços e links. Sem debug token, acesso extra, limpeza de histórico, escrita no Firestore, avaliação forçada ou cobrança. Formulário existente não foi recarregado.

Referência de configuração: [Firebase App Check com reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider). A correção de orientação não é uma alegação de resolução do HTTP 401.
