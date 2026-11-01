import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { HIGHLIGHT_EDITORIAL } from './highlight-editorial.mjs';
import { documentedSpecifications } from './manufacturer-specifications.mjs';
import { MARKETPLACE_FIELD_REVIEWS,listingReviewFor } from './marketplace-field-reviews.mjs';
import {EPSON_DESCRIPTION} from './public-seo-labels.mjs';

import { EXISTING_OFFER_REVIEWS, matchesExistingOffer } from './existing-offer-reviews.mjs';
const PRODUCT_CORRECTIONS = new Map([
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
      const categoryLabel = {informatica:'Informática',carro:'Carro',bicicletas:'Bicicletas','esporte-e-lazer':'Esporte e Lazer',perfumes:'Perfumes',brinquedos:'Brinquedos'}[correction.category];
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
