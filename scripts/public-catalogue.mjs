// Explicit allowlist: never publish internal notes, tokens, emails or admin configuration.
export const PUBLIC_PRODUCT_FIELDS = ['id','titulo','comentario','categoria','foto','preco','precoAnterior','precoPromocional','nota','ranking','promocaoAtiva','promocaoValidaAte','ofertaRelampagoAtiva','ofertaRelampagoTerminaEm','ofertaRelampagoOrigem','precoAtualizadoManualmente','precoAtualizadoManualmenteEm','indisponivel','status','ativo'];
export function publicCatalogue(products, generatedAt = new Date().toISOString()) {
  if (!Array.isArray(products)) throw new Error('Catálogo incompleto: publicação recusada');
  return { version: 1, generatedAt, products: products.map(product => Object.fromEntries(PUBLIC_PRODUCT_FIELDS.filter(key => product[key] !== undefined).map(key => [key, product[key]]))) };
}
