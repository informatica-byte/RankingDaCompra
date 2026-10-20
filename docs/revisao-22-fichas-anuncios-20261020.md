# Revisão das outras 22 fichas — 20/10/2026

O responsável autorizou completar as fichas com informações disponíveis nas
ofertas do Mercado Livre, sem exigir códigos que o anúncio não fornece. Os 22
anúncios vinculados foram lidos individualmente no navegador, nas características
e na descrição. Não foi iniciado lote de preços ou gravação no Firestore.

## Resultado preparado

- 25 dos 60 campos inicialmente pendentes puderam ser preenchidos como dados do
  anúncio. 35 campos dessa lista continuam ausentes ou contraditórios. Outras
  inconsistências encontradas durante a leitura também foram sinalizadas.
- 17 resumos, prós e contras foram reescritos. As outras cinco fichas preservaram
  o resumo anterior e receberam revisão por campo e identificação do anúncio.
- O modelo BA-FON240B aparece nas duas ofertas Basike; os cadastros e links
  continuam separados. M145, FON-13025F e KA-790/KA790D são identificações
  informadas nos anúncios, não confirmação independente de fabricante.
- O anúncio do WATCH FIT 5 informa armazenamento de 64 GB. A origem é vendedor;
  não copiamos esse número como RAM nem alteramos o título ou a identidade.
- Ausência de cancelamento de ruído está explicitamente informada nas tabelas
  de Quantum 100M2, FORESTORY X5, Dapon H02D, Mageon e KAPBOM/Scorpion. Esses
  campos têm fonte do anúncio, não da fabricante. ENC e redução de ruído de
  chamadas, isoladamente, continuam sem comprovar ANC para ouvir.
- MINISO X15Pro, FORESTORY X5, os dois Basike, INOVA e Dapon têm números de
  bateria contraditórios. Não foi escolhido o maior número; duração em espera,
  capacidade em mAh, duração por carga e total com estojo não são equivalentes.
- O texto do IIKOSMAX M145 mistura referências a outra marca. Não transferimos
  Bluetooth, encaixe ou autonomia daquele trecho ao M145.
- O genérico compatível JBL 760 não recebeu a ficha de um JBL Tune 760NC.
- TL-WR840N não fornece revisão ou comprovação de Mesh. AX2S diverge entre três
  e quatro portas no próprio anúncio. Bip 6 informa 5 ATM, não um código IP.

## Implementação e preservação

`scripts/marketplace-field-reviews.mjs` registra os fatos e pendências com
proteção por ID, nome/modelo, catálogo e anúncio selecionado quando disponível.
Os dados de vendedor usam `basis: cadastro` e `sourceKind: marketplace-listing`.
Fatos de fabricante já documentados mantêm suas fontes e datas separadas; não
se atribui o novo resumo comercial à fonte do fabricante.

As seções são regeneráveis e não se acumulam. Testes cobrem a preservação de
títulos, preços, datas de conferência, links, imagens, identificação e cadastros.
Não há troca de produto, redirecionamento, exclusão ou alteração de permissões.
