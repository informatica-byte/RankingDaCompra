// Somente configuração de apresentação pode sair do banco para o site público.
export const PUBLIC_CONFIG_FIELDS = ['whatsappClubEnabled','whatsappClubUrl','promotionSeoTitle','bestChoicesTitle','bestChoicesProductIds','bestChoicesGuideUrls','youtubeShowcaseEnabled','youtubeShowcaseTitle','youtubeShowcaseLinks','youtubeShowcaseItems','seasonalThemeMode','seasonalThemeId','seasonalThemeStart','seasonalThemeEnd','weeklyComparison'];

// Somente campos editoriais do comparativo podem sair da configuração privada.
// Não copiar campos desconhecidos, credenciais ou links administrativos aninhados.
export function publicWeeklyComparison(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Comparativo público inválido.');
  const result = {};
  const strings = ['semana','validoAte','titulo','termo','familiaComparavel','assinaturaEditorial','revisadoEm','resumoIA'];
  for (const key of strings) if (typeof input[key] === 'string') result[key] = input[key].slice(0, key === 'assinaturaEditorial' ? 12000 : key === 'resumoIA' ? 1500 : 300);
  if (Number.isInteger(input.versao) && input.versao >= 1 && input.versao <= 5) result.versao = input.versao;
  if (input.modoEditorial === 'documental') result.modoEditorial = 'documental';
  for (const key of ['publicado','comparabilidadeRevisada']) if (typeof input[key] === 'boolean') result[key] = input[key];
  if (typeof input.precoMaximo === 'string' || (typeof input.precoMaximo === 'number' && Number.isFinite(input.precoMaximo))) result.precoMaximo = input.precoMaximo;
  const numericFields = ['scoreTotal','clicks','views'];
  const productStrings = ['id','titulo','categoria','categoriaNome','preco','foto','productUrl','motivo','comparisonFamily'];
  result.produtos = (Array.isArray(input.produtos) ? input.produtos : []).slice(0,5).map(product => {
    if (!product || typeof product !== 'object' || Array.isArray(product) || typeof product.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(product.id)) throw new Error('Produto inválido no comparativo público.');
    const item = {};
    for (const key of productStrings) if (typeof product[key] === 'string') item[key] = product[key].slice(0, key === 'motivo' ? 1500 : 800);
    if (typeof product.preco === 'number' && Number.isFinite(product.preco)) item.preco = product.preco;
    for (const key of numericFields) if (Number.isFinite(product[key]) && product[key] >= 0) item[key] = product[key];
    for (const key of ['pros','cons']) if (Array.isArray(product[key])) item[key] = product[key].filter(value => typeof value === 'string').slice(0,5).map(value => value.slice(0,700));
    if (product.criterios && typeof product.criterios === 'object') {
      item.criterios = {};
      for (const key of ['custoBeneficio','avaliacao','interesse','evidencia']) if (Number.isFinite(product.criterios[key])) item.criterios[key] = product.criterios[key];
    }
    if (product.analiseHumana && typeof product.analiseHumana === 'object') {
      item.analiseHumana = {};
      for (const key of ['veredito','paraQuem','comparacaoDireta','limitePrincipal']) if (typeof product.analiseHumana[key] === 'string') item.analiseHumana[key] = product.analiseHumana[key].slice(0,1200);
    }
    return item;
  });
  if (input.analiseIA && typeof input.analiseIA === 'object') {
    result.analiseIA = {};
    for (const key of ['geradaEm','metodo','fonte']) if (typeof input.analiseIA[key] === 'string') result.analiseIA[key] = input.analiseIA[key].slice(0,500);
  }
  if (input.metodologia && typeof input.metodologia === 'object') {
    result.metodologia = {};
    for (const key of ['custoBeneficio','avaliacao','interesse','evidencia']) if (Number.isFinite(input.metodologia[key])) result.metodologia[key] = input.metodologia[key];
  }
  return result;
}
export function decodeConfigValue(field) {
  if (!field) return null;
  if (field.arrayValue) return (field.arrayValue.values || []).map(decodeConfigValue);
  if (field.mapValue) return decodeConfigFields(field.mapValue.fields || {});
  return field.stringValue ?? field.booleanValue ?? field.integerValue ?? field.doubleValue ?? field.timestampValue ?? null;
}
export function decodeConfigFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key,value])=>[key,decodeConfigValue(value)]));
}
export function publicSiteConfig(previous = {}, config = {}, theme = {}, generatedAt = new Date().toISOString()) {
  const merged = {...previous,...config,...theme};
  const allowed = key => PUBLIC_CONFIG_FIELDS.includes(key) || /^giftGuideTitle_[a-z0-9_]+$/.test(key);
  const value = Object.fromEntries(Object.entries(merged).filter(([key])=>allowed(key)));
  for (const [key,item] of Object.entries(value)) {
    const expected = key === 'weeklyComparison' ? 'object' : key.endsWith('Enabled') ? 'boolean' : ['youtubeShowcaseLinks','youtubeShowcaseItems','bestChoicesProductIds','bestChoicesGuideUrls'].includes(key) ? 'array' : 'string';
    if (expected === 'array' ? !Array.isArray(item) : typeof item !== expected) throw new Error('Configuração pública inválida: ' + key + '. Publicação recusada sem substituir a versão existente.');
  }
  if (value.youtubeShowcaseLinks?.some(link=>typeof link !== 'string')) throw new Error('Link de vídeo inválido na configuração pública.');
  if (value.bestChoicesProductIds && (value.bestChoicesProductIds.length>12 || value.bestChoicesProductIds.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id)))) throw new Error('Seleção permanente de produtos inválida.');
  if (value.bestChoicesGuideUrls && (value.bestChoicesGuideUrls.length>6 || value.bestChoicesGuideUrls.some(url=>typeof url!=='string'||!/^melhores-[a-z0-9-]+\.html$/.test(url)||url==='melhores-escolhas.html'))) throw new Error('Seleção permanente de rankings inválida.');
  // Pares contêm apenas o link do vídeo e a página pública do produto.
  if (Array.isArray(value.youtubeShowcaseItems)) value.youtubeShowcaseItems=value.youtubeShowcaseItems.map(item=>({youtubeUrl:String(item.youtubeUrl||item.videoUrl||item.url||''),productUrl:String(item.productUrl||item.produtoUrl||'')}));
  if (Object.hasOwn(value,'weeklyComparison')) value.weeklyComparison=publicWeeklyComparison(value.weeklyComparison);
  return {...value,schemaVersion:2,generatedAt};
}
