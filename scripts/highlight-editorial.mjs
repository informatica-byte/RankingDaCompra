// Model-guarded review, 19/10/2026. No prices, affiliate links or test scores.
// Manufacturer specifications are announced values, not measured performance.
export const HIGHLIGHT_EDITORIAL = new Map([
  ['48oRcQNlH00KgNLHkvsG', {
    model: /Xiaomi.*Smart Band 9 Active/i,
    summary: 'A Xiaomi Smart Band 9 Active é uma pulseira para acompanhar atividades e consultar registros pelo aplicativo Mi Fitness. A Xiaomi informa tela TFT de 1,47 polegada, 50 modos de exercício e até 18 dias de uso típico, conforme suas condições de teste. Pode ser considerada para acompanhamento cotidiano, não para diagnóstico: frequência cardíaca, SpO2 e sono são referências de bem-estar. Não medimos precisão, conforto ou autonomia real. Confira compatibilidade do celular e os limites de uso na água no manual.',
    positiveNotes: ['Tela de 1,47 polegada para consultar os registros na pulseira, segundo a Xiaomi.', '50 modos de exercício e conexão com o Mi Fitness anunciados para acompanhar atividades.'],
    negativeNotes: ['Os sensores não substituem aparelhos médicos nem comprovam diagnóstico.', 'Até 18 dias é uma estimativa do fabricante; uso e recursos ligados alteram a autonomia.'],
    sourceUrl: 'https://www.mi.com/global/product/xiaomi-smart-band-9-active/specs/', sourceLabel: 'Xiaomi Smart Band 9 Active — especificações oficiais', reviewedAt: '2026-10-19', suppressRating: true,
  }],
  ['ARscPKCMZs3D8k22qltl', {
    model: /Redmi.*Buds\s*6\s*Play/i,
    summary: 'O Xiaomi Redmi Buds 6 Play M2420E1 é um fone TWS intra-auricular com estojo USB-C e Bluetooth 5.4 informados pela Xiaomi. A fabricante anuncia até 7,5 horas no fone e até 36 horas com recargas no estojo, em suas condições de teste. A FAQ oficial esclarece que não há ANC para ouvir; a redução de ruído anunciada atua nas chamadas pelo microfone. IPX4 aplica-se apenas aos fones, não ao estojo, não comprova proteção contra poeira e não autoriza banho ou imersão. Não testamos conforto, áudio ou chamadas; a autonomia real depende do uso.',
    positiveNotes: ['Fones TWS com estojo USB-C para guardar e recarregar entre usos.', 'Autonomia anunciada pela Xiaomi de até 7,5 horas no fone.', 'Autonomia anunciada pela Xiaomi de até 36 horas com recargas no estojo.'],
    negativeNotes: ['Encaixe intra-auricular: conforto individual não foi testado.', 'As 36 horas incluem recargas no estojo; não são duração contínua. Autonomia real e chamadas não foram testadas.'],
    sourceUrl: 'https://www.mi.com/global/product/redmi-buds-6-play/', specUrl: 'https://www.mi.com/global/product/redmi-buds-6-play/specs/', sourceLabel: 'Xiaomi Redmi Buds 6 Play M2420E1', reviewedAt: '2026-10-19', suppressRating: true,
  }],
  ['GjHJtzdsIhbmSINvhPeX', {
    model: /JBL.*Tune\s*520\s*BT/i,
    summary: 'O JBL Tune 520BT é um fone on-ear Bluetooth 5.3, apoiado sobre as orelhas, com microfone integrado e Voice Aware informados pela JBL. A fabricante anuncia até 57 horas de bateria e cerca de 2 horas para recarga USB-C. Não possui cancelamento ativo de ruído (ANC). A conexão multiponto permite alternar entre dispositivos compatíveis; não comprova mistura simultânea de áudio. Não testamos conforto, áudio nem qualidade do microfone. A autonomia real depende do uso.',
    positiveNotes: ['Formato on-ear sem ponteiras intra-auriculares, uma alternativa de encaixe para música e chamadas.', 'Até 57 horas de bateria anunciadas pela JBL; a duração real depende do uso.'],
    negativeNotes: ['Sem cancelamento ativo de ruído (ANC), conforme a JBL.', 'Apoio sobre as orelhas: conforto em sessões longas não foi medido pela equipe.'],
    sourceUrl: 'https://www.jbl.com.br/blog/comparativo-jbl-tune-530bt-e-520bt.html', sourceLabel: 'JBL — características do Tune 520BT', reviewedAt: '2026-10-19', suppressRating: true,
  }],
  ['O6e0R2WtiZfyyf2MJe5Y', {
    model: /Asus.*Vivobook(?=.*(?:7520u|E1504FA-NJ1288))(?=.*16\s*gb)(?=.*512\s*(?:ssd|gb))/i,
    correct: 'Notebook ASUS Vivobook Go 15 E1504FA-NJ1288, 16 GB RAM e SSD 512 GB',
    summary: 'O SKU E1504FA-NJ1288 informado pelo responsável consta na loja ASUS com 16 GB de RAM LPDDR5, SSD NVMe de 512 GB e KeepOS. As fontes oficiais consultadas concordam nessas capacidades, mas a página individual informa Ryzen 5 40 e um conjunto com o mesmo SKU informa Ryzen 5 7520U. Por isso, o processador e a GPU da unidade precisam de confirmação antes da compra. Não atribuímos desempenho de uma variante à outra nem medimos desempenho deste notebook.',
    positiveNotes: ['RAM de 16 GB LPDDR5 documentada pela ASUS para o SKU informado.', 'SSD NVMe de 512 GB documentado para o mesmo SKU.'],
    negativeNotes: ['Keep OS não equivale a Windows licenciado.', 'As fontes oficiais divergem no processador; confirme CPU, GPU e possibilidade de expansão com a ASUS e o vendedor.'],
    sourceUrl: 'https://br.store.asus.com/notebook-asus-vivobook-go-15-e1504fa-nj1288-mixed-black-nivel-ips.html',
    specUrl: 'https://br.store.asus.com/notebook-asus-vivobook-go-15-e1504fa-nj1288-mixed-black-notebook-asus-x515ka-br309ws-slate-grey.html',
    sourceLabel: 'ASUS E1504FA-NJ1288 — páginas oficiais com divergência no processador', reviewedAt: '2026-10-20', suppressRating: true,
  }],
  ['UvxFn4gfaexb8TvcaT5e', {
    model: /Logitech.*M170/i,
    summary: 'O Logitech M170 é um mouse sem fio com receptor USB para navegação e trabalho cotidiano. A conexão pelo receptor permite começar sem emparelhamento Bluetooth. A Logitech anuncia até 12 meses de pilha, dependendo do uso. É uma opção para comparar se o computador tem porta USB compatível disponível; não escolha como se fosse um mouse Bluetooth sem receptor. Confira o receptor e a pilha no conjunto vendido. Não medimos precisão, conforto ou duração real da pilha.',
    positiveNotes: ['Receptor USB com instalação plug and play, conforme a Logitech.', 'Formato compacto e ambidestro anunciado para uso com qualquer uma das mãos.'],
    negativeNotes: ['O uso depende do receptor USB e de uma porta compatível disponível.', 'Até 12 meses de pilha é uma estimativa; conforto e precisão em uso real não foram testados.'],
    sourceUrl: 'https://www.logitech.com/pt-br/shop/p/m170-wireless-mouse.910-006864', sourceLabel: 'Logitech M170 — recursos oficiais', reviewedAt: '2026-10-19', suppressRating: true,
  }],
  ['huCYMmOsGPKJ8jOiJ1gR', {
    model: /WAP.*WL\s*1800.*220V/i,
    summary: 'A WAP WL 1800 desta oferta é identificada como 220 V e pode ser considerada para limpeza residencial ocasional. A ficha WAP distingue pressão nominal de 1.015 PSI de pressão permissível de 1.500 PSI: o maior número não é pressão contínua medida pela equipe. O formato compacto e a alça favorecem a organização e o transporte; o bico permite regular o jato. Confira tensão, acessórios e instruções para a superfície. Não medimos eficiência, economia de água ou durabilidade.',
    positiveNotes: ['Formato compacto com alça e suportes para organizar os acessórios, segundo a WAP.', 'Bico com jato regulável para adequar a aplicação às instruções de limpeza.'],
    negativeNotes: ['Esta oferta é identificada como 220 V; confirme a rede elétrica e a variante antes de pagar.', 'Pressão permissível de 1.500 PSI não equivale à nominal de 1.015 PSI. Desempenho prolongado não foi testado.'],
    sourceUrl: 'https://loja.wap.ind.br/lavadora-de-alta--pressao-wap-wl-1800-1/p', sourceLabel: 'WAP WL 1800 — produto e documentação', reviewedAt: '2026-10-19', suppressRating: true,
  }],
]);
