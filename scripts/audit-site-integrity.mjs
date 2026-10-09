import { readFile, readdir, access, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, dirname, extname } from "node:path";
import { Script } from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SITE = "https://rankingdacompra.com.br";
const decode = text => text.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
export function localReference(value, file) {
  value = decode(value.trim());
  if (!value || /^(?:data:|blob:|mailto:|tel:|javascript:|#)/i.test(value) || /[\x24{}<>]/.test(value)) return null;
  let url;
  try { url = new URL(value, SITE + "/" + file); } catch { return null; }
  if (url.origin !== SITE) return null;
  let path;
  try { path = decodeURIComponent(url.pathname).replace(/^\//, ""); } catch { return null; }
  if (!path || path.endsWith("/")) path += "index.html";
  if (path.split("/").includes("..")) return null;
  return path;
}

export async function auditOffline(root = process.cwd()) {
  const files = [];
  async function visit(folder) {
    for (const entry of await readdir(resolve(root, folder), { withFileTypes: true })) {
      const path = folder ? folder + "/" + entry.name : entry.name;
      if (entry.isDirectory()) {
        if (["produto", "presentes", "assets"].includes(entry.name) || folder) await visit(path);
      } else if (entry.isFile()) files.push(path);
    }
  }
  await visit("");
  const available = new Set(files);
  const errors = [], warnings = [], targets = new Set(["index.html", "robots.txt", "sitemap.xml"]);
  let links = 0, inlineScripts = 0, jsonLd = 0, modules = 0, htmlPages = 0;
  const html = new Map();
  function syntax(code, label, module = false) {
    try {
      if (module) {
        execFileSync(process.execPath, ["--input-type=module", "--check"], { input: code, stdio: ["pipe", "ignore", "pipe"], timeout: 10000 });
        modules++;
      } else new Script(code, { filename: label });
    } catch (error) { errors.push({ file: label, problem: "Sintaxe JavaScript: " + String(error.stderr || error.message).slice(0,500) }); }
  }
  for (const file of files.filter(f => /\.html$/.test(f))) {
    const source = await readFile(resolve(root, file), "utf8"); html.set(file, source); targets.add(file); htmlPages++;
    for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/i.test(match[1])) continue;
      const type = /\btype=["']([^"']+)["']/i.exec(match[1])?.[1] || "";
      if (type === "application/ld+json") {
        jsonLd++;
        try { JSON.parse(match[2]); } catch (error) { errors.push({ file, problem: "JSON-LD inválido: " + error.message }); }
      } else if (!type || /^(?:module|text\/javascript|application\/javascript)$/.test(type)) {
        inlineScripts++; syntax(match[2], file + ":script" + inlineScripts, type === "module");
      }
    }
    const markup = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    const ids = [...markup.matchAll(/(?:\s|<)id=["']([^"']+)["']/gi)].map(m => m[1]);
    if (new Set(ids).size !== ids.length) errors.push({ file, problem: "IDs HTML duplicados" });
    const h1 = [...markup.matchAll(/<h1\b/gi)].length;
    // Login and app main are mutually exclusive; technical callback can omit H1.
    if (!/^(?:dashboard|painel-celular|estudio-videos|oauth-mercadolivre)\.html$/.test(file) && h1 !== 1)
      errors.push({ file, problem: "Quantidade de H1: " + h1 });
    for (const match of markup.matchAll(/\b(?:href|src|poster)=["']([^"']+)["']/gi)) {
      const target = localReference(match[1], file);
      if (!target) continue;
      links++; targets.add(target);
      if (!available.has(target)) errors.push({ file, problem: "Referência interna ausente: " + target });
    }
    if (!/<html\b[^>]*lang=["']pt-BR["']/i.test(source)) warnings.push({ file, problem: "Idioma pt-BR não declarado" });
  }
  for (const file of files.filter(f => /\.(?:js|mjs)$/.test(f) && !f.startsWith("scripts/"))) {
    const code = await readFile(resolve(root,file),"utf8");
    syntax(code,file,file.endsWith(".mjs") || /^\s*(?:import|export)\b/m.test(code)); targets.add(file);
  }
  for (const file of files.filter(f => /\.json$/.test(f) && !f.startsWith("docs/"))) {
    try { JSON.parse(await readFile(resolve(root,file),"utf8")); targets.add(file); }
    catch(error) { errors.push({ file, problem:"JSON inválido: " + error.message }); }
  }
  for (const file of files.filter(f => /\.css$/.test(f))) {
    targets.add(file);
    const source = await readFile(resolve(root,file),"utf8");
    for (const match of source.matchAll(/url\(\s*["']?([^"'\s)]+)["']?\s*\)/gi)) {
      const target = localReference(match[1],file);
      if (target) { links++; targets.add(target); if (!available.has(target)) errors.push({file,problem:"Recurso CSS ausente: "+target}); }
    }
  }
  return { checkedAt: new Date().toISOString(), counts: { htmlPages, links, inlineScripts, jsonLd, modules }, errors, warnings, targets: [...targets].sort(), html };
}

export async function auditOnline(offline, { request = fetch, concurrency = 3 } = {}) {
  const paths = offline.targets;
  const rows = [], errors = []; let cursor = 0;
  await Promise.all(Array.from({length: concurrency},async () => {
    while (cursor < paths.length) {
      const file = paths[cursor++];
      const url = SITE + "/" + (file === "index.html" ? "" : file);
      try {
        const response = await request(url,{method:"GET",signal:AbortSignal.timeout(15000),redirect:"follow"});
        const isHtml = /\.html$/.test(file);
        const body = isHtml ? await response.text() : "";
        if (!isHtml) await response.body?.cancel();
        const row = {file,status:response.status,url:response.url};
        rows.push(row);
        if (!response.ok) errors.push({...row,problem:"HTTP não disponível"});
        else if (isHtml && (!body.includes("<") || !/<!doctype\s+html/i.test(body))) errors.push({...row,problem:"Resposta não é a página HTML esperada"});
        else if (isHtml && file !== "404.html") {
          const expected = offline.html.get(file)?.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
          const actual = body.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
          if (expected && actual !== expected) errors.push({...row,problem:"Canônico publicado diferente do arquivo",expected,actual});
        }
      } catch(error) { errors.push({file,problem:"Consulta indisponível: " + error.message}); }
    }
  }));
  const probe = SITE + "/auditoria-url-inexistente-20261009.html";
  try {
    const response = await request(probe,{signal:AbortSignal.timeout(15000)});
    if(response.status !== 404) errors.push({file:probe,problem:"URL inexistente não respondeu 404",status:response.status});
    await response.body?.cancel();
  } catch(error) { errors.push({file:probe,problem:error.message}); }
  return { checkedAt: new Date().toISOString(), checked: rows.length, errors, rows: rows.sort((a,b)=>a.file.localeCompare(b.file)) };
}

if(process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const offline = await auditOffline();
  const online = process.argv.includes("--online") ? await auditOnline(offline) : null;
  const report = {...offline,html:undefined,online};
  await mkdir("audit-output",{recursive:true});
  await writeFile("audit-output/integridade.json",JSON.stringify(report,null,2));
  console.log("AUDIT_COUNTS " + JSON.stringify(offline.counts));
  console.log("AUDIT_OFFLINE_ERRORS " + JSON.stringify(offline.errors));
  console.log("AUDIT_WARNINGS " + JSON.stringify(offline.warnings));
  if(online) console.log("AUDIT_ONLINE " + JSON.stringify({checked:online.checked,errors:online.errors}));
  if(offline.errors.length || online?.errors.length) process.exitCode=1;
}
