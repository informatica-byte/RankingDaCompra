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
