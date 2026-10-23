import {readFileSync} from 'node:fs';

// Historical regression input, intentionally independent of the regenerated storefront.
// A paused/replaced listing must not erase coverage of identity and source guards.
const snapshot=JSON.parse(readFileSync(new URL('./reviewed-marketplace-products.json',import.meta.url),'utf8'));
export function reviewedProducts(){return structuredClone(snapshot.products);}
export function reviewedProduct(id){
  const product=snapshot.products.find(p=>p.id===id);
  if(!product)throw new Error('Fixture de revisão ausente: '+id);
  return structuredClone(product);
}
