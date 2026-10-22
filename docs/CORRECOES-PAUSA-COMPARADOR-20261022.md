# Pausa pública e apresentação do comparador — 22/10/2026

Diagnóstico confirmado com cópia local exportada do dashboard, sem nova conferência no vendedor: os seis preços antigos do snapshot pertenciam a cadastros com `conferenciaPausada: true`. Valores e datas eram idênticos aos do painel. A diferença era de elegibilidade pública, não atraso de salvamento nem necessidade de repetir conferências.

- O gerador exclui pausados das ofertas, busca, sitemap e Top 6. O registro no Firestore e os arquivos de imagem são preservados.
- A URL existente mostra “Anúncio em pausa”, sem preço ou compra, sem redirecionamento a outro produto e sem afirmar que o vendedor excluiu o anúncio. Reativar no painel e publicar novamente recupera a página pelo mesmo ID.
- Destaques e compatibilidade da vitrine também recusam a flag explícita de pausa. O dashboard mostra a contagem de pausados separada da fila diária.
- O comparador alinha apenas os rótulos documentados “Proteção contra água” e “Proteção anunciada”. IPX4/IP54, qualificadores, fontes e valores originais permanecem distintos. Duas características sobrepostas no mesmo registro não são fundidas.
- A edição permite retirar um link secundário da Shopee sem apagar seu preço histórico. Criar nova oferta continua exigindo URL e preço. Sem URL, a loja não é oferecida ao visitante.

Nenhum teste ou gerador escreve preços no banco. Nenhum lote de conferência, CAPTCHA, mudança de App Check ou regras de segurança faz parte desta correção.
