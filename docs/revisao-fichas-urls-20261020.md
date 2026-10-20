# Revisão editorial e continuidade de URLs — 20/10/2026

Sem exclusão/restauração de cadastros, alteração de preços, provas de conferência,
links de afiliado ou controles do Firebase. O gerador aplica as correções editoriais
à publicação. Os campos originais privados continuam preservados.

## Fontes e limites

- ASUS E1504FA-NJ1288: responsável informou o SKU e 16 GB/512 GB. A [página individual ASUS](https://br.store.asus.com/notebook-asus-vivobook-go-15-e1504fa-nj1288-mixed-black-nivel-ips.html) confirma essas capacidades e KeepOS, mas informa Ryzen 5 40. Um [conjunto oficial com o mesmo SKU](https://br.store.asus.com/notebook-asus-vivobook-go-15-e1504fa-nj1288-mixed-black-notebook-asus-x515ka-br309ws-slate-grey.html) informa Ryzen 5 7520U. RAM/SSD completados; CPU/GPU não resolvidas por suposição. Título público neutro com SKU, sem escolher um dos processadores.
- [Amazfit Bip 6](https://br.amazfit.com/products/amazfit-bip-6): GPS, chamadas Bluetooth com celular, tela e 5 ATM documentados. Não se converte ATM em código IP. Alexa retirada do título por falta de confirmação; não se afirma impossibilidade do recurso. Sensores não são diagnóstico.
- [HUAWEI WATCH FIT 5](https://consumer.huawei.com/ma/wearables/watch-fit5/specs/): ficha internacional do modelo não Pro. Corrigida a tela para 1,82 polegada; GPS, IP6X para poeira e 5 ATM separados. Alegação de 64 GB retirada do título, sem atribuir outra capacidade. Recursos regionais/variante continuam a confirmar.

Fontes consultadas em 20/10/2026. São especificações anunciadas, não teste prático,
autenticação de unidade ou conferência nova de preço. Revisões dos demais modelos
mantêm suas datas anteriores. Fones genéricos, notebooks sem SKU e divergências
oficiais continuam com ressalvas; nenhuma lacuna foi completada por semelhança.

## Quatro URLs antigas comprovadamente do mesmo produto

Evidência: HTML histórico recuperado no Git, título e mesmo código do anúncio na
URL completa do cadastro atual. Não basta semelhança de nome. `product-url-aliases.json`
exige também anúncio e palavras do modelo no destino a cada geração; se o cadastro
for reutilizado, retirado ou mudar de anúncio, o alias deixa de ser gerado.

| Arquivo antigo em `produto/` | Cadastro público atual | Mesmo anúncio | Revisão histórica consultada |
| --- | --- | --- | --- |
| PIogVXjZBCR03LoHIPLE-20260810-1.html | VzQgxGhowdzlfNshI3ZC | MLB6756757832 | 31d3b09835ff476ef0d7982401da056ebfb52ce7^ |
| L9Vdxx2fNGSSaTR0d7Iu-20260810-1.html | CFEyN1hdeMSM6BS89h5o | MLB3817089255 | 47cdceaf0d2f8d272947aa0f2b40eebfaa7c5fd9^ |
| eLIzAkv4GxeN7eIPOKEx-20260810-1.html | Th1cm6hi9QYlLqUWQKgq | MLB3371578831 | 5a5ebfdc56557687c02e17342f8d17e43383d22d^ |
| aNbistjKOWFkFjMw9PYJ-20260810-1.html | Th1cm6hi9QYlLqUWQKgq | MLB3371578831 | 83f0ce53727763d6e6999e313603e89e448bcb37^ |

São aliases HTML com canônica para a análise correta, `noindex,follow` e sem preço
antigo, não redirecionamentos HTTP 301. Eles não entram no sitemap. Os outros 16
endereços 404 revisados não têm equivalência comprovada e continuam 404: não são
redirecionados à página inicial, a categorias ou a produtos diferentes.
