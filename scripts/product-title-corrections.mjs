import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { HIGHLIGHT_EDITORIAL } from './highlight-editorial.mjs';
import { documentedSpecifications } from './manufacturer-specifications.mjs';
import { MARKETPLACE_FIELD_REVIEWS,listingReviewFor } from './marketplace-field-reviews.mjs';
import {EPSON_DESCRIPTION} from './public-seo-labels.mjs';

import { EXISTING_OFFER_REVIEWS, matchesExistingOffer } from './existing-offer-reviews.mjs';
const PRODUCT_CORRECTIONS = new Map([
  ['hYk6ccUgsn1KL36RxXrY', {
    syncInformationalSchema:true,
    model:/^t[eê]nis.*on running.*cloud/i,
    correct:'Tênis anunciado como On Running Cloud — modelo exato a confirmar',
    summary:'O cadastro apresenta um tênis anunciado como On Running Cloud e informa código de catálogo MLB6223010170. O nome comercial não identifica nesta ficha o modelo completo ou a variante. Não confirmamos autenticidade, amortecimento ou adequação esportiva por esse título. O percentual promocional antigo não foi mantido como informação atual. Confira identificação, numeração e descrição da unidade no anúncio antes de escolher.',
    positiveNotes:['Nome comercial e código de catálogo identificados no cadastro, sem comprovar modelo ou procedência.'],
    negativeNotes:['Modelo exato e variante a confirmar; não usamos o título para afirmar desempenho ou autenticidade.', 'Não testamos conforto, amortecimento ou resistência e não mantemos desconto percentual antigo como informação atual.'],
    suppressRating:true,
  }],
  ['xUz3eJJ8CDLhc5sW47BB', {
    syncInformationalSchema:true,
    model:/^basike\b.*bluetooth.*tws/i,
    correct:'Basike BA-FON240B — Bluetooth 5.4 anunciado, TWS com formato a confirmar',
  }],
  ['eWSvbRDlCUBkWhNx5s6T', {
    model:/^bicicleta.*gts.*dexter/i,
    category:'bicicletas',
  }],
  ['YOLXINIYLDE2vnlgq8aR', {
    syncInformationalSchema:true,
    model:/^bicicleta.*gts.*lavy/i,
    summary:'O cadastro apresenta uma bicicleta GTS Lavy aro 29 com quadro de alumínio, 21 marchas, câmbio anunciado como Shimano, freios a disco e aro de parede dupla. O título informa quadro 17 e a descrição usa M; não confirmamos a equivalência nem o ajuste para uma pessoa específica. A carga de 120 kg é anunciada, não verificada em teste pela equipe. Confira identificação do quadro, componentes, limite de carga e montagem com o fornecedor; não tratamos a presença de um anúncio no Mercado Livre como confirmação do fabricante.',
    positiveNotes:['Quadro de alumínio, 21 marchas e freios a disco descritos no cadastro.'],
    negativeNotes:['Tamanho 17 e classificação M precisam ser conferidos para a unidade; não presumimos equivalência.', 'Carga, resistência e precisão das trocas não foram testadas; componentes anunciados não foram autenticados pela equipe.'],
    suppressRating:true,
  }],
  ['qSwfFcX2XaFU4QLIb8bN', {
    syncInformationalSchema:true,
    model:/^(?:bicicleta.*(?:scooter|bikelete).*mt2|bikelete smart mt2)/i,
    correct:'Bikelete Smart MT2 — capacidade da bateria a confirmar',
    summary:'O cadastro apresenta uma Bikelete Smart MT2 anunciada com motor de 500 W e sistema de 48 V. Há divergência na capacidade da bateria: o título informa 15 Ah e a descrição 12 Ah; não escolhemos um dos valores nem calculamos autonomia a partir deles. Tipo de bateria, velocidade de 32 km/h e carga de 120 kg também são declarações do cadastro, não medições da equipe. Confira etiqueta, manual e configuração da unidade com o fornecedor antes de escolher; não confirmamos autonomia ou desempenho.',
    positiveNotes:['Modelo Smart MT2 identificado no cadastro; motor e tensão anunciados.'],
    negativeNotes:['Capacidade da bateria divergente: 15 Ah no título e 12 Ah na descrição, sem valor confirmado.', 'Autonomia, velocidade e limite de carga não foram testados; confira a configuração da unidade.'],
    suppressRating:true,
  }],
  ['qAkENABz4tpPjLGpyPEw', {
    syncInformationalSchema:true,
    model:/balan[cç]a.*bioimped[aâ]ncia.*bluetooth.*corporal/i,
    summary:'O cadastro apresenta uma balança corporal Bluetooth anunciada como Davely e informa capacidade de 140 kg e conexão com aplicativo para Android e iOS. Também anuncia estimativas de composição corporal e histórico no celular. Não verificamos o modelo exato, o aplicativo ou a precisão dessas estimativas. A expressão alta precisão e a indicação para toda a família não são conclusões comprovadas pela equipe. Confira a identificação da unidade, o aplicativo e as restrições do manual antes de escolher.',
    positiveNotes:['Conexão Bluetooth e acompanhamento por aplicativo anunciados no cadastro.'],
    negativeNotes:['Precisão, aplicativo e compatibilidade não foram testados.', 'Capacidade de 140 kg é um dado anunciado, não comprovação de adequação a qualquer pessoa.'],
    suppressRating:true,
  }],
  ['QqhF1Rgq1LcKQMhFr50j', {
    syncInformationalSchema:true,
    model:/(?:banco.*bike.*selim|selim.*(?:super comfort|bicicleta))/i,
    correct:'Selim para bicicleta com molas, abertura central e refletor — medidas a confirmar',
    summary:'O cadastro apresenta um selim para bicicleta com molas, abertura central e refletor traseiro anunciados. Os campos de largura de 2 cm e comprimento de 2,5 cm não foram confirmados e não devem orientar a escolha do tamanho; não presumimos uma unidade ou medida corrigida. Também não testamos conforto, absorção de impactos ou resistência. A descrição de gel e a promessa de prevenir assaduras não foram verificadas. Confira medidas reais, material e encaixe na bicicleta antes de escolher.',
    positiveNotes:['Molas, abertura central e refletor descritos no cadastro, a conferir na unidade oferecida.'],
    negativeNotes:['Medidas de 2 cm e 2,5 cm a confirmar; nenhuma conversão foi presumida.', 'Não garantimos prevenção de assaduras, conforto individual ou compatibilidade com qualquer bicicleta.'],
    suppressRating:true,
  }],
  ['ICxKGrUEwJIcuNHBKQ6z', {
    syncInformationalSchema:true,
    model:/ultimea.*poseidon.*r3t/i,
    summary:'O cadastro identifica uma barra de som ULTIMEA Poseidon R3T e anuncia sistema 2.1, potência de 240 W, faixa de 50 Hz a 18 kHz, alimentação 127/220 V e processamento VoiceMX. Esses dados não foram confirmados nesta revisão no manual exato da unidade. O subwoofer é anunciado com ligação sem fio à barra; isso não comprova funcionamento sem alimentação elétrica nem permite garantir posicionamento em qualquer ponto da sala. Não medimos potência ou clareza de diálogos. Confira alimentação, conexões e condições de instalação no manual antes de escolher.',
    positiveNotes:['Sistema 2.1 e subwoofer com ligação sem fio anunciados no cadastro.'],
    negativeNotes:['Potência, alimentação e recursos precisam ser conferidos para a unidade exata.', 'Ligação sem fio não é garantia de instalação em qualquer local; alimentação e alcance devem ser verificados.'],
    suppressRating:true,
  }],
  ['LGW7J8fPa6f2lwsNDYOM', {
    syncInformationalSchema:true,
    model:/barraca.*3.*1.*t[uú]nel.*foguete/i,
    summary:'O cadastro apresenta uma barraca infantil 3 em 1 com túnel e tema de foguete. Anuncia poliéster, estrutura dobrável e medidas de 1,35 m de altura, 2,9 m de comprimento e 1,2 m de largura, ainda não medidas pela equipe. Os campos genéricos de idade de 0 a 99 anos e a expressão jogador de beisebol não confirmam faixa etária nem conteúdo do conjunto e não são usados como recomendação. Confira embalagem, dimensões montadas, faixa etária e itens incluídos na identificação do fabricante ou vendedor.',
    positiveNotes:['Formato de barraca com túnel e estrutura dobrável descrito no cadastro.'],
    negativeNotes:['Faixa etária e conteúdo do conjunto a confirmar; o intervalo 0 a 99 anos não é recomendação verificada.', 'Medidas anunciadas, não aferidas; confira espaço disponível e identificação do conjunto.'],
    suppressRating:true,
  }],
  ['GpoXj5YCjA93hBDg5L0v', {
    syncInformationalSchema:true,
    model:/barraca.*4.*pessoas.*homefy/i,
    summary:'O cadastro apresenta uma barraca iglu Homefy anunciada para até quatro pessoas, com base de 2,1 × 2,1 m, altura central de 1,3 m, peso de 900 g e tela mosquiteiro. Esses dados são declarações do cadastro, não medições. A coluna de água de 300 mm anunciada não foi verificada em teste e não é usada nesta ficha para garantir proteção contra chuva. Confira material, montagem, medidas úteis e condições de uso informadas para a unidade; a acomodação depende também do espaço ocupado por pessoas e bagagens.',
    positiveNotes:['Formato iglu e tela mosquiteiro descritos no cadastro.'],
    negativeNotes:['Não testamos resistência à chuva, estabilidade ou vedação.', 'Capacidade, dimensões e peso são anunciados; confira espaço útil e documentação do conjunto.'],
    suppressRating:true,
  }],
  ['iAFknp54AGEJMCkVkbtP', {
    syncInformationalSchema:true,
    model:/auxiliar.*partida.*vigomot/i,
    summary:'O cadastro descreve um auxiliar de partida VIGOMOT com compressor, lanterna LED de três modos e porta USB. Informa bateria de 8000 mAh, pressão de 150 PSI e aplicação anunciada para veículos de até 3 L. PSI é uma unidade de pressão, não de vazão; não há vazão confirmada nesta ficha. Esses números são declarações do cadastro, não resultados de teste. Confirme o modelo e a compatibilidade com o veículo nas instruções do fornecedor; não garantimos partida ou calibração.',
    positiveNotes:['Compressor, lanterna e USB descritos no cadastro; confira os itens da unidade oferecida.'],
    negativeNotes:['Vazão não confirmada; os 150 PSI anunciados se referem a pressão.', 'Compatibilidade com o veículo e desempenho de partida não foram verificados.'],
    suppressRating:true,
  }],
  ['WcV6iy1IS12dL74uflws', {
    syncInformationalSchema:true,
    model:/auxiliar.*partida.*port[aá]til.*carro.*moto/i,
    summary:'O cadastro apresenta um auxiliar de partida portátil anunciado como VIGOMOT, com compressor de ar, lanterna LED e função power bank. Não informa nesta ficha uma vazão medida nem documentação suficiente para assegurar compatibilidade por cilindrada. Não tratamos a expressão alta vazão ou a indicação genérica para carros e motos como comprovação de desempenho. Confira o modelo exato, a aplicação ao veículo e as instruções do fornecedor antes de escolher.',
    positiveNotes:['Funções de compressor, lanterna e power bank descritas no cadastro.'],
    negativeNotes:['Vazão e compatibilidade por veículo não confirmadas.', 'Não testamos partida, calibração ou autonomia; não garantimos atendimento a qualquer carro ou moto.'],
    suppressRating:true,
  }],
  ['ZcFzy9nXCVEZCsuz9SB3', {
    syncInformationalSchema:true,
    model:/auxiliar.*partida.*port[aá]til.*veicular/i,
    category:'carro',
    summary:'O cadastro apresenta um auxiliar de partida veicular anunciado como VIGOMOT, com compressor, iluminação LED de três modos e função power bank USB. Os 150 PSI, 8000 mAh e aplicação para veículos de até 3 L são dados anunciados, não verificados em teste pela equipe. Confira o modelo exato e as instruções de compatibilidade do fornecedor; esta ficha não garante partida, calibração ou autonomia. O produto pertence à categoria automotiva, não à seleção de utensílios de casa.',
    positiveNotes:['Conjunto de funções automotivas descrito no cadastro.'],
    negativeNotes:['Aplicação ao veículo e desempenho não foram testados.', 'Confirme o modelo exato e o conteúdo da embalagem, sem presumir equivalência entre anúncios VIGOMOT.'],
    suppressRating:true,
  }],
  ['JaEIKKAz742WyLDV6Oqr', {
    syncInformationalSchema:true,
    model:/balan[cç]a.*bioimped[aâ]ncia.*8.*relaxmedic/i,
    summary:'O cadastro identifica uma balança Relaxmedic de bioimpedância com oito sensores e anuncia capacidade de 180 kg e dimensões de 30 × 30 cm. O código exato do modelo, a alimentação e a aplicação por faixa etária não foram confirmados nesta revisão. Por isso, não afirmamos alimentação 127/220 V nem indicação para acompanhar o crescimento infantil com base nesses campos. Não testamos precisão ou estimativas de composição corporal. Confira a identificação da unidade e o manual correspondente antes de decidir.',
    positiveNotes:['Marca Relaxmedic e oito sensores identificados no título cadastrado.'],
    negativeNotes:['Modelo exato, alimentação e faixa etária a confirmar no manual da unidade.', 'Capacidade e medidas são dados anunciados; precisão e estimativas de composição corporal não foram testadas.'],
    suppressRating:true,
  }],
  ['Mdyju6zRmHsKRpOYqz51', {
    syncInformationalSchema:true,
    model:/inova.*(?:gancho|fone)/i,
    correct:'Anunciado como Inova Cases — fone com gancho, marca e autonomia a confirmar',
  }],
  ['MWjfkNgY4oXJD8NhCOQn', {
    syncInformationalSchema:true,
    model:/^(?:m?angueira jardim 20m|mangueira de jardim marqs home 20 m)/i,
    correct:'Mangueira de jardim Marqs Home 20 m com esguicho 7/16',
  }],
  ['jGYvacocpYFsksmL0eAG', {
    syncInformationalSchema:true,
    model:/(?:50\s*km.?h.*carro|carro.*controle remoto)/i,
    correct:'Carro de controle remoto off-road — velocidade anunciada não testada',
    summary:'O cadastro anuncia um carro de controle remoto off-road com velocidade de 50 km/h e escala 1:16. Esses dados são declarações do anúncio, não medições da equipe. Não testamos velocidade, autonomia ou resistência do conjunto. Confirme modelo, faixa etária, montagem, alimentação e conteúdo da embalagem antes de escolher; não presumimos que a velocidade anunciada seja atingida em qualquer terreno.',
    positiveNotes:['Carrinho off-road com controle remoto identificado no cadastro; confira a unidade oferecida.'],
    negativeNotes:['Velocidade de 50 km/h anunciada, não testada pela equipe.', 'Faixa etária, alimentação e itens da embalagem precisam ser conferidos para esse conjunto.'],
    suppressRating:true,
  }],
  ['5FQyewGiYpron6Bn32d1', {
    syncInformationalSchema:true,
    model:/(?:85\s*cm.*escorredor|escorredor.*lou[cç]a)/i,
    summary:'O cadastro descreve um escorredor de louça para organização sobre a pia, com medidas anunciadas de 85 × 80 × 30 cm e aço com pintura epóxi. Não medimos a peça nem testamos carga, resistência à corrosão ou fixação. A carga anunciada e a expressão antiferrugem não são garantias verificadas pela equipe. Confira medidas, espaço da torneira, fixação e instruções do fornecedor antes de instalar ou apoiar utensílios.',
    positiveNotes:['Formato organizador sobre a pia e medidas declarados no cadastro, a conferir no conjunto.'],
    negativeNotes:['Carga, resistência à corrosão e fixação não foram testadas; não tratamos as declarações do anúncio como garantias.', 'Confira medidas reais, espaço disponível e instruções de instalação.'],
    suppressRating:true,
  }],
  ['CXMWhCkfWah2EmRBTFtF', {
    syncInformationalSchema:true,
    model:/attracione/i,
    correct:'Perfume Attracione Men 25 ml — composição e efeitos não verificados',
    summary:'O cadastro identifica o perfume Attracione Men em frasco anunciado de 25 ml. A expressão feromônios ativados faz parte da apresentação comercial, mas não verificamos a composição nem comprovamos qualquer efeito de atração. Não testamos fixação, projeção ou tolerância individual. Confira embalagem, procedência, composição e instruções do fabricante; esta ficha não garante efeitos sobre outras pessoas.',
    positiveNotes:['Frasco de 25 ml identificado no cadastro; confira embalagem e procedência.'],
    negativeNotes:['Composição e efeitos de atração não verificados; a expressão comercial não é prova de resultado.', 'Fixação, projeção e tolerância individual não foram testadas.'],
    suppressRating:true,
  }],
  ['PfU3x9udsDbmj7DXjaCk', {
    model:/(?=.*mondial)(?=.*vsp[- ]?30[- ]?b)/i,
    correct:'Ventilador de Mesa Mondial VSP-30-B 30 cm — potência a confirmar',
    summary:'O Mondial VSP-30-B tem diâmetro de 30 cm, seis pás, três velocidades, oscilação lateral e inclinação regulável documentados na página oficial. Há divergência de potência na própria fonte: título de 55 W e tabela de 60 W. Não escolhemos um valor nem presumimos equivalência entre versões. Confirme a etiqueta e a documentação da unidade antes de decidir por potência ou consumo. Não testamos vazão, ruído ou consumo e não garantimos silêncio ou refrigeração do ambiente.',
    positiveNotes:['Ajustes de velocidade, oscilação e inclinação documentados para o VSP-30-B.'],
    negativeNotes:['Potência a confirmar: página oficial diverge entre 55 W e 60 W.', 'Sem teste de vazão, ruído ou consumo; não é uma promessa de ar-condicionado.'],
    sourceUrl:'https://www.mondial.com.br/ventilador-de-mesa-mondial-6-pas-vsp-30-b/p',sourceLabel:'Mondial — VSP-30-B, divergência de potência a confirmar',reviewedAt:'2026-10-30',suppressRating:true,
  }],
  ['NUNROG3VOfMVViIW5Rtk', {
    model:/(?=.*arno)(?=.*gpto)/i,
    summary:'O Arno Compact GPTO tem placas antiaderentes em formato de grelha e placa superior ajustável documentadas no catálogo público da marca. A ficha distingue 850 W na versão 127 V e 700 W na versão 220 V; não publicamos 850 W como potência de qualquer unidade nem descrevemos o aparelho como bivolt. Não confirmamos placas removíveis ou uso em lava-louças. Quantidade de porções, tempo e resultado dependem do alimento; não fizemos teste de receitas ou do revestimento.',
    positiveNotes:['Placa superior ajustável e revestimento antiaderente documentados para o GPTO.'],
    negativeNotes:['Potência varia por tensão: 850 W em 127 V e 700 W em 220 V.', 'Placas removíveis, rendimento e desempenho não confirmados por teste.'],
    sourceUrl:'https://www.arno.com.br/grill-arno-compact-preto-gpto-8010001307_pai-1/p',sourceLabel:'Arno — GPTO e versões de tensão',reviewedAt:'2026-10-30',suppressRating:true,
  }],
  ['dMbluI9x5kQ0Gwxg8fOU', {
    model:/(?=.*lg)(?=.*43lr6700psa)/i,
    summary:'A LG 43LR6700PSA tem tela Full HD de 43 polegadas, frequência nativa de 60 Hz, processador alpha 5 AI Gen 6 e webOS 23 documentados na página oficial do código. Compatibilidade com Smart Magic não significa controle incluído: a fonte lista controle padrão e o Smart Magic vendido separadamente. Confira os requisitos das funções de voz e aplicativos. Não a descrevemos como 4K ou 120 Hz e não testamos brilho, contraste, imagem ou latência.',
    positiveNotes:['Full HD, 60 Hz e conexões documentados para o código exato.'],
    negativeNotes:['Smart Magic vendido separadamente na ficha; confira conjunto e requisitos de voz.', 'Recursos HDR e AI não equivalem a resultado de teste de imagem.'],
    sourceUrl:'https://www.lg.com/br/small-medium-business/tvs-e-soundbars/smart-tvs/43lr6700psa/',sourceLabel:'LG Brasil — 43LR6700PSA, painel e controle',reviewedAt:'2026-10-30',suppressRating:true,
  }],
  ['UlgA45nNx2rsEykMbv67', {
    model:/(?=.*samsung)(?=.*u8600f)/i,
    summary:'A Samsung U8600F de 50 polegadas documentada no Brasil, código UN50U8600FGXZD, tem resolução 4K de 3840 × 2160, painel de 60 Hz e sistema Tizen. Gaming Hub depende de internet, conta e condições dos parceiros; não significa jogos ou assinaturas pagos incluídos. Motion Xcelerator e processamento não transformam o painel em 120 Hz. Não testamos imagem, latência, som ou aplicativos e não transferimos recursos de outro tamanho ou código.',
    positiveNotes:['Resolução 4K e frequência de 60 Hz documentadas para a versão brasileira de 50 polegadas.'],
    negativeNotes:['Serviços podem exigir contas, pagamentos e acessórios separados.', 'Sem ensaio de imagem ou jogos; não atribuímos painel de 120 Hz.'],
    sourceUrl:'https://www.samsung.com/br/tvs/uhd-4k-tv/u8600f-50-inch-crystal-uhd-4k-smart-tv-un50u8600fgxzd/',sourceLabel:'Samsung Brasil — U8600F 50, especificações e condições',reviewedAt:'2026-10-30',suppressRating:true,
  }],
  ['MBhoRb0kSLsHrhutbTLN', {
    model:/(?=.*mondial)(?=.*c[- ]?21[- ]?e[- ]?cnp)/i,
    summary:'A Mondial C-21-E-CNP Dolce Crema permite café em pó e acompanha adaptador para cápsulas Nespresso, segundo a página oficial. O adaptador para cápsulas Dolce Gusto é vendido separadamente. A marca descreve reservatório removível de 1,2 litro e bico vaporizador. A pressão nominal de 20 bar não é uma medição independente de qualidade, sabor ou tempo de preparo. Não garantimos rendimento fixo de xícaras nem resultado profissional; não testamos a bebida ou o equipamento. Confira acessórios e tensão no anúncio.',
    positiveNotes:['Uso de pó e adaptador Nespresso incluído documentados para a C-21-E-CNP.'],
    negativeNotes:['Adaptador Dolce Gusto separado; não confundir compatibilidade com acessório incluído.', 'Sabor, temperatura e rapidez não foram testados; pressão nominal não garante resultado.'],
    sourceUrl:'https://www.mondial.com.br/cafeteira-espresso-mondial-dolce-crema-20-bar-capsula-po-c-21-e-cnp/p',sourceLabel:'Mondial — C-21-E-CNP, configuração e acessórios',reviewedAt:'2026-10-30',suppressRating:true,
  }],
  ['M9arBHEFyVVMelHK70ml', {
    model:/(?=.*philco)(?=.*plq04a)/i,
    summary:'A página oficial do Philco PLQ04A informa 400 W, dois squeezes de 600 ml com tampa e quatro lâminas em inox. Os dois recipientes não equivalem a uma jarra única de 1,2 litro. Portátil não comprova alimentação a bateria ou autonomia. O manual completo não foi recuperado nesta revisão; não confirmamos ingredientes duros, líquidos quentes, ciclos ou peças permitidas na lava-louças. A afirmação anterior sobre lavagem das peças não é mantida como comprovada. Confira alimentação, tensão, montagem e manual da unidade; sem teste de trituração ou vedação.',
    positiveNotes:['Dois copos de 600 ml com tampa documentados na descrição oficial do PLQ04A.'],
    negativeNotes:['Receitas, ciclos e limpeza dependem do manual; não presumimos peças liberadas para lava-louças.', 'Não confirmamos bateria ou autonomia só pelo termo portátil.'],
    sourceUrl:'https://www.philco.com.br/blender-liquidificador-portatil-philco-400w-600ml-plq04a/p',sourceLabel:'Philco — PLQ04A, apresentação oficial',reviewedAt:'2026-10-30',suppressRating:true,
  }],
  ['mWdbAKSL36ZpIPwUTbdv', {
    model:/(?=.*intelbras)(?=.*im7)(?=.*3\s*mp)/i,
    summary:'A Intelbras iM7+ 3MP Full Color tem resolução de 2304 × 1296, microfone e alto-falante, movimento motorizado e proteção IP66 documentados na ficha oficial. Não é a iM7+ Zoom: não transferimos os recursos dessa outra versão. O alcance de movimento não representa visão simultânea de todo o entorno. A capacidade de microSD não comprova cartão incluído. A ficha oficial informa 565 g; o peso anterior de 423 g foi retirado por divergência. Não testamos imagem, rastreamento ou resistência.',
    positiveNotes:['Resolução 3MP e áudio bidirecional documentados para a iM7+ 3MP.'],
    negativeNotes:['Rotação não significa cobertura simultânea ou detecção infalível.', 'Não atribuímos zoom híbrido de outra versão nem cartão automaticamente incluído.'],
    sourceUrl:'https://backend.intelbras.com/sites/default/files/2024-11/Datasheet%20-%20iM7%2B%203MP%20-%20C%C3%A2mera%20externa%20inteligente%203MP%20Wi-Fi%20Full%20Color.pdf',sourceLabel:'Intelbras — iM7+ 3MP, ficha específica',reviewedAt:'2026-10-30',suppressRating:true,
  }],
  ['37zRkLVqUxzOjxBLGhO1', {
    model:/(?=.*intelbras)(?=.*im7\s*s)/i,
    summary:'A Intelbras iM7 S Full Color é uma câmera externa Full HD com microfone e proteção IP66 documentados na ficha da versão. Escuta não equivale a conversa bidirecional: o tutorial da marca diferencia esse recurso dos modelos iM7+. Não transferimos a resolução 3MP ou o zoom híbrido de outras versões. Não garantimos identificação noturna, cobertura simultânea ou detecção de todos os eventos. Fonte e conexões exigem proteção conforme as instruções; não testamos o produto.',
    positiveNotes:['Full HD, microfone e aplicação externa IP66 documentados para a iM7 S.'],
    negativeNotes:['Microfone não é promessa de áudio bidirecional; tutorial oficial lista a iM7 S sem essa função.', 'Cartão e gravação dependem do conjunto e da configuração; não garantimos prazo de retenção.'],
    sourceUrl:'https://backend.intelbras.com/sites/default/files/2024-11/Datasheet%20-%20iM7%20S%20Full%20Color%20-%20C%C3%A2mera%20externa%20inteligente%20Full%20HD%20Wi-Fi%20Full%20Color.pdf',sourceLabel:'Intelbras — iM7 S Full Color, sem copiar outras versões',reviewedAt:'2026-10-30',suppressRating:true,
  }],
  ['cq6GYICiBnjXrygHzhaO', {
    model:/elsys.*esc[- ]?wb3f/i,
    summary:'A Elsys ESC-WB3F é uma câmera externa Wi-Fi Full HD com infravermelho e configuração pelo ELSYS HOME documentados no guia oficial. A proteção IP66 da câmera não dispensa proteger fonte e conexões conforme o manual. A afirmação anterior de zoom óptico não foi comprovada e foi retirada; não usamos o número antigo como especificação. O guia condiciona a detecção à distância, posição e iluminação. Não testamos imagem, alcance, identificação ou detecção e não alteramos o anúncio nem o link de afiliado.',
    positiveNotes:['Guia oficial do modelo documenta instalação externa e configuração pelo ELSYS HOME.'],
    negativeNotes:['Zoom óptico não confirmado; afirmação anterior retirada.', 'Não garantimos detecção infalível ou identificação de detalhes à distância.'],
    sourceUrl:'https://elsys.com/wp-content/uploads/2022/09/GUIA_RAPIDO_ESC-WB3F.pdf',sourceLabel:'Elsys — guia oficial ESC-WB3F',reviewedAt:'2026-10-30',suppressRating:true,
  }],
  ['a77W30LAOCEPjWdkcAlU', {
    model:/asus(?=.*e1504fa[- ]?nj732)/i,
    correct:'Notebook ASUS Vivobook Go 15 E1504FA-NJ732 — processador a confirmar',
    summary:'O cadastro identifica o ASUS Vivobook Go 15 E1504FA-NJ732 com 8 GB de RAM, SSD de 512 GB e KeepOS. O título anterior anunciava Ryzen 5 7520U, mas a página oficial atual do mesmo código informa Ryzen 5 40. Não presumimos equivalência entre os nomes nem qual unidade será entregue. Confirme processador, identificação completa e configuração com o vendedor. Não testamos desempenho, expansão ou autonomia e não mudamos os links do cadastro.',
    positiveNotes:['Código E1504FA-NJ732 e configuração de memória/armazenamento identificados na fonte oficial.'],
    negativeNotes:['Processador divergente entre cadastro e página oficial atual; confirmar a unidade.', 'Sem teste de desempenho ou confirmação de expansão.'],
    sourceUrl:'https://br.store.asus.com/notebook-asus-vivobook-go-15-e1504fa-nj732-mixed-black-fhd-nivel-ips.html',sourceLabel:'ASUS E1504FA-NJ732 — divergência de processador a confirmar',reviewedAt:'2026-10-30',suppressRating:true,
  }],
  ['mlMLB6907306094', {
    model:/huawei.*\bbe3\b/i,
    summary:'A Huawei documenta o WiFi BE3 com bandas de 2,4 e 5 GHz, Wi-Fi 7, uma interface Ethernet de até 2,5 Gb/s e três interfaces Gigabit. As taxas sem fio são teóricas e não garantem velocidade real da internet. A descrição anterior continha unidades inconsistentes de velocidade e dimensões; esses valores foram retirados. A ficha oficial fornece dimensões em milímetros. Confira a versão, as conexões e os requisitos dos equipamentos. Não testamos cobertura, latência ou velocidade.',
    positiveNotes:['Wi-Fi 7 dual band e interfaces Ethernet documentados pela Huawei.'],
    negativeNotes:['Taxas teóricas não são velocidade garantida; não testamos a rede.', 'Não presumimos banda de 6 GHz ou que todas as portas sejam de 2,5 Gb/s.'],
    sourceUrl:'https://consumer.huawei.com/br/routers/wifi-be3/specs/',sourceLabel:'Huawei — WiFi BE3, especificações oficiais',reviewedAt:'2026-10-30',suppressRating:true,
  }],
  ['mlMLB4330065589', {
    model:/^c[âa]mera(?=.*seguran[cç]a)(?=.*wi-fi)(?=.*dupla lente)(?=.*(?:8\s*mp|resolu[cç][aã]o a confirmar))/i,
    correct:'Câmera de segurança Wi-Fi PTZ com dupla lente — resolução a confirmar',
    summary:'Este cadastro identifica uma câmera de segurança Wi-Fi PTZ com dupla lente anunciada. O título e a descrição anteriores apresentavam resoluções contraditórias; não escolhemos uma delas por suposição nem tratamos a indicação 4K como comprovação independente. Confirme marca, modelo exato, resolução de cada lente, aplicativo e alimentação no anúncio e na documentação do equipamento. Não testamos imagem, visão noturna, áudio, resistência ao tempo ou segurança da conexão.',
    positiveNotes:['Wi-Fi, movimentação PTZ e dupla lente constam no título cadastrado; confirme no anúncio da unidade.'],
    negativeNotes:['Resolução e modelo exato precisam de confirmação: as informações do cadastro eram contraditórias.', 'Qualidade de imagem, resistência ao tempo e segurança da conexão não foram testadas.'],
    suppressRating:true,
  }],
  ['mlMLB4952988337', {
    model:/conversor.*fibra.*10\/100\/1000\s*mbps.*u\s*maisu/i,
    summary:'O cadastro identifica um conversor de fibra óptica U Maisu cujo título anuncia Ethernet RJ45 10/100/1000 Mbps. A descrição anterior informava 1000 MB/s: megabytes por segundo (MB/s) e megabits por segundo (Mbps) são unidades diferentes, e esse valor não é publicado como velocidade comprovada. Não medimos taxa de transferência, alcance óptico ou compatibilidade com Starlink. Confirme tipo de fibra, conectores, alimentação e compatibilidade entre os equipamentos antes de comprar. As informações do cadastro não substituem a documentação técnica do modelo.',
    positiveNotes:['Título anuncia conexão Ethernet RJ45 10/100/1000 Mbps; confirme o modelo e os requisitos na oferta.'],
    negativeNotes:['Velocidade real e alcance óptico não foram medidos; a unidade anterior era inconsistente.', 'Compatibilidade com Starlink e com os demais equipamentos não foi confirmada nesta revisão.'],
    suppressRating:true,
  }],
  ['mlMLB4644707253', {model:/lavadora.*alta\s*press[aã]o/i, category:'ferramentas'}],
  ['5bQKU9inL3pq14yE8K4L', {
    model:/soundcore.*\bp30i\b/i,
    summary:'O soundcore P30i é um fone TWS intra-auricular com ANC e modo transparência anunciados pela fabricante. A duração anunciada é de até 10 horas nos fones e até 45 horas com recargas no estojo; 45 horas não são uma sessão contínua. O estojo também funciona como apoio para celular. Não medimos áudio, conforto, ANC ou bateria real. Recursos ligados, volume e condições de uso alteram a autonomia.',
    positiveNotes:['ANC e modo transparência anunciados pela soundcore.', 'Estojo com função de apoio para celular, segundo a fabricante.'],
    negativeNotes:['As 45 horas incluem recargas no estojo, não duração contínua.', 'Eficácia do ANC, conforto e autonomia real não foram testados.'],
    sourceUrl:'https://www.soundcore.com/products/soundcore-p30i', sourceLabel:'soundcore P30i — especificações da fabricante', reviewedAt:'2026-10-19', suppressRating:true,
  }],
  ['FlqPY3yHJ2xPoNgnhSTE', {
    model:/galaxy.*buds\s*core/i,
    summary:'O Samsung Galaxy Buds Core é um fone TWS intra-auricular com ANC anunciado pela Samsung. A autonomia total com estojo anunciada é de até 35 horas com ANC desligado ou aproximadamente 20 horas com ANC ligado, incluindo recargas. Esses números não representam uma sessão contínua nos fones. As funções Galaxy AI exigem smartphone Galaxy compatível; os fones não traduzem de forma independente. Não testamos áudio, conforto, microfone ou autonomia real.',
    positiveNotes:['Cancelamento ativo de ruído (ANC) anunciado pela Samsung.', 'Bluetooth 5.4 informado pela fabricante para conexão compatível.'],
    negativeNotes:['Totais de 35/20 horas incluem estojo e têm condições de ANC diferentes.', 'Recursos Galaxy AI dependem de smartphone compatível; conforto e áudio não foram testados.'],
    sourceUrl:'https://news.samsung.com/br/samsung-anuncia-galaxy-buds-core-no-brasil-cancelamento-de-ruido-e-integracao-com-galaxy-ai-para-todos', sourceLabel:'Samsung — Galaxy Buds Core, recursos e condições de autonomia', reviewedAt:'2026-10-19', suppressRating:true,
  }],
  ['kYzXt8BeErDzXsC6BlwB', {
    model:/\bhavit\b.*\btw\s*982\b(?!\s*(?:pro|plus)\b)/i,
    summary:'O HAVIT LIFE 01T, modelo TW982, é um fone TWS com Bluetooth 5.4 e formato intra-auricular com ponteiras na apresentação oficial. A tabela da fabricante anuncia até 7,5 horas nos fones e 33 horas com recargas no estojo, a 60% do volume. O estojo usa USB-C. ENC anunciado para chamadas não comprova ANC para ouvir; não copiamos os recursos do TW982 Pro. Não testamos som, chamadas, conforto ou autonomia real.',
    positiveNotes:['Bluetooth 5.4 documentado na tabela oficial do TW982.', 'Até 7,5 horas nos fones e 33 horas com estojo anunciadas a 60% do volume.'],
    negativeNotes:['As 33 horas incluem recargas; a duração real depende do uso e do volume.', 'ANC para ouvir continua sem confirmação; não é a ficha do TW982 Pro.'],
    sourceUrl:'https://havitsmart.com/es/products/havit-life-01t-true-wireless-stereo-earbuds-tw982',
    specUrl:'https://cdn.shopify.com/s/files/1/0755/1365/9703/files/01T-_TW982_-page_-_-2024.05_14.jpg?v=1788255515',
    sourceLabel:'HAVIT LIFE 01T / TW982 — apresentação e tabela oficial', reviewedAt:'2026-10-20', suppressRating:true,
  }],
  ['SJRf3jhIFlr1BQadDNnH', {
    model:/\blenovo\b.*\bloq\b(?=.*\b15irx9\b)(?=.*\bi5[- ]?13450hx\b)(?=.*\brtx\s*3050\b)(?=.*\b8\s*gb\b)(?=.*\b512\s*gb\b)/i,
    summary:'O Lenovo LOQ 15IRX9 do SKU 83KH0001BR informado pelo responsável corresponde à configuração oficial com Core i5-13450HX, 8 GB de RAM DDR5 e SSD de 512 GB. A RTX 3050 para laptop tem 6 GB GDDR6 de memória de vídeo, separados da RAM do sistema. A Lenovo informa Windows 11 Home e tela FHD de 15,6 polegadas a 144 Hz. Confira o mesmo SKU e eventuais alterações do vendedor; não atribuímos desempenho de outras versões nem medimos jogos, temperatura ou autonomia.',
    positiveNotes:['Configuração de 8 GB de RAM e SSD de 512 GB documentada para o SKU 83KH0001BR.', 'RTX 3050 para laptop com 6 GB GDDR6 e tela FHD de 144 Hz informadas pela Lenovo.'],
    negativeNotes:['A RAM de 8 GB e a memória de vídeo de 6 GB são separadas; compare os requisitos dos seus programas.', 'Confira o SKU e modificações do vendedor. Desempenho em jogos, temperatura e bateria não foram testados.'],
    sourceUrl:'https://www.lenovo.com/br/pt/p/laptops/loq-laptops/88lq3001926/83kh0001br',sourceLabel:'Lenovo LOQ 15IRX9 83KH0001BR — configuração oficial',reviewedAt:'2026-10-20',suppressRating:true,
  }],
  ['AweCTxq7vwVQ7VmN4IIg', {
    model:/\bmercusys\b.*\bmr\s*80x\b.*\bv4\b/i,
    summary:'O MERCUSYS MR80X V4 é um roteador Wi-Fi 6 AX3000 dual band com portas Gigabit. A página brasileira da revisão V4 anuncia EasyMesh para rede com outros aparelhos compatíveis. Confira o firmware da unidade: a fabricante alerta para conflitos entre fornecedores e informa que o produto não obteve certificação Wi-Fi EasyMesh. AX3000 é classe de sinal, não internet de 3 Gbps; a WAN é Gigabit. Não testamos cobertura, estabilidade ou velocidade real.',
    positiveNotes:['Wi-Fi 6 dual band e portas Gigabit documentados para a revisão V4.', 'Compatibilidade EasyMesh anunciada na página brasileira V4, com condições de firmware.'],
    negativeNotes:['Um roteador sozinho não garante cobertura em todos os cômodos.', 'Confirme revisão e firmware dos aparelhos; compatibilidade anunciada não é certificação Wi-Fi EasyMesh.'],
    sourceUrl:'https://www.mercusys.com.br/product/wifi-router/mr80x/v4/',sourceLabel:'MERCUSYS MR80X V4 — página oficial brasileira',reviewedAt:'2026-10-20',suppressRating:true,
  }],
  ['VzQgxGhowdzlfNshI3ZC', {
    model:/power\s*bank.*20000mah/i,
    summary:'O cadastro identifica um power bank anunciado como 20.000 mAh. A potência está a confirmar: o título anterior informava 22,5 W e o resumo citava 20 W. Confirme o modelo, a potência por porta, os protocolos e o cabo necessários ao seu aparelho. Não medimos capacidade útil, velocidade de carga ou segurança elétrica e não comprovamos carregamento simultâneo de três aparelhos.',
    positiveNotes:['Capacidade nominal de 20.000 mAh informada no cadastro; não equivale à capacidade útil medida.'],
    negativeNotes:['Potência, protocolos e quantidade de saídas simultâneas precisam de confirmação no modelo oferecido.'], suppressRating:true,
  }],
  ['tqUaLEFDAafDWemxheMX', {
    model:/pendrive.*8gb.*usb.?c/i,
    summary:'O cadastro identifica um pendrive de 8 GB com conexões USB e USB-C anunciadas. Confirme os conectores, o suporte a OTG no celular e o formato dos arquivos. A velocidade de 140 MB/s e a proteção contra raios X citadas anteriormente não foram comprovadas nesta análise. Não testamos capacidade real, velocidade de gravação, resistência ou integridade dos arquivos.',
    positiveNotes:['Conexões USB e USB-C anunciadas; confirme a compatibilidade dos aparelhos.'],
    negativeNotes:['Velocidade, capacidade real e resistência não foram testadas. Não use como única cópia de arquivos importantes.'], suppressRating:true,
  }],
  ['7CSQkSXeUHn9yzYR29hF', {
    model:/pen\s*drive.*64gb.*usb\s*2/i,
    summary:'O cadastro identifica um pendrive anunciado como 64 GB com conector USB 2.0 e corpo metálico. Confirme capacidade, conector e compatibilidade no anúncio. Os valores de 52 MB/s de leitura e 20 MB/s de gravação citados anteriormente não foram comprovados nesta análise. Não testamos velocidade, resistência a impactos ou integridade dos arquivos.',
    positiveNotes:['Capacidade de 64 GB e conector USB 2.0 informados no cadastro; confirme a unidade oferecida.'],
    negativeNotes:['Velocidade e resistência não foram testadas. Mantenha outra cópia dos arquivos importantes.'], suppressRating:true,
  }],
  ['ARscPKCMZs3D8k22qltl', {
    model:/redmi.*buds\s*6\s*play/i,
    summary:'O cadastro identifica o Xiaomi Redmi Buds 6 Play M2420E1, com tecnologia True Wireless, estojo e microfone anunciados. A classificação IPX4 citada no cadastro não comprova proteção contra poeira nem autoriza mergulho. Confirme autonomia no fone, total com estojo e compatibilidade no anúncio e no manual. Não medimos conforto, áudio, microfone ou resistência.',
    positiveNotes:['Formato sem fio com estojo anunciado; confirme o modelo e os acessórios incluídos.'],
    negativeNotes:['Autonomia real, conforto e qualidade do microfone não foram medidos. IPX4 não comprova proteção contra poeira.'], suppressRating:true,
    sourceUrl:'https://www.mi.com/global/product/redmi-buds-6-play/', sourceLabel:'Redmi Buds 6 Play: especificações e limites informados pela Xiaomi',
  }],
  ['SJ6VQZLSc4brIArHnkRW', {model:/piscina.*infl[aá]vel/i, category:'esporte-e-lazer'}],
  ['gNcq5nSqWbfqYi1M9c23', {
    model:/apfer|lanterna/i, correct:'Lanterna LED Apfer recarregável',
    summary:'Lanterna LED Apfer identificada no cadastro. Os valores de fluxo luminoso, alcance e autonomia são alegações do anúncio, não medições da equipe. Não há comprovação de que seja a mais forte do mundo. Confirme modelo, bateria, carregador, modos e proteção contra água com o vendedor antes de comprar.',
    positiveNotes:['Alimentação recarregável anunciada; confirme bateria e carregador do conjunto.'],
    negativeNotes:['Fluxo luminoso, alcance e autonomia não foram verificados pela equipe.'], suppressRating:true,
  }],
  ['goH2juydLAa3JYXzctkH', {
    model:/basike/i, correct:'Fone Bluetooth Basike Ear Clip com Gancho',
    summary:'Fone Bluetooth Basike identificado no cadastro. Autonomia e modelo exato ainda precisam de confirmação. Latência de 0,0035 ms, redução de vazamento de 90% e promessa de impedir quedas são alegações do anúncio sem medição independente; não são usadas como vantagens comprovadas. Confira formato, bateria, encaixe e compatibilidade com o vendedor.',
    positiveNotes:['Conexão Bluetooth anunciada; confirme versão e compatibilidade.'],
    negativeNotes:['Autonomia, latência, vazamento de som e estabilidade do encaixe não foram medidos.'], suppressRating:true,
  }],
  ['YdPOVmrHVJ8EO7fmgyXu', {
    model:/computador|intel|\bpc\b/i,
    summary:'PC completo com Intel Core i5 de sexta geração, SSD de 240 GB e 8 GB de RAM anunciados no cadastro. O código exato do processador está a confirmar: “6” isolado não identifica o modelo nem comprova desempenho. Confira CPU completa, placa-mãe, memória, fonte, monitor e condições do conjunto com o vendedor. Não testamos desempenho ou durabilidade.',
    positiveNotes:['SSD de 240 GB e 8 GB de RAM anunciados; confirme o conjunto escolhido.'],
    negativeNotes:['Modelo exato do processador e componentes do conjunto a confirmar.'], suppressRating:true,
  }],
  ["Bp4dNosktHQXiSy3r9S0", {
    model: /(?:t?apete).*Casa Laura/i,
    replacements: [["apete Decorativo", "Tapete Decorativo"]],
  }],
  ["YuOWci2UixF5GuQE6IYS", {
    model: /HUAWEI.*AX2S/i,
    correct: "Roteador HUAWEI WiFi AX2S Wi-Fi 6 Preto",
    summary: 'O HUAWEI WiFi AX2S tem Wi-Fi 6 em 5 GHz, duas bandas simultâneas, portas Gigabit e recursos Mesh anunciados pela Huawei. A quantidade de portas está a confirmar: a visão geral oficial cita três entradas, enquanto a página de especificações informa quatro. Confira a revisão física exata e o firmware com o fabricante ou vendedor. Não medimos cobertura, velocidade ou estabilidade. Mesh requer equipamentos compatíveis e não garante sinal em todos os cômodos.',
    positiveNotes: ['Wi-Fi 6 em 5 GHz e bandas de 2,4/5 GHz informados pela Huawei.', 'Portas Gigabit e recursos Mesh anunciados; confirme a compatibilidade dos equipamentos.'],
    negativeNotes: ['Quantidade de portas divergente entre as próprias páginas oficiais; confirmar a revisão exata.', 'Cobertura e velocidade real não foram medidas; firmware e aparelhos compatíveis influenciam os recursos.'],
    sourceUrl:'https://consumer.huawei.com/br/routers/ax2s/', sourceLabel:'HUAWEI WiFi AX2S — recursos e divergência de especificações', reviewedAt:'2026-10-19', suppressRating:true,
    replacements: [["EasyMeshVisualização de Diagnósticos do Wi-Fi", "EasyMesh; controle do Wi-Fi"]],
  }],
  ["uc5ynLQTGAPKkIMIyzQ2", {
    model: /Lanterna.*Sabre.*Luz/i,
    correct: "Lanterna Tática Farolete Sabre de Luz LED",
    summary: "O cadastro identifica uma lanterna anunciada como Sabre de Luz, com alimentação por bateria e três modos de iluminação. A ficha anterior continha um valor de fluxo luminoso inconsistente e uma promessa de alcance de 2 km sem comprovação; essas alegações não são usadas nesta análise. Antes de comprar, confirme autonomia, tipo de bateria, carregador incluído, dimensões e fluxo luminoso documentado com o vendedor. Não medimos alcance, intensidade, resistência ou duração da bateria.",
    positiveNotes: ["Alimentação por bateria e modos de iluminação anunciados no cadastro; confirme o conjunto oferecido."],
    negativeNotes: ["Fluxo luminoso e alcance não comprovados; a medida anterior era inconsistente.", "Autonomia, resistência e conteúdo da caixa precisam de confirmação com o vendedor."],
    suppressRating: true,
    replacements: [["10000000000000000lm", "fluxo luminoso a confirmar"]],
  }],
  ["UCDnByA5YaWN9eiyA5IM", {
    model: /cama.*el[aá]stica.*3[,.]0?m/i,
    summary: "O cadastro identifica uma cama elástica infantil anunciada como 3,0 m com rede de proteção. A ficha anterior informava também diâmetro de 300 m, incompatível com o nome do produto; não publicamos essa medida como comprovada. Antes de comprar, confirme dimensões externas, espaço livre necessário, carga máxima, faixa etária, montagem e instruções de supervisão no manual e com o vendedor. Não testamos estrutura, molas, rede ou segurança deste conjunto.",
    positiveNotes: ["Cama elástica com rede de proteção identificada no cadastro; confirme o conjunto oferecido."],
    negativeNotes: ["Dimensões e carga máxima precisam de confirmação no manual; há medida inconsistente no cadastro.", "Rede não dispensa supervisão e não foi testada pela equipe."],
    suppressRating: true,
  }],
  ["Kyw9WRrxRLj36DL50JfQ", {
    model: /playstation\s*5/i,
    summary: "Este anúncio identifica um PlayStation 5 Edição Digital Slim CFI 2114B. A capacidade, os acessórios e a quantidade de controles deste kit devem ser conferidos diretamente na variante e na descrição do vendedor: a análise anterior não comprovava a inclusão de quatro controles. A edição digital não deve ser confundida com um pacote com leitor de discos. Confira modelo exato, procedência, garantia e conteúdo da caixa. Não realizamos testes deste aparelho.",
    positiveNotes: ["Modelo PS5 Edição Digital Slim identificado no cadastro; confira o código da unidade."],
    negativeNotes: ["Capacidade, quantidade de controles e conteúdo da caixa do kit não foram comprovados nesta revisão.", "Procedência, garantia e condição do aparelho precisam ser conferidas com o vendedor."],
    suppressRating: true,
  }],

  ["JY36kE95u7uCT7UJWvpt", {
    model: /\bnac\b|acetilciste[ií]na/i,
    summary: "O cadastro identifica um suplemento NAC de 600 mg em embalagem de 60 cápsulas. Confira a composição, o fabricante, o lote, a procedência e as instruções da embalagem com o vendedor. Não verificamos a regularidade ou a autenticidade deste lote e não realizamos testes do produto. Esta página não comprova efeitos sobre imunidade, desintoxicação, respiração ou envelhecimento, não promete prevenção ou tratamento de doenças e não orienta dose. Para avaliar adequação individual, procure um profissional de saúde.",
    positiveNotes: ["NAC de 600 mg e embalagem de 60 cápsulas identificados no cadastro; confirme o rótulo."],
    negativeNotes: ["Regularidade, composição e autenticidade do lote não foram verificadas nesta revisão.", "Não há comprovação clínica ou teste independente nesta página; não usamos promessas de saúde como motivo de compra."],
    suppressRating: true,
  }],
  ["dsddqlXmq1JumgBMwtm0", {
    // Limitar a proteção ao título legado contraditório. A Casa na Árvore dos
    // Sonhos de 504 peças foi identificada pelas fotos e aprovada em 17/10/2026;
    // seu novo título/ficha não devem ser substituídos pelo aviso antigo.
    model: /^(?:Blocos de Montar Brastoy,\s*Magnéticos|Blocos Magnéticos de Montar Brastoy\b)/i,
    correct: "Blocos Magnéticos de Montar Brastoy — Quantidade a confirmar",
    replacements: [["Blocos de Montar Brastoy, Magnéticos, com 504 Peças | Bloco magnetico", "Blocos Magnéticos de Montar Brastoy — Quantidade a confirmar"]],
    summary: "O cadastro identifica blocos magnéticos de montar Brastoy. A quantidade de peças está a confirmar: o título e o texto anteriores informavam quantidades diferentes, e a variante do anúncio ainda não foi verificada. Antes de comprar, confirme o conjunto selecionado, o número de peças, as dimensões, a faixa etária e as advertências na embalagem com o vendedor. Não testamos força dos ímãs, resistência ou segurança do conjunto e não comprovamos benefícios educacionais. Não escolha esta oferta apenas por uma quantidade ainda não confirmada.",
    positiveNotes: ["Blocos magnéticos de montar identificados no cadastro; confirme o conjunto oferecido."],
    negativeNotes: ["Quantidade de peças e variante do anúncio a confirmar.", "Resistência, ímãs, certificação e adequação à idade não foram verificados pela equipe."],
    suppressRating: true,
  }],
  ["SUBPibuHNUsgB6zVTL5r", {
    model: /webcam/i,
    category: "informatica",
    categoryReplacements: [["<span>Categoria</span>Notebook", "<span>Categoria</span>Informática"], ["\"category\":\"Notebook\"", "\"category\":\"Informática\""], ["\"name\":\"Notebook\",\"item\":\"https://rankingdacompra.com.br/melhores-notebook.html\"", "\"name\":\"Informática\",\"item\":\"https://rankingdacompra.com.br/analises.html#informatica\""], ["href=\"https://rankingdacompra.com.br/melhores-notebook.html\">Notebook</a>", "href=\"https://rankingdacompra.com.br/analises.html#informatica\">Informática</a>"]],
  }],
  ["ik7zBiCAAqDLqr9Di5Ue", {model: /roku.*streaming\s*stick/i, category: 'informatica'}],
  ["6mZ1ahzme9kUH1UdSkJw", {model: /starlink/i, category: 'informatica'}],
  ["uIZQISdVd0NEyClG29Qv", {model: /access\s*point.*grandstream/i, category: 'informatica'}],
  ["HJcpaZe94VZRnomC2hH1", {
    model: /(?:logitech.*m90|m90.*logitech)/i,
    categoryReplacements: [["Kit Teclado e Mouse Sem Fio", "Teclados e mouses"], ["Kit teclado e mouse sem fio", "Teclados e mouses"]],
  }],
  ["vMno2u6iDC5eZJug2sOH", {
    model: /logitech.*k120/i,
    categoryReplacements: [["Kit Teclado e Mouse Sem Fio", "Teclados e mouses"], ["Kit teclado e mouse sem fio", "Teclados e mouses"]],
  }],
  ["31Lco0eFCDaomsks3iM3", {
    model: /wap.*power\s*speed\s*max/i,
    summary: "O WAP Power Speed Max tem potência anunciada de 1.600 W, reservatório de 1,3 litro, filtro HEPA e cabo de 5 metros, conforme a WAP. Compare-o para limpeza de pisos e uso portátil com os acessórios indicados no manual. Confira a tensão e o tamanho do reservatório para sua rotina. Não medimos sucção, ruído ou retenção de partículas; a alegação do fabricante sobre filtragem não é prova de benefício clínico para quem tem alergias.",
    positiveNotes: ["Reservatório de 1,3 litro e cabo de 5 metros informados pela WAP.", "Filtro HEPA e acessórios para uso portátil anunciados pelo fabricante."],
    negativeNotes: ["Sucção, ruído e filtragem não foram medidos pela equipe.", "Confira tensão e instruções de limpeza do filtro; não há comprovação clínica nesta análise."],
    sourceUrl: "https://loja.wap.ind.br/wap-power-speed-max--1/p", sourceLabel: "WAP Power Speed Max",
  }],
  ["CFEyN1hdeMSM6BS89h5o", {
    model: /creatina.*dark\s*lab/i,
    summary: "O anúncio identifica creatina monohidratada Dark Lab em pote de 300 g. Confira fabricante, lote, lacre, ingredientes e procedência na embalagem recebida. Esta revisão não verificou laudos laboratoriais, percentuais de pureza nem autenticidade do lote; não usamos esses números como motivo de recomendação. Não há garantia de ganho de força ou desempenho e esta página não substitui orientação profissional. O preço válido é o exibido com a data de conferência, não uma cotação fixa no texto.",
    positiveNotes: ["Embalagem de 300 g identificada no cadastro; confirme a unidade oferecida."],
    negativeNotes: ["Laudos, pureza e autenticidade do lote não foram comprovados nesta revisão.", "Resultados individuais não foram avaliados; não há orientação de dose nesta análise."],
  }],
  ["MHUka27wtlYZaI8FiHWi", {
    model: /(?:i?phone)\s*17\s*pro\s*max/i,
    correct: "iPhone 17 Pro Max 256GB — Laranja-cósmico",
    replacements: [["Phone 17 Pro Max 256GB - Laranja-cósmico - Distribuidor Autorizado", "iPhone 17 Pro Max 256GB — Laranja-cósmico"]],
    summary: "O iPhone 17 Pro Max tem chip A19 Pro e tela OLED de 6,9 polegadas com ProMotion de até 120 Hz, conforme a Apple. Este cadastro identifica a versão de 256 GB na cor laranja-cósmico. Compare tamanho e compatibilidade com sua rotina. Confirme procedência, garantia e a versão oferecida pelo vendedor; esta análise não comprova que ele seja distribuidor autorizado. Não realizamos testes de câmera, desempenho ou autonomia e não garantimos ausência de travamentos.",
    positiveNotes: ["Chip A19 Pro e tela OLED de 6,9 polegadas informados pela Apple.", "ProMotion com atualização adaptativa de até 120 Hz anunciado pelo fabricante."],
    negativeNotes: ["Desempenho, câmera e autonomia real não foram testados pela equipe.", "Procedência e condição de distribuidor autorizado do vendedor não foram verificadas."],
    sourceUrl: "https://support.apple.com/pt-br/125091", sourceLabel: "iPhone 17 Pro Max",
  }],
  ["W309Bngb9vy88pxNSAn5", {
    model: /rexona.*clinical.*classic/i,
    summary: "Este cadastro identifica um kit com duas unidades de Rexona Clinical Classic de 58 g. Confira a quantidade, a composição e as instruções na embalagem original. Não verificamos testes dermatológicos, ausência de resíduos ou adequação individual; o nome Clinical não comprova essas condições. Esta revisão não garante duração da proteção nem tolerância da pele e não substitui orientação profissional.",
    positiveNotes: ["Kit de duas unidades de 58 g identificado no cadastro; confirme o anúncio."],
    negativeNotes: ["Proteção, resíduos e tolerância da pele não foram testados pela equipe.", "Composição e instruções devem ser verificadas na embalagem original."],
  }],
  ["zuvOrERyR2wVRA9ZmYGe", {
    model: /raytechno/i,
    summary: "O anúncio identifica uma câmera em formato de lâmpada Raytechno com Wi-Fi e resolução Full HD. Antes de escolher, confirme soquete, aplicativo, rede compatível, armazenamento e alimentação. Não medimos qualidade noturna, campo de visão ou detecção de movimento. A câmera não garante ausência de pontos cegos ou prevenção de incidentes; recursos anunciados e segurança do aplicativo precisam de verificação.",
    positiveNotes: ["Formato de lâmpada e conexão Wi-Fi identificados no cadastro; confira a unidade."],
    negativeNotes: ["Qualidade de imagem, campo de visão e detecção não foram testados.", "Confira aplicativo, armazenamento, alimentação e compatibilidade de rede antes da compra."],
  }],
  ["sHEb67lHKhApfbREU1O0", {
    model: /crowley/i,
    summary: "Este cadastro identifica um controle sem fio Crowley. Confirme as plataformas e jogos suportados, a conexão exigida e os itens incluídos. Não testamos pareamento, latência, autonomia ou ergonomia. Bluetooth e aparência semelhante a outro controle não comprovam compatibilidade com todo videogame, televisão ou computador; não há garantia de funcionamento universal.",
    positiveNotes: ["Controle sem fio identificado no anúncio; confira acessórios e conexão."],
    negativeNotes: ["Pareamento, latência e autonomia não foram testados.", "Compatibilidade com cada plataforma e jogo deve ser confirmada no manual."],
  }],
  ["L6r4zuqqN2t7yWZsQUxo", {
    model: /ventilador.*acampamento.*led/i,
    summary: "O cadastro identifica um ventilador portátil recarregável para acampamento com iluminação LED. Compare recarga, dimensões, suporte e uso previsto antes de comprar. Não medimos vazão de ar, ruído ou autonomia; números do anúncio não garantem silêncio, conforto no sono ou duração em qualquer velocidade. Confirme orientações de uso e proteção contra água.",
    positiveNotes: ["Formato portátil, recarga e iluminação LED identificados no cadastro."],
    negativeNotes: ["Vazão, ruído e autonomia não foram medidos pela equipe.", "Confira recarga, suporte e orientações para uso ao ar livre."],
  }],
  ["r2AJAqnKZR0UvB1V4MRz", {
    model: /impressora.*t[eé]rmica.*110\s*mm/i,
    summary: "O anúncio identifica uma impressora térmica para etiquetas de até 110 mm com Bluetooth e USB. Confirme a largura aceita, aplicativo, drivers e compatibilidade com seu sistema. Não testamos etiquetas de transportadoras, códigos de barras ou conexão em Android, iOS, Windows e macOS; não há garantia de compatibilidade universal. Confira tamanho e quantidade dos rolos incluídos.",
    positiveNotes: ["Bluetooth, USB e largura de 110 mm identificados no anúncio; confira o manual."],
    negativeNotes: ["Drivers, aplicativos e etiquetas de transportadoras não foram testados.", "Confirme sistema operacional, largura das etiquetas e consumíveis antes da compra."],
  }],
  ["GjHJtzdsIhbmSINvhPeX", {
    model: /\btune\s*520\s*bt\b/i,
    sourceLabel: "JBL Tune 520BT",
    metaSummary: "JBL Tune 520BT: fone on-ear Bluetooth 5.3, até 57 h anunciadas e sem ANC. Compare vantagens, limitações e preço com data de conferência.",
    summary: "O JBL Tune 520BT é um fone on-ear Bluetooth 5.3 para música e chamadas. O fabricante informa até 57 horas de bateria; a duração real varia com volume e uso. Não possui cancelamento ativo de ruído (ANC): o isolamento é passivo. Considere-o para uso cotidiano se você aceita o formato apoiado nas orelhas; para ambientes muito ruidosos, compare alternativas com ANC. Não realizamos testes de conforto ou de qualidade do microfone.",
    positiveNotes: ["Bluetooth 5.3 informado na ficha técnica da JBL.", "Autonomia anunciada de até 57 horas; resultado real depende do uso."],
    negativeNotes: ["Sem cancelamento ativo de ruído (ANC), conforme o fabricante.", "Formato on-ear apoiado nas orelhas: conforto após longos períodos não foi testado pela equipe."],
    sourceUrl: "https://www.jbl.com.br/blog/comparativo-jbl-tune-530bt-e-520bt.html",
    specUrl: "https://www.jbl.com.br/on/demandware.static/-/Sites-masterCatalog_Harman/default/dwbfd4b4ce/pdfs/JBL%20Tune%20520BT_%20Specsheet_PTBR.pdf",
    fileReplacements: [["Cancelamento ativo de ruído — não confirmado", "Cancelamento ativo de ruído — ausente, conforme a JBL"]],
  }],
  ["hrVMdybD738SpffBFQIq", {
    incorrect: "00mlgarrafa Térmica Água Squeeze Inox Academiaquente E Frio",
    correct: "Garrafa Térmica 800 ml em Aço Inox para Academia — Quente e Frio",
    replacements: [
      ["00mlgarrafa Térmica Água Squeeze Inox Academiaquente E Frio", "Garrafa Térmica 800 ml em Aço Inox para Academia — Quente e Frio"],
      ["00mlgarrafa Térmica Água Squeeze Inox…", "Garrafa Térmica 800 ml em Aço Inox…"],
    ],
  }],
  ["dvJusdTpbTVn5ID62YpK", {
    model: /\bmatepad\s*se\s*11\b/i,
    incorrect: "ablet HUAWEI MatePad SE 11 Wifi 6+128GB Tela HUAWEI FullView de 11\" para Conforto Visual, Superbateria de 7700 mAh 225W Câmera Traseira 8 MP, Câmera Frontal 5 MP Cinza Nebula",
    correct: "Tablet HUAWEI MatePad SE 11 Wifi 6+128GB Tela HUAWEI FullView de 11\" para Conforto Visual, Superbateria de 7700 mAh 225W Câmera Traseira 8 MP, Câmera Frontal 5 MP Cinza Nebula",
    replacements: [
      ["ablet HUAWEI MatePad SE 11", "Tablet HUAWEI MatePad SE 11"],
      ["7700 mAh 225W", "7700 mAh 22,5 W"],
    ],
    summary: "O HUAWEI MatePad SE 11 tem tela de 11 polegadas com resolução de 1920 × 1200 e corpo em metal, conforme a ficha oficial. O fabricante informa bateria de 7.700 mAh e carregamento de até 22,5 W. Pode ser considerado para leitura e vídeos; confirme a compatibilidade dos aplicativos que você usa e a configuração de memória do anúncio. Não medimos desempenho, autonomia real ou conforto visual em testes próprios.",
    metaSummary: "HUAWEI MatePad SE 11: tela de 11 polegadas, 1920 × 1200 e bateria de 7.700 mAh. Confira limitações e compatibilidade antes de comprar.",
    sourceUrl: "https://consumer.huawei.com/br/tablets/matepad-se-11/",
    specUrl: "https://consumer.huawei.com/br/tablets/matepad-se-11/specs/",
    sourceLabel: "HUAWEI MatePad SE 11",
    positiveNotes: [
      "Tela de 11 polegadas e resolução de 1920 × 1200 informadas pela HUAWEI.",
      "Bateria de 7.700 mAh e carregamento de até 22,5 W anunciados pelo fabricante.",
      "Corpo em metal; peso anunciado de 475 g.",
    ],
    negativeNotes: ["Confirme a compatibilidade dos aplicativos e acessórios antes da compra.", "Desempenho e autonomia real não foram medidos pela equipe."],
  }],
  ["EmrdwlcDgCCM5suoz8dB", {
    model: /\bepson\b.*\bl3250\b/i,
    incorrect: "mpressora 3x1 Multifuncional Epson Ecotank L3250 Wifi Bivol Preto",
    correct: "Impressora 3x1 Multifuncional Epson Ecotank L3250 Wifi Bivol Preto",
    replacements: [
      ["mpressora 3x1 Multifuncional Epson Ecotank L3250", "Impressora 3x1 Multifuncional Epson Ecotank L3250"],
    ],
    summary: "A Epson EcoTank L3250 imprime, copia e digitaliza com tanque de tinta, USB, Wi-Fi e Wi-Fi Direct. A Epson anuncia até 4.500 páginas em preto ou 7.500 coloridas com tintas de reposição originais; o rendimento real varia com o documento e o uso. O aplicativo Epson Smart Panel permite configurar e operar a impressora. Compare o custo da tinta e a compatibilidade com seu sistema antes de comprar. Não medimos rendimento, velocidade ou qualidade de impressão; comandos de voz não foram confirmados nesta revisão.",
    metaSummary: EPSON_DESCRIPTION,
    sourceUrl: "https://epson.com.br/Para-casa/Impressoras/Impressoras-jato-de-tinta/Impressora-Multifuncional-3-em-1-Epson-EcoTank%C2%AE-L3250/p/C11CJ67303",
    sourceLabel: "Epson EcoTank L3250",
    positiveNotes: ["USB, Wi-Fi e Wi-Fi Direct informados pela Epson.", "Até 4.500 páginas em preto ou 7.500 coloridas anunciadas com tintas de reposição originais; o rendimento real varia.", "Configuração e operação pelo Epson Smart Panel, conforme o fabricante."],
    negativeNotes: ["Rendimento e qualidade de impressão não foram medidos pela equipe.", "Confirme custos de tinta, compatibilidade do sistema e os recursos necessários antes de comprar."],
  }],
  ["TLWfr8q21DK8xDKMh01u", {
    model: /celimax.*retinal\s*shot/i,
    summary: "Este cadastro identifica o Celimax Retinal Shot Tightening Booster de 15 ml. A identidade, os ingredientes e as orientações de uso devem ser confirmados na embalagem original e nas instruções do fabricante. Não tratamos a expressão do anúncio como indicação para todos os tipos de pele, uso diurno ou garantia de resultado. Não realizamos teste dermatológico e esta página não substitui orientação profissional.",
    metaSummary: "Celimax Retinal Shot Tightening Booster 15 ml: confira identidade, embalagem original e instruções do fabricante antes de comprar.",
    positiveNotes: ["O anúncio identifica o produto e a embalagem de 15 ml; confira a unidade recebida."],
    negativeNotes: ["Adequação ao seu tipo de pele e instruções de uso não foram verificadas nesta revisão.", "Resultados cosméticos e tolerância não foram testados pela equipe."],
    incorrect: "Celimax Retinal Shot Tightening Booster 15ml Pele Corean clip-icon Celimax Retinal Shot Tightening Booster 15ml Pele Corean Celimax Retinal Shot Tightening Booster 15ml Pele CoreanCelimax Retinal Shot Tightening Booster 15ml Pele Corean Celimax Retinal Shot Tightening Booster 15ml Pele Corean Conferir mais produtos da marca Celimax Novo | +5 mil vendidos Celimax Retinal Shot Tightening Booster 15ml Pele Corean",
    correct: "Celimax Retinal Shot Tightening Booster 15 ml",
    replacements: [
      ["Celimax Retinal Shot Tightening Booster 15ml Pele Corean clip-icon Celimax Retinal Shot Tightening Booster 15ml Pele Corean Celimax Retinal Shot Tightening Booster 15ml Pele CoreanCelimax Retinal Shot Tightening Booster 15ml Pele Corean Celimax Retinal Shot Tightening Booster 15ml Pele Corean Conferir mais produtos da marca Celimax Novo | +5 mil vendidos Celimax Retinal Shot Tightening Booster 15ml Pele Corean", "Celimax Retinal Shot Tightening Booster 15 ml"],
      ["Celimax Retinal Shot Tightening Booster 15 ml para Todos os Tipos de Pele", "Celimax Retinal Shot Tightening Booster 15 ml"],
    ],
  }],
  ["5MGE98tYssH9nEfBeHoW", {
    category: "relogio-smartwatch",
    categoryReplacements: [
      ["Beleza  Cuidados e Saúde", "relógio/smartwatch"],
      ["?cat=belezaecuidados", "?cat=relogio-smartwatch"],
      ["<li>82&quot; com brilho de 2500 nits para visualização sob luz solar.</li>", "<li>Tela AMOLED de 1,82&quot; com brilho de 2500 nits para visualização sob luz solar.</li>"],
      ["\"name\":\"82\\\" com brilho de 2500 nits para visualização sob luz solar.\"", "\"name\":\"Tela AMOLED de 1,82\\\" com brilho de 2500 nits para visualização sob luz solar.\""],
    ],
  }],
  ["avV2oOE8xcX9ioG4GNnT", {
    model:/^bicicleta.*gts.*rdx/i,
    category:'bicicletas',
    fileReplacements: [
      ["apenas que é alumínio.", "O anúncio informa que o quadro é de alumínio, mas não especifica a liga utilizada."],
    ],
  }],
  ["c3K3tq0esVOpmKeSLd9a", {
    model: /\bquad\s*fry\b/i,
    correct: "Air Fryer Elgin Quad Fry 4,2 L 1.400 W Preta",
    replacements: [["Fritadeira Elétrica Air Fryer Quad Fry 4,2 L,1400w Preto Elgi", "Air Fryer Elgin Quad Fry 4,2 L 1.400 W Preta"]],
    summary: "A Elgin Quad Fry tem capacidade de 4,2 litros e potência de 1.400 W, conforme o fabricante. Compare o tamanho das porções e o espaço disponível na cozinha; a capacidade nominal não informa quantas pessoas cada preparo atende. Confirme a tensão da unidade escolhida e as orientações do manual. Não realizamos testes de tempo de preparo, consumo de energia ou resultado dos alimentos.",
    metaSummary: "Elgin Quad Fry: air fryer de 4,2 litros e 1.400 W anunciados. Confira tensão, espaço e limitações antes de comprar.",
    sourceUrl: "https://www.elgin.com.br/Fritadeira-Air-fryer-Quad-Fry-1400W-42L-Preta-com-Tecnologia-Air-Circuit-360/p",
    sourceLabel: "Elgin Quad Fry",
    fileReplacements: [
      ["potência de 1400W para um aquecimento rápido. Características informadas no cadastro: Fritadeira Elétrica Air Fryer Quad Fry 4", "Capacidade de 4,2 litros e potência de 1.400 W para aquecimento rápido."],
      ["capacidade limitada para preparos em grande escala. A ficha cadastrada não detalha outras limitações além das informações apresentadas", "A capacidade de 4,2 litros pode ser limitada para preparos em grande escala."],
    ],
    positiveNotes: [
      "Capacidade nominal de 4,2 litros anunciada pela Elgin.",
      "Potência de 1.400 W informada pelo fabricante; não é medição de velocidade ou consumo.",
    ],
    negativeNotes: [
      "Confira a tensão da unidade e as dimensões antes da compra.",
      "Tempo de preparo, consumo real e resultado dos alimentos não foram medidos pela equipe.",
    ],
  }],
  ["Ct4VSBOaVTJkcxhiAyGJ", {
    fileReplacements: [
      ["memória RAM de 6GB para fluidez, tela ampla de 11 polegadas. Características informadas no cadastro: Tablet Samsung Galaxy Tab A11+", "Memória RAM de 6 GB para maior fluidez e tela ampla de 11 polegadas."],
    ],
    positiveNotes: [
      "Memória RAM de 6 GB para maior fluidez nas tarefas do dia a dia.",
      "Tela ampla de 11 polegadas para vídeos, leitura e produtividade.",
    ],
    negativeNotes: [
      "Confirme no anúncio a compatibilidade de acessórios e a versão do sistema antes da compra.",
    ],
  }],
  ["6kC1jJj7i4kRtYyp3SZr", {
    incorrect: "Patinete Elétrico",
    correct: "Patinete Elétrico Ydtech M187 Dobrável com Bluetooth",
    suppressRating: true,
    fileReplacements: [
      ["Patinete Elétrico Ydtech M187 Dobrável com Bluetooth Ydtech M187 Dobrável com Bluetooth", "Patinete Elétrico Ydtech M187 Dobrável com Bluetooth"],
      ["<span>Categoria</span>Patinete Elétrico Ydtech M187 Dobrável com Bluetooth", "<span>Categoria</span>Patinete Elétrico"],
      ["\"position\":2,\"name\":\"Patinete Elétrico Ydtech M187 Dobrável com Bluetooth\",\"item\"", "\"position\":2,\"name\":\"Patinete Elétrico\",\"item\""],
      ["\"category\":\"Patinete Elétrico Ydtech M187 Dobrável com Bluetooth\",\"url\"", "\"category\":\"Patinete Elétrico\",\"url\""],
    ],
  }],
  ["VyYiww5HVcBRIH8SD5SD", {
    suppressRating: true,
  }],
  ["qZUWO8WSrcOKWVrAqTW7", {
    model: /\bex\s*1500\b/i,
    summary: "O TP-Link EX1500 é um roteador AX1500 dual band com Wi-Fi 6, portas Gigabit e compatibilidade EasyMesh anunciados pela TP-Link. EasyMesh requer outros equipamentos compatíveis; um roteador sozinho não garante sinal em todos os cômodos. A classe AX1500 não equivale à velocidade medida em um único aparelho. Compare a posição do modem, paredes, portas e compatibilidade antes de comprar. Não medimos alcance, estabilidade ou latência.",
    metaSummary: "TP-Link EX1500: Wi-Fi 6, Gigabit e EasyMesh anunciados. Compare compatibilidade e limitações; cobertura real não foi medida.",
    sourceUrl: "https://www.tp-link.com/br/home-networking/wifi-router/ex1500/",
    sourceLabel: "TP-Link EX1500",
    positiveNotes: ["Wi-Fi 6 dual band e portas Gigabit informados pela TP-Link.", "Compatibilidade EasyMesh anunciada para uso com outros equipamentos compatíveis."],
    negativeNotes: ["Cobertura, latência e estabilidade não foram medidas em teste próprio.", "A velocidade real depende do aparelho, posição, interferência e plano de internet; AX1500 não é velocidade garantida."],
  }],
  ["9P123IBTTYnSCMilPvXB", {
    model: /\bamazfit\b.*\bbip\s*6\b(?!\s*(?:pro|max|active)\b)/i,
    correct: 'Smartwatch Amazfit Bip 6 com GPS e tela AMOLED de 1,97 polegada',
    summary: 'O Amazfit Bip 6 tem GPS integrado, chamadas Bluetooth com o celular conectado e tela AMOLED de 1,97 polegada, segundo a fabricante. A classificação de resistência à água é 5 ATM, com restrições no manual; não atribuímos um código IP não confirmado. A fonte consultada cita Zepp Flow em regiões selecionadas, não confirma Alexa. Confira o aplicativo Zepp e a compatibilidade do celular antes de comprar. Não testamos precisão, chamadas ou autonomia.',
    positiveNotes: ['GPS integrado documentado para registrar atividades.', 'Chamadas Bluetooth anunciadas, usando o celular conectado.'],
    negativeNotes: ['Alexa não foi confirmada na fonte oficial consultada.', 'Sensores não são diagnóstico médico; siga as restrições de uso na água.'],
    sourceUrl: 'https://br.amazfit.com/products/amazfit-bip-6', sourceLabel: 'Amazfit Bip 6 — documentação oficial', reviewedAt: '2026-10-20', suppressRating: true,
  }],
  ["5MGE98tYssH9nEfBeHoW", {
    model: /\bhuawei\b.*\bwatch\s*fit\s*5\b(?!\s*(?:pro|max)\b)/i,
    correct: 'Smartwatch HUAWEI WATCH FIT 5 com GPS e tela AMOLED de 1,82 polegada',
    summary: 'O HUAWEI WATCH FIT 5 tem tela AMOLED de 1,82 polegada e GPS integrado, conforme a ficha oficial internacional do modelo, não Pro. A ficha distingue IP6X para poeira de resistência à água de 5 ATM, sujeita às restrições do manual. A alegação anterior de 64 GB não foi confirmada e foi retirada do título, sem atribuir outra capacidade. Confirme a variante e os recursos disponíveis na região. Não testamos sensores, conforto ou autonomia.',
    positiveNotes: ['Tela AMOLED de 1,82 polegada documentada para o WATCH FIT 5.', 'GPS integrado com dupla banda L1 + L5 na ficha oficial.'],
    negativeNotes: ['A capacidade de armazenamento de 64 GB não foi confirmada.', 'IP6X não significa IP68; água e condições regionais exigem atenção ao manual.'],
    sourceUrl: 'https://consumer.huawei.com/ma/wearables/watch-fit5/specs/', sourceLabel: 'HUAWEI WATCH FIT 5 — ficha oficial internacional', reviewedAt: '2026-10-20', suppressRating: true,
  }],
]);

for (const [id, review] of HIGHLIGHT_EDITORIAL) {
  PRODUCT_CORRECTIONS.set(id, {...PRODUCT_CORRECTIONS.get(id), ...review});
}

for (const [id, review] of EXISTING_OFFER_REVIEWS) PRODUCT_CORRECTIONS.set(id, review);
const PRE_LISTING_CORRECTIONS=new Map(PRODUCT_CORRECTIONS);
for(const [id,review]of MARKETPLACE_FIELD_REVIEWS)if(review.summary) {
  PRODUCT_CORRECTIONS.set(id,{...PRODUCT_CORRECTIONS.get(id),model:review.model,summary:review.summary,
    ...(review.replacements?{replacements:review.replacements}:{}),
    positiveNotes:review.positiveNotes,negativeNotes:review.negativeNotes,sourceUrl:review.sourceUrl,
    sourceKind:'marketplace-listing',sourceLabel:'Anúncio do vendedor no Mercado Livre',reviewedAt:review.reviewedAt,specUrl:undefined,suppressRating:true});
}

function correctionFor(product) {
  const id=String(product?.id||'');
  let correction = PRODUCT_CORRECTIONS.get(id);
  if (correction?.expectedListing && !matchesExistingOffer(product, correction.expectedListing)) return undefined;
  // Old safeguards (for example removing unsupported superlatives) still
  // apply when the exact current listing cannot be established. They do not
  // grant permission to attach this review's new seller-declared facts.
  if(correction?.sourceKind==='marketplace-listing' && MARKETPLACE_FIELD_REVIEWS.has(id) && !listingReviewFor(product))correction=PRE_LISTING_CORRECTIONS.get(id);
  // Um cadastro pode ser reutilizado. Nunca aplicar a ficha do modelo anterior
  // só porque o ID continua igual; a identidade atual precisa corresponder.
  if(correction?.sourceKind==='marketplace-listing' && !documentedSpecifications(product)) return undefined;
  return correction?.model && !correction.model.test(String(product?.titulo || "")) ? undefined : correction;
}

export function manufacturerEvidence(product) {
  const correction = correctionFor(product);
  if(correction?.sourceKind==='marketplace-listing')return null;
  const documented = documentedSpecifications(product);
  const source = documented?.features.find(f=>f.state!=='unknown' && f.basis==='fabricante' && f.sourceUrl);
  if (source) return {sourceUrl:source.sourceUrl, model:documented.scope, checkedAt:documented.checkedAt, kind:'manufacturer-specification', independentTest:false};
  return correction?.summary && correction.sourceUrl && correction.sourceKind!=='marketplace-listing'
    ? {sourceUrl: correction.sourceUrl, model: correction.sourceLabel, checkedAt: correction.reviewedAt || "2026-10-06", kind: "manufacturer-specification", independentTest: false}
    : null;
}

export function correctProductData(product) {
  const correction = correctionFor(product);
  const applyReplacements = (value) => (correction?.replacements || []).reduce(
    (current, [incorrect, correct]) => replaceKnownText(String(current || ""), incorrect, correct),
    String(value || ""),
  );
  return {
    ...product,
    titulo: applyReplacements(correction?.correct || product?.titulo).replace(/\s+/g, " ").trim(),
    comentario: correction?.summary || applyReplacements(product?.comentario),
    pros: correction?.summary ? correction.positiveNotes.join("\n") : applyReplacements(product?.pros),
    contras: correction?.summary ? correction.negativeNotes.join("\n") : applyReplacements(product?.contras),
    ...(typeof product?.dadosTecnicos === 'string' ? {dadosTecnicos: applyReplacements(product.dadosTecnicos)} : {}),
    categoria: correction?.category || product?.categoria,
    // Conservar a nota original para revisão, sem publicá-la como avaliação comprovada.
    notaInformada: product?.notaInformada ?? product?.nota ?? "",
    nota: !correction?.suppressRating && hasDocumentedEditorialRating(product) ? product?.nota : "",
  };
}

export function hasDocumentedEditorialRating(product) {
  const evidence = product?.avaliacaoEditorial;
  const rating = Number(product?.nota);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5 || !evidence) return false;
  const reviewedAt = Date.parse(evidence.revisadoEm || '');
  return typeof evidence.criterios === 'string' && evidence.criterios.trim().length >= 30
    && typeof evidence.responsavel === 'string' && evidence.responsavel.trim().length > 2
    && /^https?:\/\//.test(String(evidence.fonte || ''))
    && Number.isFinite(reviewedAt) && reviewedAt <= Date.now();
}

export const correctProductTitle = correctProductData;

function visibleText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}

function continuation(value) {
  return /^[a-záàâãéêíóôõúüç]/u.test(visibleText(value));
}

function capitalizeEditorialItem(value) {
  return String(value || "").replace(
    /^(\s*)([a-záàâãéêíóôõúüç])/u,
    (_, spaces, letter) => spaces + letter.toLocaleUpperCase("pt-BR"),
  );
}

function mergeEditorialItems(items) {
  const merged = [];
  for (const rawItem of items.map((item) => String(item || "").trim()).filter(Boolean)) {
    if (merged.length && continuation(rawItem)) {
      const previous = merged.pop();
      const separator = /[,;:]$/.test(visibleText(previous)) ? " " : ", ";
      merged.push(previous + separator + rawItem);
    } else {
      merged.push(capitalizeEditorialItem(rawItem));
    }
  }
  return merged;
}

function repairStructuredEditorialItems(content) {
  return content.replace(
    /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (full, start, source, end) => {
      let payload;
      try { payload = JSON.parse(source); } catch { return full; }
      const nodes = Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [payload];
      const product = nodes.find((node) => node?.["@type"] === "Product");
      const review = Array.isArray(product?.review) ? product.review[0] : product?.review;
      let changed = false;
      for (const key of ["positiveNotes", "negativeNotes"]) {
        const list = review?.[key];
        if (!Array.isArray(list?.itemListElement)) continue;
        const original = list.itemListElement.map((item) => String(item?.name || "")).filter(Boolean);
        const repaired = mergeEditorialItems(original);
        if (JSON.stringify(original) === JSON.stringify(repaired)) continue;
        list.itemListElement = repaired.map((name, index) => ({ "@type": "ListItem", position: index + 1, name }));
        changed = true;
      }
      return changed ? start + JSON.stringify(payload).replace(/</g, "\\u003c") + end : full;
    },
  );
}

function repairVisibleEditorialItems(content) {
  return content.replace(
    /(<section\b[^>]*class=["'][^"']*panel\s+(?:positive|attention)[^"']*["'][^>]*>[\s\S]*?<ul>)([\s\S]*?)(<\/ul>)/gi,
    (full, start, list, end) => {
      const items = [...list.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((match) => match[1]);
      if (!items.length) return full;
      return start + mergeEditorialItems(items).map((item) => `<li>${item}</li>`).join("") + end;
    },
  );
}

function replaceKnownText(content, incorrect, correct) {
  const escaped = String(incorrect).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Alguns textos incorretos começam sem a primeira letra ("ablet",
  // "mpressora"). A borda à esquerda impede que uma nova execução encontre
  // esse trecho dentro de "Tablet"/"Impressora" e duplique a letra.
  return content.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}`, "gu"), correct);
}

function repairRepeatedInitials(content) {
  return content
    .replace(/\bT+Tablet HUAWEI MatePad SE 11/gu, "Tablet HUAWEI MatePad SE 11")
    .replace(/\bI+Impressora 3x1 Multifuncional Epson Ecotank L3250/gu, "Impressora 3x1 Multifuncional Epson Ecotank L3250");
}

function applyEditorialOverrides(content, correction) {
  for (const [property, sectionClass] of [["positiveNotes", "positive"], ["negativeNotes", "attention"]]) {
    const notes = correction?.[property];
    if (!Array.isArray(notes) || !notes.length) continue;
    content = content.replace(
      /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
      (full, start, source, end) => {
        let payload;
        try { payload = JSON.parse(source); } catch { return full; }
        const nodes = Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [payload];
        const product = nodes.find((node) => node?.["@type"] === "Product");
        const review = Array.isArray(product?.review) ? product.review[0] : product?.review;
        if (!review) return full;
        review[property] = {
          "@type": "ItemList",
          itemListElement: notes.map((name, index) => ({ "@type": "ListItem", position: index + 1, name })),
        };
        return start + JSON.stringify(payload).replace(/</g, "\\u003c") + end;
      },
    );
    const sectionPattern = new RegExp(`(<section\\b[^>]*class=["'][^"']*panel\\s+${sectionClass}[^"']*["'][^>]*>[\\s\\S]*?<ul>)[\\s\\S]*?(<\\/ul>)`, "gi");
    content = content.replace(sectionPattern, (_, start, end) =>
      start + notes.map((note) => `<li>${note}</li>`).join("") + end,
    );
  }
  return content;
}

function suppressUnreliableRating(content) {
  const withoutVisibleRating = content.replace(/<div\b[^>]*class=["'][^"']*rating[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "");
  return withoutVisibleRating.replace(
    /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
    (full, start, source, end) => {
      let payload;
      try { payload = JSON.parse(source); } catch { return full; }
      const nodes = Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [payload];
      const product = nodes.find((node) => node?.["@type"] === "Product");
      const reviews = Array.isArray(product?.review) ? product.review : product?.review ? [product.review] : [];
      if (!reviews.length) return full;
      for (const review of reviews) delete review.reviewRating;
      return start + JSON.stringify(payload).replace(/</g, "\\u003c") + end;
    },
  );
}

export async function correctGeneratedProductTitles(rootDirectory = process.cwd()) {
  const files = [resolve(rootDirectory, "analises.html"), resolve(rootDirectory, "top5-semanal.json")];
  const productDirectory = resolve(rootDirectory, "produto");
  try {
    for (const entry of await readdir(productDirectory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".html")) files.push(resolve(productDirectory, entry.name));
    }
  } catch {
    // O diretório ainda pode não existir na primeira execução do gerador.
  }

  let updatedFiles = 0;
  const weeklyFile = resolve(rootDirectory, 'top5-semanal.json');
  try {
    const weekly = JSON.parse(await readFile(weeklyFile, 'utf8'));
    if (Array.isArray(weekly.products)) {
      const before = JSON.stringify(weekly.products);
      weekly.products = weekly.products.map(correctProductData);
      if (JSON.stringify(weekly.products) !== before) {
        await writeFile(weeklyFile, JSON.stringify(weekly, null, 2) + '\n', 'utf8');
        updatedFiles += 1;
      }
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const catalogueFile = resolve(rootDirectory, "vitrine-publica.json");
  try {
    const catalogue = JSON.parse(await readFile(catalogueFile, "utf8"));
    if (Array.isArray(catalogue.products)) {
      const before = JSON.stringify(catalogue.products);
      catalogue.products = catalogue.products.map(correctProductData);
      if (JSON.stringify(catalogue.products) !== before) {
        await writeFile(catalogueFile, JSON.stringify(catalogue, null, 2) + "\n", "utf8");
        updatedFiles += 1;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const file of files) {
    let content;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    let corrected = repairRepeatedInitials(content);
    for (const correction of PRODUCT_CORRECTIONS.values()) {
      for (const [incorrect, correct] of correction.replacements || []) {
        corrected = replaceKnownText(corrected, incorrect, correct);
      }
    }
    const fileName = basename(file);
    for (const [productId, correction] of PRODUCT_CORRECTIONS) {
      if (!fileName.startsWith(productId + "-")) continue;
      const heading = visibleText(corrected.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
        || corrected.match(/<title>([\s\S]*?)<\/title>/i)?.[1]
        || (() => { try { const payload = JSON.parse(corrected.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)?.[1] || '{}'); return (payload['@graph'] || [payload]).find(n => n['@type'] === 'Product')?.name || ''; } catch { return ''; } })());
      if (correction.model && !correction.model.test(heading)) continue;
      if (correction.expectedListing) {
        const sourceUrl = corrected.match(/<meta\b[^>]*name=["']rdc-offer-url["'][^>]*content=["']([^"']+)["']/i)?.[1];
        if (!sourceUrl || !matchesExistingOffer({link: sourceUrl.replace(/&amp;/g, '&')}, correction.expectedListing)) continue;
      }
      if (correction.correct) corrected = applyVerifiedTitle(corrected, correction.correct, correction.syncInformationalSchema);
      const categoryLabel = {informatica:'Informática',carro:'Carro',bicicletas:'Bicicletas'}[correction.category];
      if (categoryLabel) {
        const categoryUrl = 'https://rankingdacompra.com.br/analises.html#'+correction.category;
        corrected = corrected.replace(/(<span>Categoria<\/span>)[^<]*(<\/div>)/, '$1'+categoryLabel+'$2');
        corrected = corrected.replace(/(<nav class="crumb"[^>]*>[\s\S]*?<\/a>\s*\/\s*)<a[^>]*>[^<]*<\/a>/, '$1<a href="'+categoryUrl+'">'+categoryLabel+'</a>');
        corrected = corrected.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (full, a, source, b) => {
          let payload; try { payload = JSON.parse(source); } catch { return full; }
          for (const node of payload['@graph'] || [payload]) {
            if (node['@type'] === 'Product') node.category = categoryLabel;
            if (node['@type'] === 'BreadcrumbList') for (const item of node.itemListElement || []) if (item.position === 2) {item.name = categoryLabel; item.item = categoryUrl;}
          }
          return a + JSON.stringify(payload).replace(/</g, '\\u003c') + b;
        });
      }
      for (const [incorrect, correct] of correction.categoryReplacements || []) {
        corrected = corrected.split(incorrect).join(correct);
      }
      for (const [incorrect, correct] of correction.fileReplacements || []) {
        corrected = corrected.split(incorrect).join(correct);
      }
      corrected = applyEditorialOverrides(corrected, correction);
      if (correction.summary) corrected = applyVerifiedSummary(corrected, correction);
      if (correction.suppressRating) corrected = suppressUnreliableRating(corrected);
    }
    if (fileName.endsWith(".html") && fileName !== "analises.html") {
      // Páginas antigas não têm a documentação exigida para sustentar uma nota numérica.
      if (!/<meta name="rdc-rating-documented" content="true">/.test(corrected)) {
        const hadRating = /<div\b[^>]*class=["'][^"']*rating|"reviewRating"/.test(corrected);
        corrected = suppressUnreliableRating(corrected);
        if (hadRating && !corrected.includes('data-rating-provenance')) {
          corrected = corrected.replace(/(<p class="summary">[\s\S]*?<\/p>)/,
            '$1<p class="fine" data-rating-provenance>Sem nota numérica publicada: a origem e os critérios da nota antiga não estão documentados. Compare as características anunciadas e os limites desta análise; isto não é avaliação de compradores nem teste prático.</p>');
        }
      }
      corrected = repairStructuredEditorialItems(corrected);
      corrected = repairVisibleEditorialItems(corrected);
    }
    if (corrected !== content) {
      await writeFile(file, corrected, "utf8");
      updatedFiles += 1;
    }
  }
  return updatedFiles;
}

function applyVerifiedTitle(content, title, syncInformationalSchema = false) {
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  content = content.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/, `<h1>${esc(title)}</h1>`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)} | Ranking da Compra</title>`)
    .replace(/(<meta (?:name="twitter:title"|property="og:title") content=")[^"]*(">)/g, (_, a, b) => a + esc(title) + b)
    .replace(/(<img class="photo"[^>]*alt=")[^"]*(")/, (_, a, b) => a + esc(title) + b);
  content = content.replace(/<details class="full-title">[\s\S]*?<\/details>/, '')
    .replace(/(<nav class="crumb"[^>]*>[\s\S]*<\/a>\s*\/\s*)[^<]*(<\/nav>)/, (_, a, b) => a + esc(title) + b);
  return content.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (full, a, source, b) => {
    let payload; try { payload = JSON.parse(source); } catch { return full; }
    for (const node of payload['@graph'] || [payload]) {
      if (node['@type'] === 'Product') node.name = title;
      if (syncInformationalSchema && node['@type'] === 'Article' && ['Product','Thing'].includes(node.about?.['@type'])) {
        node.about.name = title;
        node.headline = title;
      }
      if (node['@type'] === 'BreadcrumbList') for (const item of node.itemListElement || []) if (item.position === 3) item.name = title;
    }
    return a + JSON.stringify(payload).replace(/</g, '\\u003c') + b;
  });
}

function applyVerifiedSummary(content, correction) {
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const short = correction.metaSummary || correction.summary;
  content = content.replace(/(<p class="summary">)[\s\S]*?(<\/p>)/, (_, a, b) => a + esc(correction.summary) + b);
  content = content.replace(/(<meta (?:name="(?:description|twitter:description)"|property="og:description") content=")[^"]*(">)/g, (_, a, b) => a + esc(short) + b);
  content = content.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (full, a, source, b) => {
    let payload; try { payload = JSON.parse(source); } catch { return full; }
    const nodes = payload['@graph'] || [payload], product = nodes.find(n => n['@type'] === 'Product');
    if (!product) {
      if (!correction.syncInformationalSchema) return full;
      const article = nodes.find(n=>n['@type']==='Article' && ['Product','Thing'].includes(n.about?.['@type']));
      if (!article) return full;
      article.description = correction.summary;
      return a + JSON.stringify(payload).replace(/</g, "\\u003c") + b;
    }
    product.description = correction.summary;
    for (const review of Array.isArray(product.review) ? product.review : product.review ? [product.review] : []) review.reviewBody = correction.summary;
    return a + JSON.stringify(payload).replace(/</g, "\\u003c") + b;
  });
  const source = correction.sourceKind==='marketplace-listing' && correction.sourceUrl
    ? `<p class="fine" data-verified-listing>Fonte: <a href="${esc(correction.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(correction.sourceLabel)}</a>. Informações do anúncio do vendedor, não validação independente ou teste do produto.</p>`
    : correction.sourceUrl
    ? `<p class="fine" data-verified-manufacturer>Fonte do fabricante: <a href="${esc(correction.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(correction.sourceLabel)}</a>${correction.specUrl ? ` e <a href="${esc(correction.specUrl)}" target="_blank" rel="noopener noreferrer">ficha técnica oficial</a>` : ''}. Especificações anunciadas, não medição independente.</p>`
    : `<p class="fine" data-editorial-limit>Esta revisão remove afirmações sem comprovação; não significa validação técnica ou teste do produto.</p>`;
  content = content.replace(/<p class="fine" data-(?:verified-manufacturer|verified-listing|editorial-limit)>[\s\S]*?<\/p>/g, "");
  return content.replace(/(<p class="fine source">[\s\S]*?<\/p>)/, "$1" + source);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const updatedFiles = await correctGeneratedProductTitles();
  console.log(`Títulos conhecidos corrigidos em ${updatedFiles} arquivo(s).`);
}
