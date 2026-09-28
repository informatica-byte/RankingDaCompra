# Auditoria do Ranking da Compra — 28/09/2026

Base auditada: `a0a812ed3adb6f1eb5ffc965cc5f226826579eda`, repositório oficial `informatica-byte/RankingDaCompra`, branch `main`.

## Correções

1. Painel móvel: itens deixados para o fim mantêm a ordem de adiamento. Repetir o botão move novamente o item para o fim, mesmo quando todos os restantes já foram adiados. Essa ação não confirma preços.
2. Dashboard: edição de campos independentes não é bloqueada por promoções antigas inalteradas ou conteúdo legado inalterado. Novos cadastros e alterações dos respectivos grupos continuam sujeitos às validações.
3. Edição de produto preserva a data de encerramento da oferta relâmpago quando sua ativação/duração não muda, evitando renovação acidental.
4. Salvamento exibe resultado no formulário, preserva os campos em caso de erro e bloqueia submissão duplicada enquanto aguarda a gravação.

## Evidências

- Validador do site e blueprint: aprovados; 438 URLs, 411 produtos públicos.
- Testes Node: 63 aprovados, incluindo nove novos testes de regressão.
- Varredura independente: 602 arquivos HTML, 1.252 scripts e 420 blocos JSON-LD; sem erros de sintaxe, referências locais ausentes ou JSON-LD inválido encontrados.
- Todas as 438 URLs do sitemap responderam HTTP 200; verificações de canonical e noindex aprovadas.
- Página inicial inspecionada no navegador, inclusive viewport móvel; sem imagens carregadas com falha ou transbordamento horizontal observado. Nenhum erro/aviso de console observado na inspeção inicial.
- Execuções recentes consultadas no GitHub Actions estavam concluídas com sucesso antes desta publicação.

Comandos: `node scripts/validate-site.mjs` e `node --test --test-reporter=dot scripts/test-*.mjs`.

## Arquivos alterados

- `dashboard.html`
- `painel-celular.html`
- `scripts/test-dashboard-edit.mjs` (novo)
- `scripts/test-assisted-price-queue.mjs` (novo)
- `docs/AUDITORIA-20260928.md` (este relatório)

## Preservação e limites

Nenhum cadastro, preço, credencial, configuração de integração ou confirmação manual foi alterado pela auditoria. Não foi executada uma nova coleta geral do Firebase nem do Mercado Livre.

Os testes validam os comportamentos cobertos, não constituem garantia absoluta de ausência de defeitos. Regras de segurança implantadas no Firestore, permissões efetivas da API do Mercado Livre, consumo real de cota e indexação/posições atuais no Search Console exigem acesso específico e não foram certificados nesta execução. A resposta HTTP correta não garante indexação pelo Google.

A confirmação de preços continua dependente de evidência atual do vendedor; editar um cadastro ou adiar um item não equivale a conferir seu preço.
