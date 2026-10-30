const normalize=value=>String(value||'').replace(/-?\d+(?:[,.]\d+)?\s*%\s*(?:off|de desconto)?/gi,'').replace(/promo[cç][aã]o/gi,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function publishedArticleProduct(article) {
  if(article?.['@type']!=='Article'||article.about?.['@type']!=='Thing'||!article.about.name)return null;
  return {name:article.about.name,description:article.description,image:article.image};
}
export function publishedDiscoverySummary({id,title,summary,canonical,expectedUrl},published) {
  // Informational rendering may shorten the visible paragraph. Reuse the
  // already-published record, never fabricate padding or waive the validator.
  if(!published||published.id!==id||normalize(published.title)!==normalize(title))return summary;
  if(canonical!==expectedUrl||!canonical.startsWith('https://rankingdacompra.com.br/produto/'))return summary;
  return String(published.summary||'').trim();
}
