import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Optional read-only publication guard. Never edits the source or Firestore.
export function assertPublishedPricesPreserved(before,after){
  const index=catalogue=>{
    if(!Array.isArray(catalogue?.products))throw new Error('Catálogo inválido para conferir preços.');
    const map=new Map();
    for(const p of catalogue.products){
      if(!p?.id||map.has(p.id))throw new Error('Identidade ausente ou duplicada no catálogo.');
      map.set(p.id,p);
    }
    return map;
  };
  const old=index(before),current=index(after);
  let checked=0;
  for(const [id,p]of current){
    const original=old.get(id);if(!original)continue;
    for(const key of ['preco','precoAnterior','precoPromocional']){
      if(!Object.is(p[key],original[key]))throw new Error('Publicação bloqueada: preço divergente em '+id+' ('+key+'). Nenhum cadastro foi alterado por esta verificação.');
    }
    checked++;
  }
  return {checked,added:[...current.keys()].filter(id=>!old.has(id)).length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw new Error('Informe os catálogos anterior e gerado.');
  const result=assertPublishedPricesPreserved(...process.argv.slice(2).map(file=>JSON.parse(readFileSync(file,'utf8'))));
  console.log('Preços preservados: '+result.checked+' produtos existentes; '+result.added+' novos produtos.');
}
