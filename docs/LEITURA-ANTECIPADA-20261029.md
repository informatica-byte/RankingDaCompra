# Conferência de disponibilidade — versão 2.5.3

## Mudança

O worker começa a observar o DOM assim que recupera sua sessão de trabalho,
inclusive enquanto o documento ainda está carregando. Não depende mais do
evento DOMContentLoaded nem do primeiro acionamento do temporizador de reserva.
Botão de compra ou estoque visível continuam necessários para disponibilidade.
São mantidas três observações estáveis, separadas por 500 ms, antes de confirmar
disponível, e até 40 leituras para páginas sem evidência suficiente.
CAPTCHA/login prevalecem sobre compra; nenhum desafio é resolvido pelo robô.

Não há navegação paralela nem redução do intervalo adaptativo de 2 segundos,
das pausas cuidadosas ou do limite de comunicação de 60 segundos.
O ganho real depende do carregamento e das restrições do navegador/loja.

## Diagnóstico local

Cada novo resultado pode conter `timing.version = 1`, somente números limitados,
booleanos e os modos fixos adaptive/careful. A lista permitida exclui campos
arbitrários, tokens, cookies, credenciais, conteúdo da página e identificadores
de requisições. Não há envio de diagnóstico a Firebase, Analytics ou terceiros.

- startupMs: do pedido até preparar a primeira navegação na sessão.
- loadMs: da preparação da navegação até iniciar a leitura no documento atual;
  inclui redirecionamentos/bootstrap, não representa carregamento completo.
- readMs: observação da página e estabilização da evidência.
- workerMs: pedido até a resposta produzida pelo worker.
- deliveryMs / roundTripMs: retorno ao painel e duração total da comunicação.
- panelMs: processamento após o retorno, incluindo revisão de quarentena quando
  aplicável. Não cria uma revisão ou gravação adicional.
- pauseBeforeMs: espera real antes deste item na mesma execução; primeiro item
  de uma retomada começa em zero. Não mede tempo humano entre sessões.
- observations, earlyRead, hiddenAtStart e timeout: contagem e sinais locais.

O painel mostra medianas das leituras de hoje que possuem cada medição.
Registros antigos sem diagnóstico continuam válidos. O relatório continua na
versão 1, com o mesmo cursor, fila, impressões digitais e `repeat: false`.
Pausa de segurança é persistida antes da revisão opcional de quarentena.

## Ativação segura

Instalar 2.5.3 pelo endereço existente /bot-links.user.js, sem duplicar a
instalação. Primeiro parar a rodada pelo botão Parar, baixar seu relatório,
atualizar o userscript e então recarregar painel e aba do anúncio. Carregar a
fila de hoje e Continuar de onde parou, sem marcar refazer já verificados.
Nenhum preço/link é alterado pela melhoria. Não publicar cadastros nem executar
uma nova conferência completa para ativar o diagnóstico.

Testar com fixtures locais, sem Firestore, API da loja, Analytics ou dados reais.
Confirmação de ganho em produção depende dos próximos relatórios com timing.
