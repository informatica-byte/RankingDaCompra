# Auditoria integral — 09/10/2026

## Cobertura e evidências

- CI desta etapa: 280 testes aprovados (zero falhas), 497 URLs de sitemap, 446 produtos públicos.
- Integridade offline: 712 HTML, 9.303 referências locais, 455 scripts inline e 476 JSON-LD.
- Workflow online 37974157361: 1.209 páginas/recursos consultados, nenhuma falha HTTP/canônico. URL inexistente retorna 404.
- Painéis autenticados: métricas sincronizadas na mesma base, 474 conferidos e 7 pausados; corrigidos pendentes do dashboard e data civil da semana. Formulário de substituição aberto e cancelado sem gravar.
- Busca por JBL, comparador com dois roteadores, página de produto (imagem carregada, data e links de lojas) e guia infantil verificados na UI.
- Plano Firebase continua Spark. Registro App Check confirmado na aba Apps após autorização. APIs: Cloud Firestore e Authentication não aplicados; AI Logic básico aplicado pelo estado do console. Nenhum enforcement foi ativado manualmente. Consulta autenticada na conta proprietária: Firestore, no período de sete dias exibido, 64% verificado, 35% clientes desatualizados e 1% origem desconhecida; nenhum pedido inválido no resumo. AI Logic: 100% verificado. Firestore e Authentication continuam sem aplicação de bloqueio; não ativar enforcement enquanto houver clientes sem verificação.
- Consulta oficial Mercado Livre continua HTTP 403, conforme diagnóstico pontual já enviado ao suporte WCS-51776; não repetido lote nem alterados preços.

## Correções editoriais nesta etapa

- Estúdio passa a usar a identidade Firebase padrão, compartilhando a sessão dos painéis em vez de exigir login separado. App Check permanece antes da IA.
- Guia infantil exclui Grand Theft Auto/GTA e produtos descritos como adultos; ESRB: https://www.esrb.org/ratings/41627/grand-theft-auto-vi/ (Mature 17+). Categoria do vendedor não comprova adequação infantil.
- Bônus de preço recente ou nota não torna produto sem relação elegível à ocasião.
- Cama elástica com diâmetro contraditório e PS5 com controles não comprovados recebem texto de limites, sem inventar medidas ou acessórios; identidade, preço, datas, links e fonte original no cadastro ficam preservados.
- Guia explica registros históricos sem chamá-los de preços atuais.
- Publicação lista os arquivos gerados alterados antes do push, após validadores.

## Limites

Auditoria técnica não comprova todos os preços remotos, estoque, autenticidade, especificações ou resultados de SEO. Revisão editorial integral precisa de evidências por modelo; produtos sem ficha suficiente não devem receber alegações de teste. Não houve compras, exclusões ou cadastros fictícios. Login/edição/pausa reais exigem dados válidos; regressões testam persistência em ambiente simulado, sem alterar produção. Registro, estado de aplicação e métricas do App Check confirmados com acesso funcional ao console. A auditoria técnica não equivale a recuperação integral das contas externas ou revisão editorial de todos os anúncios.

## Complemento de conferência no navegador

- Domínio com www abre a vitrine e redireciona para a versão canônica sem www; não alterado DNS.
- Search Console acessível, relatório de indexação com atualização em 03/10: 31 exemplos de 404 e 7 soft 404 (categorias antigas). Validação de soft 404 já iniciada em 07/10; não reiniciada. Entre os 31 caminhos, 14 existem na versão atual (páginas ativas, aliases ou aviso de análise não disponível); os 17 ausentes não têm referência local quebrada segundo auditoria de integridade. Não se recriam produtos eliminados nem se redireciona tudo indiscriminadamente para a home.
- Guia de fones anunciava 17 enquanto comparava 16 produtos com preço: título passa a contar apenas os efetivamente comparados. Produto sem preço não entra no ranking por menor preço.
- Destaque automático “melhor geral” passa a “maior pontuação da seleção”: a posição matemática por dados cadastrados não comprova superioridade em teste real. Selo de custo-benefício conserva a exigência existente de evidências específicas.
- Roteiro do Estúdio não corta fatos com reticências; utiliza frases completas curtas ou orientação neutra. Nome longo fica completo no título visual e vira “este produto” na fala. Não há gravação de cadastro, alteração de preços ou envio ao YouTube nesses testes de regressão.
