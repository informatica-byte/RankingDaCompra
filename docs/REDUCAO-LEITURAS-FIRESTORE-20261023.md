# Investigação e redução de leituras — 23/10/2026

## Evidências, sem misturar períodos

- Console Firebase, últimas 24 horas de 22–23/10: aproximadamente **52 mil leituras**, 677 gravações, pico de oito listeners e quatro conexões. Inclui o console; não é uma discriminação por função nem a medição final de cota/faturamento.
- Google Cloud → Firestore → Insights de uso → um dia → coleção: no recorte carregado de 22/10, 06h–23h, o painel exibiu **10.778 leituras** no resumo. A tabela exibiu `/produtos`: 9.982 operações, 19.564 documentos verificados e 72.646.489 bytes; `/categorias`: 416 operações; `/mlbSolicitacoes`: 320; `/configuracoes`: 32. A própria interface avisa atraso de uma a duas horas. Esses números não devem ser somados aos 52 mil, nem tratados como uma conciliação exata do total.
- A dimensão disponível era coleção/grupo de coleção. Não havia atribuição histórica pronta a cada aba, função ou chamada do robô. Não foram habilitados logs de acesso, exportações, recursos pagos ou novas políticas de alerta para tentar obtê-la.
- GitHub, intervalo de datas 22–23/10 (não exatamente o mesmo recorte de 24 horas): 20 execuções de Atualizar sitemap automaticamente, das quais 13 manuais, cinco por push e duas agendadas. Onze terminaram com sucesso e nove falharam. Não inferir que cada falha leu a coleção inteira.
- O gerador lê o conjunto de produtos e categorias quando precisa de fonte atual; a geração editorial subsequente e o histórico já reutilizam arquivos locais. Um número grande de publicações/recargas administrativas pode acumular milhares de documentos retornados. A implantação do GitHub Pages e os testes offline, por si só, não leem Firestore.

## O que o código confirmou

1. A página inicial, busca, comparador e rotas públicas principais usam arquivos publicados. Há funções dinâmicas antigas em `index.html`, mas a entrada real usa `publishedRoute`; não foram atribuídas a elas as leituras normais sem evidência.
2. O dashboard mantém listas vivas de produtos/categorias e resumo compacto de métricas, mas o preparador semanal fazia outras consultas completas de produtos, categorias e visitas dos sete dias. Era uma releitura evitável.
3. O painel móvel podia iniciar duas leituras completas simultâneas a partir de módulos diferentes. O cache de um módulo não coordenava o outro. Uma atualização de foco também podia reler produtos já obtidos pouco antes.
4. As leituras por transação e documento individual antes de salvar protegem a identidade, o preço conferido e a edição concorrente. Não são o alvo da otimização e foram mantidas.
5. A reconexão de listeners pode reler o resultado; a documentação oficial explica essa contabilização. Não foi desligada a sincronização necessária, nem ativada persistência de dados administrativos em disco.

## Ajustes implementados

- Comparativo semanal do dashboard recebe os snapshots atuais da lista e o resumo compartilhado de métricas. O resumo continua filtrado aos últimos sete dias; uma janela de 14 dias não entra no ranking como sete. A leitura específica da configuração publicada permanece.
- Coordenador em memória por sessão agrupa consultas simultâneas à mesma coleção. Usos auxiliares podem reutilizar a resposta por no máximo um minuto.
- **Carregar fila de hoje continua pedindo uma leitura nova dos produtos.** O SDK usa `getDocsFromServer`: ausência de servidor não vira consulta fresca bem-sucedida com cache antigo. Uma consulta que já esteja em andamento ao mesmo servidor é compartilhada.
- Falhas mantêm o erro original; não fabricam preço novo nem retornam cache antigo como confirmação de atualização. A fila e as conferências salvas não são zeradas por esse recurso.
- Logout/troca de usuário limpam o cache novo e rejeitam respostas tardias de outra sessão. Nenhuma credencial é copiada ou persistida.
- Ambos os painéis mostram **Leituras deste painel — diagnóstico local**. O contador observa apenas consultas instrumentadas e mudanças recebidas; não inspeciona dados dos produtos, tokens ou URLs. Não gera consultas, polling, gravações ou envio de diagnóstico à nuvem. Cache, índices, regras, remoções e reconexões impedem tratá-lo como faturamento exato.
- A versão de cache do script foi atualizada apenas no dashboard. Não se provocou uma geração completa/consulta ao Firestore apenas para publicar esta mudança administrativa.

## Resultado dos testes, não promessa de economia diária

- Cenário local com duas leituras concorrentes de 562 produtos: de duas consultas potenciais/1.124 documentos para uma consulta/562 documentos retornados.
- Preparação semanal com listas e métricas já carregadas: zero releituras dessas três coleções; a leitura específica da configuração continua.
- Testados expiração, consulta explícita, falha de rede, alteração de sessão em andamento, contagem por mudanças de listener e ausência de persistência/telemetria.
- 801 testes locais aprovados. Validação de 579 URLs e 527 produtos públicos. Integridade offline: 809 páginas, zero erros, zero avisos.
- Não foram modificados arquivos de preços, catálogo, histórico, cadastros, regras, App Check, plano, agendamentos ou o robô. Não foi executado lote nem teste de salvamento em produção.

## Como confirmar a queda real

Depois de abrir a nova versão, usar normalmente uma única aba de conferência. Evitar vários cliques em publicar antes de a implantação anterior terminar e evitar múltiplas abas administrativas carregadas sem necessidade. O fluxo normal de conferência e publicação continua disponível.

Comparar janelas equivalentes no console nos dias seguintes; o gráfico móvel ainda contém o consumo anterior e os insights têm atraso. Não declarar que as 52 mil leituras já caíram, que tudo veio do robô, ou que o HTTP 429 nunca voltará. O contador local ajuda a distinguir releituras de produtos, categorias e métricas em uma próxima ocorrência, sem habilitar cobrança.

Referências oficiais:

- [Contabilização de leituras e listeners](https://firebase.google.com/docs/firestore/pricing#listening_to_query_results)
- [Cota gratuita e período de renovação](https://firebase.google.com/docs/firestore/quotas#free-quota)
- [API getDocsFromServer](https://firebase.google.com/docs/reference/js/firestore#getdocsfromserver)

Publicação e conferência visual devem ser confirmadas antes de considerar esta versão disponível aos usuários.
