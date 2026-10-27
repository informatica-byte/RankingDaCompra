# Correção do guia informativo de fones — 27/10/2026

O workflow 40588348075 gerou os arquivos, passou em 1.130 testes e foi corretamente bloqueado na validação final: `melhores-fones-bluetooth-ate-100.html: separação por tipo ausente`. A geração reaproveitava páginas informativas sem `Product.offers.price`; o antigo filtro de até 100 selecionava zero registros e produzia um guia sem grupos. O problema não estava no Firestore nem na quarentena. O passo de publicação não executou nessa tentativa.

## Alteração

- Mantém a URL e o canonical `https://rankingdacompra.com.br/melhores-fones-bluetooth-ate-100.html`, sem redirecionar ou criar uma página concorrente.
- O guia passa a se chamar “Fones Bluetooth: compare formatos, recursos e limitações”. A introdução não promete faixa de preço nem inventa uma classificação de qualidade.
- Retira o filtro financeiro desta seleção. Fones sem preço, com preço histórico ou com dados financeiros ausentes são elegíveis pelos mesmos critérios de finalidade.
- Requer descrição de fone/headset/headphone/earbud/Buds e indicação de conexão sem fio; microfones avulsos, lapelas, fones com fio, intercomunicadores e acessórios identificados não entram nesse guia. Seus cadastros e análises não são excluídos.
- Usa o agrupamento existente por formato: tipos diferentes continuam separados, contradições ficam a confirmar e cores do mesmo modelo ficam como alternativas. Não muda as especificações dos registros nem links de afiliado.
- Não altera `validate-site.mjs`, regras, permissões, proteção de preços, deduplicação ou processo de limpeza. Guia vazio continua sujeito à validação; não se injeta marcador fictício para passar no teste.

## Verificação

`test-focused-informational-fones.mjs` reproduz o fluxo real `DISCOVERY_USE_GENERATED=true` lendo páginas com schema Article e sem Offer/price, em pasta temporária e com chamadas de rede proibidas. Confere grupos, fontes incertas, canonical antigo, preservação das análises no sitemap, exclusão apenas da seleção de acessórios e ausência de mutações nos registros de entrada. Os testes anteriores mantêm os critérios de equivalência e o filtro explícito de orçamento para outros usos. A publicação usa o workflow habitual de leitura do Firestore, sem executar robôs de conferência ou gravar cadastros.
