# Revisão de campos pendentes — segunda etapa, 20/10/2026

## Completado em documentação do modelo exato

- **HAVIT TW982 / LIFE 01T** (`kYzXt8BeErDzXsC6BlwB`): [página oficial do modelo, não Pro](https://havitsmart.com/es/products/havit-life-01t-true-wireless-stereo-earbuds-tw982). As informações estão em imagens, lidas visualmente no navegador. A [apresentação com ponteiras](https://cdn.shopify.com/s/files/1/0755/1365/9703/files/01T-_TW982_-page_-_-2024.05_13.jpg?v=1788255515) documenta o formato; a [tabela técnica oficial](https://cdn.shopify.com/s/files/1/0755/1365/9703/files/01T-_TW982_-page_-_-2024.05_14.jpg?v=1788255515) informa Bluetooth 5.4, 7,5 h nos fones e 33 h com estojo, a 60% do volume, USB-C e cerca de 1,5 h de carga do estojo. São números anunciados, não medidos. ANC continua a confirmar: ENC não comprova ANC. Não foram usados os dados do TW982 Pro ou manuais agregados com números conflitantes.
- **MERCUSYS MR80X V4** (`AweCTxq7vwVQ7VmN4IIg`): a [página brasileira da revisão V4](https://www.mercusys.com.br/product/wifi-router/mr80x/v4/) anuncia EasyMesh. O texto mantém as ressalvas da própria fabricante sobre firmware, compatibilidade entre fornecedores e ausência de certificação Wi-Fi EasyMesh. Compatibilidade anunciada não comprova o firmware instalado na unidade nem cobertura real.
- **Lenovo LOQ 15IRX9 / 83KH0001BR** (`SJRf3jhIFlr1BQadDNnH`): o responsável enviou o SKU durante a revisão. A [loja oficial da Lenovo](https://www.lenovo.com/br/pt/p/laptops/loq-laptops/88lq3001926/83kh0001br), aberta no navegador, confirmou 8 GB DDR5-4800 SODIMM, SSD de 512 GB PCIe Gen4 TLC, Core i5-13450HX, RTX 3050 para laptop com 6 GB GDDR6, Windows 11 Home e tela FHD de 144 Hz. A memória de vídeo não foi somada à RAM. O preço da loja do fabricante não foi copiado para o site. A ficha só se aplica à configuração identificada; não é teste de desempenho.

## Correção de leitura, não nova comprovação externa

A tabela não reconhecia “8 GB de memória RAM”, embora o texto do próprio cadastro
fosse explícito. O extrator agora aceita essa redação e continua rotulando a origem
como **cadastro**, não fabricante, nestas fichas:

- Dell DC15-I51334U-A50 (`7evzZBujin11TlbT8hvm`);
- Acer Aspire Go 15 (`h0a3vchlbGQbAnHdbujA`);
- Acer Aspire 5 A515-45-R2A3 (`TEaC0vVXmdvp4s8QMqpn`).

Não foi confirmada a configuração de fábrica desses três notebooks nesta etapa.
Capacidade máxima/expansível, memória de vídeo, dicas de compra e números
contraditórios continuam sem virar RAM instalada. O Lenovo LOQ pôde ser completado
em fonte oficial após o envio do SKU, sem usar a ficha de outra configuração.

## O que permanece em revisão

Galaxy Buds Core: fontes oficiais consultadas informam totais com estojo, não uma
sessão contínua; não copiamos duração do Buds FE. JBL Quantum 100M2: microfone
direcional e conexão com fio não comprovam presença ou ausência de ANC. TL-WR840N:
Mesh depende da revisão exata, ausente no cadastro. AX2S e ASUS mantêm suas
divergências oficiais já registradas. Nos fones genéricos sem código de modelo,
não foram inventados formato, microfone, ANC ou autonomia.

Sem exclusões, gravações no Firestore, troca de produto, atualização de preço ou
alteração de links. As correções são editoriais e de leitura das tabelas publicadas.
