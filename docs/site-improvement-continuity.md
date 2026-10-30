# Continuidade prioritária — Ranking da Compra
## Atualização prioritária de 30/10/2026 — retomar daqui

Segundo lote preparado em 30/10: 25 guias genéricos receberam títulos e resumos por finalidade, mantendo os endereços. Cinco fichas da campanha local receberam revisão DOCUMENTAL LIMITADA, com base apenas no anúncio já registrado, sem nova consulta de estoque ou teste prático: mlMLB2062519916, kfLnRJzsg88rUfJxMtb6, mudVRd1YUQgKwHRcq3iD, b052WcTAD3j2UDZHQiXY, UnTwhXqatX5MyoPnl6DN. O Pegada anterior não foi repetido. A biblioteca nova é campaign-analysis.json e não usa métricas de procura inventadas. 1.213 testes e QA de celular passaram. Confirmar publicação antes de marcar o lote como publicado. A revisão aprofundada de todos os guias ainda NÃO está concluída; esta etapa corrigiu títulos/resumos.

O usuário autorizou a retomada (“pode dar andamento”). Não pedir novamente a troca de modelo por rotina; pedir apenas se uma NOVA mudança de nível/modelo for necessária.

O primeiro lote está PUBLICADO E VERIFICADO: commit 25dfbd284b55883583368900c077154b8de1161f, seguido de 6a47e4c31 (lista esperada de gatilhos no teste). A validação GitHub 41084569798 terminou com sucesso. As falhas das execuções antigas 41084266241/41084266254 foram causadas pela lista de gatilhos anterior aos dois novos módulos, não devem ser rerodadas no commit antigo.

Conferência em produção: 551 produtos, 604 URLs, campos operacionais/preços preservados em relação à base, câmera com resolução a confirmar, relacionados do secador sem pasta de dentes/balanças e nenhum resumo de guia no catálogo prometendo preços com data. GLOBAL-01, GLOBAL-02 e GLOBAL-03 podem ser tratados como concluídos para este lote. A contingência de releitura informativa também foi corrigida e validada. Não refazer este lote.

Retomar GLOBAL-04 pela fila de 517 pendentes, preservando as 34 revisões anteriores, e depois GLOBAL-05 a GLOBAL-10. O usuário autorizou todo o plano, mas não autoriza inventar fontes, assumir testes, trocar links, excluir produtos ou ativar cobrança. Registrar dependências factuais de cada ID.

1.208 testes locais passaram; a interface local foi testada nas larguras registradas abaixo. Nada disso significa revisão factual completa das 551 fichas. A agenda diária já existente continua ativa; não criar outra. O checkpoint foi atualizado localmente depois da publicação; preservar estas alterações de documentação.

Início: 30/10/2026. Repositório de trabalho: C:/Users/User/Documents/Codex/2026-07-20/o/work/melhorias-integrais-20261030

## Regras solicitadas pelo usuário

- Ser franca: distinguir fatos, inferências, hipótese e ausência de evidência; discordar de ideias sem sustentação.
- Não prometer crescimento, posição no Google, vendas ou conclusão que não foi verificada.
- Preservar o modo informativo sem preços, IDs, cadastros, histórico, endereços e links de afiliados.
- Não excluir ou unir produtos, trocar variantes, repetir conferências, reduzir validações ou ativar bloqueios.
- Não contratar serviços, ativar cobrança, expor credenciais ou aumentar leituras do Firebase para executar trabalho editorial.
- Preferir arquivos públicos e dados locais; os comandos de descoberta devem usar DISCOVERY_USE_GENERATED=true.
- Não mudar modelo ou nível de raciocínio sem parar e solicitar ao usuário. Recomendação inicial: GPT-6.1 Sol / Médio. O usuário respondeu “Vou ajustar para GPT-6.1 Sol / Médio”; aguardar a confirmação de que já está ativo antes de iniciar outro lote. Nenhuma mudança automática foi feita.
- Uma agenda de continuidade substitui várias agendas duplicadas. Automação consome limites e precisa da máquina/aplicativo disponíveis para acessar este projeto local.
- Só publicar após regressões e validações, com prova de preservação dos campos operacionais.

## Onde retomar e como evitar repetição

1. Ler este arquivo e docs/site-improvement-progress.json antes de trabalhar.
2. Conferir o estado do Git e o remoto, sem sobrescrever mudanças alheias.
3. O registro contém os 551 IDs e uma impressão digital de título, resumo, ficha e dados de comparação.
4. preserve_prior_review identifica 34 revisões estruturadas anteriores: conservar, sem refazer. Não significa auditoria completa de todas as informações.
5. pending identifica os outros 517 itens: não são páginas vazias e não serão preenchidos por suposição.
6. Depois de uma revisão factual verificada, registrar status, data, fontes e notas por ID. Usar blocked_missing_source quando faltar evidência específica. Não repetir a mesma busca bloqueada sem mudança de fonte.
7. Marcar completed apenas com publicação e verificação correspondentes. Registrar pending_publication se o código ou texto está apenas local.
8. O script scripts/site-improvement-ledger.mjs preserva estados com conteúdo inalterado; mudanças materiais reabrem o item com previousState.
9. Retomar pelo primeiro trabalho global não concluído; depois por fichas com divulgação prevista e evidências suficientes. Não varrer todos os anúncios outra vez.

## Trabalhos globais e critérios de conclusão

| ID | Trabalho | Estado inicial | Critério de conclusão |
|---|---|---|---|
| GLOBAL-01 | Relacionados por tipo e sem repetir cor/modelo | Implementado localmente, publicação pendente | Testes e inspeção das 551 fichas geradas; nenhum relacionado incompatível presumido |
| GLOBAL-02 | Câmera com 8 MP/6 MP contraditórios | Aviso de resolução a confirmar implementado localmente | Título/resumo público coerentes, sem atribuir resolução arbitrária; foto, afiliado e preço preservados |
| GLOBAL-03 | Resumos do catálogo sem preços e sem frase duplicada | Implementado localmente, publicação pendente | 31 resumos alinhados ao modo informativo e regressões aprovadas |
| GLOBAL-04 | Revisão editorial dos produtos ainda pendentes | Fila criada: 517 pendentes, 34 revisões anteriores preservadas | Cada ID com fatos/fontes/limites suficientes ou pendência explícita; sem revisão fictícia |
| GLOBAL-05 | Guias por intenção e perguntas específicas | Pendente | Revisar os 31 guias, preservar URLs, evitar guias concorrentes repetidos e não inventar volume de busca |
| GLOBAL-06 | Comparações editoriais com URL estável | Pendente | Pares úteis do mesmo tipo e identidade confirmada, conteúdo próprio e tabela consistente; não gerar todas as combinações |
| GLOBAL-07 | Caminho por necessidade e perguntas opcionais do comparador | Pendente | Usabilidade local, acessibilidade e eventos existentes preservados, sem novas leituras Firebase ou IA paga |
| GLOBAL-08 | Responsabilidade editorial e fontes | Pendente; identificação humana pode exigir decisão | Autoria verdadeira, fontes e datas reais; nunca inventar pessoas, testes ou credenciais |
| GLOBAL-09 | Celular, navegação e desempenho | Pendente | Medir e testar inicial/guia/ficha/comparador, preservar música opcional e links, corrigir falhas comprovadas |
| GLOBAL-10 | Distribuição e avaliação dos resultados | Pendente | Conectar conteúdos úteis e materiais existentes; usar métricas já configuradas; vendas só com relatórios de afiliados |

## Verificações do primeiro lote

- 9 testes específicos e o conjunto completo de 1.208 testes passaram, sem falhas.
- Teste de interface local aprovado em 360, 390, 768 e 1366 pixels, incluindo comparador, fichas, guias, navegação com música, vídeos e formulários dos dois painéis sem gravação; nenhum destino afiliado foi visitado.
- Regeneração local concluída com 551 produtos e 604 URLs preservados. Validador geral aprovado. Nada foi publicado em produção.
- Foi corrigida também a contingência: o leitor agora reconhece o nome completo no Article informativo e pode reutilizar o resumo do catálogo já publicado apenas com ID, identidade e canônico correspondentes. A validação de comprimento e conteúdo continua ativa.
- Base de proteção: C:/Users/User/Documents/Codex/2026-07-20/o/outputs/melhorias-integrais-20261030/invariantes-antes.json
- Backup do catálogo público e sitemap na mesma pasta.
- Verificador: scripts/verify-site-improvement-invariants.mjs; compara 551 IDs/fichas/afiliados e 604 URLs, mais preços e campos operacionais.
- Não rodar o gerador principal com Firestore apenas para publicar mudanças editoriais.

## Modelo e consumo

Médio é a configuração proposta para código e revisão documental. Nível maior é uma hipótese para casos difíceis, não requisito de todo lote. Para reduzir o nível em trabalho repetitivo ou aumentá-lo em problema complexo: parar antes dessa troca e pedir ao usuário. Não iniciar API paga. A página oficial consultada é https://developers.openai.com/api/docs/guides/model-selection .

## Agenda

Uma continuação diária às 09:00, horário de São Paulo, será configurada neste chat. Cada retomada deve executar um lote pequeno e verificável, atualizar o ponto de parada e registrar dependências. Não criar novas agendas para o mesmo trabalho. A revisão SEO e vendas de 14/11 é separada e deve ser preservada.

Agenda efetivamente criada e confirmada ACTIVE: concluir-melhorias-do-ranking-com-registro-de-progresso. Próxima etapa depende da confirmação de modelo acima.

Quando tudo estiver concluído e verificado, remover apenas a agenda de continuidade e informar o resultado. Se só restarem dependências externas, informar exatamente quais são e não desperdiçar limites repetindo tentativas sem mudança.

## Publicação

Ainda não realizada na criação deste arquivo. Registrar hash do commit, execução de publicação, testes e confirmação do site antes de alterar esse estado. Nunca apresentar commit local como publicação em produção.

Ponto de parada em 30/10: primeiro lote corrigido e validado LOCALMENTE, sem commit/push. O remoto avançou de 0692a3ff6 para 6826845c0, alterando apenas mlb-resolucoes.json no fetch observado. Antes de publicar, conferir novamente o remoto e integrar as mudanças sem sobrescrever trabalho alheio. A cópia de trabalho tem alterações geradas e código ainda não commitados; não descartá-las.

Próximas ações, depois da confirmação: conferir a regra de relacionados nas fichas geradas, atualizar o gatilho do workflow para os módulos novos se necessário, revisar o diff, criar commit com guarda de preços, integrar main atual e verificar a publicação. Avaliar primeiro se a publicação editorial pode usar o catálogo local sem leituras adicionais do Firestore; não fazer alterações de autenticação ou cobrança para viabilizá-la.

