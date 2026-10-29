import {access,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import imageData from '../product-image-data.js';

export async function materializeLocalProductImages(products,directory,readQueue){
 await mkdir(directory,{recursive:true});const done=new Map();
 for(const product of products){
  const descriptor=imageData.descriptor(product);if(!descriptor||done.has(descriptor.fileName))continue;
  const target=resolve(directory,descriptor.fileName);let bytes;
  try{await access(target);bytes=new Uint8Array(await readFile(target));imageData.dimensions(bytes);if(await imageData.digest(bytes)!==descriptor.hash)throw Error('integridade');}
  catch(error){
   if(error.code!=='ENOENT')throw Error('A cópia local da imagem não passou na validação: '+product.id);
   const record=await readQueue(descriptor);if(!record)throw Error('Foto local pendente não encontrada para '+product.id+'. A publicação foi preservada.');
   const validated=await imageData.validate(record,product.id);if(validated.hash!==descriptor.hash)throw Error('A foto da fila não corresponde ao produto '+product.id);
   bytes=validated.bytes;await writeFile(target,bytes);
  }
  done.set(descriptor.fileName,descriptor);
 }
 return done;
}
