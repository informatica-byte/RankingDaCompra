# Melhores escolhas e rankings — operação diária

Desde 05/10/2026, a área anterior de ofertas do dia é permanente. Não é necessário recriar os destaques todo dia. O endereço é https://rankingdacompra.com.br/melhores-escolhas.html.

## Como escolher

1. Entre no painel móvel ou, no dashboard, abra a Central de divulgação.
2. Abra **Melhores escolhas — produtos e rankings permanentes** e **Abrir seleção**.
3. Escolha até 12 produtos já cadastrados. Use busca, filtro de categoria, Adicionar, setas e Retirar. Retirar aqui não exclui o produto.
4. Marque até seis comparativos já publicados; eles conservam suas regras e análises.
5. Ajuste o título permanente ou use a sugestão local gratuita. Revise antes de salvar.
6. Salve e publique a vitrine pelo fluxo existente no GitHub. O botão abre o workflow; execute-o para gerar os snapshots e atualizar o site.

Exemplos: “Melhores escolhas e rankings de produtos” para categorias diversas; “Melhores fones Bluetooth para comparar” para uma seleção composta somente por esses fones. Um limite como “até R$ 100” só pode ser usado com todos os preços dentro do teto e conferidos recentemente. Não use “hoje”, “amanhã” ou “ofertas do dia” nesta área.

## Conferência

Continue a conferência diária assistida ou o lote como antes, inclusive para os produtos selecionados. Depois de conferir/cadastrar, publique a vitrine. A seleção continua visível, mas a confirmação de preço expira em 24 horas. Sem nova confirmação, mostramos o último preço com a data, sem tratá-lo como atual. O hub lê os snapshots publicados, não o Firestore de cada visitante.

As ofertas relâmpago continuam separadas, com até três itens e seu prazo real. Top 6 semanal, guias de presentes, vídeos do Ranki, análises e links de afiliado não foram substituídos.

## Segurança e restauração

Configuração nova: `configuracoes/site.bestChoicesTitle`, `bestChoicesProductIds` e `bestChoicesGuideUrls`. Salvamento usa merge, mantendo vídeos, temas e campos antigos. Faça backup do documento site junto do catálogo. A publicação expressa pode adicionar o produto à seleção quando houver espaço; se estiver cheia, o cadastro é mantido e você escolhe qual destaque retirar.

O gerador `scripts/generate-best-choices.mjs` deve rodar após `generate-home-static.mjs` e o histórico, nos workflows de publicação e preços. Ele reutiliza os arquivos locais. Dados estruturados da página são CollectionPage e listas de links, não um ranking entre categorias nem ofertas com preços não confirmados.

SEO: mantenha o endereço permanente, categorias úteis e produtos com análise própria. Não troque a URL junto com cada título. A estrutura facilita descoberta e entendimento, mas indexação, cliques e posições dependem dos buscadores.
