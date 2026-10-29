# Limite de páginas inconclusivas — 2.5.4

A observação do DOM tem prazo de 8 segundos, medido por relógio monotônico
quando disponível. Não se espera mais quarenta temporizadores de 500 ms
quando o navegador já consumiu o prazo. A contagem de 40 observações permanece
como proteção adicional para ambientes com relógio anômalo.

O intervalo de 500 ms entre observações não é encurtado perto do prazo.
Se não houver tempo para outra observação completa, o resultado inconclusivo
pode ser devolvido até aproximadamente meio segundo antes do limite.

Ao vencer o prazo sem prova suficiente ou sem estabilidade, o resultado é
`unverified`, nunca `unavailable`. O motivo anterior é preservado quando a
página é genérica ou não mostra informação suficiente. Uma última leitura real
é feita ao retornar do temporizador: CAPTCHA/login têm prioridade, e nenhuma
resposta disponível é aceita sem as três observações estáveis já exigidas.

Este não é um prazo absoluto de rede: abertura/redirecionamento acontece antes
da observação. Abas suspensas ou navegador ocupado podem atrasar a execução;
ao voltar, o worker encerra a observação sem agendar as esperas restantes.
O teto de comunicação de 60 segundos e as pausas adaptativas não mudam.
Não há navegação em paralelo, tentativa de contornar CAPTCHA ou API nova.

Novos campos locais permitidos em `timing`: `readBudgetMs`, `readLimitReached`
e `readOverrunMs`. Os dois painéis mostram o total de inconclusivas encerradas
por limite registrado e o maior atraso medido além do prazo. Não armazenam
credenciais nem enviam métricas a Firebase/Analytics.

Fila, chave de armazenamento, impressões digitais e formato de checkpoint
permanecem iguais. Confirmados continuam fora da fila com `repeat: false`.
Versões anteriores sem esses campos continuam sendo aceitas como histórico.
Nenhum link, preço ou cadastro é alterado pelo limite de leitura.

Para ativar: com a rodada parada e relatório baixado, atualizar pelo endereço
existente /bot-links.user.js, recarregar painel e anúncio e carregar a fila de
hoje. Continuar de onde parou sem marcar refazer os já verificados.

Verificações feitas apenas com fixtures: prazo normal, atraso de 30 segundos,
compra ainda sem estabilidade, CAPTCHA tardio, cancelamento, legado e retomada.
