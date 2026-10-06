# Conferência assistida: leitura e gravação segura — 06/10/2026

Base auditada: main oficial `c105f857bf462ff642affc22896b8e61b9628eaf`.

## Falhas reproduzidas

1. Toda aba do Mercado Livre recebia o novo comando. Antes da navegação da janela reutilizada, uma aba antiga podia devolver seu preço como se fosse do próximo produto. O código validava apenas duas palavras comuns do título, sem vincular a URL do anúncio.
2. Primeiro `Product.offers` da página era aceito, inclusive recomendação ou mínimo de múltiplas ofertas, sem confronto com o preço principal visível.
3. O móvel gravava no produto selecionado naquele instante, sem revalidar o produto/pedido que originou a resposta nem guardar a evidência automática.
4. Preços marcados como conferidos hoje saíam da fila, mesmo quando a confirmação havia vindo do robô defeituoso.

Isso comprova mecanismos de erro, mas não identifica a causa exata de cada registro antigo: faltava proveniência suficiente.

## Amostra confrontada com anúncios reais no Chrome

| Produto | Snapshot publicado | Preço principal observado |
|---|---:|---:|
| Nike Court Legacy Lift feminino, `InsaA7npZ9l5Qf6jByiC` | R$ 85,40 | R$ 358,79, condição Pix indicada no anúncio |
| Roçadeira Black Tools 52cc, `SctMie0hqocPmrWupQLO` | R$ 143,90 | R$ 659,90 |

Fontes: [Nike MLB2926671021](https://produto.mercadolivre.com.br/MLB-2926671021-tnis-nike-court-legacy-lift-feminino-_JM?searchVariation=175705466645) e [roçadeira MLB5254673406](https://www.mercadolivre.com.br/rocadeira-lateral-a-gasolina-4-em-1-52cc-capacidade-de-1200ml-9500-rpm-com-acessorios-the-black-tools/p/MLB32396130?pdp_filters=item_id%3AMLB5254673406). Observados em 06/10/2026; podem mudar. Não é reconferência de todo o catálogo.

## Reparos

- Userscript 2.1.0 usa somente a página renderizada. Elimina leitura HTTP de HTML bruto como comprovação.
- URL do anúncio e variação vinculam o comando à aba. Resultados de comandos substituídos são descartados.
- Somente `.ui-pdp-price__second-line .andes-money-amount` visível em reais é elegível; exclui parcelas, cashback, preço anterior e recomendações.
- Oferta estruturada só ajuda quando pertence ao mesmo produto/anúncio, é `Offer` e está em BRL. Conflito ou múltiplos preços principais exigem revisão.
- Duas leituras estáveis; resposta carrega pedido, produto, URLs, versão, hora e evidência. Ambos os painéis validam antes da escrita.
- Móvel também revalida a seleção da fila. Diferença de 35% ou mais exige confirmação manual, mesmo quando for uma mudança legítima.
- `precoConferidoPor` distingue `manual` e `robo_assistido_2.1.0`; fonte, evidência e título são registrados no fluxo automático.
- Opção de reconferência inclui os itens já confirmados hoje sem zerar datas, excluir dados ou criar leituras automáticas adicionais.

## Como usar

1. Atualizar o userscript já instalado em [bot-precos.user.js](https://rankingdacompra.com.br/bot-precos.user.js) no Tampermonkey; verificar 2.1.0 e recarregar o painel.
2. Entrar no painel móvel, abrir Conferência assistida e marcar “Revisar também os preços já conferidos hoje”.
3. Carregar fila e iniciar com o robô novo. Manter a janela do anúncio aberta. CAPTCHA continua sendo resolvido pelo usuário.
4. Conferir manualmente os casos separados, especialmente grandes diferenças. Não excluir produtos só porque a leitura falhou.
5. Ao concluir, publicar a vitrine pelo fluxo existente. Não repetir a API bloqueada como tentativa de reparar o robô.

O reparo do código não corrige sozinho os preços já gravados. O painel estava sem login na sessão de trabalho; nenhum preço do Firestore foi alterado nesta preparação. História, datas anteriores, configurações, afiliados e produtos foram preservados. Observações históricas suspeitas não são apagadas sem auditoria e confirmação do valor real.

## Arquivos alterados

- `bot-precos.user.js`
- `assisted-price-safety.js`
- `painel-celular.html`
- `dashboard.html`
- `scripts/test-assisted-price-safety.mjs`
- `scripts/test-assisted-price-automation.mjs`
- `scripts/test-assisted-price-queue.mjs`
- `docs/PLANTA-MESTRA.md`
- `docs/planta-mestra.json`
- `docs/ROBO-PRECOS-20261006.md`

Validar com `node --test scripts/test-*.mjs`, `node scripts/test-seo-opportunities.mjs`, `node scripts/validate-blueprint.mjs` e `node scripts/validate-site.mjs`. Fixtures de leitura/concorrência não acessam anúncios nem escrevem no Firebase.
