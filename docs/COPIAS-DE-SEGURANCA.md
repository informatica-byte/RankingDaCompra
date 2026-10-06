# Cópia dos cadastros

No dashboard privado, use **Baixar cópia dos cadastros** depois de os produtos e categorias carregarem. O arquivo JSON contém IDs, campos dos produtos e categorias e `site-config.json`. O download usa os dados já carregados pelo painel e não acrescenta consultas ao Firestore. Guarde o arquivo fora da pasta pública do site; ele pode conter links de afiliado e informações editoriais internas.

Para verificar a estrutura da cópia, execute:

```sh
node scripts/verify-backup.mjs caminho/do/rankingdacompra-backup-AAAA-MM-DD.json
```

A verificação lê o arquivo e não grava dados. Antes de uma recuperação, compare os totais e confira uma amostra de IDs e títulos. A restauração deve preservar os IDs e converter os campos marcados como `__rdc_type: timestamp` em datas do Firestore. Faça primeiro um teste em projeto de homologação; use os dados atuais como referência antes de aplicar qualquer gravação em produção.

O restaurador também começa em modo de simulação:

```sh
node scripts/restore-backup.mjs caminho/do/rankingdacompra-backup-AAAA-MM-DD.json
```

Após revisar a cópia e testar a recuperação em homologação, uma execução administrativa pode usar `--apply --project=rankingdacompra` com a variável `GOOGLE_APPLICATION_CREDENTIALS` configurada e o pacote `firebase-admin` instalado. Essa opção cria apenas IDs ausentes nas coleções `categorias` e `produtos`; os registros existentes são ignorados. A configuração pública `site-config.json` é mantida no GitHub e deve ser comparada com a cópia antes de qualquer restauração do código. Nunca envie o JSON de backup ou a credencial administrativa para o repositório.

Esta cópia inclui somente as coleções `produtos` e `categorias` e a configuração pública do site. Não inclui contas do Firebase Authentication, regras de segurança, histórico de métricas, arquivos do GitHub nem segredos de integração. Para recuperar o site inteiro, guarde também um backup independente do repositório GitHub e das configurações administrativas no Firebase Console.

## Proteção contra concorrência (04/10/2026)

O restaurador decodifica e valida todos os campos antes da primeira gravação. Usa `DocumentReference.create()`, cuja precondição atômica recusa qualquer ID já existente, inclusive criado por outro processo durante a recuperação. Somente o erro `ALREADY_EXISTS` é tratado como preservação; falhas de permissão ou conexão interrompem a execução e não são apresentadas como sucesso. Não usa a sequência insegura `get()` seguido de `set()`.

A configuração pública pode aguardar a geração: consulte o painel administrativo para obter a versão mais recente. A cópia dos cadastros não restaura automaticamente `configuracoes/site`, Authentication, regras, índices, App Check, segredos ou DNS. Preserve esses componentes separadamente e nunca habilite faturamento como parte da recuperação.

## Pacote completo de recuperação (06/10/2026)

Mantenha, em armazenamento privado e com uma segunda cópia fora deste computador:

1. ZIP do repositório oficial, SHA/branch e última implantação confirmada.
2. JSON dos cadastros completo, data, quantidade de produtos/categorias e verificação por `verify-backup.mjs`.
3. Exportação/configuração administrativa de Authentication, regras, índices e App Check, incluindo os clientes legítimos e jobs ainda em REST público.
4. DNS/domínio, configuração de GitHub Pages, workflows e permissões das integrações.
5. Métricas e memória da Sara, CSVs do Search Console com seus períodos e a configuração privada mais recente.
6. Inventário das credenciais necessárias e procedimento de recuperação das contas. Guarde os segredos separadamente, protegidos; não coloque chaves, senhas ou tokens neste repositório.

Registre itens ausentes como **pendentes**, não como pacote completo. Um ZIP do código sozinho não recupera o banco nem os acessos externos. Nenhuma etapa requer contratar um plano pago automaticamente.

Teste primeiro uma restauração isolada: verificar JSON, executar simulação, conferir IDs/contagens, confirmar que registros já existentes não são sobrescritos e testar login/edição/publicação apenas no ambiente de homologação. Os testes automatizados do restaurador cobrem preservação e concorrência, mas não substituem um exercício com o backup real e as dependências externas. Registre data, resultados e limitações desse exercício.
