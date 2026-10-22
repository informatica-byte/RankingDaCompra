import {readFileSync} from 'node:fs';

// Unit tests must keep exercising every documented identity even after a live
// product is paused, deduplicated, removed from publication or given a new ID.
// These sentinel prices and dates exist only in memory, never in site data.
const fixtures=JSON.parse(readFileSync(new URL('./review-products.json',import.meta.url),'utf8')).products;
export const reviewCatalogue=fixtures.map(product=>({...product,
  comentario:product.comentario||'Descrição de teste; não publicar.',
  preco:123.45,precoAnterior:234.56,
  precoAtualizadoManualmente:true,precoAtualizadoManualmenteEm:'2026-10-01T12:00:00.000Z',
  precoConferenciaId:'fixture-only',precoConferenciaCampo:'preco',precoConferenciaValor:123.45,
}));
export function reviewProduct(id) {
  const product=reviewCatalogue.find(product=>product.id===id);
  if(!product)throw new Error('Identidade de teste ausente: '+id);
  return structuredClone(product);
}
