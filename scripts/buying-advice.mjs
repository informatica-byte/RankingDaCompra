// Buying questions, not measured performance or merchant guarantees.
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const BUYING_ADVICE = [
  {id:'GjHJtzdsIhbmSINvhPeX', model:/JBL.*520\s*BT/i, use:'Ouvir música e fazer chamadas sem colocar um fone dentro do ouvido.', check:'Experimente o apoio sobre as orelhas e confira a compatibilidade com seu celular. A autonomia anunciada não é uma medição nossa.', alternative:'Se o objetivo principal é reduzir barulho de transporte ou escritório, compare modelos com ANC documentado. Este modelo não oferece ANC.'},
  {id:'ARscPKCMZs3D8k22qltl', model:/Redmi.*Buds\s*6\s*Play/i, use:'Comparar um fone compacto sem fio para levar no bolso.', check:'Confirme autonomia do fone separada do total com estojo. IPX4 não comprova proteção contra poeira nem autoriza mergulho.', alternative:'Se não gosta de encaixe dentro do ouvido, compare formatos abertos ou headphones. Não escolha apenas pela autonomia total anunciada.'},
  {id:'O6e0R2WtiZfyyf2MJe5Y', model:/Asus.*Vivobook.*7520u.*16gb/i, use:'Montar uma opção de notebook para estudo e trabalho, conforme os programas usados.', check:'Confirme RAM, capacidade do SSD, possibilidade de expansão e sistema operacional da unidade. Keep OS não equivale a uma licença do Windows.', alternative:'Se precisa de um programa exclusivo do Windows ou jogos exigentes, compare requisitos, licença e vídeo dedicado antes de comprar.'},
  {id:'qZUWO8WSrcOKWVrAqTW7', model:/Tp.?link.*Ex1500/i, use:'Comparar um roteador Wi-Fi 6 para distribuir a internet de casa.', check:'Confira velocidade das portas, posição do modem e aparelhos compatíveis. AX1500 não é uma promessa de velocidade real em um único aparelho.', alternative:'Se o problema é uma área distante sem sinal, avalie instalação e uma rede com unidades compatíveis. Um roteador sozinho não garante cobertura total.'},
  {id:'huCYMmOsGPKJ8jOiJ1gR', model:/WAP.*WL\s*1800/i, use:'Avaliar uma lavadora para tarefas domésticas de limpeza.', check:'Confirme tensão, mangueira, acessórios incluídos e pressão de trabalho no manual. Pressão máxima anunciada não equivale à pressão contínua medida.', alternative:'Para uso prolongado ou profissional, compare regime de trabalho, assistência e acessórios, não apenas o maior número de PSI.'},
  {id:'f3MOXgokgTifrolFYOhc', model:/Politriz.*PRO950.*Black\s*Tools/i, use:'Comparar uma politriz para um serviço de polimento definido.', check:'Confirme movimento, órbita, diâmetro de boinas, velocidades, tensão e acessórios do kit. Potência não comprova qualidade do acabamento.', alternative:'Se ainda está aprendendo, compare instruções e técnica adequada à superfície. Um equipamento diferente pode exigir outra boina e outro procedimento.'},
  {id:'VzQgxGhowdzlfNshI3ZC', model:/Power\s*Bank.*20000mah/i, use:'Avaliar energia extra para o celular fora de casa.', check:'O título anuncia 22,5 W e o resumo cita 20 W. Confirme potência por porta e protocolo no modelo entregue; não tratamos o maior valor como comprovado.', alternative:'Se precisa carregar notebook, confirme USB-C Power Delivery, tensão e potência exigidas. Capacidade em mAh sozinha não confirma compatibilidade.'},
  {id:'tqUaLEFDAafDWemxheMX', model:/Pendrive.*8gb.*Usb.?c/i, use:'Transferir arquivos entre aparelhos com conectores compatíveis.', check:'Confirme capacidade de 8 GB, suporte a OTG no celular e formato dos arquivos. A velocidade citada no anúncio não foi medida pela equipe.', alternative:'Para vídeos grandes ou backup frequente, compare capacidade e velocidade real de gravação. Não mantenha a única cópia de arquivos importantes no pendrive.'},
  {id:'7CSQkSXeUHn9yzYR29hF', model:/Pen\s*Drive.*64gb.*Usb\s*2/i, use:'Levar documentos e arquivos em um dispositivo pequeno.', check:'Confirme capacidade e conector. A indicação USB 2.0 não comprova as velocidades citadas no resumo; não fizemos teste de leitura ou gravação.', alternative:'Para transferir arquivos grandes com frequência, compare alternativas com velocidade de gravação documentada e capacidade adequada.'},
  {id:'t4cAWb59UILzYeRHO0qk', model:/aweshine.*Trip[eé]/i, use:'Apoiar o celular para gravar ou fotografar sem segurá-lo.', check:'Confirme abertura da garra, carga máxima e compatibilidade do controle. Altura máxima anunciada não comprova estabilidade ao vento.', alternative:'Para câmeras pesadas, gravação ao ar livre ou movimento, compare carga suportada, base e cabeça adequadas ao equipamento.'},
];
export function buyingAdvice(product) {
  return BUYING_ADVICE.find(item => item.id === product?.id && item.model.test(product?.titulo || '')) || null;
}
export function renderBuyingAdvice(product) {
  const advice = buyingAdvice(product);
  if (!advice) return '';
  return `<section class="panel" data-buying-advice style="margin-top:24px"><h2>Antes de decidir a compra</h2><p><b>Quando considerar:</b> ${esc(advice.use)}</p><p><b>O que conferir nesta oferta:</b> ${esc(advice.check)}</p><p><b>Quando procurar outra opção:</b> ${esc(advice.alternative)}</p><p class="fine">Orientação editorial baseada na identificação e nas informações cadastradas; não é teste prático. Confira o preço com sua condição de pagamento, frete, prazo e variante na loja. A compra e o pagamento acontecem no vendedor, não neste site.</p></section>`;
}
export function renderGuideChecklist(category) {
  const router = /roteador/i.test(category);
  const headphone = /fone/i.test(category);
  if (!router && !headphone) return '';
  const rows = router ? [
    ['Plano rápido por cabo', 'Confira portas WAN e LAN Gigabit e os limites do plano. A classe Wi-Fi não representa a velocidade de uma porta.'],
    ['Sinal em cômodos distantes', 'Confira paredes, posição e cabeamento. Compare Mesh somente com equipamentos compatíveis; não prometemos cobertura sem medir.'],
    ['Muitos aparelhos conectados', 'Liste os aparelhos, os usos simultâneos e as bandas disponíveis. Não inferimos capacidade apenas pelo número de antenas.'],
  ] : [
    ['Música por várias horas', 'Compare formato, conforto e autonomia no fone. Não some autonomia do estojo como se fosse uma única sessão.'],
    ['Chamadas e reuniões', 'Confira compatibilidade e amostras do microfone. ENC para chamadas não confirma ANC para ouvir.'],
    ['Transporte e ambientes ruidosos', 'Confirme ANC se esse é seu requisito. TWS, on-ear e over-ear têm encaixes diferentes e não devem ser escolhidos só pelo preço.'],
  ];
  return `<section class="method" data-buying-checklist><h2>Comece pela necessidade que você quer resolver</h2>${rows.map(([use, advice]) => `<h3>${esc(use)}</h3><p>${esc(advice)}</p>`).join('')}<p>Abra a análise do modelo e compare a mesma característica nas alternativas. Antes de sair para a loja, confira preço total com frete, condição de pagamento, garantia e prazo. Uma especificação a confirmar não deve decidir a compra.</p></section>`;
}
