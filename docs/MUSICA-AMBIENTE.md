# Música ambiente opcional

O controle compacto fica em uma linha própria logo abaixo do cabeçalho, no fluxo normal da página, sem flutuar sobre a busca, ofertas ou navegação. O volume começa recolhido e se expande no fluxo ao tocar em Volume. Não é incluído em páginas administrativas ou com `noindex`.

- Uma nova entrada, recarga ou restauração do histórico começa desligada. O visitante precisa escolher Ativar música.
- Pausar suspende o áudio e o agendador. Voltar à aba não retoma a música sozinho.
- Volume de 0 a 100, iniciado em 20. Somente esse valor é lembrado permanentemente, na chave `rdc-ambient-volume-v1`.
- Depois de ativada, uma navegação por link público interno na mesma aba tenta retomar a música. Há uma breve interrupção enquanto o documento carrega; não é um player persistente/SPA. Não intercepta cliques nem modifica URLs, links de afiliados, histórico ou SEO.
- A passagem usa `rdc-ambient-navigation-v1` em sessionStorage, consumida uma única vez, com origem/destino e validade de 30 segundos. Só é gravada ao sair por um link interno clicado nos últimos 5 segundos. Exige referrer do documento de origem e navegação normal; não vale em recarga, restauração, entrada externa, links em nova aba ou áreas administrativas. Se o navegador negar armazenamento ou informações de navegação, permanece desligada.
- Sair da aba ou iniciar mídia nativa pausa/libera o áudio. Voltar à aba não reinicia sozinho. Pausar cancela a continuidade. Se o navegador bloquear a retomada entre páginas, o contexto é liberado em até 2,5 segundos e o botão Continuar fica disponível, sem tentativas repetidas ou simulação de gesto.
- Não há arquivo musical, gravação licenciada de terceiros, streaming, API paga, rastreamento ou leitura/gravação do Firebase. A sequência instrumental foi criada para este recurso e é sintetizada localmente com Web Audio.
- Requer suporte a AudioContext. Falha de áudio/armazenamento não impede a navegação.

`ambient-music.js` contém interface, estilo e síntese. `scripts/public-privacy.mjs` integra uma única referência versionada nas páginas públicas, também nas futuras gerações do catálogo. Não alterar o bloqueio de métricas para controlar música: ela é independente de consentimento de Analytics e não emite eventos.

Regressões: `node --test scripts/test-ambient-music.mjs`. Validação geral: `node --test scripts/test-*.mjs` e `node scripts/validate-site.mjs`. Não executar as verificações do catálogo simultaneamente à regravação dos HTML.
