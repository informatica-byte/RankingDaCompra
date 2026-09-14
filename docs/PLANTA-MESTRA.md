# Planta-mestra do Ranking da Compra

> Documento de arquitetura, continuidade e reconstrução do sistema.
> Fonte oficial: `informatica-byte/RankingDaCompra`, branch `main`.
> Domínio público: <https://rankingdacompra.com.br/>.
> Data da fotografia técnica: 14/09/2026.

## 1. Para que serve esta planta

Este documento permite que uma pessoa ou outra IA compreenda, mantenha e reconstrua o Ranking da Compra sem depender do histórico de uma conversa. Ele descreve a estrutura pública, os painéis, os dados, as automações, as integrações e os controles de segurança.

O repositório é a fonte de verdade do código. Antes de qualquer reparo, sempre baixar a versão mais recente da branch `main`. Nunca substituir silenciosamente arquivos locais que tenham alterações não publicadas: primeiro mostrar a diferença e preservar uma cópia.

O repositório sozinho **não é um backup completo**. Firestore, Firebase Authentication, regras e índices do Firebase, App Check/reCAPTCHA, segredos do GitHub, DNS, domínio, Google Analytics e Search Console vivem fora dele. A seção 13 explica como preservar esses componentes.

## 2. Resumo do produto

O Ranking da Compra é um portal brasileiro de descoberta, análise e comparação de produtos com monetização por links de afiliados. A experiência pública combina:

- vitrine de promoções do dia e ofertas relâmpago;
- Top 6 semanal;
- comparativo editorial semanal de cinco produtos, com aprovação humana;
- páginas individuais de produto com preço, histórico, prós, contras e dados técnicos;
- guias `melhores-*` por categoria;
- busca estática rápida;
- duas opções de compra no mesmo cadastro: Mercado Livre e, quando informado, Shopee;
- compartilhamento, canal de ofertas no WhatsApp, temas sazonais e o mascote Ranki;
- administração pelo painel completo e pelo painel de celular.

O site é estático na hospedagem, mas lê e grava dados operacionais no Firebase. O GitHub Actions transforma os dados do Firestore em páginas HTML, índices e arquivos JSON para reduzir leituras do Firebase, melhorar velocidade, compartilhamento e indexação.

## 3. Arquitetura geral

```text
Administrador
  |-- dashboard.html ----------- Firebase Auth / Firestore / Firebase AI
  |-- painel-celular.html ------ Firebase Auth / Firestore / Firebase AI
  |                                  |
  |                                  +-- produtos, categorias, configurações,
  |                                      visitas e mlbSolicitacoes
  |
  +-- GitHub Actions (ações manuais e agendadas)
       |-- resolve links Mercado Livre
       |-- confere preços/disponibilidade em lote
       |-- gera páginas, comparativos, busca, Top 6 e sitemap
       |-- registra histórico de preços
       +-- avisa IndexNow
                    |
                    v
GitHub branch main -- GitHub Pages -- rankingdacompra.com.br
                    |
                    +-- Google/Bing/Yahoo, Analytics e Search Console
                    +-- visitante -> clique afiliado Mercado Livre/Shopee
```

Princípio central: o Firestore mantém o cadastro e os eventos operacionais; arquivos gerados mantêm a leitura pública econômica e indexável.

## 4. Tecnologias e dependências

| Camada | Tecnologia |
|---|---|
| Interface | HTML, CSS e JavaScript sem framework de build |
| Hospedagem | GitHub Pages com domínio próprio |
| Banco e login | Firebase Authentication + Cloud Firestore |
| Proteção | Firebase App Check com reCAPTCHA Enterprise |
| IA | Firebase AI Logic com modelos Gemini definidos nos painéis |
| Automação | GitHub Actions em Ubuntu + Node.js 24 |
| Mercado Livre | API oficial, OAuth e fallback controlado de resolução de links |
| Busca pública | `search-index.json`, sem consulta ao Firestore por pesquisa |
| Métricas | Google Analytics `G-NBKRX8TTR6` e coleção Firestore `visitas` |
| Indexação | sitemap, canônicos, dados estruturados, Search Console e IndexNow |

Não há etapa de compilação. Os arquivos HTML e JavaScript da raiz são servidos diretamente.

## 5. Mapa de rotas e telas

| Rota/arquivo | Público | Responsabilidade |
|---|---:|---|
| `/` (`index.html`) | sim | Vitrine, busca, promoções, Top 6, ranking semanal e navegação por categorias |
| `/analises.html` | sim | Diretório estático de todas as análises publicadas |
| `/produto/{id}-20260810-1.html` | sim | Página social/SEO gerada para um produto |
| `/melhores-*.html` | sim | Comparativos gerados por categoria |
| `/como-avaliamos.html` | sim | Metodologia, pesos e limites editoriais |
| `/sobre.html` | sim | Identidade e proposta do portal |
| `/politica-afiliados.html` | sim | Transparência sobre monetização |
| `/privacidade.html` | sim | Privacidade e tratamento de dados |
| `/contato.html` | sim | Canal de contato |
| `/404.html` | sim | Recuperação de URL inexistente; `noindex,follow` |
| `/dashboard.html` | não | Painel administrativo completo, protegido por login |
| `/painel-celular.html` | não | Publicação e revisão simplificadas para celular |
| `/oauth-mercadolivre.html` | não | Retorno OAuth do Mercado Livre |
| `/bot-precos.user.js` | não | Robô Tampermonkey auxiliar de conferência |
| `/radar.html` | legado | Interface do radar sob demanda; não é fluxo prioritário |

`robots.txt` bloqueia dashboard, OAuth e o userscript. Páginas públicas usam endereço canônico HTTPS no domínio oficial.

## 6. Inventário dos arquivos essenciais

### Núcleo público

- `index.html`: aplicação pública principal e integração de todos os módulos.
- `growth-tools.js`: temas, Ranki, WhatsApp, funil, histórico e ranking comparativo.
- `seo-priorities.js`: categorias e intenções de compra prioritárias.
- `seo-opportunities.js`: leitura e análise local dos CSVs do Search Console.
- `search-index.json`: índice público econômico.
- `top5-semanal.json`: Top 6; o nome é legado e deve ser mantido por compatibilidade.
- `historico-precos.json`: histórico consolidado por identidade do anúncio.
- `mercadolivre-status.json`: último lote de preço e disponibilidade.
- `site-config.json`: configuração pública do Clube de Ofertas.
- `sitemap.xml`, `robots.txt`, `CNAME`: descoberta, rastreamento e domínio.

### Administração

- `dashboard.html`: CRUD, categorias, promoções, preços, SEO, campanhas, temas e ranking.
- `painel-celular.html`: criação assistida, revisão, aprovação e publicação móvel.
- `oauth-mercadolivre.html`: autorização da API.
- `mlb-localizador.js`: cliente do localizador assíncrono.
- `mlb-resolucoes.json`: respostas do robô para o painel.
- `.mercadolivre-token.enc`: estado OAuth criptografado; nunca documentar seu conteúdo.

### Conteúdo gerado

- `produto/*.html`: uma página por documento público do Firestore.
- `produto/imagens/*`: imagens sociais dos produtos.
- `melhores-*.html`: guias comparativos de categoria.
- `analises.html`: catálogo consolidado.
- `assets/ranki/*.png`: roupas do mascote para campanhas sazonais.

### Geradores e verificadores

- `scripts/generate-sitemap.mjs`: lê produtos, gera sitemap e páginas sociais.
- `scripts/generate-discovery.mjs`: gera análises, comparativos, busca e Top 6.
- `scripts/product-title-corrections.mjs`: corrige títulos conhecidos sem alterar cadastro.
- `scripts/sync-mercadolivre.mjs`: lote único de preço e disponibilidade.
- `scripts/resolve-affiliate-links.mjs`: resolve pedidos da fila MLB.
- `scripts/update-price-history.mjs`: histórico de 30 dias e páginas relacionadas.
- `scripts/submit-indexnow.mjs`: notificação aos buscadores compatíveis.
- `scripts/validate-site.mjs`: bloqueio preventivo de regressões.
- `scripts/validate-blueprint.mjs`: valida esta planta e seu manifesto.
- `scripts/test-*.mjs`: testes focados nas automações sensíveis.

O manifesto `docs/planta-mestra.json` contém a mesma estrutura em formato legível por máquinas.

## 7. Modelo de dados

### Firestore: `produtos`

Cada documento normal representa um produto. O identificador do documento também forma a URL da página gerada. Campos principais:

```text
categoria, titulo, link, linkAfiliado, marketplace,
mercadoLivreItemId, linkShopee, precoShopee,
preco, precoAnterior, precoPromocional, promocaoAtiva,
promocaoValidaAte, ofertaRelampagoAtiva, ofertaRelampagoTerminaEm,
selo, foto, comentario, nota, ranking,
pros[], contras[], dadosTecnicos[], autor,
atualizadoEm, dataCadastro
```

Campos operacionais podem registrar a origem, a evidência da IA, a conferência manual, disponibilidade e datas das verificações. O documento especial `produtos/.site-theme` armazena o tema visual e deve ser excluído de consultas de mercadoria.

Invariantes:

- nunca trocar o ID de produto sem redirecionamento e migração do histórico;
- preço precisa ser número positivo ou aparecer como “a confirmar”, nunca `NaN`;
- o link Mercado Livre é a fonte primária; Shopee é uma opção adicional no mesmo cadastro;
- o link Shopee não duplica imagem, descrição ou documento;
- conteúdo público deve ter fatos técnicos verificáveis e não prometer venda ou popularidade sem evidência;
- produto indisponível somente é ocultado após confirmações previstas, nunca por uma falha isolada.

### Firestore: `categorias`

Documento com ID igual ao slug. Campos: `nome`, `icone`, `imagem`, `criadoEm`. Uma categoria não deve ser apagada enquanto houver produtos ligados a ela.

### Firestore: `visitas`

Eventos do funil: visualização de seção/produto, clique de oferta e compartilhamento. Os eventos alimentam a Central de Foco e ajudam a sugerir o tema do comparativo semanal. Cliques não podem ser apresentados como vendas.

### Firestore: `mlbSolicitacoes`

Fila econômica entre o painel móvel e o robô localizador. O robô lê primeiro os dez pedidos mais recentes, filtra os pendentes e o celular só reutiliza um pedido recente por até dois minutos.

### Firestore: `configuracoes`

- `configuracoes/site`: Clube de Ofertas/WhatsApp e configurações públicas relacionadas.
- `configuracoes/ranking-semanal`: rascunho, auditoria, aprovação e publicação do comparativo de cinco produtos.

### Arquivos JSON derivados

- `top5-semanal.json`: exige exatamente seis produtos válidos e distintos.
- `historico-precos.json`: `version`, `days`, `updatedAt`, `products`; cada produto tem identidade e pontos `[data, preço]`.
- `mercadolivre-status.json`: estado, disponibilidade, preço e horário do último lote.
- `mlb-resolucoes.json`: resultado da resolução do anúncio e conteúdo preparado.
- `search-index.json`: título, resumo, categoria, imagem, preço, nota, ranking e URL.

Esses arquivos são cache público/resultado de automação; o cadastro mestre continua no Firestore.

## 8. Recursos e regras funcionais

### Vitrine e descoberta

- mostra o conteúdo útil antes de aguardar serviços externos;
- oferece busca por intenção, produto e categoria usando arquivo estático;
- mantém seis itens no Top 6, preenchendo de forma segura quando necessário;
- separa promoção do dia, oferta relâmpago e comparativo editorial;
- redireciona slugs antigos para guias atuais para evitar duplicidade e soft 404.

### Ranking comparativo semanal

- contém exatamente cinco produtos comparáveis da mesma intenção/faixa;
- mostra logo no início: melhor geral, melhor custo-benefício e mais barato;
- pode destacar mais procurado no site, sem confundir clique com venda;
- pontuação base: custo-benefício 35%, avaliação informada 30%, interesse observado 15% e qualidade das evidências 20%;
- uma IA prepara/revisa o texto, mas não altera silenciosamente a ordem calculada;
- exige revisão humana e botão “Publicar após aprovação”;
- explica por que cada item ocupa sua posição, seus pontos positivos e para quem não é indicado;
- textos longos ficam em “Mais informações” para preservar uma leitura simples.

### Conteúdo editorial

- resumo/comentário precisa ter pelo menos 180 caracteres no fluxo completo;
- prós e contras precisam ser específicos e úteis, não frases genéricas;
- dados técnicos precisam conter pelo menos três fatos reais;
- o painel móvel aceita a revisão técnica alinhada ao seu validador, mas o gerador final aplica as regras públicas completas;
- preço, frete e estoque são apresentados como sujeitos a mudança no marketplace.

### Temas e mascote

Há modo automático e manual. Os temas cobrem Ano-Novo, volta às aulas, Carnaval, Dia do Consumidor, Páscoa, Dia das Mães, Dia dos Namorados, festa junina, Dia dos Pais, Dia das Crianças, Black Friday e Natal. A roupa do Ranki acompanha o tema. Animações respeitam `prefers-reduced-motion`.

### Economia do Firebase

- a busca e a maior parte da leitura pública usam arquivos JSON estáticos;
- a Central de Foco só faz leitura ampla após ação manual;
- preço e disponibilidade são conferidos em um único lote diário/manual, nunca produto a produto ao abrir o painel;
- o lote grava resultado consolidado e evita repetir o mesmo dia, salvo `force` explícito;
- eventos de visita têm limite local para evitar gravações repetidas;
- qualquer nova função pública deve preferir arquivos gerados antes de criar uma consulta Firestore.

## 9. Fluxos operacionais

### Publicar um novo produto

1. Administrador cola o link completo do Mercado Livre e o link afiliado.
2. Painel tenta obter dados pela IA com contexto de URL.
3. Se o marketplace bloquear, cria pedido econômico em `mlbSolicitacoes`.
4. `localizar-mlb.yml` resolve o pedido e grava `mlb-resolucoes.json`.
5. Administrador revisa categoria, preço, fatos, prós, contras, imagem e links.
6. Painel grava o documento no Firestore.
7. `update-sitemap.yml`, manualmente ou pelo gatilho, gera HTML, busca, sitemap, análises, comparativos e Top 6.
8. O validador precisa passar antes do commit automático.
9. GitHub Pages publica a branch `main`.

### Conferir preços e disponibilidade

1. Após terminar as novas publicações, executar manualmente o workflow “Atualizar preços e disponibilidade”.
2. O script faz um único lote, usa a API do Mercado Livre e reaproveita um retrato dos produtos.
3. O lote do mesmo dia é ignorado, salvo uso consciente de `force`.
4. Gera `mercadolivre-status.json`, páginas e índices atualizados.
5. Falha temporária não apaga preços nem produtos existentes.

O horário de 09:30 é uma preferência operacional da interface/robô. A automação de sincronização no GitHub está deliberadamente manual no estado atual; não confundir com o cron de histórico às 09:35 UTC.

### Gerar e indexar

1. `generate-sitemap.mjs` gera páginas e sitemap.
2. `generate-discovery.mjs` gera diretório, busca e comparativos.
3. `product-title-corrections.mjs` aplica correções controladas.
4. `validate-site.mjs` impede regressões.
5. `submit-indexnow.mjs` avisa Bing, Yahoo e compatíveis.
6. Google descobre pelo sitemap/Search Console; indexação não é instantânea nem garantida.

## 10. Automações do GitHub

| Workflow | Disparo | Resultado |
|---|---|---|
| `update-sitemap.yml` | push seletivo, manual e 10:17/13:17/16:17/19:17 Brasília | páginas, análises, busca, Top 6, sitemap e IndexNow |
| `localizar-mlb.yml` | manual e minutos 07/22/37/52 | resolve fila MLB e publica respostas |
| `sync-mercadolivre.yml` | manual | lote único de preço/disponibilidade |
| `historico-precos.yml` | manual e 09:35 UTC | registra histórico e atualiza páginas |

Todos usam o grupo de concorrência `rankingdacompra-publicacao` para evitar publicações simultâneas. Os commits automáticos sempre fazem rebase antes do push.

## 11. Integrações e segredos

### Segredos obrigatórios no GitHub

```text
MERCADO_LIVRE_ACCESS_TOKEN
MERCADO_LIVRE_CLIENT_ID
MERCADO_LIVRE_CLIENT_SECRET
MERCADO_LIVRE_TOKEN_KEY
MERCADO_LIVRE_AUTHORIZATION_CODE   # só na autorização inicial/renovação necessária
```

Nunca colocar os valores na planta, em issues, logs, HTML ou commit. `MERCADO_LIVRE_TOKEN_KEY` precisa ser guardada também em cofre externo; sem ela o estado OAuth criptografado não pode ser recuperado.

### Serviços externos a registrar separadamente

- projeto Firebase `rankingdacompra` e seus proprietários;
- provedor de login, usuários administradores, regras e índices do Firestore;
- App Check/reCAPTCHA Enterprise e domínios permitidos;
- aplicação Mercado Livre e URI `https://rankingdacompra.com.br/oauth-mercadolivre.html`;
- repositório GitHub, GitHub Pages e segredos;
- registrador do domínio e configuração DNS;
- Google Analytics, Search Console e verificação;
- canal do WhatsApp e contas de afiliado Mercado Livre/Shopee.

## 12. Segurança e privacidade

- exigir Firebase Authentication nos painéis e regras restritivas para escrita;
- manter App Check ativo para reduzir abuso do Firebase e da IA;
- considerar toda entrada de produto, CSV, URL e resposta de robô como não confiável;
- escapar conteúdo antes de inserir em HTML e validar protocolos de links;
- links afiliados devem usar `rel="sponsored noopener noreferrer"` quando aplicável;
- não publicar tokens, senhas, cookies, contas administrativas ou chaves privadas;
- a configuração pública do Firebase não substitui regras seguras do Firestore;
- preservar páginas institucionais, transparência de afiliados e limites editoriais;
- nunca remover dados por falha temporária de rede ou bloqueio do marketplace.

## 13. Plano de backup que permite reconstrução real

Guardar em local seguro, com pelo menos duas cópias independentes:

1. Espelho Git atualizado de `main`, incluindo todo o histórico.
2. Exportação periódica das coleções Firestore: `produtos`, `categorias`, `visitas`, `mlbSolicitacoes` e `configuracoes`.
3. Cópia das regras e índices do Firestore. Eles não estão versionados no repositório atual; esta é uma lacuna crítica a corrigir quando houver acesso ao Console/Firebase CLI.
4. Lista dos administradores e método de recuperação do Firebase Authentication. Não exportar senhas.
5. Cópia segura dos nomes e valores dos segredos do GitHub em gerenciador de senhas.
6. Dados da aplicação Mercado Livre, URI OAuth e chave usada para criptografia do token.
7. Acesso ao domínio, DNS e configuração do GitHub Pages.
8. Acesso às propriedades do Search Console e Analytics.
9. Logotipo, mascote, imagens sazonais e permissões/licenças das mídias.
10. Exportação dos relatórios importantes da Sara IA, separada do código do site.

Periodicidade sugerida: Git diário, Firestore semanal, conferência de credenciais mensal e teste de restauração trimestral.

## 14. Reconstrução do zero

1. Criar ou recuperar o repositório e restaurar a branch `main`.
2. Conferir que `CNAME` contém `rankingdacompra.com.br` e ativar GitHub Pages pela branch.
3. Criar/recuperar o projeto Firebase e atualizar as configurações públicas somente se o projeto mudar.
4. Restaurar Firestore, regras, índices, Authentication e App Check.
5. Recriar a aplicação Mercado Livre e cadastrar a URI OAuth exata.
6. Cadastrar todos os segredos no GitHub Actions.
7. Restaurar DNS, Search Console e Analytics.
8. Executar os comandos de validação da seção 15.
9. Executar manualmente “Atualizar mapa do site automaticamente”.
10. Testar como visitante, administrador e celular.
11. Executar um lote de preços sem `force` e conferir o relatório antes de liberar.

Se outro domínio for usado, localizar e atualizar todas as ocorrências de `https://rankingdacompra.com.br/`, os canônicos, sitemap, robots, CNAME, OAuth, Search Console, Analytics, App Check e DNS. Não fazer troca parcial.

## 15. Validação e critérios de aceite

Executar na raiz do repositório:

```powershell
node scripts/test-seo-opportunities.mjs
node --test scripts/test-sync-mercadolivre.mjs
node --test scripts/test-daily-price-batch.mjs
node scripts/validate-blueprint.mjs
node scripts/validate-site.mjs
```

Para regenerar antes da validação:

```powershell
node scripts/generate-sitemap.mjs
$env:DISCOVERY_USE_GENERATED='true'; node scripts/generate-discovery.mjs
node scripts/product-title-corrections.mjs
```

Aceite mínimo:

- nenhum validador falha;
- Top 6 possui seis IDs distintos, imagem, preço e link seguro;
- ranking comparativo possui cinco itens aprovados e justificativas reais;
- nenhuma página mostra `NaN`, texto corrompido ou dados genéricos;
- sitemap, páginas no disco, catálogo de análises e busca concordam;
- dashboard e painel móvel exigem login e não carregam todos os produtos sem ação;
- lote de preços é único, manual e preserva dados em falhas;
- página inicial, busca, compra, Shopee, compartilhamento e WhatsApp funcionam no celular;
- canônicos, dados estruturados, OG/Twitter, 404 e robots continuam corretos.

## 16. Procedimento obrigatório para qualquer IA

Entregar a uma IA este documento e `docs/planta-mestra.json` junto do repositório. Usar a seguinte instrução:

> Trabalhe no Ranking da Compra usando a branch `main` mais recente do repositório oficial como fonte de verdade. Leia integralmente `docs/PLANTA-MESTRA.md` e `docs/planta-mestra.json` antes de alterar. Preserve dados e configurações existentes, não exponha segredos e não confunda arquivos gerados com a origem no Firestore. Faça backup/diff antes de resolver conflitos. Atualize a planta quando mudar arquitetura, páginas, campos, integrações, workflows, segredos ou critérios. Execute todos os validadores antes de publicar e mostre exatamente os arquivos alterados, testes e resultado da publicação.

Regra para a Sara IA: toda alteração futura deve ser aprendida a partir do commit publicado no GitHub, nunca de uma cópia local antiga. A Sara deve comparar a planta com o código, incluir divergências no relatório e jamais publicar correção não validada.

## 17. Limites desta fotografia

Na data desta planta, o repositório continha 403 páginas de produto, 403 imagens sociais e 23 guias comparativos. Esses números mudam com o catálogo e não são invariantes. O validador deve calcular os totais atuais.

As regras e índices do Firestore, a lista de usuários, os valores dos segredos, o DNS e as configurações de consoles externos não podem ser inferidos com segurança pelo código. Eles precisam ser exportados/documentados pelo proprietário sem colocar credenciais no Git.
