# Primeira etapa de clareza para o comprador — 21/10/2026

## Vitrine

A página inicial usa uma seleção de até seis produtos a partir dos IDs já escolhidos no painel. A prioridade editorial é Redmi Buds 6 Play, JBL Tune 520BT, Xiaomi Smart Band 9 Active, ASUS Vivobook Go 15, Logitech M170 e WAP WL 1800, com conferência do modelo pelo título. A ordem não representa classificação de qualidade, procura ou vendas.

A configuração original dos painéis não é regravada. O conversor de fibra e os demais produtos continuam cadastrados, com suas páginas e presença nas categorias e na página completa de melhores escolhas. Seleções vazias não são preenchidas automaticamente, nem são introduzidos produtos fora da seleção salva. A mesma função determina a seleção na versão estática e na versão dinâmica da home.

## Unidade inconsistente

No conversor U Maisu `mlMLB4952988337`, o título anuncia Ethernet 10/100/1000 Mbps, mas o texto do cadastro informava 1000 MB/s. A análise explica a diferença de unidade e não converte o número em velocidade comprovada. Taxa real, alcance óptico e compatibilidade com Starlink ficam sem confirmação. Não se afirma ter visitado ou validado um anúncio que não ficou acessível nesta etapa, nem se usa a expressão “anúncio oficial” para comprovar a ficha de um vendedor.

Somente o resumo editorial e os pontos positivos/limitações publicados desse produto recebem correção. Não há gravação no Firestore nem alteração de preço, modelo, foto, link ou data de conferência.

## Início das fichas

As seis fichas prioritárias ganham “Em poucas palavras”, com três itens: para quem faz sentido, principal limitação e o que conferir. Os textos reutilizam fatos e limites das fontes já identificadas, sem inventar testes, benefícios ou garantia.

A análise original permanece no HTML em uma seção expansível “Ler a análise completa”. Preço, botão da oferta e demais fontes não são removidos. O ASUS mantém sua origem como informação do anúncio; os demais mantêm suas fontes de fabricante. Há proteção por ID, modelo e, para o ASUS, anúncio/variante. A apresentação é idempotente e não altera o objeto do cadastro.

## Validação

Regressão adicionada em `scripts/test-consumer-home-briefs.mjs`: seleção sem mutação, paridade estática/dinâmica, configuração preservada, guardas de modelo/fonte, resumo idempotente, conteúdo completo e preço preservados e ressalva de unidades sem desempenho inventado.

Os próximos itens do plano — atalhos de orçamento, aprofundamento dos guias com consultas reais e consolidação de métricas — são etapas distintas; este documento não declara essas etapas concluídas.
