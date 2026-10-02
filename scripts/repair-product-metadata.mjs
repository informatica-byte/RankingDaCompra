// Reparo offline: não consulta Firebase nem modifica preços, links ou cadastros.
import fs from 'node:fs/promises';
import path from 'node:path';
import { productSeoTitle } from './product-seo-titles.mjs';

const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let changed = 0;
for (const file of (await fs.readdir('produto')).filter(file => file.endsWith('.html'))) {
  const target = path.join('produto', file);
  let html = await fs.readFile(target, 'utf8');
  const original = html;
  if (/name="robots"[^>]*content="noindex/i.test(html)) continue;
  const scripts = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes = scripts.flatMap(match => { const node = JSON.parse(match[1]); return node['@graph'] || (Array.isArray(node) ? node : [node]); });
  const product = nodes.find(node => node['@type'] === 'Product');
  if (!product?.name) continue;
  const source = html.match(/class="fine source"[\s\S]*?<a href="([^"]+)"/)?.[1] || '';
  const title = escape(productSeoTitle(product.name, source));
  const old = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  if (old !== title) {
    html = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${title}</title>`);
    html = html.replace(/(<meta\b[^>]*(?:property="og:title"|name="twitter:title")[^>]*content=")[^"]*(")/gi, (_, before, after) => before + title + after);
  }
  if (html !== original) { await fs.writeFile(target, html, 'utf8'); changed++; console.log(file + ': ' + title); }
}
console.log(`Metadados corrigidos: ${changed} página(s), sem alterar produtos.`);
