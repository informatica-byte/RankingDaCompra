# Vitrine informativa permanente — 27/10/2026

## Resultado

A página inicial mostra o Top 6 editorial antes do diretório de guias, mais quatro seleções de três artigos: fones TWS, notebooks, roteadores e câmeras. São 18 produtos distintos no retrato desta publicação. Seis dos 14 vídeos válidos ficam expostos e os demais continuam expansíveis; todos os 31 guias continuam acessíveis. Nenhum cadastro, valor histórico, afiliado ou robô foi alterado.

## Publicação e busca

`node scripts/build-informational-home.mjs` gera os módulos no HTML e acrescenta listas estruturadas não ordenadas, sem notas, ofertas ou preços. O workflow `update-sitemap.yml` já chama esse comando depois da projeção informativa. A página inicial permanece na mesma URL canônica; sua revisão no sitemap é 2026-10-27. Não foram criadas páginas fictícias ou URLs para âncoras. As análises e os guias referenciados já fazem parte do sitemap.

O gerador exige arquivo local indexável e URL existente no sitemap para cada destino. Se falhar, a página anterior não é sobrescrita. IDs de seleção exigem também categoria, modelo e, quando disponível, família confirmada. Produtos ausentes ou que não correspondam mais ao modelo não recebem substitutos aleatórios. Cores não são usadas como modelos adicionais. A lista é editorial, não ranking de vendas nem prova de teste independente. Indexação e posição no Google não são garantidas.

## Manutenção

As seleções adicionais ficam em `informational-home.js` e não precisam de consultas ao Firestore. A origem continua sendo o catálogo informativo estático, sem novas consultas de disponibilidade. Não restaurar módulos de preços, contagem regressiva ou vencedores artificiais apenas para preencher espaço.

Na seleção deste trabalho, o cadastro `mlMLB5212483469` não foi promovido: o título identifica IdeaPad Slim 3 e o resumo menciona ThinkPad X13 recondicionado. Essa inconsistência merece revisão separada; não foi corrigida nem publicada silenciosamente durante esta mudança de apresentação.

## Verificação

Testes unitários cobrem imutabilidade, identidade dos modelos, deduplicação visual, links locais, ausência de preços, geração idempotente, JSON-LD e preservação da versão anterior em caso de destino inválido. O QA isolado testa HTML sem JavaScript, 360/390/768/1366 px, fotos locais, busca, comparador, música e vídeos sob clique, bloqueando Firebase, métricas e lojas externas.
