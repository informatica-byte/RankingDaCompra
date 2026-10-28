# Seis ajustes informativos — 28/10/2026

## Escopo e preservação

Alterações somente na apresentação pública, geradores e instrumentação opcional. Não grava produtos, não muda a seleção salva, preços históricos, links de afiliado, IDs ou regras de segurança. Não inicia robôs ou exclusões. A publicação mantém todas as validações; o contrato de cache aceita explicitamente a versão nova, sem aceitar versões arbitrárias.

## Implementação

1. **Rótulos sem promessa de preço:** título do diretório e seus botões passam a dizer análise, vantagens e limitações. O gerador corrige o texto para a próxima publicação também. Identificadores e URLs históricas são preservados.
2. **Destaques por completude:** entre os produtos já selecionados, a vitrine prioriza aqueles com análise revisada, fontes, vantagens e limitações. Os campos documentados do fabricante servem somente para priorizar a completude, não para atribuir qualidade, desempenho ou popularidade. Não introduz produtos fora da seleção, não apaga os outros e não cria estrelas ou vencedor entre categorias. Painéis explicam a regra.
3. **Resumo das fichas:** perfil de uso, quando avaliar outra opção, vantagens, cuidados e pendências reaproveitam a revisão identificada por produto/modelo e anúncio. Informações de fabricante e anúncio continuam distintas. Dados escassos recebem aviso explícito, não texto inventado. O parágrafo completo da análise é preservado; resumos novos não substituem a revisão detalhada.
4. **Linguagem promocional:** o resumo público evita frases como excelente desempenho e alta absorção sem comprovação, mantendo ressalvas negativas e dados concretos. O filtro não é certificação técnica de todo o catálogo; nomes comerciais e fontes permanecem identificáveis. A origem dos dados continua sinalizada, sem alegação de teste próprio.
5. **Comparação por necessidade:** estudo/trabalho, música/chamadas, conexão e monitoramento são atalhos de tipos, não promessa de adequação. A seleção final mantém as mesmas regras de equivalência, modelo e formato. Filtros não alteram produtos nem escolhem itens sozinhos.
6. **Caminho de interesse:** analysis_view registra abertura da ficha com consentimento, não comprova leitura completa. comparison_interaction/action=compare_select registra seleção; os atalhos e remoções são ações distintas. affiliate_click continua saída para Mercado Livre/Shopee, nunca purchase ou venda. Não envia URL afiliada, consulta de busca, token ou credencial, nem faz leituras adicionais do Firebase. O guia nos dois painéis explica a exploração de funil no GA4 e seus limites; não afirma ter criado uma exploração automaticamente.

## Medição e limites

Windsor foi usado somente para leitura das fontes e eventos existentes. As dimensões product_id, product_name, action, marketplace, placement e selected_count foram descobertas na propriedade conectada. Não foram modificadas permissões, filtros, eventos principais, campanhas ou cobrança.

Dados anteriores não são reconstruídos como analysis_view. Os totais de eventos agregados não demonstram o percurso sequencial da mesma pessoa. Comparar é opcional: saída direta para a loja não deve ser tratada automaticamente como abandono. Vendas continuam dependendo da plataforma de afiliados.

Os testes locais bloqueiam Analytics, Firebase e visitas de afiliados; consentimento/eventos são simulados. Nenhuma venda ou clique real é fabricado para testar a medição.

## Verificação antes de publicar

- 1.151 testes de regressão aprovados.
- Validador público: 600 URLs e 547 produtos; nenhuma validação removida.
- As 547 fichas mantêm exatamente os mesmos links de afiliados da versão anterior.
- Catálogo de origem, índice de busca e seleção salva preservados.
- 34 análises identificadas com revisão e fontes reaproveitadas; demais fichas não recebem conclusões inventadas.
- Testes de interface em 360, 390, 768 e 1.366 pixels, incluindo busca, comparação, música, recuperação de falha e painéis isolados.
- Resumo inicial compacto; outros cuidados, dados e fontes disponíveis ao expandir.
