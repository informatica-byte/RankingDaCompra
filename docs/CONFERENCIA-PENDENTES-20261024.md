# Conferência de 24/10/2026: 27 pendências

Fonte: relatório fornecido pelo administrador, `conferencia-2026-10-24.json`, versão 3. O arquivo original foi preservado; não foi incorporado ao repositório por conter histórico completo e parâmetros de rastreamento desnecessários à documentação.

## Estado observado, não uma nova conferência

- 568 produtos na fila; 541 conferidos; 27 pendentes; 12 anúncios pausados fora da fila.
- 12 falhas de título; 7 redirecionamentos; 3 divergências de anúncio visível; 2 ausências de preço principal; 3 avisos de indisponibilidade.
- As pendências não contêm título efetivamente encontrado, URL final ou IDs visíveis. Logo, não comprovam que todos os redirecionamentos sejam seguros, nem permitem declarar os 27 produtos corrigidos.
- Acesso público automatizado a amostras do Mercado Livre não ficou disponível. Não foi executada uma rodada autenticada nem salva qualquer cotação nesta correção.

## Correção 2.4.14

1. `i5-6º` é normalizado como `i5 6 geracao`, em vez de virar um falso código `i56`. Bot e validação dos painéis concordam. Outra geração ou SSD continua bloqueado quando contraditório.
2. Se o Mercado Livre trocar o caminho de catálogo ou retirar `wid` da URL, a aba vinculada pode aguardar a renderização e recuperar o mesmo anúncio **somente** quando o ID solicitado aparece visivelmente no produto, sem contradição na URL final, com título compatível e preço principal estável. Uma lista de busca, um título parecido ou o ID apenas nos metadados não são prova.
3. Todos os IDs explícitos de `item_id`, `wid` e filtros são examinados, na query e fragmento. IDs repetidos iguais são aceitos, campanhas `deal` não viram anúncios e IDs contraditórios são rejeitados.
4. Novas falhas registram etapa, título encontrado, caminho final sem query/fragmento, anúncio solicitado, IDs visíveis, catálogos e contagem de blocos do preço principal. Não registram HTML, tokens, cookies, cabeçalhos ou armazenamento da página. O painel persiste apenas campos permitidos e limitados no relatório local.
5. Sem relaxar a origem do preço: não usa parcela, preço riscado, cupom condicional, cashback, recomendação, outro vendedor ou JSON-LD isolado.

## O que continua separado até reteste

| Grupo | Produtos |
| --- | --- |
| Preço principal ausente (2) | Acer Aspire Go 15 i3; Realme C75 5G |
| Redirecionamento (7) | Vans VR3 Ultrarange; Philips OneBlade QP1425/10; kit Wella Nutri Enrich; Intelbras CIB 101; molinete 18+1; chaleira Atacama; Gemini AI Pro 18 meses |
| ID visível divergente (3) | compressor B&G; escavadeira Brastoy D342; kit 2 prateleiras Homeroarte |
| Título não confirmado (12) | lixeira retangular 16 L; varal Irsina; sérum Zencial; cama elástica; LG 43LR6700PSA; Grecin Control GX; carro RC 4x4; PC i5-6º 240 GB; Magnésio Nutrify; power bank 20.000 mAh; PC BRX i5 6ª 256 GB; fone tipo Light |
| Indisponibilidade indicada na tela (3) | kit Gamer Mageon; Kérastase Densifique; Brastoy Casa na Árvore 504 peças |

Os três avisos de indisponibilidade são resultados da rodada anterior, não novas confirmações de estoque. Não trocar links, reativar ou pausar cadastros com base apenas neste relatório.

## Retomada

Atualizar o userscript existente por `https://rankingdacompra.com.br/bot-precos.user.js?v=2.4.14`, confirmar 2.4.14 e recarregar o painel somente sem lote ativo. Carregar a fila de hoje mantendo **desmarcada** a opção de revisar preços já conferidos. O filtro atual e as confirmações salvas preservam os 541; conferir somente os pendentes. CAPTCHA exige resolução pessoal. Exportar novo relatório ao terminar para verificar quantos casos realmente foram recuperados; a publicação do código não equivale ao reteste dos produtos.
