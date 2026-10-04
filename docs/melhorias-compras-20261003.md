# Compras mais claras e publicação econômica

Implementação das cinco melhorias, sem alterar documentos de produtos, credenciais, regras de acesso ou plano do Firebase.

## Como usar

- Abra /comparar.html pelo botão da página inicial ou use a pesquisa habitual.
- Filtre por categoria, valor registrado máximo e, opcionalmente, conferência nas últimas 24 horas.
- Selecione até três produtos do mesmo tipo. Sem tipo confirmado, a comparação automática fica indisponível; a análise continua acessível.
- O catálogo começa com 24 cartões e permite mostrar mais. A tabela desliza dentro de sua própria área no celular.
- Um preço antigo continua identificado como registrado, não como cotação atual. A geração e a publicação não mudam a data da conferência.

## Publicação e Firebase

A vitrine usa vitrine-publica.json. O gerador principal cria o arquivo a partir da mesma leitura de produtos que já realiza; os dois fluxos de publicação incluem esse arquivo no commit. A lista de campos públicos é explícita em scripts/public-catalogue.mjs. Produtos, notas internas, dados pessoais e segredos não são copiados integralmente.

O painel administrativo continua salvando no Firebase. Após cadastrar ou conferir preços, publique com o fluxo existente para refletir as mudanças nos arquivos públicos. Não há consulta de produtos ao Firestore por visitante da vitrine. Os registros de visitas e cliques existentes continuam funcionando; esta melhoria não promete consumo total zero de Firebase.

public-data.js compartilha as requisições simultâneas e reutiliza resultados válidos por cinco minutos. Falhas podem ser tentadas novamente e não provocam leitura alternativa de produtos no Firebase. As requisições de catálogo e player do YouTube só começam quando a vitrine de vídeos se aproxima da tela ou o visitante pede reprodução.

## Análises e critérios

scripts/product-decision.mjs explica público, recursos cadastrados, significado prático e dúvidas a confirmar em famílias reconhecidas: roteadores, fones/headsets, smartwatches, baterias portáteis e politrizes. Não cria testes, autonomia medida ou recursos ausentes. Outros produtos mantêm sua análise existente; não recebem texto genérico novo.

## SEO baseado em dados

editorial-focus.json prioriza guias existentes a partir do export local de 30/09/2026, com dados até 28/09/2026 e período de três meses: fones, roteadores e smartwatches. Não contém métricas privadas ou o CSV original.

A Central SEO do dashboard e do painel móvel permite informar data da exportação e período. A data de importação é exibida separadamente; registros antigos sem procedência continuam disponíveis, com aviso de data desconhecida. Cliques para lojas são eventos, não vendas. O CSV permanece no aparelho, sem envio ao Firebase.

Diretrizes usadas: [comparativos úteis](https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews) e [títulos descritivos](https://developers.google.com/search/docs/appearance/title-link). Não há garantia de posição ou prazo de indexação.

## Verificação

Executar todos os scripts/test-*.mjs com node --test e scripts/validate-site.mjs. Os novos testes verificam exclusão de dados privados, preservação de datas, deduplicação de leituras, falhas recuperáveis, equivalência de produtos, filtros de preços e procedência das métricas.
