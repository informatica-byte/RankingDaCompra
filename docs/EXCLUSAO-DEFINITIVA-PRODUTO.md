# Exclusão definitiva de produto — 26/10/2026

## Uso no painel móvel

Na conferência ou nos anúncios pausados, use **Excluir cadastro e histórico definitivamente**. A conferência deve estar parada (nem em execução nem aguardando retomada). Leia o aviso e digite `EXCLUIR ID`, conforme mostrado pelo painel. Cancelar qualquer confirmação não grava nada.

A transação autenticada lê somente o produto escolhido e o registro técnico de exclusões, verifica a identidade e a sessão e apaga apenas esse cadastro. As regras administrativas existentes continuam obrigatórias. Se o produto mudou em outro painel, a exclusão é bloqueada. Não existe exclusão em lote nem exclusão automática por prazo.

## O que é removido

1. Cadastro no Firestore, na confirmação do usuário.
2. Na próxima publicação completa do sitemap: páginas principais e versões antigas conhecidas, links públicos, presença na busca/vitrine/seleções, histórico de preços e suas projeções antigas, status público e imagens próprias que não sejam compartilhadas.
3. A seleção semanal que dependia desse item fica sem aprovação; nenhum outro produto é escolhido como substituto silenciosamente. Os demais preços e conferências são preservados.

Enquanto essa publicação não terminar, o painel avisa que a limpeza pública e do histórico está pendente. Pode-se executar o fluxo **Atualizar sitemap automaticamente** para antecipar a publicação; não é preciso conferir preços novamente. Falhas de segurança ou validação continuam bloqueando o push.

## Limites importantes

Um registro contendo **somente IDs** é mantido em `configuracoes/exclusoes-definitivas` e `product-deletions.json`. É necessário para impedir que uma cópia antiga ou um snapshot de conferência recrie páginas apagadas. Ele não armazena nomes, links, preços ou o histórico removido.

Não é possível prometer “nenhum rastro”: Git, backups já baixados, Analytics, logs externos e caches de Google/WhatsApp não são apagados por esse botão. A URL deixa de existir na próxima publicação (404 no GitHub Pages), sem redirecionar para outro produto. Caches externos podem levar tempo para atualizar. Imagens utilizadas por outros produtos são preservadas.

O robô Tampermonkey de preços, regras, bloqueios e plano de cobrança não são alterados. A exclusão é uma operação administrativa normal do Firestore, sujeita às cotas existentes; não habilita serviços ou cobrança. Nenhum produto real foi excluído durante a implementação/testes.
