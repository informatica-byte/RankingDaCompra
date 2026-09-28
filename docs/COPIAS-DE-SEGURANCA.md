# Cópia dos cadastros

No dashboard privado, use **Baixar cópia dos cadastros** depois de os produtos e categorias carregarem. O arquivo JSON contém IDs, campos dos produtos e categorias e `site-config.json`. O download usa os dados já carregados pelo painel e não acrescenta consultas ao Firestore. Guarde o arquivo fora da pasta pública do site; ele pode conter links de afiliado e informações editoriais internas.

Para verificar a estrutura da cópia, execute:

```sh
node scripts/verify-backup.mjs caminho/do/rankingdacompra-backup-AAAA-MM-DD.json
```

A verificação lê o arquivo e não grava dados. Antes de uma recuperação, compare os totais e confira uma amostra de IDs e títulos. A restauração deve preservar os IDs e converter os campos marcados como `__rdc_type: timestamp` em datas do Firestore. Faça primeiro um teste em projeto de homologação; use os dados atuais como referência antes de aplicar qualquer gravação em produção.

Esta cópia inclui somente as coleções `produtos` e `categorias` e a configuração pública do site. Não inclui contas do Firebase Authentication, regras de segurança, histórico de métricas, arquivos do GitHub nem segredos de integração. Para recuperar o site inteiro, guarde também um backup independente do repositório GitHub e das configurações administrativas no Firebase Console.
