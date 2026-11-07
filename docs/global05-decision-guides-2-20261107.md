# GLOBAL-05 — impressoras, air fryers e ferramentas

Necessidade constatada: os três guias já agrupavam os produtos e sinalizavam limites, mas faltava um roteiro específico para relacionar a seleção à necessidade do leitor.

Acrescentados três pontos de conferência e três perguntas/respostas por página. Sem novos dados de produtos, recomendação automática, notas, testes inventados ou escolha de variantes.

- Impressoras: tipo de impressão, funções separadas, consumíveis, conexões e limites do rendimento declarado.
- Air fryers: dimensões, formato, tensão, acessórios e limites de comparar por litros ou potência.
- Ferramentas: tarefa/material, tipo de equipamento, acessórios e limites de inferir uso profissional por números anunciados.

Roteiro estático integrado ao gerador, sem SDK, consulta Firestore ou evento adicional. Código compartilhado com os três guias anteriores, cujo HTML foi preservado. Teste cobre seis guias e idempotência.

Verificações: layout em 12 combinações com rede bloqueada (360/390/768/1366 px), validador com 568 produtos e 621 URLs, comparação com Git comprovando que as únicas diferenças nos três HTMLs são as novas seções. Catálogos, histórico, URLs e afiliados preservados.

Publicação verificada: fonte editorial 9cedf9d33, ajuste de dependência 054ef31d1, geração d52032677 e Pages 42361609137 SUCCESS. Três guias HTTP 200 com roteiro idêntico ao local e links preservados. 1.578 testes passaram. O workflow reconhece o módulo como dependência; a lista exata de caminhos permitidos continua coberta por teste, sem remover sua validação.

Ponto de retomada: GLOBAL-05 continua parcial. Verificar a necessidade de roteiro nos guias de casa, câmeras de segurança e informática antes de alterar. Não repetir os seis guias já contemplados nem as revisões dos produtos.
