import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comparisonData, comparisonFamily, decisionData, renderProductDecision } from './product-decision.mjs';

const feature = (data, label) => data.features.find(item => item.label === label);

test('JBL publicado mantém ausência de ANC e autonomia anunciada, sem inventar teste', () => {
  // Public editorial record captured on 2026-10-11. A fixed fixture permits
  // future legitimate removal/replacement of the catalogue item.
  const product = {
    id:'GjHJtzdsIhbmSINvhPeX', titulo:'Fone de Ouvido JBL Tune 520BT Bluetooth 5.3 Preto',
    comentario:'O JBL Tune 520BT é um fone on-ear Bluetooth 5.3 para música e chamadas. O fabricante informa até 57 horas de bateria; a duração real varia com volume e uso. Não possui cancelamento ativo de ruído (ANC): o isolamento é passivo. Considere-o para uso cotidiano se você aceita o formato apoiado nas orelhas; para ambientes muito ruidosos, compare alternativas com ANC. Não realizamos testes de conforto ou de qualidade do microfone.',
    pros:'Bluetooth 5.3 informado na ficha técnica da JBL.\nAutonomia anunciada de até 57 horas; resultado real depende do uso.',
    contras:'Sem cancelamento ativo de ruído (ANC), conforme o fabricante.\nFormato on-ear apoiado nas orelhas: conforto após longos períodos não foi testado pela equipe.',
    preco:'227,05', foto:'https://http2.mlstatic.com/D_NQ_NP_645297-MLA99992011927_112025-F.jpg',
    precoAtualizadoManualmenteEm:'2026-10-11T10:27:18.628Z', precoConferenciaId:'3d87d775-4b84-45c0-b7a0-a7e2df2a43ea',
  };
  const before = JSON.stringify(product);
  const comparison = comparisonData(product);
  assert.equal(comparison.family, 'headphone');
  assert.equal(feature(comparison, 'Cancelamento ativo de ruído').state, 'no');
  assert.equal(feature(comparison, 'Autonomia no fone').value, 'Até 57 h anunciadas');
  assert.equal(feature(comparison, 'Autonomia no fone').basis, 'fabricante');
  assert.match(feature(comparison, 'Autonomia no fone').sourceUrl, /^https:\/\//);
  assert.equal(feature(comparison, 'Formato').value, 'On-ear (sobre as orelhas)');
  assert.equal(feature(comparison, 'Versão Bluetooth').value, 'Bluetooth 5.3');
  assert.equal(feature(comparison, 'Microfone').state, 'yes', 'microfone agora confirmado na ficha oficial do modelo');
  assert.match(feature(comparison, 'Microfone').sourceUrl,/jbl.com.br\/JBLT520BTBLK/);
  const html = renderProductDecision(product);
  assert.match(html, /Cancelamento ativo de ruído — Não possui, segundo a ficha/);
  assert.match(html, /Até 57 h anunciadas/);
  assert.match(html, /não medida pela equipe/);
  assert.match(html, /produto=GjHJtzdsIhbmSINvhPeX/);
  assert.doesNotMatch(html, /Cancelamento ativo de ruído — não confirmado/);
  assert.equal(JSON.stringify(product), before, 'preços, links, fotos e provas não podem ser mutados');
});

test('comparação divulga fontes limitadas e não escolhe maior especificação contraditória', () => {
  const product = {titulo: 'Fone Bluetooth 5.3 TWS', comentario: 'Bluetooth 5.0; autonomia anunciada de até 6 horas; até 30 horas de bateria com estojo', contras: 'Até 4 horas de bateria no fone'};
  const data = comparisonData(product);
  assert.equal(data.family, 'fone-tws');
  assert.equal(feature(data, 'Versão Bluetooth').state, 'unknown');
  assert.equal(feature(data, 'Autonomia no fone').state, 'unknown');
  assert.equal(feature(data, 'Autonomia com estojo').value, 'Até 30 h anunciadas');
  assert.equal(feature(data, 'Autonomia com estojo').basis, 'cadastro');
  assert.equal(feature(data, 'Autonomia com estojo').sourceUrl, undefined);
  assert.equal(feature(data, 'Cancelamento ativo de ruído').state, 'unknown');
  const reused = comparisonData({id:'GjHJtzdsIhbmSINvhPeX',titulo:'Fone de outra marca',comentario:'Autonomia anunciada de até 57 horas'});
  assert.equal(feature(reused, 'Autonomia no fone').basis, 'cadastro', 'ID reutilizado não herda a fonte de outro modelo');
});

test('roteador e notebook usam apenas especificações explicitamente informadas', () => {
  const router = comparisonData({titulo: 'Roteador AX1500 Wi-Fi 6 Dual Band 4 portas Gigabit', comentario: 'Compatível com EasyMesh', contras: 'EasyMesh não garante cobertura em todos os cômodos'});
  assert.equal(router.family, 'roteador');
  assert.equal(feature(router, 'Wi-Fi 6').state, 'yes');
  assert.equal(feature(router, 'Rede Mesh').state, 'yes');
  assert.equal(feature(router, 'Quantidade de portas').value, '4 portas anunciadas');
  assert.equal(comparisonData({titulo:'Repetidor e roteador de sinal'}), null);
  const notebook = comparisonData({titulo:'Notebook 16GB RAM 512GB SSD Intel Core i5-12450H'});
  assert.equal(feature(notebook, 'Memória RAM').value, '16 GB');
  assert.equal(feature(notebook, 'Armazenamento SSD').value, '512 GB');
  assert.equal(feature(notebook, 'Processador').value, 'Intel Core i5-12450H');
  assert.equal(comparisonFamily({titulo:'Capa para notebook 16GB'}), null);
  assert.equal(feature(comparisonData({titulo:'Notebook', comentario:'Confirme se tem 16 GB RAM'}), 'Memória RAM').state, 'unknown');
});

test('família específica não nasce de uma recomendação de alternativa ou de título genérico', () => {
  assert.equal(comparisonFamily({titulo:'Fone Bluetooth',comentario:'Compare alternativas on-ear'}), 'fone');
  assert.equal(comparisonFamily({titulo:'Headset gamer P2'}), 'headset');
  assert.equal(comparisonFamily({titulo:'Fone P2 com fio'}), 'fone-com-fio');
  assert.equal(comparisonFamily({titulo:'Fone TWS Bluetooth'}), 'fone-tws');
  assert.equal(comparisonFamily({titulo:'Fone',comentario:'Formato on-ear e in-ear'}), 'fone');
  assert.equal(comparisonFamily({titulo:'Fone on-ear',contras:'Não é intra-auricular'}), 'headphone');
  assert.equal(comparisonFamily({titulo:'Capa para fone Bluetooth'}), null);
  assert.equal(comparisonFamily({titulo:'Fonte para notebook 16GB'}), null);
  assert.equal(comparisonFamily({titulo:'Kit de suporte para roteador'}), null);
  assert.equal(renderProductDecision({titulo:'🎧 Capa para fone Bluetooth'}), '');
  assert.equal(renderProductDecision({titulo:'Produto sem categoria'}), '');
});

test('HTML escapa conteúdo e não usa ID arbitrário no link do comparador', () => {
  const product = {id:'a" onclick="bad',titulo:'Fone <script>Bluetooth 5.3</script>',comentario:'Formato on-ear'};
  const html = renderProductDecision(product);
  assert.doesNotMatch(html, /<script>|onclick=|produto=/);
  assert.match(html, /family=headphone/);
  assert.equal(decisionData({titulo:'Roteador',contras:'Sem portas Gigabit'}).criteria.find(item => item.label === 'Portas Gigabit').state, 'no');
});

test('notebook não inclui power bank e une apenas refinamentos compatíveis de CPU', () => {
  const asus = {id:'O6e0R2WtiZfyyf2MJe5Y',titulo:'Notebook Asus Vivobook Go 15 Amd Ryzen 5 7520u 16gb 512ssd Mixed Black',comentario:'Notebook Asus Vivobook Go 15 Amd Ryzen 5 7520u 16gb 512ssd Mixed Black. Modelo de placa gráfica integrada: 610M. Linha de placa gráfica integrada: Radeon. Modelo do processador: 7520U. Linha do processador: Ryzen 5. Marca do processador: AMD. Versão do sistema operacional: Keep OS.. Informações consultadas no anúncio oficial do Mercado Livre. Confira preço, estoque, frete e prazo no momento da compra.'};
  const basike = {id:'sinwoGjrsJl5UMA13pES',titulo:'Power Bank Basike 20000mAh para Notebook e Celular com Cabo USB-C 65W'};
  assert.equal(comparisonData(basike), null);
  const actual = comparisonData(asus);
  assert.equal(feature(actual, 'Processador').state, 'yes', 'configuração reproduzida do anúncio, não da ficha de fábrica');
  assert.equal(feature(actual, 'Processador').basis, 'cadastro');
  assert.match(feature(actual, 'Processador').value, /7520U.*segundo o anúncio/);
  assert.equal(feature(actual, 'Memória RAM').basis, 'cadastro');
  assert.match(feature(actual, 'Memória RAM').value, /16 GB/);
  assert.match(feature(actual, 'Armazenamento SSD').value, /512 GB SSD/);
  const unconfirmed=comparisonData({...asus,id:'sem-sku-confirmado'});
  assert.equal(feature(unconfirmed, 'Armazenamento SSD').state,'unknown','512ssd sem fonte e SKU não comprova capacidade');
  const labelled = comparisonData({titulo:'Notebook',comentario:'Modelo do processador: 7520U. Linha do processador: Ryzen 5. Marca do processador: AMD.'});
  assert.equal(feature(labelled, 'Processador').value, 'AMD Ryzen 5 7520U');
  const core = comparisonData({titulo:'Notebook Acer Intel Core I3 1215u',comentario:'Linha do processador: Core i3. Modelo do processador: 1215U. Marca do processador: Intel.'});
  assert.equal(feature(core, 'Processador').value, 'Intel Core i3-1215U');
  const conflict = comparisonData({titulo:'Notebook AMD Ryzen 5 7520U',comentario:'Modelo do processador: 5500U. Linha do processador: Ryzen 5. Marca do processador: AMD.'});
  assert.equal(feature(conflict, 'Processador').state, 'unknown');
  const familyConflict = comparisonData({titulo:'Notebook Intel Core i3-1215U',comentario:'Linha do processador: Ryzen 5. Modelo do processador: 7520U.'});
  assert.equal(feature(familyConflict, 'Processador').state, 'unknown');
});
