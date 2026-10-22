# App Check e histórico — 22/10/2026

## Limites respeitados

Nenhum lote iniciado, preço consultado/corrigido, cadastro salvo, conferência repetida, novo bloqueio, alteração de cobrança, debug token ou avaliação forçada do App Check. Os testes de erros usam provedores falsos, somente localmente.

## App Check: resultado da investigação

- Projeto `rankingdacompra`, plano Spark, sem alteração.
- App web registrado com Fraud Defense (nome apresentado para reCAPTCHA Enterprise).
- Vida útil configurada: uma hora. A interface mostra risco do app `Alto risco: (0.1)`; não confundir esse texto com o valor inverso do controle HTML. Nenhuma configuração salva.
- Cloud Firestore e Authentication continuam em **Monitorando**; AI Logic já estava com **Básico: aplicado**, mantido.
- Recorte de sete dias exibido pelo console: Firestore 94% verificadas, 6% inválidas (787); clientes desatualizados e origem desconhecida: zero. São métricas agregadas, não prova de falha atual em um produto.
- Na sessão aberta, ambos os painéis mostram zero registros locais. Não foi reproduzida uma falha atual. A fila móvel permanece 562/562 conferidos, zero restantes, seis pausados; não foi executada outra conferência.
- O diagnóstico enviado anteriormente mostra erros `appCheck/recaptcha-error` em pares nos provedores Firestore e AI Logic. O código usa dois apps/provedores; isso explica a possibilidade de registros pareados, mas não comprova a causa nem permite declarar as 787 solicitações corrigidas.
- Mantida a inicialização/renovação oficial. Sem redução de proteção para mascarar métricas e sem troca especulativa de SDK.

### Diagnóstico passivo ampliado

Somente quando uma chamada que o SDK já faria falhar, registra opcionalmente: conexão online/offline, aba visível/oculta e script do reCAPTCHA presente/ausente. Não acessa mensagens, tokens, cookies, URLs, IP, user-agent ou pilhas. Permanece no navegador por até sete dias, no máximo 50 registros. Não faz chamadas, tentativas ou gravações na nuvem. Mudança de contexto não é agrupada como a mesma falha.

Ainda falta, para fechar a causa: um novo erro real com seu contexto, correlacionado ao horário/ambiente e às métricas do provedor. Não induzir erros em produção nem ativar bloqueios para obter evidência. Não afirmar que tráfego inválido significa ataque ou perda de dados.

Referência oficial: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider . O Google informa o monitoramento antes de aplicação, o impacto do TTL e a possibilidade de ambientes automatizados serem classificados como inválidos.

## Histórico: otimização implementada

O arquivo original `historico-precos.json` (4.671.999 bytes na cópia local Windows) foi apenas lido, sem execução do registrador de observações. Conteúdo, datas, preços, identidades, arquivos antigos e evidências preservados.

Projeção estática para exibição:

- `historico-precos-indice.json`: 54.488 bytes, 809 produtos.
- `assets/price-history/<id>-<hash>.json`: 809 arquivos, 386.180 bytes somados; apenas data, preço e sinalizador de verificação existente.
- Carregamento por IDs presentes na página, no máximo três consultas simultâneas por chamada, deduplicação e cache de arquivos imutáveis.
- Não baixa o histórico completo nem o copia para sessionStorage. Não possui fallback para Firestore.
- Novos cartões inseridos posteriormente recebem histórico sem repetir os já requisitados.
- Mínimo usa apenas observações verificadas; registros legados continuam preservados sem virarem comprovação de menor preço.
- Arquivos com hash antigo não são removidos, preservando abas abertas durante a publicação.
- Os três fluxos existentes mantêm as projeções atualizadas quando já registrariam o histórico; sem novo agendamento nem novo serviço.

## Verificações

- Paridade de todos os 12.983 pontos do histórico com a projeção e suas flags de verificação.
- Provedor falso confirma que o diagnóstico preserva a mesma Promise, erro, argumentos e resultado; nenhum token lido.
- Carregador testado com repetição, leitura simultânea, arquivo inválido, produto errado, URL externa e indisponibilidade.
- Validador: 576 URLs e 524 produtos públicos.
- Auditoria local de integridade: zero erros, zero avisos.
- Interface local em 390 px: página JBL sem largura excedente, histórico do próprio produto e links de oferta preservados.

Publicação e conferência final devem ser confirmadas antes de declarar o ajuste disponível no site.
