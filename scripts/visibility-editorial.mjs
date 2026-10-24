import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const CONFIG = JSON.parse(await readFile(new URL('../visibility-editorial.json', import.meta.url), 'utf8'));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const safeLink = url => /^\/(?!\/)[A-Za-z0-9_./-]+(?:\?(?:q=[A-Za-z0-9%+-]+&)?orcamento=\d+)?$/.test(url) || /^https:\/\/(?:www\.)?(?:grandstream\.com|tp-link\.com|mi\.com|starlink\.com)\//.test(url);
function links(items) {
  return (items || []).filter(item => safeLink(item.url)).map(item => `<li><a href="${esc(item.url)}"${item.url.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(item.label)}</a></li>`).join('');
}
const STYLE = '<style data-visibility-editorial>.visibility-editorial{margin:24px 0;padding:clamp(16px,3vw,24px);border:1px solid #ccded4;border-radius:14px;background:#f3faf6;color:#163b2c;line-height:1.65;overflow-wrap:anywhere}.visibility-editorial h2{font-size:1.35rem;line-height:1.25;margin:0 0 14px}.visibility-editorial h3{font-size:1rem;margin:0 0 7px}.visibility-editorial p{max-width:80ch}.visibility-editorial a{color:#07583d;text-decoration:underline;text-underline-offset:3px}.visibility-editorial li{margin:8px 0}.visibility-editorial .decision-paths{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.visibility-editorial .decision-paths article{min-width:0;padding:16px;border:1px solid #ccded4;background:white;border-radius:10px}.visibility-editorial .decision-paths p{margin:0}.visibility-editorial details{border-top:1px solid #ccded4;margin-top:8px}.visibility-editorial summary{cursor:pointer;min-height:44px;padding:10px 0;font-weight:700}.visibility-editorial summary:focus-visible{outline:3px solid #1769e0;outline-offset:2px}.visibility-editorial .review-note{font-size:.84rem;color:#405d50}@media(max-width:700px){.visibility-editorial .decision-paths{grid-template-columns:1fr}.visibility-editorial{padding:16px}}</style>';
function metadata(html, item) {
  let next = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(item.title)} | Ranking da Compra</title>`);
  for (const [attribute, key, value] of [['name','description',item.description],['property','og:title',item.title],['property','og:description',item.description],['name','twitter:title',item.title],['name','twitter:description',item.description]]) {
    const regex = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${key}["'])[^>]*>`, 'i');
    const tag = `<meta ${attribute}="${key}" content="${esc(value)}">`;
    next = regex.test(next) ? next.replace(regex, tag) : next.replace('</head>', tag + '\n</head>');
  }
  return next;
}
function block(content, reviewedAt = CONFIG.reviewedAt) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(reviewedAt) ? reviewedAt.split('-').reverse().join('/') : 'data não informada';
  return `<!-- visibility-editorial:start --><section class="visibility-editorial" data-visibility-editorial>${content}<p class="review-note">Revisão editorial: ${esc(date)} · <a href="/sobre.html">Equipe Ranking da Compra</a>. Análise de informações publicadas, sem teste prático. A data da revisão não renova a conferência do preço. Confirme valor final, frete, estoque e variante no vendedor.</p></section><!-- visibility-editorial:end -->`;
}
function clean(html) {
  return html.replace(/<!-- visibility-editorial:start -->[\s\S]*?<!-- visibility-editorial:end -->/g, '').replace(/<style data-visibility-editorial>[\s\S]*?<\/style>\n?/g, '');
}
const SITE = 'https://rankingdacompra.com.br';
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(m => [m[1].toLowerCase(), m[3].replace(/&amp;/g, '&')]));
}
function productPath(value) {
  try {
    const url = new URL(value);
    if (url.origin !== SITE || url.username || url.password || url.port || url.search || url.hash || !/^\/produto\/[A-Za-z0-9_-]+-\d{8}-\d+\.html$/.test(url.pathname)) return null;
    return url.pathname.slice(1);
  } catch {return null;}
}
function pageIdentity(html) {
  const canonical = [...html.matchAll(/<link\b[^>]*>/gi)].map(m => attributes(m[0])).filter(a => a.rel?.toLowerCase() === 'canonical');
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => attributes(m[0]));
  const refresh = metas.filter(a => a['http-equiv']?.toLowerCase() === 'refresh');
  const noindex = metas.some(a => a.name?.toLowerCase() === 'robots' && /\bnoindex\b/i.test(a.content));
  const products = [];
  for (const [,json] of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const data = JSON.parse(json);
    products.push(...(data['@graph'] || [data]).filter(n => n['@type'] === 'Product'));
  }
  return {canonical, metas, refresh, noindex, products};
}
// Follow only the one-hop alias emitted by our generator. A title in a related
// link, an external canonical, a loop or a different model is never evidence.
export async function resolveEditorialProduct(root, item) {
  const originalFile = `produto/${item.id}-20260810-1.html`;
  let html = await readFile(resolve(root, originalFile), 'utf8');
  const original = pageIdentity(html);
  let file = originalFile;
  if (original.refresh.length) {
    const aliasCanonical = original.canonical.length === 1 && productPath(original.canonical[0].href);
    const destination = original.refresh.length === 1 && original.refresh[0].content?.match(/^0;url=(.+)$/)?.[1];
    if (!original.noindex || original.products.length || !/<h1>Esta análise foi atualizada<\/h1>/.test(html) || !aliasCanonical || productPath(destination) !== aliasCanonical || aliasCanonical === originalFile) throw new Error(`Alias editorial inválido: ${originalFile}`);
    file = aliasCanonical;
    html = await readFile(resolve(root, file), 'utf8');
  } else if (original.noindex) {
    // Explicit retired/paused stubs must remain without a stale offer/editorial.
    const retired = original.metas.some(a => ['rdc-retired-product-title', 'rdc-paused-product'].includes(a.name));
    if (!retired || original.canonical.length || original.products.length || /id=["']affiliate-offer["']/.test(html)) throw new Error(`Página editorial inativa inválida: ${originalFile}`);
    return {file, html, item, inactive:true};
  }
  const target = pageIdentity(html);
  const product = target.products.length === 1 && target.products[0];
  if (target.noindex || target.refresh.length || target.canonical.length !== 1 || productPath(target.canonical[0].href) !== file || !product || productPath(product.url || product['@id']) !== file || !new RegExp(item.guard, 'i').test(product.name || '')) throw new Error(`Identidade editorial não confirmada: ${originalFile} -> ${file}`);
  const id = file.match(/^produto\/(.+)-\d{8}-\d+\.html$/)[1];
  return {file, html, item:{...item, id}, inactive:false};
}
export function improveProduct(html, item) {
  const next = clean(html);
  if (/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(next)) return next;
  // Match the registered model, not words in related-product links or this block.
  const schemaBlocks = [...next.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let product;
  for (const [,json] of schemaBlocks) {
    try { const data = JSON.parse(json); product = (data['@graph'] || [data]).find(x => x['@type'] === 'Product') || product; } catch {}
  }
  if (!product || !new RegExp(item.guard, 'i').test(product.name || '') || !String(product.url || product['@id']).includes('/produto/' + item.id + '-')) return next;
  const content = block(`<h2>Vale a pena para o seu uso?</h2><p><b>Para quem considerar:</b> ${esc(item.fit)}</p><p><b>O que pesa na escolha:</b> ${esc(item.tradeoff)}</p><p><b>Antes de comprar:</b> ${esc(item.check)}</p><p><b>Quando comparar outra opção:</b> ${esc(item.alternative)}</p>${item.sources?.length ? '<h3>Fontes e conferência</h3><ul>' + links(item.sources) + '</ul>' : ''}<h3>Continue a comparação</h3><ul>${links(item.links)}</ul>`);
  let output = metadata(next, item).replace('</head>', STYLE + '\n</head>');
  if (output.includes('<div class="panels">')) output = output.replace('<div class="panels">', content + '<div class="panels">');
  else output = output.replace('</article>', content + '</article>');
  return output;
}
export function improveGuide(html, item) {
  let next = metadata(clean(html), item).replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, '<h1>' + esc(item.title) + '</h1>');
  const questions = (item.questions || []).map(([question, answer]) => '<details><summary>' + esc(question) + '</summary><p>' + esc(answer) + '</p></details>').join('');
  const content = block(`<h2>Comece pela decisão que importa</h2><p>${esc(item.intro)}</p><div class="decision-paths">${item.choices.map(([title, text]) => '<article><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p></article>').join('')}</div><p>${esc(item.decision)}</p>${questions ? '<h3>Dúvidas para decidir sem comparar produtos diferentes</h3>' + questions : ''}<h3>Veja exemplos e aprofunde sua escolha</h3><ul>${links(item.links)}</ul>`, item.reviewedAt);
  // Keep existing comparison rows, product offers and prices untouched.
  next = next.replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, (tag, json) => {
    try { const data = JSON.parse(json); for (const node of data['@graph'] || [data]) if (['CollectionPage','WebPage','Article'].includes(node['@type'])) {node.name = item.title;node.description = item.description;node.dateModified = item.reviewedAt || CONFIG.reviewedAt;} return tag.replace(json, JSON.stringify(data).replace(/</g, '\\u003c')); } catch {return tag;}
  });
  // Place the decision aid before the lists, not after a long ranking.
  next = next.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i, heading => heading + content);
  return next.replace('</head>', STYLE + '\n</head>');
}
export async function applyVisibilityEditorial(root = '.') {
  const changed = [], dates = new Map();
  for (const item of CONFIG.products) {
    let page;
    try {page = await resolveEditorialProduct(root, item);} catch(error) {
      // Small fixture builds may not include every editorial selection. Only
      // that original absence is optional; a broken alias destination is not.
      if (error.code === 'ENOENT' && error.path === resolve(root, `produto/${item.id}-20260810-1.html`)) continue;
      throw error;
    }
    if (page.inactive) continue;
    const {file, html} = page;
    const output = improveProduct(html, page.item);
    if (output !== html) {await writeFile(resolve(root, file), output);changed.push(file);}
    if (output.includes('<!-- visibility-editorial:start -->')) dates.set(file, CONFIG.reviewedAt);
  }
  for (const item of CONFIG.guides) {
    let html;try {html = await readFile(resolve(root, item.file), 'utf8');} catch(error) {if(error.code === 'ENOENT') continue;throw error;}
    const output = improveGuide(html, item);
    if (output !== html) {await writeFile(resolve(root, item.file), output);changed.push(item.file);}
    dates.set(item.file, item.reviewedAt || CONFIG.reviewedAt);
  }
  const manifestFile=resolve(root,'best-choices-guides.json');
  let original;try{original=await readFile(manifestFile,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  // A fresh build can generate this manifest later from the updated guide HTML.
  if(original){
    const manifest=JSON.parse(original);
    for(const entry of manifest.guides || []) {const match=CONFIG.guides.find(g=>g.file===entry.url);if(match){entry.title=match.title;entry.summary=match.description;}}
    const manifestNext=JSON.stringify(manifest,null,2)+'\n';
    if(manifestNext!==original){await writeFile(manifestFile,manifestNext);changed.push('best-choices-guides.json');}
  }
  const sitemapFile=resolve(root,'sitemap.xml'), sitemap=await readFile(sitemapFile,'utf8');
  const updated=sitemap.replace(/<url>[\s\S]*?<\/url>/g, entry=>{const path=entry.match(/<loc>https:\/\/rankingdacompra.com.br\/([^<]*)<\/loc>/)?.[1],reviewedAt=dates.get(path);return reviewedAt?entry.replace(/<lastmod>([^<]*)<\/lastmod>/,(tag,date)=>date < reviewedAt ? '<lastmod>'+reviewedAt+'</lastmod>' : tag):entry;});
  if(updated!==sitemap){await writeFile(sitemapFile,updated);changed.push('sitemap.xml');}
  return changed;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await applyVisibilityEditorial(),null,2));
