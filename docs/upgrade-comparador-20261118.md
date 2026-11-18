# Comparador no celular — 18/11/2026

Base `0f8656413`. Somente apresentação e interação: nenhum cadastro, preço, afiliado, especificação ou regra de equivalência alterado.

- Resumo dos escolhidos com remoção individual, limpeza da seleção e atalho com foco para a tabela.
- Ao selecionar o primeiro modelo, ativa o filtro existente de mesmo tipo; pode ser desmarcado sem desativar a validação da seleção.
- Cabeçalhos e coluna de critérios fixos na área de rolagem da tabela; títulos limitados visualmente no celular, texto completo preservado no DOM e no atributo title.
- Com dois modelos, as duas colunas cabem lado a lado no celular; com três, a rolagem é restrita à tabela, sem alargar a página.
- Destaque e opção “Só diferenças” comparam texto, estado de confirmação, origem e URL da fonte. Não inferem equivalência ou superioridade; limites e links das fichas permanecem visíveis.
- Corrigido o redesenho causado pelo evento change ao sair da busca, que podia remover o checkbox entre o início e o fim do primeiro toque.
- Tipos desconhecidos, outra variante do mesmo modelo e limite de três continuam sujeitos às proteções existentes. O P30i não foi liberado artificialmente: seu campo de formato não explicita intra-auricular nesta base; teste móvel usa Redmi Buds 6 Play e Havit TW982.

QA Chrome isolado a 360/390 px: seleção de dois, remoção, limpeza, destaque/filtro de diferenças, rolagem interna, cabeçalhos fixos, sem rolagem lateral do corpo, bloqueio de seleção de notebook junto aos fones. Top 6, guias e vídeos da vitrine preservados. Somente arquivos públicos locais, sem login, solicitações externas ou gravações.

Evidências: `outputs/upgrade-comparador-20261118/qa.json`, capturas da tabela e log de testes na raiz do Codex. Após implantação, verificar com o mesmo script usando RDC_QA_BASE e registrar o resultado nos documentos de continuidade. Não gerar catálogo nem refazer fichas para esta publicação.
