import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import uniqueness from '../product-uniqueness.js';

// Reuse the generator's complete source. No extra Firestore query or write.
export async function buildIdentityIndex(products,root=process.cwd()){
 if(!Array.isArray(products))throw Error('Fonte incompleta para proteger cadastros duplicados.');
 const entries={};let skipped=0;
 for(const product of products){
  if(!uniqueness.validId(product?.id)||product.sistema===true)continue;
  let identity;try{identity=uniqueness.identify(product,{strict:false});}catch{skipped++;continue;}
  for(const key of await Promise.all(identity.keys.map(uniqueness.hash)))entries[key]=[...new Set([...(entries[key]||[]),product.id])].sort();
 }
 const ordered=Object.fromEntries(Object.entries(entries).sort(([left],[right])=>left.localeCompare(right)));
 const index={...uniqueness.registry({version:1,entries:ordered}),complete:true,generatedAt:new Date().toISOString()};
 await writeFile(resolve(root,'product-identities.json'),JSON.stringify(index)+'\n');
 console.log('Proteção de cadastros: '+Object.keys(entries).length+' identidades; '+skipped+' cadastro(s) legado(s) sem link inequívoco.');
 return index;
}
