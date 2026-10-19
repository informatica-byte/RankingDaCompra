(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.RDCComparisonIntegrity=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const title=p=>normalize(p?.titulo||p?.title);
  const labels={
    'earbuds-tws':'Fones TWS intra-auriculares','headphones-on-wireless':'Fones on-ear sem fio','headphones-over-wireless':'Headphones over-ear sem fio',
    'headsets':'Headsets para jogos e chamadas','earphones-wired':'Fones intra-auriculares com fio','earphones-open':'Fones abertos / open-ear',
    'router':'Roteadores tradicionais','router-mesh':'Sistemas Mesh','repeater':'Repetidores Wi-Fi','access-point':'Access points','satellite':'Terminais de internet por satélite',
    'notebook':'Notebooks','desktop':'Computadores de mesa','mini-pc':'Mini PCs','smartphone':'Smartphones','tablet':'Tablets','television':'Televisores',
    'projector':'Projetores','streaming':'Dispositivos de streaming / TV box','soundbar':'Soundbars','speaker-portable':'Caixas de som portáteis','speaker-boombox':'Caixas boombox','radio':'Rádios',
    'watch-smart':'Smartwatches','smart-band':'Pulseiras inteligentes','watch-digital':'Relógios digitais convencionais',
    'scooter-electric':'Patinetes elétricos','scooter-manual':'Patinetes sem motorização confirmada','bicycle-road':'Bicicletas convencionais','bicycle-stationary':'Bicicletas ergométricas','bicycle-electric':'Bicicletas elétricas / scooters com assento',
    'air-fryer':'Fritadeiras Air Fryer','printer':'Impressoras','camera-security':'Câmeras de segurança','camera-action':'Câmeras de ação',
    'keyboard-mouse':'Kits de teclado e mouse','mouse':'Mouses','keyboard':'Teclados','monitor':'Monitores','controller':'Controles de jogos','console':'Consoles de jogos',
    'power-bank':'Baterias portáteis','charger':'Carregadores','storage':'Unidades de armazenamento','vacuum':'Aspiradores','washer-pressure':'Lavadoras de alta pressão',
    'fan':'Ventiladores','mop':'Mops e esfregões','coffee-maker':'Cafeteiras','blender':'Liquidificadores','mixer':'Batedeiras','air-conditioner':'Condicionadores de ar','humidifier':'Umidificadores','dehumidifier':'Desumidificadores',
    'drill':'Furadeiras','driver':'Parafusadeiras','impact-wrench':'Chaves de impacto','polisher-orbital':'Politrizes roto-orbitais','sander':'Lixadeiras','compressor':'Compressores portáteis','trimmer':'Aparadores de pelos','hair-dryer':'Secadores de cabelo',
    'building-blocks':'Blocos de montar','toy-rc':'Veículos de controle remoto','drone':'Drones','book':'Livros','backpack':'Mochilas','suitcase':'Malas','shoes':'Tênis e calçados esportivos',
    'body-splash':'Body splash','perfume':'Perfumes','sunscreen':'Protetores solares','creatine':'Creatina','protein':'Suplementos proteicos','scale':'Balanças corporais',
  };
  function type(p){
    const t=title(p);
    if(!t)return '';
    // A matching device name inside an accessory title does not establish equivalence.
    if(/^(?:(?:kit|conjunto) (?:de )?)?(?:capa|pelicula|suporte|case|almofada|espuma|adaptador|cabo|refil|cartucho|toner|pneu|selim|banco bike)\b/.test(t))return '';
    if(/^(?:power bank|carregador portatil)\b/.test(t))return 'power-bank';
    if(/^carregador\b/.test(t))return 'charger';
    if(/intercomunicador|fone.*capacete/.test(t))return '';
    if(/open ear|orelha aberta|ear clip|earcuff|\bows\b/.test(t))return 'earphones-open';
    if(/headset|jbl quantum/.test(t))return 'headsets';
    if(/headphone|over ear|on ear|jbl.*(?:520|510|720|770)\s*bt/.test(t)){
      if(!/bluetooth|sem fio|\b(?:520|510|720|770)\s*bt\b/.test(t))return '';
      return /on ear|jbl.*(?:520|510)\s*bt/.test(t)?'headphones-on-wireless':'headphones-over-wireless';
    }
    if(/fone|earbud|\bbuds\b|soundcore.*p30i/.test(t)){
      if(/com fio|\bp2\b|3 5\s*mm/.test(t)&&!/bluetooth|sem fio|tws/.test(t))return 'earphones-wired';
      if(/intra auricular|in ear|redmi.*buds 6 play|galaxy.*buds core|soundcore.*p30i|lenovo.*lp40|havit.*tw982/.test(t))return 'earbuds-tws';
      return ''; // TWS or a hook alone does not prove in-ear versus open fit.
    }
    if(/starlink|internet.*satelite/.test(t))return 'satellite';
    if(/repetidor|extensor.*wi fi/.test(t))return 'repeater';
    if(/access point|ponto de acesso/.test(t))return 'access-point';
    if(/roteador|router|tp link deco|intelbras twibi/.test(t))return /mesh|\bdeco\b|\btwibi\b/.test(t)?'router-mesh':'router';
    if(/^(?:notebook|laptop|macbook|chromebook)\b/.test(t))return 'notebook';
    if(/mini pc/.test(t))return 'mini-pc';
    if(/^(?:computador|pc gamer|pc completo)\b/.test(t))return 'desktop';
    if(/^(?:smartphone|celular|iphone|poco|redmi|samsung galaxy)\b/.test(t))return 'smartphone';
    if(/^(?:tablet|ipad)\b/.test(t))return 'tablet';
    if(/projetor/.test(t))return 'projector';
    if(/tv box|streaming stick|fire stick|chromecast|roku express/.test(t))return 'streaming';
    if(/smart tv|televisor|televisao/.test(t))return 'television';
    if(/soundbar|barra de som/.test(t))return 'soundbar';
    if(/radio.*(?:am fm|retro)/.test(t))return 'radio';
    if(/caixa de som|speaker|boombox/.test(t))return /boombox/.test(t)?'speaker-boombox':'speaker-portable';
    if(/smart band|pulseira inteligente/.test(t))return 'smart-band';
    if(/smartwatch|smart watch|relogio inteligente|galaxy watch|apple watch|huawei watch/.test(t))return 'watch-smart';
    if(/relogio.*(?:digital|casio|g shock)/.test(t))return 'watch-digital';
    if(/patinete/.test(t))return /eletric/.test(t)?'scooter-electric':'scooter-manual';
    if(/bicicleta|bikelete/.test(t))return /ergometrica|spinning/.test(t)?'bicycle-stationary':/eletric|scooter/.test(t)?'bicycle-electric':'bicycle-road';
    if(/fritadeira|air fryer/.test(t))return 'air-fryer';
    if(/impressora/.test(t))return 'printer';
    if(/camera/.test(t))return /acao|action|gopro/.test(t)?'camera-action':/seguranca|wifi|wi fi|ip|vigilancia/.test(t)?'camera-security':'';
    if(/teclado/.test(t)&&/mouse/.test(t))return 'keyboard-mouse';
    if(/^mouse\b/.test(t))return 'mouse';
    if(/^teclado\b/.test(t))return 'keyboard';
    if(/^monitor\b/.test(t))return 'monitor';
    if(/controle|joystick|gamepad/.test(t)&&/gamesir|videogame|joystick|gamepad|controle.*sem fio/.test(t))return 'controller';
    if(/playstation|console.*xbox|nintendo switch/.test(t))return 'console';
    if(/^(?:ssd|hd externo|pendrive|pen drive)\b/.test(t))return 'storage';
    const rules=[[/aspirador/,'vacuum'],[/lavadora.*pressao/,'washer-pressure'],[/ventilador/,'fan'],[/mop|esfregao/,'mop'],[/cafeteira/,'coffee-maker'],[/liquidificador/,'blender'],[/batedeira/,'mixer'],[/ar condicionado/,'air-conditioner'],[/desumidificador/,'dehumidifier'],[/umidificador/,'humidifier'],[/chave de impacto/,'impact-wrench'],[/parafusadeira/,'driver'],[/furadeira/,'drill'],[/politriz.*roto orbital/,'polisher-orbital'],[/lixadeira/,'sander'],[/compressor.*portatil|mini.*compressor/,'compressor'],[/aparador.*pelos|barbeador|oneblade/,'trimmer'],[/secador.*cabelo/,'hair-dryer'],[/bloco.*montar|brastoy|\blego\b/,'building-blocks'],[/(carro|carrinho|veiculo).*controle remoto/,'toy-rc'],[/\bdrone/,'drone'],[/\blivro|biblioteca/,'book'],[/^mochila/,'backpack'],[/^mala\b/,'suitcase'],[/^tenis\b/,'shoes'],[/body splash/,'body-splash'],[/perfume|eau de parfum|eau de toilette/,'perfume'],[/protetor solar/,'sunscreen'],[/creatina|\bcreatine\b/,'creatine'],[/whey protein/,'protein'],[/balanca.*(?:corporal|bioimpedancia)/,'scale']];
    return rules.find(([regex])=>regex.test(t))?.[1]||'';
  }
  function modelKey(p){
    const t=title(p);
    for(const [pattern,key]of [[/redmi.*buds\s*6\s*play/,'redmi-buds-6-play'],[/soundcore.*\bp30i\b/,'soundcore-p30i'],[/galaxy.*buds\s*core/,'galaxy-buds-core'],[/jbl.*tune\s*520\s*bt/,'jbl-tune-520bt'],[/lenovo.*\blp40\b/,'lenovo-lp40'],[/havit.*\btw982\b/,'havit-tw982']])if(pattern.test(t))return key;
    // Fragrance names/ingredients are not merely packaging colours.
    if (['perfume','body-splash','sunscreen','creatine','protein'].includes(type(p))) return t;
    // Keep RAM/storage, voltage, size, quantity and editions: only colour words disappear.
    return t.replace(/\b(?:cor|cores|preto|preta|branco|branca|azul|rosa|verde|amarelo|amarela|vermelho|vermelha|cinza|grafite|prateado|dourado|roxo|lilas|black|white|blue)\b/g,' ').replace(/\s+/g,' ').trim();
  }
  function partition(products){
    const groups=new Map();
    for(const product of products){
      const key=type(product), groupKey=key||'unconfirmed';
      if(!groups.has(groupKey))groups.set(groupKey,{type:key,label:labels[key]||'Tipo ou formato a confirmar — consulta individual',items:[]});
      const group=groups.get(groupKey), model=modelKey(product);
      let item=group.items.find(x=>x.model===model);
      if(!item){item={model,product,alternatives:[]};group.items.push(item);}else item.alternatives.push(product);
    }
    for(const group of groups.values())group.items.sort((a,b)=>title(a.product).localeCompare(title(b.product),'pt-BR'));
    return [...groups.values()].sort((a,b)=>!!b.type-!!a.type||a.label.localeCompare(b.label,'pt-BR'));
  }
  function comparable(products){return products.length>=2&&!!type(products[0])&&products.every(p=>type(p)===type(products[0]))&&new Set(products.map(modelKey)).size===products.length;}
  return {normalize,type,modelKey,partition,comparable,label:p=>labels[type(p)]||''};
});
