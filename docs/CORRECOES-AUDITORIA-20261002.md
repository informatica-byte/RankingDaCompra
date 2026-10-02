# Correções da auditoria — 02/10/2026

## Implementadas sem apagar cadastros

1. Histórico registra a data real da observação (manual/API), não a execução. Pontos legados permanecem; mudanças de identidade arquivam o histórico anterior. JSON inválido bloqueia sobrescrita. A comparação pública filtra apenas os últimos 30 dias.
2. Cache público não renova a idade de uma cópia antiga. Compara os campos publicados com a versão anterior, conserva configurações remotas e salvamentos administrativos ainda não publicados e compartilha chamadas concorrentes. Cache legado é migrado com duas leituras, uma vez; não há consulta integral ao banco.
3. Histórico, preços e sitemap executam o validador local antes de publicar e após eventual rebase. Workflow adicional valida cada push/PR sem Firebase. Isso não substitui proteção administrativa da branch.
4. Títulos incompletos reparados offline; variantes do P30i usam cor cadastrada, e os dois anúncios Mondial usam sua identificação real. Sem excluir ou presumir voltagem. Metadados sociais acompanham o título.
5. Cabeçalho das ofertas conta os preços realmente confirmados e indica revisão manual, independentemente do relatório do lote automático.
6. Fila do localizador mantém cursor entre ciclos, leitura estável por data/ID, até duas páginas de dez documentos e processamento de até dez pedidos. Divide oportunidades entre novidades e antigos. Limite de três tentativas mantido; resultados anteriores deixam de ser descartados após 300 registros. Não contorna bloqueios do Mercado Livre.
7. Categorias do painel móvel são escapadas antes da inserção no HTML.
8. Playwright Core fixado em 1.59.1 (release oficial), em vez de uma versão imprevisível a cada instalação. Sem alterar a estratégia de acesso já existente.
9. Histórico e resultados compactados sem remover campos/registros. Histórico: 849.565 → 331.738 bytes; localizador: 481.582 → 431.746 bytes no reparo inicial.
10. Sara: `audit_ranking_site(max_pages=0)` verifica todo o sitemap. Amostras continuam disponíveis para a rotina econômica, com cobertura declarada explicitamente. Reabrir a Sara para carregar a atualização local.

## Verificações administrativas de leitura

Firebase permanece Spark, sem upgrade. Regras implantadas reservam escrita de produtos/categorias/configurações a `isAdmin()`, cuja função exige autenticação e a conta administrativa cadastrada. Não há regra genérica permitindo escrita a todo usuário logado. Nenhuma regra foi alterada; não é certificação de segurança/pentest.

App Check: Firestore e Authentication em monitoramento; Firebase AI Logic com aplicação básica. A amostra do console mostrou 81% de requisições Firestore não verificadas. Ativar enforcement agora pode interromper visitantes e rotinas REST: requer plano e confirmação separados. Índices compostos manuais: nenhum; não foi comprovada uma consulta atual que exija novo índice.

## Dependências externas que não foram “corrigidas por código”

- A autorização/certificação e respostas 403 do Mercado Livre continuam dependendo da plataforma; não se afirma que o lote esteja desbloqueado.
- Proteção da branch e checks obrigatórios exigem decisão administrativa compatível com os bots atuais.
- Novas medições de indexação/consultas dependem de atualização do Search Console; dados antigos não foram apresentados como atuais.
- Backup local privado do repositório anterior foi criado. Não equivale a exportação integral do Firestore, Auth, DNS ou segredos. Documentação de recuperação continua preservada.
- Modelos de IA, uploads e voz não foram acionados para teste pago. Unificação de SDKs e recompressão de imagens são melhorias opcionais, não defeitos confirmados nesta auditoria.

## Validadores

`node scripts/validate-site.mjs`; `node --test scripts/test-*.mjs` (expandir no PowerShell). Sara: `python -B -m unittest test_sara`. Testes locais não executam conferência de preço nem gravação no Firestore.
