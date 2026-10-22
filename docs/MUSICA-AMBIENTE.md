# Música ambiente opcional

O controle fica no fluxo normal da página, antes do rodapé, sem flutuar sobre ofertas ou navegação. Não é incluído em páginas administrativas ou com `noindex`.

- Começa sempre desligado; somente o botão Ativar/Continuar pode iniciar o áudio.
- Pausar suspende o áudio e o agendador. Voltar à aba não retoma a música sozinho.
- Volume de 0 a 100, iniciado em 20. Somente esse valor é lembrado localmente, na chave `rdc-ambient-volume-v1`; não se guarda estado de reprodução.
- Sair da aba, navegar para outra página ou iniciar mídia nativa pausa/libera o áudio. Ao abrir outra análise, é necessário ativar novamente.
- Não há arquivo musical, gravação licenciada de terceiros, streaming, API paga, rastreamento ou leitura/gravação do Firebase. A sequência instrumental foi criada para este recurso e é sintetizada localmente com Web Audio.
- Requer suporte a AudioContext. Falha de áudio/armazenamento não impede a navegação.

`ambient-music.js` contém interface, estilo e síntese. `scripts/public-privacy.mjs` integra uma única referência versionada nas páginas públicas, também nas futuras gerações do catálogo. Não alterar o bloqueio de métricas para controlar música: ela é independente de consentimento de Analytics e não emite eventos.

Regressões: `node --test scripts/test-ambient-music.mjs`. Validação geral: `node --test scripts/test-*.mjs` e `node scripts/validate-site.mjs`. Não executar as verificações do catálogo simultaneamente à regravação dos HTML.
