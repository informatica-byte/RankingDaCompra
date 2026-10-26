# Pausa manual dos 21 cadastros da revisão

O painel móvel oferece o cartão **Revisão manual — 21 cadastros**, dentro da área autenticada e próximo ao topo. O recurso foi autorizado para os grupos Starlink, Lenovo, Galaxy A36, Intelbras iME 360, Philco P32CRB, WAP W90, Mondial B-44 e soundcore P30i. São 21 IDs fixos, incluindo a duplicata dependente do Galaxy A36.

## Uso

1. Entre no painel móvel. Não inicie a conferência de preços.
2. Toque em **Pausar os 21 para revisão manual**.
3. Confira os nomes e IDs da lista, marque a confirmação e toque em **Confirmar pausa dos 21**.
4. Aguarde a confirmação do servidor. Não confunda botão publicado com pausa já aplicada.

Não é necessário carregar o catálogo inteiro ou refazer conferências para usar o cartão. Abrir, preparar e cancelar não consultam documentos. A confirmação lê apenas os 21 registros e aplica uma transação atômica. As retentativas normais do SDK podem reler os documentos. Há consumo normal da cota existente do Firestore; nenhum plano, serviço pago ou cobrança é ativado.

## Proteções

- Escreve somente `conferenciaPausada: true` e `conferenciaPausadaEm: serverTimestamp()` nos IDs revisados.
- Mantém autenticação, App Check, regras e transações existentes.
- Não modifica preços, links, fotos, texto, provas de conferência ou histórico.
- Não recria cadastros ausentes, não exclui produtos e não reativa automaticamente.
- Identidade revisada vinculada por SHA-256 de título, fonte, afiliado e foto. Se algum campo mudou desde a cópia analisada, a transação inteira é bloqueada para evitar pausar outro produto.
- Já pausados são preservados, sem reiniciar o prazo.
- Bloqueia concorrência com conferência ativa/pausada, salvamento, publicação expressa, edição e substituição de links. Uma recusa não libera um bloqueio pertencente a outra operação.
- Logout ou troca de sessão invalida a confirmação. Clique duplicado não abre outra transação.
- Preserva os IDs já conferidos, os resultados e o orçamento da rodada local; não inicia o robô.

Os 30 dias são apenas um aviso para revisão manual. A vitrine só refletirá as pausas após uma publicação validada; publicar este botão não modifica o catálogo estático nem resolve sozinho as outras colisões de deduplicação.

## Arquivos e testes

- `pending-review-pause.js`: lista fixa, impressão de identidade, planejamento, transação e confirmação visual.
- `painel-celular.html`: adaptador do SDK autenticado e atualização local apenas dos campos de pausa.
- `scripts/test-pending-review-pause.mjs`: 18 testes sem chamadas de rede, incluindo falhas, identidade alterada, sessão, cancelamento, escopo, idempotência e preservação de preços/progresso.

A cópia privada usada na revisão não foi incluída no repositório. O botão não copia, exibe ou persiste credenciais.
