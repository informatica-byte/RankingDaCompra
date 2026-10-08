import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function protectPublicHtml(html) {
  if (!/<head\b/i.test(html)) return html;
  // Remover somente o carregamento antigo de GA; Auth, App Check e dados do catálogo não mudam.
  html = html.replace(/<script\b[^>]*src=["']https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-NBKRX8TTR6["'][^>]*>\s*<\/script>\s*/gi, '');
  html = html.replace(/<script\b[^>]*>\s*window\.dataLayer=window\.dataLayer\|\|\[\];function gtag\(\)\{dataLayer\.push\(arguments\)\}gtag\('js',new Date\(\)\);gtag\('config','G-NBKRX8TTR6',\{anonymize_ip:true\}\);\s*<\/script>/g, '');
  const gate = 'if(!window.RDCPrivacy?.analyticsAllowed())return;';
  for (const start of ['async function registrarVisita(){', 'async function registrarMetricaComercial(tipo,produto,canal){', 'window.registrarMetricaComercial=async function(tipo,produto,canal){']) {
    if (html.includes(start) && !html.includes(start + gate)) html = html.replace(start, start + gate);
  }
  html = html.replace(/\nregistrarVisita\(\);/g, '\nwindow.RDCPrivacy?.whenAnalyticsAllowed(()=>registrarVisita());');
  if (!/src=["'][^"']*privacy-controls\.js/.test(html)) {
    html = html.replace(/<head([^>]*)>/i, '<head$1><script src="/privacy-controls.js?v=20261008-consent"></script>');
  }
  return html;
}

export async function protectGeneratedPublicPages(root = process.cwd()) {
  let changed = 0;
  for (const folder of ['', 'produto', 'presentes']) {
    const directory = resolve(root, folder);
    let entries;
    try { entries = await readdir(directory, {withFileTypes: true}); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
      const path = resolve(directory, entry.name), before = await readFile(path, 'utf8');
      // Áreas administrativas não têm métricas públicas nem precisam deste aviso.
      if (!folder && /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(before)) continue;
      const after = protectPublicHtml(before);
      if (after !== before) { await writeFile(path, after, 'utf8'); changed += 1; }
    }
  }
  return changed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Privacidade integrada em ${await protectGeneratedPublicPages()} página(s) públicas.`);
}
