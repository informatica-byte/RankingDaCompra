# Formatos revisados no comparador — 20/10/2026

O comparador público e o gerador dos guias passam a usar o campo **Formato** da ficha revisada antes das heurísticas do título. Só são aceitos campos com origem HTTPS identificada como fabricante ou anúncio do Mercado Livre; dados genéricos extraídos do título não ganham esse tratamento.

- Os seis formatos conhecidos que antes ficavam sem seleção passam aos grupos correspondentes: MINISO X15Pro, PRO PHONE SEE Bluetooth 5.4, genérico compatível JBL 760, HAVIT TW982, Lenovo LP40 e KAPBOM/Scorpion.
- Um formato revisado desconhecido, contraditório ou com mais de um encaixe possível não pode ser substituído por palavras do título. FORESTORY X5 e Basike Ear Clip deixam o grupo open-ear e ficam na consulta individual.
- A mesma precaução vale para os demais formatos revisados ainda não confirmados, incluindo o encaixe do Mageon. Seus cadastros e análises continuam disponíveis.
- A fonte continua sendo do fabricante ou do anúncio conforme cada campo; classificar o formato não autentica o produto, não mede qualidade e não altera a data do preço.
- Modelos repetidos por cor continuam bloqueados. In-ear, open-ear, on-ear e over-ear não se tornam equivalentes.
- O gerador acrescenta os campos somente a cópias dos objetos para apresentação. Nenhum preço, cadastro, foto ou link de afiliado é gravado ou substituído por esta alteração.

Regressão: `scripts/test-reviewed-comparison-formats.mjs`, além dos testes de integridade existentes. O teste cobre paridade das 22 fichas entre catálogo público e guias gerados, preservação dos registros, fontes inválidas, formatos ambíguos e equivalência entre grupos.
