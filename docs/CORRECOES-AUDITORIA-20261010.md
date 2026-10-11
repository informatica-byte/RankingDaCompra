# Correções da auditoria de 10/10/2026

## Dados preservados

Nenhum cadastro, preço, link afiliado, foto, prova/data de conferência ou histórico é excluído ou reconfirmado automaticamente. A correção editorial altera somente a apresentação pública; o cadastro mestre no Firestore permanece disponível para revisão.

## Comparativos e evidências

`scripts/published-editorial.mjs` recupera os pontos positivos e limitações da própria análise visível. A descoberta não depende de uma nota numérica nem da presença de `Review` no JSON-LD para conservar esses textos. Não cria avaliações, testes ou notas inexistentes. Os filtros de qualidade e comparabilidade continuam aplicados.

Avisos de que AX1500 não garante velocidade, ou de que Mesh não garante cobertura, não negam a presença anunciada de Wi-Fi 6/Mesh. Ausência explícita e informação conflitante continuam impedindo o bônus.

Correções por ID e modelo consertam o início de “Tapete”, limpam o título contaminado do HUAWEI AX2S e retiram a medida inconsistente e a promessa de alcance não comprovada da lanterna Sabre de Luz. Não são inseridos novos valores técnicos.

## Localizador do Mercado Livre

O resumo distingue pedidos processados, efetivamente resolvidos, falhas da execução e pedidos com tentativas esgotadas no histórico. Resultados são preservados/publicados antes de sinalizar falha no workflow. Três tentativas continuam sendo o limite; não há novas consultas nem repetição ilimitada por este reparo. Falha de autorização externa não é declarada resolvida por um job que apenas terminou.

## Melhores escolhas nos dois painéis

Referências ausentes no catálogo disponível aparecem com aviso e impedem novo salvamento inconsistente. O administrador pode retirar somente o destaque, sem excluir o produto ou seu histórico; cadastros ainda não publicados podem ser carregados no painel antes de decidir. Não apagar automaticamente IDs ausentes de um snapshot. A configuração privada existente não é alterada por este reparo.

## App Check: monitoramento, sem novos bloqueios

Código da home, dashboard, painel móvel, métricas e Estúdio inspecionado: SDK 12.10.0 e provider Enterprise já presentes antes dos usos do Firestore/AI. Não foram alterados regras, registro, enforcement, reCAPTCHA ou faturamento.

Capturas fornecidas pelo proprietário: AI Logic 149/149 verificadas no período de sete dias; Firestore aproximadamente 70% verificadas, 29% clientes sem token e 1% origem desconhecida. São solicitações agregadas, não leituras faturáveis. Não permitem atribuir a origem exata do tráfego sem token nem provar que ele continua no código atual. O passo externo pendente é analisar o período mais recente por serviço no console, sem enforcement; não ativar novos bloqueios com base no agregado de sete dias. Tráfego de versões antigas, integrações e consultas externas precisa ser distinguido de clientes atuais antes de qualquer mudança.

## Validação

Executar `node --test scripts/test-*.mjs`, `node scripts/validate-blueprint.mjs`, `node scripts/validate-site.mjs` e `node scripts/audit-site-integrity.mjs`. A regeneração deste reparo reutiliza páginas e snapshots publicados, sem consultar o Firestore. Antes do merge/push de publicação, mostrar a lista exata dos arquivos alterados e comparar os campos operacionais do catálogo com a versão base.
