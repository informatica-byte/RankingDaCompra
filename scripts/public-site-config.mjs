// Somente configuração de apresentação pode sair do banco para o site público.
export const PUBLIC_CONFIG_FIELDS = ['whatsappClubEnabled','whatsappClubUrl','promotionSeoTitle','youtubeShowcaseEnabled','youtubeShowcaseTitle','youtubeShowcaseLinks','youtubeShowcaseItems','seasonalThemeMode','seasonalThemeId','seasonalThemeStart','seasonalThemeEnd'];
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
    const expected = key.endsWith('Enabled') ? 'boolean' : ['youtubeShowcaseLinks','youtubeShowcaseItems'].includes(key) ? 'array' : 'string';
    if (expected === 'array' ? !Array.isArray(item) : typeof item !== expected) throw new Error('Configuração pública inválida: ' + key + '. Publicação recusada sem substituir a versão existente.');
  }
  if (value.youtubeShowcaseLinks?.some(link=>typeof link !== 'string')) throw new Error('Link de vídeo inválido na configuração pública.');
  // Pares contêm apenas o link do vídeo e a página pública do produto.
  if (Array.isArray(value.youtubeShowcaseItems)) value.youtubeShowcaseItems=value.youtubeShowcaseItems.map(item=>({youtubeUrl:String(item.youtubeUrl||item.videoUrl||item.url||''),productUrl:String(item.productUrl||item.produtoUrl||'')}));
  return {...value,schemaVersion:2,generatedAt};
}
