// Field-level review, 19/10/2026. Only primary manufacturer sources.
// Specifications describe the model, never authenticate the seller's unit.
const reviewedAt = '2026-10-19';
const sources = {
  redmi: 'https://www.mi.com/global/product/redmi-buds-6-play/',
  redmiFaq: 'https://www.mi.com/global/support/faq/details/KA-309446/',
  jbl: 'https://www.jbl.com.br/JBLT520BTBLK.html',
  jblAnc: 'https://www.jbl.com.br/blog/comparativo-jbl-tune-530bt-e-520bt.html',
  band: 'https://www.mi.com/global/product/xiaomi-smart-band-9-active/specs/',
  logitech: 'https://www.logitech.com/pt-br/shop/p/m170-wireless-mouse.910-006864',
  wap: 'https://mais.conteudo.wap.ind.br/wap/produtos/lavadora_de_alta_pressao/ocasional/lavadora_wl_1800_FW011457_FW011458/arquivos/ficha_tecnica/WAPWL1800-Fichatcnica.pdf',
  amd: 'https://www.amd.com/es/products/processors/laptop/ryzen/7000-series/amd-ryzen-5-7520u.html',
  asus: 'https://br.store.asus.com/notebook-asus-vivobook-go-15-e1504fa-nj1288-mixed-black-nivel-ips.html',
  asusBundle: 'https://br.store.asus.com/notebook-asus-vivobook-go-15-e1504fa-nj1288-mixed-black-notebook-asus-x515ka-br309ws-slate-grey.html',
  bip6: 'https://br.amazfit.com/products/amazfit-bip-6',
  fit5: 'https://consumer.huawei.com/ma/wearables/watch-fit5/specs/',
  p30i: 'https://www.soundcore.com/products/soundcore-p30i',
  budsCore: 'https://news.samsung.com/br/samsung-anuncia-galaxy-buds-core-no-brasil-cancelamento-de-ruido-e-integracao-com-galaxy-ai-para-todos',
  ex1500: 'https://www.tp-link.com/br/home-networking/wifi-router/ex1500/',
  ax2s: 'https://consumer.huawei.com/br/routers/ax2s/',
  ax2sSpecs: 'https://consumer.huawei.com/br/routers/ax2s/specs/',
  deco: 'https://www.tp-link.com/br/home-networking/deco/deco-x10/',
  wr840: 'https://www.tp-link.com/br/home-networking/wifi-router/tl-wr840n/',
  mr80: 'https://www.mercusys.com/ca/product/wifi-router/mr80x/v4/',
  mr80br: 'https://www.mercusys.com.br/product/wifi-router/mr80x/v4/',
  havit982: 'https://havitsmart.com/es/products/havit-life-01t-true-wireless-stereo-earbuds-tw982',
  havit982Fit: 'https://cdn.shopify.com/s/files/1/0755/1365/9703/files/01T-_TW982_-page_-_-2024.05_13.jpg?v=1788255515',
  havit982Specs: 'https://cdn.shopify.com/s/files/1/0755/1365/9703/files/01T-_TW982_-page_-_-2024.05_14.jpg?v=1788255515',
  twibi: 'https://backend.intelbras.com/sites/default/files/2025-03/Ficha%20T%C3%A9cnica%20-%20M%C3%B3dulo%20e%20Conjunto%20Twibi%20Force%20AX.pdf',
  quantum: 'https://www.jbl.com.br/on/demandware.static/-/Sites-masterCatalog_Harman/default/dwb298e5ae/pdfs/JBL_QUANTUM_100M2_Specsheet_EN.pdf',
  lenovo256: 'https://psref.lenovo.com/Detail/IdeaPad_Slim_3_15IRH10?M=83NS0003BR',
  lenovo512: 'https://psref.lenovo.com/Detail/IdeaPad_Slim_3_15IRH10?M=83NS0002BR',
  loq: 'https://www.lenovo.com/br/pt/p/laptops/loq-laptops/88lq3001926/83kh0001br',
};
const fact = (label, value, source, state = 'yes') => ({label, value, state, basis:'fabricante', sourceUrl:sources[source], checkedAt:reviewedAt});
const pending = (label, reason) => ({label, value:'Não informado / a confirmar', state:'unknown', basis:'cadastro', reason});
const redmi = {
  model:/\b(?:xiaomi\s+)?redmi\s+buds\s*6\s*play\b/i, family:'fone-tws',
  scope:'Redmi Buds 6 Play: especificações do modelo. Cor não altera estes recursos; autenticidade e conteúdo da oferta continuam a conferir.',
  features:[
    fact('Formato','Intra-auricular','redmiFaq'), fact('Versão Bluetooth','Bluetooth 5.4','redmi'),
    fact('Cancelamento ativo de ruído','Não possui ANC para ouvir; redução de ruído apenas nas chamadas','redmiFaq','no'),
    fact('Microfone','Microfone para chamadas; redução de ruído anunciada','redmiFaq'),
    fact('Autonomia no fone','Até 7,5 h anunciadas; volume de 50% e SBC','redmi'),
    fact('Autonomia com estojo','Até 36 h anunciadas com recargas; volume de 50% e SBC','redmi'),
    fact('Proteção contra água','IPX4 somente nos fones; não no estojo, não para banho ou imersão','redmi'),
  ],
  limitations:['Áudio, conforto e qualidade de chamada não foram testados pela equipe. A bateria real varia com o uso.'],
};
export const MANUFACTURER_SPECIFICATIONS = new Map([
  ['ARscPKCMZs3D8k22qltl',redmi], ['4eal5Q0HLTcrspjkUwee',redmi],
  ['GjHJtzdsIhbmSINvhPeX',{
    model:/\bjbl\s+tune\s*520\s*bt\b/i, family:'headphone', scope:'JBL Tune 520BT; não estende especificações aos modelos 530BT, 720BT ou versões NC.',
    features:[fact('Formato','On-ear (sobre as orelhas)','jbl'),fact('Versão Bluetooth','Bluetooth 5.3','jbl'),
      fact('Cancelamento ativo de ruído','Não possui, segundo a ficha','jblAnc','no'),fact('Microfone','Microfone integrado (1), com Voice Aware','jbl'),
      fact('Autonomia no fone','Até 57 h anunciadas','jbl'),fact('Recarga completa','Aproximadamente 2 h, via USB-C','jbl'),fact('Conexão multiponto','Informada pelo fabricante','jbl')],
    limitations:['Autonomia, áudio e conforto não foram medidos pela equipe. Microfone confirmado não significa qualidade de chamada testada.'],
  }],
  ['48oRcQNlH00KgNLHkvsG',{
    model:/\bxiaomi\s+smart\s*band\s*9\s*active\b/i, family:'smart-band', scope:'Xiaomi Smart Band 9 Active global; não confundir com Smart Band 9 ou 9 Pro.',
    features:[fact('Tela','TFT de 1,47 polegada; 172 × 320 pixels','band'),fact('Versão Bluetooth','Bluetooth 5.3 BLE','band'),
      fact('Aplicativo','Mi Fitness','band'),fact('Compatibilidade anunciada','Android 8.0 ou iOS 14.0 e superiores','band'),
      fact('Modos de exercício','50 modos anunciados','band'),fact('Autonomia típica','Até 18 dias anunciados; varia com o uso','band'),
      fact('Bateria','300 mAh; carregamento magnético','band'),fact('Resistência à água','5 ATM; respeitar as condições do manual, não equivale a profundidade de mergulho','band')],
    limitations:['Frequência cardíaca, SpO₂ e sono são referências de bem-estar, não diagnóstico. Precisão e autonomia real não foram medidas.'],
  }],
  ['UvxFn4gfaexb8TvcaT5e',{
    model:/\blogitech\b.*\bm170\b/i, family:'mouse', scope:'Logitech M170: recursos do modelo, não confirmação do receptor, pilha ou garantia do vendedor.',
    features:[fact('Conexão','Sem fio por receptor USB plug and play','logitech'),fact('Formato','Compacto e ambidestro','logitech'),
      fact('Compatibilidade anunciada','Windows, macOS, Chrome OS e Linux; requer porta USB compatível','logitech'),
      fact('Autonomia da pilha','Até 12 meses anunciados; depende do uso','logitech'),fact('Alcance sem fio','Até 10 m anunciados; depende do ambiente','logitech'),
      fact('Rastreamento','Óptico, com rolagem linha a linha','logitech')],
    limitations:['Precisão, conforto e duração da pilha não foram testados. Confira os acessórios efetivamente incluídos na oferta.'],
  }],
  ['huCYMmOsGPKJ8jOiJ1gR',{
    model:/\bwap\b.*\bwl\s*1800\b/i, family:'washer-pressure', scope:'WAP WL 1800. O cadastro selecionado informa 220 V; a ficha também contempla outra tensão. Confira o código da unidade.',
    features:[fact('Potência','1.400 W anunciados','wap'),fact('Pressão nominal','1.015 PSI / 7 MPa','wap'),
      fact('Pressão permissível','1.500 PSI / 10,5 MPa; não pressão contínua','wap'),fact('Vazão nominal máxima','270 L/h / 4,5 L/min','wap'),
      fact('Vazão máxima da bomba','360 L/h / 6 L/min; diferente da vazão nominal','wap'),fact('Mangueira de alta pressão','3 m','wap'),fact('Cabo elétrico','5 m','wap')],
    limitations:['A documentação do modelo não confirma acessórios, tensão ou estado de uma unidade vendida. Não medimos limpeza, consumo ou durabilidade.'],
  }],
  ['O6e0R2WtiZfyyf2MJe5Y',{
    model:/\basus\b.*\bvivobook\b(?=.*(?:\b7520u\b|\be1504fa-nj1288\b))(?=.*\b16\s*gb\b)(?=.*\b512\s*(?:ssd|gb)\b)/i, family:'notebook', reviewedAt:'2026-10-20',
    scope:'ASUS Vivobook Go 15 E1504FA-NJ1288: SKU informado pelo responsável. As duas páginas oficiais consultadas concordam na RAM e no SSD, mas divergem no processador.',
    features:[fact('Memória RAM','16 GB LPDDR5, na configuração oficial do SKU','asus'),
      fact('Armazenamento SSD','512 GB SSD NVMe, na configuração oficial do SKU','asus'),
      fact('Sistema operacional de fábrica','KeepOS; não equivale a licença Windows','asus'),
      pending('Processador','O anúncio e um conjunto oficial indicam Ryzen 5 7520U; a página individual do mesmo SKU indica Ryzen 5 40. Confirmar com a ASUS antes de atribuir CPU e GPU à unidade.')],
    additionalSources:[sources.asusBundle],
    limitations:['A ficha de fábrica não autentica a unidade do vendedor. Expansão e portas continuam a confirmar; desempenho não foi testado.'],
  }],
  ['9P123IBTTYnSCMilPvXB',{
    model:/\bamazfit\b.*\bbip\s*6\b(?!\s*(?:pro|max|active)\b)/i, family:'watch-smart', reviewedAt:'2026-10-20',
    scope:'Amazfit Bip 6: recursos do modelo, não autenticação da unidade ou teste independente.',
    features:[fact('GPS integrado','GPS integrado, com cinco sistemas de posicionamento anunciados','bip6'),
      fact('Chamadas Bluetooth','Chamadas Bluetooth com o celular conectado; não é linha móvel independente','bip6'),
      fact('Tela','AMOLED de 1,97 polegada; 390 × 450 pixels','bip6'),
      fact('Resistência à água','5 ATM; seguir as condições do manual, não equivale a mergulho a 50 m','bip6'),
      fact('Compatibilidade anunciada','Android 7.0 ou iOS 14.0 e superiores; aplicativo Zepp','bip6'),
      pending('Proteção IP','A fonte informa 5 ATM; não atribuímos um código IP que não foi confirmado.')],
    limitations:['A documentação cita Zepp Flow, disponível em regiões selecionadas; Alexa não foi confirmada. Sensores não substituem diagnóstico médico. Áudio, precisão e autonomia real não foram medidos.'],
  }],
  ['5MGE98tYssH9nEfBeHoW',{
    model:/\bhuawei\b.*\bwatch\s*fit\s*5\b(?!\s*(?:pro|max)\b)/i, family:'watch-smart', reviewedAt:'2026-10-20',
    scope:'HUAWEI WATCH FIT 5, não Pro: ficha oficial internacional. Confirmar disponibilidade regional e a variante vendida.',
    features:[fact('Tela','AMOLED de 1,82 polegada; 480 × 408 pixels','fit5'),
      fact('GPS integrado','GNSS integrado; GPS de dupla banda L1 + L5','fit5'),
      fact('Proteção IP','IP6X: proteção contra poeira; não é IP68','fit5'),
      fact('Resistência à água','5 ATM; seguir as restrições do manual, não equivale a mergulho a 50 m','fit5'),
      fact('Compatibilidade anunciada','Android 9.0 ou iOS 13.0 e superiores','fit5'),
      pending('Armazenamento interno','Não foi confirmada a alegação de 64 GB; removida do título público, sem substituir por outra capacidade.')],
    limitations:['Não atribuímos NFC a todas as cores ou regiões. Autonomia e sensores não foram testados; registros de bem-estar não são diagnóstico médico.'],
  }],
  ['5bQKU9inL3pq14yE8K4L',{
    model:/\bsoundcore\b.*\bp30i\b/i, family:'fone-tws',scope:'soundcore P30i; não usa os números do P40i, P20i ou Life P3i exibidos na mesma tabela.',
    features:[fact('Versão Bluetooth','Bluetooth 5.4','p30i'),fact('Cancelamento ativo de ruído','ANC e modo transparência anunciados','p30i'),
      fact('Microfone','4 microfones com processamento de chamadas anunciado','p30i'),fact('Autonomia no fone','Até 10 h anunciadas; depende do modo e uso','p30i'),
      fact('Autonomia com estojo','Até 45 h anunciadas com recargas; depende do modo e uso','p30i'),fact('Proteção anunciada','IP54; não significa uso submerso','p30i'),
      fact('Estojo','Apoio externo para celular integrado ao estojo','p30i')],
    limitations:['Os máximos de 10/45 horas não garantem a mesma duração com ANC ligado. Áudio, conforto e desempenho real não foram testados.'],
  }],
  ['FlqPY3yHJ2xPoNgnhSTE',{
    model:/\bgalaxy\s+buds\s*core\b/i, family:'fone-tws',scope:'Samsung Galaxy Buds Core; recursos Galaxy AI dependem do smartphone e software compatíveis.',
    features:[fact('Formato','Intra-auricular com ponteiras de silicone','budsCore'),fact('Versão Bluetooth','Bluetooth 5.4','budsCore'),
      fact('Cancelamento ativo de ruído','ANC anunciado pela Samsung','budsCore'),fact('Microfone','Sistema de três microfones anunciado','budsCore'),
      fact('Autonomia com estojo','Até 35 h com ANC desligado; aproximadamente 20 h com ANC ligado, incluindo recargas','budsCore'),
      fact('Proteção anunciada','IP54, contra poeira e respingos; não significa uso submerso','budsCore'),
      pending('Autonomia no fone','A fonte consultada informa totais com estojo; não atribuir esse total a uma sessão contínua.')],
    limitations:['Bateria total inclui recargas. Não testamos áudio, chamadas, conforto nem autonomia real. A integração Galaxy AI não é tradução independente dos fones.'],
  }],
  ['qZUWO8WSrcOKWVrAqTW7',{
    model:/\btp[ -]?link\b.*\bex\s*1500\b/i,family:'roteador',scope:'TP-Link EX1500: a contagem de conectores segue a tabela técnica, não a frase promocional divergente da mesma página.',
    features:[fact('Wi-Fi 6','802.11ax em 5 GHz; classe AX1500','ex1500'),fact('Banda de 5 GHz','2,4 GHz e 5 GHz','ex1500'),
      fact('Portas Gigabit','Portas Ethernet 10/100/1000 Mbps','ex1500'),fact('Quantidade de portas','1 porta WAN + 3 portas LAN, segundo a tabela técnica','ex1500'),
      fact('Rede Mesh','Compatível com EasyMesh; requer outros equipamentos compatíveis','ex1500')],
    limitations:['A página também cita quatro LAN em um texto promocional; a tabela técnica distingue 1 WAN e 3 LAN. Confirme a revisão física antes de comprar. Cobertura e velocidade real não foram medidas.'],
  }],
  ['YuOWci2UixF5GuQE6IYS',{
    model:/\bhuawei\b.*\bax2s\b/i,family:'roteador',scope:'HUAWEI WiFi AX2S. As próprias páginas oficiais divergem na contagem de portas; esse campo não foi completado por suposição.',
    features:[fact('Wi-Fi 6','Wi-Fi 6 em 5 GHz; 2,4 GHz em 802.11n','ax2s'),fact('Banda de 5 GHz','2,4 GHz e 5 GHz simultâneas','ax2s'),
      fact('Portas Gigabit','Gigabit Ethernet com adaptação WAN/LAN','ax2s'),fact('Rede Mesh','HarmonyOS Mesh+ / EasyMesh anunciados; confirmar equipamentos e firmware compatíveis','ax2s'),
      pending('Quantidade de portas','A visão geral oficial informa três entradas Gigabit; a ficha oficial informa quatro. Confirmar a revisão exata com o fabricante/vendedor.')],
    limitations:['Quantidade de portas a confirmar: visão geral oficial diz três, especificações dizem quatro. Recursos podem variar por região e versão.'],
    additionalSources:[sources.ax2sSpecs],
  }],
  ['LUsq533hX6lTuHwnZbhz',{
    model:/\btp[ -]?link\b.*\bdeco\s*x10\b/i,family:'roteador',scope:'TP-Link Deco X10. Os dados são por unidade; 1-pack não inclui as unidades de um kit 2-pack ou 3-pack.',
    features:[fact('Wi-Fi 6','802.11ax em 5 GHz; classe AX1500','deco'),fact('Banda de 5 GHz','2,4 GHz e 5 GHz','deco'),
      fact('Portas Gigabit','Gigabit Ethernet com adaptação WAN/LAN','deco'),fact('Quantidade de portas','2 portas Gigabit por unidade, WAN/LAN automáticas','deco'),
      fact('Rede Mesh','TP-Link Mesh entre unidades Deco; não presume compatibilidade EasyMesh','deco')],
    limitations:['O cadastro anuncia 1-pack. Área e cobertura dependem do ambiente e da quantidade de unidades; não garantimos alcance em metros quadrados.'],
  }],
  ['2e2m7sDdRyGHq1Tzj8ra',{
    model:/\btp[ -]?link\b.*\btl[ -]?\s*wr\s*840\s*n\b/i,family:'roteador',scope:'TP-Link TL-WR840N: ficha atual do modelo. Confira revisão de hardware e firmware; não usar a ficha de um Archer ou de uma versão ISP diferente.',
    features:[fact('Wi-Fi 6','Não: padrões documentados Wi-Fi 4 / 802.11n/b/g','wr840','no'),fact('Banda de 5 GHz','Não: banda documentada de 2,4 GHz','wr840','no'),
      fact('Portas Gigabit','Não: portas Fast Ethernet 10/100 Mbps','wr840','no'),fact('Quantidade de portas','1 porta WAN + 4 portas LAN, todas 10/100 Mbps','wr840'),
      pending('Rede Mesh','Não foi confirmada para a revisão e firmware da unidade. Modo repetidor ou ponto de acesso não comprova Mesh.')],
    limitations:['N300 é taxa Wi-Fi teórica, não velocidade garantida de internet. Recursos de software e modos dependem da revisão.'],
  }],
  ['AweCTxq7vwVQ7VmN4IIg',{
    model:/\bmercusys\b.*\bmr\s*80x\b.*\bv4\b/i,family:'roteador',reviewedAt:'2026-10-20',scope:'MERCUSYS MR80X V4: página brasileira da revisão V4 consultada. Recursos dependem do firmware e dos aparelhos compatíveis, não são garantia de cobertura.',
    features:[fact('Wi-Fi 6','802.11ax, classe AX3000','mr80'),fact('Banda de 5 GHz','2,4 GHz e 5 GHz','mr80'),fact('Portas Gigabit','Gigabit Ethernet','mr80'),
      fact('Quantidade de portas','1 porta WAN Gigabit + 3 portas LAN Gigabit','mr80'),fact('Rede Mesh','EasyMesh anunciado na página brasileira V4; requer firmware e outros aparelhos compatíveis','mr80br')],
    additionalSources:[sources.mr80br],
    limitations:['A fabricante alerta para conflitos de firmware entre fornecedores e informa que não há certificação Wi-Fi EasyMesh. O firmware da unidade vendida precisa ser conferido. AX3000 não é velocidade garantida; cobertura não testada.'],
  }],
  ['kYzXt8BeErDzXsC6BlwB',{
    model:/\bhavit\b.*\btw\s*982\b(?!\s*(?:pro|plus)\b)/i,family:'fone-tws',reviewedAt:'2026-10-20',
    scope:'HAVIT LIFE 01T / TW982, não TW982 Pro. Números lidos na tabela ilustrada publicada na página oficial; não são medição da equipe.',
    features:[fact('Formato','Intra-auricular com ponteiras, conforme a apresentação oficial','havit982Fit'),
      fact('Versão Bluetooth','Bluetooth 5.4','havit982Specs'),
      fact('Autonomia no fone','Até 7,5 h anunciadas, a 60% do volume','havit982Specs'),
      fact('Autonomia com estojo','Até 33 h anunciadas com recargas, a 60% do volume','havit982Specs'),
      fact('Carregamento do estojo','USB-C; cerca de 1,5 h anunciada para o estojo','havit982Specs'),
      {label:'Microfone',value:'Microfone com ENC informado no cadastro; qualidade de chamada não testada',state:'yes',basis:'cadastro'},
      pending('Cancelamento ativo de ruído','ENC anunciado para chamadas não confirma ANC para ouvir. Não usamos a ficha do TW982 Pro para completar este campo.')],
    additionalSources:[sources.havit982],
    limitations:['Autonomia real depende do volume e do uso. Não medimos conforto, som ou chamadas; 33 horas incluem recargas no estojo.'],
  }],
  ['sMCnNBstxTrJqaF6jp2O',{
    model:/\bintelbras\b.*\btwibi\s+force\s+ax\b|\btwibi\s+force\s+ax\b.*\bintelbras\b/i,family:'roteador',scope:'Intelbras Twibi Force AX: dados por módulo; não confundir com Twibi Force Plug nem atribuir duas unidades a uma oferta unitária.',
    features:[fact('Wi-Fi 6','Wi-Fi 6 em 5 GHz; classe AX1500','twibi'),fact('Banda de 5 GHz','2,4 GHz e 5 GHz','twibi'),fact('Portas Gigabit','Gigabit Ethernet','twibi'),
      fact('Quantidade de portas','1 porta WAN/LAN Gigabit + 1 porta LAN Gigabit por módulo','twibi'),fact('Rede Mesh','inMesh, baseado em EasyMesh; usar aparelhos compatíveis','twibi')],
    limitations:['Quantidade de módulos e ambiente alteram a cobertura. A própria ficha limita compatibilidade de Twibi Fast/Giga/Giga+ ao modo repetidor. Não testamos alcance.'],
  }],
  ['c9hb1oe40g3K1dP4dAsy',{
    model:/\bjbl\b.*\bquantum\s*100\s*m2\b/i,family:'headset',scope:'JBL Quantum 100M2: headset over-ear com fio; não usar especificações dos modelos Quantum Wireless.',
    features:[fact('Formato','Over-ear (ao redor das orelhas)','quantum'),fact('Conexão','Com fio, conector de 3,5 mm','quantum'),fact('Microfone','Boom direcional removível','quantum'),fact('Cabo','1,2 m','quantum'),
      fact('Versão Bluetooth','Não se aplica à conexão com fio documentada','quantum','no'),fact('Autonomia no fone','Não se aplica à conexão analógica com fio documentada','quantum','no'),
      pending('Cancelamento ativo de ruído','ANC para ouvir não foi confirmado nesta ficha. Microfone direcional não comprova ANC.')],
    limitations:['Confirme a entrada de áudio e eventuais adaptadores do seu aparelho. Não testamos conforto, áudio ou qualidade de voz.'],
  }],
  ['mlMLB5212483469',{
    model:/\blenovo\b.*\b83ns0003br\b/i,family:'notebook',scope:'Lenovo IdeaPad Slim 3 15IRH10, código exato 83NS0003BR. Configuração de fábrica no PSREF; não copiar o SSD do código 83NS0002BR.',
    features:[fact('Memória RAM','8 GB DDR5-4800 soldados; configuração de fábrica','lenovo256'),
      fact('Armazenamento SSD','256 GB M.2 2242 PCIe 4.0 x4 NVMe; configuração de fábrica','lenovo256'),
      fact('Processador','Intel Core i5-13420H','lenovo256'),fact('Sistema operacional de fábrica','Windows 11 Home Single Language, português do Brasil','lenovo256')],
    limitations:['Confirme o SKU na oferta e se o vendedor modificou memória, armazenamento ou sistema. A ficha de fábrica não autentica a unidade e não é teste de desempenho.'],
  }],
  ['XCp2wV9P76JfBz2zuUTX',{
    model:/\blenovo\b.*\b83ns0002br\b/i,family:'notebook',scope:'Lenovo IdeaPad Slim 3 15IRH10, código exato 83NS0002BR. Configuração de fábrica no PSREF; não copiar o SSD do código 83NS0003BR.',
    features:[fact('Memória RAM','8 GB DDR5-4800 soldados; configuração de fábrica','lenovo512'),
      fact('Armazenamento SSD','512 GB M.2 2242 PCIe 4.0 x4 NVMe; configuração de fábrica','lenovo512'),
      fact('Processador','Intel Core i5-13420H','lenovo512'),fact('Sistema operacional de fábrica','Windows 11 Home Single Language, português do Brasil','lenovo512')],
    limitations:['Confirme o SKU na oferta e se o vendedor modificou memória, armazenamento ou sistema. A ficha de fábrica não autentica a unidade e não é teste de desempenho.'],
  }],
  ['SJRf3jhIFlr1BQadDNnH',{
    model:/\blenovo\b.*\bloq\b(?=.*\b15irx9\b)(?=.*\bi5[- ]?13450hx\b)(?=.*\brtx\s*3050\b)(?=.*\b8\s*gb\b)(?=.*\b512\s*gb\b)/i,
    family:'notebook',reviewedAt:'2026-10-20',
    scope:'Lenovo LOQ 15IRX9, SKU 83KH0001BR informado pelo responsável e conferido na loja oficial. Configuração de fábrica, não de qualquer LOQ 15IRX9.',
    features:[fact('Memória RAM','8 GB DDR5-4800 MT/s SODIMM; configuração de fábrica','loq'),
      fact('Armazenamento SSD','512 GB M.2 2242 PCIe Gen4 TLC; configuração de fábrica','loq'),
      fact('Processador','Intel Core i5-13450HX','loq'),
      fact('Placa de vídeo','NVIDIA GeForce RTX 3050 para laptop, com 6 GB GDDR6 de memória de vídeo','loq'),
      fact('Sistema operacional de fábrica','Windows 11 Home','loq'),
      fact('Tela','15,6 polegadas, FHD 1920 × 1080, WVA, 144 Hz','loq')],
    limitations:['Os 8 GB de RAM do sistema e os 6 GB da GPU têm funções diferentes; não são uma memória única de 14 GB. Confirme o SKU e eventuais alterações do vendedor. Não medimos desempenho, jogos, temperatura ou autonomia.'],
  }],
]);

export function documentedSpecifications(product) {
  const id=String(product?.id||''), title=String(product?.titulo||product?.title||'');
  const record=MANUFACTURER_SPECIFICATIONS.get(id);
  if (!record || /^(?:capa|case|suporte|carregador|refil)\b/i.test(title) || !record.model.test(title)) return null;
  const checkedAt=record.reviewedAt || reviewedAt;
  return {family:record.family, scope:record.scope, checkedAt,
    features:record.features.map(f=>({...f,...(f.basis==='fabricante'?{checkedAt}:{})})), limitations:[...record.limitations],
    additionalSources:[...(record.additionalSources||[])]};
}

export function mergeDocumentedFeatures(product, features=[]) {
  const record=documentedSpecifications(product);
  if (!record) return features;
  const merged=new Map(features.map(f=>[f.label,f]));
  for (const feature of record.features) merged.set(feature.label,feature);
  return [...merged.values()];
}

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderManufacturerSpecifications(product) {
  const record=documentedSpecifications(product);
  if (!record) return '';
  const known=record.features.filter(f=>f.state!=='unknown' && f.basis==='fabricante'), uncertain=record.features.filter(f=>f.state==='unknown');
  return '<section class="panel" data-manufacturer-specifications style="margin-top:24px"><h2>Ficha conferida em fontes do fabricante</h2><p>'+esc(record.scope)+'</p><ul>'
    +known.map(f=>'<li><b>'+esc(f.label)+':</b> '+esc(f.value)+' — <a href="'+esc(f.sourceUrl)+'" target="_blank" rel="noopener noreferrer">fonte oficial</a>.</li>').join('')+'</ul>'
    +(uncertain.length?'<h3>O que continua a confirmar</h3><ul>'+uncertain.map(f=>'<li><b>'+esc(f.label)+':</b> '+esc(f.reason)+'</li>').join('')+'</ul>':'')
    +'<p>'+record.limitations.map(esc).join(' ')+'</p>'
    +record.additionalSources.map(url=>'<p><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Outra fonte oficial consultada</a>.</p>').join('')
    +'<p class="fine">Documentação revisada em '+esc(record.checkedAt.split('-').reverse().join('/'))+'. Valores anunciados pelo fabricante, não teste independente nem autenticação da oferta. Esta revisão não altera a data da conferência do preço.</p></section>';
}
