# Leitura autenticada do Firestore pelos jobs

Configuração autorizada pelo proprietário em 06/10/2026. Não exige chave privada no GitHub e não concede gravação, exclusão, administração de contas ou mudança de plano. O consumo de leituras continua sujeito à cota do projeto; autenticação não elimina essa cota.

## Recursos externos a preservar na reconstrução

- Projeto: `rankingdacompra`, número `300637600463`.
- Conta: `ranking-publication-reader@rankingdacompra.iam.gserviceaccount.com`.
- Único papel de dados da conta no projeto: `roles/datastore.viewer` (Leitor do Cloud Datastore).
- Pool: `ranking-github-read`; provedor OIDC: `ranking-github-main`.
- Emissor: `https://token.actions.githubusercontent.com`; audiência padrão do provedor.
- Mapeamentos: `google.subject=assertion.sub`, `attribute.repository_id=assertion.repository_id`.
- Representação da conta: `roles/iam.workloadIdentityUser`, exclusivamente para `principalSet://iam.googleapis.com/projects/300637600463/locations/global/workloadIdentityPools/ranking-github-read/attribute.repository_id/1300821562`.
- Nenhuma chave permanente criada. Não baixar ou publicar credenciais.

Condição do provedor (não ampliar para todo GitHub ou todas as branches):

```text
assertion.repository_id == '1300821562' &&
assertion.repository_owner_id == '281189244' &&
assertion.ref == 'refs/heads/main' &&
assertion.workflow_ref in [
  'informatica-byte/RankingDaCompra/.github/workflows/update-sitemap.yml@refs/heads/main',
  'informatica-byte/RankingDaCompra/.github/workflows/sync-mercadolivre.yml@refs/heads/main',
  'informatica-byte/RankingDaCompra/.github/workflows/localizar-mlb.yml@refs/heads/main',
  'informatica-byte/RankingDaCompra/.github/workflows/testar-identidade-firestore.yml@refs/heads/main'
]
```

## Implementação

`.github/actions/firestore-read-auth/action.yml` usa a ação oficial Google fixada em um commit verificado. Emite token OAuth com duração de 900 segundos e escopo `datastore`, sem arquivo de credenciais. O token é disponibilizado somente aos passos de leitura e nunca ao site público.

`scripts/firestore-read-auth.mjs` limita o destino ao banco padrão desse projeto, bloqueia métodos de escrita e redirecionamentos. Nos jobs, `RDC_FIRESTORE_AUTH_REQUIRED=true` impede tentativa anônima se a autenticação faltar. Um 401/403 não deve ser contornado por acesso público, chaves de administrador ou ampliação de papel. A sincronização não repete HTTP 429 de cota.

O diagnóstico manual “Testar identidade Firestore somente leitura” lê no máximo um produto, a configuração do site e um pedido MLB. Os logs mostram somente HTTP status; não mostram documentos nem tokens. Não executar o diagnóstico repetidamente sem uma causa concreta.

## App Check e plano gratuito

Tokens OAuth Google para conta de serviço usam IAM no Firestore REST, não regras de clientes Firebase. Isso separa os jobs confiáveis dos clientes públicos, mas não autoriza desligar regras ou App Check. Antes de enforcement, validar separadamente desktop, celular, autenticação e IA: os clientes sem token válido podem ser bloqueados. Manter monitoramento enquanto essa comprovação não existir.

Não habilitar cobrança, mudar para Blaze ou criar chave de administrador para resolver falhas. Se uma tela exigir cobrança, interromper e pedir decisão ao proprietário.

Fontes: [Firestore REST e IAM](https://firebase.google.com/docs/firestore/use-rest-api), [WIF para pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), [ação oficial Google](https://github.com/google-github-actions/auth), [enforcement do App Check](https://firebase.google.com/docs/app-check/enable-enforcement).
