# Reparação do localizador — 11/10/2026

As execuções 811–815 conseguiram ler a fila e publicar os resultados. Foram sinalizadas como falha porque parte dos anúncios não trouxe os dados obrigatórios. Na 815, dois pedidos apontavam para o mesmo carrinho. Os 133 pedidos esgotados pertencem ao histórico; não são produtos excluídos.

## Alterações

- Diagnóstico por pedido: etapa e HTTP observados, tempo limite/rede/formato inválido, campos obrigatórios ausentes e indício de verificação humana. Mensagens aparecem no motivo existente dos painéis e na tabela do Actions.
- Uma consulta por URL equivalente dentro da execução, reaproveitando sucesso ou falha entre pedidos repetidos. Em URLs de produto com código explícito, apenas parâmetros conhecidos de rastreamento são ignorados; variantes, vendedor, cupom e parâmetros desconhecidos não são misturados. Links curtos e indicações/listas são reaproveitados apenas quando a URL completa coincide.
- IDs, links originais, tentativas individuais e resultados antigos preservados. Sem apagar/recriar pedidos nem falsificar sucesso. Preço precisa ser finito e positivo, imagem deve continuar passando na validação existente.
- Testes específicos no workflow antes do localizador. Continua sinalizando erro depois de preservar os resultados.

## Limites

O reparo não concede permissões do Mercado Livre, não resolve CAPTCHA e não garante dados indisponíveis na origem. HTTP 401/403/404 só será indicado quando realmente observado pela consulta. Falhas antigas não recebem diagnóstico retroativo inventado. Solicitações esgotadas não são reiniciadas em massa.

Nenhuma nova consulta ao Firebase foi adicionada; continuam no máximo duas leituras limitadas da fila por execução. O reparo não grava produtos, preços ou configurações no Firestore e não altera App Check ou faturamento.

## Validar antes de publicar

`node --test scripts/test-*.mjs`, `node scripts/test-seo-opportunities.mjs`, `node scripts/validate-blueprint.mjs`, `node scripts/validate-site.mjs` e auditoria de integridade offline. Testes da reparação simulam respostas, sem consultar o Firebase ou o Mercado Livre.
