// Frozen regression identities, not live stock or price history. Never publish this test input.
const products=[
  {
    "id": "48oRcQNlH00KgNLHkvsG",
    "titulo": "Pulseira Inteligente Xiaomi Smart Band 9 Active Global",
    "categoria": "relogio-smartwatch",
    "comentario": "A Xiaomi Smart Band 9 Active é uma pulseira para acompanhar atividades e consultar registros pelo aplicativo Mi Fitness. A Xiaomi informa tela TFT de 1,47 polegada, 50 modos de exercício e até 18 dias de uso típico, conforme suas condições de teste. Pode ser considerada para acompanhamento cotidiano, não para diagnóstico: frequência cardíaca, SpO2 e sono são referências de bem-estar. Não medimos precisão, conforto ou autonomia real. Confira compatibilidade do celular e os limites de uso na água no manual.",
    "pros": "Tela de 1,47 polegada para consultar os registros na pulseira, segundo a Xiaomi.\n50 modos de exercício e conexão com o Mi Fitness anunciados para acompanhar atividades.",
    "contras": "Os sensores não substituem aparelhos médicos nem comprovam diagnóstico.\nAté 18 dias é uma estimativa do fabricante; uso e recursos ligados alteram a autonomia."
  },
  {
    "id": "ARscPKCMZs3D8k22qltl",
    "titulo": "Fone de Ouvido Bluetooth Xiaomi Redmi Buds 6 Play M2420E1 Preto",
    "categoria": "fonesdeouvido",
    "comentario": "O Xiaomi Redmi Buds 6 Play M2420E1 é um fone TWS intra-auricular com estojo USB-C e Bluetooth 5.4 informados pela Xiaomi. A fabricante anuncia até 7,5 horas no fone e até 36 horas com recargas no estojo, em suas condições de teste. A FAQ oficial esclarece que não há ANC para ouvir; a redução de ruído anunciada atua nas chamadas pelo microfone. IPX4 aplica-se apenas aos fones, não ao estojo, não comprova proteção contra poeira e não autoriza banho ou imersão. Não testamos conforto, áudio ou chamadas; a autonomia real depende do uso.",
    "pros": "Fones TWS com estojo USB-C para guardar e recarregar entre usos.\nAutonomia anunciada pela Xiaomi de até 7,5 horas no fone.\nAutonomia anunciada pela Xiaomi de até 36 horas com recargas no estojo.",
    "contras": "Encaixe intra-auricular: conforto individual não foi testado.\nAs 36 horas incluem recargas no estojo; não são duração contínua. Autonomia real e chamadas não foram testadas."
  },
  {
    "id": "GjHJtzdsIhbmSINvhPeX",
    "titulo": "Fone de Ouvido JBL Tune 520BT Bluetooth 5.3 Preto",
    "categoria": "fonesdeouvido",
    "comentario": "O JBL Tune 520BT é um fone on-ear Bluetooth 5.3, apoiado sobre as orelhas, com microfone integrado e Voice Aware informados pela JBL. A fabricante anuncia até 57 horas de bateria e cerca de 2 horas para recarga USB-C. Não possui cancelamento ativo de ruído (ANC). A conexão multiponto permite alternar entre dispositivos compatíveis; não comprova mistura simultânea de áudio. Não testamos conforto, áudio nem qualidade do microfone. A autonomia real depende do uso.",
    "pros": "Formato on-ear sem ponteiras intra-auriculares, uma alternativa de encaixe para música e chamadas.\nAté 57 horas de bateria anunciadas pela JBL; a duração real depende do uso.",
    "contras": "Sem cancelamento ativo de ruído (ANC), conforme a JBL.\nApoio sobre as orelhas: conforto em sessões longas não foi medido pela equipe."
  },
  {
    "id": "O6e0R2WtiZfyyf2MJe5Y",
    "titulo": "Notebook ASUS Vivobook Go 15 E1504FA-NJ1288, 16 GB RAM e SSD 512 GB",
    "categoria": "notebook",
    "comentario": "O anúncio do Mercado Livre identifica este ASUS Vivobook Go 15 como E1504FA-NJ1288, com processador AMD Ryzen 5 7520U, vídeo integrado Radeon 610M, 16 GB de RAM LPDDR5 e SSD PCIe NVMe de 512 GB. O vendedor informa Linux KeepOS e tela Full HD de 15,6 polegadas. Estes são dados da oferta consultada, não uma validação independente da configuração de fábrica. Considere a compatibilidade dos programas que pretende usar: não acompanha Windows. Não testamos desempenho, autonomia ou possibilidade de expansão. Consulte no anúncio as condições atuais de garantia, entrega e devolução.",
    "pros": "16 GB de RAM LPDDR5 e SSD de 512 GB informados no anúncio.\nRyzen 5 7520U, Radeon 610M e tela Full HD anunciados para esta oferta.",
    "contras": "Linux KeepOS anunciado: não acompanha licença Windows.\nDesempenho, autonomia e expansão não foram testados pela equipe; consulte as condições da oferta no vendedor."
  },
  {
    "id": "UvxFn4gfaexb8TvcaT5e",
    "titulo": "Mouse Logitech Sem Fio M170 Rc/nano C/pilha - Preto",
    "categoria": "informatica",
    "comentario": "O Logitech M170 é um mouse sem fio com receptor USB para navegação e trabalho cotidiano. A conexão pelo receptor permite começar sem emparelhamento Bluetooth. A Logitech anuncia até 12 meses de pilha, dependendo do uso. É uma opção para comparar se o computador tem porta USB compatível disponível; não escolha como se fosse um mouse Bluetooth sem receptor. Confira o receptor e a pilha no conjunto vendido. Não medimos precisão, conforto ou duração real da pilha.",
    "pros": "Receptor USB com instalação plug and play, conforme a Logitech.\nFormato compacto e ambidestro anunciado para uso com qualquer uma das mãos.",
    "contras": "O uso depende do receptor USB e de uma porta compatível disponível.\nAté 12 meses de pilha é uma estimativa; conforto e precisão em uso real não foram testados."
  },
  {
    "id": "huCYMmOsGPKJ8jOiJ1gR",
    "titulo": "Lavadora de Alta Pressão Compacta WAP WL 1800 1400W 1500PSI 360L/h 220V",
    "categoria": "casa",
    "comentario": "A WAP WL 1800 desta oferta é identificada como 220 V e pode ser considerada para limpeza residencial ocasional. A ficha WAP distingue pressão nominal de 1.015 PSI de pressão permissível de 1.500 PSI: o maior número não é pressão contínua medida pela equipe. O formato compacto e a alça favorecem a organização e o transporte; o bico permite regular o jato. Confira tensão, acessórios e instruções para a superfície. Não medimos eficiência, economia de água ou durabilidade.",
    "pros": "Formato compacto com alça e suportes para organizar os acessórios, segundo a WAP.\nBico com jato regulável para adequar a aplicação às instruções de limpeza.",
    "contras": "Esta oferta é identificada como 220 V; confirme a rede elétrica e a variante antes de pagar.\nPressão permissível de 1.500 PSI não equivale à nominal de 1.015 PSI. Desempenho prolongado não foi testado."
  },
  {
    "id": "mlMLB4952988337",
    "titulo": "Conversor Fibra Óptica 20km 10/100/1000mbps Gigabit Ethernet RJ45 - U Maisu",
    "categoria": "informatica",
    "comentario": "O cadastro identifica um conversor de fibra óptica U Maisu cujo título anuncia Ethernet RJ45 10/100/1000 Mbps. A descrição anterior informava 1000 MB/s: megabytes por segundo (MB/s) e megabits por segundo (Mbps) são unidades diferentes, e esse valor não é publicado como velocidade comprovada. Não medimos taxa de transferência, alcance óptico ou compatibilidade com Starlink. Confirme tipo de fibra, conectores, alimentação e compatibilidade entre os equipamentos antes de comprar. As informações do cadastro não substituem a documentação técnica do modelo.",
    "pros": "Título anuncia conexão Ethernet RJ45 10/100/1000 Mbps; confirme o modelo e os requisitos na oferta.",
    "contras": "Velocidade real e alcance óptico não foram medidos; a unidade anterior era inconsistente.\nCompatibilidade com Starlink e com os demais equipamentos não foi confirmada nesta revisão."
  },
  {
    "id": "7evzZBujin11TlbT8hvm",
    "titulo": "Notebook Dell Dc15-i51334u-a50 15.6 Fhd I5 8gb 512gb Win 11",
    "categoria": "notebook",
    "comentario": "O Notebook Dell Dc15-i51334u-a50 conta com processador Intel Core i5-1334U e sistema operacional Windows 11 Home. O dispositivo apresenta tela com resolução de 1920 px x 1080 px, taxa de atualização de 120 Hz, além de armazenamento SSD de 512 GB e 8 GB de memória RAM.",
    "pros": "",
    "contras": ""
  },
  {
    "id": "h0a3vchlbGQbAnHdbujA",
    "titulo": "Notebook Acer Aspire Go 15 Intel Core I3 1215u 8gb 256gb Ssd Linux Prateado",
    "categoria": "notebook",
    "comentario": "O Notebook Acer Aspire Go 15 AG15-51P-379H é equipado com o processador Intel Core i3-1215U e conta com 8GB de memória RAM DDR5. O modelo possui tela de 15,3 polegadas e utiliza o sistema operacional Linux, sendo apresentado com armazenamento SSD de 256GB para as necessidades do dia a dia.",
    "pros": "",
    "contras": ""
  },
  {
    "id": "TEaC0vVXmdvp4s8QMqpn",
    "titulo": "Notebook Acer Aspire 5 A515-45-R2A3 AMD Ryzen 5 Windows 11 Home 8GB 512GB SSD 15,6' Full HD",
    "categoria": "notebook",
    "comentario": "O Notebook Acer Aspire 5 A515-45-R2A3 conta com processador AMD Ryzen 5 5500U e 8 GB de memória RAM DDR4. O modelo possui tela de 15,6 polegadas com resolução Full HD e armazenamento via SSD de 512 GB, além de estrutura externa composta por material em alumínio.",
    "pros": "",
    "contras": ""
  },
  {
    "id": "kYzXt8BeErDzXsC6BlwB",
    "titulo": "Fone De Ouvido Sem Fio Havit Tw982 Enc Bluetooth 5.4 Cor Preto",
    "categoria": "fonesdeouvido",
    "comentario": "O HAVIT LIFE 01T, modelo TW982, é um fone TWS com Bluetooth 5.4 e formato intra-auricular com ponteiras na apresentação oficial. A tabela da fabricante anuncia até 7,5 horas nos fones e 33 horas com recargas no estojo, a 60% do volume. O estojo usa USB-C. ENC anunciado para chamadas não comprova ANC para ouvir; não copiamos os recursos do TW982 Pro. Não testamos som, chamadas, conforto ou autonomia real.",
    "pros": "Bluetooth 5.4 documentado na tabela oficial do TW982.\nAté 7,5 horas nos fones e 33 horas com estojo anunciadas a 60% do volume.",
    "contras": "As 33 horas incluem recargas; a duração real depende do uso e do volume.\nANC para ouvir continua sem confirmação; não é a ficha do TW982 Pro."
  },
  {
    "id": "AweCTxq7vwVQ7VmN4IIg",
    "titulo": "Roteador Mercusys Mr80x V4 Ax3000 Dual Band Wifi6",
    "categoria": "roteador",
    "comentario": "O MERCUSYS MR80X V4 é um roteador Wi-Fi 6 AX3000 dual band com portas Gigabit. A página brasileira da revisão V4 anuncia EasyMesh para rede com outros aparelhos compatíveis. Confira o firmware da unidade: a fabricante alerta para conflitos entre fornecedores e informa que o produto não obteve certificação Wi-Fi EasyMesh. AX3000 é classe de sinal, não internet de 3 Gbps; a WAN é Gigabit. Não testamos cobertura, estabilidade ou velocidade real.",
    "pros": "Wi-Fi 6 dual band e portas Gigabit documentados para a revisão V4.\nCompatibilidade EasyMesh anunciada na página brasileira V4, com condições de firmware.",
    "contras": "Um roteador sozinho não garante cobertura em todos os cômodos.\nConfirme revisão e firmware dos aparelhos; compatibilidade anunciada não é certificação Wi-Fi EasyMesh."
  },
  {
    "id": "SJRf3jhIFlr1BQadDNnH",
    "titulo": "Notebook Gamer Lenovo LOQ 15IRX9 Intel Core i5-13450HX RTX 3050 8GB 512GB SSD windows 11",
    "categoria": "notebook",
    "comentario": "O Lenovo LOQ 15IRX9 do SKU 83KH0001BR informado pelo responsável corresponde à configuração oficial com Core i5-13450HX, 8 GB de RAM DDR5 e SSD de 512 GB. A RTX 3050 para laptop tem 6 GB GDDR6 de memória de vídeo, separados da RAM do sistema. A Lenovo informa Windows 11 Home e tela FHD de 15,6 polegadas a 144 Hz. Confira o mesmo SKU e eventuais alterações do vendedor; não atribuímos desempenho de outras versões nem medimos jogos, temperatura ou autonomia.",
    "pros": "Configuração de 8 GB de RAM e SSD de 512 GB documentada para o SKU 83KH0001BR.\nRTX 3050 para laptop com 6 GB GDDR6 e tela FHD de 144 Hz informadas pela Lenovo.",
    "contras": "A RAM de 8 GB e a memória de vídeo de 6 GB são separadas; compare os requisitos dos seus programas.\nConfira o SKU e modificações do vendedor. Desempenho em jogos, temperatura e bateria não foram testados."
  }
];
export function deletionRegressionProduct(id){const p=products.find(p=>p.id===id);if(!p)throw Error("Regression fixture absent: "+id);return {...structuredClone(p),foto:'https://example.invalid/test-only.jpg',preco:123.45,precoAnterior:234.56};}
