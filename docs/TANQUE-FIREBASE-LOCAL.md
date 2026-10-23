# Tanque Firebase local — versão 1.0.1

Script independente do robô de preços. Não é uma atualização do `bot-precos.user.js`.

Correção 1.0.1: reconhece também o endereço de Uso terminado em `/reads`, com ou sem `/u/N`, sem ampliar o acesso para outro projeto/banco ou alterar a validação do período atual. A versão 1.0.0 encerrava antes de ler essa tela e deixava o painel no último valor manual. Nome, namespace, permissões e armazenamento foram preservados para atualizar o mesmo userscript, não instalar outro robô.

Quem já instalou: abra o link abaixo no Chrome e confirme **Atualizar**, verificando a versão **1.0.1**. Depois recarregue o console e, somente quando não houver lote em andamento, o painel. Uma conferência em andamento não deve ser interrompida. Confira se o total da tela e o tanque coincidem (com “≈” quando arredondado). Publicação do arquivo e testes não substituem a confirmação real após atualizar no Chrome.

## Instalação por link no Chrome com Tampermonkey

Link direto: https://rankingdacompra.com.br/tanque-firebase-local.user.js . Abra no Chrome com o Tampermonkey instalado e confirme **Instalar**. Não é preciso copiar código. Página de ajuda: https://rankingdacompra.com.br/instalar-tanque-firebase.html .

Se a tela de instalação não abrir automaticamente, use o procedimento manual abaixo:

1. Abra `tanque-firebase-local.user.js` em um editor e copie todo o conteúdo.
2. No Tampermonkey, escolha **Criar novo script**, substitua o exemplo pelo conteúdo copiado e salve (Ctrl+S). O nome deve ser **Ranking da Compra — Tanque Firebase local**.
3. No MESMO perfil do Chrome, abra https://console.firebase.google.com/project/rankingdacompra/firestore/databases/-default-/usage/last-24h . Selecione **Current quota period / Período atual da cota**; não use “Últimas 24 horas”. Aguarde o total de **Leituras**. Se o quadro do userscript não aparecer após entrar na conta, recarregue somente essa aba do console (não a do painel com lote em andamento).
4. Abra o dashboard ou o painel móvel no mesmo Chrome e perfil. Nos dois, entre normalmente, sem informar senha ao script.
5. Confira o quadro **Tanque Firebase local — Tampermonkey**. No dashboard, o ponteiro existente será atualizado; no painel móvel aparece um quadro adicional no fluxo da página, sem cobrir os botões.

Se uma conferência estiver rodando, NÃO recarregue o painel. O script começa nas próximas navegações; faça a ativação no painel depois que o lote acabar. O console do Firebase pode ficar aberto em outra aba. Se o Chrome exigir permissão para executar userscripts, habilite pela interface oficial do Tampermonkey/Chrome; não reduza as proteções do site.

## Como funciona e o que NÃO faz

- A cada 15 segundos, examina apenas os elementos DOM específicos do seletor de período e da métrica Leituras. Também reage à chegada de um agregado de outra aba.
- Não faz requisições HTTP, usa APIs do Google, recarrega páginas, abre abas ou clica nos gráficos. Não consulta documentos, usa SDK Firebase, lê cookies, senhas, armazenamento do site, tokens ou credenciais.
- Não submete formulários nem grava no Firestore. O total não é publicado no GitHub ou no site: só passa pelo armazenamento privado deste userscript, no mesmo perfil do navegador.
- Salva somente o último total, dia da cota, horário em que observou a tela e indicador de arredondamento; mais uma preferência de pausa. Não mantém histórico nem copia texto bruto do console.
- O modo em nuvem continua desativado. IAM, regras, App Check, plano e cobrança não são alterados. O robô de preços e os cadastros permanecem intactos.

## Precisão e atualização

- O console pode mostrar “43 mil” em vez do número exato. Nesse caso o tanque mostra **≈ 43.000**; o saldo também é estimado. Não confunda com auditoria exata da cota ou faturamento.
- O horário informado é **hora da leitura da tela**, não o horário de atualização das métricas do Google. Não há garantia de atualização em tempo real.
- Um total inalterado não recebe um horário novo a cada varredura. Após 45 minutos, o script o sinaliza como antigo. No console, **Ler esta tela agora** apenas relê o DOM, sem fazer consulta ou forçar atualização no Google.
- Um total menor no mesmo dia não sobrescreve o anterior. Se o Google corrigir a métrica para baixo, pause o script e confira manualmente.
- O dia da cota é o do Pacífico, inclusive na mudança de horário de verão. Uma aba ainda exibindo o dia anterior não vira uma leitura de hoje. Falha, tela desconhecida e “Sem dados” nunca são tratados como zero.
- O seletor foi conferido no console em português em 23/10/2026. Também suporta rótulo de cota em inglês. Se o Google mudar o formato, o script interrompe a leitura e preserva o último valor.

## Limites práticos

O computador e o Chrome precisam estar ligados, com as abas conectadas. Abas suspensas, login expirado ou métricas que o console não atualiza fazem a leitura envelhecer. Este script não transforma o navegador em monitoramento 24 horas e não resolve o 403 da API.

Ler o DOM não acrescenta consultas ao banco nem ativa cobrança. O próprio console e o site mantêm seu uso normal já existente. Deixe aberta apenas a tela **Uso**, não uma lista de documentos. Não há promessa de custo zero para atividades externas ao script.

## Pausar ou remover

Use **Pausar tanque local** no quadro para interromper a coleta/atualização em todas as abas do mesmo perfil. Para remover definitivamente, desinstale SOMENTE **Ranking da Compra — Tanque Firebase local** no Tampermonkey. Não remova o robô de preços. Após encerrar qualquer lote, recarregar o painel restaura a apresentação original.

## Verificação

Testes locais: `node --test scripts/test-tanque-firebase-local.mjs`.
Foram verificadas a leitura do DOM observado, validação de cota, arredondamento, rejeição de dados inválidos, comunicação simulada entre abas, expiração, ausência de rede/credenciais e integridade do robô de preços. A instalação e o funcionamento real entre abas do Chrome ainda precisam ser confirmados após o usuário instalar o script. Nenhum total foi alterado no painel durante a preparação.

Referência: https://www.tampermonkey.net/documentation.php?locale=en
