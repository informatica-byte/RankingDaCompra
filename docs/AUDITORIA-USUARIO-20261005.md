# Auditoria com olhos do comprador — 05/10/2026

Fonte de trabalho: repositório oficial informatica-byte/RankingDaCompra, branch main, commit a07dbbf1e92c001cfc33a2ba197272a023746cd8. Cópia isolada; nenhuma alteração em cadastros administrativos durante os testes.

## Concluído nesta revisão

1. Histórico: o artigo usa a identidade do produto da URL, não o primeiro link de um produto relacionado. No JBL Tune 520BT, o mínimo registrado correto era R$ 232,65, não R$ 60,90 de outro fone. Pontos do histórico não foram alterados.
2. Controles de histórico ficam fora de links clicáveis; o atributo data-price-history-product permite auditar a associação.
3. Entrada do site prioriza orçamento, categorias e comparativos. Patinete não é mais o único destino principal. Título da home é diferente do hub permanente.
4. Busca fechada fica fora da navegação por teclado; Escape a fecha. Atalho para conteúdo e foco visível adicionados. Em celular, as ações secundárias continuam disponíveis e Ranki não cobre os selos.
5. Banner sazonal e convite ao WhatsApp ficam após o conteúdo. Atalho flutuante pode ser ocultado nesta visita, sem desligar o recurso ou alterar configuração do administrador.
6. Os painéis incluem novos produtos já carregados na seleção de melhores escolhas, mesmo antes da próxima publicação do snapshot. Nenhuma consulta extra à coleção.
7. JBL Tune 520BT: removida alegação incorreta de ANC. Formato on-ear, Bluetooth 5.3 e autonomia anunciada são separados de resultados medidos. Inclusão de fontes oficiais.
8. HUAWEI MatePad SE 11: removidas especificações da versão de 11,5 polegadas/120 Hz; tela, resolução e carregamento corrigidos com a ficha oficial.
9. Metodologia distingue categorias, ranking semanal e seleções editoriais. Não promete revisão por duas IAs em todas as páginas, nem superioridade sobre todo o mercado.
10. Rotas públicas antigas de produto/categoria encaminham para conteúdo publicado, sem abrir o fluxo antigo que consulta Firestore. Quando há alias de SEO, a categoria vai diretamente ao comparativo; o restante usa a seção do diretório.
11. Correções de fabricante persistem no gerador, catálogo público, resumos e dados estruturados. Alteração desse módulo dispara a reconstrução; frequência diária permanece igual.

## Verificações

- 167 testes automatizados aprovados, zero falhas.
- validate-site.mjs e validate-blueprint.mjs aprovados: 494 URLs e 442 produtos públicos.
- Varredura offline: 6.863 links internos verificáveis, 472 blocos JSON-LD e 1.330 scripts inline. Sem arquivos-alvo ausentes, JSON-LD inválido, erros de sintaxe inline, H1 ausente/duplicado ou IDs HTML duplicados no conjunto verificado.
- Teste visual em celular (390×844) e layout desktop (1280×800): navegação, comparação, filtro JBL/orçamento de R$ 300, rotas antigas, Escape, ocultar WhatsApp e histórico do JBL.
- Conferências, preços, vídeos, IDs, links de afiliado, temas e campos de configuração preservados. Sem ativar cobrança, enforcement de App Check ou serviços pagos.
- Auditoria, testes e geração local usam snapshots publicados. O workflow normal de publicação mantém suas leituras existentes para obter o catálogo atual; não há aumento de frequência.

## Limites e prioridades editoriais ainda abertas

Não é um certificado de “100% correto” nem uma garantia de posição, indexação, tráfego ou vendas. Testes aprovados não comprovam todas as especificações de todos os 442 anúncios.

- Há dois cadastros com o título Liquidificador Turbo Power Mondial 550W - L-99 FB: Bf3ccSwSiVkLw1Z8k2Hu e SnMMDq9bDXiMWX0IXYdO. Confirmar se representam o mesmo anúncio, variante ou vendedor antes de unir páginas/canônicos. Nenhum cadastro foi excluído.
- 230 títulos ultrapassam 80 caracteres. Isso é sinal de revisão, não erro automático de SEO: o Google não estabelece esse limite rígido. Não cortar títulos cegamente, pois pode remover modelo/variante e repetir o problema antigo.
- Prioridade contínua: enriquecer as análises mais visitadas com critérios práticos e fontes oficiais; validar preços/descontos extraordinários e variações sem presumir que conferência manual está errada.
- Search Console atualizado, indexação real, Core Web Vitals de campo e satisfação dos compradores não foram medidos nesta revisão. Precisam de dados atuais, não de uma nota inventada.
- Login, regras/índices efetivamente implantados, cotas, permissões da API Mercado Livre e configuração externa dos consoles não são certificados apenas por testes locais. Não foram modificados. Nenhum teste administrativo salvou dados em produção.

## Arquivos de implementação a publicar

Lista exata deste commit de implementação (22 arquivos). HTML/JSON derivados da geração local não serão sobrepostos manualmente no repositório; o workflow reconstrói usando o catálogo atual, preservando cadastros posteriores.

- .github/workflows/update-sitemap.yml
- index.html
- dashboard.html
- painel-celular.html
- growth-tools.js
- buyer-tools.js
- comparar.html
- best-choices.js
- best-choices-admin.js
- como-avaliamos.html
- scripts/generate-best-choices.mjs
- scripts/generate-discovery.mjs
- scripts/generate-sitemap.mjs
- scripts/product-title-corrections.mjs
- scripts/test-five-improvements.mjs
- scripts/test-firebase-audit-repairs.mjs
- scripts/test-daily-price-batch.mjs
- scripts/test-user-audit.mjs
- scripts/validate-site.mjs
- docs/PLANTA-MESTRA.md
- docs/planta-mestra.json
- docs/AUDITORIA-USUARIO-20261005.md

## Referências

- [Google: comparativos úteis](https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews)
- [Google: títulos claros](https://developers.google.com/search/docs/appearance/title-link)
- [JBL: Tune 520BT sem ANC](https://www.jbl.com.br/blog/comparativo-jbl-tune-530bt-e-520bt.html)
- [HUAWEI: ficha MatePad SE 11](https://consumer.huawei.com/br/tablets/matepad-se-11/specs/)

Modelo recomendado para este tipo de auditoria: GPT-6.1 Sol, raciocínio Extra alto. O nível ajuda na revisão interligada; não substitui evidência, testes ou medição real.

