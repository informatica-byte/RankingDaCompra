import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const guidance = Object.freeze({
  b052WcTAD3j2UDZHQiXY: 'Confira na oferta o conteúdo da embalagem: balde, cabo e número de refis. Se já tem refis, confirme o encaixe. Compare as dimensões do conjunto com o espaço disponível para guardar.',
  FlqPY3yHJ2xPoNgnhSTE: 'Confira o código do modelo, a cor e o conteúdo da caixa. Se você precisa de cancelamento de ruído, chamadas ou integração com um aplicativo, verifique esses recursos para o modelo e seu celular. Compare a autonomia dos fones e a autonomia com o estojo separadamente.',
  EmrdwlcDgCCM5suoz8dB: 'Confira o código do modelo, a tensão e o conteúdo da caixa. Se pretende imprimir pelo celular ou digitalizar, verifique os modos de conexão e os recursos da unidade. Para estimar o custo de uso, consulte o código das tintas compatíveis e o rendimento informado pelo fabricante.',
  NQAtVQKwZQtKxXtEn21Q: 'Confirme a RAM física, o armazenamento e a região da unidade anunciada. Se você precisa de NFC, garantia local ou compatibilidade com sua operadora, confira essas condições para a versão selecionada.',
  UNQtBcYJ9obcCPWURmeq: 'Confira separadamente a RAM física, a memória virtual e o armazenamento. Se o anúncio somar RAM física e virtual, use a RAM física para comparar com outros aparelhos. Confirme também a versão e a cor selecionadas.',
});

export function insertGuidance(html,id){
  if(!Object.hasOwn(guidance,id)) throw new Error('Ficha fora do lote');
  const mark='data-local-purchase-guidance="'+id+'"';
  if(html.includes(mark)) return html;
  const path='/produto/'+id+'-20260810-1.html';
  if(!html.includes('rel="canonical" href="https://rankingdacompra.com.br'+path+'"')||
    html.split('</article>').length!==2||/name=["']robots["'][^>]*noindex/i.test(html)){
    throw new Error('Identidade ou estrutura inesperada: '+id);
  }
  return html.replace('</article>','<section '+mark+'><h2>O que conferir antes de comprar</h2><p>'+guidance[id]+'</p><p>São critérios de compra, não uma confirmação das especificações da oferta atual.</p></section></article>');
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const files=await Promise.all(Object.keys(guidance).map(async id=>{
    const file=new URL('../produto/'+id+'-20260810-1.html',import.meta.url);
    const old=await readFile(file,'utf8');
    return {file,old,next:insertGuidance(old,id)};
  }));
  for(const {file,old,next} of files) if(next!==old) await writeFile(file,next,'utf8');
}
