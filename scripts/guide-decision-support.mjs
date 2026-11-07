// Editorial questions, not inferred product specifications or automatic rankings.
const guides={
 'melhores-notebook.html':{
  heading:'Antes de comparar notebooks',
  checks:['Anote os programas que pretende usar e confira os requisitos nos sites dos desenvolvedores.','Confira o código completo do notebook, processador, RAM física, armazenamento e sistema operacional.','Se pretende ampliar a memória ou o SSD, peça a documentação dessa configuração antes de contar com a expansão.'],
  questions:[
   ['O nome do processador basta para escolher?','Não decida apenas por nomes como i3, i5 ou Ryzen. Compare o código completo informado nas fichas e os requisitos dos programas que você usa. A ficha documental não mede a velocidade no seu trabalho.'],
   ['Como conferir se atende à minha rotina?','Separe o que é indispensável: programas, portas, tamanho, peso e uso longe da tomada. Se autonomia, expansão ou compatibilidade não estiverem documentadas, pergunte ao vendedor antes da compra.'],
   ['RAM e armazenamento são a mesma coisa?','São informações distintas. Confira separadamente a memória RAM e o armazenamento. Não conclua que um modelo é mais rápido apenas porque tem mais espaço para arquivos.']
  ]
 },
 'melhores-celular.html':{
  heading:'Antes de comparar celulares',
  checks:['Confira o modelo, a variante, a RAM física e o armazenamento da oferta.','Liste as funções que realmente precisa, como conexão móvel, NFC ou expansão de armazenamento, e confira cada uma na variante.','Confirme conteúdo da caixa, garantia e condições da oferta; não presuma carregador ou acessórios pelas fotos.'],
  questions:[
   ['Todos os itens deste guia são celulares?','Não. A categoria cadastrada também pode reunir acessórios. Use o grupo Smartphones abaixo para comparar aparelhos; não coloque carregadores, baterias portáteis ou outros acessórios como concorrentes de um telefone.'],
   ['O nome do modelo garante a mesma configuração?','Confira a configuração da oferta e o código da variante. Nomes parecidos não bastam para confirmar memória, conexões ou itens incluídos. Se houver contradição, não escolha uma versão por suposição.'],
   ['Mais megapixels ou maior bateria garantem melhor resultado?','Esses números isolados não comprovam qualidade de imagem ou autonomia no seu uso. Veja as fontes e limitações da ficha; este site não transforma especificações anunciadas em testes próprios.']
  ]
 },
 'melhores-smart-tv.html':{
  heading:'Antes de comparar Smart TVs',
  checks:['Anote as medidas disponíveis para tela, base e instalação; confira as dimensões completas da TV.','Liste os aplicativos e aparelhos que pretende usar e confira compatibilidade, sistema e conexões do modelo exato.','Diferencie o que está documentado do que depende de teste: imagem, som e resposta em jogos não são garantidos só pelo título.'],
  questions:[
   ['Basta comparar o tamanho em polegadas?','Não. Confira também as dimensões com e sem base, a resolução e as conexões necessárias. Use as medidas do modelo, não uma estimativa feita apenas pela diagonal da tela.'],
   ['Como saber se meus aplicativos vão funcionar?','Procure a disponibilidade no sistema e na documentação do modelo. A simples expressão Smart TV não confirma todo aplicativo; se isso for decisivo, confirme antes da compra.'],
   ['O que conferir para usar com um console?','Confira as entradas e os recursos exigidos pelo console na documentação de ambos. Não trate resolução ou números de frequência do anúncio como prova de compatibilidade com um modo específico de jogo.']
  ]
 }
};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const decisionGuideFiles=Object.keys(guides);
export function applyGuideDecisionSupport(html,file){
 const guide=guides[file];if(!guide||!/<main\b/i.test(html))return html;
 html=html.replace(/<!-- guide-decision:start -->[\s\S]*?<!-- guide-decision:end -->/g,'');
 const content='<!-- guide-decision:start --><section class="notice" data-guide-decision aria-labelledby="guide-decision-heading"><h2 id="guide-decision-heading">'+esc(guide.heading)+'</h2><ol>'+guide.checks.map(c=>'<li>'+esc(c)+'</li>').join('')+'</ol>'+guide.questions.map(([q,a])=>'<details><summary>'+esc(q)+'</summary><p>'+esc(a)+'</p></details>').join('')+'<p><a href="/comparar.html">Abrir o comparador e selecionar modelos manualmente</a></p><p>Este roteiro ajuda a formular perguntas. Não é teste de produto nem recomendação automática.</p></section><!-- guide-decision:end -->';
 // After the introductory material, before the existing type navigation.
 const nav=html.indexOf('<nav aria-label="Tipos de produto"');
 if(nav>=0)return html.slice(0,nav)+content+html.slice(nav);
 return html.replace('</main>',content+'</main>');
}
