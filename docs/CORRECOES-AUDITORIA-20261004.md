# Correções da auditoria — 04/10/2026

Base oficial: `informatica-byte/RankingDaCompra`, `main`, `9cb6fe1d7b61aba0f997a7dc5584579c6dd8ab54`. Cadastros, preços e configurações administrativas não são apagados por estes reparos.

## Cinco frentes

1. **Publicação de preços:** cada salvamento da conferência assistida recebe `precoConferenciaId`. A sessão usa a mesma revisão do catálogo para comparar, sem exigir igualdade entre o relógio local e o servidor. Sessões sem marcador transitório continuam usando a data canônica; revisão anterior, preço diferente, data futura ou antiga não geram confirmação falsa. O marcador `_rdcPendingConfirmationId` nunca é publicado.
2. **Central SEO:** apenas Consultas/Páginas são aceitas como oportunidades. Data, dispositivos, países e aspecto da pesquisa são recusados. Relatórios legados de outra dimensão permanecem no aparelho, mas não produzem recomendações: reimportar Consultas.csv ou Páginas.csv. Data da fonte e período ficam visíveis.
3. **Títulos das ofertas:** configuração manual é preservada, mas categoria, Bluetooth e teto conhecidos são conferidos contra a seleção. Seleção incompatível recebe título neutro publicamente. A prévia/sugestão usa as seis promoções exibidas, excluindo relâmpagos e ordenando desconto. Não promete volume de buscas nem posição no Google.
4. **Recuperação de backup:** valida todos os valores antes de gravar e cria somente documentos ausentes com precondição atômica. Erro de permissão/conexão não é confundido com ID existente. Nenhuma recuperação é executada em produção nesta correção.
5. **Dependências e segurança:** configuração pública sanitizada publicada junto do catálogo; Radar usa catálogo estático; regras versionadas, planta reconciliada e sincronização da Sara deve usar a trava compartilhada e avanço rápido, sem reset.

## Configuração e custo do Firebase

`scripts/public-site-config.mjs` publica somente campos de apresentação e pares de links de vídeos. Preserve título escolhido, links, false explícito, tema e títulos dos guias. Uma falha ao ler configuração bloqueia a publicação; não substitui silenciosamente por padrões. `.site-theme` reaproveita a leitura do lote. A versão `schemaVersion:2` elimina as duas leituras de configuração por visitante; o painel conserva prévia e salvamento. Versões antigas mantêm compatibilidade até a primeira geração completa.

Depois de salvar título, vídeos, clube ou tema, usar **Criar páginas agora / Atualizar vitrine** uma vez. Verificar implantação, sem solicitar nova conferência dos preços já salvos. O arquivo público não é um backup de todos os dados administrativos. Continuação do plano **Spark**, sem faturamento e sem geração paga.

## Proteção gradual

`docs/firebase/firestore-baseline-20261004.rules` preserva a regra lida no Console, publicada em 30/08. `firestore.rules` mantém os mesmos contratos e acrescenta o UID da conta administrativa existente à checagem de e-mail. Não cria novos administradores, não requer e-mail verificado retroativamente e não amplia acesso. Validar com o motor de regras antes de publicar; registrar implantação separadamente do código GitHub.

App Check de Firestore/Authentication continua em monitoramento: a auditoria encontrou muitos clientes ainda não verificados. Não ativar enforcement em bloco; testar vitrine, ambos painéis, métricas e os jobs REST antes de uma migração. A fila MLB mantém leitura pública para não interromper o localizador; migrar autenticação do robô antes de restringi-la. Isso é uma restrição operacional conhecida, não uma proteção já implantada.

`docs/firebase/indices-20261004.json` é um registro documental, não um manifesto de exclusão. Não publicar índices vazios nem aplicar regras por `--only firestore` indiscriminadamente. A hospedagem continua no GitHub Pages.

## Sara e continuidade

Sincronizar o checkout `C:/Users/User/AppData/Local/SaraIA/projects/RankingDaCompra` sob `repository_sync_lock` da Sara instalada, checando remoto oficial, main e ausência de alterações. Executar somente `pull --ff-only`; alterações locais ou divergência exigem preservação e revisão. A documentação registra o medidor manual gratuito, localizador duas vezes/hora e módulos públicos atuais. A cópia do dashboard não inclui Authentication, métricas, segredos ou DNS.

## Verificação

Antes de publicar: `node --test scripts/test-*.mjs`, `node scripts/validate-site.mjs`, revisão de diferenças e lista exata dos arquivos. O workflow de geração executa a suite inteira, valida e inclui `site-config.json` no commit. Conferir depois o arquivo gerado, a implantação Pages e a vitrine; não afirmar 100% do site ou indexação garantida.
