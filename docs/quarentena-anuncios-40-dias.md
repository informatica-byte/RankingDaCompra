# Quarentena opcional de anúncios — 40 dias

Implementação de 27/10/2026 no dashboard e painel móvel, sem migração automática de cadastros antigos, alteração de preços/links, novo cron, nova API, cobrança, regras ou permissões. O userscript de links continua 2.5.2; não precisa reinstalar o robô.

## Uso

1. Carregar a fila de links normalmente. Nos anúncios lidos como indisponíveis, usar **Colocar em quarentena por 40 dias**.
2. Conferir o produto e confirmar expressamente a futura exclusão do cadastro **e do histórico**, digitando `QUARENTENA 40 ID`. A entrada apenas pausa o cadastro e salva sua política e data; não exclui nada.
3. Usar o filtro **Quarentena — prazo de 40 dias** para ver a data limite e os dias restantes. **Cancelar quarentena**, **Reativar para conferir** ou substituir os links pelo fluxo atual cancela a autorização anterior. Uma pausa manual anterior é preservada quando aplicável.
4. Manter “Incluir cadastros pausados” na conferência para revisar também a quarentena. O anúncio voltando com prova recente do mesmo MLB sai da quarentena. Não basta uma página de catálogo sem identificação do anúncio, um redirecionamento ou outro vendedor.
5. Após o prazo de 40 × 24 horas, uma leitura NOVA, recente e vinculada ao mesmo MLB, ainda indisponível, permite exclusão transacional do cadastro e registro apenas do ID para limpeza pública. CAPTCHA, login, erro, versão antiga, resultado vencido, catálogo sem MLB, código diferente, links/foto/título alterados, conflito de sessão, cancelamento ou parada da conferência bloqueiam a exclusão.

## Limites e publicação

Não existe checagem autônoma com o computador desligado. O prazo fica salvo no cadastro entre sessões, mas a decisão final só é executada durante uma conferência iniciada pelo administrador, com o painel aberto e logado. Se não houver prova segura ao vencer, mantém o produto, não presume que deixou de existir. Não apaga por simples passagem do tempo. Resultados já confirmados normalmente não são repetidos; uma leitura anterior ao vencimento não serve de confirmação final depois dele.

A entrada e a exclusão vencida conferem o horário pelo cabeçalho HTTP Date de uma requisição HEAD ao próprio arquivo estático no site, sem acessar o Firebase. Falta de data, falha de rede ou divergência maior que cinco minutos em relação ao aparelho bloqueiam a operação; o horário confirmado precisa alcançar o vencimento antes de excluir. Não se confia apenas em avançar a data local do computador. As estatísticas históricas de acesso e ações já registradas não são recalculadas ou apagadas.

Pausar ou restaurar a oferta é refletido na vitrine após a publicação completa habitual. A exclusão usa `exclusoes-definitivas`, o mesmo mecanismo existente: na próxima publicação completa são removidos páginas, entradas do sitemap, busca, referências, imagens próprias não compartilhadas e histórico de preços do produto. Não são apagados backups do usuário, histórico Git nem caches/cópias de terceiros. Mantém-se um registro técnico só com IDs para impedir restauração automática por dados antigos; não se promete apagar todo vestígio externo.

Não coloca nenhum produto em quarentena sozinho. Não muda os critérios do robô normal de disponibilidade; apenas a autorização destrutiva da quarentena exige prova adicional de que é o mesmo anúncio. Não pede token nem segredo. Aproveita a carga existente de produtos, sem consulta ou gravação por item comum; transações pontuais são realizadas apenas nas ações autorizadas de quarentena, no retorno seguro ou na exclusão vencida. Não altera o serviço de publicação, que continua com acesso de leitura ao Firestore e sua janela diária existente.

## Verificação

`scripts/test-product-quarantine.mjs` testa consentimento, prazo, cancelamento, retorno, indisponibilidade final, concorrência, parada, identificação e preservação de preços. `scripts/qa-product-quarantine.mjs` testa os dois painéis em 360 px com dados exclusivamente fictícios, incluindo cancelamento do diálogo, entrada, filtro, 39 dias, CAPTCHA após 40 dias, retomada e exclusão, além do retorno disponível. `scripts/qa-affiliate-link-audit.mjs` preserva os testes de cursor, CAPTCHA, limites, relatórios e não repetição. Não executar testes destrutivos em cadastros reais para verificar o botão.
