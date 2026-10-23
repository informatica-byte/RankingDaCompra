// Read from the existing Mercado Livre listings on 20/10/2026. No prices,
// ratings, affiliate links, guarantees or independent performance claims.
const date='2026-10-20';
const labels={format:'Formato',bt:'Versão Bluetooth',anc:'Cancelamento ativo de ruído',mic:'Microfone',hours:'Autonomia no fone',caseHours:'Autonomia com estojo'};
const unknown=(label,reason)=>({label,value:'Não informado / a confirmar',state:'unknown',basis:'cadastro',reason});
const yes=(label,value)=>({label,value:value+', segundo o anúncio',state:'yes',basis:'cadastro'});
const no=(label,value)=>({label,value:value+', segundo o anúncio',state:'no',basis:'cadastro'});
const ancUnknown='O anúncio não confirma cancelamento ativo para ouvir. Redução de ruído no microfone, ENC ou “cancelamento de ruído” sem tipo não comprovam ANC.';
const absent='O anúncio não informa este dado com clareza para este produto.';
function phones(values={}) {
  return Object.entries(labels).filter(([key])=>key!=='caseHours'||values.caseHours).map(([key,label])=>{
    const v=values[key];
    return typeof v==='string'?yes(label,v):v?{label,...v,basis:'cadastro'}:unknown(label,key==='anc'?ancUnknown:absent);
  });
}
const missing=reason=>({value:'Não informado / a confirmar',state:'unknown',reason});
const without=value=>({value:value+', segundo o anúncio',state:'no'});
function review(id,model,family,catalog,item,features,notes,summary,positiveNotes=[],negativeNotes=[]) {
  const sourceUrl=catalog.startsWith('MLBU')?'https://www.mercadolivre.com.br/up/'+catalog+'?pdp_filters=item_id%3A'+item
    :catalog==='MLB6877799706'?'https://produto.mercadolivre.com.br/MLB-6877799706-fones-esportivo-bluetooth-60-tradutor-ai-miniso-x15pro-ipx5-_JM'
    :catalog==='MLB3793292751'?'https://produto.mercadolivre.com.br/MLB-3793292751-smartwatch-esportivo-masculina-relogio-inteligente-redondo-_JM'
    :'https://www.mercadolivre.com.br/p/'+catalog+(item?'?pdp_filters=item_id%3A'+item:'');
  return [id,{model,family,catalog,item,sourceUrl,sourceKind:'marketplace-listing',reviewedAt:date,
    scope:'Informações lidas no anúncio do Mercado Livre em 20/10/2026. A fonte descreve a oferta; não é teste independente ou autenticação do produto.',
    features:features.map(f=>({...f,sourceKind:'marketplace-listing',sourceUrl,checkedAt:date})),
    notes,summary,positiveNotes,negativeNotes,
    limitations:['Informações do vendedor, sem teste de som, desempenho, conforto ou autonomia pela equipe. Campos ausentes ou contraditórios não foram completados por suposição. Consulte as condições atuais na oferta.'],
  }];
}
function reviewToday(...args) {
  const [id,record]=review(...args),reviewedAt='2026-10-22';
  return [id,{...record,reviewedAt,
    scope:'Informações lidas no anúncio específico do Mercado Livre em 22/10/2026. Dados declarados pelo vendedor, sem teste independente ou autenticação da unidade.',
    features:record.features.map(f=>({...f,checkedAt:reviewedAt}))}];
}
export const MARKETPLACE_FIELD_REVIEWS=new Map([
  reviewToday('C5b5fKstKDUgNDUxnQkP',/power\s*bank.*basike|basike.*power\s*bank/i,'power-bank','MLB63849175','MLB4407942173',[
    yes('USB-C','Conector USB-C identificado na tabela; a descrição informa entrada e saída Tipo-C'),
    yes('Modelo anunciado','BA-POW079 / POW079 na tabela; B-079F na descrição')],
    ['USB-C é confirmado na tabela e descrição. A contagem de portas, a identificação B-079F/POW079 e alguns valores elétricos divergem; não copiamos a tabela elétrica inteira nem garantimos uma quantidade de recargas.'],
    'O anúncio deste power bank Basike informa capacidade nominal de 20.000 mAh, conector USB-C e carregamento anunciado de até 22,5 W. A descrição distingue entrada e saída Tipo-C. Há divergências na identificação do modelo, na quantidade de portas e em valores elétricos, por isso esses detalhes não foram fechados por suposição. Potência e desempenho dependem do cabo, do aparelho e do protocolo; não medimos capacidade útil, tempo de carga ou quantidade de recargas.',
    ['USB-C identificado tanto na tabela como na descrição.'],
    ['Identificação, quantidade de portas e valores elétricos têm divergências; confirme a variante.','Capacidade útil e desempenho de carga não foram medidos.']),
  reviewToday('zev1LogqUFpJ3cLlIXyy',/auxiliar.*partida.*compressor/i,'auxiliar-partida','MLB75836344','MLB7218305234',[
    yes('USB-C','Entrada e saída USB-C de 5 V / 2 A descritas na oferta'),
    unknown('Carga rápida','O anúncio informa USB-C de 5 V / 2 A, mas não identifica protocolo de carga rápida. Os 120 W da tabela não foram atribuídos à saída USB.')],
    ['A tabela identifica DISTRIBUIDORA BRAZUCA CELL e inclui cabo USB-C. Não usamos potência do compressor/auxiliar como potência USB.'],
    'O anúncio identifica um auxiliar de partida com compressor, lanterna e função power bank. A descrição informa entrada e saída USB-C de 5 V / 2 A e cabo USB-C incluído. Não foi confirmado um protocolo de carga rápida. A potência máxima de 120 W da tabela não comprova essa potência na saída USB. Não testamos partida, calibração, proteções ou bateria; confirme no vendedor a aplicação ao veículo e as instruções de uso.',
    ['Entrada e saída USB-C descritas na oferta.'],
    ['Protocolo de carga rápida não identificado.','Não atribuímos a potência do aparelho à saída USB nem garantimos partida ou calibração.']),
  reviewToday('BcfEuX1oed02O8pYXKyg',/lanterna.*cabe[cç]a.*12\s*modos/i,'lanterna','MLB63116023','MLB6038239378',[
    yes('Carregamento USB','Recarga por USB e cabo USB incluído, conforme tabela e descrição'),
    unknown('USB-C','O anúncio informa apenas USB; não identifica o formato USB-C da porta.'),
    unknown('Carga rápida','O anúncio não identifica protocolo ou potência de carga rápida.')],
    ['A tabela identifica LUMIZAR MATERIAIS ELÉTRICOS, mas o modelo é descrito genericamente como “ciclista trilheiros”. Não usamos ficha de outra lanterna. IPX4 não comprova proteção contra poeira ou imersão.'],
    'O anúncio desta lanterna de cabeça informa 12 modos de iluminação, bateria recarregável e recarga por USB, com cabo incluído. A marca indicada na tabela é LUMIZAR MATERIAIS ELÉTRICOS; não há um código técnico inequívoco do modelo. USB-C e carga rápida continuam sem confirmação. Os números de luminosidade, alcance e autonomia são alegações da oferta, não medições da equipe; não tratamos IPX4 como proteção para imersão ou contra poeira.',
    ['Recarga USB e cabo incluído informados no anúncio.'],
    ['Formato da porta e carga rápida não identificados.','Luminosidade, alcance e autonomia não foram medidos; IPX4 não comprova imersão.']),
  reviewToday('cSmjEdmFugRGDdJHkMcR',/smartwatch.*(?:redondo|foxbox|bw0223)/i,'watch-smart','MLB3793292751','MLB3793292751',[
    yes('Modelo anunciado','FoxBox BW0223; código alfanumérico 223 na tabela'),
    no('GPS integrado','Sem GPS, conforme o campo específico da tabela'),
    yes('Chamadas Bluetooth','Faz, recebe e rejeita chamadas com o telefone conectado por Bluetooth; aplicativo Da Fit'),
    yes('Proteção IP','IP67 declarado na descrição; o vendedor orienta não nadar, tomar banho ou mergulhar com o relógio')],
    ['O modelo BW0223 foi encontrado no próprio anúncio; não dependemos de um manual de outro relógio. IP67 é uma declaração do vendedor, não resultado de ensaio da equipe.'],
    'O anúncio identifica o smartwatch FoxBox BW0223 (código 223), com chamadas pelo Bluetooth do celular e aplicativo Da Fit. A tabela informa que não possui GPS. A descrição declara IP67, mas também orienta não usar em natação, banho ou mergulho. Não prometemos uso submerso, precisão de sensores, medição médica ou autonomia real; a equipe não testou esses recursos.',
    ['Modelo BW0223 identificado na tabela do anúncio.','Chamadas com o celular conectado por Bluetooth descritas pelo vendedor.'],
    ['Sem GPS segundo a tabela da oferta.','IP67 é declarado pelo vendedor; ele próprio desaconselha natação, banho e mergulho.']),
  reviewToday('wYxgVNIJeeWmGhcToFLP',/power\s*bank.*20000.*4\s*cabos/i,'power-bank','MLB72899141','MLB7502238108',[
    yes('Carga rápida','Carregamento rápido anunciado de até 22,5 W; protocolo e potência por saída não detalhados'),
    yes('USB-C','Conectores USB/USB-C na tabela e entrada Tipo-C na descrição'),
    yes('Modelo anunciado','3Tech AJ-C03 / AJ-C03-H na tabela')],
    ['A tabela diz “Rápida” e a descrição anuncia até 22,5 W. Isso não garante essa potência em todos os cabos, dispositivos ou saídas simultâneas. Não inferimos recarga por indução do campo genérico “É sem fio”.'],
    'A oferta identifica o power bank 3Tech AJ-C03 / AJ-C03-H com capacidade nominal de 20.000 mAh, cabos integrados, visor e entrada Tipo-C. Tabela e descrição anunciam carga rápida, de até 22,5 W no texto, mas não detalham protocolo nem potência por saída. Isso não comprova esse desempenho em todos os aparelhos ou em uso simultâneo. Não atribuímos carregamento por indução ao campo genérico de conexão sem fio.',
    ['Entrada Tipo-C e carga rápida anunciadas pelo vendedor.'],
    ['Protocolo e potência por saída não detalhados.','Capacidade útil, tempo de carga e carregamento simultâneo não foram testados.']),
  reviewToday('M0Zj2K84Q8PX0YTQMIHz',/smartwatch.*novante/i,'watch-smart','MLB65117366','MLB6208101802',[
    yes('Modelo anunciado','NOVANTE OCEAN GT, HT-1289, conforme a tabela'),
    yes('GPS integrado','GPS integrado e registro independente de trajetória declarados na descrição e na tabela'),
    yes('Chamadas Bluetooth','Atende e rejeita chamadas com o celular conectado por Bluetooth, conforme a descrição'),
    yes('Proteção IP','IPX8 declarado na tabela e descrição; condições de ensaio não confirmadas')],
    ['Não transformamos a alegação de 30 m em garantia de natação ou mergulho. Peso e autonomia divergem entre as seções e não foram completados por suposição.'],
    'O anúncio identifica o NOVANTE OCEAN GT HT-1289, com GPS integrado, registro independente de trajetos, chamadas Bluetooth com o celular conectado e classificação IPX8 declarados pelo vendedor. A classificação não é um ensaio da equipe e não usamos a alegação de 30 m como garantia para natação ou mergulho. Peso e autonomia apresentam diferenças entre as seções; não escolhemos um número. Sensores de saúde não são tratados como diagnóstico médico.',
    ['Modelo OCEAN GT HT-1289 e GPS integrado identificados no anúncio.','Chamadas Bluetooth e IPX8 declarados pelo vendedor.'],
    ['Condições de ensaio da proteção não confirmadas; não garantimos natação ou mergulho.','Peso, autonomia e sensores não foram validados em teste independente.']),
  ...[
    ['UkgpEmnU2nSDUmOujW6W','MLB64244402','MLB6162191874','HT1291'],
    ['Znhr4d5uhDKsj5poLEmZ','MLB65974451','MLB4460735385','HT-1303'],
  ].map(([id,catalog,item,model])=>reviewToday(id,/novante.*alexa|alexa.*novante/i,'watch-smart',catalog,item,[
    yes('Modelo anunciado','NOVANTE '+model+', conforme a tabela deste anúncio'),
    no('GPS integrado','Não possui GPS independente: observação expressa na descrição e campo “Com GPS: Não”'),
    yes('Proteção IP','IP68 declarado na tabela e descrição; condições de ensaio não confirmadas')],
    ['O código do modelo foi lido separadamente em cada anúncio. As palavras GPS em hashtags genéricas não comprovam GPS independente contra a observação expressa da própria descrição. Não garantimos uso em banho, natação ou mergulho.'],
    'Este anúncio identifica o smartwatch NOVANTE '+model+' e declara Alexa e chamadas Bluetooth. A descrição afirma expressamente que não possui GPS independente, e a tabela marca “Com GPS: Não”. IP68 é informado pelo vendedor, sem condições de ensaio verificadas pela equipe. Não prometemos adequação à natação ou banho, precisão de sensores, diagnóstico por ECG ou duração real da bateria.',
    ['Modelo '+model+' identificado na tabela específica da oferta.','Alexa e chamadas Bluetooth anunciadas, sem teste independente.'],
    ['Não possui GPS independente segundo a própria oferta.','Proteção, sensores, ECG e autonomia não foram testados; não garantimos uso em natação ou banho.'])),
  reviewToday('mlMLB4474695467',/smartwatch.*gps.*strava/i,'watch-smart','MLBU3786668455','MLB4474695467',[
    yes('Chamadas Bluetooth','Faz e atende ligações com microfone interno e o Bluetooth do celular conectado, conforme a descrição'),
    yes('GPS conectado','A descrição informa localização em uso conjunto com celular e aplicativo'),
    unknown('GPS integrado','A tabela diz “Com GPS: Sim”, mas a descrição vincula a localização ao celular e aplicativo; não comprova GPS independente.'),
    unknown('Proteção IP','O anúncio fala em resistência a respingos, mas não identifica um código IP inequívoco.')],
    ['Não convertemos “Com GPS: Sim” em registro de trajetos sem celular. O anúncio desaconselha chuveiro e sauna; não reproduzimos promessas médicas ou compatibilidade universal.'],
    'O anúncio deste smartwatch descreve chamadas com o celular conectado por Bluetooth. A localização por GPS é apresentada para uso junto ao celular e aplicativo; GPS integrado independente continua sem comprovação, apesar do campo genérico “Com GPS: Sim”. O vendedor cita resistência a respingos e desaconselha chuveiro e sauna, sem identificar um código IP inequívoco. Não testamos sensores nem apresentamos medições de saúde como diagnóstico médico.',
    ['Chamadas Bluetooth com o telefone conectado descritas no anúncio.'],
    ['GPS independente e código IP não foram confirmados.','Recursos de saúde não são tratados como medições médicas validadas.']),
  review('1tIzUpXs4udqZOZwpQX7',/\bhxz[-\s]*b39\b/i,'headset','MLB68000685','MLB6660301362',phones({format:'Over-ear (ao redor das orelhas)',bt:'Bluetooth 5.3',mic:'Microfone integrado com ENC para chamadas',hours:'Até 60 h de uso contínuo anunciadas'}),
    ['O título diz com fio, mas a tabela e a descrição informam Bluetooth. Preservamos o título e expomos essa divergência; ENC não confirma ANC.'],
    'O anúncio do HXZ-B39 informa formato over-ear, Bluetooth 5.3, microfone com ENC para chamadas e até 60 horas de uso contínuo. O título menciona “com fio”, enquanto a tabela e a descrição apresentam conexão sem fio; essa divergência permanece sinalizada. ENC no microfone não confirma ANC para ouvir. São informações do vendedor, sem teste de som, latência, conforto ou bateria pela equipe.',
    ['Formato over-ear e microfone integrado informados no anúncio.','Bluetooth 5.3 e recarga USB-C descritos pelo vendedor.'],
    ['Título e descrição divergem sobre a conexão com fio/sem fio.','Até 60 h é uma duração anunciada, não medida; ANC não foi confirmado.']),
  review('2e2m7sDdRyGHq1Tzj8ra',/tp[ -]?link.*tl[-\s]*wr\s*840\s*n/i,'roteador','MLB15314118','MLB3858550725',[
    unknown('Rede Mesh','A tabela do anúncio não identifica a revisão e a descrição não confirma Mesh. WDS/bridge, repetidor ou WISP não comprovam Mesh.')],
    ['A oferta informa 1 WAN e 4 LAN de 10/100 Mbps, Wi-Fi de 2,4 GHz e 300 Mbps nominais. A revisão aparece como “-”; não há prova de Mesh.']),
  review('5MGE98tYssH9nEfBeHoW',/huawei.*watch\s*fit\s*5\b(?!\s*(?:pro|max))/i,'watch-smart','MLB67714386','',[
    yes('Armazenamento interno','64 GB de armazenamento informados na descrição do vendedor'),
    unknown('Memória RAM','A tabela também repete 64 GB como RAM, sem esclarecimento. Não tratamos armazenamento e RAM como a mesma capacidade.')],
    ['A descrição e o campo memória interna anunciam 64 GB de armazenamento. O campo duplicado de RAM continua sem esclarecimento; armazenamento não equivale a RAM.'],
    'O anúncio do HUAWEI WATCH FIT 5 informa tela AMOLED de 1,82 polegada, GPS, compatibilidade com Android e iOS e armazenamento interno de 64 GB. A capacidade informada é de armazenamento, não de RAM. A documentação do fabricante é apresentada separadamente nesta análise; ela não autentica a unidade vendida. O anúncio também menciona 5 ATM; isso não autoriza mergulho. Os recursos de saúde não substituem diagnóstico e não testamos sensores, autonomia ou armazenamento.',
    ['Tela AMOLED de 1,82 polegada e GPS informados na oferta.','Armazenamento interno de 64 GB descrito pelo vendedor, com origem identificada.'],
    ['A tabela repete 64 GB como RAM sem esclarecer; não reproduzimos essa equivalência.','Sensores e autonomia não foram testados; não é dispositivo de diagnóstico.']),
  review('9P123IBTTYnSCMilPvXB',/amazfit.*bip\s*6\b(?!\s*(?:pro|max))/i,'watch-smart','MLB57802650','MLB6739814208',[
    unknown('Proteção IP','O anúncio informa 5 ATM, não um código IP. Não convertimos ATM em IP67/IP68.')],
    ['5 ATM aparece na oferta. O campo IP não deve receber esse número. Há outros dados divergentes no anúncio; não foram usados para substituir a ficha já documentada.']),
  review('BhacwzAPIbDglRkNCoyz',/miniso.*x15\s*pro/i,'fone','MLB6877799706','MLB6877799706',phones({format:'Open-ear com gancho',bt:'Bluetooth 6.0',mic:'Microfone para chamadas',hours:missing('A mesma descrição anuncia 13 h por carga e aproximadamente 4,5 h nos fones. Não escolhemos um dos valores.'),caseHours:missing('Há estojo de recarga, mas o anúncio não fornece duração total inequívoca com estojo.')}),
    ['A tabela identifica X15 Pro e open-ear. Tradução depende de aplicativo não identificado; não prometemos tradução independente, gratuidade permanente ou qualidade equivalente à de um intérprete.'],
    'O anúncio identifica os fones como MINISO X15 Pro, de formato open-ear com gancho, Bluetooth 6.0 e microfone para chamadas. A tradução anunciada depende de aplicativo, mas o nome e as condições do serviço não estão claros. A autonomia diverge dentro da própria descrição: 13 horas em um trecho e 4,5 horas em outro. Não escolhemos um desses valores nem confirmamos ANC, autenticidade, conforto ou qualidade de tradução em teste próprio.',
    ['Formato open-ear e microfone informados na tabela do anúncio.','Bluetooth 6.0 e estojo de recarga anunciados pelo vendedor.'],
    ['Autonomia anunciada contraditória: 13 h e 4,5 h por carga.','Aplicativo e condições da tradução não estão claros; ANC não foi confirmado.']),
  review('c9hb1oe40g3K1dP4dAsy',/jbl.*quantum\s*100\s*m2/i,'headset','MLB47044981','MLB4590134133',[
    no('Cancelamento ativo de ruído','Sem cancelamento de ruído: a tabela informa “Não” e a descrição cita isolamento passivo')],
    ['A ausência é atribuída à tabela do vendedor, não inferida da falta de menção na página JBL.']),
  review('DlFv98xnrCPIAeFfbRFv',/pro\s*phone\s*see/i,'fone-tws','MLB58519492','MLB5758097762',phones({format:'Intra-auricular (in-ear)',bt:'Bluetooth 5.4',mic:'Microfone integrado',hours:'3 a 5 h de uso contínuo anunciadas; varia com volume e uso',caseHours:missing('O anúncio informa estojo de 300 mAh, mas não a autonomia total com recargas. mAh não são horas.')}),
    ['A tabela e a descrição informam microfone e uso contínuo de 3 a 5 h. Termos de outras marcas, IP e conectores misturados não foram copiados.'],
    'A oferta PRO PHONE SEE informa fones TWS intra-auriculares, Bluetooth 5.4, microfone integrado e duração de 3 a 5 horas de uso contínuo, variável conforme volume e utilização. O estojo é anunciado com 300 mAh, mas isso não informa horas totais de reprodução. O anúncio menciona cancelamento de ruído sem esclarecer ANC. Não reproduzimos termos de outras marcas ou classificações IP misturadas nos campos; som, conforto e bateria não foram testados.',
    ['Microfone integrado e controles de música/chamadas anunciados.','Formato in-ear e Bluetooth 5.4 informados na tabela.'],
    ['Autonomia total com estojo não informada; capacidade em mAh não equivale a horas.','O tipo de cancelamento e os campos de resistência não estão claros.']),
  review('FlqPY3yHJ2xPoNgnhSTE',/galaxy\s*buds\s*core/i,'fone-tws','MLB52845211','MLB5121690259',[
    unknown('Autonomia no fone','O anúncio anuncia até 35 h sem distinguir uma sessão de uso. Não atribuímos o total com recargas à duração de uma carga dos fones.')],
    ['ANC e microfone são descritos. Os 35 h não completam o campo por carga; mantemos separada a documentação anterior do total com estojo.']),
  review('FpO2EOBfcTy3F04Jk6pY',/compat[ií]vel.*jbl\s*760/i,'headphone','MLBU5415345146','MLB7757427584',phones({format:'Over-ear (ao redor das orelhas)',bt:'Bluetooth 5.3 informado no campo de modelo',mic:'Microfone integrado'}),
    ['A marca é Genérica. O texto refere-se ao JBL Tune 760NC por semelhança e até usa BJL em uma FAQ; não atribuímos autenticidade JBL ou recursos do 760NC.'],
    'Este anúncio identifica um fone de marca Genérica, descrito como compatível ou similar ao Tune 760. A tabela informa formato over-ear e Bluetooth 5.3; a descrição cita microfone integrado, entrada P2 e estrutura dobrável. A semelhança do nome não comprova que seja um JBL Tune 760NC nem transfere o ANC ou a bateria desse modelo. A autonomia não está clara e não testamos áudio, conexão ou conforto.',
    ['Formato over-ear, microfone e entrada P2 informados no anúncio.','Estrutura dobrável e ajuste de haste anunciados.'],
    ['Marca Genérica: não apresentamos como JBL original.','Autonomia e ANC não confirmados; não usamos a ficha do Tune 760NC.']),
  reviewToday('FWRyLtto1bKeKurNikKq',/forestory.*\bx5\b/i,'fone','MLB68085605','MLB4840111509',phones({format:missing('O título anuncia open-ear/OWS, enquanto a tabela diz in-ear e monaural. A descrição menciona uso individual e duplo; o encaixe exato permanece contraditório.'),bt:'Bluetooth 5.3; título, tabela e descrição atuais concordam',anc:without('Sem cancelamento de ruído, conforme o campo específico da tabela'),mic:'Microfone integrado para chamadas',hours:missing('A descrição menciona 30 h por fone e também 5 a 8 h; não escolhemos um dos números.'),caseHours:missing('O mesmo anúncio menciona totais de 30, 100 e mais de 120 h. Não há um total inequívoco.')}),
    ['Foram lidas todas as seções; não copiamos 100 h como uma sessão de reprodução, nem resolvemos o formato por fotografia.'],
    'O anúncio atual identifica o FORESTORY X5 com Bluetooth 5.3 no título, na tabela e na descrição, microfone integrado e estojo de recarga. A ficha específica marca ausência de cancelamento de ruído. O formato continua contraditório entre open-ear e in-ear, e há vários números incompatíveis de autonomia. Não escolhemos um formato ou duração fechada. Não comprovamos som, conforto, impermeabilidade ou duração real em teste próprio.',
    ['Bluetooth 5.3 e modelo X5 identificados no anúncio atual.','Microfone e estojo de recarga informados pelo vendedor.'],
    ['Formato continua divergente no próprio anúncio.','Autonomia contraditória; 100 h não foram tratadas como duração de uma carga.']),
  review('goH2juydLAa3JYXzctkH',/basike.*ear\s*clip/i,'fone-tws','MLB67513507','MLB6587035878',phones({format:missing('Tabela informa in-ear; descrição informa open-ear com ear clip e gancho. Não atribuímos encaixe único.'),bt:'Bluetooth 5.4',mic:'Microfone integrado com ENC para chamadas',hours:missing('Descrição informa 10 h contínuas; a tabela informa 50 h sem explicar a composição. A autonomia por carga não ficou inequívoca.'),caseHours:missing('O anúncio não esclarece se as 50 h incluem o estojo. Não convertemos a capacidade de 800 mAh em duração.')}),
    ['O anúncio identifica BA-FON240B. Existem também IPX5 e IPX6 no texto; não repetimos as promessas de latência ou redução percentual de vazamento.'],
    'A tabela deste Basike identifica o modelo BA-FON240B. A descrição informa Bluetooth 5.4, microfone com ENC para chamadas e carregamento USB-C. O formato aparece como in-ear na tabela e open-ear com gancho no texto; a autonomia aparece como 50 h e 10 h sem uma separação inequívoca entre fones e estojo. Não escolhemos um desses valores, não confirmamos ANC e não reproduzimos as promessas de latência ou ausência de vazamento de som.',
    ['Modelo BA-FON240B identificado na oferta.','Bluetooth 5.4, microfone com ENC e USB-C anunciados.'],
    ['Formato, autonomia e resistência têm dados divergentes.','ENC para chamadas não confirma ANC; áudio e conforto não foram testados.']),
  review('kYzXt8BeErDzXsC6BlwB',/havit.*tw\s*982\b(?!\s*(?:pro|plus))/i,'fone-tws','MLB44616858','MLB3949019849',[
    unknown('Cancelamento ativo de ruído','O anúncio descreve ENC para chamadas, não ANC para ouvir. Não usamos o TW982 Pro para completar esse campo.')],
    ['Formato in-ear, Bluetooth 5.4 e microfone estão anunciados. A tabela detalhada menciona 7,5/33 h a 60%; esses dados já estavam documentados. ANC continua não especificado.']),
  review('Mdyju6zRmHsKRpOYqz51',/inova.*(?:gancho|fone)/i,'fone-tws','MLB63064167','MLB6043042334',phones({format:missing('O gancho é informado, mas o texto mistura design aberto e ponteiras auriculares sem definir o encaixe com segurança.'),bt:'Bluetooth 5.4',mic:'Microfone para chamadas',hours:missing('A descrição mistura referência a Basike com o anúncio INOVA e números de 8 h/48 h; não atribuímos duração por carga a um modelo não identificado.'),caseHours:missing('O título anuncia 40 h e a descrição informa 48 h. Não escolhemos o maior total.')}),
    ['A tabela identifica Inova Cases e Bluetooth 5.4. O texto mistura marca Basike; não usamos as alegações desse trecho para provar bateria ou ANC do INOVA.'],
    'A oferta Inova Cases anuncia fones com gancho, Bluetooth 5.4, microfone e estojo de recarga. A própria descrição mistura referência a Basike e números de bateria diferentes do título, por isso não publicamos uma duração fechada nem confirmamos ANC. O gancho está anunciado, mas o tipo exato de encaixe e a compatibilidade devem ser avaliados na oferta. Não testamos som, estabilidade do encaixe ou bateria.',
    ['Gancho e microfone informados no anúncio.','Bluetooth 5.4 e estojo de carregamento anunciados.'],
    ['O texto mistura marcas e informa totais de bateria diferentes.','ANC e duração por carga não foram confirmados; não garantimos que o fone não caia.']),
  review('mGfjcGRX5FvusGGZMYJL',/fone.*(?:earcuffs|in[ -]?ear)/i,'fone','MLBU3887866793','MLB4596924785',phones({format:missing('Tabela e parte da descrição dizem in-ear; outro trecho diz open-ear com gancho. O formato é contraditório.'),bt:missing('O campo só confirma Bluetooth. A versão 5.4 aparece em trecho genérico que também menciona outra marca, sem vínculo inequívoco com o M145.'),mic:'Microfone integrado',hours:missing('Os números de 7/30 h aparecem em trecho misturado com outra marca, sem comprovação de que se referem ao IIKOSMAX M145.'),caseHours:missing('Não foi identificado total com estojo inequivocamente atribuído ao M145.')}),
    ['A tabela identifica IIKOSMAX M145. Há “É sem fio: Não” na tabela e Bluetooth na descrição; não transferimos a ficha do trecho Basike ao M145.'],
    'O anúncio identifica o IIKOSMAX M145 com microfone e conectividade Bluetooth. Os demais campos exigem cautela: a tabela e a descrição divergem sobre conexão sem fio e formato, e há um trecho que menciona outra marca. Por isso não atribuímos ao M145 a versão Bluetooth ou os números de bateria daquele trecho. Não testamos áudio, conforto, resistência ou autonomia.',
    ['Modelo M145 e microfone identificados na tabela.','Bluetooth é informado na oferta, sem versão inequívoca para o modelo.'],
    ['Conexão e formato têm informações contraditórias.','Não copiamos bateria, ANC ou Bluetooth do trecho que menciona outra marca.']),
  review('NJipazuMXMzOH9YZbxwu',/dapon.*h02\s*d/i,'headphone','MLB24117280','MLB4587377807',phones({format:'Headphone over-ear anunciado no título',bt:'Bluetooth 5.1',anc:without('Sem cancelamento de ruído, conforme o campo específico da tabela'),mic:'Microfone integrado',hours:missing('O título e a descrição informam até 22 h, mas a tabela informa 35 h. Não escolhemos um desses números.'),caseHours:without('Não se aplica: o anúncio informa que não inclui estojo de carregamento')}),
    ['A tabela nega cancelamento de ruído. A descrição anuncia P2; há também divergência entre Micro-USB e USB-C, que não foi resolvida por suposição.'],
    'O anúncio do Dapon H02D informa Bluetooth 5.1, microfone integrado, estrutura dobrável e opção de uso por cabo P2 de 3,5 mm. A tabela marca ausência de cancelamento de ruído. A bateria permanece sem um valor único porque o título e a descrição informam 22 h, enquanto a tabela informa 35 h. O tipo de porta de recarga também diverge entre as seções. Não testamos som, conforto ou autonomia.',
    ['Bluetooth 5.1 e microfone integrado anunciados.','Uso por P2 e estrutura dobrável descritos pelo vendedor.'],
    ['Autonomia divergente: 22 h na descrição e 35 h na tabela.','Porta de recarga divergente entre Micro-USB e USB-C; sem cancelamento de ruído segundo a tabela.']),
  review('rERcfIbgG1c0uUdNlQ4o',/lenovo.*lp\s*40\b(?!\s*pro)/i,'fone-tws','MLB61405511','MLB5947242720',phones({format:'Intra-auricular (in-ear)',bt:'Bluetooth 5.0',mic:'Microfone integrado',hours:'Aproximadamente 3 h de música por carga; varia com o volume',caseHours:missing('O anúncio informa estojo de 300 mAh, mas não duração total com recargas. Não usamos dados do LP40 Pro.')}),
    ['O modelo é LP40, não Pro. “Cancelamento de ruído: Sim” não esclarece ANC, portanto não foi usado para afirmar cancelamento ativo.'],
    'O anúncio do Lenovo LP40 informa formato in-ear, Bluetooth 5.0, microfone e aproximadamente 3 horas de música por carga, dependendo do volume. O estojo é anunciado com 300 mAh, sem duração total de reprodução informada. O campo genérico de cancelamento de ruído não esclarece ANC. Não usamos a ficha do LP40 Pro e não testamos autenticidade, conforto, som ou bateria.',
    ['Bluetooth 5.0 e microfone informados no anúncio do LP40.','A descrição separa cerca de 3 h de música por carga da capacidade do estojo.'],
    ['Autonomia total com estojo não informada; 300 mAh não equivale a horas.','ANC não confirmado; não atribuímos recursos do LP40 Pro.']),
  review('U52A4gBWWLEmfCzONtHb',/fone.*bluetooth/i,'fone-tws','MLBU4893834428','MLB5105857793',phones({bt:'Bluetooth 5.3',mic:'Microfone integrado',hours:missing('A tabela informa 4 h sem descrição que esclareça a condição e a separação entre fones e estojo.'),caseHours:missing('Não há duração total com estojo informada de forma inequívoca.')}),
    ['A oferta PRO PHONE SEE informa Bluetooth 5.3 e microfone. Campos de formato, IP, conectores e compatibilidade misturam palavras sem definição técnica.'],
    'A ficha do anúncio PRO PHONE SEE informa Bluetooth 5.3, tecnologia TWS, microfone e estojo de recarga. Os campos de formato, proteção e conectores contêm termos misturados, e o cancelamento de ruído não é identificado como ANC. A tabela menciona 4 h sem esclarecer as condições ou o total com estojo; não completamos esses dados por suposição. Não testamos áudio, resistência ou bateria.',
    ['Bluetooth 5.3 e microfone informados na tabela.','Tecnologia TWS e estojo de recarga anunciados.'],
    ['Formato, IP e conectores não estão descritos com clareza técnica.','Autonomia por carga, total com estojo e ANC continuam sem confirmação inequívoca.']),
  review('VgB90DThWdh8uyXUeE3U',/headset.*mageon/i,'headset','MLB57322445','MLB4959327979',phones({format:missing('O anúncio informa headset estéreo com fio, mas não especifica encaixe on-ear ou over-ear.'),bt:without('Não possui Bluetooth: a tabela informa “Não”'),anc:without('Sem cancelamento de ruído, conforme o campo específico da tabela'),mic:'Microfone ajustável',hours:without('Não se aplica à conexão analógica por cabo anunciada')}),
    ['A descrição informa dois plugs P2 de 3,5 mm, cabo de 1,8 m e controle de volume no cabo. Não prometemos compatibilidade com entrada combinada sem adaptador.'],
    'O anúncio do headset Mageon informa conexão com fio por dois plugs de 3,5 mm, microfone ajustável, cabo de 1,8 m e controle de volume no cabo. A tabela nega Bluetooth e cancelamento de ruído. Bateria e estojo de recarga não se aplicam à conexão analógica anunciada. Confira as entradas do aparelho: dois plugs separados podem exigir adaptador para uma entrada combinada. Não testamos áudio, microfone ou conforto.',
    ['Microfone ajustável e controle de volume no cabo anunciados.','Dois plugs de 3,5 mm e cabo de 1,8 m identificados na descrição.'],
    ['Sem Bluetooth e sem cancelamento de ruído segundo a tabela.','Confira as entradas e eventual adaptador; não garantimos compatibilidade universal.']),
  review('WO6BdDxEWWCCjBVJ0ygB',/fone.*ear\s*clip.*6[.,]0/i,'fone-tws','MLB75615487','MLB7213068268',phones({format:'Ear clip (clip-ear)',bt:'Bluetooth 6.0',mic:'Microfone integrado',hours:missing('A tabela informa 8 h; a descrição menciona aproximadamente 5 h de música e 30 h em espera. Não tratamos espera como reprodução.'),caseHours:missing('O anúncio não informa total de reprodução com estojo de forma inequívoca e diverge na capacidade do estojo (300/400 mAh).')}),
    ['A tabela e a descrição identificam INOVA FON-13025F. Redução de ruído ambiente é descrita para o microfone, não ANC para ouvir.'],
    'O anúncio identifica o INOVA FON-13025F como ear clip TWS com Bluetooth 6.0, microfone e recarga USB-C. A autonomia permanece sem valor único: a tabela informa 8 h e a descrição aproximadamente 5 h de música, além de 30 h em espera. Espera não equivale a reprodução. A resistência à água também apresenta dados conflitantes. Não confirmamos ANC nem testamos conforto, som, bateria ou impermeabilidade.',
    ['Modelo FON-13025F, ear clip e microfone identificados.','Bluetooth 6.0 e recarga USB-C anunciados.'],
    ['Autonomia, capacidade do estojo e resistência têm informações divergentes.','As 30 h em espera não foram apresentadas como horas de música; ANC não confirmado.']),
  review('xUz3eJJ8CDLhc5sW47BB',/basike.*bluetooth.*tws/i,'fone-tws','MLB67513786','MLB7456114952',phones({format:missing('A tabela informa in-ear e a descrição open-ear com ear clip. Não atribuímos um único encaixe.'),bt:'Bluetooth 5.4',mic:'Microfone integrado com ENC para chamadas',hours:missing('A descrição anuncia 10 h contínuas e menciona um intervalo de 6h a 18h; a tabela informa 50 h. Não escolhemos um número por carga.'),caseHours:missing('A tabela informa 50 h sem distinguir recargas; 800 mAh de capacidade do estojo não comprovam um total de horas.')}),
    ['Também é identificado como BA-FON240B, mas mantivemos este cadastro e seus links separados. O título cita IPX6 e a descrição IPX5; não copiamos essas alegações como confirmação.'],
    'Este anúncio Basike também identifica o modelo BA-FON240B, com Bluetooth 5.4, microfone com ENC para chamadas e recarga USB-C. O cadastro e seus links permanecem separados. O anúncio diverge no formato, na autonomia e na resistência IP; não escolhemos o maior número nem prometemos ausência de vazamento de som ou latência específica. ENC de chamadas não confirma ANC para ouvir e não testamos conforto, áudio ou duração real.',
    ['Modelo BA-FON240B e Bluetooth 5.4 informados na oferta.','Microfone com ENC e recarga USB-C anunciados.'],
    ['Formato, autonomia e IP divergem entre título, tabela e descrição.','Não prometemos latência específica, ausência de vazamento ou ANC não informado.']),
  reviewToday('YuOWci2UixF5GuQE6IYS',/huawei.*(?:wifi|wi[ -]?fi).*ax2s/i,'roteador','MLB36213556','',[
    unknown('Quantidade de portas','O próprio anúncio informa quatro portas WAN/LAN em uma seção e três entradas Gigabit em outra; a tabela ainda registra cinco portas totais. Não escolhemos uma contagem.')],
    ['WS7000 está identificado. O mesmo anúncio mantém números de 3, 4 e 5 portas em seções diferentes; não alteramos quantidade com base em uma única seção.'],
    'O anúncio identifica o HUAWEI WiFi AX2S WS7000 e informa Wi-Fi 6 em 5 GHz, duas bandas, portas Gigabit e HarmonyOS Mesh+. As taxas de até 300 e 1201 Mbps são valores nominais, não velocidade garantida da internet. A quantidade de portas permanece a confirmar: o texto cita quatro em uma seção e três em outra, e a tabela registra cinco portas totais. Não testamos cobertura, desempenho ou compatibilidade entre roteadores.',
    ['Wi-Fi 6 em 5 GHz e duas bandas anunciados.','Portas Gigabit e HarmonyOS Mesh+ descritos na oferta.'],
    ['O anúncio diverge entre três, quatro e cinco portas; não publicamos contagem fechada.','Taxas nominais e Mesh não garantem cobertura ou velocidade real no ambiente.']),
  review('z507ObVuMlSEBSnK40Uc',/fone.*kapbom/i,'fone-tws','MLB69395726','MLB6549129000',phones({format:'Intra-auricular com gancho',bt:missing('Título e descrição informam Bluetooth 5.3, mas a tabela informa 5.4.'),anc:without('Sem cancelamento de ruído, conforme o campo específico da tabela'),mic:'Microfone para chamadas',hours:'Aproximadamente 4 a 6 h de música por carga, dependendo do volume',caseHours:missing('O estojo é anunciado com 620 mAh, sem duração total de reprodução informada.')}),
    ['A tabela identifica fabricante Kapbom, marca Scorpion e modelo KA-790/KA790D. Não tratamos como Lenovo XT80 nem como edição de outra marca.'],
    'O anúncio informa fabricante Kapbom, marca Scorpion e modelo KA-790/KA790D, com formato intra-auricular com gancho, microfone e cerca de 4 a 6 horas de música por carga. O estojo é anunciado com 620 mAh, sem duração total informada. A tabela nega cancelamento de ruído e diverge da descrição na versão Bluetooth, entre 5.4 e 5.3. Não usamos a ficha do Lenovo XT80 e não testamos áudio, conforto ou bateria.',
    ['Modelo KA-790/KA790D e microfone identificados na oferta.','A descrição informa aproximadamente 4 a 6 h de música por carga, conforme o volume.'],
    ['Versão Bluetooth divergente: 5.3 no texto e 5.4 na tabela.','Sem cancelamento de ruído segundo a tabela; total de horas com estojo não informado.']),
]);

// Same listing, now consistent on Bluetooth 5.3. No change of model or links.
MARKETPLACE_FIELD_REVIEWS.get('FWRyLtto1bKeKurNikKq').replacements=[['Bluetooth 5.4','Bluetooth 5.3']];

export function listingReviewFor(product) {
  const record=MARKETPLACE_FIELD_REVIEWS.get(String(product?.id||'')),title=String(product?.titulo||'');
  if(!record || /^(?:capa|case|suporte|carregador|refil)\b/i.test(title) || !record.model.test(title))return null;
  if(product.link) {
    try {
      const u=new URL(product.link),h=new URLSearchParams(u.hash.slice(1));
      const item=u.searchParams.get('pdp_filters')?.match(/item_id[:=](MLB\d+)/)?.[1]||u.searchParams.get('wid')||h.get('wid');
      const direct=u.pathname.match(/\/MLB-(\d+)/)?.[1];
      if(u.protocol!=='https:'||u.username||u.password||!['www.mercadolivre.com.br','produto.mercadolivre.com.br'].includes(u.hostname)||(!u.pathname.includes(record.catalog) && 'MLB'+direct!==record.catalog)||(record.item&&item&&item!==record.item))return null;
    } catch {return null;}
  }
  return {...record,features:record.features.map(f=>({...f})),notes:[...record.notes],limitations:[...record.limitations]};
}
