# Deduplicação e continuidade seguras — 26/10/2026

## Problema e correção

O gerador reunia qualquer código MLB presente no endereço, texto técnico e campos antigos. Dois produtos distintos com `deal:MLB779362-1` podiam formar o mesmo grupo. Catálogo, título ou link de afiliado repetidos também podiam produzir uma união sem prova de mesmo anúncio.

Agora `scripts/product-deduplication.mjs` exige anúncio de vendedor explícito extraído pelo parser já utilizado na troca segura de links, título normalizado igual e catálogos não contraditórios. Fonte com IDs inválidos/contraditórios, ausência de anúncio ou discordância entre fonte e afiliado não autoriza consolidação. Campos antigos e texto técnico não são evidência de identidade. Cor/tamanho/voltagem não são reinterpretados: títulos diferentes são mantidos separados por prudência, sem adivinhar equivalência.

Os grupos exigem compatibilidade par a par. Um registro intermediário com menos dados não pode unir dois catálogos contraditórios. A seleção da página principal mantém a pontuação anterior dentro de cada grupo comprovado, sem editar os objetos de entrada.

Os aliases históricos que possuem prova específica agora verificam um anúncio efetivo em `wid`, `item_id` ou caminho de anúncio; campanha e catálogo não satisfazem essa prova.

## Validações preservadas e fortalecidas

Na etapa de revisão, foram acrescentadas exceções manuais para sete grupos de títulos curtos/longos: Emma, creatina Dark Lab, NAC, Moto G06, fone Tipo Light, Galaxy A36 e um par Starlink. Cada exceção está vinculada aos IDs revisados, títulos normalizados exatos, mesmo anúncio de vendedor, mesmo catálogo explícito e mesmo afiliado. Alterações nesses dados invalidam a exceção; não há comparação aproximada de nomes. A compatibilidade par a par permanece obrigatória. Produtos com `conferenciaPausada` são separados antes do agrupamento e não recebem oferta ativa por essa regra.

A publicação de encerramento usa também o marcador `[verificar-pausas]`: depois da geração e novamente antes do envio, `verify-reviewed-pauses.mjs` exige os 21 endereços preservados com metadado de pausa e `noindex`, sem redirecionamento ou compra, fora da vitrine, sitemap e busca. Essa verificação lê somente os arquivos da mesma geração, não consulta nem escreve o Firebase. Os testes antigos e a trava `[preservar-precos]` permanecem nos dois passos.

- A validação de duplicatas continua bloqueando páginas com o mesmo anúncio real ou o mesmo botão de afiliado. Uma colisão ambígua bloqueia a publicação para revisão; não escolhe outro produto.
- O validador lê a fonte técnica explícita e os botões reais de compra. Códigos de campanha, catálogo, recomendações e citações na ficha não são tratados como anúncios duplicados.
- Links curtos respeitam maiúsculas/minúsculas no token. Compartilhar um link curto não une os cadastros; pode exigir revisão dos links de compra.
- Fonte e botão com anúncios explicitamente diferentes bloqueiam publicação. Dois metadados de fonte contraditórios também bloqueiam.
- Mantidas as validações de preço confirmado, moeda, identidade, caminhos, canonical, editorial, campos obrigatórios, URLs e metadados.
- A publicação desta alteração usa `[preservar-precos]`, mantendo a trava de preços nos dois passos do workflow. Não dispensar a trava se ela apontar divergência.

## Preservação operacional

Nenhuma alteração no robô de preços, nos dois painéis, no banco, nas regras do Firestore, no App Check, na cobrança ou nos históricos. Não há resolução de link remoto, consulta ao Mercado Livre ou rotina de conferência no novo módulo.

Este reparo pode manter mais páginas separadas que o algoritmo antigo. Isso é intencional quando não existe prova suficiente; não significa criação ou exclusão de documentos. Preços e datas são os já salvos, não são recalculados nem reconfirmados.

As regressões incluem a campanha em três formas de codificação, códigos falsos em texto, catálogos e anúncios diferentes, links repetidos, fontes contraditórias, pontes transitivas e preservação de todos os preços, links e provas de conferência. Os casos são fixtures offline. Não se presume que todo alias antigo esteja errado.

Verificação local antes do envio: **949 testes passaram**, zero falhas; o validador completo aprovou a base publicada com 597 URLs e 544 produtos. O diff dos dois painéis, robô, catálogo, histórico, configurações, status e regras permaneceu vazio. A geração remota e a trava de preços continuam necessárias para aprovar novos arquivos públicos.
