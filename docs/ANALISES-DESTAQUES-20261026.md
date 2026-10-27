# Aprofundamento dos destaques — 26/10/2026

Foram aprofundados os sete produtos da seleção configurada: conversor U Maisu,
Smart Band 9 Active, Redmi Buds 6 Play, JBL Tune 520BT, ASUS E1504FA-NJ1288,
Logitech M170 e WAP WL 1800 220 V.

Cada texto contém perfil de uso, interpretação editorial, vantagens, limitações,
verificações antes de comprar, quando comparar outra opção e dúvidas específicas.
São 34 perguntas revisadas, sem FAQ genérica duplicada nesses sete produtos.

As fontes de conteúdo ficam em `featured-analysis.json`. O renderizador é
`scripts/visibility-editorial.mjs`; ele exige identidade do modelo e da URL antes
de inserir o conteúdo. A geração normal reaplica as análises, sem escrever nos
cadastros. O catálogo, os valores históricos e os links de afiliado não são
alterados por esse trabalho. Não foram feitos testes físicos ou medições.

## Limitações explicitadas

- Conversor: não obtivemos manual específico nem nova leitura automática do
  anúncio. Alcance de 20 km, conjunto fornecido, fibra, conectores e compatibilidade
  com Starlink não se tornam confirmados pela redação.
- ASUS: a configuração anterior vem do anúncio registrado. A página oficial
  atual usa Ryzen 5 40 para NJ1288, enquanto a ficha do anúncio informa Ryzen 5
  7520U. Não substituímos a configuração nem extrapolamos dados da família.
  Pedimos confirmação da unidade/Part Number e mantemos a diferença visível.
- Autonomia, proteção e conexão são informações anunciadas, com limites de uso;
  não constituem medição de desempenho ou garantia da equipe.
- Recursos de bem-estar da pulseira não são apresentados como diagnóstico.

As fontes Xiaomi, JBL, Logitech, ASUS e WAP estão vinculadas junto ao texto.
Uma fonte oficial não implica que todos os dados de uma oferta de terceiros
tenham sido validados pelo fabricante. Revisão do texto não renova estoque,
autenticidade, garantia ou data da consulta ao anúncio.

## Testes

Os testes novos verificam cobertura dos destaques, identidade, escape de HTML,
fontes autorizadas, links preservados, idempotência, ausência de preço e de FAQ
duplicada. O teste visual local cobre os sete textos no celular, a expansão das
perguntas, o comparador e a navegação com música, sem visitar afiliados externos,
gravar produtos ou enviar eventos para Analytics.
