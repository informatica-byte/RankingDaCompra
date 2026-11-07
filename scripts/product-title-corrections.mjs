import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { HIGHLIGHT_EDITORIAL } from './highlight-editorial.mjs';
import { documentedSpecifications } from './manufacturer-specifications.mjs';
import { MARKETPLACE_FIELD_REVIEWS,listingReviewFor } from './marketplace-field-reviews.mjs';
import {EPSON_DESCRIPTION} from './public-seo-labels.mjs';

import { EXISTING_OFFER_REVIEWS, matchesExistingOffer } from './existing-offer-reviews.mjs';
const PRODUCT_CORRECTIONS = new Map([
  ["x75GETnbI3P4zycAKwOI",{syncInformationalSchema:true,model:/^Perfume Masculino Eau de Toilette Azzaro - Azzaro Pour Homme 100 ml$/i,summary:"A oferta identifica o Azzaro Pour Homme Eau de Toilette de 100 mL. A Azzaro descreve a fragrância como aromática e amadeirada, com destaque para anis-estrelado, lavanda e vetiver. Essa descrição é da marca, não de um teste de fixação ou projeção. Confira o volume e a apresentação do frasco no anúncio.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.azzaro.com/en/fragrances/azzaro-pour-homme",contextSourceLabel:"Referência da marca",suppressRating:true}],
  ["xbXvQNhfLeV7MLszyz6X",{syncInformationalSchema:true,model:/^(?:Patinete Elétrico iX7Pro Xroymexroy Adulto Bateria 17\.5Ah Grande Autonomia 80km|Patinete elétrico dobrável iX7Pro Xroymexroy)$/i,correct:"Patinete elétrico dobrável iX7Pro Xroymexroy",summary:"A oferta identifica um patinete dobrável iX7Pro Xroymexroy com bateria anunciada de 17,5 Ah e dois motores. Os números de até 80 km de autonomia e 60 km/h são alegações da oferta, não medições desta ficha. As condições de teste e o regime dos 2.000 W anunciados não estão confirmados. Confira a identificação na etiqueta e as condições de garantia e assistência da unidade.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["XGM5P52X6EJc7X55vC8Y",{syncInformationalSchema:true,model:/^(?:Jarra Vidro Borossilicato 1\.4L Tampa Inox Resistente Cor Transparente|Jarra de vidro borossilicato 1,4 L com tampa inox)$/i,correct:"Jarra de vidro borossilicato 1,4 L com tampa inox",summary:"A oferta identifica uma jarra transparente de 1,4 L da Class Home, com corpo de vidro borossilicato, alça e tampa de inox. O material não confirma vedação contra vazamentos nem uma faixa segura de temperatura. Se pretende servir bebidas quentes ou colocar a jarra na lava-louças, confira as instruções do modelo; a ficha não testou vedação nem choque térmico.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["WO8eJVPACXCORVzrdNVh",{syncInformationalSchema:true,expectedListing:'MLB5150671412',model:/^Guitarra E Microfone Infantil Instrumento Brinquedo Musical Cor Rosa Atentu$/i,summary:"A oferta identifica o kit rosa de guitarra e microfone Atentu. O registro 007615/2024 do Inmetro lista a referência GUITMIC-RS, movida a pilhas, para crianças a partir de 3 anos. O anúncio menciona conexão com celular, mas não esclarece o conector nem confirma cabo incluso. Confira a referência na embalagem, o tipo e a quantidade de pilhas.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://registro.inmetro.gov.br/consulta/detalhe.aspx?NumeroRegistro=007615%2F2024&pag=1",contextSourceLabel:"Referência documental",suppressRating:true}],
  ["WZIrFRxgOFZ1skyzk5SS",{syncInformationalSchema:true,model:/^Combo Siàge Nutri Diamond Shampoo, Condicionador E Máscara$/i,summary:"A oferta apresenta o combo Siàge Nutri Diamond com shampoo, condicionador e máscara. A Eudora lista um trio dessa linha com shampoo de 250 mL, condicionador de 200 mL e máscara de 250 g; confirme se a oferta corresponde a essas embalagens. A marca posiciona a linha para cabelos secos, opacos ou com frizz. Esta ficha não testou o resultado nos fios.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.eudora.com.br/produto/combo-siage-nutri-diamond-shampoo-250ml-condicionador-200ml-mascara-capilar-250g",contextSourceLabel:"Referência documental",suppressRating:true}],
  ["mlMLB4841103289",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4841103289',model:/^(?:Garrafa Térmica Água Personalizada 800ml Inox Academia)$/i,summary:"A oferta anuncia uma garrafa térmica de 800 mL em inox, com tampa rosqueável e alça. Os tempos de até um dia para bebidas frias e 12 horas para quentes são alegações do anúncio, não resultados de teste desta ficha. Confira como funciona a personalização e quais peças acompanham a unidade. Não verificamos vedação nem a alegação de ausência de BPA.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["wAsxhijcNyAq9AblyLkN",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB3873397755',model:/^(?:Wap Aspirador De Pó E Líquido Portátil Gtw Compact 1400w)$/i,summary:"A WAP documenta o GTW Compact de 1.400 W com recipiente de 5,5 L de volume total e capacidades úteis distintas: 2,5 L para líquidos e 2,3 L para sólidos. Os 5,3 L da ficha anterior não correspondem ao volume informado pela marca. Confira a tensão e os filtros da unidade. A potência elétrica não equivale à sucção medida.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://mais.conteudo.wap.ind.br/wap/produtos/aspirador/barril/aspirador_gtw_compact_fw009439_fw009440/arquivos/apresentacao/apresentacao_gtw_compact.pdf",contextSourceLabel:"Referência da marca",suppressRating:true}],
  ["wiLibtvJlFYtSbDWLtcv",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB5477527702',model:/^(?:Sandália Ortopédica Boaonda Adventure Super Leve Conforto|Calçado Boaonda Adventure)$/i,correct:"Calçado Boaonda Adventure",summary:"A Boaonda descreve o Adventure como um clog anatômico de EVA. O termo ortopédica aparece no anúncio, mas não comprova indicação terapêutica ou correção de problemas nos pés. MLB5477527702 é o código do anúncio, não de catálogo. Confira a cor e a numeração da variante; esta ficha não testou ajuste ou conforto.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://inside.boaonda.com.br/modelo/adventure/",contextSourceLabel:"Referência da marca",suppressRating:true}],
  ["WjjOZFdWS3sKRCoFAH7r",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4020676149',model:/^(?:Camiseta Basica Masculina Algodão Lisa Malha Peruana Premium|Camiseta masculina lisa Stateless Fashion)$/i,correct:"Camiseta masculina lisa Stateless Fashion",summary:"A oferta identifica uma camiseta masculina lisa Stateless Fashion e anuncia malha de algodão. A expressão malha peruana no título não confirma a origem da peça ou do tecido, nem a composição percentual. MLB4020676149 identifica o anúncio, não o catálogo. Confira a etiqueta, as medidas e a cor da variante antes de escolher.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["vr2uogxbiKqrQx1MYdD9",{syncInformationalSchema:true,allowTruncatedHeading:true,model:/^(?:Smartphone Motorola Moto g35 5G - 128GB 12GB \(4GB RAM\+8GB Ram Boost\) e Camera 50MP com AI NFC Tela 6\.7" com Superbrilho - Verde - Vegan Leather|Motorola Moto G35 5G verde — 128 GB e 4 GB de RAM)$/i,correct:"Motorola Moto G35 5G verde — 128 GB e 4 GB de RAM",summary:"A oferta identifica o Moto G35 5G verde com 128 GB. Na ficha da Motorola para essa versão, são 4 GB de RAM física e até 8 GB de expansão virtual via RAM Boost, não 12 GB de RAM física. A marca documenta tela de 6,7 polegadas, câmera principal de 50 MP e NFC. Esta ficha não testou desempenho ou autonomia.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.motorola.com.br/smartphone-moto-g35-5g-128gb/p?idsku=1612",contextSourceLabel:"Referência da marca",suppressRating:true}],
  ["VyYiww5HVcBRIH8SD5SD",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB6563286992',model:/^(?:Patinete Elétrico V01premium 500w7\.8a Amortecedor Hidráulico|Patinete elétrico V01 Premium — 500 W anunciados)$/i,correct:"Patinete elétrico V01 Premium — 500 W anunciados",summary:"A oferta identifica um patinete elétrico V01 Premium com suspensão hidráulica anunciada. O título cita 500 W, sem esclarecer se a potência é nominal ou de pico; também não distingue corrente de capacidade da bateria na indicação de 7,8 A. Confirme esses dados, a autonomia e os limites de uso no manual. A ficha não testou frenagem, suspensão ou alcance.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["W2fwS2jLu4yjKnRTww98",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB1837525408',model:/^(?:Kit Com 10 Cuecas Boxer Masculina Microfibra Original|Kit Espartanos — 10 cuecas boxer de microfibra anunciadas)$/i,correct:"Kit Espartanos — 10 cuecas boxer de microfibra anunciadas",summary:"A oferta identifica um kit Espartanos com dez cuecas boxer masculinas descritas como microfibra. MLB1837525408 é o código do anúncio, não do catálogo. Confira as medidas, a composição do tecido e as cores da variante escolhida. A ficha não verificou a procedência das peças nem testou conforto, elasticidade ou durabilidade.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["voyycquYPRJSv4TtyT29",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4296595075',model:/^(?:Espelho Orgânico Capela Led 44x64 Para Sala Quarto Banheiro Moldura Capela Led Frio|Espelho orgânico Capela com LED — 44 × 64 cm anunciados)$/i,correct:"Espelho orgânico Capela com LED — 44 × 64 cm anunciados",summary:"A oferta descreve um espelho orgânico Capela de 44 × 64 cm com LED de luz fria. A ficha não confirmou a tensão da unidade, o conteúdo do kit de fixação ou a proteção contra umidade. Confira a etiqueta elétrica e as orientações de instalação antes de ligar o LED, especialmente se o local estiver sujeito a respingos.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["vP33ptkgz0hzzvmaqx1a",{syncInformationalSchema:true,allowTruncatedHeading:true,model:/^(?:Lavadora De Alta Pressão Kärcher Prática Black 1500 Psi\/libras 1400w 300l\/h Com Aplicador De Detergente E Lança Regulável 127v|Lavadora Kärcher Prática Black — 127 V anunciados)$/i,correct:"Lavadora Kärcher Prática Black — 127 V anunciados",summary:"A oferta identifica uma Kärcher Prática Black de 127 V e anuncia 1.400 W, 1.500 psi e 300 L/h, além de lança regulável e aplicador de detergente. A ficha não mediu pressão, vazão ou economia de água, nem confirmou a certificação da unidade. Confira a etiqueta elétrica e os acessórios no anúncio e no manual do modelo oferecido.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["VIm8Tf6PT9I5VlI8BdRa",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB7293572044',model:/^(?:Celular Samsung Galaxy A17 Com Ia, 128gb, 4gb Ram, Câm De 50mp, Tela De 6\.7", Nfc, Ip54 - Preto|Samsung Galaxy A17 preto — 128 GB e 4 GB de RAM anunciados)$/i,correct:"Samsung Galaxy A17 preto — 128 GB e 4 GB de RAM anunciados",summary:"A oferta identifica um Galaxy A17 preto com 128 GB de armazenamento, 4 GB de RAM e câmera principal de 50 MP. A Samsung comercializa versões LTE e 5G nessa configuração; a descrição disponível não confirma qual delas o vendedor entrega. Confira o código do modelo e a disponibilidade de NFC na unidade. Esta ficha não verificou a avaliação do anúncio.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://news.samsung.com/br/feitos-para-durar-samsung-apresenta-galaxy-a17-e-galaxy-a07-no-brasil-com-armazenamento-robusto-recursos-ai-processador-de-alto-desempenho-e-ate-6-anos-de-atualizacoes",contextSourceLabel:"Referência da marca",suppressRating:true}],
  ["visu8XqPlr740f0W0So0",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB6334077238',model:/^(?:Smartphone Motorola Moto G35 5g 12gb Ram Boost 128g Cor Grafite|Motorola Moto G35 5G grafite — 128 GB anunciados)$/i,correct:"Motorola Moto G35 5G grafite — 128 GB anunciados",summary:"A oferta identifica o Moto G35 5G grafite com 128 GB. A Motorola diferencia os 4 GB de RAM física dos 8 GB de expansão virtual via RAM Boost. A marca documenta tela de 6,7 polegadas para esse modelo, enquanto a descrição anterior citava 6,5. O endereço do anúncio menciona caixa aberta; confirme condição, acessórios e garantia com o vendedor.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.motorola.com.br/smartphone-moto-g35-5g-128gb/p?idsku=1612",contextSourceLabel:"Referência da marca",suppressRating:true}],
  ["VJ0UNCYoJYS4gSEKpZKQ",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4181539471',model:/^(?:Smartphone Realme C75 5g 256gb 8gb Ram Dual Sim|realme C75 5G — 256 GB anunciados, RAM a confirmar)$/i,correct:"realme C75 5G — 256 GB anunciados, RAM a confirmar",summary:"A oferta identifica o realme C75 5G com 256 GB e cita 8 GB de RAM. A ficha brasileira da realme lista configurações diferentes e informa que elas podem variar por região. Isso não basta para confirmar os 8 GB de RAM física na unidade anunciada. Confira o código exato e a configuração na caixa; não use a ficha do C75 4G como referência.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.realme.com/br/realme-c75-5g/specs",contextSourceLabel:"Referência da marca",suppressRating:true}],
  ["vfoOrRV7xpu2EgJ8aIUy",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB6064737210',model:/^(?:Celular Samsung Galaxy S25 Fe 5g, 128gb, 8gb Ram, Câmera Tripla De 50\+12\+8, Tela Grande De 6\.7 Azul Marinho|Samsung Galaxy S25 FE 5G — 128 GB, azul-marinho)$/i,correct:"Samsung Galaxy S25 FE 5G — 128 GB, azul-marinho",summary:"A oferta identifica o Galaxy S25 FE 5G azul-marinho com 128 GB de armazenamento e 8 GB de RAM. A Samsung documenta a tela AMOLED de 6,7 polegadas e a câmera traseira principal de 50 MP. Esta ficha não comparou desempenho, fotos ou autonomia com outros aparelhos. Confira o código da unidade e as condições da oferta.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://shop.samsung.com/br/galaxy-s25-fe/p?skud=12191",contextSourceLabel:"Referência da marca",suppressRating:true}],
  ["VgdT8EtzIO0zWeDyEz7E",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB5000118226',model:/^(?:Umidificador De Ar Ultrassônico Umi Pop Health 2,3l Dellamed Cor Branco Bivolt)$/i,summary:"A Dellamed identifica o Umi Pop ultrassônico com reservatório de 2,3 L e desligamento automático quando há pouca água. A indicação de 2,5 mL da descrição anterior não corresponde à capacidade documentada. A ficha não confirmou ação antibacteriana nem mediu ruído ou autonomia. Consulte o manual para limpeza e uso do compartimento de aromas.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.dellamed.com.br/bem-estar/umidificadores/umidificador-de-ar-ultrassonico-pop-dellamed",contextSourceLabel:"Referência da marca",suppressRating:true}],
  ["Vgm0UKQmBdAvSbO683Yj",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4418866933',model:/^(?:Carrinho Rodinhas Organizador Multiuso Acrílico 3 Andares|Carrinho organizador com rodinhas — três níveis anunciados)$/i,correct:"Carrinho organizador com rodinhas — três níveis anunciados",summary:"A oferta descreve um carrinho organizador com rodinhas e três níveis. O título do anúncio menciona acrílico, mas não esclarece se o material se aplica a toda a estrutura ou apenas às bandejas. As dimensões e a carga por prateleira não foram confirmadas. Confira a altura, a largura e o peso suportado antes de escolher.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["mlMLB4962090958",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4962090958',model:/^(?:Tênis Nike Air Max Alpha Trainer 6 Masculino)$/i,summary:"A Nike apresenta o Air Max Alpha Trainer 6 masculino na linha de treino e academia. O anúncio descreve a variante preta. MLB4962090958 é o código do anúncio do vendedor, não a referência da Nike. Confira a cor e a numeração selecionadas; esta ficha não testou conforto, aderência ou durabilidade.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.nike.com.br/nav/genero/masculino/marca/nike/modelos/alphatrainer",contextSourceLabel:"Referência da marca",suppressRating:true}],
  ["V7bn4LXC1XY8jMepUGEp",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB5100889784',model:/^(?:Disney Pet Virtual Interativo Bitzee Sunny 3816)$/i,summary:"A Sunny identifica o Bitzee Disney 3816 como brinquedo interativo para a partir de 4 anos, com 30 personagens e respostas a gestos como tocar, inclinar e deslizar. A ficha da marca lista o brinquedo e instruções; confirme com o vendedor se as pilhas acompanham a unidade. Não verificamos procedência, avaliações do anúncio ou conteúdo da caixa recebida.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.sunnybrinquedos.com.br/pet-interativo-virtual-da-disney-bitzee",contextSourceLabel:"Referência da marca",suppressRating:true}],
  ["vdgdhBrdL4pb4rL1YK0x",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4190456415',model:/^(?:Cooktop 4 Bocas a Gás Electrolux Mesa de Vidro Efficient Grade de Aço Fosco \(KE4GR\) Bivolt|Cooktop Electrolux KE4GR a gás — quatro bocas)$/i,correct:"Cooktop Electrolux KE4GR a gás — quatro bocas",summary:"A Electrolux documenta o KE4GR como cooktop a gás de quatro bocas com acendimento elétrico bivolt e possibilidade de conversão para gás natural. Isso não significa que a unidade venha pronta para qualquer gás. Antes de instalar, confira o gás da unidade e o recorte da bancada no manual específico. Não use as dimensões externas do cooktop como gabarito de corte.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://loja.electrolux.com.br/cooktop-4-bocas-electrolux-gas-efficient-mesa-de-vidro-e-grade-de-aco-fosco--ke4gr-/p",contextSourceLabel:"Referência da marca",suppressRating:true}],
  ["uvlx1EGGFowAjO3EBgrw",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB7791362962',model:/^(?:Churrasqueira Portátil Camping Praia Compacta Galvanizada)$/i,summary:"A oferta identifica uma churrasqueira portátil Coferminas, descrita como galvanizada. O cadastro cita largura de 20 cm e diâmetro de 35 cm sem explicar a que parte cada medida se refere. Confira as dimensões montadas e da grelha, as instruções de uso e a garantia da unidade. Esta ficha não testou estabilidade ou desempenho.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["uVSddfqWEhUv6l94yiMK",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4839435111',model:/^(?:Principia Kit Trio Limpeza Facial Personalizada)$/i,summary:"O anúncio apresenta um kit de limpeza facial Principia e menciona os géis GL-01, GL-02 e GL-03. Esses códigos identificam fórmulas diferentes; confira se a oferta inclui os três géis ou se exige escolher uma combinação, e verifique o volume de cada frasco. Não presumimos que todos tenham a mesma indicação nem garantimos tolerância ou resultado.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["UwYGeOO2ABtDN07iR9ch",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4169895537',model:/^(?:Carregador Portátil Power Bank Turbo 20000mah universal para iphone samsung motorola xiaomi 20w Com Display Digital DTimp|Power bank DTimp — 20\.000 mAh anunciados)$/i,correct:"Power bank DTimp — 20.000 mAh anunciados",summary:"A oferta identifica um carregador portátil DTimp com visor e capacidade anunciada de 20.000 mAh. O título menciona 20 W, enquanto a descrição cita até 22,5 W sem indicar com clareza a saída ou o protocolo correspondente. Confira os conectores e a potência aceita pelo seu aparelho. Não medimos capacidade útil ou velocidade de recarga.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["UqO48Rj9I0f8SpOqabpv",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4359093019',model:/^(?:Tênis Masculino Casual Aramis Daily Slip Confortável Moderno|Tênis casual masculino Aramis Daily Slip)$/i,correct:"Tênis Masculino Casual Aramis Daily Slip Confortável Moderno",summary:"A oferta apresenta o Aramis Daily Slip como um tênis casual sem cadarços. A descrição cita cabedal de lona, palmilha de poliuretano e solado de borracha; confira os materiais e a numeração da variante escolhida. Esta ficha não confirmou a alegação antibacteriana da palmilha nem testou conforto ou aderência.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["uRfZSbUKT8yjArcSlGPL",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB7416511860',model:/^(?:Smartphone Motorola Moto G06)$/i,summary:"O anúncio identifica o Moto G06 azul com 128 GB e 4 GB de RAM física. Os 8 GB de RAM Boost anunciados são expansão virtual, não RAM física adicional. A Motorola descreve tela HD+ de 6,9 polegadas e bateria de 5.200 mAh para o modelo. Esta ficha não mediu autonomia, tempo de recarga ou eficácia do desbloqueio biométrico.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://empresas.motorola.com.br/smartphone-motorola-moto-g06-128gb/p",contextSourceLabel:"Referência do fabricante",suppressRating:true}],
  ["UTXc1AEUdk18yttkAXMb",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB6552026218',model:/^(?:Nac 600mg N-acetil L-cisteína Antioxidante - Fórmula Com Máxima Concentração E Pureza 120 Cápsulas - Forged Nutrition|NAC Forged Nutrition — 600 mg e 120 cápsulas anunciados)$/i,correct:"NAC Forged Nutrition — 600 mg e 120 cápsulas anunciados",summary:"A oferta identifica o NAC (N-acetil-L-cisteína) da Forged Nutrition em embalagem de 120 cápsulas e menciona 600 mg. Sem o rótulo da unidade, esta ficha não confirma se o valor é por cápsula ou por porção, nem as declarações sobre glúten, lactose e restrições. Confira o rótulo. A ficha não comprova pureza superior nem recomenda uma dose.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["Uh8jBpd9D8uEtK4Q3X43",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4307126823',model:/^(?:VITAMINA D3 \+ K2 Menaquinona-7 - Fórmula com Máxima Concentração e Biodisponibilidade - 60 Cápsulas|Vitamina D3 \+ K2 \(MK-7\) — 60 cápsulas anunciadas)$/i,correct:"Vitamina D3 + K2 (MK-7) — 60 cápsulas anunciadas",summary:"A oferta identifica um suplemento de vitamina D3 e K2 na forma de menaquinona-7, em pote anunciado de 60 cápsulas. O rótulo da unidade não foi confirmado, então a ficha não atribui os teores citados a uma cápsula ou porção. Confira a tabela e as advertências da embalagem. Não há comprovação de concentração ou biodisponibilidade superior nesta ficha, nem recomendação de dose.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["tXFA7nfMsVTOUweO3Twi",{syncInformationalSchema:true,expectedListing:'MLB4469892307',model:/^(?:Tênis Masculino Charged Skyline 5 Under Armour)$/i,summary:"A Under Armour apresenta o Charged Skyline 5 masculino como tênis de corrida. A oferta descreve a versão preta com fechamento por cadarço. A ficha não verificou o ano de lançamento, a aderência do solado ou o conforto no pé. Confira a numeração e a cor selecionadas, pois o anúncio pode reunir mais de uma variante.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.underarmour.com.br/tenis-de-corrida-under-armour-charged-skyline-5-masculino-6014736-001/p",contextSourceLabel:"Referência do fabricante",suppressRating:true}],
  ["u2nLyf1iUS18JLn3P9d5",{syncInformationalSchema:true,expectedListing:'MLB5826418272',model:/^(?:Sony PlayStation 4 PS4 Slim 500GB \+ 2 Controles \+ Jogo|PS4 Slim 500 GB — dois controles e jogo anunciados)$/i,correct:"PS4 Slim 500 GB — dois controles e jogo anunciados",summary:"A oferta anuncia um PlayStation 4 Slim de 500 GB com dois controles e um jogo. Os 500 GB correspondem à capacidade nominal, não ao espaço livre para instalar jogos. Confira o estado do console, o código CUH, o título e o formato do jogo e se os controles são originais. Esta ficha não verificou os acessórios da unidade.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.playstation.com/en-gb/ps4/tech-specs/",contextSourceLabel:"Referência do fabricante",suppressRating:true}],
  ["u9P6kD78JZexijimIjHN",{syncInformationalSchema:true,expectedListing:'MLB1894079521',model:/^(?:Kit 5 Camisetas Masculinas Slim Básicas Coloridas Premium|Kit Zaroc de cinco camisetas masculinas slim)$/i,correct:"Kit Zaroc de cinco camisetas masculinas slim",summary:"A oferta identifica um kit Zaroc com cinco camisetas masculinas de modelagem slim. MLB1894079521 identifica o anúncio, não um código de catálogo. A descrição não confirma a composição do tecido, as medidas das peças ou se as cores são escolhidas pelo comprador. Confira a tabela de tamanhos e a combinação da variante.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["tQpEIHL2QaiZ7xOWZ6py",{syncInformationalSchema:true,expectedListing:'MLB7216680136',model:/^(?:Pulverizador De Espuma Eletrico Alta Pressão Snow Foam|Pulverizador elétrico de espuma Snow Foam — 2 L anunciados)$/i,correct:"Pulverizador elétrico de espuma Snow Foam — 2 L anunciados",summary:"A oferta identifica um pulverizador elétrico de espuma Bahrein, com reservatório anunciado de 2 L. A descrição cita pressão máxima de 8 bar e válvula de segurança, mas não confirma a pressão em operação nem documenta o funcionamento da válvula. Esta ficha não testou pressão, vedação ou autonomia. Confira as instruções e os acessórios da unidade antes de usar.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["tb7c733uByymDrSRjT5f",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB5687309408',model:/^(?:iPhone 17 Pro Max 256GB - Prateado - Distribuidor Autorizado|iPhone 17 Pro Max prateado — 256 GB)$/i,correct:"iPhone 17 Pro Max prateado — 256 GB",summary:"A oferta identifica o iPhone 17 Pro Max prateado de 256 GB. A Apple documenta o chip A19 Pro e distingue a teleobjetiva óptica de 4x do enquadramento de 8x com qualidade óptica. As até 37 horas de reprodução de vídeo são uma estimativa da fabricante, não garantia de uso real. Esta ficha não confirmou a condição de distribuidor autorizado do vendedor.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://support.apple.com/pt-br/125091",contextSourceLabel:"Referência do fabricante",suppressRating:true}],
  ["TEq7tHMr54vb5Gx3KqXy",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4278606427',model:/^(?:Whey Protein Concentrado 1kg Growth Supplements - Leite em Pó)$/i,summary:"A oferta identifica o Whey Protein Concentrado Growth de 1 kg, sabor leite em pó. O valor de 2,3 g de proteína por porção registrado na descrição anterior não foi confirmado no rótulo da unidade. Confira na embalagem desse sabor o tamanho da porção, os teores de proteína e carboidratos e as declarações de alergênicos e lactose. Não use a tabela de outro sabor como substituta.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.gsuplementos.com.br/whey-protein-concentrado-1kg-growth-supplements-p985936",contextSourceLabel:"Referência do fabricante",suppressRating:true}],
  ["TJk9BUtlZ9v02ETWQRuG",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB3269837602',model:/^(?:Loção Hidratante Corporal Sem Perfume, com Ceramidas Essenciais e Ácido Hialurônico, Textura Fluida CeraVe 473ml|Loção hidratante corporal CeraVe sem fragrância — 473 mL)$/i,correct:"Loção hidratante corporal CeraVe sem fragrância — 473 mL",summary:"O anúncio identifica a loção hidratante corporal CeraVe em embalagem de 473 mL. A marca apresenta a fórmula sem fragrância, com três ceramidas essenciais e ácido hialurônico, para pele normal a levemente seca. A fabricante descreve hidratação prolongada; esta ficha não mediu a duração na pele nem confirmou o tipo de dosador da unidade.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.cerave.com.br/todos-os-produtos/locao-hidratante",contextSourceLabel:"Referência do fabricante",suppressRating:true}],
  ["SnMMDq9bDXiMWX0IXYdO",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB1793491599',model:/^Liquidificador Turbo Power Mondial 550W - L-99 FB(?: — anúncio MLB1793491599)?$/i,summary:"A oferta identifica o Mondial L-99 FB de 550 W. Os 2,2 L são a capacidade total da jarra; o manual indica 1.600 mL como nível máximo de preparo e traz instruções próprias para misturas quentes. Esta ficha não confirma ausência de BPA, tensão ou acessórios da unidade oferecida. Confira a etiqueta e o conteúdo da caixa.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://manuais.emondial.com/Manual-L-99-FB.pdf",contextSourceLabel:"Manual do fabricante",suppressRating:true}],
  ["SwJrTICSHQ1hJE2aIYz1",{syncInformationalSchema:true,allowTruncatedHeading:true,model:/^Torneira Gourmet Para Cozinha 2 Jatos Bica Móvel Parede Preta Flexível Jato Cone$/i,summary:"A oferta identifica uma torneira de parede preta, com bica flexível e dois tipos de jato anunciados. O cadastro cita silicone e metal sem detalhar quais peças usam cada material. A ficha não confirma a medida da conexão, a pressão mínima ou o alcance da bica sobre a cuba. Confira esses dados e os acessórios antes de comprar.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["sfV5mG9A2qmqdyJhbQc0",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB7159098736',model:/^(?:WAP Robô W200 Aspirador Robô 3 em 1 Varre Aspira Passa Pano Bivolt)$/i,summary:"A WAP documenta que o Robot W200 varre, aspira e passa pano, tem coletor de 275 mL, retorno à base e agendamento. A autonomia divulgada é de até 1 h e 15 min. O W200 não tem mapeamento automático nem controle por aplicativo; a marca informa três modos selecionáveis pelo controle remoto. Esta ficha não mediu autonomia ou cobertura.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://parceiros.wap.ind.br/robo-aspirador-wap-robot-w200/p",contextSourceLabel:"Ficha do fabricante",suppressRating:true}],
  ["sIeDtT4BuRsDRnKrSUMR",{syncInformationalSchema:true,allowTruncatedHeading:true,model:/^(?:NIVEA SUN Protetor Solar Facial Toque Seco Antissinais FPS70 40ml, Alta Proteção UVA\/UVB, Controla a Oleosidade, Previne Envelhecimento, Textura Leve|NIVEA SUN Toque Seco Antissinais FPS 70 — 40 mL)$/i,correct:"NIVEA SUN Toque Seco Antissinais FPS 70 — 40 mL",summary:"A NIVEA identifica este protetor solar facial como Toque Seco Antissinais FPS 70, de 40 mL, com fórmula sem óleo. A marca orienta reaplicar após suor intenso, banho ou secagem com toalha. Essa instrução não comprova nem descarta resistência ao suor. Confira as indicações do rótulo da unidade e siga as instruções de aplicação.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.nivea.com.br/produtos/nivea-sun-protetor-solar-facial-toque-seco-antissinais-fps70-40059009803970033.html",contextSourceLabel:"Ficha do fabricante",suppressRating:true}],
  ["scKXtqgNmOYETwmXi4EP",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4722851223',model:/^(?:Climatizador Portátil 16 Litros 130w Ventisol Clin16 Cor Cinza)$/i,summary:"A Ventisol identifica o CLIN16 como climatizador evaporativo de 16 L e 130 W, com filtro tipo colmeia e três velocidades. A marca lista versões de 127 V e 220 V separadamente; confira a tensão da unidade anunciada. Não é ar-condicionado e esta ficha não mediu queda de temperatura nem consumo no ambiente.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.ventisol.com.br/climatizador-16l-ventisol-130w-clin16",contextSourceLabel:"Ficha da Ventisol",suppressRating:true}],
  ["sEmIjHvnB3y4J7UZWBe2",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4507302081',model:/^(?:Lanterna Tatica Aluminio Led Laser Canhao Luz Mais Potente Lanterna Potente Com Zoom De Longo Alcance, Lanterna Tática Militar Para Acampamento, Caminhada, Pesca Preto|Lanterna tática LED preta — zoom e cinco modos anunciados)$/i,correct:"Lanterna tática LED preta — zoom e cinco modos anunciados",summary:"A oferta descreve uma lanterna LED preta com zoom e cinco modos. O cadastro menciona 22 m e alimentação USB, mas não confirma o alcance real, a autonomia ou o tipo de conector. A menção a laser no título anterior não comprova que exista um emissor laser. Confira o modelo e o conteúdo da embalagem na oferta.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["SEqRg2PsdNDdUJEB4T3W",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB3621404839',model:/^(?:Lavadora Lava Jato Portátil Pressão 2 Baterias \+ Maleta|Lavadora portátil — duas baterias e maleta anunciadas)$/i,correct:"Lavadora portátil — duas baterias e maleta anunciadas",summary:"A oferta anuncia uma lavadora portátil com duas baterias e maleta. A ficha anterior cita 4 L/min e bivolt, mas a vazão não foi medida e a tensão de entrada do carregador não foi confirmada. Confira no anúncio quais acessórios acompanham o kit e verifique a etiqueta do carregador antes de ligá-lo.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["mlMLB3868708109",{syncInformationalSchema:true,expectedListing:'MLB3868708109',model:/^(?:Conjunto Roteador Mesh Wifi 6 Intelbras Twibi Force Ax 2 Uni Branco|Kit Intelbras Twibi Force AX — Wi-Fi 6 Mesh, duas unidades|Kit roteador Intelbras Twibi Force AX — Wi-Fi 6 Mesh, duas unidades)$/i,correct:"Kit roteador Intelbras Twibi Force AX — Wi-Fi 6 Mesh, duas unidades",summary:"A oferta anuncia duas unidades brancas do Twibi Force AX. A Intelbras documenta Wi-Fi 6 em 5 GHz e porta WAN/LAN Gigabit. A velocidade de 75 MB/s citada no cadastro não representa um desempenho garantido: o resultado depende do plano, dos dispositivos, da posição dos módulos e das barreiras no ambiente.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://backend.intelbras.com/sites/default/files/2023-09/Datasheet%20M%C3%B3dulo%20e%20Conjunto%20Twibi%20Force%20AX%20vf_ES.pdf",contextSourceLabel:"Ficha do fabricante",suppressRating:true}],
  ["rL4T2UGKrNxcJGZoJVpX",{syncInformationalSchema:true,expectedListing:'MLB4073310979',model:/^(?:Densifique Masque Densité Máscara 200ml \| Kérastase|Kérastase Densifique Masque Densité — tamanho a conferir)$/i,correct:"Kérastase Densifique Masque Densité — tamanho a conferir",summary:"A Kérastase apresenta a Masque Densité como máscara para cabelos finos e lista o tamanho de 200 mL. O endereço do anúncio menciona 200 g, uma unidade de medida diferente. Confira a quantidade no rótulo da embalagem oferecida. Esta ficha não verificou a procedência da unidade nem comprova crescimento capilar.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://www.kerastase.com.br/produtos/colecoes/densifique/mascara-densite/KRBR00031.html",contextSourceLabel:"Ficha do fabricante",suppressRating:true}],
  ["sCCEJZohlc5e7c4yVrl4",{syncInformationalSchema:true,expectedListing:'MLB4918003479',model:/^(?:Kit Porta Condimentos Vitrex 8 Potes Em Vidro Preto Com Base Giratória)$/i,summary:"A oferta identifica um porta-condimentos Vitrex com oito potes de vidro e base giratória preta. A ficha anterior cita 80 mL por pote, altura de 23 cm e largura de 13 cm; essas medidas não foram confirmadas em documentação do fabricante. Confira a capacidade e o material da base na oferta; a vedação das tampas não foi testada.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["RiCj7wC1QDBSMgPUQWD1",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB6781687878',model:/^(?:Mini Ventilador Soprador Ar Turbo 130000rpm Assoprador Sem Fio Recarregável Usb 3 Níveis Jato Forte Portátil Multiuso Limpeza Teclado Carro Acende Churrasqueira Davely|Mini soprador portátil Davely — recarga USB anunciada)$/i,correct:"Mini soprador portátil Davely — recarga USB anunciada",summary:"A oferta descreve um mini soprador portátil sem fio, recarregável por USB, com três níveis. O título anuncia 130.000 rpm, mas isso não mede a velocidade do jato. A descrição também cita 127/220 V sem esclarecer se essa indicação se refere a um adaptador. Confira a alimentação, a porta e os acessórios da unidade. A ficha não verificou potência, autonomia ou desempenho.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["rjkXSj5wDd3i4spfoHet",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB5041220911',model:/^(?:Software Rede Manutenção Windows Titanium Tech Toolkit)$/i,summary:"A oferta anuncia o Titanium Tech Toolkit v6.0.2 como pacote digital de ferramentas de manutenção para Windows. A ficha não verificou a origem do instalador, a compatibilidade com versões específicas do sistema nem os termos ou a validade da licença. Antes de instalar, confira a procedência do download e as condições de uso de cada ferramenta.",positiveNotes:[],negativeNotes:[],suppressRating:true}],
  ["rkEqyfJAguQZwMzfh25s",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB2084718645',model:/^(?:Perfume Billion Casino Royal Paris Elysees Masculino Intense 100ml Original|Billion Casino Royal Paris Elysees — 100 mL anunciados)$/i,correct:"Billion Casino Royal Paris Elysees — 100 mL anunciados",summary:"A oferta identifica o Billion Casino Royal da Paris Elysees em frasco de 100 mL. A marca classifica essa fragrância como oriental em sua coleção oficial. A menção a Intense no anúncio não basta para confirmar uma concentração específica. A ficha não verificou autenticidade, fixação ou projeção da unidade oferecida.",positiveNotes:[],negativeNotes:[],contextSourceUrl:"https://paris-elysees.com/collections/billion-dollar",contextSourceLabel:"Paris Elysees: coleção Billion Dollar",suppressRating:true}],
  ["r7HSFtoP8OEdijhRMIDk",{syncInformationalSchema:true,expectedListing:'MLB4839780461',model:/^(?:Carretilha Molinete Pesca,18\+1 Rolamentos 7\.2:1 Pescaria|Carretilha de pesca — relação 7,2:1 anunciada)$/i,correct:"Carretilha de pesca — relação 7,2:1 anunciada",summary:"A oferta descreve uma carretilha com relação de recolhimento de 7,2:1 e 18+1 rolamentos anunciados. A descrição não esclarece a diferença entre o sistema magnético citado e o arrasto informado de 8 kg. Confira o lado da manivela na variante selecionada; a força de arrasto não foi medida.",positiveNotes:[],negativeNotes:["Arrasto e lado da manivela não verificados."],suppressRating:true}],
  ["rfym6WivFVhxpwn2WF6r",{syncInformationalSchema:true,expectedListing:'MLB5046495691',model:/^(?:Winleve Studio Otimizador Windows 10 E 11 Digital)$/i,summary:"A oferta anuncia o Winleve Studio como software digital para Windows 10 e 11. A ficha não verificou a procedência do instalador, a coleta de dados ou ganhos de desempenho. Confira a identificação do desenvolvedor, a origem do download e os termos da licença antes de instalar.",positiveNotes:[],negativeNotes:["Privacidade, procedência e desempenho não verificados."],suppressRating:true}],
  ["RHhkWKxMXBZONt8jx4Ew",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB7777101942',model:/^(?:Computador Completo 20'' BRX Intel Core i5 6ª Geração 8GB SSD 256GB Monitor LED 75Hz Windows Teclado Mouse Kit Completo Desktop Office Home Office Estudo Trabalho|Computador BRX Core i5-6500 — 8 GB e SSD de 256 GB anunciados)$/i,correct:"Computador BRX Core i5-6500 — 8 GB e SSD de 256 GB anunciados",summary:"A oferta do computador BRX identifica o Core i5-6500, 8 GB de RAM e SSD de 256 GB. O título anuncia monitor de 20 polegadas e 75 Hz, teclado e mouse. A edição e a licença do Windows não foram confirmadas, assim como o modelo exato do monitor. Confira o conteúdo do kit na oferta.",positiveNotes:[],negativeNotes:["Edição e licença do Windows não confirmadas."],suppressRating:true}],
  ['QV00w4vTmt2SwgU8xisL',{syncInformationalSchema:true,expectedListing:'MLB3605484231',model:/^(?:Purificador Hidrofiltros Facile C3 Água Natural Selo Inmetro Preto|Purificador Hidrofiltros Facile C3 — água natural)$/i,correct:'Purificador Hidrofiltros Facile C3 — água natural',summary:'A oferta identifica o Facile C3 como purificador de água natural sem energia elétrica. A Hidrofiltros atribui ao C3 a redução de cloro e distingue esse refil do C7, ao qual atribui ação contra bactérias. A ficha não verificou a certificação da unidade anunciada nem testou a vedação da válvula.',positiveNotes:[],negativeNotes:['Não atribuímos ao C3 a ação contra bactérias descrita para o C7.'],contextSourceUrl:'https://hidrofiltros.com.br/produto/purificador-de-agua-hidrofiltros-facile/',contextSourceLabel:'Hidrofiltros: diferenças entre os refis C3 e C7',suppressRating:true}],
  ['r5zUBIo4zXpfIh0HjpdD',{syncInformationalSchema:true,expectedListing:'MLB6628276288',model:/^Conjunto Moletom Masculino,incluir Casaco Com Capuz E Calças$/i,summary:'A oferta identifica um conjunto masculino BS Fit com casaco com capuz e calça. MLB6628276288 é o código do anúncio, não de catálogo. A descrição disponível não confirma a composição do tecido nem as medidas das peças; confira a tabela de tamanhos da variante escolhida.',positiveNotes:[],negativeNotes:['Composição do tecido e medidas não confirmadas.'],suppressRating:true}],
  ["qPNJGNmzPbZzprZanGOC",{syncInformationalSchema:true,expectedListing:'MLB2765715868',model:/^Relógio Casio Masculino G-shock Digital Preto Dw-5600bb-1dr$/i,summary:"A oferta identifica o G-Shock preto DW-5600BB-1DR. A ficha da Casio para o DW-5600BB-1 informa cerca de dois anos com bateria CR2016, não cinco anos. Confira o módulo da unidade oferecida. A Casio também informa vidro mineral e classificação de resistência à água de 200 m.",positiveNotes:[],negativeNotes:["Módulo da unidade anunciada não confirmado."],contextSourceUrl:"https://www.casio.com/br/watches/gshock/product.DW-5600BB-1/",contextSourceLabel:'Casio: especificações do DW-5600BB-1',suppressRating:true}],
  ["qsh7YbMSqVuBmaoWlpzn",{syncInformationalSchema:true,expectedListing:'MLB5948982982',model:/^Tênis adidas Acelera 2 Preto E Branco$/i,summary:"O título e o endereço da oferta identificam um adidas Acelera 2 preto e branco, mas a descrição anterior misturava essa identificação com outro código de catálogo e campos divergentes de cor. Confira a combinação de cores e a numeração da variante selecionada no anúncio.",positiveNotes:[],negativeNotes:["Confira a cor da variante selecionada."],suppressRating:true}],
  ["QUKhd39js4LdwLXNbh0u",{syncInformationalSchema:true,expectedListing:'MLB4592320910',model:/^Kit 4 Camiseta Dry-fit Sandrini Masculina Academia Caminhada$/i,summary:"A oferta identifica um kit de quatro camisetas masculinas Sandrini, descritas como dry-fit. MLB4592320910 é o código do anúncio, não de catálogo. A descrição não confirma a composição do tecido nem as medidas das peças; confira as opções de cor e tamanho na variante oferecida.",positiveNotes:[],negativeNotes:["Composição e medidas não confirmadas."],suppressRating:true}],
  ["Ql4iYvaqcH2l6SPpBDsi",{syncInformationalSchema:true,expectedListing:'MLB3800842215',model:/^(?:Camiseta Dry-fit Preta Caveira Unisex Dark Lab)$/i,summary:"O anúncio identifica uma camiseta preta Dark Lab com estampa de caveira, descrita como unissex e dry-fit. MLB3800842215 identifica a oferta, não um código de catálogo. A descrição disponível não informa a composição do tecido nem as medidas da peça por tamanho.",positiveNotes:[],negativeNotes:["Composição do tecido e medidas não confirmadas."],suppressRating:true}],
  ["qN6qOlF1Re6ltU5WRdaE",{syncInformationalSchema:true,expectedListing:'MLB7399445176',model:/^(?:Caminhão Dinossauro Pista Com 8 Carrinhos Maleta Transporte|Caminhão dinossauro porta-carrinhos — 8 mini carrinhos anunciados)$/i,correct:"Caminhão dinossauro porta-carrinhos — 8 mini carrinhos anunciados",summary:"O cadastro e o endereço da oferta descrevem um caminhão dinossauro com oito mini carrinhos e função de maleta. O endereço vinculado usa um catálogo diferente do código antigo da ficha. A descrição disponível não confirma se há uma pista separada nem a faixa etária indicada na embalagem.",positiveNotes:[],negativeNotes:["Pista separada e faixa etária não confirmadas."],suppressRating:true}],
  ["QNzmR100ehzO5NSBLhTw",{syncInformationalSchema:true,expectedListing:'MLB3905028657',model:/^(?:Magnésio Bisglicinato - 60 Cápsulas - Nutrify)$/i,summary:"A oferta anuncia um pote de magnésio bisglicinato Nutrify com 60 cápsulas. Na tabela nutricional da fabricante, os 200 mg de magnésio correspondem a uma porção de duas cápsulas, não a uma cápsula. Confira o rótulo da unidade oferecida. Esta ficha não avalia absorção nem recomenda uma dose.",positiveNotes:[],negativeNotes:["Absorção não avaliada nesta ficha."],contextSourceUrl:"https://www.nutrify.com.br/magnesio/p",contextSourceLabel:'Nutrify: tabela nutricional do magnésio bisglicinato',suppressRating:true}],
  ["QHCeO6rxelawGpcolRX1",{syncInformationalSchema:true,expectedListing:'MLB6363542818',model:/^(?:Campainha Sem Fio Intelbras Cib 101 Com Bateria Preta)$/i,summary:"A oferta identifica a Intelbras CIB 101 como campainha sem fio, na cor preta, e menciona bateria. A ficha não confirma quais componentes usam bateria nem o alcance em ambientes com paredes. Confira o conteúdo da embalagem e o modelo no anúncio; o alcance não foi medido.",positiveNotes:[],negativeNotes:["Alcance e alimentação dos componentes não confirmados."],suppressRating:true}],
  ["QIAwDGVurh7E0nsu2G7t",{syncInformationalSchema:true,expectedListing:'MLB3609638507',model:/^(?:Chinelo Boaonda Ortopédico Bolt Nuvem Palmilha Conforto Leve|Chinelo Boaonda Bolt Nuvem)$/i,correct:"Chinelo Boaonda Bolt Nuvem",summary:"A oferta identifica o chinelo Boaonda Bolt Nuvem e menciona palmilha. A expressão “ortopédico” no anúncio não comprova indicação clínica nem benefício terapêutico. A ficha não avaliou conforto ou ajuste ao pé; confira a numeração e as medidas da variante na oferta.",positiveNotes:[],negativeNotes:["Não há indicação clínica verificada nesta ficha."],suppressRating:true}],
  ["QikFoLr76mfU8ijP9Nzr",{syncInformationalSchema:true,expectedListing:'MLB7413456100',model:/^(?:Grand Theft Auto VI - PlayStation 5)$/i,summary:"Esta oferta anuncia Grand Theft Auto VI para PlayStation 5. Segundo a Rockstar, a edição física vem em caixa com código para baixar o jogo, sem disco. Confira com o vendedor a edição, a entrega e a inclusão de bônus; esta ficha não garante datas de pré-download ou acesso para esta oferta.",positiveNotes:[],negativeNotes:["Bônus e condições de entrega da oferta não confirmados."],contextSourceUrl:"https://support.rockstargames.com/articles/46YkMi4rHxYXMeIHtZiKaE/grand-theft-auto-vi-pre-order-details",contextSourceLabel:'Rockstar: conteúdo da edição física e pré-venda',suppressRating:true}],
  ["Q8XN2tGmsU12afIbz1Am",{syncInformationalSchema:true,expectedListing:'MLB1307284888',model:/^(?:Fritadeira Elétrica Sem Óleo Air Fryer Mondial 1500w|Air fryer Mondial — 4 L e 1\.500 W anunciados)$/i,correct:"Air fryer Mondial — 4 L e 1.500 W anunciados",summary:"A oferta descreve uma air fryer Mondial de 4 L e 1.500 W, com cesto quadrado antiaderente. A ficha não identifica o código exato do modelo nem confirma a tensão da unidade anunciada. Confira esses dados na oferta; rapidez, uniformidade de cozimento e facilidade de limpeza não foram testadas.",positiveNotes:[],negativeNotes:["Modelo exato e tensão não confirmados."],suppressRating:true}],
  ["Q9UWVUsXl8sIvWyM1hKt",{syncInformationalSchema:true,expectedListing:'MLB5666993474',model:/^(?:Lixeira Metal Aramado Telada Cesto De Lixo Escritório 12l Cor Preto|Lixeira aramada preta — 12 L anunciados)$/i,correct:"Lixeira aramada preta — 12 L anunciados",summary:"A oferta identifica uma lixeira preta de metal aramado, com estrutura vazada e capacidade anunciada de 12 L. A ficha não confirma as dimensões nem a resistência à corrosão. O acabamento vazado não foi avaliado quanto ao acúmulo de umidade, e a durabilidade não foi comparada com a de cestos de plástico.",positiveNotes:[],negativeNotes:["Dimensões e resistência à corrosão não confirmadas."],suppressRating:true}],
  ["qeH6DeH4aWWppBpaRPYc",{syncInformationalSchema:true,expectedListing:'MLB5604818552',model:/^(?:Creatina 100% Monohidratada Micronizada Vegana True Source|Creatina monohidratada True Source — 300 g anunciados)$/i,correct:"Creatina monohidratada True Source — 300 g anunciados",summary:"A oferta descreve um pote de creatina monohidratada micronizada True Source com 300 g. O campo de volume em mL não foi usado para informar a quantidade do pó. Confira o peso líquido e os ingredientes no rótulo; esta ficha não verifica pureza nem recomenda uma dose.",positiveNotes:[],negativeNotes:["Pureza não verificada nesta ficha."],suppressRating:true}],
  ["PP8JorVbOJNMg5FXOr47",{syncInformationalSchema:true,expectedListing:'MLB4337879731',model:/^(?:Esteira Elétrica Ergométrica Dobrável 12km C\/tela Led Bivolt|Esteira elétrica dobrável com visor LED anunciado)$/i,correct:"Esteira elétrica dobrável com visor LED anunciado",summary:"A oferta descreve uma esteira elétrica dobrável com visor LED, motor anunciado de 2,5 HP e inclinação fixa de 6%. O título usa “12km” sem esclarecer a unidade de velocidade. A ficha não confirma a velocidade máxima, a carga suportada nem a potência contínua.",positiveNotes:[],negativeNotes:["Velocidade máxima, carga e potência contínua não confirmadas."],suppressRating:true}],
  ["ppQhZEUfZDuGcIZRmFB5",{syncInformationalSchema:true,expectedListing:'MLB4037910198',model:/^(?:Serra Tico Tico Profissional 500w 3000 Gpm Lâmina E Protetor Bst500 The Black Tools|Serra tico-tico The Black Tools BST500 — 500 W anunciados)$/i,correct:"Serra tico-tico The Black Tools BST500 — 500 W anunciados",summary:"A oferta da serra tico-tico BST500 informa 500 W, 3.000 golpes por minuto e capacidade anunciada de corte em madeira de 55 mm. A ficha não confirma que o encaixe aceite qualquer lâmina. Confira o tipo de encaixe e os acessórios da variante; o desempenho de corte não foi testado.",positiveNotes:[],negativeNotes:["Compatibilidade de lâminas e desempenho de corte não verificados."],suppressRating:true}],
  ["q8wxWRl86XmL7Gglikg7",{syncInformationalSchema:true,expectedListing:'MLB4085175433',model:/^(?:Kaiak Ultra Natura Colônia Perfume Masculino 100ml Relançamento 2025|Natura Kaiak Ultra masculino — 100 mL anunciados)$/i,correct:"Natura Kaiak Ultra masculino — 100 mL anunciados",summary:"A oferta apresenta o Natura Kaiak Ultra masculino em frasco de 100 mL e descreve um perfil aromático amadeirado com toque mentolado. A ficha não verifica o ano de relançamento, a identidade do vendedor ou a autenticidade da unidade. Fixação e projeção não foram avaliadas.",positiveNotes:[],negativeNotes:["Autenticidade, fixação e projeção não verificadas."],suppressRating:true}],
  ["pNwNrsWTQMEyOC4qwff1",{syncInformationalSchema:true,expectedListing:'MLB4515776631',model:/^(?:O Boticário Insensatez Deo Colônia 100ml)$/i,summary:"O Boticário classifica Insensatez como desodorante colônia de família cítrica e apresenta o frasco de 100 mL. Essa classificação descreve o perfil da fragrância, mas não indica quanto tempo ela permanece na pele. A ficha não traz medições de fixação ou projeção.",positiveNotes:[],negativeNotes:["Fixação e projeção não testadas."],contextSourceUrl:"https://www.boticario.com.br/insensatez-desodorante-colonia-100ml-2",contextSourceLabel:'O Boticário: ficha do Insensatez',suppressRating:true}],
  ["pO6CZCNo99YwtpIW0UB8",{syncInformationalSchema:true,expectedListing:'MLB5786186316',model:/^(?:Principia Kit Limpeza E Hidratação Ch-01 \+ Ol-01 \+ Gl-02 Todo Tipo De Pele Dia\/noite|Kit de limpeza e hidratação Principia — anúncio MLB5786186316)$/i,summary:"O cadastro descreve um kit Principia de três produtos para limpeza e hidratação. Há divergência: o título salvo menciona CH-01, enquanto o endereço da oferta menciona GH-01, ambos ao lado de OL-01 e GL-02. Confira as três referências no anúncio e nos rótulos antes de escolher o kit.",positiveNotes:[],negativeNotes:["Composição exata do kit não confirmada."],suppressRating:true}],
  ["poypkDuJgaW37aCZlswN",{syncInformationalSchema:true,expectedListing:'MLB5054428609',model:/^(?:Climatizador Ar Frio Portátil Evaporativo 16 Litros Umidificador Ventisol Clin 16|Climatizador evaporativo Ventisol Clin 16)$/i,correct:"Climatizador evaporativo Ventisol Clin 16",summary:"A oferta descreve o Ventisol Clin 16 como climatizador evaporativo com reservatório de 16 L, três velocidades e potência anunciada de 130 W. A ficha não traz medições de queda de temperatura nem indica área de cobertura. Confira a tensão e os dados da versão escolhida na oferta.",positiveNotes:[],negativeNotes:["Queda de temperatura e área de cobertura não verificadas."],suppressRating:true}],
  ["PEegqDESPIk3onguTRg8", {syncInformationalSchema:true,expectedListing:'MLB5010641270',model:/^(?:Ddpai N1 Dual Câmera Veicular 1296p\+1080p Uber Nightvis App|Câmera veicular DDPAI N1 Dual — 1296p frontal e 1080p traseiros anunciados)$/i,correct:"Câmera veicular DDPAI N1 Dual — 1296p frontal e 1080p traseiros anunciados",summary:"A oferta da DDPAI N1 Dual anuncia gravação frontal em 1296p, traseira em 1080p e conexão Wi-Fi para uso com aplicativo. A menção ao sensor G se refere à gravação de eventos, não a impedir colisões. A qualidade das imagens e o comportamento do registro de eventos não foram testados.",positiveNotes:[],negativeNotes:["Qualidade das imagens e registro de eventos não avaliados."],suppressRating:true}],
  ["pEszDEGUnKoIpY9xhIdV", {syncInformationalSchema:true,expectedListing:'MLB4470176627',model:/^(?:Perfume Masculino Premium Midnight Blue 100ml Original Árabe|Perfume masculino Midnight Blue — 100 mL anunciados)$/i,correct:"Perfume masculino Midnight Blue — 100 mL anunciados",summary:"A oferta vinculada descreve o Midnight Blue masculino em frasco de 100 mL. A menção a essência importada no anúncio não confirma a origem do perfume acabado. A ficha não confirma autenticidade, origem árabe ou alegações sobre testes em animais. Fixação e projeção não foram avaliadas.",positiveNotes:[],negativeNotes:["Autenticidade, origem e fixação não confirmadas."],suppressRating:true}],
  ["pGWith3ABAHWNTRZG3fM", {syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4291609113',model:/^(?:PENTA MAGNÉSIO - Bisglicinato \+ Dimalato \+ Citrato \+ Taurato \+ Óxido de Magnésio - A Combinação Perfeita de 5 Magnésios com Máxima Pureza e Biodisponibilidade - 60 Cápsulas|Penta Magnésio Essencial Labs — 60 cápsulas anunciadas)$/i,correct:"Penta Magnésio Essencial Labs — 60 cápsulas anunciadas",summary:"A oferta descreve o Penta Magnésio da Essencial Labs em embalagem de 60 cápsulas e lista bisglicinato, dimalato, citrato, taurato e óxido de magnésio. A quantidade de magnésio por porção deve ser conferida no rótulo. A ficha não comprova pureza ou biodisponibilidade superior e não recomenda uma dose.",positiveNotes:[],negativeNotes:["Pureza, absorção e quantidade de magnésio por porção não verificadas."],suppressRating:true}],
  ["Pcye5MBHzWVlBIhtSnXX", {syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB5724593344',model:/^(?:Kit 10 Pote De Vidro Marmita Hermético 640ml Freezer Fitness Borossilicato 4 Travas Micro-ondas Azul-Escuro|Kit com 10 potes de vidro — 640 mL anunciados por unidade)$/i,correct:"Kit com 10 potes de vidro — 640 mL anunciados por unidade",summary:"A oferta descreve dez potes de vidro borossilicato com capacidade de 640 mL por unidade e tampa com quatro travas. O título menciona freezer e micro-ondas, mas a ficha não confirma as condições de uso nem a compatibilidade com forno. Consulte as instruções do fabricante antes de aquecer o recipiente.",positiveNotes:[],negativeNotes:["Vedação e condições de uso em forno não confirmadas."],suppressRating:true}],
  ["PdIYZ9X5RhTbhmKJyZRw", {syncInformationalSchema:true,expectedListing:'MLB2629291215',model:/^(?:Perfume Vodka Brasil Amarelo Paris Elysees Masculino Intense 100ml|Paris Elysees Vodka Brasil Amarelo — 100 mL anunciados)$/i,correct:"Paris Elysees Vodka Brasil Amarelo — 100 mL anunciados",summary:"A oferta identifica o Vodka Brasil Amarelo da Paris Elysees em frasco de 100 mL e descreve um perfil aquático amadeirado, com toranja e notas marinhas. Não houve avaliação de fixação ou projeção. As alegações sobre composição vegana, testes em animais e conformidade não foram verificadas nesta ficha.",positiveNotes:[],negativeNotes:["Fixação, projeção e alegações éticas não verificadas."],suppressRating:true}],
  ["Ped2JwDkTqMRNcZ0BhTf", {syncInformationalSchema:true,expectedListing:'MLB3894608627',model:/^(?:Skatenete Max Led Ajustável Patinete 120kg Bandeirante|Patinete Bandeirante Skatenete Max LED ajustável)$/i,correct:"Patinete Bandeirante Skatenete Max LED ajustável",summary:"A oferta identifica o Bandeirante Skatenete Max LED como patinete ajustável e menciona 120 kg. A ficha não confirma esse limite de carga nem a faixa etária e as alturas de ajuste da variante. Antes de usar, confira os limites no manual ou na etiqueta do produto.",positiveNotes:[],negativeNotes:["Limite de carga, faixa etária e alturas de ajuste não confirmados."],suppressRating:true}],
  ["oYoalVz8s4bR2iumSyhW", {syncInformationalSchema:true,expectedListing:'MLB4883864997',model:/^(?:Carregador Fonte Apple Ipad Iphone Turbo Original Usb-c 20w|Carregador USB-C de 20 W anunciado como Apple)$/i,correct:"Carregador USB-C de 20 W anunciado como Apple",summary:"A oferta identifica o carregador como adaptador Apple USB-C de 20 W. A ficha não confirma a autenticidade do item nem as condições de garantia do vendedor. O carregamento rápido descrito pela Apple depende do modelo do iPhone, do adaptador e do cabo; não medimos o tempo de carga desta unidade.",positiveNotes:[],negativeNotes:["Autenticidade, garantia e tempo de carga não verificados."],contextSourceUrl:"https://support.apple.com/pt-br/102574",contextSourceLabel:'Apple: requisitos de carregamento rápido do iPhone',suppressRating:true}],
  ["P5uw3Q0IjbFoD0of4CSu", {syncInformationalSchema:true,expectedListing:'MLB4484863171',model:/^(?:Karaoke Box Azul \+ Sistema Com Pontuação|Karaoke Box azul — sistema de pontuação anunciado)$/i,correct:"Karaoke Box azul — sistema de pontuação anunciado",summary:"A oferta identifica o Karaoke Box azul com sistema de pontuação e menciona inclusão de músicas por pendrive. A descrição não detalha os formatos de arquivo aceitos nem esclarece quais funções operam sem internet. Confira esses requisitos e os acessórios incluídos antes de comprar.",positiveNotes:[],negativeNotes:["Formatos de música, acessórios e funcionamento offline não confirmados."],suppressRating:true}],
  ["p9csD1mVQKKLvmFbV1VX", {syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB6549158890',model:/^(?:Mini Ventilador Soprador Ar Turbo 130000RPM Sem Fio Recarregável USB 3 Níveis Jato Forte Portátil Multiuso Limpeza Teclado Carro Acende Churrasqueira Simake|Mini soprador Simake sem fio — três níveis anunciados)$/i,correct:"Mini soprador Simake sem fio — três níveis anunciados",summary:"A oferta descreve um mini soprador Simake sem fio, recarregável por USB e com três níveis de ajuste. Os 130.000 RPM anunciados se referem à rotação, não a uma medição da força do jato. A ficha não confirma vazão, autonomia ou adequação para acender churrasqueira.",positiveNotes:[],negativeNotes:["Vazão, autonomia e uso junto a churrasqueira não verificados."],suppressRating:true}],
  ["OTYBW2oIlOWx1MeHpF1u", {syncInformationalSchema:true,expectedListing:'MLB5243705479',model:/^(?:Patinete Elétrico 500w 25km\/h Dobrável App Bluetooth Rapido|Patinete elétrico dobrável — 500 W e 25 km\/h anunciados)$/i,correct:"Patinete elétrico dobrável — 500 W e 25 km/h anunciados",summary:"O anúncio descreve um patinete elétrico dobrável e cita 500 W, 25 km/h e conexão Bluetooth por aplicativo. A descrição não esclarece se a potência informada é nominal ou de pico, nem confirma o aplicativo, a autonomia ou a carga máxima. A velocidade não foi medida nesta ficha.",positiveNotes:[],negativeNotes:["Potência nominal, autonomia, carga máxima e aplicativo não confirmados."],suppressRating:true}],
  ["OwXKuXw3ZMFmcvx7jF4v", {syncInformationalSchema:true,expectedListing:'MLB4705243893',model:/^(?:Compressor Calibrador De Pneus Calibrador B&G Portátil Mini Digital Carro Bike Sem Fio Cor Preto|Calibrador portátil B&G sem fio — até 150 PSI anunciados)$/i,correct:"Calibrador portátil B&G sem fio — até 150 PSI anunciados",summary:"A oferta descreve um calibrador portátil B&G sem fio com visor digital, pressão máxima de 150 PSI e vazão anunciada de 25 L/min. A pressão máxima do aparelho não é a pressão recomendada para o pneu. A ficha não confirma vazão sob pressão, tempo de enchimento ou autonomia.",positiveNotes:[],negativeNotes:["Vazão sob pressão, tempo de enchimento e autonomia não verificados."],suppressRating:true}],
  ["OADfHMMVftq1AKtGgcaP", {syncInformationalSchema:true,model:/^(?:Smart Tv Roku Tv 50 7045 4k Uhd Aoc Bivolt|Smart TV AOC Roku de 50″ — 4K UHD anunciado)$/i,correct:"Smart TV AOC Roku de 50″ — 4K UHD anunciado",summary:"A oferta identifica uma TV AOC de 50 polegadas com Roku TV e resolução 4K UHD. O tamanho da tela e a resolução são características anunciadas, não uma comparação de nitidez com outros modelos. A ficha não traz medições de brilho, contraste ou qualidade de imagem.",positiveNotes:[],negativeNotes:["Brilho, contraste e qualidade de imagem não medidos."],suppressRating:true}],
  ["Oelq1fEuR41tSXxHj8cp", {syncInformationalSchema:true,expectedListing:'MLB4890245591',model:/^(?:Extensão Elétrica Tomadas Usb Type-c Bivolt 2m Chave Liga|Extensão elétrica com seis tomadas, USB-A e USB-C anunciados)$/i,correct:"Extensão elétrica com seis tomadas, USB-A e USB-C anunciados",summary:"A oferta descreve uma extensão com seis tomadas, cabo de 2 m e portas USB-A e USB-C. O valor de 2,5 kW aparece sem esclarecer as condições de tensão e corrente; não é uma indicação de carga segura. Antes de usar, confira os limites no rótulo ou manual. A potência das portas USB não foi confirmada.",positiveNotes:[],negativeNotes:["Limites de carga e potência das portas USB não confirmados."],suppressRating:true}],
  ["nzEaLDNocvF6GDH6InIH", {syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4655530173',model:/^(?:Colchonete Camping Camuflado Colchao dobravel Saco De Dormir Hezzo Hometech Pesca Acampamento Retiro Trilha C\/ Saco De Transporte Mochila|Colchonete de camping camuflado — 190 × 60 cm anunciados)$/i,correct:"Colchonete de camping camuflado — 190 × 60 cm anunciados",summary:"A oferta descreve um colchonete individual camuflado para camping, com 190 × 60 cm e 3 cm de espessura anunciados. O título menciona saco de transporte, mas a descrição não esclarece se o produto também funciona como saco de dormir. A ficha não traz teste de conforto ou isolamento térmico.",positiveNotes:[],negativeNotes:["Conforto e isolamento térmico não avaliados."],suppressRating:true}],
  ["o6oq1IPOS41xUDtF3TG7", {syncInformationalSchema:true,expectedListing:'MLB5832558364',model:/^(?:Varal Aço Inox Suspenso Roupa Íntima 40 Prendedor Calcinha|Varal suspenso com 40 prendedores — aço inox anunciado)$/i,correct:"Varal suspenso com 40 prendedores — aço inox anunciado",summary:"O anúncio descreve um varal suspenso em aço inox com 40 prendedores. A quantidade de prendedores não informa a carga máxima do conjunto. A descrição disponível não confirma as dimensões nem a resistência do gancho; confira o espaço e o suporte onde pretende pendurá-lo.",positiveNotes:[],negativeNotes:["Carga máxima, dimensões e resistência do gancho não confirmadas."],suppressRating:true}],
  ["O8vB8vB9Kw6NpVqHMt8A", {syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB6420227790',model:/^(?:Smartphone Motorola Moto G17 4g - 128gb 12gb \(4gb Ram \+ 8gb Ram Boost\), Camera 50mp Sony Lytia 600, Tela Fhd\+ 60hz, Bateria 5200 Mah - Rosa|Motorola Moto G17 4G — 128 GB e 4 GB de RAM física)$/i,correct:"Motorola Moto G17 4G — 128 GB e 4 GB de RAM física",summary:"O Moto G17 4G desta oferta é anunciado com 128 GB de armazenamento e 4 GB de RAM física. Segundo a Motorola, os até 8 GB extras do RAM Boost são memória virtual que usa parte do armazenamento, não RAM física. A câmera principal de 50 MP é uma especificação; a qualidade das fotos não foi testada nesta ficha.",positiveNotes:[],negativeNotes:["RAM Boost usa armazenamento; qualidade de imagem não avaliada."],contextSourceUrl:"https://www.motorola.com.br/smartphone-moto-g17-128-gb/p?idsku=1788",contextSourceLabel:'Motorola: especificação de RAM física e RAM Boost',suppressRating:true}],
  ["nfzTOT5XTvnh8Q8DyLvb", {syncInformationalSchema:true,expectedListing:'MLB6067481206',model:/^(?:Tênis Masculino Elevation Fila)$/i,summary:"A oferta identifica o Fila Elevation masculino na cor azul e descreve a largura como padrão, sem informar as medidas da forma. Confira a numeração e a tabela de medidas da variante escolhida. A ficha não apresenta testes de ajuste ao pé, conforto ou amortecimento.",positiveNotes:[],negativeNotes:["Medidas da forma e conforto não verificados."],suppressRating:true}],
  ["nkBZlP0jQEwoMIj6VDbG", {syncInformationalSchema:true,expectedListing:'MLB5298350806',model:/^(?:Capa Chuva Motoqueiro Pvc Impermeável Motoboy Emborrachada|Capa de chuva Brascamp em PVC para motociclista)$/i,correct:"Capa de chuva Brascamp em PVC para motociclista",summary:"O anúncio identifica uma capa de chuva Brascamp em PVC para motociclistas. A impermeabilidade é uma alegação da oferta, sem teste de vedação nesta ficha. A descrição disponível não detalha as medidas, as costuras ou os fechamentos; confira essas informações na variante escolhida.",positiveNotes:[],negativeNotes:["Vedação, costuras e medidas não verificadas."],suppressRating:true}],
  ["NQyo56LcUgwwA2tz8YCF", {syncInformationalSchema:true,expectedListing:'MLB3384814517',model:/^(?:Tênis Mizuno Wave Dynasty 5 Masculino Treino Original|Tênis masculino Mizuno Wave Dynasty 5 — modelo anunciado)$/i,correct:"Tênis masculino Mizuno Wave Dynasty 5 — modelo anunciado",summary:"O título e o endereço do anúncio identificam o Mizuno Wave Dynasty 5 masculino, mas a descrição anterior citava o Wave Falcon 5. As características daquele texto não foram aproveitadas nesta ficha. Confira o modelo e a numeração da variante na oferta; conforto e aderência não foram avaliados.",positiveNotes:[],negativeNotes:["Especificações do Wave Falcon 5 não se aplicam automaticamente à oferta do Dynasty 5."],suppressRating:true}],
  ["N6932yKNTXnAJ98cz9Eo", {syncInformationalSchema:true,model:/^(?:TUD Kit 11 Potes Vidro Herméticos Tampa Bambu 200ml a 2L Armazenamento|Kit TUD com 11 potes de vidro e tampas de bambu)$/i,correct:"Kit TUD com 11 potes de vidro e tampas de bambu",summary:"O anúncio do kit TUD informa 11 potes de vidro com tampas de bambu e capacidades entre 200 mL e 2 L. A ficha não detalha quantos potes vêm de cada tamanho. A vedação hermética é anunciada, mas não foi testada; não há confirmação de desempenho na conservação dos alimentos.",positiveNotes:[],negativeNotes:["Distribuição dos tamanhos e desempenho da vedação não verificados."],suppressRating:true}],
  ["N9EnpkbyJeTRuSriAhFn", {syncInformationalSchema:true,expectedListing:'MLB6709937978',model:/^(?:Relógio De Parede Decorativo Deus E Bom O Tempo Todo Em Mdf|Relógio de parede Oca Decora em MDF — Deus é bom o tempo todo)$/i,correct:"Relógio de parede Oca Decora em MDF — Deus é bom o tempo todo",summary:"A oferta identifica um relógio decorativo de parede da Oca Decora em MDF, com a frase “Deus é bom o tempo todo” e peso anunciado de 175 g. O código MLB6709937978 identifica o anúncio. A descrição disponível não confirma dimensões, tipo de alimentação ou se a pilha está incluída.",positiveNotes:[],negativeNotes:["Dimensões e alimentação não confirmadas."],suppressRating:true}],
  ["NfQ2YF7qf3SL1oehasTi", {syncInformationalSchema:true,expectedListing:'MLB4595279704',model:/^(?:Câmera Inteligente iM3 C Black Intelbras|Câmera Intelbras iM3 C Black — Wi-Fi Full HD para uso interno)$/i,correct:"Câmera Intelbras iM3 C Black — Wi-Fi Full HD para uso interno",summary:"A Intelbras especifica a iM3 C como câmera Wi-Fi Full HD para uso interno, com base magnética. A oferta identifica a cor preta. A ficha não compara o desempenho com o de outras câmeras nem traz medições de alcance, qualidade de imagem ou confiabilidade dos alertas.",positiveNotes:[],negativeNotes:["Qualidade de imagem e alertas não avaliados em teste."],contextSourceUrl:"https://www.intelbras.com/pt-br/camera-interna-wi-fi-full-hd-im3-c",contextSourceLabel:'Intelbras: ficha da câmera interna iM3 C',suppressRating:true}],
  ["mlMLB7871750870", {syncInformationalSchema:true,expectedListing:'MLB7871750870',model:/^(?:Microfone Lapela A'Gold MCF-38D Sem Fio para iPhone e Android com 2 Microfones|A’Gold MCF-38D — kit sem fio com dois microfones de lapela)$/i,correct:"A’Gold MCF-38D — kit sem fio com dois microfones de lapela",summary:"A oferta identifica o A’Gold MCF-38D como kit sem fio com dois microfones de lapela e menciona iPhone e Android. A descrição não informa qual conector acompanha a variante nem confirma compatibilidade com aparelhos específicos. Alcance e qualidade de áudio não foram avaliados.",positiveNotes:[],negativeNotes:["Conector, compatibilidade, alcance e áudio não verificados."],suppressRating:true}],
  ["mWlmlmg15okWqGyIc5bh", {syncInformationalSchema:true,expectedListing:'MLB5532075156',model:/^(?:Tênis Kappa Pulse Rx Unissex Corrida Conforto|Tênis Kappa Pulse RX unissex — anúncio MLB5532075156)$/i,correct:"Tênis Kappa Pulse RX unissex — anúncio MLB5532075156",summary:"A descrição desta oferta do Kappa Pulse RX cita cabedal Ultraknit, entressola com amortecimento EVA-K e borracha em partes do solado. O código MLB5532075156 distingue o anúncio, não o modelo. Confira a numeração da variante; conforto, amortecimento e aderência não foram testados.",positiveNotes:[],negativeNotes:["Conforto, amortecimento e aderência não testados."],suppressRating:true}],
  ["n4IIyDvWZZGMKhBisDSq", {syncInformationalSchema:true,expectedListing:'MLB6842727330',model:/^(?:Lavadora De Alta Pressão Profissional Wap 4100 W2 420l\/h Motor De Indução 1650psi 1500w 127V|Lavadora WAP 4100 W2 — variante 127 V anunciada)$/i,correct:"Lavadora WAP 4100 W2 — variante 127 V anunciada",summary:"A oferta anuncia a WAP 4100 W2 de 127 V com motor de indução, 1.500 W, pressão máxima de 1.650 PSI e vazão de 420 L/h. A ficha não apresenta medições de pressão em uso nem confirma a adequação a rotinas intensivas. Confira a tensão e os acessórios da variante na oferta.",positiveNotes:[],negativeNotes:["Pressão em uso e adequação a rotinas intensivas não verificadas."],suppressRating:true}],
  ["mlMLB7748620676", {syncInformationalSchema:true,expectedListing:'MLB7748620676',model:/^(?:Perfume Árabe His Confession Masculino Original 100ML|Perfume masculino His Confession — 100 mL anunciados)$/i,correct:"Perfume masculino His Confession — 100 mL anunciados",summary:"A oferta anuncia um perfume masculino His Confession em frasco de 100 mL, descrito como não recarregável. A ficha não confirma de forma independente o fabricante do item oferecido, a autenticidade ou a alegação de ausência de testes em animais. Fixação e projeção não foram avaliadas.",positiveNotes:[],negativeNotes:["Fabricante, autenticidade e alegações éticas não verificados."],suppressRating:true}],
  ["mlMLB7752259240", {syncInformationalSchema:true,expectedListing:'MLB7752259240',model:/^(?:Kit Internet Completo Antena Starlink Mini X 2 Suportes Cabo|Kit Starlink Mini com dois suportes e cabo anunciados)$/i,correct:"Kit Starlink Mini com dois suportes e cabo anunciados",summary:"A oferta anuncia uma antena Starlink Mini, dois suportes e um cabo. A descrição disponível não confirma o tipo dos suportes, o comprimento do cabo ou os demais acessórios. A referência apresentada no campo de etiqueta não comprova a homologação desta unidade. Confira o conteúdo exato do kit no anúncio.",positiveNotes:[],negativeNotes:["Composição completa do kit e homologação não confirmadas."],suppressRating:true}],
  ["mlMLB7870098964", {syncInformationalSchema:true,expectedListing:'MLB7870098964',model:/^(?:Kit 3 Bonecos Marvel Hulk 22cm Homem Aranha 9cm Capitã 9cm|Kit anunciado com três bonecos: Hulk, Homem-Aranha e Capitã)$/i,correct:"Kit anunciado com três bonecos: Hulk, Homem-Aranha e Capitã",summary:"O título do anúncio lista três bonecos: Hulk de 22 cm, Homem-Aranha de 9 cm e Capitã de 9 cm. A descrição menciona articulação, mas não identifica quais peças são articuladas. Confira a indicação etária na embalagem; esta ficha não confirma certificação nem licenciamento oficial.",positiveNotes:[],negativeNotes:["Articulação de cada peça e licenciamento não confirmados."],suppressRating:true}],
  ["mlMLB7304557578", {syncInformationalSchema:true,expectedListing:'MLB7304557578',model:/^(?:Cooler para Notebook Gamer Megabyte SR002 com 4 Ventoinhas e LED Azul para Laptop até 17\.3"|Base refrigeradora Megabyte SR002 com 4 ventoinhas)$/i,correct:"Base refrigeradora Megabyte SR002 com 4 ventoinhas",summary:"O anúncio da base Megabyte SR002 informa quatro ventoinhas, LED azul e dimensões de 39 × 28 cm, com indicação para notebooks de até 17,3 polegadas. Compare as dimensões da base com as do notebook. A ficha não confirma a função das portas USB nem mede redução de temperatura ou ruído.",positiveNotes:[],negativeNotes:["Compatibilidade física, função das portas USB e desempenho térmico não verificados."],suppressRating:true}],
  ["mlMLB7593699030", {syncInformationalSchema:true,expectedListing:'MLB7593699030',model:/^(?:Repetidor Sinal Wifi Gigab 1200mb 2\.4g Dual Band Wireles 6an|Repetidor Wi-Fi TRQ3 — dual band anunciado)$/i,correct:"Repetidor Wi-Fi TRQ3 — dual band anunciado",summary:"O cadastro do repetidor TRQ3 menciona 2,4 GHz, dual band, seis antenas e 1.200 Mb/s. A descrição não esclarece como essa taxa é calculada e não confirma padrão Wi-Fi, porta Gigabit ou alcance real. O número de homologação informado no anúncio não foi validado nesta revisão.",positiveNotes:[],negativeNotes:["Taxa real, padrão Wi-Fi, porta Gigabit e homologação não confirmados nesta ficha."],suppressRating:true}],
  ["mlMLB7678487136", {syncInformationalSchema:true,model:/^(?:Perfume Masculino Vibrato 200ml Alta Fixação|Perfume masculino Monarq Vibrato — 200 mL anunciados)$/i,correct:"Perfume masculino Monarq Vibrato — 200 mL anunciados",summary:"A oferta identifica o Monarq Vibrato como perfume masculino com frasco de 200 mL anunciado. A descrição disponível não confirma a concentração nem as notas da fragrância. A fixação não foi avaliada, e as alegações de produto vegano e sem testes em animais não foram verificadas.",positiveNotes:[],negativeNotes:["Concentração, notas, fixação e alegações éticas não verificadas."],suppressRating:true}],
  ["mlMLB6989366460", {syncInformationalSchema:true,expectedListing:'MLB6989366460',model:/^(?:Tênis Feminino Casual Confortavel Plataforma Tratorado|Tênis casual feminino Amoli com plataforma tratorada)$/i,correct:"Tênis casual feminino Amoli com plataforma tratorada",summary:"A oferta identifica um tênis casual feminino Amoli com plataforma tratorada. O código MLB6989366460 identifica o anúncio, não o modelo do calçado. A descrição disponível não informa a altura da plataforma nem os materiais; confira as medidas e a numeração da variante escolhida.",positiveNotes:[],negativeNotes:["Altura da plataforma, materiais e conforto não verificados."],suppressRating:true}],
  ["mlMLB7011230810", {syncInformationalSchema:true,expectedListing:'MLB7011230810',model:/^(?:Mini Impressora Térmica 58mm Portátil Usb E Bluetooth Fatura|Mini impressora térmica de 58 mm — USB e Bluetooth anunciados)$/i,correct:"Mini impressora térmica de 58 mm — USB e Bluetooth anunciados",summary:"A oferta anuncia uma impressora térmica de 58 mm com entrada USB e menciona Bluetooth no título. A descrição disponível não identifica o modelo nem confirma quais sistemas, aplicativos ou tipos de documento são compatíveis. Confira esses requisitos antes de escolher a impressora.",positiveNotes:[],negativeNotes:["Compatibilidade com aplicativos, sistemas e documentos não confirmada."],suppressRating:true}],
  ["mlMLB7174618968", {syncInformationalSchema:true,expectedListing:'MLB7174618968',model:/^(?:Mouse Gamer Branco Profissional Ultra Leve Slits V2 7200 Dpi|Mouse Slits V2 branco com fio — 7\.200 DPI anunciados)$/i,correct:"Mouse Slits V2 branco com fio — 7.200 DPI anunciados",summary:"A oferta identifica o Slits V2 branco como mouse com fio e informa 85 g, sensor óptico Instant 725IC e resolução anunciada de 7.200 DPI. Esses dados não foram medidos nesta ficha. O anúncio não esclarece se o peso inclui o cabo nem comprova desempenho em jogos.",positiveNotes:[],negativeNotes:["Peso, resolução e desempenho não verificados em teste."],suppressRating:true}],
  // Lote 111: preservar o vínculo com a oferta de cada ficha ao regenerar as páginas.
  ["mlMLB6794388344", {syncInformationalSchema:true,expectedListing:'MLB6794388344',model:/^(?:Celular Samsung Galaxy A37 5G 128GB, 6GB RAM)$/i,summary:"A Samsung identifica esta configuração do Galaxy A37 5G com 6 GB de RAM e 128 GB de armazenamento. Não confunda com a variante de 8 GB e 256 GB. O anúncio descreve tela Super AMOLED de 6,7 polegadas e câmera principal de 50 MP; não avaliamos qualidade das fotos nem desempenho.",positiveNotes:[],negativeNotes:["Desempenho e qualidade das fotos não avaliados."],contextSourceUrl:"https://news.samsung.com/br/samsung-apresenta-galaxy-a57-5g-e-galaxy-a37-5g-no-brasil-com-recursos-de-nivel-profissional",contextSourceLabel:'Samsung Brasil: configurações do Galaxy A37 5G',suppressRating:true}],
  ["mlMLB6837462690", {syncInformationalSchema:true,expectedListing:'MLB6837462690',model:/^(?:Tênis Masculino Esportivo Corrida Leve Confortável Macio|Tênis esportivo masculino Ravero)$/i,correct:"Tênis esportivo masculino Ravero",summary:"A oferta identifica um tênis esportivo masculino Ravero. O código MLB6837462690 identifica o anúncio, não o modelo do calçado. A descrição disponível não informa o peso nem comprova amortecimento, maciez ou adequação à corrida. Confira a numeração e as medidas da variante escolhida.",positiveNotes:[],negativeNotes:["Peso, amortecimento e adequação à corrida não verificados."],suppressRating:true}],
  ["mlMLB6918814082", {syncInformationalSchema:true,expectedListing:'MLB7407693118',model:/^(?:Kit Gamer Mageon Mobilador Teclado Qwerty \+ Mouse 1200 Dpi Preto)$/i,summary:"A oferta do kit Mageon informa teclado de membrana com layout QWERTY em português do Brasil, conexão USB 2.0 e mouse óptico de 1.200 DPI. A descrição não confirma o padrão ABNT2 nem a compatibilidade com aparelhos específicos. O nível de ruído das teclas não foi medido nesta ficha.",positiveNotes:[],negativeNotes:["Padrão ABNT2, compatibilidade e ruído não verificados."],suppressRating:true}],
  ["mlMLB6666191918", {syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB6666191918',model:/^(?:Computador Completo Top Intel Core i7 4770, 16GB RAM, SSD 512GB, Bivolt, Preto, Windows 10 Pro, Monitor 23" Full HD - BluePC CD2E-0135TO|BluePC CD2E-0135TO — Core i7-4770, 16 GB e SSD de 512 GB)$/i,correct:"BluePC CD2E-0135TO — Core i7-4770, 16 GB e SSD de 512 GB",summary:"A oferta do BluePC CD2E-0135TO informa Core i7-4770, 16 GB de RAM, SSD de 512 GB e monitor Full HD de 23 polegadas. O Windows 10 Pro é descrito como versão de avaliação, sem licença definitiva confirmada. A ficha não traz testes de desempenho nem detalha o modelo dos acessórios inclusos.",positiveNotes:[],negativeNotes:["Licença definitiva do Windows não confirmada."],suppressRating:true}],
  ["mlMLB6778555692", {syncInformationalSchema:true,expectedListing:'MLB6778555692',model:/^(?:SSD Interno PRODRIVE 240GB 2\.5" SATA III PROSATA301\/240G|SSD Prodrive PROSATA301\/240G — 240 GB, SATA III de 2,5″)$/i,correct:"SSD Prodrive PROSATA301/240G — 240 GB, SATA III de 2,5″",summary:"O SSD Prodrive PROSATA301/240G é anunciado com 240 GB, formato de 2,5 polegadas e interface SATA III. O padrão SATA III prevê 6 Gb/s de taxa de interface, não 60 GB/s. Os máximos de 550 MB/s de leitura e 500 MB/s de gravação são valores anunciados, sem medição nesta análise.",positiveNotes:[],negativeNotes:["Velocidades de leitura e gravação não medidas."],contextSourceUrl:"https://sata-io.org/sites/default/files/documents/SATA-Revision-3.0-FAQ-FINAL.pdf",contextSourceLabel:'SATA-IO: especificação da interface SATA 3.0',suppressRating:true}],
  ["mlMLB6785015658", {syncInformationalSchema:true,expectedListing:'MLB6785015658',model:/^(?:Perfume Arabe Vulcan Feu EDP 100ML Unisex com NF|Vulcan Feu Eau de Parfum — 100 mL anunciados)$/i,correct:"Vulcan Feu Eau de Parfum — 100 mL anunciados",summary:"A oferta identifica a fragrância como Vulcan Feu Eau de Parfum unissex, com frasco anunciado de 100 mL. A ficha não confirma de forma independente o fabricante, a composição ou as alegações de produto vegano e sem testes em animais. Fixação e projeção não foram avaliadas.",positiveNotes:[],negativeNotes:["Fabricante e alegações sobre composição não confirmados."],suppressRating:true}],
  ["mlMLB6208948636", {syncInformationalSchema:true,expectedListing:'MLB6208948644',model:/^(?:Tênis Converse Feminino Taylor Ct2834 Curto T|Tênis Converse CT2834 feminino — rosa, segundo o anúncio)$/i,correct:"Tênis Converse CT2834 feminino — rosa, segundo o anúncio",summary:"A oferta identifica um tênis Converse CT2834 feminino na cor rosa, com fechamento por cadarço e interior de tecido. A largura é descrita como larga pelo vendedor, sem medidas nesta ficha. Confira a tabela de tamanhos da variante escolhida; o conforto não foi avaliado.",positiveNotes:[],negativeNotes:["Medidas de largura e conforto não verificados."],suppressRating:true}],
  ["mlMLB6619764606", {syncInformationalSchema:true,expectedListing:'MLB6619764606',model:/^(?:Webcam 1080p 2mp Full Hd Alta Resolução Com Microfone Usb|Webcam USB com microfone — 1080p anunciados)$/i,correct:"Webcam USB com microfone — 1080p anunciados",summary:"A oferta anuncia vídeo de até 1080p, imagem de 2 MP, foco fixo, conexão USB 2.0 e microfone embutido. O anúncio não esclarece a taxa de quadros em 1080p nem o que significa a menção a 360 graus. A qualidade do áudio e da imagem não foi avaliada nesta ficha.",positiveNotes:[],negativeNotes:["Taxa de quadros em 1080p e função dos 360 graus não confirmadas."],suppressRating:true}],
  ["mlMLB6655583300", {syncInformationalSchema:true,expectedListing:'MLB6655583300',model:/^(?:Lavadora Alta Pressão Portátil Chiaperini Lj14l Cor Azul E Preto|Lavadora Chiaperini LJ14L — vazão anunciada de até 14 L\/min)$/i,correct:"Lavadora Chiaperini LJ14L — vazão anunciada de até 14 L/min",summary:"A descrição disponível da Chiaperini LJ14L informa motor de 1 HP, vazão máxima de 14 L/min, peso de 27 kg e mangueira de 10 m com carrinho incluído. São dados atribuídos à oferta, sem medição independente. A pressão de trabalho e a tensão da variante não estão confirmadas nesta ficha.",positiveNotes:[],negativeNotes:["Pressão de trabalho e tensão da variante não confirmadas."],suppressRating:true}],
  ['mlMLB4604968203',{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB4604968203',model:/^(?:Notebook 2 em 1 Positivo Duo C8128E Intel Celeron N4500 Windows 11 Home 8GB RAM 128GB eMMC 11” LED HD IPS - Cinza|Positivo Duo C8128E — 2 em 1 com 8 GB e 128 GB eMMC)$/i,correct:'Positivo Duo C8128E — 2 em 1 com 8 GB e 128 GB eMMC',summary:'A oferta identifica o Positivo Duo C8128E como notebook 2 em 1 com Intel Celeron N4500, 8 GB de RAM, 128 GB de armazenamento eMMC e Windows 11 Home. A ficha não confirma opções de expansão nem traz medições de desempenho ou autonomia. Confira a configuração da variante anunciada.',positiveNotes:['Memória e tipo de armazenamento identificados na oferta.'],negativeNotes:['Expansão, desempenho e autonomia não verificados.'],suppressRating:true}],
  ["mlMLB5952869866", {syncInformationalSchema:true,expectedListing:'MLB5952869866',model:/^(?:Escova Dental Oralgos Db781 Cs 4000 Cerdas Cores Variadas|Escova dental Oralgos DB781 CS — pacote anunciado com 6 unidades)$/i,correct:"Escova dental Oralgos DB781 CS — pacote anunciado com 6 unidades",summary:"O anúncio da escova dental Oralgos DB781 CS informa seis unidades por pacote, cores variadas e 4.000 cerdas. A ficha não confirma a rigidez das cerdas nem permite verificar as cores enviadas. A menção a gengivas sensíveis vem do vendedor e não foi validada nesta revisão.",positiveNotes:[],negativeNotes:["Rigidez das cerdas não confirmada."],suppressRating:true}],
  ["mlMLB6118982036", {syncInformationalSchema:true,expectedListing:'MLB6118982036',model:/^(?:Kit De Sobrevivência De Emergência De Acampamento Aventura)$/i,summary:"O kit ST é anunciado para camping. O cadastro informa 12 no campo de quantidade de pederneiras, mas não lista todos os componentes nem confirma que o kit tenha 12 peças ao todo. Confira o conteúdo da oferta; a ficha não atesta a adequação do conjunto para emergências.",positiveNotes:[],negativeNotes:["Conteúdo completo e adequação a emergências não confirmados."],suppressRating:true}],
  ["mlMLB6203660830", {syncInformationalSchema:true,expectedListing:'MLB6203660830',model:/^(?:Kit 4 Shorts 2 Em 1 Duplo Dryfit Masculino Compressão Térmic|Kit com 4 shorts masculinos 2 em 1)$/i,correct:"Kit com 4 shorts masculinos 2 em 1",summary:"A oferta anuncia quatro shorts masculinos 2 em 1. A descrição disponível não confirma a composição do tecido, o nível de compressão ou o desempenho térmico. Confira as medidas e as cores da variante selecionada; a ficha não trata os termos promocionais do anúncio como resultados de teste.",positiveNotes:[],negativeNotes:["Composição, compressão e desempenho térmico não confirmados."],suppressRating:true}],
  ["mlMLB5626051922", {syncInformationalSchema:true,expectedListing:'MLB5626051922',model:/^(?:Mouse Gamer Titorion Sem Fio Com Sensor Pixart 3311 E 12000 Dpi|Mouse sem fio Titorion — 12.000 DPI anunciados)$/i,correct:"Mouse sem fio Titorion — 12.000 DPI anunciados",summary:"A oferta do mouse Titorion informa conexão de 2,4 GHz, sensor PixArt 3311 e resolução anunciada de até 12.000 DPI. A taxa de até 2.000 Hz e a autonomia declarada de sete dias não foram medidas nesta análise. A descrição disponível não informa as condições usadas para estimar a autonomia.",positiveNotes:["Conexão de 2,4 GHz e sensor PixArt 3311 informados no anúncio."],negativeNotes:["Resolução, taxa de comunicação e autonomia não verificadas em teste."],suppressRating:true}],
  ["mlMLB5751316838", {syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB5751316838',model:/^(?:Notebook Asus Vivobook 15 X1504va Intel Core I5 1334u 8gb Ram 512gb Ssd Intel Iris Xe Windows 11 Home Tela 15,6 Fhd Silver - Nj1740w|Asus Vivobook 15 X1504VA-NJ1740W — Core i5, 8 GB e SSD de 512 GB)$/i,correct:"Asus Vivobook 15 X1504VA-NJ1740W — Core i5, 8 GB e SSD de 512 GB",summary:"A oferta do Asus Vivobook 15 X1504VA, variante NJ1740W, informa Core i5-1334U, 8 GB de RAM, SSD de 512 GB e tela Full HD de 15,6 polegadas. Esses dados descrevem a configuração anunciada; não houve teste de fluidez em multitarefas. A ficha não confirma as opções de expansão de memória.",positiveNotes:["Memória, armazenamento e resolução da tela informados para a variante anunciada."],negativeNotes:["Desempenho em multitarefas e opções de expansão não verificados."],suppressRating:true}],
  ["mlMLB5769733060", {syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB5769733060',model:/^(?:Notebook Positivo Vision C15M Intel Celeron N4500 Windows 11 Home 4GB RAM 128GB eMMC Tela 15" Full HD IPS Antirreflexo - Minitela e Tecla Copilot - Cinza|Positivo Vision C15M — Celeron N4500, 4 GB e 128 GB eMMC)$/i,correct:"Positivo Vision C15M — Celeron N4500, 4 GB e 128 GB eMMC",summary:"A oferta do Positivo Vision C15M informa Celeron N4500, 4 GB de RAM, armazenamento de 128 GB do tipo eMMC e Windows 11 Home. A descrição também cita minitela e tecla Copilot. Não há teste de desempenho nesta ficha nem confirmação sobre expansão da memória ou do armazenamento.",positiveNotes:["Configuração com 4 GB de RAM e 128 GB eMMC identificada na oferta."],negativeNotes:["Expansão de memória e armazenamento não confirmada."],suppressRating:true}],
  ["mlMLB5386749261", {syncInformationalSchema:true,model:/^(?:Kit Gamer Teclado E Mouse Led Rgb Usb Para Pc Computador)$/i,summary:"O anúncio do kit Hebigus MIX informa conexão USB, iluminação RGB, teclado em português do Brasil e mouse de 1.200 dpi. A descrição não identifica o tipo de tecla nem confirma se a iluminação pode ser configurada. Não houve teste de precisão do mouse ou de desempenho em jogos.",positiveNotes:["Teclado em português do Brasil e mouse de 1.200 dpi, segundo a oferta."],negativeNotes:["Tipo de tecla e ajustes da iluminação não confirmados."],suppressRating:true}],
  ["mlMLB5389928608", {syncInformationalSchema:true,expectedListing:'MLB5389928608',model:/^(?:Pc Computador Cpu Intel I5 10400, Nvme 500gb, 16gb Ram, 500w|PC Intel Core i5-10400 — 16 GB e NVMe de 500 GB anunciados)$/i,correct:"PC Intel Core i5-10400 — 16 GB e NVMe de 500 GB anunciados",summary:"A oferta informa Intel Core i5-10400, 16 GB de RAM e armazenamento NVMe de 500 GB. O Windows 10 Pro é descrito como versão de avaliação, sem licença definitiva confirmada. A menção a 500 W não identifica marca ou modelo da fonte; a ficha também não confirma uma placa de vídeo dedicada.",positiveNotes:["Processador, memória e armazenamento identificados no anúncio."],negativeNotes:["Licença definitiva do Windows, modelo da fonte e placa de vídeo dedicada não confirmados."],suppressRating:true}],
  ["mlMLB5408593708", {syncInformationalSchema:true,expectedListing:'MLB5408593708',model:/^(?:Tênis Casual Kappa Zenit Masculino Unissex Conforto|Tênis casual Kappa Zenit)$/i,correct:"Tênis casual Kappa Zenit",summary:"A oferta identifica o Kappa Zenit como tênis casual. O código MLB5408593708 identifica o anúncio, não o modelo. Como o cadastro usa tanto “masculino” quanto “unissex”, confira a tabela de medidas e a numeração da variante escolhida. Não testamos conforto, amortecimento ou aderência.",positiveNotes:["Marca e nome do modelo identificados na oferta."],negativeNotes:["Ajuste ao pé, conforto, amortecimento e aderência não verificados."],suppressRating:true}],
  ["mlMLB5287633095", {syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB5287633095',model:/^(?:Câmera de Segurança Babá Eletrônica Ip Wifi 1080p Full Hd Visão Noturna Ideal Para Bebê Crianças Idosos Pets Áudio Bidirecional Kateluo|Câmera Wi-Fi Kateluo — 1080p e áudio bidirecional anunciados)$/i,correct:"Câmera Wi-Fi Kateluo — 1080p e áudio bidirecional anunciados",summary:"O anúncio da câmera Wi-Fi Kateluo informa resolução 1080p, visão noturna, áudio bidirecional e sensor de movimento. A ficha não confirma alcance à noite, qualidade do áudio ou confiabilidade dos alertas. A indicação como babá eletrônica é do vendedor, não uma garantia de supervisão.",positiveNotes:["Visão noturna, áudio bidirecional e sensor de movimento anunciados."],negativeNotes:["Não verificamos a confiabilidade dos alertas nem o desempenho como babá eletrônica."],suppressRating:true}],
  ["mlMLB5299235149", {syncInformationalSchema:true,expectedListing:'MLB5299235149',model:/^(?:Kit Instrumento Musical Bandinha Infantil Presente \+4 Anos)$/i,summary:"A oferta identifica um kit de instrumentos infantis Ark Toys, anunciado para crianças a partir de 4 anos. A descrição disponível não confirma a quantidade de peças, os instrumentos incluídos nem os materiais. Confira o conteúdo da versão oferecida e a faixa etária na embalagem.",positiveNotes:["Marca Ark Toys e faixa etária anunciada constam do cadastro."],negativeNotes:["Quantidade de peças, instrumentos e materiais não confirmados nesta ficha."],suppressRating:true}],
  ["mlMLB5336183061", {syncInformationalSchema:true,expectedListing:'MLB5336183061',model:/^(?:Inversor Veicular IF-378 350W 12V para com USB e LED|Inversor veicular IF-378 — 12 V, até 350 W anunciados)$/i,correct:"Inversor veicular IF-378 — 12 V, até 350 W anunciados",summary:"A oferta do inversor IF-378 informa entrada de 12 V, saída anunciada de 110 V, portas USB e visor LED. Os 350 W são apresentados como potência máxima; a ficha não confirma a potência contínua nem a compatibilidade com aparelhos específicos. As proteções citadas no anúncio não foram testadas nesta análise.",positiveNotes:["Entrada de 12 V, portas USB e visor LED informados na oferta."],negativeNotes:["Potência contínua e atuação das proteções não verificadas."],suppressRating:true}],
  ["mlMLB5158506809", {syncInformationalSchema:true,expectedListing:"MLB5306223743",model:/^(?:Kit 2 Body Splash Masculino Seduction Ocean 200ml Cada)$/i,summary:"A ficha anuncia duas unidades de 200 mL. O endereço vinculado faz referência a Ocean e Seduction Homme; confira no anúncio quais frascos compõem o kit antes de comprar. A descrição disponível não confirma se os dois frascos têm a mesma fragrância ou se são diferentes.",positiveNotes:["Duas unidades de 200 mL cada, conforme o cadastro."],negativeNotes:["A composição exata do kit e a duração da fragrância não foram confirmadas."],suppressRating:true}],
  ["mlMLB5210159957", {syncInformationalSchema:true,expectedListing:"MLB5210159957",model:/^(?:Oculos Polarizado De Sol Masculino Casual Pesca Praia Uv400|Óculos de sol — polarização e UV400 anunciados)$/i,correct:"Óculos de sol — polarização e UV400 anunciados",summary:"O anúncio informa lentes TAC, polarização e proteção UV400. São características declaradas pelo vendedor, sem laudo verificado nesta ficha. O formato e o ajuste no rosto também não foram verificados; consulte as medidas da armação na oferta.",positiveNotes:["Lentes TAC e polarização descritas no anúncio."],negativeNotes:["A proteção UV400 foi anunciada, mas não confirmada por laudo nesta ficha."],suppressRating:true}],
  ["mlMLB5217026798", {syncInformationalSchema:true,expectedListing:"MLB5217026798",model:/^(?:Tenis Masculino Estilo Bota Adventure Nobuck Wonder)$/i,summary:"Tênis Wonder de estilo bota, anunciado como Adventure Nobuck. A descrição não confirma a composição do material nem o desempenho em trilhas. Confira o material e as características do solado na variante escolhida; não houve teste de aderência ou de resistência à água.",positiveNotes:["Visual de bota, conforme o anúncio."],negativeNotes:["Não há confirmação de composição, aderência em trilhas ou impermeabilidade nesta ficha."],suppressRating:true}],
  ['mlMLB4953439757', {syncInformationalSchema:true, expectedListing:'MLB4953439757', model:/^(?:Kit Mobilador Teclado Gamer Rgb 80% Suporte Mouse Hub Cabo)$/i, summary:"A oferta descreve um kit com teclado e mouse RGB, mouse pad e conexão OTG USB-C. O teclado é anunciado como de membrana, com toque descrito pelo vendedor como semimecânico; isso não confirma interruptores mecânicos. O cadastro informa QWERTY e português do Brasil, mas não confirma o padrão ABNT2. Confira a disposição das teclas, os acessórios incluídos na variante e o suporte a OTG no seu aparelho.", positiveNotes:["Teclado e mouse RGB informados na oferta."], negativeNotes:["Layout físico, acessórios e compatibilidade OTG a confirmar."],suppressRating:true}],
  ['mlMLB4964975723', {syncInformationalSchema:true, expectedListing:'MLB5467769983', model:/^(?:Google Gemini Ai Pro 18 Meses \| Via Link De Ativação|Google AI Pro — oferta de terceiro anuncia 18 meses)$/i, correct:"Google AI Pro — oferta de terceiro anuncia 18 meses", summary:"O vendedor anuncia acesso ao Google AI Pro por 18 meses via link de ativação. Trata-se de uma oferta de terceiro: a documentação oficial do Google One descreve o plano, mas não comprova a autorização do vendedor, a elegibilidade da sua conta, a duração ou os benefícios desta oferta. Confira as condições de ativação, renovação e reembolso antes de comprar. Não entregue senha nem códigos de verificação ao vendedor. A ativação não foi testada.", positiveNotes:["Oferta anuncia entrega por link."], negativeNotes:["Vínculo com o Google, elegibilidade, duração e benefícios da oferta não verificados."],suppressRating:true}],
  ['mlMLB5136589984', {syncInformationalSchema:true, expectedListing:'MLB5136589984', model:/^(?:Tenis Masculino Sapatenis Polo Feet Sapato Casual Promoção)$/i, summary:"A oferta descreve um sapatênis masculino casual. O título menciona Polo Feet, enquanto o campo de marca informa Polo Street Ultra; a ficha não confirma que os nomes identifiquem a mesma marca. MLB5136589984 é o número do anúncio do vendedor, não um código de catálogo. Confira a etiqueta, a referência e a numeração da variante escolhida. Não testamos ajuste ou conforto.", positiveNotes:["Formato casual indicado no anúncio."], negativeNotes:["Marca e referência exata a confirmar na etiqueta."],suppressRating:true}],
  ['mlMLB4812800951', {syncInformationalSchema:true, expectedListing:'MLB4812800951', model:/^(?:Mini drone L900 PRO SE com dual câmera 8K preto 5GHz 2 baterias Motor sem escova profissional|Mini drone L900 PRO SE preto — câmera dupla e duas baterias anunciadas)$/i, correct:"Mini drone L900 PRO SE preto — câmera dupla e duas baterias anunciadas", summary:"A oferta identifica um mini drone L900 PRO SE preto, com câmera dupla, duas baterias, GPS, Wi-Fi e motor sem escovas anunciados. O vendedor menciona 8K, mas a ficha não confirma se isso se refere a fotos, vídeo ou resolução nativa do sensor. A indicação de 5 GHz não esclarece qual conexão usa essa frequência. Confira manual, itens do kit e compatibilidade antes de escolher. Não testamos imagem, alcance ou autonomia.", positiveNotes:["Câmera dupla e duas baterias informadas no anúncio."], negativeNotes:["Resolução nativa, frequência de conexão, alcance e autonomia não verificados."],suppressRating:true}],
  ['mlMLB4835180937', {syncInformationalSchema:true, expectedListing:'MLB4835180937', model:/^(?:Kit 3 Body Splash Masculino Vibration \+ Blunn \+ Infalível Fero By Primacial Body Man)$/i, summary:"A oferta identifica um kit Primacial Body Man com Vibration, Blunn e Infalível Fero. O cadastro indica 200 mL por unidade e frascos não recarregáveis; confira o conteúdo do kit e os rótulos. Origem brasileira, composição vegana e a declaração de produto livre de crueldade animal são informações do anúncio, não verificações da equipe. A presença no Mercado Livre não comprova que o vendedor seja oficial da marca. Não testamos as fragrâncias nem sua fixação.", positiveNotes:["Três fragrâncias identificadas na oferta."], negativeNotes:["Volume e composição a conferir nos rótulos; fixação não testada."],suppressRating:true}],
  ['mlMLB4741657351', {syncInformationalSchema:true, expectedListing:'MLB4702359857', model:/^Tênis Feminino Kolosh Confortável Macio Ziper Envio Rápido$/i, summary:"A oferta vinculada apresenta um tênis feminino Kolosh branco com zíper. O cadastro indica largura padrão e interior de tecido. Confira referência, numeração e variação antes de escolher. O zíper é uma característica anunciada, não uma garantia de conforto ou ajuste. Não testamos o calçado e não confirmamos prazo de envio.", positiveNotes:["Zíper e cor branca informados na oferta."], negativeNotes:["Ajuste e conforto não testados; conferir tamanho e variação."],suppressRating:true}],
  ['mlMLB4748589927', {syncInformationalSchema:true, expectedListing:'MLB4748589927', model:/^Body Splash Masculino Vibration 200ml - Primacial Perfume Bergamota Fresco$/i, summary:"A oferta identifica o body splash masculino Vibration da Primacial, anunciado em frasco de 200 mL não recarregável. Bergamota e frescor são descrições do anúncio, não impressões de um teste da equipe. A origem brasileira e a declaração de produto livre de crueldade animal não foram verificadas de forma independente. Estar no Mercado Livre não comprova que a oferta seja oficial da marca. Confira o rótulo da unidade; não medimos fixação ou projeção.", positiveNotes:["Fragrância Vibration e volume anunciados na oferta."], negativeNotes:["Origem e declaração de produto livre de crueldade não verificadas; fixação não testada."],suppressRating:true}],
  ['mlMLB4748674769', {syncInformationalSchema:true, expectedListing:'MLB4748674769', model:/^Kit Body Splash Masculino Vibration E Blunn 200ml - Primacial Perfume Bergamota Limão$/i, summary:"A oferta identifica um kit Primacial com os body splashes Vibration e Blunn. O cadastro indica 200 mL por unidade e frascos não recarregáveis; confira o conteúdo do conjunto e os rótulos. O título menciona bergamota e limão sem atribuir aqui uma nota específica a cada fragrância. Origem brasileira e a declaração de produto livre de crueldade animal são informações do anúncio, não verificações da equipe. Não confirmamos que o vendedor seja oficial da marca e não testamos fixação ou projeção.", positiveNotes:["Vibration e Blunn identificados no anúncio do conjunto."], negativeNotes:["Volume e composição a conferir nos rótulos; desempenho não testado."],suppressRating:true}],
  ['mlMLB4645102377', {syncInformationalSchema:true, expectedListing:'MLB4645102377', model:/^Kit Body Splash Masculino Barbarius \+ Enigma \+ Midtown 200ml$/i, summary:"A oferta identifica um kit Primacial com Barbarius, Enigma e Midtown. O cadastro indica 200 mL por unidade e embalagem não recarregável; confira os rótulos e o conteúdo do conjunto. Origem brasileira, composição vegana e a declaração de produto livre de crueldade animal são informações do anúncio, não verificações desta ficha. Estar no Mercado Livre não comprova que a oferta seja oficial da marca. Não testamos fragrância ou fixação.", positiveNotes:["Três fragrâncias identificadas na oferta."], negativeNotes:["Volume e composição devem ser conferidos nos rótulos; fixação não testada."],suppressRating:true}],
  ['mlMLB4699180013', {syncInformationalSchema:true, expectedListing:'MLB5215481527', model:/^Tênis Vans Vr3 Ultrarange Marshmallow Slip Meia Unissex$/i, summary:"A oferta identifica um tênis anunciado como Vans UltraRange VR3 Slip, na cor Marshmallow. O código MLB4699180013 citado no texto anterior não identifica o anúncio atualmente vinculado; a ficha não o usa como código de catálogo. Confira referência, numeração e composição da unidade antes de escolher. Não verificamos autenticidade, materiais, conforto ou aderência e não transferimos características de outras versões UltraRange.", positiveNotes:["Linha, formato e cor identificados no anúncio."], negativeNotes:["Referência completa, composição e ajuste a confirmar."],suppressRating:true}],
  ['mlMLB4443112343', {
    syncInformationalSchema:true, expectedListing:'MLB4443112343',
    model:/^Fone de Ouvido Gamer In-ear Vellon TWS Bluetooth 5\.0, com Microfone e Estojo de Carregamento$/i,
    summary:'A oferta identifica um par de fones Vellon TWS intra-auriculares, com Bluetooth 5.0, microfone e estojo de carregamento anunciados. O cadastro cita alcance de 10 m, bateria de 40 mAh, seis horas de uso, recarga em uma hora e estojo de 320 mAh; são valores anunciados, sem condições de ensaio documentadas nesta ficha. Não garantimos estabilidade a essa distância, autonomia em qualquer volume ou quantidade de recargas pelo estojo. Gamer no título não comprova baixa latência ou adequação a qualquer jogo. Não testamos som, microfone, conexão ou bateria; confirme modelo, compatibilidade e instruções de recarga antes de escolher.',
    positiveNotes:['Formato in-ear, Bluetooth 5.0, microfone e estojo informados na oferta.'],
    negativeNotes:['Alcance, autonomia e tempo de carga anunciados, não medidos pela equipe.', 'Baixa latência e ciclos adicionais não comprovados; confirmar compatibilidade.'],suppressRating:true,
  }],
  ['mlMLB4474977007', {
    syncInformationalSchema:true, expectedListing:'MLB4474977007',
    model:/^(?:Salvo Maison Alhambra 100ml Eua De Parfum Perfume Original|Salvo Maison Alhambra Eau de Parfum 100 ml anunciado)$/i,
    correct:'Salvo Maison Alhambra Eau de Parfum 100 ml anunciado',
    summary:'A oferta identifica Salvo Maison Alhambra em apresentação anunciada de 100 ml, como Eau de Parfum e não recarregável. Confira nome completo, embalagem e volume da unidade antes de escolher. O identificador MLBU3786865269 aparece no endereço da oferta, mas não comprova autenticidade ou origem da unidade; original no título também não é autenticação da equipe. País de origem e declaração livre de crueldade animal são informações do cadastro, não verificações documentadas nesta ficha. Não testamos fragrância, fixação ou projeção e não acrescentamos notas olfativas, certificação ou semelhança com outro perfume por suposição.',
    positiveNotes:['Nome Salvo Maison Alhambra e apresentação de 100 ml identificados na oferta.'],
    negativeNotes:['Autenticidade, origem e declaração livre de crueldade não verificadas nesta revisão.', 'Fixação e projeção não testadas; confirmar embalagem e apresentação não recarregável anunciada.'],suppressRating:true,
  }],
  ['mlMLB4291654613', {
    syncInformationalSchema:true, expectedListing:'MLB4291654613',
    model:/^Tênis Vizzano Feminino Casual Original Confortável Moda 1430$/i,
    summary:'A oferta identifica um tênis feminino casual anunciado como Vizzano 1430. O código MLB4291654613 identifica o anúncio do vendedor, não um código de catálogo confirmado. Confira referência completa, composição, numeração e cor da variação antes de escolher. Original e confortável no título não comprovam autenticidade ou conforto para cada pessoa. Não testamos ajuste, aderência ou durabilidade e não acrescentamos materiais ou tecnologias de outro Vizzano. A condição novo é informação da oferta, não inspeção da unidade pela equipe.',
    positiveNotes:['Marca Vizzano e referência anunciada 1430 identificadas; conferir código completo.'],
    negativeNotes:['Número do anúncio não confirma catálogo ou autenticidade.', 'Conforto, ajuste e material da unidade não verificados pela equipe.'],suppressRating:true,
  }],
  ['mlMLB4367472775', {
    syncInformationalSchema:true, expectedListing:'MLB4367472775',
    model:/^Smart Tv 43 Philco P43vik Roku Led Dolby Audio Wi-fi Hdmi Hdr Full Hd 110\/220v$/i,
    summary:'A oferta identifica uma Smart TV Philco P43VIK de 43 polegadas, com Roku, resolução Full HD, Dolby Audio, Wi-Fi, HDMI e HDR anunciados no cadastro. Pode interessar a quem compara uma TV conectada desse tamanho, mas confirme código completo, portas e especificações da unidade antes de escolher. Não testamos navegação, imagem, som ou facilidade de uso; fluidez e som imersivo não são resultados medidos pela equipe. A menção a aplicativos não garante que todos os serviços estejam disponíveis na versão, nem que conteúdo por assinatura esteja incluído. A indicação 110/220 V deve ser conferida na identificação e documentação da unidade, sem orientar ligação por suposição. Não acrescentamos recursos 4K ou de outra série Philco e não classificamos custo-benefício sem comparação documentada.',
    positiveNotes:['Tela anunciada de 43 polegadas e sistema Roku identificados na oferta.'],
    negativeNotes:['Imagem, áudio e fluidez não testados; especificações e conexões precisam de confirmação.', 'Aplicativos e assinaturas não presumidos como incluídos; sem comparação de custo-benefício comprovada.'],suppressRating:true,
  }],
  ['mlMLB4151024813', {
    syncInformationalSchema:true, expectedListing:'MLB4151024813',
    model:/^Tênis Mizuno Nirvana 9 Leve Caminhada Academia Treino$/i,
    summary:'A oferta identifica um tênis anunciado como Mizuno Nirvana 9. O código MLB4151024813 identifica o anúncio do vendedor, não um código de catálogo confirmado. Confira referência, numeração, cor e composição da variação selecionada. Leve, caminhada, academia e treino são expressões do título, não peso medido ou avaliação de adequação individual feita pela equipe. Não testamos conforto, amortecimento, aderência ou durabilidade e não transferimos materiais ou tecnologias de outro Mizuno. A condição novo é informação da oferta, não inspeção ou autenticação da unidade.',
    positiveNotes:['Identificação Nirvana 9 e marca Mizuno informadas na oferta; confirmar referência.'],
    negativeNotes:['Número do anúncio não comprova catálogo, composição ou autenticidade.', 'Peso e desempenho não testados; atividades do título não garantem adequação individual.'],suppressRating:true,
  }],
  ['mlMLB4231915505', {
    syncInformationalSchema:true, expectedListing:'MLB7763309132',
    model:/^Controle Joystick Wireless Compatível C\/ Pc Android N-switch$/i,
    summary:'A oferta apresenta um controle sem fio com compatibilidade anunciada para PC, Android e Nintendo Switch. Confirme marca, modelo, versões de sistema, forma de conexão e jogos aceitos no manual da unidade antes de escolher; a lista de plataformas não garante funcionamento de todos os recursos em cada uma. Botões configuráveis, macro e turbo são informações do cadastro, não funções testadas pela equipe. O texto anterior mencionava usuários relatando falta de adaptador Bluetooth, mas não há fonte identificada nesta ficha para esse relato; confirme o conteúdo do kit diretamente na oferta. Não testamos ergonomia, latência, pareamento, autonomia ou compatibilidade e não transferimos recursos de outro controle.',
    positiveNotes:['Proposta de controle sem fio para várias plataformas informada na oferta.'],
    negativeNotes:['Confirmar modelo, conexão e funções por plataforma; compatibilidade não testada.', 'Conteúdo do kit a confirmar; relato de usuários sobre adaptador sem fonte identificada.'],suppressRating:true,
  }],
  ['mlMLB4291652941', {
    syncInformationalSchema:true, expectedListing:'MLB4291652941',
    model:/^(?:CÚRCUMA 130mg \+ COLÁGENO Tipo II 45mg - Fórmula com Máxima Concentração e Pureza - 60 Cápsulas|Cúrcuma 130 mg e colágeno tipo II 45 mg anunciados — 60 cápsulas)$/i,
    correct:'Cúrcuma 130 mg e colágeno tipo II 45 mg anunciados — 60 cápsulas',
    summary:'A oferta identifica um suplemento anunciado como cúrcuma 130 mg com colágeno tipo II 45 mg, em embalagem de 60 cápsulas, com marca Essencial Labs informada no cadastro. Confira rótulo, composição, porção de referência, lote, validade e restrições da unidade: os valores do título não demonstram por si a quantidade por cápsula. Máxima concentração e pureza não são resultados de ensaio comprovados nesta ficha. Não verificamos o lote, a declaração sem glúten ou avaliações de consumidores e não as usamos como prova de qualidade ou benefício. Retiramos a orientação de uma cápsula diária e a promessa de longevidade articular; não prescrevemos dose, não comprovamos eficácia clínica e não prometemos prevenir ou tratar doenças. Para adequação individual, procure orientação de profissional de saúde.',
    positiveNotes:['Ingredientes e apresentação de 60 cápsulas identificados na oferta, sujeitos à conferência do rótulo.'],
    negativeNotes:['Porção, composição, pureza e regularidade do lote não verificadas nesta revisão.', 'Sem dose prescrita ou benefício articular garantido; avaliações de consumidores não comprovam eficácia.'],suppressRating:true,
  }],
  ['mlMLB4031468281', {
    syncInformationalSchema:true, expectedListing:'MLB4031468281',
    model:/^Tênis Masculino Casual Sapatenis Novo Lançamento Conforto$/i,
    summary:'A oferta identifica um sapatênis masculino casual, com marca Wayke informada no cadastro. O código MLB4031468281 identifica o anúncio do vendedor, não um código de catálogo confirmado. Novo lançamento é uma expressão do título, sem data de lançamento documentada nesta ficha. Conforto também não é resultado de teste da equipe. Confira referência do modelo, numeração, cor e composição da variação antes de escolher. Não testamos ajuste, aderência ou durabilidade e não acrescentamos couro, amortecimento ou tecnologia de outro calçado. A condição novo é informação da oferta, não inspeção da unidade.',
    positiveNotes:['Estilo casual masculino e marca Wayke identificados no cadastro.'],
    negativeNotes:['Código do anúncio não confirma catálogo; data de lançamento não documentada.', 'Conforto, materiais e desempenho da unidade não verificados pela equipe.'],suppressRating:true,
  }],
  ['mlMLB4147473207', {
    syncInformationalSchema:true, expectedListing:'MLB4147473207',
    model:/^Tênis Feminino Esportivo Actvitta Super Leve Macio Corrida$/i,
    summary:'A oferta identifica um tênis feminino anunciado como Actvitta. O código MLB4147473207 identifica o anúncio do vendedor, não um código de catálogo confirmado. Super leve, macio e corrida são expressões do título; não temos peso medido, teste de conforto ou avaliação de adequação à corrida nesta ficha. Confira referência do modelo, composição, numeração e cor da variação selecionada. Não testamos amortecimento, aderência ou durabilidade e não transferimos tecnologias de outro Actvitta. A condição novo é informação da oferta, não inspeção realizada pela equipe.',
    positiveNotes:['Marca Actvitta e apresentação feminina identificadas na oferta; conferir modelo.'],
    negativeNotes:['Número do anúncio não confirma catálogo; peso e maciez não medidos.', 'Adequação à corrida, amortecimento e ajuste não testados; conferir referência e numeração.'],suppressRating:true,
  }],
  ['mlMLB3966936389', {
    syncInformationalSchema:true, expectedListing:'MLB3966936389',
    model:/^Tênis Mormaii Urban Free Masculino Casual Original Skate Nfe$/i,
    summary:'A oferta identifica um tênis masculino anunciado como Mormaii Urban Free. O código MLB3966936389 identifica o anúncio do vendedor, não um código de catálogo confirmado. Confira referência do modelo, numeração, cor e composição da variação escolhida. Original e NFE no título não autenticam a unidade, e a palavra skate não comprova desempenho ou adequação à prática esportiva. Não testamos ajuste, conforto, aderência ou durabilidade nem transferimos materiais e tecnologias de outra linha Mormaii. A condição novo é informação da oferta, não inspeção da equipe.',
    positiveNotes:['Linha Urban Free masculina identificada na oferta; confirmar referência e variação.'],
    negativeNotes:['Número do anúncio não é catálogo confirmado nem prova de autenticidade.', 'Ajuste e desempenho não testados; skate no título não garante adequação ao esporte.'],suppressRating:true,
  }],
  ['mlMLB3973124591', {
    syncInformationalSchema:true, expectedListing:'MLB3973124591',
    model:/^Sapatênis Masculino Casual Com Cadarço Dia A Dia Versátil$/i,
    summary:'A oferta identifica um sapatênis masculino casual com cadarço, com marca Soled Calçados informada no cadastro. O código MLB3973124591 identifica o anúncio do vendedor, não um código de catálogo confirmado. Pode interessar a quem busca esse estilo, mas dia a dia e versátil não comprovam conforto prolongado ou adequação a qualquer atividade. Confira código do modelo, composição, numeração e cor da variação antes de escolher. Não testamos ajuste, aderência ou resistência e não acrescentamos couro ou tecnologias de outro calçado. A condição novo é informação da oferta, não inspeção da unidade.',
    positiveNotes:['Formato casual com cadarço e marca informados na oferta.'],
    negativeNotes:['Código do anúncio não confirma catálogo; modelo e composição precisam ser conferidos.', 'Conforto, ajuste e resistência não testados; sem material ou tecnologia presumidos.'],suppressRating:true,
  }],
  ['mlMLB4028845341', {
    syncInformationalSchema:true, expectedListing:'MLB4028845341',
    model:/^Tênis Kappa Run 200 Original Caminhada Academia$/i,
    summary:'A oferta identifica um tênis anunciado como Kappa Run 200. O código MLB4028845341 identifica o anúncio do vendedor, não um código de catálogo confirmado. Confira referência, composição, numeração e cor da variação selecionada. Original no título não autentica a unidade, e caminhada e academia são usos mencionados pelo anúncio, não avaliação de adequação individual feita pela equipe. Não testamos amortecimento, conforto, aderência ou durabilidade e não transferimos características de outros modelos Kappa. A condição novo permanece como informação da oferta, não inspeção do produto.',
    positiveNotes:['Identificação Run 200 e marca Kappa presentes na oferta; confirmar referência.'],
    negativeNotes:['Número do anúncio não comprova catálogo ou autenticidade da unidade.', 'Amortecimento e adequação à atividade não testados; conferir tamanho e composição.'],suppressRating:true,
  }],
  ['mhz9cN2MnCkxuSW5OPlv', {
    syncInformationalSchema:true,
    model:/^Pistola Fixação Finca Pino Ação Direta$/i,
    summary:'A oferta identifica uma ferramenta anunciada como finca-pino de ação direta. A descrição reúne aplicações em concreto, aço, gesso, drywall e PVC, mas não fornece marca, modelo técnico ou manual específico que confirme essas compatibilidades. Não apresentamos fixação rápida e eficiente em qualquer parede como resultado comprovado. Os termos grampeador, rebitador e pregador do anúncio também não demonstram que a unidade cumpra todas essas funções. Confira identificação, documentação e conteúdo exato do kit antes de escolher; maleta e EPI mencionados não comprovam certificação ou proteção suficiente. Esta ficha corresponde a este cadastro, sem transferir características da outra finca-pino revisada. Não testamos fixação ou segurança e não orientamos acionamento, carga, pinos ou uso em estruturas por suposição.',
    positiveNotes:['Oferta identificada como finca-pino; conferir modelo e conteúdo do kit específico.'],
    negativeNotes:['Compatibilidade com materiais e funções não confirmada por manual específico.', 'Fixação e segurança não testadas; EPI anunciado não comprova certificação ou proteção suficiente.'],suppressRating:true,
  }],
  ['mlMLB1921632393', {
    syncInformationalSchema:true, expectedListing:'MLB1921632393',
    model:/^Pc Gamer Completo I7 Gtx1650 Ssd120 Hd1tb 16gb Fonte 750w$/i,
    summary:'A oferta identifica um computador anunciado com Intel Core i7, GTX 1650, 16 GB de RAM, SSD de 120 GB, HD de 1 TB e fonte indicada como 750 W. São dados do cadastro, não inspeção dos componentes. O nome Core i7 não informa sozinho a geração e o código do processador; confirme também placa-mãe, modelo da placa de vídeo, fonte e condição das peças antes de comparar. A potência anunciada da fonte não comprova eficiência, qualidade ou potência medida pela equipe. Completo no título não esclarece por si quais monitor, periféricos, sistema e acessórios estão incluídos. Não testamos jogos, estabilidade ou desempenho e não prometemos taxa de quadros ou compatibilidade com qualquer jogo. Mantemos as capacidades anunciadas sem substituir componentes por uma configuração parecida.',
    positiveNotes:['Configuração anunciada de Core i7, GTX 1650 e 16 GB de RAM identificada na oferta.'],
    negativeNotes:['Código e geração do processador, modelos das peças e conteúdo do conjunto a confirmar.', 'Fonte e desempenho não testados; sem FPS, eficiência ou compatibilidade universal prometidos.'],suppressRating:true,
  }],
  ['mlMLB2088799901', {
    syncInformationalSchema:true, expectedListing:'MLB2088799901',
    model:/^(?:Kit Reparo Pneu Tubeless Para Bike Bicileta|Kit de reparo tubeless Cyclingbox para bicicleta — sem inflador anunciado)$/i,
    correct:'Kit de reparo tubeless Cyclingbox para bicicleta — sem inflador anunciado',
    summary:'A oferta identifica um kit Cyclingbox para reparo de pneu tubeless de bicicleta, com inflador não incluído segundo o cadastro. Pode interessar a quem compara ferramentas para esse tipo de pneu, mas confirme itens, quantidades e compatibilidade com seu conjunto antes de escolher. O código de catálogo MLB2062216813 aparece no endereço da oferta; ele não autentica a unidade ou demonstra que o vendedor seja oficial da marca. A condição novo é informação do anúncio, não inspeção da equipe. Não testamos vedação, durabilidade ou adequação a um dano específico e não garantimos reparo de qualquer furo. A ficha não fornece instruções de reparo ou autoriza continuar usando um pneu danificado sem avaliação adequada.',
    positiveNotes:['Proposta de kit para tubeless de bicicleta identificada; inflador anunciado como não incluído.'],
    negativeNotes:['Conferir itens, quantidades e compatibilidade; vedação e durabilidade não testadas.', 'Catálogo e condição anunciada não comprovam autenticidade ou vendedor oficial.'],suppressRating:true,
  }],
  ['MEkEjNiiDdi5MpmlP07R', {
    syncInformationalSchema:true,
    model:/^Garrafa térmica Termolar Lúmina Bomba de Pressão 1L$/i,
    summary:'A oferta identifica uma garrafa térmica Termolar Lúmina de 1 litro com bomba de pressão. Pode interessar a quem prefere servir por acionamento da bomba; confira dimensões e apresentação da unidade antes de escolher. A ficha não informa condições específicas de ensaio de conservação térmica, por isso não prometemos uma duração para bebidas quentes ou frias. O mecanismo de pressão não foi testado pela equipe e não é apresentado como defeito comprovado. Confira as orientações de uso e limpeza do modelo; não acrescentamos material interno, resistência a quedas ou garantia contra vazamentos sem documentação específica.',
    positiveNotes:['Capacidade anunciada de 1 litro e sistema de bomba de pressão identificados na oferta.'],
    negativeNotes:['Conservação térmica e mecanismo não testados; sem duração ou resistência presumida.', 'Conferir apresentação e orientações do modelo antes do uso e da limpeza.'],suppressRating:true,
  }],
  ['LDzmbLcaHUVNztsXyp52', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB6972453978',
    model:/^(?:Câmera de Segurança Wi-Fi iCSee\/Yoosee A28B 4K Dupla Lente Visão Noturna Colorida Full Hd Externa Prova D'água Ip66 Sensor Movimento Woosh|Câmera Wi-Fi A28B Woosh anunciada — resolução e aplicativo a confirmar)$/i,
    correct:'Câmera Wi-Fi A28B Woosh anunciada — resolução e aplicativo a confirmar',
    summary:'A oferta identifica uma câmera Wi-Fi anunciada como A28B Woosh de dupla lente. O título usa 4K e Full HD, sem esclarecer qual resolução corresponde a cada lente ou ao arquivo gravado; não tratamos essas expressões como comprovação de resolução nativa. Confirme identificação, aplicativo e especificações no manual da unidade: mencionar iCSee e Yoosee não garante compatibilidade com ambos. Dupla lente ou movimento do aparelho também não comprovam visão simultânea de 360 graus sem pontos cegos. Áudio bidirecional, rastreamento e visão noturna são características anunciadas, não testes da equipe. A indicação IP66 não foi verificada em documentação específica e não é apresentada como impermeabilidade ou garantia de uso externo permanente. Não testamos imagem, detecção, conexão ou resistência ao tempo.',
    positiveNotes:['Dupla lente e conexão Wi-Fi informadas na oferta; confirmar modelo e aplicativo.'],
    negativeNotes:['4K e Full HD coexistem no título sem resolução nativa esclarecida.', 'Aplicativos, cobertura, detecção e proteção IP66 não verificados por teste ou manual específico.'],suppressRating:true,
  }],
  ['lfGwhT6zO5b7LOPvqkuL', {
    syncInformationalSchema:true, expectedListing:'MLB5363840668',
    model:/^(?:Smartphone Motorola Edge 60 5g - 512gb 12gb Ram\+12gb Ram|Motorola Edge 60 5G 512 GB — 12 GB de RAM e até 12 GB de RAM Boost)$/i,
    correct:'Motorola Edge 60 5G 512 GB — 12 GB de RAM e até 12 GB de RAM Boost',
    summary:'A oferta identifica o Motorola Edge 60 5G com 512 GB de armazenamento e 12 GB de RAM. Os 12 GB adicionais mencionados no anúncio correspondem ao RAM Boost: a Motorola distingue memória física de expansão que utiliza armazenamento, portanto não apresentamos a soma como 24 GB de RAM física. Pode interessar a quem procura essa configuração, mas o espaço disponível ao usuário e o funcionamento do Boost dependem da versão e do sistema. Tela pOLED de 6,7 polegadas, 120 Hz, processador Dimensity 7300 e bateria de 5.200 mAh são dados do cadastro, não medições da equipe. As classificações IP68/IP69 não equivalem a impermeabilidade sem limites ou garantia contra qualquer dano por água; confira as condições da versão específica. Não testamos desempenho, autonomia, câmeras ou resistência e não transferimos recursos do Edge 60 Pro ou Fusion.',
    publicContextUrl:'https://colaborador.motorola.com.br/smartphone-motorola-edge-60-5g/p?idsku=1656',
    positiveNotes:['Configuração anunciada de 512 GB e 12 GB de RAM, com RAM Boost distinguido da memória física.'],
    negativeNotes:['RAM Boost utiliza armazenamento e não equivale a RAM física adicional.', 'Proteção, autonomia e desempenho sujeitos às condições da versão; sem teste próprio ou garantia de impermeabilidade.'],suppressRating:true,
  }],
  ['LQ12PkH1sbM7Uu0geBQf', {
    syncInformationalSchema:true, expectedListing:'MLB3798032968',
    model:/^Lava E Seca Samsung Wd11m Com Digital Inverter Inox 11kg Cor Inox look$/i,
    summary:'A oferta identifica uma lava e seca Samsung WD11M Inox Look, com capacidades anunciadas de 11 kg para lavagem e 7 kg para secagem. As capacidades são diferentes e não significam lavar e secar 11 kg no mesmo ciclo. Pode interessar a quem busca as duas funções no mesmo aparelho, desde que confira código completo, tensão, dimensões e requisitos do local. A Samsung limita o ciclo rápido de 15 minutos a peças levemente sujas em cargas menores que 2 kg, e o lava e seca de 59 minutos a cargas menores que 1 kg nas condições indicadas pela marca. Esses tempos não são promessa para qualquer carga. A menção a esterilização a seco se refere ao Air Wash e a ensaios específicos divulgados pela fabricante, não a toda lavagem ou garantia de eliminação de todos os agentes. Não medimos ruído, consumo, secagem ou preservação dos tecidos; Digital Inverter e Diamond Drum não são garantias de resultado individual.',
    publicContextUrl:'https://www.samsung.com/br/washers-and-dryers/wd11m/',
    positiveNotes:['Lavagem e secagem no mesmo aparelho; capacidades anunciadas de 11 kg e 7 kg diferenciadas.'],
    negativeNotes:['Ciclos de 15/59 minutos têm limites de carga e condições específicas, não capacidade total.', 'Ruído, consumo e resultado de higienização ou cuidado dos tecidos não testados pela equipe.'],suppressRating:true,
  }],
  ['kNmf4r3kzbgWX6Fz3Y0x', {
    syncInformationalSchema:true, expectedListing:'MLB4213547319',
    model:/^Chuveiro Lorenzetti Bella Ducha 4T Ultra para Parede$/i,
    summary:'A Bella Ducha 4T Ultra, da Lorenzetti, oferece quatro opções de temperatura e espalhador de grandes dimensões, segundo a fabricante. Pode interessar a quem compara duchas elétricas com seleção de temperaturas, mas a versão precisa ser conferida antes da escolha. Os 6,8 kW citados no cadastro correspondem à opção de 220 V na tabela da marca, não a todas as versões da linha. Isso não confirma que a unidade do anúncio seja a opção de 220 V: confira tensão, potência e identificação na embalagem e na seleção da oferta. A ficha não substitui avaliação da instalação e o manual específico; não definimos fiação, disjuntor, ligação ou troca de resistência por suposição. Não testamos aquecimento, vazão, consumo ou adequação ao seu banheiro e não prometemos economia ou pressão de água.',
    publicContextUrl:'https://www.lorenzetti.com.br/produto/bella-ducha-4t/',
    positiveNotes:['Quatro opções de temperatura e grande espalhador documentados pela fabricante.'],
    negativeNotes:['6.800 W correspondem à versão 220 V na tabela da marca; confirmar a unidade selecionada.', 'Instalação e compatibilidade precisam de avaliação específica; aquecimento e consumo não testados.'],suppressRating:true,
  }],
  ['KtvIJ0CLFVYesONQSS8I', {
    syncInformationalSchema:true, expectedListing:'MLB4477083023',
    model:/^Tênis Nike Court Vision Low Masculino$/i,
    summary:'A oferta identifica um tênis masculino anunciado como Nike Court Vision Low. O código MLB4477083023 identifica o anúncio do vendedor, não um código de catálogo confirmado. Confira código completo do modelo, numeração, cor e composição da variação escolhida; o nome da linha não comprova sozinho os materiais ou a autenticidade da unidade. Pode interessar a quem procura esse modelo, mas não transferimos amortecimento, conteúdo reciclado ou outras tecnologias de uma versão Court Vision diferente. Não testamos ajuste, conforto, aderência ou resistência e não presumimos adequação a corrida ou prática esportiva pelo nome do calçado. A condição novo é informação da oferta, não inspeção realizada pela equipe.',
    positiveNotes:['Linha Court Vision Low masculina identificada na oferta; conferir código e variação.'],
    negativeNotes:['Código do anúncio não confirma catálogo, materiais ou autenticidade da unidade.', 'Ajuste e desempenho não testados; sem tecnologias transferidas de outra versão.'],suppressRating:true,
  }],
  ['kyK4G9Uov6eBaFnNVED7', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB5011962698',
    model:/^(?:Perfume Feminino L' Eau de Parfum Fragrância Floral Gourmand Inebriante com Notas de Íris Nobre, Baunilha e Pralinê La Vie Est Belle Lancôme, Frasco com 100ml|Lancôme La Vie Est Belle Eau de Parfum 100 ml — versão do frasco a confirmar)$/i,
    correct:'Lancôme La Vie Est Belle Eau de Parfum 100 ml — versão do frasco a confirmar',
    summary:'A oferta identifica La Vie Est Belle Eau de Parfum, da Lancôme, em apresentação anunciada de 100 ml. O perfil floral gourmand, com íris, baunilha e pralinê mencionados no anúncio, pode interessar a quem procura essa família olfativa; não representa avaliação sensorial da equipe. A marca apresenta versões recarregáveis e refis, mas isso não comprova que qualquer frasco de 100 ml anunciado seja recarregável ou que inclua refil. Confira versão, embalagem e indicação de recarga da unidade; não autenticamos o produto do vendedor. A expressão design de cristal do texto anterior não é mantida como confirmação de material. Não testamos projeção, fixação ou preferência individual e não prometemos intensidade ou duração na pele. Não transferimos características de outras variações de La Vie Est Belle para este anúncio.',
    publicContextUrl:'https://www.lancome.com.br/perfume-feminino-la-vie-est-belle-eau-de-parfum/LABR3614273694797.html',
    positiveNotes:['Identificação La Vie Est Belle Eau de Parfum e apresentação de 100 ml informadas na oferta.'],
    negativeNotes:['Confirmar versão recarregável e conteúdo; existência de refil não prova compatibilidade da unidade.', 'Material do frasco, autenticidade, projeção e fixação não verificados pela equipe.'],suppressRating:true,
  }],
  ['KHQKsjwv2MzJGObyoZkd', {
    syncInformationalSchema:true,
    model:/^Perfume Carolina Herrera Very Good Girl Glam Parfum 50ml feminino$/i,
    summary:'A oferta identifica Very Good Girl Glam, de Carolina Herrera, em apresentação anunciada de 50 ml. A marca descreve notas de cereja, rosa, vetiver e baunilha e o frasco em formato de salto com glitter. Pode interessar a quem procura esse perfil olfativo, mas a descrição da marca não equivale a teste sensorial da equipe ou garantia de preferência. Parfum no anúncio não permite deduzir um percentual de concentração, intensidade ou duração fixa na sua pele. Confira denominação, volume e embalagem da unidade; não autenticamos o produto do vendedor. Não testamos fixação, projeção ou tolerância e retiramos a frase incompleta do texto anterior. As advertências devem ser consultadas no rótulo específico, sem prescrever teste de pele a partir de uma concentração presumida.',
    publicContextUrl:'https://www.carolinaherrera.com/es/en/p-fragrance/very-good-girl-glam',
    positiveNotes:['Perfil de cereja, rosa, vetiver e baunilha descrito pela marca para Very Good Girl Glam.'],
    negativeNotes:['Fixação, projeção e preferência não testadas; sem concentração percentual presumida.', 'Conferir volume e embalagem; autenticidade e tolerância da unidade não verificadas.'],suppressRating:true,
  }],
  ['KjczAN39YiZOmTgmzwIt', {
    syncInformationalSchema:true,
    model:/^Cama Elástica Pula Pula Infantil Trampolim 1,4 Metros Atentu$/i,
    summary:'A oferta identifica uma cama elástica infantil anunciada como Atentu de 1,4 metro. Estrutura de aço, rede lateral com zíper, seis pés e molas de aço são informações do cadastro, não inspeção da equipe. Pode interessar a quem compara dimensões e recursos de trampolins infantis, mas a faixa de 3 a 7 anos do texto anterior não foi confirmada por manual específico nesta revisão. Confira identificação, limites de uso, dimensões e documentação da unidade antes de escolher. Rede e zíper não garantem ausência de acidentes nem comprovam certificação; reforçado e resistente também não substituem ensaio do produto. Não testamos estabilidade, capacidade ou segurança e não definimos carga, número de usuários, montagem ou condições de uso externo por suposição.',
    positiveNotes:['Dimensão anunciada de 1,4 m e rede lateral com zíper descritas na oferta.'],
    negativeNotes:['Faixa etária, capacidade e certificação precisam de documentação específica.', 'Rede e estrutura não garantem segurança; sem teste de estabilidade ou resistência.'],suppressRating:true,
  }],
  ['kkADU0pbN4LUhcYR1HMH', {
    syncInformationalSchema:true, expectedListing:'MLB5554213538',
    model:/^Kit Principia para Rotina de Skincare Pele Sensível com Protetor Solar FPS 60$/i,
    summary:'A oferta apresenta um kit Principia para pele sensível com protetor solar anunciado como FPS 60. O cadastro cita GL-02, CM-01 e PS-01, mas a página da marca consultada para um kit semelhante identifica GL-02, CH-01 e PS-01 FPS 60. CM-01 e CH-01 não devem ser tratados como o mesmo creme: confirme os códigos, volumes e rótulos dos itens efetivamente incluídos no anúncio antes de escolher. Não substituímos componentes nem transferimos a composição do outro kit para esta oferta. Pode interessar a quem compara conjuntos de limpeza, hidratação e proteção solar, mas pele sensível no título não garante tolerância individual ou ausência de irritação. Não testamos o conjunto, não prescrevemos rotina de aplicação e não asseguramos resultado individual; confira instruções e advertências de cada produto.',
    positiveNotes:['Proposta de conjunto de cuidados com protetor FPS 60 identificada na oferta.'],
    negativeNotes:['CM-01 no cadastro versus CH-01 no kit semelhante da marca; conteúdo exato a confirmar.', 'Indicação para pele sensível não garante tolerância; sem teste do conjunto ou composição transferida.'],suppressRating:true,
  }],
  ['k0fHNRurzCmYEdcHcn1V', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB5075784673',
    model:/^(?:Pistola Fixação Finca Pino Ação Direta Pregos Epi Maleta Pinador Pregador Grampeador Rebitador De Prego Pressão Ferramenta Para Drywal Gesso Concreto Aço Parede|Ferramenta finca-pino anunciada — modelo e compatibilidade a confirmar)$/i,
    correct:'Ferramenta finca-pino anunciada — modelo e compatibilidade a confirmar',
    summary:'A oferta apresenta uma ferramenta anunciada como finca-pino de ação direta. O cadastro não identifica marca, modelo técnico ou manual específico suficiente para confirmar seu sistema e suas aplicações. A lista de concreto, aço, gesso e drywall no título não comprova compatibilidade com qualquer superfície, e não a mantemos como garantia de fixação. Termos como grampeador, rebitador e pregador não demonstram que a ferramenta execute todas essas funções. Confira identificação, documentação e conteúdo exato do kit antes de escolher; EPI e maleta no título não confirmam certificação ou suficiência dos acessórios. Não testamos resistência da fixação, eficiência ou segurança e não fornecemos instruções de acionamento, carga ou escolha de pinos sem documentação específica.',
    positiveNotes:['Oferta identificada como ferramenta finca-pino; identificação técnica e kit precisam ser confirmados.'],
    negativeNotes:['Compatibilidade com superfícies e funções adicionais não comprovadas por manual específico.', 'Sem teste de fixação ou segurança; menção a EPI não comprova certificação ou proteção suficiente.'],suppressRating:true,
  }],
  ['k82L2iy2Q6giFdCHVbSg', {
    syncInformationalSchema:true, expectedListing:'MLB6889668614',
    model:/^Fritadeira Elétrica Air Fryer WAP Barbecue Heat WC AB1030$/i,
    summary:'A WAP Barbecue Heat WC AB1030 combina painel digital e oito funções pré-programadas, segundo a fabricante. Pode interessar a quem procura diferentes modos de preparo no mesmo aparelho. A capacidade total informada é de 6,6 litros, enquanto a ficha técnica da marca informa cesto de 3,2 litros: os dois valores não representam o mesmo espaço de uso. A WAP informa ajuste até 230 °C, quatro níveis de grelha e revestimento Graystone; os limites variam conforme a função e devem ser conferidos no manual. Há referências distintas para 127 V e 220 V; isso não deve ser interpretado como bivolt automático. Confirme a versão da unidade e os acessórios do anúncio. Não testamos uniformidade, resultado de churrasco, aderência do revestimento ou capacidade por receita e não garantimos preparo de qualquer quantidade em uma única rodada.',
    publicContextUrl:'https://parceiros.wap.ind.br/fritadeira-eletrica-air-fryer-wap-barbecue-heat-wc-ab1030-1/p',
    positiveNotes:['Painel digital e oito funções documentados pela fabricante para a WC AB1030.'],
    negativeNotes:['6,6 L totais e 3,2 L de cesto são medidas diferentes; avaliar espaço para a receita.', 'Confirmar versão 127 V ou 220 V e limites de cada função; resultados culinários não testados.'],suppressRating:true,
  }],
  ['K8hXvUkqAAnbt0Om6wRj', {
    syncInformationalSchema:true, expectedListing:'MLB6609986264',
    model:/^Fritadeira Air Fryer Philco 16 Litros Paf16c Preto$/i,
    summary:'A oferta identifica uma fritadeira air fryer Philco PAF16C preta, com capacidade anunciada de 16 litros. Pode interessar a quem compara aparelhos de maior volume, mas esse número não confirma sozinho a área útil para alimentos ou quantas porções cabem sem sobreposição. O texto anterior associava o tamanho a uma circulação de ar mais eficiente e à dispensa de várias rodadas; não há medição específica nesta ficha que sustente essas garantias. Confira dimensões, acessórios, tensão e capacidade dos recipientes da unidade antes de escolher. O acesso ao manual específico localizado nesta revisão não foi concluído, por isso não acrescentamos funções, potência ou componentes de PAF16A, PAF15C ou outra versão. Não testamos uniformidade, tempo de preparo, consumo ou rendimento por receita.',
    positiveNotes:['Modelo PAF16C, cor preta e volume anunciado de 16 litros identificados na oferta.'],
    negativeNotes:['Volume total não determina porções ou dispensa de várias rodadas; espaço útil a confirmar.', 'Manual específico não acessado e desempenho não testado; não importar funções de outros modelos.'],suppressRating:true,
  }],
  ['jABp2HpfTmQNwXsPgrYQ', {
    syncInformationalSchema:true, expectedListing:'MLB4812143184',
    model:/^Creatina Monohidratada Pura 500g Dark Lab Unidade$/i,
    summary:'A oferta identifica creatina monohidratada Dark Lab em apresentação anunciada de 500 g. Confira rótulo, ingredientes, lote, validade e apresentação da unidade antes de escolher. A palavra pura no título e referências a matérias-primas importadas ou a avaliações de terceiros não comprovam a composição e a pureza do lote vendido. Não foi confirmado nesta revisão um laudo específico que vincule os percentuais citados anteriormente à unidade da oferta; por isso não os apresentamos como resultado comprovado. Não testamos o suplemento, não autenticamos a unidade e não prescrevemos dose ou uso individual. As orientações e restrições devem ser conferidas no rótulo específico; esta ficha não substitui avaliação profissional nem promete resultados.',
    positiveNotes:['Apresentação de 500 g e creatina monohidratada Dark Lab identificadas na oferta.'],
    negativeNotes:['Pureza, procedência e composição do lote não verificadas por laudo específico nesta revisão.', 'Conferir rótulo, lote, validade e restrições; sem dose ou resultado individual prometido.'],suppressRating:true,
  }],
  ['jffyLJv2cImsjfarZ1pi', {
    syncInformationalSchema:true, expectedListing:'MLB3824682239',
    model:/^(?:Ventilador de Teto Ventisol Aires Inverter Aires Inverter 14222 Teto Bivolt|Ventisol Aires Inverter 14222 — ventilador de teto bivolt com controle)$/i,
    correct:'Ventisol Aires Inverter 14222 — ventilador de teto bivolt com controle',
    summary:'O Ventisol Aires Inverter, referência 14222, é identificado pela fabricante como ventilador de teto branco, bivolt e com controle remoto. Pode interessar a quem prefere ajustar a ventilação sem alcançar o aparelho. A página da Ventisol informa seis velocidades e função Wave, que alterna velocidades; não se trata de uma medição de conforto feita pela equipe. A fabricante informa que não acompanha lâmpada: a menção a luminária no cadastro não deve ser confundida com lâmpada incluída. Os 30 W do texto da oferta não são medição nossa, e não usamos essa indicação para prometer economia na sua conta. Não medimos ruído, vazão, consumo ou cobertura do ambiente; silêncio e adequação a qualquer espaço não estão garantidos. Confira referência, conteúdo do kit e requisitos no manual específico antes da instalação.',
    publicContextUrl:'https://www.ventisol.com.br/ventilador-de-teto-ventisol-aires-127v220v-inverter-branco',
    positiveNotes:['Controle remoto, seis velocidades e função Wave documentados pela fabricante para o Aires Inverter 14222.'],
    negativeNotes:['Não acompanha lâmpada, segundo a fabricante; confirmar conteúdo do kit da oferta.', 'Ruído, consumo e adequação ao ambiente não medidos; sem promessa de silêncio ou economia individual.'],suppressRating:true,
  }],
  ['JWp7l6fsqNkkSsBCAosW', {
    syncInformationalSchema:true, expectedListing:'MLB5652036470',
    model:/^Tênis Masculino Couro Nobuck Casual Minimalista Urbano Top$/i,
    summary:'A oferta identifica um tênis masculino casual, com marca artoro e couro nobuck informados no cadastro. O código MLB5652036470 identifica o anúncio do vendedor, não um código de catálogo confirmado. Pode interessar a quem procura um visual casual, mas minimalista e urbano são descrições de estilo, não evidências de conforto ou desempenho. Confira código do modelo, numeração, cor e composição da variação escolhida; não verificamos fisicamente o material da unidade. Não testamos ajuste, aderência, resistência ou impermeabilidade e não atribuímos tecnologia de outro calçado a esta oferta. A condição novo é informação do anúncio, não inspeção da equipe.',
    positiveNotes:['Identificação casual, marca artoro e nobuck informados na oferta; confirmar variação.'],
    negativeNotes:['Código do anúncio não confirma catálogo ou composição da unidade.', 'Ajuste, aderência e durabilidade não testados; conferir numeração e material.'],suppressRating:true,
  }],
  ['iXzsMyqf9ilSKwbLDtk7', {
    syncInformationalSchema:true, expectedListing:'MLB7105555314',
    model:/^Tênis Masculino Esportivo Creation Molas Academia Caminhada$/i,
    summary:'A oferta identifica um tênis masculino anunciado como Creation Molas, com marca Wave informada no cadastro. O código MLB7105555314 identifica o anúncio do vendedor, não um código de catálogo confirmado. Confira marca, código do modelo, numeração e variação na embalagem antes de escolher; esta ficha não associa o produto a outra fabricante pelo nome Creation ou Wave. As palavras molas, academia e caminhada do título não comprovam tecnologia de amortecimento, adequação a uma atividade ou conforto para cada pessoa. Não testamos ajuste, aderência, resistência ou desempenho e não acrescentamos materiais ou tecnologias de outro calçado. A condição novo é informação da oferta, não inspeção da unidade pela equipe.',
    positiveNotes:['Identificação Creation Molas e marca Wave informadas na oferta; confirmar modelo e apresentação.'],
    negativeNotes:['Código do anúncio não confirma catálogo, autenticidade ou fabricante da unidade.', 'Ajuste, amortecimento e adequação à atividade não testados; confirmar tamanho e variação.'],suppressRating:true,
  }],
  ['J6WCPaTR5KOqjsAC1nM7', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB6513365616',
    model:/^(?:Lampada Led Solar Recarregável Camping Usb Pesca Jardim Lampiao Viagem Several|Lâmpada LED Several — recarga USB e solar anunciada)$/i,
    correct:'Lâmpada LED Several — recarga USB e solar anunciada',
    summary:'A oferta identifica uma lâmpada LED Several portátil, com recarga USB e solar anunciada. Pode interessar a quem compara opções de iluminação transportável, mas confirme modelo, bateria, painel e acessórios da unidade antes de escolher. Os 10 W e a indicação 127/220 V do cadastro não foram verificados em manual específico. Não tratamos esse valor de rede como autorização para ligar a lâmpada diretamente à tomada; é necessário distinguir a entrada do aparelho da especificação de um eventual carregador. A menção a recarga solar não comprova tempo de carga ou autonomia em qualquer condição de luz. Jardim, camping e possibilidade de suspensão não confirmam proteção contra chuva ou uso externo permanente. Não testamos brilho, duração, recarga ou resistência e não acrescentamos valores elétricos de outro lampião.',
    positiveNotes:['Iluminação LED portátil e recarga por USB/solar informadas na oferta.'],
    negativeNotes:['Confirmar alimentação e carregador; indicação de rede não define a entrada elétrica da lâmpada.', 'Autonomia, brilho e proteção contra água não testados; recarga solar depende das condições.'],suppressRating:true,
  }],
  ['j8z58qFPJKTUJogf5HTM', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB6655269258',
    model:/^(?:Celular Smartphone Realme Note 80s 128gb 4gb Ram Dual Sim Bateria 6000mah Ultrafino 7,94 Mm Resistência À Poeira E Água Ip54|Realme Note 80s 128 GB e 4 GB de RAM — especificações anunciadas)$/i,
    correct:'Realme Note 80s 128 GB e 4 GB de RAM — especificações anunciadas',
    summary:'A oferta identifica um aparelho anunciado como Realme Note 80s, com 128 GB de armazenamento, 4 GB de RAM, dual SIM, tela de 6,7 polegadas e bateria de 6.000 mAh. São informações do cadastro, não inspeção da unidade ou medições da equipe. Confirme o código completo e a versão na embalagem: a busca desta revisão não forneceu fonte primária exata suficiente para validar todas as especificações do Note 80s. A menção a IP54 no anúncio não é tratada como impermeabilidade, autorização para imersão ou garantia contra danos por água; confira condições e limites na documentação específica. Não testamos proteção, espessura, autonomia ou desempenho, e a capacidade da bateria não determina sozinha sua duração. Não transferimos dados de outro Note ou realme C63. Estar no Mercado Livre não comprova que o vendedor seja oficial da marca.',
    positiveNotes:['Configuração de 128 GB e 4 GB de RAM identificada no anúncio como Note 80s.'],
    negativeNotes:['Confirmar código e versão: fonte primária exata não verificada para todas as especificações.', 'IP54 e bateria permanecem anunciados; sem teste de proteção, autonomia ou garantia de impermeabilidade.'],suppressRating:true,
  }],
  ['IQP6np7muXjwAQ6aN20M', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB5249120331',
    model:/^(?:Smartphone Samsung Galaxy A17 5g 128gb 4gb Super Amoled 6\.7'' Câmera 50mp Selfie 13 Mp 5000 Mah Nfc Dual Sim Recursos Ia - Cinza|Samsung Galaxy A17 5G 128 GB e 4 GB de RAM cinza — configuração anunciada)$/i,
    correct:'Samsung Galaxy A17 5G 128 GB e 4 GB de RAM cinza — configuração anunciada',
    summary:'A oferta identifica o Samsung Galaxy A17 5G cinza, com 128 GB de armazenamento e 4 GB de RAM anunciados. Tela Super AMOLED de 6,7 polegadas, câmera traseira de 50 MP, frontal de 13 MP, bateria de 5.000 mAh, NFC e dual SIM são informações do cadastro, não teste ou inspeção da unidade. Confira o código completo do modelo e a configuração antes de escolher; não transferimos características do A17 4G ou de outra capacidade. Recursos de IA mencionados no título precisam ser identificados na versão e no software específicos; não prometemos funções apenas pela sigla. Não testamos fotografia, desempenho, autonomia ou compatibilidade com sua operadora. O fato de o anúncio estar no Mercado Livre não confirma que o vendedor seja oficial da Samsung nem autentica o aparelho.',
    positiveNotes:['Configuração anunciada de 128 GB e 4 GB de RAM, modelo A17 5G e cor cinza identificados.'],
    negativeNotes:['Confirmar código do modelo, configuração e funções de IA da versão específica.', 'Autonomia, fotografia e compatibilidade não testadas; vendedor oficial não comprovado pela plataforma.'],suppressRating:true,
  }],
  ['iSyPxYQcVUDjHvjIHLhS', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB6519291232',
    model:/^(?:Mini Mixer Misturador De Bebidas Elétrico 2 Em 1 Portátil Recarregável Mexedor De Ovos Whey Leite Café Espuma Shake Drinks Capuccino Suco Comica|Mini mixer Comica 2 em 1 recarregável — acessórios a confirmar)$/i,
    correct:'Mini mixer Comica 2 em 1 recarregável — acessórios a confirmar',
    summary:'A oferta identifica um mini mixer anunciado como Comica, portátil, recarregável e 2 em 1. Pode interessar a quem compara pequenos misturadores de bebidas, mas a expressão 2 em 1 não confirma sozinha quais hastes e acessórios acompanham a unidade. Confira conteúdo, alimentação e instruções específicas antes de escolher. A lista de bebidas e alimentos do título não comprova capacidade de processar qualquer ingrediente ou equivalência a um liquidificador. A suposta sensibilidade dos encaixes do texto anterior não foi confirmada por teste ou fonte específica e não é mantida como defeito comprovado. Também não prescrevemos ciclos de carga sem documentação da bateria. Não testamos espuma, mistura, resistência, autonomia ou limpeza e não importamos potência ou proteção contra água de outro aparelho.',
    positiveNotes:['Proposta de mini mixer 2 em 1 portátil e recarregável informada na oferta.'],
    negativeNotes:['Confirmar acessórios e limites de uso; não equivale a processar todo ingrediente.', 'Encaixes e bateria não testados; sem rotina de carga ou resistência à água presumida.'],suppressRating:true,
  }],
  ['hVTGYQmARQt2fyDqPZDa', {
    syncInformationalSchema:true, expectedListing:'MLB6427849268',
    model:/^(?:Sapatênis Microfibra Atanado Pinhão Navy Pegada|Sapatênis Pegada de microfibra anunciado — cor e variação a confirmar)$/i,
    correct:'Sapatênis Pegada de microfibra anunciado — cor e variação a confirmar',
    summary:'A oferta identifica um sapatênis anunciado como Pegada, com microfibra no título. Há divergência de cor: o título menciona pinhão/navy, enquanto a descrição informa preto. Confira fotos da variação selecionada, cor, numeração e código do modelo na embalagem antes de escolher; não presumimos que os termos descrevam a mesma apresentação. O código de catálogo antigo do texto também não coincide com o endereço atual, por isso não o usamos como confirmação de identidade. A menção a microfibra não comprova couro natural nem características de outra linha Pegada. Não testamos ajuste, conforto, aderência ou durabilidade e não autenticamos a unidade do vendedor. A condição novo é informação da oferta, não inspeção realizada pela equipe.',
    positiveNotes:['Identificação Pegada e material anunciado como microfibra presentes no título da oferta.'],
    negativeNotes:['Cor divergente entre título e descrição; confirmar variação, numeração e modelo.', 'Composição, procedência e conforto da unidade não verificados; sem tecnologias importadas de outra linha.'],suppressRating:true,
  }],
  ['iFRhxwa7Jugs5n2BSQJD', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB7770241922',
    model:/^(?:Kit 8 Latas Refil Nautika Ntk 227g Camping Maçarico Fogareiro Fogão Recarga Gás Acampamento Portátil Cozinha Flambar Cozinhar Vivara Laranja-claro Kit 8 Latas Refil Nautika Ntk 22|Kit de oito refis de gás de 227 g anunciados — marca a confirmar)$/i,
    correct:'Kit de oito refis de gás de 227 g anunciados — marca a confirmar',
    summary:'A oferta anuncia um kit de oito refis de gás, com 227 g indicados no título. A identificação da marca é divergente: o título menciona Nautika/NTK e o campo de marca informa Vivara. Confirme a marca e a identificação impressas nas latas da unidade antes de escolher; não tratamos a referência a NTK como autenticação do conjunto. Os 227 g anunciados não são apresentados como peso bruto total das oito latas. As palavras fogareiro, maçarico e fogão não comprovam que esses aparelhos estejam incluídos ou que qualquer conector seja compatível. Confira o conteúdo do kit e as instruções específicas dos cartuchos e do aparelho. Esta ficha não orienta recarga, transferência de gás, adaptação de conexão ou manuseio do combustível. Não verificamos composição, vedação, duração ou segurança, e estar no Mercado Livre não comprova vendedor oficial.',
    positiveNotes:['Quantidade anunciada de oito refis, com identificação de 227 g no título; conteúdo a confirmar.'],
    negativeNotes:['Marca divergente entre título e cadastro; conferir embalagem e procedência.', 'Sem compatibilidade universal ou aparelhos incluídos presumidos; seguir instruções específicas, sem adaptações.'],suppressRating:true,
  }],
  ['IIBNXuN1JmBc0Ol6iO6O', {
    syncInformationalSchema:true, expectedListing:'MLB4505827975',
    model:/^Lixeira Inteligente 16l Sensor Automático Tampa Touch Casa$/i,
    summary:'A oferta identifica uma lixeira de capacidade anunciada de 16 litros, com abertura e fechamento por sensor e tampa touch descritos no cadastro. Pode interessar a quem compara opções para ambientes internos, mas confirme as dimensões, o mecanismo e os itens incluídos na unidade. A alimentação por pilhas é informação do anúncio; sem marca, modelo ou manual específico confirmados, não afirmamos que seja a única forma de alimentação de toda versão semelhante. Confira tipo e quantidade de pilhas e se acompanham o produto, sem presumir bateria recarregável ou conexão USB. A indicação para cozinha ou banheiro não comprova proteção contra água ou adequação a qualquer condição de umidade. Não testamos resposta do sensor, vedação de odores, autonomia ou resistência e não importamos recursos de outra lixeira de 16 litros.',
    positiveNotes:['Capacidade de 16 litros e tampa com sensor informadas na oferta.'],
    negativeNotes:['Confirmar modelo, dimensões, alimentação e itens incluídos; sem exclusividade de alimentação presumida.', 'Sensor, vedação e proteção contra água não testados; uso interno não é garantia para toda umidade.'],suppressRating:true,
  }],
  ['hhnKX4x5l2ab7gguVoYU', {
    syncInformationalSchema:true, expectedListing:'MLB7173279944',
    model:/^(?:Piscina Inflável Pvc Espessa Resistente Família Grande|Piscina inflável de PVC — capacidade de 3\.000 litros anunciada)$/i,
    correct:'Piscina inflável de PVC — capacidade de 3.000 litros anunciada',
    summary:'A oferta identifica uma piscina inflável de marca genérica, descrita como de PVC, com capacidade anunciada de 3.000 litros. As expressões espessa, resistente e família grande não comprovam espessura do material, durabilidade ou quantidade de pessoas adequada. Confirme o modelo, as dimensões, os componentes e as instruções da unidade antes de escolher; o cadastro avisa que as imagens podem ser ilustrativas. A capacidade anunciada não determina sozinha o nível de enchimento recomendado, a carga sobre a superfície de apoio ou a adequação ao local. Não fornecemos dimensionamento de instalação, rotina de tratamento da água ou orientação de uso sem manual específico. Não testamos material, vedação, resistência ou segurança e não transferimos especificações de outra piscina visualmente semelhante.',
    positiveNotes:['Piscina inflável de PVC com capacidade de 3.000 litros informada na oferta; modelo a confirmar.'],
    negativeNotes:['Sem espessura, dimensões ou resistência verificadas; imagens podem ser ilustrativas.', 'Capacidade nominal não define instalação ou ocupação; seguir instruções específicas da unidade.'],suppressRating:true,
  }],
  ['hLiaQWog1dogQ2OpMDSt', {
    syncInformationalSchema:true, expectedListing:'MLB5799991832',
    model:/^Ventilador De Mesa 40cm Turbo NVT-40-BL MONDIAL$/i,
    summary:'A oferta identifica o ventilador de mesa Mondial NVT-40-BL de 40 cm, com oito pás plásticas azuis e estrutura preta informadas no cadastro. A frequência anunciada é de 60 Hz. Essas características vêm da oferta, não de inspeção da unidade pela equipe. A página estar no Mercado Livre não comprova que o vendedor seja oficial da Mondial. Confira a tensão e a identificação na etiqueta do aparelho antes da escolha, sem presumir que seja bivolt. Não acrescentamos potência, nível de ruído, vazão ou recursos de outra versão. Não testamos ventilação, consumo, silêncio ou durabilidade; a palavra Turbo do nome não representa um resultado de comparação medido por nós.',
    positiveNotes:['Modelo NVT-40-BL, diâmetro de 40 cm e oito pás informados na oferta.'],
    negativeNotes:['Confirmar tensão e versão da unidade; vendedor oficial não comprovado apenas pela plataforma.', 'Ruído, consumo e ventilação não testados; sem especificações importadas de outro Mondial.'],suppressRating:true,
  }],
  ['htLzwGXLZpkVa0eXWdkr', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB3705389546',
    model:/^(?:Soprador de folhas lateral Fak260S 2T 26Cc 0,90Hp Carbon Fak cor laranja profissional a gasolina|Soprador lateral Carbon Fak FAK260S — motor 2 tempos de 26 cc)$/i,
    correct:'Soprador lateral Carbon Fak FAK260S — motor 2 tempos de 26 cc',
    summary:'A oferta identifica o soprador lateral Carbon Fak FAK260S, a gasolina, com motor de dois tempos de 26 cc e potência anunciada de 0,9 HP. A referência da marca informa tanque de 650 ml, velocidade de ar de até 280 km/h e autonomia aproximada de uma hora; são dados declarados, não medições da equipe. Não confirmamos o consumo de 0,650 litro por hora do cadastro como resultado real da unidade. A indicação de 470 m³ aparece sem uma unidade de tempo na referência consultada; não a transformamos por suposição em vazão por hora para comparar com outros sopradores. A qualificação profissional não comprova adequação a qualquer tarefa ou duração de trabalho. Confira instruções, acessórios e requisitos de segurança no manual específico. Não testamos ruído, desempenho, consumo ou resistência e não fornecemos proporção de combustível, adaptação ou procedimento de manutenção.',
    positiveNotes:['Identificação FAK260S e motor de dois tempos de 26 cc, com 0,9 HP anunciados.'],
    negativeNotes:['Autonomia e velocidade são declaradas; consumo real não medido e unidade temporal da vazão não esclarecida.', 'Adequação à tarefa e segurança dependem das instruções específicas; sem teste ou orientação de combustível.'],
    contextSourceUrl:'https://www.carbonfak.com.br/produto/soprador-de-folhas-lateral-26cc-fak260s-3',contextSourceLabel:'Carbon Fak FAK260S: referência de dados declarados, não teste de desempenho ou da unidade',suppressRating:true,
  }],
  ['Hd0FWwNPR8uVXWLwPz3A', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB6755589412',
    model:/^(?:Carrinho Controle Remoto Recarregavel Storm Racer Turbo Potente Luz Led Alta Velocidade Preto Amorelancia|Carrinho de controle remoto Storm Racer recarregável, preto)$/i,
    correct:'Carrinho de controle remoto Storm Racer recarregável, preto',
    summary:'A oferta identifica um carrinho Storm Racer preto, de controle remoto, com bateria recarregável. Escala de 1:18, conexão de 2,4 GHz e velocidade de até 20 km/h são informações do anúncio, não medições da equipe. Pode interessar a quem procura esse tipo de brinquedo; confira dimensões, faixa etária, bateria e acessórios da unidade. A escala não confirma sozinha as medidas externas, e a frequência não comprova alcance ou ausência de interferências. Rodas descritas como de borracha não garantem aderência em todo piso. O intervalo de carga de 2 a 6 horas do cadastro precisa corresponder às instruções da bateria e do carregador específicos; não é uma rotina de recarga prescrita por esta ficha. Não testamos velocidade, autonomia, alcance, resistência ou estabilidade e não tratamos turbo, potente ou alta velocidade como qualificação comprovada.',
    positiveNotes:['Storm Racer recarregável, com escala de 1:18 e conexão de 2,4 GHz anunciadas.'],
    negativeNotes:['Velocidade, alcance e aderência não testados; confirmar idade, dimensões e conteúdo do kit.', 'Tempo de recarga depende das instruções da bateria e do carregador da unidade.'],suppressRating:true,
  }],
  ['hDRgi7LAJobY4o5W9ipJ', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB5139987445',
    model:/^(?:Jogo 6 Copos Diamond Egipcio 300ml Vidro Grosso Diamante Luxo Transparente Vitrex|Jogo de seis copos Diamond Egípcio 300 ml — marca e material a confirmar)$/i,
    correct:'Jogo de seis copos Diamond Egípcio 300 ml — marca e material a confirmar',
    summary:'A oferta identifica um jogo de seis copos transparentes Diamond Egípcio, com capacidade anunciada de 300 ml por peça. Há divergências no cadastro: o título menciona Vitrex e vidro grosso, enquanto o endereço do anúncio traz Sekbem e a descrição informa cristal. Confirme marca e material na embalagem da unidade; não tratamos vidro e cristal como identificação confirmada do mesmo conjunto. Pode interessar a quem compara conjuntos de copos, mas as medidas e a capacidade precisam corresponder à apresentação escolhida. Espessura ou a palavra luxo não comprovam resistência, qualidade superior ou tolerância térmica. A indicação de lava-louças precisa ser confirmada nas instruções específicas; não presumimos compatibilidade com aquecimento ou mudanças de temperatura. Não testamos quebra, limpeza ou material, e estar no Mercado Livre não torna o anúncio oficial do fabricante.',
    positiveNotes:['Conjunto de seis copos Diamond Egípcio transparentes, com 300 ml por peça anunciados.'],
    negativeNotes:['Marca e material divergentes entre título, descrição e endereço; confirmar embalagem.', 'Resistência e uso em lava-louças não verificados na unidade; sem tolerância térmica presumida.'],suppressRating:true,
  }],
  ['HEP91TkP4BHCEvBWmTHq', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB4973328077',
    model:/^(?:Honeywhale Rm2 Pro Patinete Elétrico Infantil, 70w-10km\/h-11km, Motor-velocidade-autonomia, Triciclo Elétrico Dobrável Com Luzes De Led E Bluetooth, Scooter Para Crianças A Partir De 3 Anos, Rosa|Patinete infantil Honeywhale RM2 Pro rosa — idade de uso a confirmar)$/i,
    correct:'Patinete infantil Honeywhale RM2 Pro rosa — idade de uso a confirmar',
    summary:'A oferta identifica o patinete elétrico infantil Honeywhale RM2 Pro rosa. A referência brasileira da marca distingue 50 W nominais de 70 W de pico; os 70 W não são apresentados como potência contínua verificada pela equipe. Velocidade de até 10 km/h e autonomia de até 11 km são valores anunciados, não resultados de teste da unidade. Não confirmamos a indicação a partir de 3 anos do anúncio como adequação a qualquer criança. Antes da escolha, o responsável precisa conferir faixa etária, altura, carga, condições de uso e advertências do manual específico; capacidade de carga não determina idade adequada. O catálogo público de manuais consultado não disponibilizava o PDF do RM2 Pro. Não testamos frenagem, equilíbrio, autonomia ou segurança, nem tratamos três rodas, luzes ou Bluetooth como garantia de proteção. Página no Mercado Livre não comprova vendedor oficial ou autentica a unidade.',
    positiveNotes:['Modelo RM2 Pro rosa identificado; referência da marca separa potência nominal de pico.'],
    negativeNotes:['Idade indicada no anúncio precisa de confirmação nas instruções específicas; sem garantia de adequação individual.', 'Velocidade e autonomia anunciadas não são medições; frenagem e segurança não testadas.'],
    contextSourceUrl:'https://www.honeywhale.com.br/produto/rm2-pro-patinete-eletrico-infantil-dobravel/',contextSourceLabel:'Honeywhale Brasil: referência de potência e valores anunciados, não teste ou indicação individual',suppressRating:true,
  }],
  ['H17ykC6IlHMpWBEMnEQ7', {
    syncInformationalSchema:true, expectedListing:'MLB5598192576',
    model:/^(?:Mala De Viagem 10kg Promoção Rodas 360° Miami Com Frasqueira|Mala Miami com frasqueira e rodas 360° anunciadas — tamanho a confirmar)$/i,
    correct:'Mala Miami com frasqueira e rodas 360° anunciadas — tamanho a confirmar',
    summary:'A oferta identifica um conjunto Miami com mala, frasqueira e rodas de 360 graus anunciadas. Há uma divergência que precisa ser esclarecida antes da escolha: o título cadastrado menciona 10 kg, enquanto o endereço do anúncio identifica tamanho M. Não presumimos que seja uma mala de cabine nem que essas informações correspondam à mesma variação. Confirme com o vendedor o tamanho selecionado, as dimensões externas, incluindo rodas e alças, e o peso vazio. A expressão 10 kg não comprova essas medidas ou o limite de carga do produto; confira também as condições de bagagem da sua viagem. A expansão e o cadeado TSA citados na descrição não foram confirmados para a unidade. Não atribuímos uma medida de expansão, certificação ou proteção garantida ao cadeado sem documentação específica. Não testamos rodas, resistência, fechamento ou durabilidade e não trocamos o anúncio por outro tamanho.',
    positiveNotes:['Mala Miami, frasqueira e rodas de 360 graus identificadas na oferta; confirmar conjunto.'],
    negativeNotes:['Divergência entre 10 kg no título e tamanho M no endereço; confirmar variação e dimensões.', 'Expansão e cadeado TSA não confirmados; sem teste de resistência ou garantia de aceitação como bagagem.'],suppressRating:true,
  }],
  ['GSeid2PryzC2aiQwnv3h', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB4780018962',
    model:/^(?:Purificador de Água Gelada Fria e Natural Elétrico Compacto Eletrônico placa Filtro refil 6 meses ou 3000l Painel Touch Bivolt Cinza PE12G Electrolux|Purificador Electrolux PE12G cinza bivolt — três opções de temperatura anunciadas)$/i,
    correct:'Purificador Electrolux PE12G cinza bivolt — três opções de temperatura anunciadas',
    summary:'A oferta identifica o purificador Electrolux PE12G cinza, bivolt, com seleção de água gelada, fria ou natural pelo painel touch. Pode interessar a quem compara opções para a cozinha; confira dimensões e requisitos de instalação no manual da unidade. O prazo de refil anunciado não é garantia de duração em qualquer condição. A referência da Electrolux recomenda troca com seis meses de uso ou até 3.000 litros e alerta que ela pode ser necessária antes, conforme uso, instalação e tipo de água; observe a indicação do produto. Não testamos filtragem, vazão, temperatura ou capacidade de atender consumo contínuo. A presença de três opções não comprova uma temperatura fixa em toda situação. Não afirmamos que o aparelho torne qualquer água própria para consumo nem transferimos características de outro purificador.',
    positiveNotes:['Modelo PE12G cinza, bivolt e três opções de temperatura identificados na oferta.'],
    negativeNotes:['Vida útil do refil depende das condições; a referência admite troca antes do prazo anunciado.', 'Filtragem, vazão e resfriamento não testados; confirmar requisitos de instalação e uso.'],
    contextSourceUrl:'https://content.electrolux.com.br/brasil/electrolux/pe12g/index.html',contextSourceLabel:'Electrolux PE12G: referência sobre condições de troca do refil, não teste da unidade',suppressRating:true,
  }],
  ['GT9gxxxsfkbjOfDG2uIM', {
    syncInformationalSchema:true,
    model:/^Perfume Vf Bloom Virginia Fonseca 75ml - Wepink Volume da unidade 75 mL$/i,
    summary:'A oferta identifica o perfume VF Bloom Virginia Fonseca, Wepink, na apresentação de 75 ml. O volume informa a quantidade anunciada, não a fixação na pele, a intensidade ou quanto tempo o frasco durará em cada rotina. A descrição anterior não fornecia base para uma promessa de duração. Não testamos aroma, projeção ou desempenho e não acrescentamos notas olfativas de outra fragrância da marca. Confira a versão, a embalagem e a procedência da unidade antes de escolher. Esta ficha não autentica o frasco do vendedor nem transforma o nome da marca em garantia de preferência pessoal. Sem uma referência específica confirmada, o perfil olfativo e os demais detalhes permanecem não verificados.',
    positiveNotes:['Identificação VF Bloom Wepink e apresentação de 75 ml informadas na oferta.'],
    negativeNotes:['Volume não comprova fixação ou duração; aroma e projeção não testados.', 'Confirmar versão e procedência; perfil olfativo específico não verificado.'],suppressRating:true,
  }],
  ['GzjyGVKcBkoiKgQEo4p9', {
    syncInformationalSchema:true, expectedListing:'MLB3556275459',
    model:/^(?:Shampoo Redutor de Grisalhos Grecin Control GX Para Todas os Tons Cabelo 118ml|Shampoo Grecin Control GX redutor de grisalhos 118 ml — versão a confirmar)$/i,
    correct:'Shampoo Grecin Control GX redutor de grisalhos 118 ml — versão a confirmar',
    summary:'A oferta identifica Grecin Control GX shampoo redutor de grisalhos de 118 ml, anunciado com efeito gradual. Não mantemos a indicação genérica para todos os tons: a referência brasileira do fabricante diferencia versões e informa que o shampoo padrão é mais indicado para castanho médio a preto. Confirme a versão da embalagem; não transferimos a indicação de uma versão para tons claros. A referência também traz restrições para cabelos clareados, descoloridos ou coloridos e orienta teste de alergia 48 horas antes do uso, conforme suas instruções. Leia integralmente as advertências da embalagem específica; esta ficha não substitui essas instruções. O tempo de aplicação de 2 a 3 minutos do cadastro não foi confirmado para a unidade e foi retirado. Não testamos cobertura, maciez, volume ou tolerância, nem prometemos resultado ou ausência de reações.',
    positiveNotes:['Identificação Control GX shampoo e apresentação de 118 ml informadas na oferta.'],
    negativeNotes:['Versão e tonalidades indicadas precisam ser conferidas; não há indicação universal.', 'Seguir advertências e teste de alergia do fabricante; resultado e tolerância não testados.'],
    contextSourceUrl:'https://www.justformen.com/pt-br/cgx-shampoo',contextSourceLabel:'Grecin: referência brasileira sobre versões e advertências, não avaliação individual ou teste da unidade',suppressRating:true,
  }],
  ['GPORGqPOixfgh38bVrXX', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB6760902576',
    model:/^(?:Smartphone Motorola Edge 70 Pro 5g - 256gb 24gb \(12gb Ram\+12gb Ram Boost\), 4 Câmeras De 50mp, Tela 1\.5k Extreme Amoled 144hz, Bateria 6500 Mah, Ip68\/ip69 - Azul Escuro|Motorola Edge 70 Pro 5G 256 GB — 12 GB de RAM e RAM Boost, azul escuro)$/i,
    correct:'Motorola Edge 70 Pro 5G 256 GB — 12 GB de RAM e RAM Boost, azul escuro',
    summary:'A oferta identifica o Motorola Edge 70 Pro 5G de 256 GB, azul escuro, com 12 GB de RAM física. A fabricante esclarece que a indicação de até 24 GB soma a RAM física ao recurso RAM Boost; não são 24 GB de memória física. Confira a configuração da unidade e as condições do recurso antes de comparar aparelhos. O anúncio menciona quatro câmeras de 50 MP no total, sendo três traseiras e uma frontal; isso não significa quatro câmeras traseiras nem comprova qualidade de imagem. Tela de 144 Hz, bateria de 6.500 mAh e classificações IP68/IP69 são dados anunciados, não medições da equipe. Não testamos fluidez, autonomia, fotografia ou resistência; confirme condições e limites na documentação da versão. A hospedagem da oferta no Mercado Livre não confirma que o vendedor seja oficial da Motorola. Não transferimos características de outra versão Edge.',
    positiveNotes:['Configuração anunciada de 256 GB e 12 GB de RAM física; RAM Boost identificado separadamente.'],
    negativeNotes:['RAM Boost não equivale a RAM física adicional; conferir configuração da unidade.', 'Autonomia, câmeras e resistência não testadas; anúncio não autentica vendedor ou unidade.'],
    contextSourceUrl:'https://www.motorola.com.br/smartphone-motorola-edge-70-pro-5g-256gb/p',contextSourceLabel:'Motorola Brasil: referência de RAM física e RAM Boost, não teste da unidade anunciada',suppressRating:true,
  }],
  ['GQiP9vBIhECa4I5CuzkB', {
    syncInformationalSchema:true, expectedListing:'MLB3806655487',
    model:/^Tênis Flyer Runner Mesh Bdp Puma$/i,
    summary:'A oferta identifica o tênis Puma Flyer Runner Mesh BDP, anunciado na cor preta. O código MLB3806655487 identifica o anúncio do vendedor, não um código de catálogo confirmado. Confira a numeração e a variação selecionadas antes de escolher: o nome do modelo não confirma sozinho o ajuste ao seu pé. A condição novo é uma informação da oferta, não inspeção da unidade pela equipe. Não testamos conforto, durabilidade, aderência ou desempenho e não importamos materiais, tecnologias de amortecimento ou indicações esportivas de outro Flyer Runner. Confira a tabela de medidas, os detalhes da apresentação e a procedência com o vendedor. Esta ficha não autentica o produto nem garante adequação a qualquer atividade.',
    positiveNotes:['Identificação Flyer Runner Mesh BDP e cor preta informadas na oferta.'],
    negativeNotes:['Confirmar tamanho e variação selecionada; ajuste e desempenho não testados.', 'Condição e procedência não verificadas na unidade; sem especificações de outro Flyer Runner.'],suppressRating:true,
  }],
  ['fQAJIJDeSjtSvdevGCQm', {
    syncInformationalSchema:true, allowTruncatedHeading:true,
    model:/^(?:Parafusadeira Furadeira De Impacto A Bateria 21V 3\/8” Bivolt 1400 Rpm Com Acessórios E Maleta TB-21PZW The Black Tools|Parafusadeira de impacto TB-21PZW The Black Tools — bateria 21 V anunciada|Parafusadeira\/furadeira TB-21PZW The Black Tools — 21 V anunciados)$/i,
    correct:'Parafusadeira/furadeira TB-21PZW The Black Tools — 21 V anunciados',
    summary:'A oferta identifica a parafusadeira/furadeira de impacto The Black Tools TB-21PZW, com bateria anunciada de 21 V, mandril de 3/8 de polegada (10 mm) e rotação de até 1.400 rpm. Pode interessar a quem compara ferramentas a bateria; a adequação ao serviço depende das capacidades e dos limites do modelo. A indicação 18 + 3 do cadastro não é uma medição de torque nem informa sozinha o torque máximo; confirme a distinção entre ajustes e modos no manual. A palavra bivolt da oferta precisa ser conferida no carregador, sem presumir alimentação direta da ferramenta pela rede. Acessórios e maleta são anunciados, mas confira a composição exata do conjunto e a quantidade de baterias. Não testamos torque, perfuração, autonomia ou resistência e não transferimos capacidades de outro modelo The Black Tools.',
    positiveNotes:['Modelo TB-21PZW, bateria de 21 V, mandril de 10 mm e rotação de até 1.400 rpm identificados na oferta.'],
    negativeNotes:['Ajustes 18 + 3 não equivalem a torque máximo medido; confirmar modos e limites no manual.', 'Confirmar carregador e itens do kit; sem autonomia ou desempenho testados.'],suppressRating:true,
  }],
  ['g3QWQpsMAD73Kg7gMUzm', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB3954862383',
    model:/^(?:Torneira Gourmet Luxo Flexível Cozinha Parede 2 Jatos Pia Metal Cor Aço Inox e Preto- Marca Camperluz|Torneira Camperluz de parede flexível com dois jatos anunciados)$/i,
    correct:'Torneira Camperluz de parede flexível com dois jatos anunciados',
    summary:'A oferta identifica uma torneira Camperluz de parede, flexível, com dois tipos de jato anunciados. Pode interessar a quem procura esse formato para a cozinha; confira medidas, conexão e espaço disponível antes de escolher. Há divergência entre a cor aço inox e preto do título e o acabamento cromado da descrição: confirme a apresentação da unidade. A indicação de cor não comprova que todo o corpo seja de aço inoxidável. As conexões de 1/2 e 3/4 de polegada, o bico giratório e o fechamento cerâmico são informações do cadastro, não verificação da equipe; confira se há adaptador e quais peças acompanham o conjunto. Não medimos economia de água, força do jato ou vedação. Não mantemos elogios de compradores sem documentação nem facilidade de instalação ou custo-benefício como conclusões próprias. Não garantimos compatibilidade com toda instalação.',
    positiveNotes:['Formato de parede, identificação Camperluz e dois tipos de jato anunciados.'],
    negativeNotes:['Acabamento divergente no cadastro; confirmar cor, material, conexão e acessórios da unidade.', 'Economia, pressão, vedação e instalação não testadas; sem recomendação baseada em elogios não documentados.'],suppressRating:true,
  }],
  ['GhxvMZYaZM60wLsGuNdw', {
    syncInformationalSchema:true,
    model:/^Esfregão Perfect Pro Mop 360° Balde Inox Cabo Longo Microfibra 16L$/i,
    summary:'A oferta identifica um mop Perfect Pro com giro de 360 graus, cabo longo, refil descrito como de microfibra e capacidade de balde anunciada de 16 litros. Pode interessar a quem procura um conjunto para limpeza; confira dimensões, itens incluídos e instruções para o piso pretendido. O cadastro não esclarece quais partes do balde são de inox, por isso não afirmamos que toda a estrutura seja desse material. A palavra inox não comprova maior resistência ou durabilidade em comparação com outro conjunto. A capacidade nominal não determina quanto de água deve ser colocado durante o uso; confirme o limite indicado pelo fabricante. Giro e comprimento do cabo não garantem alcance em qualquer espaço. Não testamos centrifugação, limpeza, esforço, resistência ou vida útil do mecanismo e não prescrevemos cuidados específicos sem o manual da unidade.',
    positiveNotes:['Identificação Perfect Pro, giro de 360 graus e capacidade nominal de 16 litros anunciados.'],
    negativeNotes:['Partes em inox, limite de enchimento e dimensões precisam ser confirmados.', 'Sem teste de limpeza, resistência ou durabilidade; giro não garante alcance universal.'],suppressRating:true,
  }],
  ['fflXJkY0fRQJg8t2QZqn', {
    syncInformationalSchema:true, allowTruncatedHeading:true,
    model:/^(?:Kit Ventilador Portatil 8'' \+ Luz Led 4'' 2 Baterias Recarregável Lanterna Refletor Lampada Luz Led|Kit ventilador portátil de 8 polegadas com luz LED e duas baterias anunciadas)$/i,
    correct:'Kit ventilador portátil de 8 polegadas com luz LED e duas baterias anunciadas',
    summary:'A oferta identifica um kit com ventilador portátil de 8 polegadas, luz LED e duas baterias recarregáveis anunciadas. Pode interessar a quem procura ventilação e iluminação transportáveis; confira quais componentes e carregadores acompanham a unidade. Os 30 dB e a autonomia de 3 a 4 horas do cadastro são declarações do anúncio, não medições da equipe nem garantia de uso sem incômodo durante o descanso. Não foram confirmadas as condições dessas estimativas. Os valores de 21 V e 2,0 Ah indicados para bateria não comprovam sozinhos a duração. A indicação 127/220 V precisa ser conferida na etiqueta do carregador e no manual, sem presumir alimentação direta do ventilador pela rede ou compatibilidade com outras baterias. Não testamos ruído, ventilação, iluminação, autonomia ou segurança. Página hospedada no Mercado Livre não significa anúncio oficial do fabricante.',
    positiveNotes:['Ventilador de 8 polegadas, luz LED e duas baterias identificados no título da oferta; confirmar conteúdo.'],
    negativeNotes:['Ruído e autonomia anunciados não foram medidos e não garantem conforto durante o descanso.', 'Confirmar carregador, valores elétricos, baterias e acessórios específicos; sem compatibilidade presumida.'],suppressRating:true,
  }],
  ['FlQInLlTCwVdemK0g3rZ', {
    syncInformationalSchema:true, expectedListing:'MLB4071998331',
    model:/^Kit 5 Potes De Vidro Marmita C\/ Tampa Hermético 640ml$/i,
    summary:'A oferta identifica um conjunto de cinco potes retangulares de vidro com capacidade anunciada de 640 ml por unidade e tampas descritas como herméticas. O anúncio menciona vidro borossilicato, mas não verificamos o material, a vedação ou a resistência da unidade. Pode interessar a quem procura recipientes para organizar alimentos; confira medidas, fechamento e condições de uso. Não tratamos a descrição de vedação como garantia de proteção completa contra ar, umidade ou vazamentos. A compatibilidade com micro-ondas e lava-louças precisa ser confirmada separadamente para os recipientes e as tampas, conforme as instruções específicas. Não presumimos uso em forno, limites de temperatura ou tolerância a choque térmico apenas pelo material anunciado. Não testamos conservação, limpeza ou resistência, e a capacidade nominal não determina o volume indicado para todo uso.',
    positiveNotes:['Conjunto de cinco recipientes retangulares, com 640 ml por unidade anunciados.'],
    negativeNotes:['Vedação, material e resistência não testados; hermético não é garantia de ausência de vazamentos.', 'Confirmar instruções de recipientes e tampas para aquecimento e lavagem; sem limites térmicos presumidos.'],suppressRating:true,
  }],
  ['fMwDJ0aYUKjwcpHFiRus', {
    syncInformationalSchema:true, expectedListing:'MLB4025013215',
    model:/^Kit 50 Cabide Adulto Preto Reforçado Organizador Combate$/i,
    summary:'A oferta identifica um kit de 50 cabides adultos pretos, descritos como reforçados. Pode interessar a quem precisa de várias unidades para organizar roupas; confira as medidas e o espaço disponível no guarda-roupa antes de escolher. A palavra reforçado no anúncio não comprova carga suportada, resistência ou maior durabilidade. O cadastro não fornece base suficiente para indicar um limite de peso ou afirmar adequação a peças pesadas. Confirme material, formato dos ganchos e dimensões da unidade. Não testamos deformação, quebra, marcas nas roupas ou durabilidade. A frase incompleta de atenção foi substituída por estas limitações explícitas, sem completar o trecho por suposição.',
    positiveNotes:['Quantidade anunciada de 50 cabides adultos pretos identificada na oferta.'],
    negativeNotes:['Carga suportada e durabilidade não comprovadas pela descrição reforçado.', 'Confirmar material, medidas e encaixe no guarda-roupa; sem teste de resistência.'],suppressRating:true,
  }],
  ['ufHw7Y6qN2oc8ePqgHkj', {
    syncInformationalSchema:true, expectedListing:'MLB4555189589',
    model:/^Creatina Monohidratada 500g Growth Supplements - Sem Sabor em Pó$/i,
    summary:'A oferta identifica creatina monohidratada Growth Supplements em pó, sem sabor, na apresentação de 500 g. A alegação de pureza do texto anterior não representa análise laboratorial ou autenticação do lote pela equipe. Confira composição, tabela nutricional, alergênicos, lote, validade e advertências no rótulo da unidade. As declarações de ausência de glúten, açúcares, carboidratos e sódio, assim como a faixa etária do cadastro, precisam corresponder à embalagem específica; não as apresentamos como verificadas nesta oferta. Não prescrevemos dose, duração de uso ou adequação individual, nem prometemos desempenho físico. Não transferimos informações de potes de 250 g, kits, refis ou versões Creapure para esta apresentação. O peso anunciado não confirma a procedência ou a qualidade da unidade do vendedor.',
    positiveNotes:['Apresentação anunciada de 500 g, em pó e sem sabor, identificada como Growth Supplements.'],
    negativeNotes:['Pureza, procedência e declarações do rótulo do lote não verificadas pela equipe.', 'Confirmar composição, alergênicos e advertências da embalagem; sem prescrição ou garantia de resultado.'],suppressRating:true,
  }],
  ['F8RXRAtxM4QOCg5hbFh9', {
    syncInformationalSchema:true, expectedListing:'MLB4651883940',
    model:/^Chaleira Eletrica Atacama Inox 1,8 Litros 220v Unitermi Cor Cinza-escuro$/i,
    summary:'A oferta identifica a chaleira elétrica Unitermi Atacama de 1,8 litro, 220 V, na cor cinza-escuro. Pode interessar a quem procura aquecer água; confira no manual o uso previsto e os limites de enchimento. A capacidade anunciada não confirma o volume útil em toda preparação nem indica que bebidas devam ser preparadas diretamente no recipiente. Os 1.200 W do cadastro são potência anunciada, não medição de rapidez ou consumo pela equipe. A descrição em inox não garante ausência de odores, resistência a qualquer condição ou durabilidade comprovada. Confira materiais e cuidados de limpeza específicos da unidade. Não testamos aquecimento, conservação, resistência ou dispositivos de proteção e não presumimos que seja bivolt.',
    positiveNotes:['Capacidade de 1,8 litro, tensão de 220 V e apresentação Atacama identificadas na oferta.'],
    negativeNotes:['Rapidez, consumo e ausência de odores não testados; potência não é resultado medido.', 'Confirmar limites de enchimento, materiais e uso previsto no manual da unidade.'],suppressRating:true,
  }],
  ['f9oPhNSAdi4gqtwPJbJh', {
    syncInformationalSchema:true, expectedListing:'MLB5411374090',
    model:/^Mixer Philco Pmx2000 3 Em 1 Inox 800w cor preto$/i,
    summary:'A oferta apresenta o mixer Philco PMX2000 3 em 1, preto, com potência anunciada de 800 W e lâminas descritas como de aço inoxidável. Pode interessar a quem compara aparelhos para preparações na cozinha, mas a indicação depende dos ingredientes e dos acessórios previstos no manual. A expressão 3 em 1 não confirma sozinha quais peças acompanham esta unidade; confira a relação de itens da oferta. Não mantemos a afirmação de que seja ideal para todos os tipos de preparações. Potência anunciada não comprova capacidade de processar qualquer alimento, resultado ou durabilidade. Confira tensão, limites de uso e cuidados de limpeza antes de escolher. Não testamos desempenho, ruído ou resistência e não transferimos acessórios ou capacidades de outro mixer Philco.',
    positiveNotes:['Modelo PMX2000, proposta 3 em 1 e potência de 800 W identificados na oferta.'],
    negativeNotes:['Não indicado nesta ficha para toda preparação; conferir ingredientes e limites no manual.', 'Acessórios da unidade, tensão e desempenho precisam ser verificados; sem teste próprio.'],suppressRating:true,
  }],
  ['FeYsjVKPd6nzosN6U8QB', {
    syncInformationalSchema:true, expectedListing:'MLB4304758643',
    model:/^Uomini Black Desodorante Colônia O Boticário - 100ml$/i,
    summary:'A oferta identifica Uomini Black desodorante colônia O Boticário em frasco de 100 ml. O anúncio descreve perfil oriental especiado e menciona almíscar, âmbar e fava-tonca; são informações da oferta, não avaliação olfativa da equipe. As expressões ideal para homens audaciosos e profunda intensidade não representam critérios medidos nem garantem preferência pessoal. Confira apresentação e versão antes de escolher, sem importar notas de outro Uomini. Não testamos aroma, projeção, fixação ou duração na pele. A condição de não recarregável e as declarações sobre testes em animais ou selo precisam corresponder à embalagem e à apresentação específicas; esta ficha não autentica a unidade ou certifica sua procedência.',
    positiveNotes:['Apresentação Uomini Black desodorante colônia de 100 ml identificada na oferta.'],
    negativeNotes:['Notas atribuídas ao anúncio; intensidade, preferência e duração não testadas pela equipe.', 'Confirmar versão, procedência e declarações específicas da embalagem.'],suppressRating:true,
  }],
  ['Evo4CPaNJPvGuj1ILt5u', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB7216247932',
    model:/^(?:POLARES Z20 Patinete Elétrico Premium 500w Pneu Aderente Velocidade Máxima 32km\/h Motorizado Até 30km De Autonomia Polares|Patinete elétrico Polares Z20 — 500 W anunciados)$/i,
    correct:'Patinete elétrico Polares Z20 — 500 W anunciados',
    summary:'A oferta identifica um patinete elétrico Polares Z20 com potência anunciada de 500 W. Pode interessar a quem compara opções de mobilidade, mas a adequação depende das condições de uso e das especificações da unidade. Velocidade de até 32 km/h e alcance de até 30 km são declarações do anúncio, não medições da equipe ou garantias para qualquer percurso. A capacidade anunciada de 10.500 mAh não comprova sozinha a autonomia. O texto da oferta descreve rodas sólidas de 8,5 polegadas e freios eletrônico e a disco; confira esses componentes no modelo e no manual. Não mantemos a afirmação de que seja seguro em qualquer terreno, nem tratamos pneu resistente a furos como garantia de aderência ou ausência de riscos. Proteção contra sobrecarga, carga máxima e acessórios precisam ser confirmados na documentação específica. Não testamos frenagem, bateria, resistência ou segurança e não presumimos adequação a toda via ou usuário.',
    positiveNotes:['Modelo Z20 e potência de 500 W identificados na oferta; especificações a conferir.'],
    negativeNotes:['Velocidade e autonomia anunciadas não são resultados de teste ou garantias para qualquer percurso.', 'Sem garantia de segurança em qualquer terreno; confirmar componentes e limites no manual.'],suppressRating:true,
  }],
  ['EbNVkHXOor6py78Wgl8X', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB5643705886',
    model:/^(?:Tripé Inteligente 1\.8m com Rastreamento Facial AI Estável 360° para Celular、Câmera、Vlog E Gopro, Basike Tripé Celular Profissional Universal Bastão Selfie Com Controle Remoto Bluetooth|Tripé Basike 1,8 m com rastreamento facial anunciado e controle Bluetooth)$/i,
    correct:'Tripé Basike 1,8 m com rastreamento facial anunciado e controle Bluetooth',
    summary:'A oferta apresenta um tripé Basike com altura anunciada de 1,8 m, rastreamento facial e controle remoto Bluetooth. Pode interessar a quem procura apoio para gravar com o celular; confira o modelo, as dimensões e a carga aceita antes de escolher. Rotação de acompanhamento não comprova estabilização de imagem: não confirmamos que seja um gimbal estabilizador. O anúncio menciona uso como bastão de selfie, mas encaixe em celular, câmera ou GoPro depende dos suportes e adaptadores incluídos. Não tratamos universal ou profissional como garantia de compatibilidade ou desempenho. Materiais, recarga do controle por USB-C e tipo de montagem precisam ser confirmados no manual da unidade; a expressão sapata de 1/4 do texto anterior não esclarece o conector. Não testamos estabilidade, rastreamento ou resistência.',
    positiveNotes:['Altura de 1,8 m, rastreamento facial e controle Bluetooth anunciados; conferir modelo e acessórios.'],
    negativeNotes:['Rastreamento não comprova estabilização de imagem ou desempenho testado.', 'Confirmar carga, encaixes, adaptadores e alimentação do controle; compatibilidade não é universal.'],suppressRating:true,
  }],
  ['eFH6DoZM48JWTDwQIImg', {
    syncInformationalSchema:true, expectedListing:'MLB5353515677',
    model:/^Kit 2 Refil Ntk Gás Butano \+ Maçarico Camping Fogareiro 227g$/i,
    summary:'O título da oferta anuncia dois refis NTK de 227 g e um maçarico. A presença da palavra fogareiro no título não confirma que um fogareiro completo acompanhe o conjunto; confira a relação de itens e as fotos da oferta antes de escolher. Os 454 g mencionados no cadastro correspondem à soma nominal de dois refis de 227 g, não à massa total comprovada do kit com maçarico e embalagens. A marca NTK indicada para os refis não confirma a marca ou o modelo do maçarico. Sem identificação e manual específicos, não afirmamos compatibilidade de conectores, composição detalhada do gás, autonomia ou adequação a um aparelho. Esta ficha não orienta adaptações, recarga ou manuseio do combustível; siga as advertências e instruções próprias dos componentes. Não testamos funcionamento ou segurança da unidade.',
    positiveNotes:['Dois refis de 227 g e maçarico identificados no título da oferta; conteúdo a confirmar.'],
    negativeNotes:['Inclusão de fogareiro completo, modelo do maçarico e compatibilidade não confirmados.', '454 g não são apresentados como peso total medido do kit; sem teste de segurança ou autonomia.'],suppressRating:true,
  }],
  ['ERUkcWCy7XxGVEyDizZ2', {
    syncInformationalSchema:true, expectedListing:'MLB5325840582',
    model:/^Controlador Gamesir Galileo G8 Plus Com Bluetooth Para Cel$/i,
    summary:'A oferta identifica um GameSir G8 Plus com Bluetooth para celular. A referência oficial do G8 Plus diferencia plataformas, modos de conexão e suporte dos jogos; conectar o controle não garante que todos os jogos reconheçam seus comandos. Antes de escolher, confira a versão Bluetooth, o aparelho, o encaixe e o jogo pretendido. Não confirmamos a compatibilidade com Alexa mencionada no cadastro anterior. No PC, o modo e o suporte do jogo precisam ser verificados, sem prometer funcionamento universal. A fabricante descreve motores de vibração, mas isso não comprova que o recurso funcione em todo jogo ou plataforma. Não transferimos características do G8 Galileo ou do G8+ MFi para esta oferta. Não testamos conexão, latência, autonomia ou funcionamento da unidade; a expressão diversão garantida não representa avaliação da equipe.',
    positiveNotes:['G8 Plus Bluetooth identificado na oferta; fabricante disponibiliza referência de modos e compatibilidade.'],
    negativeNotes:['Conexão não garante suporte de todos os jogos; conferir aparelho, encaixe e modo.', 'Compatibilidade com Alexa não confirmada; vibração e desempenho não testados na unidade.'],
    contextSourceUrl:'https://gamesir.com/pages/faq-questions-about-g8-plus',contextSourceLabel:'GameSir: referência G8 Plus, não teste ou autenticação da unidade anunciada',suppressRating:true,
  }],
  ['e2xjzhLqo2TSHdOKUEaB', {
    syncInformationalSchema:true, expectedListing:'MLB5039813441',
    model:/^Deo Colônia Natura Hoje Masculino 100ml$/i,
    summary:'A oferta identifica a deo colônia Natura Hoje masculina de 100 ml. O anúncio descreve perfil amadeirado com cardamomo e cedro; são informações da oferta, não avaliação olfativa da equipe. As expressões ideal para ocasiões diversas e sofisticação não são critérios medidos nem garantem que a fragrância agrade a todas as pessoas. Não testamos aroma, intensidade, fixação ou duração na pele. Confira a versão e a embalagem antes de escolher, sem importar notas ou características de outra fragrância Natura. Origem e declarações sobre testes em animais precisam corresponder à apresentação específica; esta ficha não autentica a unidade do vendedor.',
    positiveNotes:['Apresentação Natura Hoje masculina de 100 ml identificada na oferta.'],
    negativeNotes:['Preferência, intensidade e duração não testadas pela equipe.', 'Confirmar versão e procedência; descrição do anúncio não autentica o frasco.'],suppressRating:true,
  }],
  ['E4L1IqNlovRGggmaVOHW', {
    syncInformationalSchema:true, expectedListing:'MLB5885455180',
    model:/^Principia Kit Essencial Gl-03 \+ Ch \+ Vc \+ Ps Sensível Dia\/noite$/i,
    summary:'A oferta identifica um kit Principia Essencial com quatro itens, indicados no título como GL-03, CH, VC e PS. Confira os códigos completos, volumes e rótulos de cada embalagem: as abreviações não confirmam sozinhas a composição do conjunto. O FPS pertence ao protetor solar específico, não ao kit inteiro; confirme sua versão e as instruções de uso antes de considerar FPS 60 como característica da oferta. Não generalizamos hipoalergênico, ausência de fragrância ou de óleos para todos os itens sem verificar os rótulos. A indicação para pele sensível e a idade do cadastro não são garantia de tolerância individual. Não testamos eficácia, irritação ou resultados e não prescrevemos rotina diurna ou noturna. Confira as advertências de cada produto e procure orientação profissional quando necessário, sem importar formulações de outro kit Principia.',
    positiveNotes:['Kit de quatro itens com identificação GL-03, CH, VC e PS anunciada; conferir códigos completos.'],
    negativeNotes:['FPS e alegações de composição dependem de cada produto e versão, não do conjunto inteiro.', 'Sem garantia de tolerância individual, teste de eficácia ou prescrição de rotina.'],suppressRating:true,
  }],
  ['DuqIf8kBMwEZzRskn9LR', {
    syncInformationalSchema:true, expectedListing:'MLB6930924132',
    model:/^Poco X8 Pro Max 512gb 12gb Ram Global Bateria 8\.500mah$/i,
    summary:'A oferta identifica o POCO X8 Pro Max global com 512 GB de armazenamento e 12 GB de RAM. A referência global da Xiaomi informa bateria de capacidade típica de 8.500 mAh; esse valor não determina sozinho a duração no seu uso. Não realizamos comparativos com rivais, e as expressões performance de ponta, investimento ideal e carcaça ultrarresistente do texto anterior não são conclusões de teste da equipe. Confira a versão, a configuração e os acessórios da unidade. Brilho de pico e classificações de resistência dependem das condições declaradas pelo fabricante, não significam brilho constante ou ausência de danos em qualquer situação. Não testamos autonomia, desempenho, tela ou proteção e não transferimos características do X8 Pro para o Pro Max. Compare a proposta do aparelho com sua rotina sem tomar os números como garantia de resultado.',
    positiveNotes:['Configuração de 512 GB e 12 GB identificada na oferta; bateria típica de 8.500 mAh na referência global.'],
    negativeNotes:['Autonomia e superioridade sobre rivais não testadas pela equipe.', 'Confirmar versão, acessórios e condições das especificações; resistência não é garantia contra qualquer dano.'],
    contextSourceUrl:'https://www.mi.com/global/product/poco-x8-pro-max/',contextSourceLabel:'Xiaomi global: referência POCO X8 Pro Max, não teste ou autenticação da unidade',suppressRating:true,
  }],
  ['e2JrkBA5LBbERAqFunqx', {
    syncInformationalSchema:true, expectedListing:'MLB7658837282',
    model:/^Micro-ondas 20l Prata Porta Espelhada Mastercook Midea$/i,
    summary:'A oferta identifica um micro-ondas Midea MasterCook de 20 litros, prata, com porta espelhada. Confira o código e a tensão na etiqueta da unidade antes de comparar especificações. A capacidade anunciada não garante que qualquer recipiente caiba: confira as medidas internas e a possibilidade de girar livremente. O diâmetro do prato não confirma sozinho o diâmetro máximo de um recipiente, por isso não mantemos a afirmação genérica de que comporta peças de até 26 cm. Potência elétrica nominal e potência de micro-ondas são grandezas distintas; os 1,05 kW do cadastro não são apresentados como potência de aquecimento comprovada. Funções de limpeza e tira odor, se presentes na versão, não dispensam a limpeza indicada no manual. Não verificamos revestimento autolimpante da unidade nem testamos aquecimento, consumo ou remoção de resíduos. Não presumimos bivolt ou transferimos dados de outro MasterCook.',
    positiveNotes:['Apresentação de 20 litros, prata e porta espelhada identificada na oferta.'],
    negativeNotes:['Confirmar modelo, tensão, medidas internas e funções específicas antes da compra.', 'Capacidade, potência elétrica e prato não são garantia de encaixe ou resultado de aquecimento.'],suppressRating:true,
  }],
  ['dgcv2JkW8bL6DBSEqB9V', {
    syncInformationalSchema:true, expectedListing:'MLB2622679749',
    model:/^Strong Creatine 300g - Fisionutri(?: 100% Pure)?$/i,
    correct:'Strong Creatine 300g - Fisionutri',
    summary:'A oferta identifica Strong Creatine Fisionutri em pote de 300 g, anunciado como sem sabor. A expressão 100% Pure do título anterior não representa análise de pureza ou autenticação do lote por nossa equipe. Confira composição, alergênicos, lote, validade e advertências no rótulo da unidade. A porção de 3 g e a ausência de glúten ou lactose mencionadas no cadastro precisam ser confirmadas nessa embalagem; não são apresentadas como orientação própria de consumo. Não prescrevemos dose, duração ou resultado físico. O peso do pote não determina adequação individual, e não transferimos laudos ou formulações de outra creatina. Siga as informações específicas do fabricante e orientação profissional quando necessário.',
    positiveNotes:['Apresentação de 300 g e identificação Fisionutri informadas na oferta.'],
    negativeNotes:['Pureza, composição e alergênicos do lote não verificados pela equipe.', 'Sem prescrição de dose, duração ou garantia de resultado.'],suppressRating:true,
  }],
  ['dNFcgW7f0gXpuucpEemY', {
    syncInformationalSchema:true, expectedListing:'MLB7276126962',
    model:/^Case para HD SSD de 2\.5" USB 3\.0 Transparente da Divanstor$/i,
    summary:'A oferta apresenta um case transparente Divanstor para HD ou SSD de 2,5 polegadas, com interface interna SATA e conexão USB 3.0 anunciadas. Pode interessar a quem pretende usar uma unidade compatível como armazenamento externo; confira o conector, a espessura aceita, a alimentação e o sistema utilizado antes de escolher. A referência a SATA III não comprova transferência externa de 6 Gbps pelo USB, por isso essa velocidade não é apresentada como desempenho do conjunto. UASP e suporte a até 3 TB são declarações da oferta que precisam ser conferidas para o modelo e a unidade escolhida. Não testamos compatibilidade, velocidade ou integridade de dados e não presumimos suporte a SSD M.2 ou NVMe apenas pelo nome SSD. Confira também os itens incluídos: esta descrição não afirma que acompanhe um disco.',
    positiveNotes:['Formato de 2,5 polegadas, SATA e conexão USB 3.0 identificados na oferta.'],
    negativeNotes:['SATA III não é medição da transferência USB; desempenho real não testado.', 'Confirmar conector, espessura, capacidade suportada, UASP e acessórios da unidade.'],suppressRating:true,
  }],
  ['CvM3xyDY4t5BF7XdPjF6', {
    syncInformationalSchema:true, expectedListing:'MLB6256129898',
    model:/^(?:Canivete Militar Tático Defesa Bolso Aço Inox Caça Ec-713|Canivete dobrável EC-713 — materiais e mecanismo a confirmar)$/i,
    correct:'Canivete dobrável EC-713 — materiais e mecanismo a confirmar',
    summary:'A oferta identifica um canivete dobrável EC-713 e descreve lâmina de aço inoxidável com cabo de plástico e metal. São informações do anúncio, não verificação da liga, construção ou qualidade pela equipe. O mecanismo de abertura é anunciado como automático, mas não foi confirmado por manual ou inspeção da unidade. Confira identificação, materiais e instruções específicas do fabricante. Não testamos corte, travamento, resistência ou durabilidade. As expressões militar, tático e defesa do título anterior não representam certificação ou recomendação de uso como arma. Esta ficha não orienta técnicas de defesa, porte ou uso contra pessoas e não afirma que o produto seja permitido em qualquer local.',
    positiveNotes:['Modelo EC-713 e formato dobrável identificados na oferta.'],
    negativeNotes:['Materiais, mecanismo e travamento não verificados pela equipe.', 'Sem certificação militar ou recomendação para defesa; conferir instruções e condições aplicáveis.'],suppressRating:true,
  }],
  ['d6VCoNciFGrUwOkaNoDU', {
    syncInformationalSchema:true, expectedListing:'MLB4261795739',
    model:/^Natura Ilía Completa 50ml Feminino Parfum Spray$/i,
    summary:'A oferta identifica Natura Ilía Completa em apresentação spray de 50 ml. A descrição anuncia perfil floral e amadeirado; essa caracterização não é uma avaliação olfativa da equipe. Não testamos aroma, intensidade, fixação ou duração na pele e não tratamos sofisticada e duradouro como resultados comprovados. Confira a identificação exata da versão, a embalagem e as condições do vendedor antes de escolher, sem usar dados de outra fragrância Ilía. As declarações sobre origem, possibilidade de refil, composição vegana e testes em animais precisam corresponder à apresentação específica; não foram verificadas para a unidade anunciada nesta revisão. A ficha não autentica o frasco nem garante que o perfume agrade ou tenha o mesmo desempenho para todas as pessoas.',
    positiveNotes:['Apresentação Ilía Completa spray de 50 ml identificada na oferta.'],
    negativeNotes:['Intensidade, fixação e duração não testadas pela equipe.', 'Procedência, versão e declarações da embalagem precisam de confirmação específica.'],suppressRating:true,
  }],
  ['C8VXX9MfKS8ULwDiDWXn', {
    syncInformationalSchema:true, expectedListing:'MLB3905003519',
    model:/^Collagen Renew Sabor Laranja - Nutrify 300g$/i,
    summary:'A oferta identifica o suplemento alimentar em pó Collagen Renew Nutrify sabor laranja, em embalagem de 300 g. A descrição registrada menciona colágeno hidrolisado, Verisol, vitaminas, minerais e estévia; confira a composição no rótulo da unidade, pois uma ficha de outra edição não confirma o lote anunciado. Ausência de glúten, faixa etária, alergênicos e advertências também precisam ser conferidos na embalagem específica. Não prescrevemos dose nem deduzimos duração de uso a partir dos 300 g. A presença de um ingrediente não é uma garantia da equipe de resultado estético, absorção ou adequação individual. Não verificamos composição laboratorial, autenticidade ou efeitos do produto; siga as informações do fabricante e orientação profissional quando necessário.',
    positiveNotes:['Apresentação em pó, sabor laranja e embalagem de 300 g identificados na oferta.'],
    negativeNotes:['Composição, alergênicos, faixa etária e advertências dependem do rótulo da unidade.', 'Sem prescrição de dose, duração ou garantia de resultado estético pela equipe.'],suppressRating:true,
  }],
  ['bufeMWJJrnyiM5TBcKXW', {
    syncInformationalSchema:true, expectedListing:'MLB4116164126',
    model:/^Ventilador de Coluna Ventisol Turbo 6 Pás 30cm Preto 8234$/i,
    summary:'A oferta identifica o ventilador de coluna Ventisol Turbo 6, de 30 cm, preto, com código 8234. A descrição anuncia três velocidades e oscilação horizontal. Esses recursos permitem avaliar a proposta de circulação de ar, mas não comprovam eficiência, silêncio ou desempenho em determinado ambiente. Não medimos vazão, ruído, consumo ou durabilidade. Antes de escolher, confira a tensão da unidade, as dimensões da base, os ajustes e o manual específico. Não presumimos bivolt nem transferimos potência ou características de outro ventilador Turbo 6 de mesa ou de tamanho diferente.',
    positiveNotes:['Formato de coluna, 30 cm, três velocidades e oscilação descritos na oferta.'],
    negativeNotes:['Vazão, ruído, consumo e desempenho não medidos pela equipe.', 'Confirmar tensão, código e ajustes da unidade; não presumir bivolt.'], suppressRating:true,
  }],
  ['c1R3iVzduEndTWAhxXvO', {
    syncInformationalSchema:true, allowTruncatedHeading:true, expectedListing:'MLB4470192989',
    model:/^(?:Torneira Elétrica De Parede - Loren Easy Lorenzetti Acabamento Branco Cor Branco 220v 5\.5KW|Torneira Lorenzetti Loren Easy de parede 220 V 5.500 W branca)$/i,
    correct:'Torneira Lorenzetti Loren Easy de parede 220 V 5.500 W branca',
    summary:'A oferta identifica a torneira elétrica Lorenzetti Loren Easy de parede, branca, na versão 220 V de 5.500 W. A referência oficial apresenta essa combinação de tensão e potência; isso não confirma a compatibilidade com a instalação da sua casa. A expressão instalação prática do texto anterior não substitui a avaliação dos requisitos elétricos e hidráulicos do manual por profissional qualificado. Confirme a etiqueta da unidade e o modelo de parede, sem confundir com a versão de mesa ou presumir bivolt. Potência nominal não é um teste de eficiência ou garantia de temperatura em qualquer condição. Não medimos aquecimento, consumo ou desempenho e não fornecemos dimensionamento elétrico nesta ficha.',
    positiveNotes:['Versão de parede 220 V e 5.500 W identificada na oferta e na referência oficial.'],
    negativeNotes:['Compatibilidade elétrica e hidráulica depende de avaliação específica; não presumir bivolt.', 'Aquecimento, consumo e desempenho não testados pela equipe.'],
    contextSourceUrl:'https://www.lorenzetti.com.br/produto/loren-easy-parede',contextSourceLabel:'Lorenzetti Loren Easy parede: referência oficial, não avaliação da instalação ou da unidade',suppressRating:true,
  }],
  ['Bf3ccSwSiVkLw1Z8k2Hu', {
    syncInformationalSchema:true,
    expectedListing:'MLB4297760749',
    model:/^liquidificador turbo power mondial 550w - l-99 fb(?: — anúncio MLB4297760749)?$/i,
    summary:'A oferta identifica o liquidificador Mondial Turbo Power L-99 FB de 550 W. Os 2,2 litros anunciados são a capacidade total, não o limite de preparo: o manual específico indica nível máximo de 1.600 ml e limites próprios para misturas quentes. Confira as marcações do copo e as instruções antes de usar. O manual descreve filtro e lâmina de aço inox; isso não confirma todos os acessórios da unidade do vendedor. Não apresentamos trava de segurança ou ausência de BPA como verificadas nesta revisão. O uso com gelo tem condições no manual, não significa capacidade irrestrita para ingredientes duros. Confirme a tensão da unidade, sem presumir bivolt. Não testamos trituração, ruído, resistência ou desempenho.',
    positiveNotes:['Capacidade total anunciada de 2,2 L; manual distingue nível máximo de preparo.', 'Filtro e lâmina de aço inox descritos no manual específico.'],
    negativeNotes:['Respeitar marcações e limites específicos, inclusive para preparos quentes e gelo.', 'Tensão, acessórios e unidade precisam de confirmação; sem teste próprio.'],
    contextSourceUrl:'https://manuais.emondial.com/Manual-L-99-FB.pdf',
    contextSourceLabel:'Manual Mondial L-99 FB: referência do modelo, não confirmação da unidade anunciada',
    suppressRating:true,
  }],
  ['bjRcUhAfXiIDliNXbqwE', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB5761715520',
    model:/^NAC (?:600mg - Fórmula Exclusiva com Máxima Concentração e Pureza - N|600 mg anunciado — 60 cápsulas, rótulo a confirmar)$/i,
    correct:'NAC 600 mg anunciado — 60 cápsulas, rótulo a confirmar',
    summary:'A oferta identifica NAC da Essencial Labs em embalagem de 60 cápsulas, com menção a 600 mg. Confira no rótulo a quantidade por porção, os ingredientes e as advertências: o título não esclarece sozinho a concentração por cápsula. A recomendação anterior de duas cápsulas diárias não é mantida como orientação da equipe sem confirmação do rótulo específico. Faixa etária, composição da cápsula e ausência de glúten ou lactose também precisam de confirmação na embalagem. Não verificamos pureza, máxima concentração ou adequação individual e não prometemos efeitos terapêuticos. Quantidade de cápsulas não define duração de uso; siga as informações específicas do fabricante e orientação profissional quando necessário.',
    positiveNotes:['Embalagem anunciada com 60 cápsulas e identificação NAC.'],
    negativeNotes:['600 mg precisam de contexto por porção no rótulo; sem prescrição de dose ou duração.', 'Pureza, alergênicos e adequação individual não confirmados nesta revisão.'],
    suppressRating:true,
  }],
  ['b2ejp8pkiWYOgBAdeXto', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB6501275666',
    model:/^(?:celular\s*samsung\s*galaxy\s*s26\s*5g,\s*256gb,\s*12gb\s*ram,\s*galaxy\s*ai,\s*câmera\s*tripla\s*de\s*50\+12\+10,\s*tela\s*de\s*6\.3"\s*preto|samsung\s*galaxy\s*s26\s*5g\s*256\s*gb\/12\s*gb\s*—\s*preto)$/i,
    correct:'Samsung Galaxy S26 5G 256 GB/12 GB — preto',
    summary:'A oferta identifica o Samsung Galaxy S26 5G preto com 256 GB de armazenamento e 12 GB de RAM. A referência brasileira da Samsung descreve o S26 com tela AMOLED Dinâmico 2X de 6,3 polegadas, atualização adaptável de 1 a 120 Hz e câmeras traseiras de 50, 12 e 10 MP. São especificações da marca, não resultados de teste da equipe. Retiramos a expressão processador de última geração, que não identifica o componente e pode perder o sentido com o tempo. Antes de escolher, confira o código e a configuração da unidade, o espaço disponível e os acessórios da oferta. Não transferimos funções do S26+ ou do Ultra para este aparelho e não prometemos velocidade, autonomia ou qualidade de imagem apenas pelos números da ficha. A disponibilidade de recursos Galaxy AI precisa ser conferida para a versão e as condições de uso. Não testamos desempenho, câmera ou bateria desta unidade.',
    positiveNotes:['Configuração de 256 GB e 12 GB, na cor preta, identificada na oferta.', 'Tela e conjunto de câmeras descritos na referência oficial do S26, sem teste próprio.'],
    negativeNotes:['Números de tela, memória e câmera não são medições de desempenho ou qualidade pela equipe.', 'Confirmar código da unidade, acessórios e condições dos recursos de IA; não importar recursos do Plus ou Ultra.'],
    contextSourceUrl:'https://news.samsung.com/br/samsung-anuncia-galaxy-s26-o-galaxy-ai-phone-mais-intuitivo',
    contextSourceLabel:'Samsung Brasil: referência de lançamento do Galaxy S26, não teste ou confirmação da unidade do vendedor',
    suppressRating:true,
  }],
  ['B3HTtYZQAYonACif4tW1', {
    syncInformationalSchema:true,
    expectedListing:'MLB5157546240',
    model:/^(?:tênis\s*new\s*speed\s*esporte\s*masculino\s*100%\s*original\s*caminhada|tênis\s*masculino\s*anunciado\s*como\s*new\s*speed\s*—\s*caminhada)$/i,
    correct:'Tênis masculino anunciado como New Speed — caminhada',
    summary:'A oferta identifica um tênis masculino anunciado como New Speed para caminhada. A expressão 100% original do título anterior não representa verificação de procedência por nossa equipe. Confira a etiqueta, a numeração e a tabela de medidas da variante selecionada antes de escolher. O código presente no endereço identifica o anúncio; não é usado aqui como modelo técnico do calçado. Não confirmamos materiais, tecnologias de amortecimento ou adequação a modalidades esportivas específicas e não importamos dados de outro tênis New Speed. Caminhada é a finalidade anunciada, não garantia de conforto, ajuste ou aderência para toda pessoa. Não testamos desempenho ou durabilidade. Este cadastro mantém sua própria variante e condições da oferta, sem ser unido a outro registro da mesma marca.',
    positiveNotes:['Tênis masculino anunciado como New Speed para caminhada; conferir identificação e numeração da variante.'],
    negativeNotes:['Autenticidade, materiais, ajuste e desempenho não confirmados pela equipe.', 'Não transferir medidas ou recursos de outro tênis; variante e condições precisam corresponder à oferta.'],
    suppressRating:true,
  }],
  ['BcfEuX1oed02O8pYXKyg', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB6038239378',
    model:/lanterna.*cabe[cç]a.*12\s*modos/i,
    correct:'Lanterna de cabeça recarregável com 12 modos — especificações a confirmar',
  }],
  ['aQjR3wSqj9aObPqMJp10', {
    syncInformationalSchema:true,
    expectedListing:'MLB5242031295',
    model:/^óculos\s*inteligente\s*ai\s*bv200\s*chatgpt\s*câmera\s*8mp\s*bluetooth$/i,
    category:'informatica',
    summary:'A oferta identifica os óculos inteligentes Blackview BV200 com câmera anunciada de 8 MP e Bluetooth. São apresentados como um acessório vestível, não como uma câmera de segurança para vigilância contínua. A referência oficial da Blackview também descreve o BV200 como óculos inteligentes com câmera, chamadas e funções de IA; isso não autentica a unidade do vendedor nem é um teste da equipe. Se procura capturar momentos ou usar funções conectadas, confira antes o aplicativo exigido, a compatibilidade com seu celular e as condições de acesso aos serviços citados. A menção a ChatGPT no título não é confirmação nossa de conta, assinatura, recursos disponíveis ou funcionamento sem conexão. Não testamos qualidade das imagens, tradução, autonomia, privacidade ou estabilidade. Confira também o tipo de lente, a armação e os acessórios desta variante; não presumimos proteção UV, correção de grau ou resistência à água.',
    positiveNotes:['BV200, câmera de 8 MP e Bluetooth identificados na oferta; referência oficial apresenta a linha de óculos inteligentes.'],
    negativeNotes:['Não é tratado como equipamento de vigilância contínua; imagem, autonomia e funções de IA não testadas.', 'Aplicativo, compatibilidade, serviços e tipo de lente precisam ser conferidos para a variante anunciada.'],
    contextSourceUrl:'https://de.blackview.hk/en/products/bv200-price',
    contextSourceLabel:'Blackview BV200: referência oficial regional, não teste da integração ou autenticação da unidade',
    suppressRating:true,
  }],
  ['AUot5FOcnAXK9wLKfANM', {
    syncInformationalSchema:true,
    expectedListing:'MLB5598860072',
    model:/^vaporizador\s*portátil\s*de\s*roupas\s*e\s*tecidos\s*wap\s*wapore\s*fast\s*1250\s*com\s*vapor\s*quente$/i,
    category:'casa',
    publicCategoryLabel:'Casa',
    summary:'A oferta identifica o vaporizador portátil WAP Wapore Fast 1250 para cuidados com roupas e tecidos. A WAP o apresenta para peças levemente amassadas, com potência de 1250 W, cabo de 1,8 m e aquecimento anunciado em 25 segundos; esses números são informações do fabricante, não medições da equipe. A marca informa que ele não substitui o ferro de passar e recomenda uso vertical. A restrição geral a jeans presente no texto anterior não foi confirmada na referência consultada; isso não significa que qualquer tecido possa receber vapor. Confira a etiqueta da peça e as instruções específicas do aparelho antes de usar. A referência oficial distingue versões de 127 V e 220 V: confirme a tensão da unidade e não presuma bivolt. Não testamos remoção de vincos, aquecimento, acabamento ou desempenho e não prometemos resultado igual em tecidos diferentes. Confira também o código e os acessórios da oferta, sem transferir informações de outro Wapore.',
    positiveNotes:['Formato portátil para roupas levemente amassadas, conforme a proposta descrita pela WAP.', 'Potência, cabo e tempo de aquecimento informados pelo fabricante, sem medição própria.'],
    negativeNotes:['Não substitui ferro de passar; aplicação depende do tecido e das instruções da unidade.', 'Versões 127 V e 220 V distintas; desempenho, aquecimento e acabamento não testados pela equipe.'],
    contextSourceUrl:'https://loja.wap.ind.br/vaporizador-portatil-wap-wapore-fast-1250/p',
    contextSourceLabel:'WAP Wapore Fast 1250: referência oficial do modelo, com tensão da oferta a confirmar',
    suppressRating:true,
  }],
  ['aIFZHrVtBLCNlrEdxIud', {
    syncInformationalSchema:true,
    expectedListing:'MLB6191360194',
    model:/^patrulha\s*canina\s*-\s*playset\s*de\s*acampamento\s*com\s*bag\s*e\s*3\s*bonecos\s*lilás$/i,
    summary:'O anúncio apresenta um playset de acampamento Patrulha Canina com bag e três bonecos, identificado como Sunny na cor lilás. Pode interessar a quem procura um conjunto de personagens para brincadeiras de faz de conta; confira quais peças acompanham esta versão. A oferta informa medidas de 23,1 × 8,4 × 32,5 cm, também repetidas com arredondamento, mas esta ficha não confirma se correspondem ao conjunto ou à embalagem. Por isso, não atribuímos essas dimensões a cada boneco. A idade mínima de 3 anos é informada no anúncio e precisa ser conferida na embalagem específica, junto com as advertências e a identificação do produto. Não verificamos certificação, materiais ou segurança física da unidade e não presumimos personagens, funções ou acessórios além dos descritos. Antes de escolher, confira conteúdo, tamanho real e faixa etária da versão oferecida.',
    positiveNotes:['Bag e três bonecos anunciados em conjunto de acampamento Patrulha Canina; conferir conteúdo da versão.'],
    negativeNotes:['Dimensões anunciadas não confirmadas como sendo dos bonecos; podem se referir ao conjunto ou à embalagem.', 'Faixa etária, advertências, materiais e identificação específica precisam de confirmação na unidade.'],
    suppressRating:true,
  }],
  ['aozkBGONt1bYjzktRNP7', {
    syncInformationalSchema:true,
    expectedListing:'MLB4049279695',
    model:/^(?:tênis\s*masculino\s*feminino\s*kappa\s*park\s*2\.0\s*original|tênis\s*kappa\s*park\s*2\.0\s*unissex)$/i,
    correct:'Tênis Kappa Park 2.0 unissex',
    summary:'O anúncio identifica o tênis Kappa Park 2.0 unissex. A descrição registrada menciona cabedal em mesh, EVA e pontos de borracha no solado; esses dados são atribuídos à oferta, pois não foi confirmada nesta revisão uma ficha específica do fabricante para esta unidade. O texto anterior atribuía ao fabricante a indicação para caminhada e uso urbano, mas essa origem não foi comprovada e não é apresentada como recomendação oficial. Se busca um tênis para a rotina, confira numeração, medidas internas e materiais antes de escolher; formato e conforto dependem do ajuste individual. Não testamos amortecimento, ventilação, aderência ou durabilidade e não garantimos adequação para corrida ou outras modalidades. A palavra original do título anterior não representa autenticação por nossa equipe. Confirme procedência e a variante selecionada no anúncio, sem usar informações de outros modelos Kappa para preencher as lacunas.',
    positiveNotes:['Modelo Park 2.0 e apresentação unissex identificados na oferta.', 'Mesh, EVA e pontos de borracha descritos no cadastro; conferir materiais da unidade.'],
    negativeNotes:['Sem ficha primária específica confirmada; indicação de caminhada não tratada como recomendação oficial do fabricante.', 'Conforto, aderência, amortecimento e autenticidade não testados ou certificados pela equipe.'],
    suppressRating:true,
  }],
  ['9MH0XlaLQuIqWe1dlAHz', {
    syncInformationalSchema:true,
    expectedListing:'MLB5872060016',
    model:/^(?:creatina\s*monohidratada\s*250g\s*growth\s*supplements\s*-\s*sem\s*sabor\s*em\s*pó\s*100%|creatina\s*monohidratada\s*growth\s*supplements\s*250\s*g\s*sem\s*sabor)$/i,
    correct:'Creatina monohidratada Growth Supplements 250 g sem sabor',
    summary:'A oferta identifica creatina monohidratada Growth Supplements em pó, sem sabor, em pote de 250 g. Compare a apresentação e confira no rótulo da unidade ingredientes, alergênicos, lote, validade e advertências antes de escolher. A indicação sem sabor não confirma ausência de glúten, pureza ou adequação individual. Não verificamos a composição deste lote nem autenticamos a unidade do vendedor. A orientação anterior de ingerir junto com alimentos para facilitar a assimilação não foi confirmada nesta revisão e não é mantida como recomendação da equipe. O peso do pote não define dose ou duração do uso. Esta ficha não prescreve consumo e não promete corrigir uma dieta insuficiente ou produzir resultado físico específico; siga as informações da embalagem e procure orientação profissional quando necessário.',
    positiveNotes:['Apresentação em pó sem sabor de 250 g e marca Growth Supplements identificadas na oferta.'],
    negativeNotes:['Composição, pureza, alergênicos e autenticidade da unidade não confirmados nesta revisão.', 'Sem prescrição de dose, forma de consumo, duração do pote ou promessa de resultado.'],
    contextSourceUrl:'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares/perguntas-frequentes',
    contextSourceLabel:'Anvisa: orientação geral de rotulagem de suplementos, não aprovação desta unidade ou lote',
    suppressRating:true,
  }],
  ['9mrh9VQEs49ewAlruh38', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB3909103951',
    model:/^(?:colágeno\s*tipo\s*2\s*com\s*45mg\s*-\s*fórmula\s*exclusiva\s*para\s*a\s*articulação\s*com\s*máxima\s*concentração\s*e\s*biodisponibilidade\s*-\s*60\s*cápsulas|colágeno\s*tipo\s*2\s*essencial\s*labs\s*—\s*45\s*mg\s*anunciados,\s*60\s*cápsulas)$/i,
    correct:'Colágeno tipo 2 Essencial Labs — 45 mg anunciados, 60 cápsulas',
    summary:'A oferta identifica um suplemento de colágeno tipo 2 Essencial Labs com 60 cápsulas e menção a 45 mg no título. Antes de comparar fórmulas, confira no rótulo a composição e a quantidade declarada por porção; o título sozinho não esclarece a que os 45 mg correspondem. Não confirmamos nesta revisão o tipo de matéria-prima, a quantidade de colágeno não desnaturado, a presença de outros ingredientes ou de alergênicos. Sessenta cápsulas indicam a quantidade da embalagem, não garantem 60 doses ou 60 dias de uso. Retiramos a recomendação anterior de uma cápsula com as refeições e a faixa etária como orientação própria, pois não foi confirmado o rótulo específico. Máxima concentração, biodisponibilidade e benefícios para articulações não são resultados medidos pela equipe. Esta ficha não recomenda tratamento ou dose; confira advertências e orientação profissional para adequação individual.',
    positiveNotes:['Embalagem de 60 cápsulas e identificação Essencial Labs descritas na oferta.'],
    negativeNotes:['45 mg anunciados precisam de confirmação no rótulo; composição e matéria-prima não verificadas.', 'Não há garantia de 60 doses, duração, benefício para articulações ou adequação individual.'],
    contextSourceUrl:'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares/perguntas-frequentes',
    contextSourceLabel:'Anvisa: orientação geral para ler rótulos de suplementos, não validação deste produto ou promessa terapêutica',
    suppressRating:true,
  }],
  ['AF2AykzSppuQzGXdmvlT', {
    syncInformationalSchema:true,
    expectedListing:'MLB4371605519',
    model:/^kit\s*10\s*pote\s*de\s*vidro\s*marmita\s*hermético\s*370ml\s*freezer\s*fitness\s*rishon$/i,
    summary:'O anúncio apresenta um kit Rishon com 10 potes de vidro de 370 ml cada, descritos como herméticos. Pode interessar a quem quer separar pequenas porções ou organizar alimentos; confira se a capacidade de cada pote atende ao seu uso. A descrição menciona vidro borossilicato, vedação em silicone e uso em micro-ondas, freezer e lava-louças, mas não dispomos nesta ficha de manual específico que confirme as condições e os limites dessas utilizações. Confira separadamente as instruções do recipiente e da tampa, inclusive para aquecimento, congelamento e lavagem. Não presumimos resistência a choque térmico ou passagem direta do freezer ao aquecimento. Não testamos vedação, vazamento, retenção de odores ou durabilidade. A descrição hermético não é garantia da equipe de conservação prolongada ou segurança de qualquer alimento; siga as condições adequadas de armazenamento para cada preparo. Quantidade, capacidade, material e acessórios precisam corresponder ao kit do vendedor.',
    positiveNotes:['Kit de 10 recipientes de 370 ml cada identificado na oferta, para avaliar organização de pequenas porções.'],
    negativeNotes:['Condições de uso no micro-ondas, freezer e lava-louças dependem de instruções específicas do pote e da tampa.', 'Choque térmico, vedação, odores e conservação prolongada não testados pela equipe.'],
    suppressRating:true,
  }],
  ['8RopqzkV8UyasWEZxMB8', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB3998743869',
    model:/^(?:perfume\s*lattafa\s*asad\s*100ml\s*eau\s*de\s*parfum\s*original\s*árabe\s*original\s*com\s*nota\s*fiscal\s*e\s*selo\s*original\s*lataffa|perfume\s*lattafa\s*asad\s*eau\s*de\s*parfum\s*100\s*ml)$/i,
    correct:'Perfume Lattafa Asad Eau de Parfum 100 ml',
    summary:'O anúncio identifica o perfume Lattafa Asad Eau de Parfum de 100 ml. A marca descreve Asad como uma fragrância ambarada; isso é uma descrição do fabricante, não uma avaliação olfativa da equipe. Para escolher, confira se deseja o Asad desta oferta, sem confundi-lo com Asad Zanzibar ou outras versões da linha. Volume e concentração identificam a apresentação, mas não garantem rendimento, intensidade ou duração na sua pele. Não testamos aroma, fixação ou projeção e não prometemos resultado igual entre pessoas. As expressões original, selo e nota fiscal do título anterior não representam autenticação da unidade por nós. Confira procedência, embalagem e condições do vendedor antes de decidir; a referência da marca não comprova o conteúdo do frasco anunciado.',
    positiveNotes:['Apresentação Asad Eau de Parfum de 100 ml identificada na oferta.', 'Referência oficial descreve a linha Asad; não é teste ou autenticação da unidade.'],
    negativeNotes:['Aroma, rendimento, fixação e projeção não testados pela equipe.', 'Selo e nota fiscal anunciados não substituem confirmação de procedência; não confundir com outras versões Asad.'],
    contextSourceUrl:'https://lattafa.com/product/asad/',
    contextSourceLabel:'Lattafa Asad: referência oficial da linha, não autenticação do frasco do vendedor',
    suppressRating:true,
  }],
  ['96Pf23TdUYjzKH9stEXS', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB6433211634',
    model:/^(?:mini\s*aspirador\s*de\s*pó\s*portátil\s*recarregável\s*chrome\s*technology\s*soprador\s*usb\s*automotivo\s*3em1\s*sem\s*fio\s*premium\s*vácuo\s*limpeza\s*carro\s*multifuncional\s*casa|mini\s*aspirador\s*chrome\s*technology\s*usb\s*com\s*soprador\s*—\s*3\s*em\s*1\s*anunciado)$/i,
    correct:'Mini aspirador Chrome Technology USB com soprador — 3 em 1 anunciado',
    summary:'A oferta apresenta um mini aspirador Chrome Technology sem fio, recarregável por USB e com função soprador. Pode interessar a quem busca um aparelho compacto para pequenas limpezas, mas não fizemos teste de sucção ou remoção de sujeira. A descrição informa 50 W e filtro reutilizável; são dados anunciados, não medições da equipe. Potência elétrica informada não é um resultado de teste de sucção. O título usa 3 em 1, porém esta ficha só identifica as funções de aspirar e soprar; confirme a terceira função e os acessórios da unidade. Antes de usar em eletrônicos, estofados ou no carro, confira no manual quais superfícies e tipos de sujeira são permitidos. Não presumimos uso com líquidos, filtro lavável, autonomia, capacidade do reservatório ou carregador incluído. Sem código técnico ou manual específico confirmado, esses pontos permanecem pendentes; não transferimos dados de outro mini aspirador parecido.',
    positiveNotes:['Formato compacto sem fio, recarga USB e função soprador descritos na oferta.'],
    negativeNotes:['50 W e filtro reutilizável anunciados, sem teste de sucção; reutilizável não comprova que o filtro seja lavável.', 'Terceira função, autonomia, reservatório, superfícies permitidas e acessórios precisam de confirmação específica.'],
    suppressRating:true,
  }],
  ['7EgFgcD6NyeoMB8KW4Pp', {
    syncInformationalSchema:true,
    expectedListing:'MLB6880438906',
    model:/^perfume\s*carolina\s*herrera\s*212\s*vip\s*black/i,
    correct:'Perfume Carolina Herrera 212 VIP Black Eau de Parfum — volume a confirmar',
    summary:'O cadastro identifica o perfume Carolina Herrera 212 VIP Black Eau de Parfum como 200 ml, mas o endereço do anúncio vinculado inclui 100 ml no nome. Isso exige conferir o volume da opção selecionada: o endereço, sozinho, não comprova qual frasco será entregue. Não escolhemos um dos volumes como confirmado nem trocamos o produto ou o link. A página da marca apresenta mais de um tamanho para a linha; ela não autentica a unidade nem resolve a opção do vendedor. Antes de decidir, confira volume, concentração, identificação e procedência na oferta e na embalagem. Descrições como sensual, sofisticado ou ideal para festas são avaliações comerciais, não conclusões de teste da equipe. Não testamos aroma, fixação, projeção ou tolerância e não garantimos preferência pessoal. As notas e a possibilidade de recarga precisam ser conferidas na apresentação específica.',
    positiveNotes:['Identificação 212 VIP Black Eau de Parfum registrada na oferta; confirmar apresentação e unidade.'],
    negativeNotes:['Cadastro indica 200 ml, mas o endereço menciona 100 ml: volume permanece pendente de confirmação.', 'Autenticidade, aroma, fixação e projeção não testados pela equipe; sem garantia de preferência individual.'],
    contextSourceUrl:'https://www.carolinaherrera.com/br/pt/p-fragrance/212-vip-black?sku=000000000065224438',
    contextSourceLabel:'Carolina Herrera: referência da linha, sem confirmar o volume ou a unidade do vendedor',
    suppressRating:true,
  }],
  ['87Q6AMHZ8ZFd06OzATcs', {
    syncInformationalSchema:true,
    expectedListing:'MLB4147979056',
    model:/^patinete\s*dobrável\s*infantil\s*juvenil\s*2\s*rodas\s*2fly\s*replay\s*kids/i,
    category:'brinquedos',
    summary:'A oferta identifica um patinete 2Fly Replay Kids de duas rodas, dobrável, com guidão ajustável e base anunciada como antiderrapante. Pode interessar a quem procura esse formato de brinquedo, mas a expressão infantil juvenil não define sozinha idade, altura ou capacidade de carga adequadas. A categoria anterior de patinetes elétricos não está sustentada pelos dados disponíveis; a apresentação pública foi movida para brinquedos, sem afirmar presença ou ausência de motor na unidade. O registro Inmetro consultado inclui uma referência 2Fly em brinquedos para atividades físicas, mas não comprova correspondência, certificação ou segurança deste exemplar do vendedor. Confira código, faixa etária, carga máxima, dimensões, montagem e orientações de uso e supervisão na embalagem e no manual específicos. Não transferimos limites de outro patinete 2Fly. Base antiderrapante não é garantia de evitar quedas; não testamos estabilidade, freio, rodas ou resistência.',
    positiveNotes:['Duas rodas, formato dobrável e guidão ajustável anunciados; conferir versão e manual da unidade.'],
    negativeNotes:['Faixa etária, capacidade de carga e correspondência da unidade com a referência documental não confirmadas.', 'Sem teste de estabilidade, frenagem ou segurança; base anunciada como antiderrapante não garante ausência de quedas.'],
    contextSourceUrl:'https://registro.inmetro.gov.br/consulta/detalhe.aspx?NumeroRegistro=006039%2F2023&pag=1',
    contextSourceLabel:'Inmetro: registro de referência que inclui 2Fly, não verificação desta unidade',
    suppressRating:true,
  }],
  ['6Yj2zf1J51bnYAvt9ykY', {
    syncInformationalSchema:true,
    expectedListing:'MLB5155902053',
    model:/^sensor\s*infravermelho\s*automático\s*lixeira\s*retangular\s*16l\s*usb\s*branco/i,
    summary:'A oferta apresenta uma lixeira branca retangular com capacidade anunciada de 16 litros e abertura automática por sensor infravermelho. Pode interessar a quem procura abertura sem acionar a tampa com a mão, mas confira o funcionamento e as instruções do modelo vendido. A descrição anterior citava 23 cm de diâmetro apesar de identificar formato retangular; essa informação não permite confirmar largura, profundidade ou altura e não foi convertida em outra medida por suposição. Peça as três dimensões e o espaço necessário para a tampa abrir antes de escolher o local. O termo USB do anúncio não esclarece sozinho alimentação, carregamento, bateria incluída ou autonomia. Confirme também quantidade de unidades, acessórios e orientações de limpeza. Não testamos alcance ou precisão do sensor, vedação, resistência à água, autonomia ou durabilidade da tampa.',
    positiveNotes:['Formato retangular, capacidade de 16 litros e abertura por sensor infravermelho anunciados.'],
    negativeNotes:['Dimensões externas não confirmadas: o dado de diâmetro da descrição anterior é ambíguo para o formato informado.', 'Alimentação, bateria, acessórios e funcionamento do sensor precisam de confirmação; sem teste próprio.'],
    suppressRating:true,
  }],
  ['6owUOP0UqtNt3y5pFzgW', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB4008202207',
    model:/^cortina\s*(?:3,00x2,80|casa\s*laura\s*enxovais\s*blackout\s*gelo)/i,
    correct:'Cortina Casa Laura Enxovais blackout gelo — 3,00 × 2,80 m',
  }],
  ['6rPnzKJkUk5676DoZ9ng', {
    syncInformationalSchema:true,
    expectedListing:'MLB4162108123',
    model:/^câmera\s*de\s*segurança\s*ip\s*wi-fi\s*lâmpada\s*e27\s*hw/i,
    summary:'A oferta apresenta uma câmera-lâmpada HW com encaixe E27, Wi-Fi, Full HD, visão noturna e áudio anunciados. Pode interessar a quem procura esse formato, mas o encaixe E27 não confirma, sozinho, compatibilidade elétrica, espaço disponível ou facilidade de instalação em qualquer local. O termo 360° do título não comprova visão simultânea de todo o ambiente nem ausência de pontos cegos; confirme o movimento e o campo de visão do modelo exato. Não temos manual específico suficiente nesta ficha para validar resolução, gravação noturna, funções de áudio ou funcionamento sem conexão. Confira aplicativo, frequência de Wi-Fi, armazenamento, itens incluídos e condições de eventuais serviços em nuvem na oferta. Não presumimos cartão incluído ou gravação gratuita permanente. Não testamos imagem, estabilidade, instalação, segurança do aplicativo ou continuidade da gravação. Esta descrição não fornece instruções de ligação e não garante prevenção de incidentes.',
    positiveNotes:['Formato E27 e recursos Wi-Fi, Full HD, visão noturna e áudio anunciados; conferir a unidade e o manual.'],
    negativeNotes:['360° anunciado não é comprovação de cobertura simultânea sem pontos cegos.', 'Compatibilidade, armazenamento, aplicativo e gravação não testados; serviços e acessórios precisam de confirmação.'],
    suppressRating:true,
  }],
  ['6kC1jJj7i4kRtYyp3SZr', {
    syncInformationalSchema:true,
    expectedListing:'MLB7389762032',
    model:/^patinete\s*elétrico(?:$|\s*ydtech\s*m187\s*dobrável\s*com\s*bluetooth$|\s*scooter\s*dobrável\s*bluetooth\s*ydtech$)/i,
    incorrect:'Patinete Elétrico',
    correct:'Patinete Elétrico Ydtech M187 Dobrável com Bluetooth',
    fileReplacements:[
      ['Patinete Elétrico Ydtech M187 Dobrável com Bluetooth Ydtech M187 Dobrável com Bluetooth','Patinete Elétrico Ydtech M187 Dobrável com Bluetooth'],
      ['<span>Categoria</span>Patinete Elétrico Ydtech M187 Dobrável com Bluetooth','<span>Categoria</span>Patinete Elétrico'],
      ['"position":2,"name":"Patinete Elétrico Ydtech M187 Dobrável com Bluetooth","item"','"position":2,"name":"Patinete Elétrico","item"'],
      ['"category":"Patinete Elétrico Ydtech M187 Dobrável com Bluetooth","url"','"category":"Patinete Elétrico","url"'],
    ],
    summary:'O cadastro identifica o patinete Ydtech M187; o anúncio vinculado apresenta um patinete Ydtech dobrável com Bluetooth. Confirme o código exato da unidade e o manual antes de escolher. Esse formato pode interessar a quem precisa guardar o aparelho em pouco espaço, mas não comprova facilidade de transporte para toda pessoa ou trajeto. Peso, freios E-ABS e características dos pneus mencionados anteriormente não foram confirmados nesta revisão para a unidade vinculada. Não prometemos estabilidade, ausência de furos ou desempenho superior ou inferior a modelos de outra potência sem teste comparativo. Confira carga suportada, autonomia nas condições de uso, freios, pneus, carregador e suporte oferecido pelo vendedor. Não testamos condução, frenagem, bateria ou durabilidade. Esta ficha não confirma autorização de uso em ciclovias ou orlas nem aceitação em ônibus ou metrô; confira as condições aplicáveis ao trajeto e ao transporte.',
    positiveNotes:['Formato dobrável e Bluetooth anunciados; confirme código e funções da unidade com o vendedor.'],
    negativeNotes:['Sem manual exato confirmado nesta revisão; peso, freios, pneus e desempenho precisam de comprovação específica.', 'Sem teste de estabilidade, autonomia ou frenagem e sem promessa de aceitação em transporte público.'],
    suppressRating:true,
  }],
  ['6NYYO2l4QTGUagl47PKh', {
    syncInformationalSchema:true,
    model:/^prancha\s*lizze\s*profissional\s*480\s*extreme/i,
    summary:'A oferta identifica a prancha Lizze Extreme. A página oficial descreve placas de titânio e temperatura máxima anunciada de 250 °C (480 °F); o número 480 do nome comercial não significa 480 °C. Temperatura máxima é uma especificação da marca, não recomendação de ajuste para qualquer cabelo. A descrição anterior de atendimento a todos os tipos de cabelo não foi comprovada nesta revisão e não é tratada como garantia de adequação individual. O efeito antiestático é uma alegação comercial, não resultado medido pela equipe. A referência oficial apresenta opções de tensão; confirme na oferta e na etiqueta a versão correta, sem presumir bivolt. Consulte instruções específicas e orientação profissional para uso e adequação aos fios. Não testamos temperatura real, uniformidade de aquecimento, frizz, durabilidade ou dano aos cabelos, nem autenticamos a unidade do vendedor.',
    positiveNotes:['Placas de titânio e temperatura máxima descritas pela referência oficial da Lizze Extreme; não são medições da equipe.'],
    negativeNotes:['480 corresponde a °F na referência da marca, não a °C ou a ajuste recomendado para qualquer cabelo.', 'Confirmar tensão e versão; efeito antiestático e adequação individual não testados pela equipe.'],
    contextSourceUrl:'https://lizze.com.br/produto/prancha-lizze-extreme',
    contextSourceLabel:'Lizze Extreme: referência oficial, sem autenticar a unidade ou recomendar temperatura de uso',
    suppressRating:true,
  }],
  ['5LA4CuIHLWigh48x3qaW', {
    syncInformationalSchema:true,
    model:/^chuveiro\s*elétrico\s*de\s*parede\s*lorenzetti\s*futura\s*multitemperaturas\s*branco\s*6800w/i,
    summary:'O cadastro anuncia a ducha Lorenzetti Futura Multitemperaturas branca de 6800 W. A página oficial descreve quatro opções de temperatura e instalação sem braço de extensão do chuveiro; isso não significa instalação sem requisitos hidráulicos ou elétricos. A referência da Lorenzetti associa 6800 W a 220 V: confirme a tensão na etiqueta e na variante vendida, sem tratar este aparelho como bivolt. A compatibilidade com aquecimento solar, boiler ou gás mencionada na oferta não foi confirmada para qualquer instalação. Consulte o manual específico e um profissional qualificado para verificar a adequação ao local, inclusive às condições da água e da alimentação elétrica. Esta ficha não dimensiona circuito, condutores ou proteção e não fornece instruções de ligação. Não testamos vazão, aquecimento, consumo ou durabilidade.',
    positiveNotes:['Linha Futura Multitemperaturas e quatro opções de temperatura descritas pela Lorenzetti.', 'Formato de parede sem braço de extensão descrito pelo fabricante; conferir requisitos da instalação.'],
    negativeNotes:['A referência oficial associa 6800 W a 220 V; confirmar etiqueta e variante, sem presumir bivolt.', 'Adequação hidráulica/elétrica e uso com aquecimento externo precisam de verificação específica; sem teste próprio.'],
    contextSourceUrl:'https://www.lorenzetti.com.br/en/product/multitemperature-futura',
    contextSourceLabel:'Lorenzetti Futura Multitemperaturas: referência oficial, sem validar a instalação ou unidade',
    suppressRating:true,
  }],
  ['5Nr0nOkBvYhG9KXxeyZL', {
    syncInformationalSchema:true,
    model:/^kit\s*wella\s*brilliance\s*sh\s*250ml\s*\+\s*cond\s*200ml\s*\+\s*másc\s*150ml/i,
    summary:'A oferta apresenta um kit Wella Brilliance com shampoo de 250 ml, condicionador de 200 ml e máscara de 150 ml, voltado a cabelos coloridos. Pode interessar a quem procura esses três tipos de produto, mas confirme a versão de cada frasco e sua adequação ao seu cabelo. As afirmações de combater desbotamento, selar cutículas e repor nutrientes vieram da descrição comercial e não foram verificadas pela equipe para este kit. Não apresentamos resultado, duração da cor ou recuperação dos fios como garantidos. Confira composição, advertências, instruções de uso, validade e identificação dos três itens na embalagem. Não testamos textura, perfume, desempenho ou tolerância individual e não autenticamos as unidades do vendedor. Não transferimos composição ou benefícios de outra versão da linha Brilliance.',
    positiveNotes:['Três itens anunciados: shampoo 250 ml, condicionador 200 ml e máscara 150 ml.'],
    negativeNotes:['Versão e composição de cada unidade precisam de confirmação; não foram autenticadas pela equipe.', 'Proteção da cor, selagem e reposição de nutrientes não verificadas neste kit; sem garantia de resultado individual.'],
    suppressRating:true,
  }],
  ['6C1vEnfqaRRxkR4DIGa6', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB4646190273',
    model:/^(?:extensao\s*eletrica\s*30\s*metros|extensão\s*elétrica\s*de\s*30\s*m,)/i,
    correct:'Extensão elétrica de 30 m, três tomadas — capacidade a confirmar',
    summary:'O anúncio apresenta uma extensão elétrica de 30 metros com três tomadas. Antes de escolher para um equipamento, é necessário confirmar a identificação e a capacidade do conjunto. O título reúne 10 A e 20 A, enquanto a descrição cita cabo PP 2x1 mm e limites de potência; esses dados não foram verificados e não permitem a esta ficha assegurar a carga admissível ou o aterramento. O encaixe de um plugue e o termo bivolt não confirmam, sozinhos, adequação elétrica, capacidade ou segurança de uso. Peça ao vendedor marca, modelo, marcações do conjunto e documentação de conformidade aplicável; um profissional qualificado deve avaliar a adequação ao equipamento e ao local. Não use os números desta descrição comercial como dimensionamento ou autorização para ligar ferramentas, chuveiros ou outras cargas. Não testamos aquecimento, queda de tensão, isolamento ou durabilidade e não certificamos uso profissional, em obra ou ao ar livre.',
    positiveNotes:['Comprimento de 30 metros e três tomadas anunciados; identificação e capacidade do conjunto ainda precisam ser conferidas.'],
    negativeNotes:['Corrente, cabo, limites de carga e aterramento não confirmados; não recomendamos carga com base nesta ficha.', 'Sem ensaio de segurança ou certificação verificada da unidade; encaixe não comprova adequação ao equipamento.'],
    contextSourceUrl:'https://www.gov.br/inmetro/pt-br/centrais-de-conteudo/noticias/2026/dia-do-consumidor-15-orientacoes-do-inmetro-para-evitar-prejuizos-e-riscos-nas-compras',
    contextSourceLabel:'Inmetro: orientação geral de segurança nas compras, não certificação desta extensão',
    suppressRating:true,
  }],
  ['5eAXaJha93EuQsvd2SJn', {
    syncInformationalSchema:true,
    expectedListing:'MLB5864818802',
    model:/^ômega\s*3\s*epa\s*dha\s*120\s*cápsulas\s*dark\s*lab/i,
    summary:'A oferta identifica um suplemento Dark Lab de ômega 3 com EPA e DHA em embalagem de 120 cápsulas. Antes de escolher, confira no rótulo a quantidade de EPA e DHA por porção, a lista de ingredientes, alergênicos, restrições e validade. O número de cápsulas não informa sozinho a concentração ou a duração do frasco. A qualificação alta qualidade e os benefícios cardiovascular, cerebral e imunológico citados anteriormente não foram comprovados nesta revisão e não são garantidos pela equipe. Não confirmamos a declaração de ausência de glúten nem prescrevemos idade, dose ou horário de consumo com base no anúncio. A orientação geral da Anvisa sobre suplementos não é aprovação deste produto; não verificamos regularização, autenticidade ou eficácia da unidade, nem concluímos que seja irregular. Para decidir sobre consumo, procure orientação profissional e siga o rótulo específico.',
    positiveNotes:['Embalagem de 120 cápsulas e identificação EPA/DHA anunciadas; concentração por porção deve ser conferida no rótulo.'],
    negativeNotes:['Benefícios e qualidade não comprovados nesta revisão; sem teste próprio ou prescrição de consumo.', 'Concentração, alergênicos, restrições e autenticidade da unidade não confirmados.'],
    contextSourceUrl:'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares/perguntas-frequentes',
    contextSourceLabel:'Anvisa: orientação geral sobre suplementos, não aprovação do produto Dark Lab',
    suppressRating:true,
  }],
  ['5FMVdsnRQIuJYsUfNJU9', {
    syncInformationalSchema:true,
    expectedListing:'MLB5049422013',
    model:/^(?:tenis\s*caminhada\s*academia\s*skate\s*suede\s*couro\s*xl|tênis\s*pm\s*anunciado\s*como\s*suede\s*couro\s*xl)/i,
    correct:'Tênis PM anunciado como Suede Couro XL',
    summary:'O cadastro identifica a marca como PM e apresenta este tênis com o nome comercial Suede Couro XL. Não interpretamos PM como outra marca nem confirmamos material ou autenticidade apenas pelo nome ou pela foto. Os termos caminhada, academia e skate do anúncio não comprovam desempenho ou adequação para essas atividades. Confira o código do modelo, composição, tabela de medidas e variante escolhida com o vendedor. Não testamos ajuste, conforto, aderência ou durabilidade. A expressão envio já foi retirada do título informativo: disponibilidade e prazo dependem das condições atuais da oferta e do endereço de entrega.',
    positiveNotes:['Nome comercial e marca PM registrados no anúncio; confira a identificação da unidade.'],
    negativeNotes:['Material e adequação para caminhada, academia ou skate não confirmados nesta ficha.', 'Sem teste de conforto ou aderência; disponibilidade e entrega não são promessas do site.'],
    suppressRating:true,
  }],
  ['5G8Rs89UnBehBYVatnan', {
    syncInformationalSchema:true,
    expectedListing:'MLB3240424598',
    model:/^(?:kit\s*9\s*pares\s*meias\s*puma|kit\s*de\s*nove\s*pares\s*de\s*meias\s*anunciado\s*como\s*puma)/i,
    correct:'Kit de nove pares de meias anunciado como Puma, modelo invisível',
    summary:'A oferta anuncia nove pares de meias como Puma, em formato invisível, com algodão e poliamida e costura fina na descrição. Pode interessar a quem procura esse formato para usar com calçados, mas confirme composição, altura e quantidade de pares e não apenas o total de peças. A faixa de tamanhos de 34 a 46 indicada no anúncio não significa que uma única variante sirva em toda essa faixa; confira a numeração selecionada e a tabela do vendedor. A palavra original do título comercial não foi verificada pela equipe: não autenticamos o kit nem concluímos que seja falsificado. Não testamos ajuste, resistência, conforto ou comportamento após lavagem. Confira identificação, procedência e instruções de conservação da embalagem antes de decidir.',
    positiveNotes:['Kit com nove pares e formato invisível anunciados pelo vendedor.'],
    negativeNotes:['Autenticidade e composição da unidade não verificadas pela equipe.', 'Conferir variante e tabela de tamanhos; faixa anunciada não garante ajuste universal.'],
    suppressRating:true,
  }],
  ['4eal5Q0HLTcrspjkUwee', {
    syncInformationalSchema:true,
    expectedListing:'MLB5096586835',
    model:/^redmi\s*buds\s*6\s*play\s*fone\s*de\s*ouvido/i,
    summary:'O Redmi Buds 6 Play é um fone TWS (True Wireless) intra-auricular; este cadastro corresponde à cor azul. Para quem busca ouvir música e atender chamadas, a distinção importante é a autonomia: a Xiaomi anuncia até 7,5 horas por carga nos fones e até 36 horas somando recargas do estojo, não 1,5 dia de reprodução contínua nos fones. Os testes declarados pela marca usam volume de 50% e codec SBC; o resultado real pode variar. O comando de voz aciona o assistente do celular, não um assistente Xiaomi independente integrado ao fone. A redução de ruído é para chamadas, não ANC para ouvir música. A proteção IPX4 se aplica aos fones, não ao estojo, e não é indicação para banho ou imersão. A tabela documentada já existente foi preservada; não testamos autonomia, áudio, encaixe ou a autenticidade da unidade do vendedor.',
    positiveNotes:['Formato intra-auricular, Bluetooth 5.4 e controles pelo aplicativo documentados pela Xiaomi.'],
    negativeNotes:['36 horas anunciadas incluem recargas do estojo; não são autonomia contínua dos fones.', 'Sem ANC para ouvir música; assistente depende do celular e IPX4 não abrange o estojo.'],
    contextSourceUrl:'https://www.mi.com/global/product/redmi-buds-6-play/',
    contextSourceLabel:'Xiaomi Redmi Buds 6 Play: referência oficial, não teste próprio ou autenticação da oferta',
    suppressRating:true,
  }],
  ['88kDU9mSlJdWzZPx4bim', {
    syncInformationalSchema:true,
    expectedListing:'MLB2766771378',
    model:/^(?:creatina\s*1kg\s*suplemento\s*monohidratada\s*em\s*pó\s*100%\s*pura\s*-\s*soldiers\s*nutrition|creatina\s*monohidratada\s*soldiers\s*nutrition\s*em\s*pó\s*1\s*kg)$/i,
    correct:'Creatina monohidratada Soldiers Nutrition em pó 1 kg',
    summary:'A oferta identifica creatina monohidratada Soldiers Nutrition em pó, em embalagem de 1 kg. Confira no rótulo da unidade a lista de ingredientes, quantidade, lote, validade e advertências. A expressão 100% pura e as alegações de dissolução e desempenho do anúncio não são resultados de análise laboratorial ou teste da equipe. Não verificamos a composição ou a pureza deste lote e não transferimos laudos de outra embalagem para este produto. A quantidade de 1 kg não define dose, duração do pacote ou adequação individual. Para decidir, compare a apresentação e as informações do rótulo, sem tomar o título comercial como orientação de consumo. Esta ficha não recomenda dose nem promete ganhos de força, resistência ou tratamento de doenças; siga as advertências específicas e procure orientação profissional quando necessário.',
    positiveNotes:['Apresentação em pó de 1 kg e identificação Soldiers Nutrition informadas na oferta.'],
    negativeNotes:['Pureza, composição do lote, dissolução e resultados não testados pela equipe.', 'Dose, duração e adequação individual não podem ser deduzidas do tamanho da embalagem.'],
    contextSourceUrl:'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares/perguntas-frequentes',
    contextSourceLabel:'Anvisa: orientação geral sobre suplementos e rotulagem, não aprovação deste produto ou lote',
    suppressRating:true,
  }],
  ['8oHSkf32jY7LKS2WSv36', {
    syncInformationalSchema:true,
    expectedListing:'MLB4188994271',
    model:/^(?:câmera\s*segurança\s*ip\s*externa\s*wifi\s*a28\s*app\s*icsee\s*à\s*prova\s*dágua|câmera\s*a28\s*wi-fi\s*com\s*app\s*icsee\s*—\s*recursos\s*a\s*confirmar)$/i,
    correct:'Câmera A28 Wi-Fi com app iCSee — recursos a confirmar',
    summary:'O título da oferta identifica uma câmera A28 Wi-Fi com aplicativo iCSee para uso externo anunciado. A descrição anterior mencionava A28B, mas não há nesta ficha um manual ou identificação que comprove equivalência entre A28 e A28B. Por isso, dupla lente, resolução de 6 MP, rotação, rastreamento, áudio, visão noturna colorida, acesso para 64 usuários e compatibilidade ONVIF/NVR permanecem sem confirmação para esta unidade. Se algum desses recursos for decisivo, peça ao vendedor o código completo e o manual antes de escolher. A expressão à prova de água do anúncio não substitui a confirmação do grau de proteção e das condições de instalação. Confira também alimentação, aplicativo, armazenamento, serviços e acessórios incluídos; não presumimos gravação gratuita, privacidade garantida ou cobertura sem pontos cegos. Não testamos imagem, conexão, resistência à água ou segurança digital.',
    positiveNotes:['Identificação A28, Wi-Fi e aplicativo iCSee presentes no título da oferta; conferir código da unidade.'],
    negativeNotes:['A28 e A28B não tratados como equivalentes; resolução, lentes, usuários e ONVIF/NVR ainda não confirmados.', 'Proteção contra água, instalação, armazenamento e segurança digital não testados pela equipe.'],
    suppressRating:true,
  }],
  ['51ek2WOgqwYGnIqBAEPP', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB6644496628',
    model:/^(?:parafusadeira\s*furadeira\s*de\s*impacto\s*the\s*black\s*tools|kit\s*the\s*black\s*tools\s*tbkit17)/i,
    correct:'Kit The Black Tools TBKIT17 — parafusadeira/furadeira, duas baterias e 147 peças anunciadas',
  }],
  ['3yIHMxCIF9QgqjNOrSXC', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB2171368181',
    model:/^colchão\s*(?:casal\s*emma\s*original|emma\s*original\s*casal)/i,
    correct:'Colchão Emma Original casal 138 × 188 cm, três camadas de espuma',
    summary:'O anúncio identifica o Emma Original casal de 138 × 188 cm, com três camadas de espuma. Pode ser uma opção para quem procura um colchão de espuma nessa medida; confira se a versão e a base correspondem ao que você precisa. A descrição informa altura de 25 cm, espumas Airgocell e viscoelástica, limite de 130 kg por lado e capa removível e lavável. Esses dados são atribuídos à oferta, não a medições da equipe ou a todas as versões Emma. Confira etiqueta, limite por pessoa e instruções de lavagem da unidade. A expressão suporte para coluna não é apresentada como garantia de aliviar dor ou de adaptação a qualquer pessoa. Não testamos firmeza, conforto, ventilação, durabilidade ou efeitos sobre a saúde. Verifique também as condições de entrega, devolução e garantia aplicáveis ao vendedor; não presumimos que condições de outro canal valham nesta compra.',
    positiveNotes:['Medida casal de 138 × 188 cm e construção em três camadas de espuma anunciadas.', 'Capa removível e lavável descrita na oferta; confirme instruções da unidade.'],
    negativeNotes:['Altura, espumas e limite por lado são dados do anúncio, não medições ou confirmação de todas as versões Emma.', 'Conforto, firmeza e benefício para a coluna não testados; condições de devolução e garantia dependem da oferta.'],
    suppressRating:true,
  }],
  ['41xTWhFAFp82XNFL5V87', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB4742623935',
    model:/^rastreador\s*gps\s*veicular\s*4g/i,
    correct:'Rastreador GPS veicular 4G com app — compatibilidade e serviço a conferir',
    summary:'A oferta apresenta um rastreador GPS veicular 4G com acompanhamento pelo aplicativo BRASILSAT GPS. Pode interessar a quem busca acompanhar um veículo, mas a indicação genérica para carros, motos, caminhões e elétricos não comprova compatibilidade com cada instalação. O anúncio informa alimentação de 9 a 90 V, dimensões de 80 × 28 × 14 mm, chip M2M, cerca virtual e histórico. Não identificamos nesta ficha um código exato de modelo ou manual que permita confirmar esses recursos na unidade. Antes de escolher, peça ao vendedor a identificação do aparelho, compatibilidade elétrica, requisitos de instalação, cobertura e condições de ativação do chip e do aplicativo. Confira eventuais cobranças e duração do serviço incluído: chip anunciado não é garantia de serviço gratuito permanente. Não medimos precisão, intervalo de atualização, disponibilidade da plataforma ou recuperação de veículo e não prometemos rastreamento ininterrupto.',
    positiveNotes:['App BRASILSAT GPS, chip M2M, cerca virtual e histórico descritos na oferta, ainda dependentes de confirmação da unidade e do serviço.'],
    negativeNotes:['Sem código exato ou manual confirmado nesta ficha; compatibilidade não é universal para todos os veículos.', 'Conferir ativação, cobertura e eventuais cobranças; precisão, disponibilidade e recuperação de veículo não testadas.'],
    suppressRating:true,
  }],
  ['4DLJoHbBXNFffpz3DNcv', {
    syncInformationalSchema:true,
    model:/^kit\s*10\s*pote\s*de\s*vidro\s*marmita\s*hermético\s*640\s*ml.*rishon/i,
    summary:'A oferta apresenta um kit Rishon com dez potes de vidro e capacidade anunciada de 640 ml por pote. Pode ajudar quem procura recipientes para separar refeições, mas a quantidade adequada de alimento depende do seu uso e das medidas internas. O título anuncia fechamento hermético e uso no freezer; não testamos vedação ou resistência e não os apresentamos como garantia de ausência de vazamento ou quebra. Confira quantidade de recipientes e tampas, dimensões e instruções específicas antes de comprar. O uso anunciado no freezer não confirma, por si só, uso em forno, micro-ondas, lava-louças ou a resistência da tampa às mesmas condições do vidro. Consulte os limites e cuidados indicados para o conjunto; não inferimos tipo de vidro, temperatura suportada ou resistência a choque térmico. O texto anterior sobre travas estava incompleto e não é uma instrução de segurança do fabricante.',
    positiveNotes:['Kit com dez potes de vidro e capacidade individual de 640 ml anunciados.', 'Fechamento hermético e uso no freezer citados na oferta; condições específicas precisam de confirmação.'],
    negativeNotes:['Vedação, vazamento e resistência não testados pela equipe.', 'Compatibilidade de tampas e vidro com aquecimento, lavagem e mudanças de temperatura não confirmada nesta ficha.'],
    suppressRating:true,
  }],
  ['3AiculsXxRCfEkCx7Qin', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB5084785712',
    model:/^(?:furadeira\s*de\s*impacto\s*13mm\s*750w\s*profissional|furadeira\s*the\s*black\s*tools\s*tbf750)/i,
    correct:'Furadeira The Black Tools TBF750 750 W, 13 mm — kit de 300 peças anunciado',
  }],
  ['2vFXQV4acjGHUTy8Lsk1', {
    syncInformationalSchema:true,
    expectedListing:'MLB5460277774',
    model:/^câmera\s*veicular\s*ddpai\s*n1\s*dual/i,
    summary:'A DDPAI N1 Dual pode interessar a quem procura registrar a frente e a traseira do veículo. A referência oficial informa 1296P na câmera frontal, 1080P na traseira e ângulos de 135° e 125°, respectivamente. A marca também descreve supercapacitor e conexão ao aplicativo. O cartão de 128 GB citado na oferta depende do kit do vendedor: não o tratamos como acessório incluído em toda N1 Dual. A afirmação anterior de gravação de áudio nas duas câmeras após atualização não foi confirmada nesta revisão; confira firmware e funções da unidade. O fabricante informa que o monitoramento de estacionamento requer kit de alimentação específico adquirido separadamente; confirme sua presença na oferta e os requisitos de instalação. Não testamos imagem noturna, leitura de placas, áudio ou instalação e não prometemos eliminar pontos cegos ou impedir incidentes.',
    positiveNotes:['Referência da DDPAI documenta gravação frontal 1296P e traseira 1080P, com ângulos de 135° e 125°.', 'Supercapacitor e conexão ao aplicativo descritos pelo fabricante; confirme a unidade ofertada.'],
    negativeNotes:['Cartão de 128 GB depende do kit; áudio nas duas câmeras após atualização não confirmado nesta revisão.', 'Monitoramento de estacionamento exige kit específico segundo a marca; imagem noturna e instalação não testadas pela equipe.'],
    contextSourceUrl:'https://www.ddpai.com/pages/n1-dual-dash-cam',
    contextSourceLabel:'DDPAI N1 Dual: referência oficial, sem autenticar unidade ou kit do vendedor',
    suppressRating:true,
  }],
  ['347WUiAlueVscYKR7Emm', {
    syncInformationalSchema:true,
    expectedListing:'MLB6968682598',
    model:/^robô\s*aspirador\s*de\s*piscina\s*(?:automático\s*)?redroad\s*s1/i,
    correct:'Robô aspirador de piscina Redroad S1 — área e recarga a conferir',
    summary:'O Redroad S1 é apresentado como robô de piscina sem fio, alimentado por bateria. Há divergências a esclarecer: a oferta menciona 102 m² e recarga de 3 a 4 horas, enquanto a página oficial consultada informa cobertura de 100 m² e recarga de 4 a 5 horas. Não escolhemos um desses números como garantia da unidade do vendedor. A referência oficial anuncia autonomia máxima de 130 minutos, bateria de 5200 mAh e inclinação máxima de 18°; são limites declarados, não resultados medidos pela equipe. Antes de escolher, confirme versão, manual e compatibilidade com formato, revestimento, inclinação e dimensões da sua piscina. Não inferimos limpeza de paredes ou escadas. A descrição sem fio não dispensa conferir as instruções específicas de carga, operação e retirada do aparelho. Não testamos cobertura, autonomia, filtragem ou qualidade da limpeza.',
    positiveNotes:['Formato de robô de piscina sem fio e bateria identificados no cadastro e na referência oficial.', 'Autonomia máxima de 130 minutos anunciada pela marca, não aferida pela equipe.'],
    negativeNotes:['Área e tempo de recarga divergem entre oferta e referência oficial; confirmar versão e manual antes de escolher.', 'Compatibilidade com a piscina e limpeza de paredes ou escadas não confirmadas; sem teste de cobertura ou limpeza.'],
    contextSourceUrl:'https://redroadofficial.com/products/redroad-s1-cordless-self-cleaning-robotic-pool-cleaner',
    contextSourceLabel:'Redroad S1: referência oficial com dados divergentes da oferta, não garantia da unidade',
    suppressRating:true,
  }],
  ['1WM5CLqoLFN2yEUguuVY', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB5761677016',
    model:/^testo\s*essencial(?:\s*-|\s*60\s*cápsulas)/i,
    correct:'TESTO ESSENCIAL 60 cápsulas — alegação sobre testosterona não verificada',
    summary:'O anúncio apresenta TESTO ESSENCIAL em embalagem de 60 cápsulas e cita feno-grego, boro, arginina, ZMA e vitamina B6. A composição, as quantidades e as advertências precisam ser conferidas no rótulo da unidade. A expressão precursor da testosterona do título comercial não foi comprovada nesta revisão e não é apresentada como benefício garantido. Não prometemos aumento hormonal, libido, ganho muscular ou tratamento. A orientação geral da Anvisa sobre suplementos não é aprovação deste produto. Não verificamos sua regularização, autenticidade ou eficácia e não concluímos que seja irregular. Ausência de glúten e consumo de duas cápsulas por dia, mencionados antes, não são confirmados nem prescritos por esta ficha. Confira ingredientes, alergênicos, restrições, origem e validade e procure orientação profissional para decidir sobre uso; não testamos o produto.',
    positiveNotes:['Embalagem de 60 cápsulas e ingredientes citados na oferta; composição e quantidades dependem de confirmação no rótulo.'],
    negativeNotes:['Alegação sobre testosterona sem comprovação nesta revisão; sem promessa de efeito hormonal ou terapêutico.', 'Rótulo, regularização, autenticidade, eficácia e adequação individual não verificados; a ficha não prescreve consumo.'],
    contextSourceUrl:'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares/perguntas-frequentes',
    contextSourceLabel:'Anvisa: orientação geral sobre suplementos, não aprovação do TESTO ESSENCIAL',
    suppressRating:true,
  }],
  ['2bvf1eThLNTx4TSWmm6j', {
    syncInformationalSchema:true,
    expectedListing:'MLB5363320228',
    model:/^cpu\s*monitor\s*dell\s*optiplex\s*core\s*i5\s*4570/i,
    summary:'A oferta identifica um conjunto Dell OptiPlex com Core i5-4570, 8 GB de RAM e SSD de 240 GB. A descrição anuncia monitor Dell de 19 polegadas, Windows 11 e portas USB, VGA e DisplayPort; confirme o conteúdo e o gabinete exatos com o vendedor. Windows 11 anunciado ou instalado não comprova, por si só, compatibilidade e suporte oficiais. A referência da Microsoft lista processadores para novos dispositivos Windows 11 e orienta consultar o fornecedor sobre suporte específico; ela não certifica este computador. Não verificamos TPM, firmware, licença, compatibilidade integral ou condições de atualização desta unidade. Também não inferimos a série exata do OptiPlex ou o modelo do monitor pelo processador. Confirme estado de conservação, especificações e condições de suporte antes de escolher. Não testamos desempenho, jogos, ruído, consumo ou durabilidade.',
    positiveNotes:['Conjunto com Core i5-4570, 8 GB de RAM e SSD de 240 GB identificado na oferta.', 'Monitor Dell de 19 polegadas anunciado; confirme modelo, estado e itens incluídos.'],
    negativeNotes:['Windows 11 anunciado não é comprovação de compatibilidade, licença ou suporte; unidade não verificada pela equipe.', 'Série do gabinete, monitor, conexões e estado precisam de confirmação; sem teste de desempenho.'],
    contextSourceUrl:'https://learn.microsoft.com/en-us/windows-hardware/design/minimum/supported/windows-11-supported-intel-processors',
    contextSourceLabel:'Microsoft: requisitos de processadores Windows 11, sem certificar a unidade da oferta',
    suppressRating:true,
  }],
  ['1c9dmLesD1G0pPTCYrjt', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB4951174502',
    model:/^(?:kit\s*2\s*suporte\s*porta\s*shampoo|kit\s*de\s*dois\s*suportes\s*adesivos\s*homeroarte)/i,
    correct:'Kit de dois suportes adesivos Homeroarte para banheiro — fixação a conferir',
    summary:'O cadastro anuncia um kit Homeroarte com dois suportes adesivos para organizar shampoo e sabonete no banheiro, sem perfuração anunciada. Pode interessar a quem procura esse formato, mas a proposta adesiva não garante fixação em toda parede ou dentro de qualquer box. Antes de escolher, confira superfícies compatíveis, preparação, instalação, tempo de espera e carga permitida nas instruções específicas da oferta. A limpeza da superfície é apenas um dos aspectos a verificar, não comprovação de aderência. Não há limite de peso confirmado nesta ficha e não testamos fixação, resistência à umidade, durabilidade ou remoção sem marcas. Confirme também dimensões e itens necessários à instalação; não inferimos material, acessórios ou capacidade pelo termo luxo do título anterior.',
    positiveNotes:['Kit com dois suportes e fixação adesiva sem perfuração anunciados no cadastro.'],
    negativeNotes:['Superfície, instalação e carga permitida precisam de confirmação; não há teste de fixação ou umidade da equipe.', 'Remoção sem marcas, material e durabilidade não confirmados nesta ficha.'],
    suppressRating:true,
  }],
  ['1Iyoc1zKTUsDEQGbvIM3', {
    syncInformationalSchema:true,
    expectedListing:'MLB4435213175',
    model:/^inalador\s*nebulizador\s*aero\s*tech.*relaxmedic/i,
    summary:'O cadastro identifica o inalador nebulizador Aero Tech da Relaxmedic, anunciado como portátil e com tecnologia Mesh. A página oficial de referência identifica o modelo RM-IP0135A e descreve modos adulto, infantil e limpeza; confirme o código da unidade e os acessórios incluídos na oferta. A existência desses modos não é indicação clínica individual nem prescrição de tratamento. O ajuste de intensidade e o display citados no texto anterior não foram confirmados nesta revisão e não são apresentados como recursos garantidos. Não testamos nebulização, ruído, autonomia, conforto ou resultados terapêuticos. Para indicação de uso, substâncias compatíveis, quantidade, duração e higienização, siga orientação profissional e o manual específico, não uma descrição comercial. Esta ficha não escolhe medicamentos, doses ou tratamento e não autentica a unidade do vendedor.',
    positiveNotes:['Aero Tech e tecnologia Mesh identificados no cadastro e na referência da Relaxmedic.', 'A página do fabricante descreve modos adulto, infantil e limpeza para o modelo de referência.'],
    negativeNotes:['Confirme código, acessórios e instruções da unidade; display e ajuste de intensidade não confirmados nesta revisão.', 'Desempenho e adequação clínica não testados pela equipe; a ficha não substitui orientação profissional ou manual.'],
    contextSourceUrl:'https://www.gruporelaxmedic.com.br/produto/inalador-nebulizador-aero-tech/',
    contextSourceLabel:'Relaxmedic Aero Tech RM-IP0135A: referência oficial, sem autenticar a unidade da oferta',
    suppressRating:true,
  }],
  ['1VMzq0ovRkap3dGQ7ikC', {
    syncInformationalSchema:true,
    expectedListing:'MLB4604524273',
    model:/^fritadeira\s*air\s*fryer\s*philco\s*16\s*litros\s*paf16c.*220\s*v/i,
    summary:'O cadastro identifica a air fryer Philco PAF16C de 16 litros, preta, na versão 220 V. A descrição anuncia potência de 1900 W e painel touch; são dados da oferta, não medições da equipe. Pode interessar a quem procura esse formato de aparelho, mas a capacidade anunciada não informa, sozinha, quantas porções cabem em cada preparo. Não prometemos preparo mais rápido, economia de energia, robustez ou resultado uniforme para qualquer receita. Antes de escolher, confira dimensões, espaço necessário, capacidade dos acessórios, conteúdo da caixa e requisitos elétricos no manual da versão oferecida. Não tratamos esta unidade como bivolt e não transferimos dados de outra voltagem. Não testamos tempo de preparo, consumo, temperatura, limpeza ou durabilidade.',
    positiveNotes:['PAF16C, capacidade de 16 litros e versão 220 V identificados no cadastro.', 'Potência de 1900 W e painel touch anunciados na descrição; confirme a unidade.'],
    negativeNotes:['Capacidade por preparo e adequação ao espaço dependem de medidas e acessórios; não foram testadas pela equipe.', 'Rapidez, consumo, uniformidade, robustez e durabilidade não medidos; versão cadastrada é 220 V, não presumida bivolt.'],
    suppressRating:true,
  }],
  ['0TQPS3z5Mj1mWyEjdcjd', {
    syncInformationalSchema:true,
    model:/^principia\s*kit\s*protetor\s*solar\s*facial\s*ps[-\s]*01\s*fps\s*60/i,
    summary:'O cadastro anuncia um kit Principia PS-01 FPS 60 com duas unidades e indicação de 40 ml; confirme o conteúdo do kit e o volume de cada unidade na oferta. A página oficial do PS-01 FPS 60 declara resistência à água e ao suor. Não interpretamos essa declaração como proteção total ou ilimitada: siga as instruções de aplicação e reaplicação do rótulo da unidade recebida. A fabricante também apresenta avaliação que sustenta o termo hipoalergênico, mas esta ficha não é teste próprio nem comprovação de tolerância individual. Não autenticamos as unidades do vendedor nem avaliamos desempenho, textura ou adaptação à pele. Confira versão, embalagem, validade e procedência; não substituímos orientações do rótulo ou avaliação individual por uma promessa comercial.',
    positiveNotes:['Kit PS-01 FPS 60 identificado no cadastro; a fabricante declara resistência à água e ao suor para o produto de referência.'],
    negativeNotes:['Resistência à água não é apresentada aqui como proteção total ou ilimitada; aplicação e reaplicação dependem do rótulo.', 'Conteúdo/volume por unidade, procedência e tolerância individual não verificados pela equipe; não é teste próprio.'],
    contextSourceUrl:'https://www.principiaskin.com/protetor-solar-facial-ps-01-filtros-uv-niacinamida.html',
    contextSourceLabel:'Principia PS-01 FPS 60: página oficial do produto de referência, não confirmação do kit do vendedor',
    suppressRating:true,
  }],
  ['0vNEHjhD3cm0iTyBCZRe', {
    syncInformationalSchema:true,
    expectedListing:'MLB4765036111',
    model:/^c[aâ]mera\s*l[aâ]mpada.*(?:yoosee|seguran[cç]a)/i,
    correct:'Câmera lâmpada Wi-Fi — app Yoosee e visão noturna anunciados',
    summary:'O cadastro anuncia uma câmera no formato de lâmpada com Wi-Fi em 2,4 GHz, aplicativo Yoosee, visão noturna e movimentação PTZ. A descrição informa resolução de 1080p; esse é um dado anunciado, não uma medição de imagem da equipe. Não garantimos identificar rostos, placas ou detalhes em qualquer distância ou iluminação. Marca, modelo exato e instruções não estão confirmados nesta ficha. Antes de escolher, confira alimentação, instalação compatível, recursos do aplicativo, armazenamento e eventuais condições de serviços do modelo oferecido. Não inferimos uso externo ou resistência à água pelo formato de lâmpada. Não testamos qualidade de imagem, atraso da transmissão, cobertura de movimento, visão noturna, estabilidade ou segurança do aplicativo; não apresentamos a câmera como garantia de prevenção de incidentes.',
    positiveNotes:['Wi-Fi em 2,4 GHz, aplicativo Yoosee, visão noturna e PTZ anunciados no cadastro.'],
    negativeNotes:['1080p é resolução declarada, não comprovação de identificação de detalhes em qualquer cenário.', 'Modelo, armazenamento, condições do aplicativo e instalação precisam de confirmação; imagem, transmissão e resistência não testadas pela equipe.'],
    suppressRating:true,
  }],
  ['xayABmLUPEj8yOPOfzA9', {
    syncInformationalSchema:true,
    expectedListing:'MLB7573890658',
    model:/^patinete\s*infantil\s*triciclo\s*dobr[aá]vel\s*scooter/i,
    summary:'O anúncio identifica um patinete infantil de três rodas, dobrável e com LED, e informa materiais em metal e PVC e necessidade de montagem. O campo de marca reúne termos descritivos, sem identificar claramente um fabricante; não o tratamos como marca confirmada. O limite de 70 kg aparece no título, mas não é resultado de teste da equipe nem comprova adequação para uma criança de qualquer idade ou altura. Antes de escolher, confira faixa etária, dimensões, ajustes, sistema de freio e instruções de montagem e supervisão do modelo específico. Não deduzimos estabilidade, resistência ou segurança apenas pela presença de três rodas. Não testamos o produto nem confirmamos certificações; consulte as informações da embalagem, o manual e o vendedor, sem substituir as restrições do fabricante por esta descrição.',
    positiveNotes:['Três rodas, formato dobrável, LED e montagem necessária anunciados no cadastro; confirme o conjunto vendido.'],
    negativeNotes:['Fabricante, faixa etária, dimensões, freios e certificações não confirmados nesta ficha.', '70 kg é um limite anunciado, não aprovação de uso para toda criança; estabilidade, resistência e segurança não foram testadas.'],
    suppressRating:true,
  }],
  ['vDQlmcCO0HZUBNi2DUxd', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB6205717194',
    model:/^(?:liftness\s*bicicleta\s*ergom[eé]trica\s*fitness\s*sp50ptvm|bicicleta\s*ergom[eé]trica\s*liftness\s*sp50ptvm)/i,
    correct:'Bicicleta ergométrica Liftness SP50PTVM — ajustes e resistência mecânica anunciados',
    summary:'O anúncio identifica a bicicleta ergométrica Liftness SP50PTVM e informa resistência mecânica por botão, assento e guidão ajustáveis e rodas de transporte. O limite de 100 kg é declarado pelo vendedor, não resultado de teste da equipe. Pode interessar a quem procura uma bicicleta estacionária, mas confira as medidas, os ajustes disponíveis e a indicação de uso do modelo antes de escolher. Ajustes não garantem conforto ou encaixe adequado para toda pessoa. Não apresentamos o equipamento como exercício sem impacto, garantia de melhora da saúde ou substituto de avaliação individual. Não testamos estabilidade, ruído, resistência, conforto, durabilidade ou segurança. Confirme montagem, restrições, manutenção e condições de uso no manual específico e com o vendedor; não inferimos adequação para musculação ou uso de academia apenas pelo título.',
    positiveNotes:['Resistência mecânica por botão, ajustes de assento/guidão e rodas de transporte anunciados na oferta.'],
    negativeNotes:['Limite de 100 kg é declarado pelo vendedor; estabilidade, conforto e durabilidade não testados pela equipe.', 'Dimensões, ajustes e indicação de uso precisam de confirmação no manual; sem garantia de benefício de saúde ou adequação a qualquer pessoa.'],
    suppressRating:true,
  }],
  ['WO6BdDxEWWCCjBVJ0ygB', {
    syncInformationalSchema:true,
    expectedListing:'MLB7213068268',
    model:/^fone.*ear\s*clip.*6[.,]0/i,
    correct:'Fone ear clip OWS Bluetooth 6.0 — autonomia e resistência à água divergentes',
  }],
  ['sinwoGjrsJl5UMA13pES', {
    syncInformationalSchema:true,
    expectedListing:'MLB6204416228',
    model:/^power\s*bank\s*basike\s*20000\s*mah/i,
    summary:'O anúncio identifica um power bank Basike de 20000 mAh com cabo USB-C e indicação de 65 W. São características declaradas na oferta, não capacidade útil ou potência medidas pela equipe. Pode interessar a quem procura alimentação portátil, mas a menção a notebook no título não comprova compatibilidade com todo computador ou carregamento em potência máxima. Antes de escolher, confira o modelo exato, os protocolos, os perfis de tensão e corrente, as portas e o cabo exigidos pelo aparelho. Não confirmamos 65 W em todas as saídas ou em uso simultâneo. Não testamos velocidade de carga, autonomia, aquecimento ou durabilidade, nem dispomos de avaliações verificadas para afirmar excelente aceitação dos usuários. Confira também o conteúdo do conjunto e as instruções específicas de uso e recarga.',
    positiveNotes:['20000 mAh, cabo USB-C e 65 W anunciados no cadastro; confirme o modelo e a configuração da oferta.'],
    negativeNotes:['Compatibilidade com notebook/celular e potência disponível dependem dos requisitos do aparelho, porta e cabo; não foram testadas pela equipe.', 'Capacidade útil, velocidade de carga, autonomia e desempenho simultâneo não medidos; sem avaliação de usuários verificada nesta ficha.'],
    suppressRating:true,
  }],
  ['sX3K2gzcggu9lkVSke0Q', {
    syncInformationalSchema:true,
    model:/^heaven\s*extraordinary\s*collection\s*100\s*ml\s*[-–—]?\s*wepink/i,
    summary:'O cadastro identifica Heaven Extraordinary Collection da Wepink em frasco de 100 ml. A descrição disponível nesta ficha não detalha a pirâmide olfativa; por isso não atribuímos notas, concentração ou semelhança com outra fragrância por suposição. Se estiver considerando esta opção, confira a identificação exata da versão, a descrição do fabricante e as informações da embalagem oferecida. Volume de 100 ml não comprova bom rendimento ou duração na pele. Não testamos fragrância, fixação ou projeção, e a aparência da embalagem não é prova de autenticidade ou qualidade. A escolha do aroma depende da preferência pessoal; não apresentamos esta ficha como experiência de uso ou garantia de que a fragrância agradará a todos.',
    positiveNotes:['Nome Heaven Extraordinary Collection, marca Wepink e frasco de 100 ml identificados no cadastro.'],
    negativeNotes:['Pirâmide olfativa, concentração, autenticidade e características da versão não verificadas nesta revisão.', 'Rendimento, fixação, projeção e experiência de uso não testados; sem promessa de duração ou aceitação universal.'],
    suppressRating:true,
  }],
  ['mlMLB7502068112', {
    syncInformationalSchema:true,
    expectedListing:'MLB7502068112',
    model:/^repetidor\s*de\s*sinal\s*extensor\s*internet\s*wifi/i,
    summary:'O anúncio identifica um repetidor Pix-Link com duas antenas externas e informa Wi-Fi b/g/n em 2,4 GHz e 300 Mbps. Esse número é uma declaração da oferta, não uma medição de velocidade de internet entregue pela equipe. Pode interessar a quem procura ampliar o alcance de uma rede existente, mas não prometemos cobertura total, eliminação de pontos sem sinal ou aumento da velocidade do plano. O modelo completo e a revisão não estão confirmados nesta ficha; por isso não atribuímos portas, modos de operação, recursos Mesh ou outra faixa de frequência. Confira compatibilidade com seu roteador, requisitos de configuração e local de instalação no manual do modelo oferecido. Não testamos alcance, estabilidade, desempenho ou funcionamento com a rede do comprador.',
    positiveNotes:['Duas antenas e Wi-Fi b/g/n em 2,4 GHz anunciados no cadastro; confirme o modelo.'],
    negativeNotes:['300 Mbps não é velocidade de internet medida ou garantida pela equipe.', 'Modelo/revisão, cobertura, estabilidade e compatibilidade com sua rede não confirmados; sem promessa de eliminar todo ponto sem sinal.'],
    suppressRating:true,
  }],
  ['NJipazuMXMzOH9YZbxwu', {
    syncInformationalSchema:true,
    expectedListing:'MLB4587377807',
    model:/^(?:fone.*|headphone\s*)dapon\s*h02d/i,
    correct:'Headphone Dapon H02D Bluetooth 5.1 — autonomia e porta de recarga divergentes',
  }],
  ['rJhe4VyyDiFudQmQmXCV', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    model:/^(?:ro[cç]adeira\s*aparador\s*grama.*tcg21cx[-\s]*2b.*the\s*black\s*tools|aparador\s*the\s*black\s*tools\s*tcg21cx[-\s]*2b)/i,
    correct:'Aparador The Black Tools TCG21CX-2B — duas baterias e 21 V anunciados',
    summary:'O cadastro identifica o aparador The Black Tools TCG21CX-2B sem fio, com duas baterias de 21 V, cabo regulável e guiador ajustável anunciados. A descrição também informa 750 W, 6000 rpm e diâmetro de corte de 25 cm; são dados do anúncio, não medições da equipe. Duas baterias não informam, por si só, quantos minutos o equipamento funcionará nem garantem trabalho contínuo. Os ajustes não comprovam conforto ou ergonomia para toda pessoa. Antes de escolher, confirme o modelo, a capacidade das baterias, o carregador, os acessórios incluídos e os usos permitidos no manual específico. Não inferimos adequação profissional ou para qualquer vegetação. Não testamos corte, autonomia, resistência ou segurança; para montagem, carregamento, proteções e operação, siga o manual do modelo e não apenas a descrição comercial.',
    positiveNotes:['Duas baterias, formato sem fio e ajustes de cabo/guiador anunciados; confirme o conjunto vendido.'],
    negativeNotes:['750 W, 6000 rpm e corte de 25 cm são declarações do anúncio, não medições independentes.', 'Capacidade, autonomia, compatibilidade dos acessórios e adequação profissional não confirmadas nesta ficha.', 'Conforto, ergonomia, corte e segurança não foram testados pela equipe.'],
    suppressRating:true,
  }],
  ['mlMLB6472086508', {
    syncInformationalSchema:true,
    expectedListing:'MLB6472086508',
    model:/^perfume\s*[aá]rabe\s*ameerati\b/i,
    summary:'O anúncio identifica Ameerati como perfume feminino Eau de Parfum de 100 ml e informa Lipx no campo de marca. O vendedor também declara origem nos Emirados Árabes Unidos e frasco não recarregável. Esses são dados da oferta, não validação de fabricante, procedência ou autenticidade pela equipe. O nome Ameerati, sozinho, não permite copiar a composição ou as notas olfativas de outro perfume com nome parecido. Se estiver considerando esta opção, confira fabricante, embalagem, identificação da unidade e descrição da fragrância com o vendedor. A expressão com NF do título não substitui a confirmação das condições de emissão da nota fiscal. Não testamos fragrância, fixação ou projeção e não prometemos duração específica na pele.',
    positiveNotes:['Volume de 100 ml e classificação Eau de Parfum informados na oferta; confirme a unidade.'],
    negativeNotes:['Fabricante, procedência e autenticidade não verificados pela equipe; campo de marca do anúncio não é validação independente.', 'Notas olfativas, fixação e projeção não confirmadas; não usamos a ficha de outro perfume de nome parecido.'],
    suppressRating:true,
  }],
  ['mlMLB6795714040', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB6795714040',
    model:/^lanterna.*voxo.*\bt9\b/i,
    correct:'Lanterna Voxo T9 com zoom e recarga USB anunciados — autonomia e proteção a confirmar',
    summary:'O anúncio identifica a lanterna Voxo T9 com zoom, iluminação LED, recarga USB e cinco modos. A descrição menciona bateria ou pilhas AA/AAA, sem esclarecer inequivocamente a configuração e os acessórios da unidade; confirme no manual e com o vendedor antes de escolher. O campo chamado potência traz 10 lm, mas não há informação técnica suficiente nesta ficha para tratar esse número como potência elétrica ou fluxo luminoso verificado. As expressões ultra potente, longa duração, militar e resistente à água e poeira não comprovam alcance, autonomia, certificação ou grau de proteção. Não testamos iluminação, bateria, resistência ou durabilidade e não indicamos o produto como equipamento de defesa ou de segurança. Confira tipo de alimentação compatível, carregamento, conteúdo da caixa e restrições de uso no manual específico.',
    positiveNotes:['Zoom, recarga USB, LED e cinco modos anunciados; confirme a configuração da oferta.'],
    negativeNotes:['Autonomia, alcance e grau de proteção não confirmados; não há garantia de resistência irrestrita à água e poeira.', 'Alimentação e acessórios precisam de confirmação; não presumimos equivalência entre bateria, AA e AAA.', 'Valor 10 lm do anúncio sem medição independente; sem validação de uso militar, defesa ou segurança.'],
    suppressRating:true,
  }],
  ['mlMLB7482222950', {
    syncInformationalSchema:true,
    expectedListing:'MLB7482222950',
    model:/^mochila\s*escolar\s*refor[cç]ada\s*xiaobang\s*bw[-\s]*1904d/i,
    summary:'O anúncio identifica a mochila Xiaobang BW-1904D de 40 litros, com compartimento anunciado para notebook de até 17 polegadas, poliéster e bolso para garrafa. A descrição informa 18 cm de profundidade; confirme todas as medidas e o espaço interno antes de escolher para o seu aparelho. A diagonal de 17 polegadas não garante que qualquer notebook desse tamanho caiba. As expressões reforçada e à prova d’água são declarações do vendedor, sem ensaio ou classificação de proteção registrados nesta ficha. Não prometemos impermeabilidade do conjunto, proteção dos eletrônicos ou maior durabilidade. Não testamos costuras, zíperes, conforto com carga ou resistência à água. Confira dimensões do compartimento, limite de carga, materiais e orientações de conservação no anúncio e com o vendedor.',
    positiveNotes:['Modelo BW-1904D, capacidade de 40 litros e compartimento para notebook anunciados.', 'Bolso para garrafa e material em poliéster informados na descrição; confirme a variante.'],
    negativeNotes:['Compatibilidade com notebook depende das medidas internas e do aparelho, não apenas da diagonal da tela.', 'Impermeabilidade, resistência, durabilidade e conforto com carga não testados pela equipe.'],
    suppressRating:true,
  }],
  ['mlMLB4407094781', {
    syncInformationalSchema:true,
    model:/^t[eê]nis\s*masculino\s*adrun\s*calce\s*f[aá]cil/i,
    summary:'O cadastro identifica um tênis masculino Adrun de calce fácil. A descrição informa interior têxtil e palmilhas removíveis; confirme esses detalhes na variante escolhida. Pode interessar a quem procura praticidade para calçar, mas a expressão calce fácil não garante ajuste ou conforto para todos os pés. O texto do anúncio também associa a entressola a maior amortecimento e estabilidade, sem documentação técnica registrada nesta ficha para comprovar esses benefícios. Não usamos os termos ortholight e goufre, presentes na descrição, como confirmação de tecnologia específica. Não testamos amortecimento, aderência, estabilidade, conforto ou durabilidade. Confira o modelo completo, composição, tabela de medidas e indicação de uso antes de escolher; não presumimos adequação para corrida ou finalidade ortopédica pelo título esportivo.',
    positiveNotes:['Proposta de calce fácil, interior têxtil e palmilhas removíveis informados na descrição; confirme a variante.'],
    negativeNotes:['Benefícios de amortecimento e estabilidade e tecnologia da entressola sem comprovação registrada nesta ficha.', 'Modelo completo, composição e ajuste precisam de confirmação; não há teste de conforto ou indicação ortopédica da equipe.'],
    suppressRating:true,
  }],
  ['8NEAHWVWDbRD0jFU4YSn', {
    syncInformationalSchema:true,
    expectedListing:'MLB4359093019',
    model:/^t[eê]nis\s*masculino\s*casual\s*aramis\s*daily\s*slip/i,
    summary:'O cadastro identifica o Aramis Daily Slip, um tênis casual slip-on, sem cadarços. O texto da oferta informa lona têxtil, palmilha de poliuretano e solado de borracha; confirme esses materiais na variante escolhida. Pode interessar a quem procura esse formato para ocasiões informais, mas conforto e ajuste dependem do pé e da numeração. A alegação de propriedade antibacteriana da palmilha não tem comprovação técnica registrada nesta ficha. Não testamos conforto, aderência, resistência ou durabilidade e não apresentamos o modelo como calçado esportivo ou ortopédico. Confira tabela de medidas, composição, orientações de conservação e condições da oferta antes de escolher.',
    positiveNotes:['Formato casual slip-on sem cadarços identificado no cadastro.', 'Lona têxtil, palmilha de poliuretano e solado de borracha informados na descrição; confirme a variante.'],
    negativeNotes:['Propriedade antibacteriana da palmilha sem comprovação técnica registrada nesta ficha.', 'Conforto, aderência e durabilidade não testados; numeração e ajuste precisam de conferência.'],
    suppressRating:true,
  }],
  ['MgDXTGUyMBcJUtTahZIY', {
    syncInformationalSchema:true,
    expectedListing:'MLB5085157465',
    model:/^patinete\s*el[eé]trico\s*500\s*w/i,
    summary:'O cadastro anuncia um patinete elétrico dobrável com motor de 500 W, autonomia de 37 km, indicação IPX4 e aplicativo. A descrição também informa bateria de íon de lítio, recarga em 5 horas, velocidade de 35 km/h e carga suportada de 120 kg. São declarações do anúncio, não medições da equipe. Autonomia, velocidade e recarga reais dependem das condições de uso; não prometemos esses resultados em todo trajeto. Marca, modelo exato, manual, aplicativo compatível e condições da classificação IPX4 precisam de confirmação. Essa indicação não será tratada como garantia de uso na chuva ou submersão. Não testamos freios, estabilidade, bateria ou segurança. Antes de escolher para deslocamentos, confira as instruções do modelo e as regras aplicáveis ao local de uso; a idade citada pelo vendedor não comprova autorização para circular.',
    positiveNotes:['Formato dobrável e aplicativo anunciados; confirme modelo e compatibilidade.'],
    negativeNotes:['500 W, 37 km, 35 km/h, recarga em 5 horas e 120 kg são dados declarados, não resultados verificados.', 'Marca/modelo e manual não confirmados nesta ficha; IPX4 não é garantia irrestrita de resistência à água.', 'Freios, estabilidade, segurança e condições de circulação não foram validados pela equipe.'],
    suppressRating:true,
  }],
  ['mlMLB4024139675', {
    syncInformationalSchema:true,
    expectedListing:'MLB4024139675',
    model:/^kit\s*3\s*pares\s*meia\s*antiderrapante/i,
    summary:'O anúncio identifica um kit de três pares de meias esportivas, descritas como antiderrapantes para futebol e treino. O campo de marca traz uma sequência de termos genéricos, sem identificar claramente um fabricante; não a apresentamos como marca confirmada. Pode interessar a quem procura esse tipo de meia, mas confira tamanho, composição, altura do cano, quantidade de pares e acabamento da variante escolhida. A expressão antiderrapante não garante evitar escorregões ou lesões nem comprova melhora de desempenho. Não testamos aderência, ajuste, conforto, costuras ou resistência à lavagem. Confirme materiais e instruções de conservação diretamente no anúncio e na embalagem.',
    positiveNotes:['Kit de três pares e proposta de uso esportivo identificados no título do anúncio.'],
    negativeNotes:['Fabricante, composição e medidas não confirmados nesta ficha.', 'Aderência, conforto e resistência à lavagem não testados; sem promessa de prevenir escorregões ou lesões.'],
    suppressRating:true,
  }],
  ['fCw8R0SRDFhAWXIT2sZ0', {
    syncInformationalSchema:true,
    expectedListing:'MLB6555831758',
    model:/^controle\s*gamesir\s*nova\s*lite\s*2\b/i,
    summary:'O cadastro identifica o GameSir Nova Lite 2 branco. A GameSir anuncia conexão por Bluetooth, receptor sem fio ou cabo, analógicos e gatilhos Hall Effect e dois botões traseiros para macros. Pode interessar a quem procura um controle para PC, Switch ou celular, mas confira o sistema, o jogo e o modo de conexão compatível antes de escolher. A taxa de 1000 Hz anunciada não é uma medição nossa nem comprova essa taxa em todas as conexões. Hall Effect não é garantia de ausência de drift ou desgaste. A bateria de 600 mAh não informa, sozinha, quantas horas o controle funcionará. A base de recarga é vendida separadamente na referência oficial; confirme os acessórios da oferta do vendedor. Não testamos latência, autonomia, conforto ou durabilidade.',
    positiveNotes:['Hall Effect nos analógicos e gatilhos e dois botões traseiros para macros anunciados pela GameSir.', 'Conexões Bluetooth, receptor sem fio e cabo documentadas para o modelo; compatibilidade depende do dispositivo e do modo.'],
    negativeNotes:['1000 Hz não foi medido pela equipe nem confirmado para todas as conexões; Hall Effect não garante ausência de drift.', 'Autonomia real não verificada; capacidade de 600 mAh não equivale a horas de uso. Base de recarga vendida separadamente na referência oficial.'],
    contextSourceUrl:'https://gamesir.com/products/gamesir-nova-lite2/buy',
    contextSourceLabel:'GameSir Nova Lite 2: especificações anunciadas e conteúdo do conjunto de referência',
    suppressRating:true,
  }],
  ['jpfsQDwQMrok9k3UQ66e', {
    syncInformationalSchema:true,
    expectedListing:'MLB4709294547',
    model:/^conjunto\s*de\s*panelas\s*antiaderente\s*10\s*pe[cç]as\s*coffee/i,
    summary:'O cadastro anuncia o conjunto de panelas Imperial Coffee cappuccino com dez peças e revestimento antiaderente. Pode interessar a quem procura um conjunto para a cozinha, mas dez peças não significa necessariamente dez panelas: confirme a relação de recipientes, tampas e acessórios do anúncio. A indicação antiaderente não comprova que alimentos nunca grudem nem garante facilidade de limpeza em todo uso. Antes de escolher, confira material, diâmetros, capacidades, tipos de fogão compatíveis e instruções de limpeza com o vendedor e o manual específico. Não presumimos compatibilidade com indução, forno ou lava-louças. Não testamos distribuição de calor, resistência do revestimento, durabilidade ou segurança dos materiais.',
    positiveNotes:['Conjunto de dez peças e revestimento antiaderente anunciados no cadastro; confirme a composição exata da oferta.'],
    negativeNotes:['Material, dimensões, capacidades e compatibilidade com fogões precisam de confirmação; não presumimos uso em indução, forno ou lava-louças.', 'Antiaderência, limpeza, distribuição de calor e durabilidade não foram testadas pela equipe.'],
    suppressRating:true,
  }],
  ['5Kojn8DcrLoydOBjq4vd', {
    syncInformationalSchema:true,
    model:/^fogareiro\s+port[aá]til\s+usd\b/i,
    summary:'O cadastro anuncia um fogareiro portátil USD de uma boca, com acendimento automático, maleta e uso de cartucho de gás butano. Essas são informações do anúncio, não resultados de teste. Pode interessar a quem procura esse formato para camping, mas confirme o modelo, o cartucho específico compatível, os itens incluídos, as dimensões e as condições de uso no manual e com o vendedor. A presença de maleta e acendimento automático não comprova segurança do conjunto. Não avaliamos estabilidade, consumo, resistência da maleta, desempenho ou dispositivos de segurança; também não classificamos o produto como ideal para toda viagem, trilha ou pescaria. Para instalação, ventilação, combustível e uso, siga o manual específico; não substituímos essas instruções por suposições baseadas na foto ou no nome.',
    positiveNotes:['Uma boca, acendimento automático e maleta anunciados no cadastro; confira o conjunto vendido.'],
    negativeNotes:['Modelo e cartucho compatível precisam de confirmação no manual; não presumimos compatibilidade universal com butano.', 'Segurança, estabilidade, consumo e resistência da maleta não foram testados pela equipe.'],
    suppressRating:true,
  }],
  ['CEVlNR7lM1QTwgcn0tRu', {
    syncInformationalSchema:true,
    expectedListing:'MLB4053860172',
    model:/^jogo\s+banco\s+imobili[aá]rio.*brasil.*estrela/i,
    summary:'O cadastro identifica o Banco Imobiliário Brasil da Estrela, um jogo de tabuleiro com tema de compra e venda de propriedades. Pode ser considerado por quem procura esse tipo de jogo para reunir participantes, mas gostar da proposta depende das preferências do grupo. O tema de negociação não comprova melhoria de planejamento financeiro, estratégia ou raciocínio lógico. Confira a edição Brasil, a faixa etária, o número de jogadores, as regras, os componentes incluídos e as advertências da embalagem antes de escolher. Não transferimos esses dados de outra edição do Banco Imobiliário. Não testamos as peças, a duração das partidas, a experiência do grupo ou resultados educacionais.',
    positiveNotes:['Edição Brasil da Estrela e tema de compra e venda de propriedades identificados no cadastro.'],
    negativeNotes:['Faixa etária, número de participantes e componentes desta edição precisam de confirmação na embalagem ou no anúncio.', 'Não há teste da equipe que comprove benefícios educacionais, duração das partidas ou resistência das peças.'],
    suppressRating:true,
  }],
  ['XRKv9OGoKrBbcDP0GxER', {
    syncInformationalSchema:true,
    expectedListing:'MLB6797156948',
    model:/^kit\s*(?:2|de dois)\s*refletor(?:es)?.*led/i,
    correct:'Kit de dois refletores LED — 6500 K, bivolt e IP67 anunciados',
    summary:'O cadastro anuncia um kit de dois refletores LED, com luz branco-frio de 6500 K, alimentação bivolt e indicação IP67 no título. A descrição anterior tratava 400 W por unidade como um dado confirmado; não há documentação nesta ficha que comprove essa potência ou esclareça se o número se refere a cada refletor ou ao conjunto. Não medimos consumo, fluxo luminoso, área iluminada ou durabilidade. A indicação IP67 é uma declaração do anúncio, não uma certificação verificada pela equipe nem garantia sobre a instalação completa. Antes de escolher para quintal, fachada ou outra área, confirme potência por unidade, lúmens, tensão, dimensões, itens incluídos e instruções de instalação com o vendedor e o manual específico. Não prometemos iluminar uma área determinada nem resistência irrestrita à água.',
    positiveNotes:['Duas unidades, luz de 6500 K e alimentação bivolt anunciadas no cadastro; confirme a oferta selecionada.'],
    negativeNotes:['Potência de 400 W por unidade não comprovada; consumo e fluxo luminoso não foram medidos.', 'IP67 consta no anúncio, sem documentação verificada nesta ficha; instalação e proteção do conjunto precisam de confirmação.'],
    suppressRating:true,
  }],
  ['z507ObVuMlSEBSnK40Uc', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB6549129000',
    model:/^fone.*kapbom/i,
    correct:'Fone KAPBOM KA-790/KA790D TWS com gancho — versão Bluetooth divergente no anúncio',
  }],
  ['1tIzUpXs4udqZOZwpQX7', {
    syncInformationalSchema:true,
    expectedListing:'MLB6660301362',
    model:/^headset.*hxz[-\s]*b39/i,
    correct:'Headset HXZ-B39 — conexão com fio ou sem fio divergente no anúncio',
  }],
  ['51cYaPGtvus2ayLrbFwH', {
    syncInformationalSchema:true,
    expectedListing:'MLB7458807728',
    model:/^kit\s+starlink\s+mini\b/i,
    summary:'O cadastro anuncia um Kit Starlink Mini para internet via satélite e descreve roteador integrado e formato compacto. Pode ser uma opção a investigar para locais sem conexão fixa adequada, mas a compra do kit não comprova serviço disponível no endereço nem inclui, por si só, plano ou ativação. Confira cobertura, plano aplicável, possibilidade de ativar a unidade, procedência, alimentação, acessórios e condições de uso diretamente com a Starlink e o vendedor. Não garantimos conexão estável, velocidade, funcionamento em movimento ou atendimento em qualquer lugar. Não testamos o equipamento e não confirmamos o conteúdo completo da caixa ou a situação de ativação desta unidade.',
    positiveNotes:['Kit identificado no cadastro como Starlink Mini, com roteador integrado anunciado; confirme o modelo e os itens da oferta.'],
    negativeNotes:['Cobertura, plano, ativação da unidade e acessórios precisam de confirmação; não inferimos assinatura incluída.', 'Velocidade, estabilidade, uso em movimento e conteúdo do kit não foram verificados pela equipe.'],
    suppressRating:true,
  }],
  ['SctMie0hqocPmrWupQLO', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB5254673406',
    model:/^ro[cç]adeira.*(?:the\s*black\s*tools|bro\s*520)/i,
    correct:'Roçadeira The Black Tools BRO520 — 52 cc e kit 4 em 1 anunciados',
    summary:'O cadastro anuncia a roçadeira a gasolina The Black Tools BRO520, com motor de dois tempos e 52 cc. A página consultada da The Black Tools também declara 1,55 kW e tanque de 1200 ml; esses números não são medições da equipe. O conjunto de referência lista cabeçote de náilon e lâminas, mas a expressão 4 em 1 não comprova que todos esses itens acompanham a oferta cadastrada. Confira a lista exata, o modelo e a compatibilidade dos acessórios antes de escolher. Não importamos os óculos, luvas ou condições comerciais de outro kit. Para montagem, combustível, proteções e equipamentos de segurança, siga o manual específico do modelo; não deduzimos instruções pela cilindrada. Não testamos potência, ruído, vibração, ergonomia ou durabilidade e não prometemos uso profissional ou trabalho contínuo garantido.',
    positiveNotes:['BRO520, motor de dois tempos e 52 cc identificados no cadastro e na página de referência da The Black Tools.', 'A página de referência lista cabeçote de náilon e lâminas; confira o conteúdo do kit efetivamente vendido.'],
    negativeNotes:['Potência e capacidade são declarações da fonte, não resultados de teste; ruído, vibração, peso em uso e ergonomia não foram avaliados.', 'Conteúdo, acessórios compatíveis e instruções precisam ser confirmados no manual e na oferta; sem promessa de trabalho contínuo ou adequação profissional.'],
    contextSourceUrl:'https://theblacktools.com/produtos/rocadeira-a-gasolina-profissional-52cc-2hp-4-em-1-completa-acessorios/',
    contextSourceLabel:'The Black Tools BRO520: página de um kit de referência, sem confirmar a unidade ou todos os acessórios da oferta',
    suppressRating:true,
  }],
  ['U52A4gBWWLEmfCzONtHb', {
    syncInformationalSchema:true,
    model:/^fone.*(?:bluetooth|pro\s*phone\s*see)/i,
    expectedListing:'MLB5105857793',
    correct:'Fone PRO PHONE SEE TWS — Bluetooth 5.3 anunciado; proteção e ANC a confirmar',
  }],
  ['cjtpmssewHcTpdqJlbS6', {
    syncInformationalSchema:true,
    model:/^(?:tablet\s+)?positivo\s+vision\s+tab\s*10\b.*\bt3010\b/i,
    correct:'Tablet Positivo Vision TAB10 T3010 — 4 GB de RAM e 128 GB de armazenamento',
    summary:'O cadastro anuncia o Positivo Vision TAB10 T3010 com 4 GB de RAM, 128 GB de armazenamento e capa com teclado. Na referência da loja Positivo para o kit Vision Tab 10, o armazenamento é descrito como NAND; não tratamos os 128 GB como um SSD de notebook. A página também informa tela de 10,1 polegadas, Android 13 e bateria de 6000 mAh. São características declaradas, não garantia de velocidade ou horas de uso. A capa com teclado pode interessar a quem prefere digitar nesse formato, mas confirme os itens incluídos na oferta e os requisitos dos seus aplicativos. Não testamos multitarefa, teclado, conexão móvel, desempenho ou autonomia e não prometemos compatibilidade com todo programa de computador. Confira o modelo e a versão da unidade antes de comprar.',
    positiveNotes:['4 GB de RAM e 128 GB de armazenamento identificados no cadastro e na referência da linha; o kit oficial inclui capa com teclado.'],
    negativeNotes:['128 GB são descritos como armazenamento NAND na referência oficial, não como SSD de notebook.', 'Autonomia, desempenho, teclado e compatibilidade com aplicativos não foram testados; confira o modelo e o kit da oferta.'],
    contextSourceUrl:'https://loja.meupositivo.com.br/tablet-positivo-vision-tab-10-capa-teclado-4gb-128gb-5-13mp-6000mah-tela-10-1-hd-wifi-ac-4g-preto-3801470/p',
    contextSourceLabel:'Loja Positivo Vision Tab 10 com capa teclado: referência da linha, sem autenticar a unidade da oferta',
    suppressRating:true,
  }],
  ['DlFv98xnrCPIAeFfbRFv', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    model:/^(?:fone\s+pro\s*phone\s*see\b|fone\s+ouvido.*\bpro\s*phone\s*see\b)/i,
    expectedListing:'MLB5758097762',
    correct:'Fone PRO PHONE SEE — Bluetooth 5.4 anunciado; ANC e resistência a confirmar',
  }],
  ['FWRyLtto1bKeKurNikKq', {
    syncInformationalSchema:true,
    model:/^(?:fone\s+)?forestory\b.*\bx5\b/i,
    expectedListing:'MLB4840111509',
    correct:'Fone FORESTORY X5 — Bluetooth 5.3, formato e autonomia a confirmar',
  }],
  ['mlMLB5212483469', {
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    model:/^(?:notebook\s+)?lenovo\b.*\bideapad\b.*\b83ns0003br\b/i,
    expectedListing:'MLB5759767112',
    correct:'Lenovo IdeaPad Slim 3 15IRH10 83NS0003BR — configuração a conferir na oferta',
    summary:'O título e o endereço original cadastrados identificam o Lenovo IdeaPad Slim 3 15IRH10, código 83NS0003BR. A descrição antiga falava de um ThinkPad X13 G1 recondicionado, com outra memória e outro processador; esses dados não foram combinados com a ficha do IdeaPad. A referência de fábrica já registrada para o código 83NS0003BR informa Core i5-13420H, 8 GB de RAM e SSD de 256 GB, mas não autentica a unidade anunciada nem confirma mudanças feitas pelo vendedor. Confira o SKU, o conjunto, a condição do produto e o destino do link antes de comprar. Não classificamos o IdeaPad como recondicionado com base no texto antigo. Não testamos desempenho, tela, bateria ou durabilidade e não transferimos a configuração do código 83NS0002BR.',
    positiveNotes:['Referência de fábrica específica do código 83NS0003BR já registrada, com 8 GB de RAM e SSD de 256 GB; confirme o SKU da oferta.'],
    negativeNotes:['Havia descrição de outro modelo no cadastro; não usamos os dados do ThinkPad para caracterizar este IdeaPad.', 'Condição da unidade, alterações do vendedor e correspondência final da oferta precisam de confirmação; desempenho não foi testado.'],
    suppressRating:true,
  }],
  ['w4grNjrGMy69omEzW0QP', {
    syncInformationalSchema:true,
    model:/^perfume(?:\s+[aá]rabe)?\s+maison\s+salem\s+nayef\b/i,
    summary:'O Maison Salem Nayef é apresentado pela marca como Eau de Parfum de 100 ml, classificado no catálogo como oriental amadeirado. A página específica lista bergamota da Calábria e almíscar na saída, gerânios no coração e benjoim, bálsamo do Peru e madeira guaiac na base. Esse perfil serve como referência de escolha, não como garantia de que a fragrância vai agradar na sua pele. As notas são descrições da marca, não uma análise laboratorial da fórmula. O texto promocional do catálogo cita notas que não aparecem nessa pirâmide; usamos a página específica como referência, sem completar ou combinar as listas. Não testamos fixação, projeção, tolerância ou semelhança com outro perfume e não autenticamos a unidade anunciada. Confira volume, lote, rótulo e condições do anúncio antes de comprar.',
    positiveNotes:['Nayef EDP de 100 ml identificado na página da marca; família oriental amadeirada declarada no catálogo.'],
    negativeNotes:['Notas olfativas declaradas não comprovam a composição da fórmula, autenticidade ou resultado na sua pele.', 'Fixação, projeção e tolerância não testadas; não prometemos duração nem equivalência a outro perfume.'],
    contextSourceUrl:'https://maisonsalem.com.br/produtos/perfume-maison-salem-nayef-edp-100ml',
    contextSourceLabel:'Maison Salem Nayef EDP 100 ml: descrição da marca, sem autenticar a unidade da oferta',
    suppressRating:true,
  }],
  ['sZGVRAGBdFaBYSOQbSO8', {
    syncInformationalSchema:true,
    model:/^teclado.*mec[aâ]nico.*abnt2.*switch\s*red/i,
    correct:'Teclado mecânico ABNT2 anunciado com switch red — iluminação a conferir',
    summary:'O cadastro anuncia um teclado mecânico ABNT2 com switch red. O título menciona RGB, enquanto a descrição usa Rainbow; não confirmamos o tipo de iluminação nem seus ajustes. As expressões silencioso e impermeável também aparecem sem documentação específica registrada nesta revisão, por isso não são apresentadas como garantias. Antes de escolher, confira a marca, o modelo, o layout das teclas, a conexão e a compatibilidade com seu sistema no anúncio e no manual. Não presumimos funcionamento sem ruído ou resistência a líquidos e não testamos digitação, switches, iluminação ou durabilidade. Recursos de um teclado parecido não foram usados para completar esta ficha.',
    positiveNotes:['Layout ABNT2 e switch red identificados no cadastro; confirme o modelo e a disposição das teclas no anúncio.'],
    negativeNotes:['Iluminação a confirmar: o título menciona RGB e a descrição usa Rainbow.', 'Silêncio e resistência a líquidos não comprovados; conexão, compatibilidade e especificações exigem confirmação do modelo.'],
    suppressRating:true,
  }],
  ['SFcayTGVGtzWrkpt4uFw', {
    syncInformationalSchema:true,
    model:/^t[eê]nis\s+(?:puma\s+)?rbd\s*game\s*low(?:\s+puma)?$/i,
    summary:'O cadastro identifica o tênis PUMA RBD Game Low. A PUMA apresenta essa linha como casual, com visual retrô inspirado no basquete; essa inspiração não comprova adequação a jogos ou corrida. É uma opção para considerar se você procura esse estilo no dia a dia, mas o ajuste depende do seu pé e da numeração. A referência oficial consultada é a 391759_07: não confirmamos que esse é o código da unidade anunciada. Por isso, não transferimos materiais, palmilha, cor, peso ou medidas dessa variante para a oferta. Confira o código, a tabela de medidas e as condições de troca no anúncio. Não testamos conforto, aderência, amortecimento ou durabilidade e a referência de linha não autentica a unidade.',
    positiveNotes:['Linha RBD Game Low apresentada pela PUMA como casual, com visual retrô inspirado no basquete.'],
    negativeNotes:['Código e características da unidade anunciada não confirmados; não copiamos especificações de outra variante.', 'Conforto, aderência e durabilidade não foram testados; inspiração no basquete não confirma desempenho esportivo.'],
    contextSourceUrl:'https://br.puma.com/pd/tenis-rbd-game-low/391759.html',
    contextSourceLabel:'PUMA RBD Game Low 391759_07: contexto da linha, sem confirmar a variante da oferta',
    suppressRating:true,
  }],
  ['hC5H8O2mjGMYXFMH5jic', {
    syncInformationalSchema:true,
    model:/^(?:celular.*positivo.*s675|positivo.*s675)/i,
    correct:'Positivo S675 — 4 GB de RAM e 128 GB anunciados',
  }],
  ['kiQqRnm6rDj50U2HaOb3', {
    syncInformationalSchema:true,
    model:/^projetor.*(?:hy\s*320.*hardline|hardline.*hy\s*320)/i,
    correct:'Projetor anunciado como Hardline HY320 — resolução e brilho a conferir',
    category:'informatica',
    summary:'O cadastro anuncia um projetor Hardline HY320 com Android, Wi-Fi, Bluetooth, alto-falante e controle remoto. O título anterior informava Full HD e 390 ANSI, mas a descrição registrava apenas 1280 no campo de resolução nativa, sem a medida completa. O tamanho de imagem também aparece de formas diferentes entre título e descrição. Não escolhemos uma resolução, brilho ou tamanho como confirmado. Antes de decidir, confira o código da unidade, a resolução nativa, os sinais aceitos, o brilho documentado, as conexões e a alimentação no manual e no anúncio. Não usamos a ficha de outro HY320 de marca ou revisão diferente para preencher essas lacunas. Android anunciado não é confirmação de funcionamento de cada aplicativo ou serviço; não testamos streaming, imagem, ruído ou brilho deste aparelho.',
    positiveNotes:['Projetor anunciado como Hardline HY320, com conectividade e controle remoto descritos no cadastro; confirme a unidade e o kit.'],
    negativeNotes:['Resolução nativa, brilho e tamanho de projeção não confirmados: há campos incompletos ou divergentes no cadastro.', 'Versão do sistema, conexões, alimentação e serviços compatíveis precisam de confirmação; não copiamos dados de outro HY320.'],
    suppressRating:true,
  }],
  ['DjihMK3g3rkBHHTPbOwp', {
    syncInformationalSchema:true,
    model:/^(?:principia.*kit.*limpeza.*hidrata|kit.*limpeza.*hidrata.*principia)/i,
    expectedListing:'MLB4247892213',
    summary:'O anúncio identifica um kit Principia de limpeza e hidratação com os códigos CH-01, OL-01 e GL-02. No catálogo da marca, esses códigos identificam creme hidratante, óleo de limpeza e gel de limpeza, respectivamente. Essa referência ajuda a reconhecer as linhas, mas não confirma volumes, formulação ou conteúdo da oferta específica. As expressões todo tipo de pele, dia/noite e idade acima de 14 anos do cadastro não são usadas aqui como orientação individual de uso. Confira os produtos e as instruções nos rótulos da unidade e no anúncio, sem substituir componentes por outro kit de nome parecido. Não testamos tolerância, resultados ou autenticidade da unidade e não montamos uma rotina personalizada; em caso de dúvida individual, procure orientação profissional.',
    positiveNotes:['Kit anunciado com os códigos CH-01, OL-01 e GL-02, distinguindo as linhas de hidratação e limpeza.'],
    negativeNotes:['Volumes, composição e itens efetivamente incluídos precisam de confirmação no anúncio e nos rótulos.', 'Não confirmamos adequação individual, faixa etária, tolerância ou resultados; a referência de catálogo não autentica a unidade.'],
    contextSourceUrl:'https://www.principiaskin.com/monte-seu-kit.html',
    contextSourceLabel:'Catálogo PRINCIPIA: identificação das linhas, não validação desta oferta',
    suppressRating:true,
  }],
  ['gpeMPTTE5kt9e7kYc0MC', {
    syncInformationalSchema:true,
    model:/^t[eê]nis.*torx.*ultra\s*max/i,
    correct:'Tênis Torx Ultra Max laranja — peso e versão a conferir',
    summary:'O cadastro anuncia um tênis Torx Ultra Max laranja para corrida. A TORX descreve placa TPU-PA na linha Ultra Max; isso é uma declaração do fabricante sobre a construção, não comprovação de melhora de desempenho para cada pessoa. O peso de 220 g informado no título anterior não foi confirmado para a numeração e a versão desta oferta. Também não transferimos drop, materiais ou outras especificações de uma página de outra variante: confira o código, o tamanho e a etiqueta da unidade com o vendedor. A referência de linha não autentica o calçado anunciado. Não testamos ajuste, amortecimento, aderência, durabilidade ou economia de esforço e não prometemos ganho de velocidade.',
    positiveNotes:['Linha Ultra Max anunciada para corrida; cor laranja identificada no cadastro.', 'Placa TPU-PA descrita pela TORX como contexto da linha; confirme a construção da variante oferecida.'],
    negativeNotes:['Peso de 220 g, numeração e especificações da unidade precisam ser confirmados; não copiamos dados de outra variante.', 'Ajuste, desempenho, aderência e autenticidade não foram verificados nesta revisão.'],
    contextSourceUrl:'https://www.torxbrasil.com.br/produto/tenis-torx-ultra-max-preto-laranja/',
    contextSourceLabel:'TORX Ultra Max Preto Laranja: referência de linha, sem confirmar a variante da oferta',
    suppressRating:true,
  }],
  ['28xGyV66fEYlx6CnRxIq', {
    syncInformationalSchema:true,
    model:/^(?:vara.*pesca|kit.*pesca.*vara)/i,
    correct:'Kit de pesca verde com vara e carretilha — medidas a conferir',
    summary:'O cadastro anuncia um kit de pesca verde com vara, carretilha, linha e acessórios. O título anterior mencionava 180 m, enquanto a descrição informava 1,80 m para a vara. A medida precisa de confirmação: não publicamos 180 m como comprimento comprovado nem escolhemos 1,80 m por suposição. Material em fibra de carbono, ação leve e guias de cerâmica também apareciam no texto sem documentação específica registrada nesta revisão, por isso não são tratados como vantagens verificadas. Confira o modelo, o comprimento, os materiais, as especificações de uso e a lista exata de peças do kit no anúncio e no manual. Não testamos resistência, arremesso, montagem ou compatibilidade dos componentes.',
    positiveNotes:['Kit verde com vara e carretilha identificado no anúncio; confira linha, acessórios e conteúdo da embalagem.'],
    negativeNotes:['Comprimento a confirmar: título e descrição apresentavam medidas diferentes.', 'Material, ação, guias e compatibilidade das peças não foram comprovados por documentação específica ou teste.'],
    suppressRating:true,
  }],
  ['7W5TZBLUNQOGfenrgEtg', {
    syncInformationalSchema:true,
    model:/^kit.*body\s*splash.*(?:masculino|yllenot)/i,
    correct:'Kit de body splash masculino anunciado como Yllenot — volumes a conferir',
    summary:'O cadastro anuncia um kit de body splash masculino como Yllenot. O título anterior mencionava três unidades de 200 mL, mas o campo volume da unidade informava 600 mL. Não assumimos que esse campo represente o total do conjunto nem o volume de cada frasco; confirme quantidade, volumes e variantes no anúncio e nos rótulos. As alegações de produto vegano e livre de crueldade animal constavam no anúncio, mas não foram verificadas nesta revisão. Não autenticamos a unidade ou a composição, não testamos fragrância, fixação ou tolerância na pele e não garantimos semelhança com outro perfume. Confira a identificação dos frascos, os ingredientes e as condições do vendedor antes de decidir.',
    positiveNotes:['Kit masculino anunciado como Yllenot; confirme os frascos e as variantes incluídas.'],
    negativeNotes:['Quantidade e volume de cada frasco precisam ser conferidos: título e campo de volume não são inequívocos.', 'Atributos vegano/livre de crueldade, composição e autenticidade não foram verificados; fragrância, fixação e tolerância não foram testadas.'],
    suppressRating:true,
  }],
  ['1RCE8RtBHkc6aVkKZ6xB', {
    syncInformationalSchema:true,
    model:/^t[eê]nis.*new\s*speed/i,
    correct:'Tênis masculino anunciado como New Speed — caminhada',
    summary:'O cadastro anuncia um tênis masculino como New Speed para caminhada. A expressão 100% original do título anterior não é usada como comprovação de autenticidade: não verificamos a procedência da unidade. Antes de escolher, confira a identificação na etiqueta, a tabela de medidas, os materiais e as condições de troca com o vendedor. A finalidade anunciada não comprova ajuste, amortecimento, aderência ou adequação ao seu uso. Não testamos conforto, durabilidade ou desempenho deste calçado e não presumimos recursos de outro modelo da marca.',
    positiveNotes:['Tênis masculino anunciado como New Speed para caminhada; confira a identificação da unidade.'],
    negativeNotes:['Autenticidade e procedência não verificadas nesta revisão.', 'Medidas e materiais precisam de confirmação; ajuste, amortecimento e aderência não foram testados.'],
    suppressRating:true,
  }],
  ['BhacwzAPIbDglRkNCoyz', {
    syncInformationalSchema:true,
    model:/^(?:fones?|fone[s]? esportivo).*miniso.*x15\s*pro/i,
    correct:'Fones anunciados como MINISO X15 Pro — recursos a conferir',
  }],
  ['zpNUAIiuFr5Eo0TbkaKm', {
    syncInformationalSchema:true,
    model:/^s[eé]rum.*(?:ghk[\s-]*cu.*zencial|zencial.*ghk[\s-]*cu)/i,
    correct:'Sérum anunciado como Zencial GHK-Cu + Colágeno — 30 mL',
    summary:'O cadastro anuncia um sérum facial Zencial identificado como GHK-Cu + Colágeno em frasco de 30 mL. Nome e apresentação são informações do anúncio, não análise do conteúdo do frasco. Não confirmamos bioestimulação, ação anti-idade ou adequação para todo tipo de pele a partir desse texto. Composição, concentrações, advertências, procedência e instruções precisam ser conferidas no rótulo da unidade. Não indicamos frequência de aplicação, combinação com outros produtos ou adequação individual, nem confirmamos regularidade ou autenticidade deste lote. Não testamos efeitos ou tolerância na pele. Se houver dúvida sobre o uso individual, procure orientação profissional.',
    positiveNotes:['Sérum facial anunciado como Zencial GHK-Cu + Colágeno, em apresentação de 30 mL.'],
    negativeNotes:['Composição, concentrações e benefícios não foram comprovados nesta revisão.', 'Não há confirmação de adequação para todo tipo de pele, procedência ou regularidade do lote; confira o rótulo da unidade.'],
    suppressRating:true,
  }],
  ['UxB7AJhrBhm36FCTachh', {
    syncInformationalSchema:true,
    model:/^patinete.*infantil.*(?:3|tr[eê]s).*rodas/i,
    correct:'Patinete infantil de três rodas com LED — características a conferir',
    category:'brinquedos',
    summary:'O cadastro anuncia um patinete infantil de três rodas com luzes LED e marca genérica. A categoria anterior de patinetes elétricos não está sustentada pelos dados disponíveis: luzes LED, por si só, não confirmam propulsão elétrica. Esta ficha é apresentada entre brinquedos, sem afirmar que o modelo tem ou não motor. O título anterior mencionava 40 kg, mas não há manual específico registrado nesta revisão para confirmar a carga admitida; o peso do produto não deve ser confundido com a capacidade de carga. Antes de escolher, confira modelo, dimensões, faixa etária, carga máxima, ajuste, montagem e orientações de uso e supervisão no manual e com o vendedor. Não testamos estabilidade, freio, resistência ou segurança deste patinete.',
    positiveNotes:['Formato infantil de três rodas e luzes LED anunciados no cadastro; confira a unidade oferecida.'],
    negativeNotes:['Propulsão e carga admitida não confirmadas por documentação específica; 40 kg não é tratado como limite verificado.', 'Faixa etária, dimensões, montagem e orientações de uso precisam de confirmação no manual; não houve teste de segurança.'],
    suppressRating:true,
  }],
  ['M0Zj2K84Q8PX0YTQMIHz', {
    syncInformationalSchema:true,
    model:/^smartwatch.*novante/i,
    correct:'Smartwatch Novante — recursos conforme o anúncio',
  }],
  ['Q89e0KvH53UoCpELiwiW', {
    syncInformationalSchema:true,
    model:/^t[eê]nis.*asics.*trabuco.*terra\s*3/i,
    correct:'Tênis ASICS Trabuco Terra 3 feminino — trilha',
    summary:'O cadastro anuncia um tênis ASICS Trabuco Terra 3 feminino para trilha. A palavra Escalada do título anterior não é usada como indicação técnica comprovada: a referência oficial da ASICS consultada apresenta a linha na categoria de corrida em trilha, não demonstra adequação da unidade a escalada. Essa referência de contexto não autentica o calçado anunciado nem confirma cor, código, numeração ou materiais da variante. Antes de escolher, confira a etiqueta, a tabela de medidas, o solado, a finalidade de uso e as condições de troca com o vendedor. Não testamos ajuste, aderência, amortecimento ou durabilidade e não prometemos desempenho ou proteção contra quedas.',
    positiveNotes:['Modelo Trabuco Terra 3 feminino e uso em trilha identificados no anúncio; confirme a variante oferecida.'],
    negativeNotes:['Aptidão para escalada não comprovada nesta revisão.', 'Variante, medidas, materiais e procedência precisam de confirmação; desempenho e conforto não foram testados.'],
    suppressRating:true,
  }],
  ['7QHXFlimzdpfKr7yfo0T', {
    syncInformationalSchema:true,
    model:/^t[eê]nis.*(?:feminino.*olimp|olimp.*feminino)/i,
    correct:'Tênis feminino anunciado como Olimp — caminhada e academia',
    summary:'O anúncio cadastrado apresenta um tênis feminino como Olimp para caminhada e academia, enquanto o campo de marca informa Vili. Essa identificação precisa ser conferida na etiqueta e no anúncio: não tratamos Olimp como Olympikus nem confirmamos a marca da unidade. Retiramos a palavra Promoção do título porque esta é uma ficha informativa sem acompanhamento de preços. Antes de escolher, confira a tabela de medidas do vendedor, os materiais, o tipo de solado e as condições de troca. Não testamos ajuste, amortecimento, aderência ou durabilidade e não indicamos este modelo para uma atividade específica apenas pelo nome comercial.',
    positiveNotes:['Tênis feminino anunciado para caminhada e academia; identificação comercial preservada como declaração do anúncio.'],
    negativeNotes:['Título e campo de marca usam identificações diferentes; confira a etiqueta antes de decidir.', 'Ajuste, amortecimento, aderência e durabilidade não foram testados; medidas e materiais precisam de confirmação.'],
    suppressRating:true,
  }],
  ['8a8Iat0nPiQxNPVcJqTU', {
    syncInformationalSchema:true,
    model:/^t[eê]nis.*reserva.*masculino.*casual/i,
    correct:'Tênis Reserva masculino casual de cano baixo — características a conferir',
    summary:'O cadastro anuncia um tênis masculino casual de cano baixo como Reserva. A marca é informação do anúncio; não autenticamos a unidade. Retiramos Antiderrapante do título público como característica comprovada, pois esta revisão não dispõe de teste ou documentação específica de aderência do modelo. Para decidir, confira o código do produto, a tabela de medidas, os materiais e as condições de troca com o vendedor. Não deduzimos conforto, durabilidade, uso esportivo ou proteção contra escorregões a partir da foto ou do nome comercial, e não testamos este calçado.',
    positiveNotes:['Modelo masculino casual de cano baixo identificado no cadastro como Reserva.'],
    negativeNotes:['Aderência e propriedade antiderrapante não comprovadas nesta revisão.', 'Código, materiais, medidas e procedência precisam ser conferidos na unidade anunciada.'],
    suppressRating:true,
  }],
  ['iw5yKjD39u1kQ8Vm8ybv', {
    syncInformationalSchema:true,
    model:/^carregador.*200\s*w/i,
    correct:'Carregador USB-C anunciado como 200 W — potência a confirmar',
    summary:'O cadastro anuncia um carregador USB-C como 200 W e bivolt, com cabo incluído, e informa saída de 5 V. Esses dados, sozinhos, não comprovam a potência anunciada nem a compatibilidade de carregamento rápido com cada aparelho listado anteriormente. Não confirmamos nesta revisão o modelo, os perfis de saída, o cabo ou a documentação elétrica da unidade. Antes de comprar, confira a etiqueta, as saídas e conexões especificadas, o conteúdo da embalagem e as exigências do fabricante do seu aparelho. Não apresentamos a lista genérica de celulares como compatibilidade verificada, não garantimos 200 W e não testamos velocidade de carga ou segurança elétrica.',
    positiveNotes:['Conexão USB-C, alimentação bivolt e cabo incluído anunciados no cadastro; confira a unidade e o conteúdo da caixa.'],
    negativeNotes:['Potência de 200 W e compatibilidade de carga rápida não confirmadas por documentação específica.', 'Modelo, perfis de saída, cabo e documentação elétrica devem ser conferidos antes do uso; não houve teste de segurança ou desempenho.'],
    suppressRating:true,
  }],
  ['mlMLB4222763449', {
    syncInformationalSchema:true,
    model:/sanduicheira.*inox.*multiuso.*oster/i,
    summary:'O cadastro anuncia uma Sanduicheira Inox Multiuso Oster. Para escolher a unidade, confira o código do modelo e a tensão no anúncio e na etiqueta: o nome comercial, sozinho, não confirma a versão elétrica. A descrição anterior apresentava resistência do material e preparo de carnes e legumes sem documentação específica da unidade. Por isso, não usamos essas alegações como vantagens comprovadas nem copiamos potência, dimensões ou recursos de outra versão Oster. Confira os preparos permitidos e os cuidados de limpeza no manual do modelo comprado. Não testamos aquecimento, durabilidade ou desempenho deste aparelho.',
    positiveNotes:['Sanduicheira Oster identificada pelo nome comercial no cadastro; confira a unidade oferecida.'],
    negativeNotes:['Código do modelo, tensão e recursos da unidade precisam de confirmação no anúncio e no manual.', 'Não foram testados desempenho, durabilidade ou facilidade de limpeza.'],
    suppressRating:true,
  }],
  ['mlMLB5259893582', {
    syncInformationalSchema:true,
    model:/complexo\s*b.*(?:ultra|vegano).*bigens/i,
    summary:'O cadastro anuncia um suplemento Complexo B Ultra Bigens em gotas, frasco de 30 mL e sabor frutas amarelas. Essas são informações do anúncio, não confirmação independente do conteúdo do frasco. Removemos as promessas de alta absorção, energia, bem-estar e benefícios à saúde mental ou imunológica: esta ficha não apresenta comprovação específica para esses resultados. Confira no rótulo a composição, as quantidades por porção, as advertências, o fabricante e as condições de conservação. Não confirmamos fórmula, adequação individual, regularidade ou autenticidade deste lote, não prometemos prevenção ou tratamento de doenças e não orientamos dose. Procure um profissional de saúde para avaliar a necessidade individual.',
    positiveNotes:['Apresentação em gotas, volume de 30 mL e sabor frutas amarelas anunciados no cadastro.'],
    negativeNotes:['Composição, quantidades e advertências precisam ser conferidas no rótulo da unidade.', 'Não há comprovação específica de benefícios à saúde nesta revisão; não indicamos dose ou adequação individual.'],
    suppressRating:true,
  }],
  ['4qfOr9o2qNFtHLcRZzRC', {
    syncInformationalSchema:true,
    model:/lixeira.*(?:autom[aá]tica|inteligente).*sensor/i,
    summary:'O cadastro anuncia uma lixeira redonda com abertura automática por sensor e recarga USB-C, identificada como Correia na cor preta. A descrição anterior informava tanto 15 L quanto 16 L; a capacidade permanece a confirmar, sem escolher um dos valores por suposição. Também não verificamos o alcance anunciado de 30 cm, a autonomia ou resistência à umidade. Antes de escolher, confira a capacidade útil, as dimensões externas, o espaço necessário para abrir a tampa, a alimentação e os acessórios no anúncio e no manual. Não testamos sensor, recarga, vedação ou uso em áreas úmidas.',
    positiveNotes:['Abertura por sensor e recarga USB-C anunciadas no cadastro; confirme a unidade oferecida.'],
    negativeNotes:['Capacidade a confirmar: o texto anterior divergia entre 15 L e 16 L.', 'Alcance do sensor, autonomia, acessórios e resistência à umidade não verificados nesta revisão.'],
    suppressRating:true,
  }],
  ['CqcFkZIu8ozeDLwRHAEG', {
    syncInformationalSchema:true,
    model:/^caixa.*som.*(?:port[aá]til.*)?inova/i,
    correct:'Caixa de som portátil anunciada como Inova — modelo a confirmar',
    summary:'O cadastro anuncia uma caixa de som portátil Inova, recarregável, com Bluetooth, RGB e TWS. Não foi identificado nesta revisão um código exato de modelo ou manual que permita confirmar as alegações de IP67, flutuação, alimentação 127/220 V, Bluetooth 5.4, alcance de 25 m e reprodução de 12 horas. Esses campos não são apresentados como recursos verificados. Confira etiqueta, modelo, alimentação e documentação da unidade no anúncio. Não copiamos especificações de outra caixa semelhante e não testamos proteção, alcance ou autonomia.',
    positiveNotes:['Bluetooth, iluminação RGB, TWS e recarga anunciados no cadastro.'],
    negativeNotes:['Modelo e documentação a confirmar; proteção, flutuação e alimentação não foram verificadas.', 'Não garantimos horas de reprodução, alcance ou uso externo com base nos campos genéricos do anúncio.'],
    suppressRating:true,
  }],
  ['u8AujPhW3B7Z3N0aF6VS', {
    syncInformationalSchema:true,
    model:/^cadeira.*dobr[aá]vel.*(?:camping|pesca)/i,
    correct:'Cadeira dobrável para camping com porta-copo — carga a confirmar',
    summary:'O cadastro apresenta uma cadeira dobrável para camping, pesca e lazer, com apoio de braços, porta-copo e bolsa de transporte anunciados. O título informa carga de até 120 kg, mas esse limite não foi confirmado por documentação específica ou teste nesta revisão. Não garantimos resistência, estabilidade ou adequação a qualquer piso pelo nome comercial. Confira identificação da unidade, medidas, montagem e limite de carga com o fornecedor antes de escolher.',
    positiveNotes:['Formato dobrável, porta-copo e bolsa de transporte descritos no cadastro.'],
    negativeNotes:['Carga máxima a confirmar para a unidade; os 120 kg são uma declaração do título.', 'Resistência e estabilidade não foram testadas; confira montagem e condições de uso.'],
    suppressRating:true,
  }],
  ['eJn1Xl8uCPLxKCObXB6r', {
    syncInformationalSchema:true,
    model:/^caixa.*som.*basike.*(?:ba[- ]?rad207|rad207)/i,
    correct:'Caixa de som Basike BA-RAD207 — potência e bateria anunciadas',
    summary:'O cadastro identifica a Basike BA-RAD207 e anuncia potência de 80 W, bateria de 9000 mAh, Bluetooth 5.3, rádio FM, TWS, RGB e Bass Boost. Esses dados são declarações do cadastro, não resultados de medição. A capacidade em mAh não foi convertida em horas de uso, nem usada para prometer autonomia prolongada. Não testamos volume, cobertura em ambientes amplos, estabilidade da conexão ou funcionamento das luzes. Confira modelo, recursos e documentação da unidade no anúncio.',
    positiveNotes:['Rádio FM, Bluetooth, TWS e iluminação RGB anunciados no cadastro.'],
    negativeNotes:['Potência e bateria não foram medidas; não garantimos cobertura ou horas de uso a partir desses números.', 'Não foram testados som, conexão ou comportamento das luzes; não inventamos limitações específicas sem evidência.'],
    suppressRating:true,
  }],
  ['XWXtgVSsCBCwOtcMCdO3', {
    syncInformationalSchema:true,
    model:/^caixa.*som.*jbl.*go\s*5.*amarela/i,
    correct:'Caixa de som anunciada como JBL Go 5 amarela — modelo a confirmar',
    summary:'O cadastro anuncia uma caixa de som amarela como JBL Go 5, mas não confirmamos nesta revisão o código exato da unidade ou o manual aplicável. Por isso, não prometemos pareamento rápido nem afirmamos ausência de recursos avançados com base no texto genérico anterior. Confira etiqueta, modelo e descrição da unidade no anúncio. Não aplicamos especificações de outras gerações JBL Go e não testamos som, conexão ou autonomia.',
    positiveNotes:['Cor amarela identificada no cadastro; confira a unidade oferecida.'],
    negativeNotes:['Identificação exata e recursos a confirmar; não copiamos especificações de outro JBL Go.', 'Não testamos pareamento, áudio ou autonomia, nem autenticamos o produto nesta revisão.'],
    suppressRating:true,
  }],
  ['vEHXKQ4q4UbcFfjPhtTa', {
    syncInformationalSchema:true,
    model:/^(?:caixa.*som.*philco.*pbx01|philco.*pbx01)/i,
    correct:'Philco Extreme PBX01 — potência anunciada de 300 W',
    summary:'O cadastro identifica uma caixa de som Philco Extreme PBX01 e anuncia potência de 300 W e Bluetooth 5.4. Esses dados não foram medidos ou confirmados em documentação específica nesta revisão. Não usamos watts como medida de volume sonoro nem afirmamos que a caixa supera 300 W ou modelos de entrada sem teste comparativo. Confira identificação, potência declarada, conexões e condições de uso da unidade no anúncio. Não testamos volume, cobertura, estabilidade da conexão ou autonomia.',
    positiveNotes:['Modelo PBX01 e conectividade Bluetooth identificados no cadastro.'],
    negativeNotes:['Potência anunciada não é medição de volume ou prova de superioridade sobre outra caixa.', 'Não foram testados som, alcance, conexão ou autonomia; confira a documentação da unidade.'],
    suppressRating:true,
  }],
  ['NmI6KXBT8ibSc1r5Fwqy', {
    syncInformationalSchema:true,
    model:/^(?=.*1\s*:\s*20)(?=.*d[- ]?342)(?:brastoy.*escavadeira|escavadeira.*brastoy)/i,
    summary:'O cadastro apresenta uma escavadeira de controle remoto Brastoy D342, em escala anunciada de 1:20, com 11 canais, cabine rotativa e esteiras descritas como de borracha. O título também anuncia duas baterias; confira o conteúdo do conjunto e a alimentação do controle. Não testamos movimentos, alcance, autonomia ou resistência em ambientes externos. Faixa etária e instruções de uso precisam ser conferidas na identificação da unidade. Não avaliamos nem garantimos benefícios à coordenação motora por esse brinquedo.',
    positiveNotes:['Movimentos por controle remoto, cabine rotativa e esteiras descritos no cadastro.'],
    negativeNotes:['Faixa etária, alimentação e conteúdo do conjunto precisam ser conferidos na unidade.', 'Alcance, autonomia, resistência externa e benefícios ao desenvolvimento não foram testados pela equipe.'],
    suppressRating:true,
  }],
  ['R1ZoQbG2PXeGXmYHQITH', {
    syncInformationalSchema:true,
    model:/^(?=.*150\s*kg)cadeira.*(?:executiva.*presidente|presidente.*executiva)/i,
    correct:'Cadeira executiva presidente — carga anunciada de 150 kg',
    summary:'O cadastro descreve uma cadeira executiva com encosto em tela mesh, sistema relax, apoio de cabeça removível e braços reguláveis. Informa pistão classe 3 e carga de 150 kg, mas não verificamos essa capacidade nem a documentação do conjunto; não usamos a classe anunciada do pistão como comprovação da carga da cadeira. O produto é descrito como entregue desmontado. Confira identificação, montagem e limite de carga com o fornecedor. Condições de envio e quantidade por pedido devem ser conferidas no anúncio atual. Não testamos estabilidade ou conforto.',
    positiveNotes:['Encosto em mesh, sistema relax e ajustes descritos no cadastro.'],
    negativeNotes:['Carga de 150 kg anunciada, sem teste do conjunto; classe do pistão não foi usada como comprovação.', 'Montagem, condições de envio e identificação da unidade precisam ser conferidas; estabilidade e conforto não foram testados.'],
    suppressRating:true,
  }],
  ['L7O3i93VZRAebbsssgJd', {
    syncInformationalSchema:true,
    model:/^cadeira.*(?:glorious.*marqs|marqs.*glorious)/i,
    correct:'Cadeira Glorious Marqs Home — conformidade e carga a confirmar',
    summary:'O cadastro identifica uma cadeira Glorious Marqs Home e anuncia estrutura de metal galvanizado, espuma de densidade 35, encosto mesh com reclinação de até 130 graus e apoios de cabeça e lombar ajustáveis. A carga de 180 kg e a referência NR17 do título não foram verificadas nesta revisão por documentação específica da unidade. Não apresentamos essa referência comercial como comprovação de conformidade nem garantimos adequação individual. Confira identificação, documentação, montagem, ajustes e limite de carga com o fornecedor. Não testamos estabilidade, conforto ou resistência.',
    positiveNotes:['Ajustes de cabeça, lombar e reclinação descritos no cadastro.'],
    negativeNotes:['Conformidade e carga máxima a confirmar por documentação da unidade; o título não foi tratado como comprovação.', 'Não testamos estabilidade, resistência ou conforto e não garantimos adequação individual.'],
    suppressRating:true,
  }],
  ['mlMLB4467674377', {
    syncInformationalSchema:true,
    model:/^bota.*(?:coturno|botina).*caterpillar/i,
    correct:'Bota coturno anunciada como Caterpillar, com palmilha',
    summary:'O cadastro apresenta uma bota coturno anunciada como Caterpillar, com palmilha, cor preta e código de catálogo MLBU3776969793. O material é descrito como couro no anúncio e não foi verificado nesta revisão. Confira identificação, material e numeração da unidade no anúncio antes de escolher. Não testamos conforto ou resistência.',
    positiveNotes:['Palmilha e cor preta descritas no cadastro, a conferir na unidade oferecida.'],
    negativeNotes:['Material, conforto e resistência não foram verificados pela equipe.', 'Confira identificação e numeração; o título comercial não comprova procedência.'],
    suppressRating:true,
  }],
  ['VfMW16M9t5lgB6JcDJYp', {
    syncInformationalSchema:true,
    model:/^(?=.*wct)(?=.*20\s*kg)(?:bicicleta.*spinning|spinning wct)/i,
    correct:'Spinning WCT Fitness — roda de inércia anunciada de 20 kg',
    category:'esporte-e-lazer',
    summary:'O cadastro apresenta uma bicicleta de spinning WCT Fitness e anuncia roda de inércia de 20 kg; esse valor não identifica nesta ficha o peso total do equipamento. Também descreve resistência mecânica, transmissão por correia, ajustes de assento e guidão e painel com tempo, velocidade, distância, calorias, odômetro e pulso. A carga de 120 kg é anunciada, não testada pela equipe. Confira o modelo, a montagem, os ajustes e o limite de carga na documentação da unidade. Não verificamos conforto, estabilidade ou precisão das leituras do painel.',
    positiveNotes:['Resistência mecânica, correia e ajustes de assento e guidão descritos no cadastro.'],
    negativeNotes:['Os 20 kg são anunciados para a roda de inércia, não como peso total confirmado.', 'Carga, estabilidade, ajustes e leituras do painel não foram testados pela equipe.'],
    suppressRating:true,
  }],
  ['PmWA6Y2vHwbiT6rEfc7l', {
    syncInformationalSchema:true,
    model:/^bicicleta.*spinning.*velocron.*v500/i,
    summary:'O cadastro identifica a bicicleta de spinning Velocron V500, com roda de inércia anunciada de 5 kg, resistência mecânica por botão, assento ajustável e squeeze anunciado no conjunto. Informa capacidade de 120 kg e indicação para pessoas de até 1,75 m, mas não verificamos limite de carga ou ajuste por estatura. Essa indicação do cadastro não é garantia de conforto ou adequação individual. Confira medidas e alcance dos ajustes, montagem e itens incluídos na unidade. Não testamos estabilidade ou resistência.',
    positiveNotes:['Resistência mecânica e assento ajustável descritos no cadastro.'],
    negativeNotes:['Estatura de até 1,75 m e carga de 120 kg são indicações anunciadas, não verificadas pela equipe.', 'Confira ajustes e conjunto da unidade; não garantimos conforto ou adequação a qualquer pessoa nessa altura.'],
    suppressRating:true,
  }],
  ['liYhKi9ZlLnwNTT1uvBl', {
    model:/^bicicleta.*spinning.*13\s*kg.*wct/i,
    category:'esporte-e-lazer',
  }],
  ['mlMLB7006667338', {
    model:/^body splash.*perfect pear.*wepink/i,
    category:'perfumes',
  }],
  ['5ybTTfU4uFUesMEPrTMK', {
    syncInformationalSchema:true,
    model:/^bola.*(?:futebol|society).*penalty/i,
    correct:'Bola society anunciada como Penalty — homologação a confirmar',
    summary:'O cadastro apresenta uma bola society anunciada como Penalty 8 X Gomos Termotec. Informa uma unidade, circunferência de 66 a 69 cm, peso de 420 a 450 g, revestimento em poliuretano e construção sem costura. Esses dados são declarações do cadastro, não medições ou comprovação de homologação. Não confirmamos adequação a competições oficiais por esse título nem testamos resistência, controle ou visibilidade. Confira o modelo exato, a documentação e as exigências da competição antes de escolher para essa finalidade.',
    positiveNotes:['Formato society e construção sem costura descritos no cadastro.'],
    negativeNotes:['Homologação e adequação a competições oficiais não confirmadas.', 'Medidas e peso são anunciados; resistência, controle e visibilidade não foram testados.'],
    suppressRating:true,
  }],
  ['mlMLB7688686428', {
    syncInformationalSchema:true,
    model:/^(?:bold.*homme.*body splash|body splash.*bold homme)/i,
    correct:'Body splash Bold Homme 200 ml — marca a confirmar',
    category:'perfumes',
    summary:'O título do cadastro apresenta um body splash Bold Homme de 200 ml como Barbour’s Beauty, mas a descrição informa marca Moon e código de catálogo MLBU5245269935. Não escolhemos uma marca nem tratamos esses nomes como equivalentes. Confira rótulo, fabricante e identificação da unidade no anúncio antes de escolher. O volume de 200 ml é anunciado; não verificamos composição, fixação, projeção ou procedência nesta revisão.',
    positiveNotes:['Volume de 200 ml identificado no cadastro; conferir no rótulo da unidade.'],
    negativeNotes:['Marca divergente entre título e descrição: Barbour’s Beauty e Moon, sem confirmação de equivalência.', 'Composição, fixação, projeção e procedência não foram verificadas.'],
    suppressRating:true,
  }],
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
  ['mlMLB4644707253', {syncInformationalSchema:true, expectedListing:'MLB4644707253', model:/^Lavadora Alta Pressão Compacta 1400w, 1600psi, 300l\/h$/i, summary:"A oferta identifica uma lavadora compacta Starmega anunciada com 1.400 W, 1.600 psi e 300 L/h. MLB4644707253 é o número do anúncio do vendedor, não um código de catálogo. A ficha não esclarece se a pressão e a vazão são máximas ou nominais. Confira a referência, a tensão e os acessórios da versão selecionada. Não medimos pressão, vazão ou desempenho.", positiveNotes:["Potência, pressão e vazão informadas no anúncio."], negativeNotes:["Pressão e vazão não medidas; tensão e acessórios a confirmar."],suppressRating:true,category:'ferramentas'}],
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
    syncInformationalSchema:true,
    model:/^(?:fone.*\b|)havit\b.*\btw\s*982\b(?!\s*(?:pro|plus)\b)/i,
    correct:'Fone Havit TW982 ENC Bluetooth 5.4 preto',
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
    syncInformationalSchema:true,
    allowTruncatedHeading:true,
    expectedListing:'MLB6756757832',
    model:/^(?:carregador\s*port[aá]til\s*)?power\s*bank.*20000\s*mah/i,
    correct:'Power bank Hardline 20000 mAh — potência e compatibilidade a confirmar',
    summary:'O cadastro identifica um power bank anunciado como 20.000 mAh. A potência está a confirmar: o título anterior informava 22,5 W e o resumo citava 20 W. Confirme o modelo, a potência por porta, os protocolos e o cabo necessários ao seu aparelho. Não medimos capacidade útil, velocidade de carga ou segurança elétrica e não comprovamos carregamento simultâneo de três aparelhos.',
    positiveNotes:['Capacidade nominal de 20.000 mAh informada no cadastro; não equivale à capacidade útil medida.'],
    negativeNotes:['Potência, protocolos e quantidade de saídas simultâneas precisam de confirmação no modelo oferecido.'], suppressRating:true,
  }],
  ['tqUaLEFDAafDWemxheMX', {
    model:/^(?:Pendrive 8gb Usb-c Usb 3\.0 Tipo C Otg Metal Anti Raio 2em1|Pendrive de 8 GB — USB e USB-C anunciados)$/i,
    expectedListing:'MLB5015828935',syncInformationalSchema:true,correct:'Pendrive de 8 GB — USB e USB-C anunciados',
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
  ["SJ6VQZLSc4brIArHnkRW",{syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB5298257521',model:/^(?:Piscina Inflável Grande 2,92m 4 Câmaras Com Bomba Elétrica|Piscina inflável de 2,92 m — quatro câmaras anunciadas)$/i,correct:"Piscina inflável de 2,92 m — quatro câmaras anunciadas",summary:"A oferta identifica uma piscina inflável de 2,92 m com quatro câmaras. O cadastro cita capacidade de 3.600 L, mas não esclarece o nível de enchimento usado para esse valor. O título anterior citava bomba elétrica, enquanto o endereço da oferta menciona dreno. Confirme o conteúdo do kit; a inclusão da bomba não está comprovada.",positiveNotes:[],negativeNotes:[],suppressRating:true,category:'esporte-e-lazer'}],
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
    allowTruncatedHeading:true,
    correct:'Tapete felpudo Casa Laura Enxovais 2,00 × 1,50 m — cinza',
    syncInformationalSchema:true,
    expectedListing:'MLB5337833154',
    summary:'A oferta apresenta um tapete Casa Laura Enxovais cinza de 2,00 × 1,50 m, descrito como felpudo. Composição em poliéster, pelos de aproximadamente 30 a 40 mm e base de látex são informações do cadastro, não medições ou ensaios da equipe. A base anunciada não é garantia de que a peça não deslize em qualquer piso. Confira medidas, material da base e instruções de conservação da unidade antes de escolher. Não testamos conforto, aderência, desprendimento de fibras ou durabilidade e não presumimos lavagem em máquina ou outras instruções de um tapete diferente.',
    positiveNotes:['Medida de 2,00 × 1,50 m e cor cinza identificadas na oferta.'],
    negativeNotes:['Composição, altura dos pelos e base precisam corresponder à unidade.', 'Aderência e conforto não testados; conferir conservação específica.'],
    suppressRating:true,
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
    syncInformationalSchema:true, expectedListing:'MLB1025840915',
    model: /(?:cama.*el[aá]stica.*3[,.]0?m|^Cama elástica infantil com rede — tamanho a confirmar$)/i,
    correct: "Cama elástica infantil com rede — tamanho a confirmar",
    summary: "O cadastro identifica uma cama elástica infantil com rede e menciona 3 m, mas o endereço da oferta traz referências a 3 m e 1,55 m. Isso não comprova qual tamanho o vendedor entrega. Confira a variante, as dimensões externas, a carga máxima, a faixa etária e o espaço exigido no manual. A rede não substitui a supervisão; a estrutura e a rede não foram testadas nesta ficha.",
    positiveNotes: ["Cama elástica com rede de proteção identificada no cadastro; confirme o conjunto oferecido."],
    negativeNotes: ["Dimensões e carga máxima precisam de confirmação no manual; há medida inconsistente no cadastro.", "Rede não dispensa supervisão e não foi testada pela equipe."],
    suppressRating: true,
  }],
  ["Kyw9WRrxRLj36DL50JfQ", {
    syncInformationalSchema:true, expectedListing:'MLB7351045720',
    model: /^(?:Console PlayStation 5 Slim Disk 1 TB — Astro Bot e Gran Turismo 7|PS5 Slim anunciado — edição e conteúdo do kit a confirmar)$/i,
    correct:'PS5 Slim anunciado — edição e conteúdo do kit a confirmar',
    summary: "A oferta apresenta um PlayStation 5 Slim, mas há divergência entre os dados disponíveis: o título anterior mencionava Disk, 1 TB, Astro Bot e Gran Turismo 7, enquanto a descrição identificava edição digital CFI 2114B. Essa diferença não comprova qual unidade o vendedor entrega. Confirme código completo, presença de leitor, capacidade e conteúdo da caixa na variação escolhida antes de decidir. Não tratamos os jogos ou quatro controles como incluídos sem confirmação específica; também não substituímos a edição por suposição. Pode interessar a quem procura um PS5 Slim, desde que a versão e o pacote sejam esclarecidos. Não testamos o console, não autenticamos a unidade e não verificamos procedência, condição ou garantia do vendedor nesta revisão.",
    positiveNotes: ["Oferta identificada como PS5 Slim; edição e conteúdo exatos precisam ser esclarecidos."],
    negativeNotes: ["Título com Disk/1 TB/jogos diverge da descrição digital CFI 2114B; não presumir versão.", "Leitor, capacidade, jogos e controles incluídos precisam de confirmação; unidade não testada."],
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
    syncInformationalSchema:true,allowTruncatedHeading:true,expectedListing:'MLB3982225645',model:/^(?:Webcam Camera Full Hd Zoom 1080p 360 Graus Videoconferencia Streamcam Web Cam Entrada Usb 2\.0 Com Microfone- GoodVision|Webcam GoodVision — 1080p, USB 2\.0 e microfone anunciados)$/i,correct:"Webcam GoodVision — 1080p, USB 2.0 e microfone anunciados",summary:"A oferta descreve uma webcam GoodVision com resolução de até 1080p, conexão USB 2.0 e microfone. A descrição não confirma se a menção a 360 graus se refere à rotação do suporte nem se o zoom é óptico ou digital. A ficha não testou imagem, áudio ou compatibilidade com aplicativos. Confira os requisitos do seu sistema.",positiveNotes:[],negativeNotes:[],suppressRating:true,
    category: "informatica",
    categoryReplacements: [["<span>Categoria</span>Notebook", "<span>Categoria</span>Informática"], ["\"category\":\"Notebook\"", "\"category\":\"Informática\""], ["\"name\":\"Notebook\",\"item\":\"https://rankingdacompra.com.br/melhores-notebook.html\"", "\"name\":\"Informática\",\"item\":\"https://rankingdacompra.com.br/analises.html#informatica\""], ["href=\"https://rankingdacompra.com.br/melhores-notebook.html\">Notebook</a>", "href=\"https://rankingdacompra.com.br/analises.html#informatica\">Informática</a>"]],
  }],
  ['ik7zBiCAAqDLqr9Di5Ue', {
    syncInformationalSchema:true, category:'informatica', allowTruncatedHeading:true,
    model:/^(?:Roku Streaming Stick 2025 Para Tv Hd\/fhd Controle Por Voz Preto De Voz 3ª geração 3840BR|Roku Streaming Stick 3840BR HD\/Full HD com controle por voz anunciado)$/i,
    correct:'Roku Streaming Stick 3840BR HD/Full HD com controle por voz anunciado',
    summary:'A oferta identifica o Roku Streaming Stick 3840BR para streaming em HD/Full HD, com controle por voz anunciado. Pode interessar a quem procura acesso a aplicativos em uma TV compatível; confira conexões, rede e os serviços desejados antes de escolher. O suporte da Roku distingue alimentação do dispositivo por cabo USB das pilhas do controle remoto; não apresentamos pilhas AAA como fonte de alimentação do stick. Tipo de pilhas e itens incluídos precisam ser conferidos na unidade. Assistentes de voz dependem de compatibilidade, configuração e recursos disponíveis; não garantimos integração completa com Alexa, Siri e Google Assistant apenas pelo anúncio. Não presumimos recursos de versões 4K ou Plus nem acesso gratuito a todo conteúdo. Não testamos conexão, desempenho ou comandos e não transferimos instruções elétricas de outro modelo.',
    positiveNotes:['Identificação 3840BR, HD/Full HD e controle por voz anunciados na oferta.'],
    negativeNotes:['Alimentação do stick e pilhas do controle são distintas; confirmar itens e documentação do modelo.', 'Aplicativos e comandos dependem de compatibilidade; não há garantia de todo conteúdo gratuito ou recursos 4K.'],
    contextSourceUrl:'https://support.roku.com/pt-br/article/general-setup-instructions-for-any-model',contextSourceLabel:'Suporte Roku: referência geral que distingue dispositivo e controle; conferir documentação do 3840BR',suppressRating:true,
  }],
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
    syncInformationalSchema:true,
    expectedListing:'MLB3817089255',
    model: /^creatina\b.*dark\s*lab/i,
    correct:'Creatina monohidratada Dark Lab 300 g — pureza do lote não verificada',
    summary: "O anúncio identifica creatina monohidratada Dark Lab em pote de 300 g. Confira fabricante, lote, lacre, ingredientes e procedência na embalagem recebida. Esta revisão não verificou laudos laboratoriais, percentuais de pureza nem autenticidade do lote; não usamos esses números como motivo de recomendação. Não há garantia de ganho de força ou desempenho e esta página não substitui orientação profissional.",
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
    syncInformationalSchema:true,
    model: /^impressora.*t[eé]rmica.*110\s*mm/i,
    correct:'Impressora térmica anunciada como 110 mm — Bluetooth e USB',
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
  // Preserve the pre-existing category-only repair, not the new offer copy.
  const title=String(product?.titulo||'');
  const legacyCategory=id==='SJ6VQZLSc4brIArHnkRW' && /piscina.*infl[aá]vel/i.test(title)
    ? {category:'esporte-e-lazer'} : id==='SUBPibuHNUsgB6zVTL5r' && /webcam/i.test(title)
      ? {category:'informatica'} : undefined;
  // Preserve the older cautions when the abbreviated title matches, without retitling another offer.
  const legacyCorrection=id==='tqUaLEFDAafDWemxheMX' && /pendrive.*8gb.*usb.?c/i.test(title)
    ? {summary:correction.summary,positiveNotes:correction.positiveNotes,negativeNotes:correction.negativeNotes,suppressRating:true}
    : legacyCategory;
  if (correction?.expectedListing && !matchesExistingOffer(product, correction.expectedListing)) return legacyCorrection;
  // Old safeguards (for example removing unsupported superlatives) still
  // apply when the exact current listing cannot be established. They do not
  // grant permission to attach this review's new seller-declared facts.
  if(correction?.sourceKind==='marketplace-listing' && MARKETPLACE_FIELD_REVIEWS.has(id) && !listingReviewFor(product))correction=PRE_LISTING_CORRECTIONS.get(id);
  // Um cadastro pode ser reutilizado. Nunca aplicar a ficha do modelo anterior
  // só porque o ID continua igual; a identidade atual precisa corresponder.
  if(correction?.sourceKind==='marketplace-listing' && !documentedSpecifications(product)) return undefined;
  return correction?.model && !correction.model.test(title) ? legacyCorrection : correction;
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

export function headingForCorrection(content, model) {
  const nodes = (() => {try {const j=JSON.parse(content.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i)?.[1]||'{}');return j['@graph']||[j];}catch{return [];}})();
  const heading=visibleText(content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || content.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || nodes.find(n=>n['@type']==='Product')?.name || '');
  if(!model || model.test(heading) || !/(?:…|\.{3})\s*$/.test(heading))return heading;
  const prefix=heading.replace(/(?:…|\.{3})\s*$/,'').trim().toLowerCase();
  // Only recover a truncated heading from the matching primary structured name.
  // A related-product name or a different heading must not identify this record.
  const article=nodes.find(n=>n['@type']==='Article'),product=nodes.find(n=>n['@type']==='Product');
  const full=visibleText(article?.about?.name || product?.name || '');
  return prefix && full.toLowerCase().startsWith(prefix) && model.test(full) ? full : heading;
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
      const heading = headingForCorrection(corrected, correction.allowTruncatedHeading ? correction.model : null);
      if (correction.model && !correction.model.test(heading)) continue;
      if (correction.expectedListing) {
        const sourceUrl = corrected.match(/<meta\b[^>]*name=["']rdc-offer-url["'][^>]*content=["']([^"']+)["']/i)?.[1];
        if (!sourceUrl || !matchesExistingOffer({link: sourceUrl.replace(/&amp;/g, '&')}, correction.expectedListing)) continue;
      }
      if (correction.correct) corrected = applyVerifiedTitle(corrected, correction.correct, correction.syncInformationalSchema);
      const categoryLabel = correction.publicCategoryLabel || {informatica:'Informática',carro:'Carro',bicicletas:'Bicicletas','esporte-e-lazer':'Esporte e Lazer',perfumes:'Perfumes',brinquedos:'Brinquedos'}[correction.category];
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
  const source = correction.contextSourceUrl
    ? `<p class="fine" data-editorial-context>Referência de contexto: <a href="${esc(correction.contextSourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(correction.contextSourceLabel)}</a>. Não confirma a variante ou a autenticidade da unidade anunciada e não é teste independente.</p>`
    : correction.sourceKind==='marketplace-listing' && correction.sourceUrl
    ? `<p class="fine" data-verified-listing>Fonte: <a href="${esc(correction.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(correction.sourceLabel)}</a>. Informações do anúncio do vendedor, não validação independente ou teste do produto.</p>`
    : correction.sourceUrl
    ? `<p class="fine" data-verified-manufacturer>Fonte do fabricante: <a href="${esc(correction.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(correction.sourceLabel)}</a>${correction.specUrl ? ` e <a href="${esc(correction.specUrl)}" target="_blank" rel="noopener noreferrer">ficha técnica oficial</a>` : ''}. Especificações anunciadas, não medição independente.</p>`
    : `<p class="fine" data-editorial-limit>Esta revisão remove afirmações sem comprovação; não significa validação técnica ou teste do produto.</p>`;
  content = content.replace(/<p class="fine" data-(?:verified-manufacturer|verified-listing|editorial-limit|editorial-context)>[\s\S]*?<\/p>/g, "");
  return content.replace(/(<p class="fine source">[\s\S]*?<\/p>)/, "$1" + source);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const updatedFiles = await correctGeneratedProductTitles();
  console.log(`Títulos conhecidos corrigidos em ${updatedFiles} arquivo(s).`);
}
