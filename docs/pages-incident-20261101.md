# Evidência para suporte GitHub — bloqueio interno de Pages

Repositório público: https://github.com/informatica-byte/RankingDaCompra
Site: https://rankingdacompra.com.br/

Não há tokens, credenciais, dados de compradores ou consultas Firestore neste relato.

## Comportamento observado

1. O deploy Pages do commit `eed0e63ca55604f4df531cbc04b0f23f155f6ab2` terminou com sucesso na execução 41290736637. O log informa ID de deployment igual ao SHA, não outro ID numérico.
2. A nova versão editorial, `7c559fb66a4d2148fcda70a8a3a8effaf6551e4a`, foi compilada e validada. Somente o deploy falha, execução 41291112610, tentativas 1–3.
3. A criação retorna HTTP 400: `Deployment request failed ... due to in progress deployment. Please cancel eed0e63ca55604f4df531cbc04b0f23f155f6ab2 first or wait for it to complete.`
4. GET autenticado de `/repos/informatica-byte/RankingDaCompra/pages/deployments/eed0e63ca55604f4df531cbc04b0f23f155f6ab2` respondeu status `succeed`.
5. POST autenticado ao mesmo caminho seguido de `/cancel` retornou HTTP 400: `Unable to cancel deployment eed0e63ca55604f4df531cbc04b0f23f155f6ab2 as it's finished.`
6. Portanto, cancelar o Actions não resolveria: ele já terminou. O ID consultado coincide com o ID de Pages retornado no log original. Não foi apagado ambiente, despublicado site, alterado domínio/HTTPS ou removida validação.

## Evidências públicas

- Sucesso anterior: https://github.com/informatica-byte/RankingDaCompra/actions/runs/41290736637
- Deploy novo bloqueado: https://github.com/informatica-byte/RankingDaCompra/actions/runs/41291112610
- Recuperação limitada ao SHA antigo: https://github.com/informatica-byte/RankingDaCompra/actions/runs/41291820393
- Consulta e mensagem exata de recusa: https://github.com/informatica-byte/RankingDaCompra/actions/runs/41291988576 (job 124804934188, step Cancelar somente SHA antigo)
- Deploys posteriores 41291820881 e 41291988415 também falharam.

Foi usada apenas a credencial temporária padrão de Actions com `pages:write` e `contents:read`, sem persistir a credencial do checkout, criar chaves ou expor headers. Os testes da recuperação usam respostas simuladas, não fazem cancelamentos reais. A recuperação real está claramente separada no último step. Não confundir os estados simulados do teste com o GET real `succeed`.

A tentativa pontual foi encerrada; o workflow fica `if: false` e foi reduzido a `pages:read`. Nenhuma agenda foi criada. O conteúdo do Nayef já está revisado; falta somente publicar e verificar. Não refazer revisões.

## Pergunta a encaminhar, somente após autorização do usuário

Podem verificar e liberar o bloqueio interno do GitHub Pages que referencia um deployment finalizado? O POST de criação diz que o SHA antigo está em andamento, porém GET indica succeed e o cancelamento recusa por já estar finalizado. Precisamos publicar o conteúdo validado sem despublicar o site, recriar ambiente, alterar DNS/HTTPS ou apagar dados. Qual procedimento oficial resolve essa inconsistência?

Este documento começou como rascunho; posteriormente o chamado 4935458 foi enviado com autorização. Em 01/11, Ivy encerrou por limitação de suporte da conta, sem análise técnica. Usuário autorizou responder: comentário https://help.github.com/ticket/personal/0/4935458#tc-55190154047764 enviado e status Open confirmado. Solicitado encaminhamento Pages/plataforma ou procedimento oficial seguro; se não elegível, categoria Community e permissão para referenciar o ticket. Nenhuma discussão pública criada, plano pago contratado, nova operação de deploy ou credencial enviada. Não presumir que reabertura confirma escalonamento técnico. As evidências continuam históricas, não um novo teste. Liberação conjunta atual: lotes 34,35,36,37,38 em 20261101; 14 ajustes preparados, ainda não publicados.
