# Auditoria técnica — 07/11/2026

## Escopo e evidências

- Auditoria estática: 843 HTMLs, 11.107 referências internas, 579 scripts inline, 616 blocos JSON-LD e 5 módulos. Zero erros e zero avisos no auditor existente.
- Inspeção dos metadados das 621 URLs do sitemap: nenhuma descrição ausente ou com valor monetário; quatro pares de títulos repetidos e um par de descrições repetidas encontrados.
- Correção: apenas metadados HTML das oito fichas envolvidas, usando referência de anúncio quando identificável e ID de página como contingência. Não presume variantes, não muda H1, não une registros, não muda canônico.
- O gerador agora aplica essa diferenciação automaticamente em páginas públicas com títulos iguais. Ignora redirecionamentos e páginas noindex. Teste de regressão protege idempotência, conteúdo e afiliados.
- 1.575 testes automatizados aprovados. Validador geral: 568 produtos e 621 URLs.
- QA local de interface em 360/390/768/1366 px: vitrine ampliada, Top 6, 31 comparativos, 14 vídeos, fichas, música durante navegação e recuperação de HTTP 503 aprovados.
- Dashboard e painel móvel: teste isolado do formulário sem preços; retomada do robô após CAPTCHA e recarga, cancelamento e respostas tardias, sem repetir confirmados, aprovados em fixtures.
- Quarentena: confirmação, prazo e retorno aprovados nos dois painéis em fixtures. Nenhum cadastro real foi modificado ou removido.
- Catálogos, índice de busca, histórico de preços, sitemap e validações comparados ao Git sem alteração. Metadados não modificam os links de afiliados.

## Limites

Não é uma certificação de segurança, teste de invasão, auditoria de permissões de contas ou de regras efetivas em produção. Não houve login administrativo, teste de gravação real, leituras Firestore, chamadas a APIs de métricas ou tentativa de contornar CAPTCHA.

Não reconfirma estoque ou conteúdo atual dos vendedores, precisão de especificações, licenciamento ou autenticidade. As oito últimas fichas mantêm os limites da atribuição ao vendedor. As revisões editoriais anteriores não foram refeitas.

Não mede vendas, comissões, posicionamento Google ou desempenho de rede em celular físico. A verificação pública após a publicação abrange páginas/recursos representativos e as oito fichas com metadados corrigidos; não equivale a 843 testes reais de navegação.

## Ponto de retomada

Não repetir as triagens dos produtos inalterados. Trabalhos globais restantes dependem de escopo e evidência próprios; este relatório não declara todas as melhorias futuras concluídas. A agenda de continuidade e a revisão SEO separada são preservadas.

Publicação: preparada; atualizar abaixo somente após evidência pública.
