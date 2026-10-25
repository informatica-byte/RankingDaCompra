# Reparos da auditoria — 25/10/2026

## Alterações implementadas

- Mínimo do robô 2.4.14, igual à versão publicada. Respostas 2.4.4, 2.4.6 e 2.4.13 são recusadas antes da gravação. Os painéis usam uma URL nova do validador para evitar cache antigo e orientam preservar ou salvar campos antes de uma recarga voluntária. Nenhuma aba é recarregada por esta publicação; filas e datas de conferência não são reiniciadas.
- CSP em meta na home, dashboard, painel móvel, Estúdio e callback OAuth: object-src 'none'; base-uri 'self'; form-action 'self'. Não modifica script-src ou connect-src, nem domínios do Firebase/reCAPTCHA, links ou valores. Referrer meta strict-origin-when-cross-origin. É uma melhoria parcial, não substitui cabeçalhos HTTP da hospedagem.
- Testes reais de autorização em tests/firestore-rules, com dependências fixadas por lockfile, Java 21 e projeto demo-ranking-audit. O script recusa qualquer endpoint diferente de 127.0.0.1:8089 antes da inicialização. O workflow possui somente contents:read, sem segredos de produção ou OIDC.
- Atualização da planta: versões do SDK e critérios atuais de produto/modelo e preço total, sem prioridade de cor/tamanho/voltagem.

## Verificações antes da publicação

900 testes de regressão passaram. Seis testes de integração passaram no emulador local: conteúdo público, administração exige UID e email, eventos válidos/malformados, leitura/alteração de métricas, fila e negação de coleções desconhecidas. O emulador foi desligado ao terminar; nenhuma regra foi implantada em produção.

Backup atual exportado pelo botão do painel em 25/10 às 19h34 BRT: 595 produtos, 27 categorias e dois documentos de configuração. Simulação de recuperação comparou todos os campos, preços e links; a segunda execução criou zero documentos e preservou os 624 existentes na simulação. Escritas em produção: zero. SHA-256 da cópia: bc3ef1478e3417f7b4053d04f97975475d65aed86f4471983fef3305220d1c07.

A cópia bruta permanece em Downloads e em pasta privada da tarefa, fora do repositório. Não publicar o JSON privado. O recibo de validação contém somente contagens, hash, abrangência e resultado. Não inclui Authentication, segredos, contas externas, visitas ou fila MLB. Essa validação não equivale a uma restauração em banco independente do Firebase.

Revisão independente confirmou hashes idênticos dos oito arquivos de catálogo/configuração/histórico/status protegidos e href idênticos nas cinco páginas alteradas, contra as cópias anteriores. A publicação não executa geradores do catálogo ou conferência de preços.

## Limites que permanecem

- Frequência de eventos públicos: sem um mecanismo confiável no servidor, um limite no JavaScript não é uma proteção contra abuso. Não foi adicionada uma falsa limitação nem aplicado bloqueio novo que interrompa clientes legítimos. Requer desenho e teste de ingestão protegida compatível com o plano atual; não criar Functions/Blaze ou desativar métricas silenciosamente.
- HSTS, X-Content-Type-Options e frame-ancestors precisam ser entregues pela hospedagem/proxy. Uma meta com frame-ancestors não resolveria o problema. Não foi alterado DNS, provedor ou cobrança. Essa etapa exige acesso e teste da camada de entrega e não deve ser declarada resolvida por este patch.
- Não houve reescrita ampla dos painéis durante a operação. Modularização futura deve ser incremental.
- Os 401 históricos do App Check continuam sem causa comprovada; os registros foram ativados em etapa anterior e três avaliações recentes tinham token reCAPTCHA válido. Não alterar proteções para mascarar o erro.

Fontes: [testes oficiais de regras](https://firebase.google.com/docs/rules/unit-tests). O projeto demo e o endpoint local são obrigatórios.
