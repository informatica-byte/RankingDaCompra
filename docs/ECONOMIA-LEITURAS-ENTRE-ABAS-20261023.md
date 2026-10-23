# Economia de leituras: abas administrativas e publicador

## Escopo e proteções

- Nenhum preço, produto, cadastro, regra, App Check, plano ou cobrança foi alterado.
- Fila móvel continua com `getDocsFromServer`; leitura de transação antes de salvar permanece.
- Não foi iniciada conferência nem geração de catálogo para testar.

## Dashboard

`admin-shared-listener.js` usa Web Locks e BroadcastChannel locais ao navegador. Abas compatíveis, na mesma origem e usuário, compartilham uma assinatura de produtos e uma de categorias, em vez de manter uma cópia no servidor para cada aba.

A primeira aba mantém o listener normal. As outras recebem a lista inicial e depois mudanças em memória; IDs, ordem, números, timestamps e referências locais dos documentos são preservados. Nenhum token é transmitido, nenhum produto é salvo em armazenamento persistente e nenhuma gravação de Firestore é produzida por esse módulo. Logout encerra canais/travas e limpa os dados. A pausa de abas ocultas existente foi mantida.

Se a líder fechar ou pausar, uma aba restante assume a assinatura. Em um navegador incompatível, tipo não suportado ou ausência de resposta inicial em seis segundos, usa-se o listener original para não deixar o painel sem dados. Essa contingência pode reduzir a economia, mas preserva a operação. Navegadores, perfis ou computadores diferentes não compartilham a assinatura.

O diagnóstico local conta recebimentos compartilhados como reaproveitamento, não como leitura nova. Não representa faturamento exato.

## Publicador

`firestore-read-cache.mjs` reaproveita páginas GET bem-sucedidas dentro da **mesma execução e tentativa do GitHub**, inclusive entre processos do gerador que forem reiniciados pelo retry. O diretório é exclusivo de `run_id`/`run_attempt` no espaço temporário do runner. Não usa actions/cache, artefato ou restauração de outra publicação. O cache expira em quinze minutos, acima do limite de oito minutos do job, e contém apenas payload e metadados limitados; não cabeçalhos/tokens.

Uma nova execução continua lendo dados atuais. Não foi implementado cache de vários minutos entre publicações diferentes: isso poderia deixar de publicar uma conferência recém-salva. Falhas/429/403 não são cacheadas como sucesso. A validação obrigatória de autenticação e destino ocorre antes do cache. POST/runQuery da fila nunca é cacheado.

Cada processo imprime um resumo local de requisições, documentos, reaproveitamentos e falhas nos logs do GitHub, sem URLs completas, credenciais ou corpos de erro. Não envia diagnóstico para um serviço pago.

Alteração isolada no transporte `firestore-read-auth.mjs` não dispara mais uma reconstrução completa. Gatilhos editoriais, publicação manual, janela diária e todas as validações de segurança/integridade permanecem. Os testes foram atualizados para exigir esse comportamento, não para remover proteções.

## Limitações importantes

A redução diária real depende do número de abas, compatibilidade do navegador, reconexões e republicações. Não elimina as leituras necessárias para uma publicação nova ou para conferir/salvar um produto. Publicar apenas uma vez depois de terminar a conferência continua sendo a prática mais econômica.

Uma aba antiga mantém o código antigo até ser reaberta/recarregada. Nunca recarregar a aba de uma conferência em andamento apenas para ativar esta melhoria.
