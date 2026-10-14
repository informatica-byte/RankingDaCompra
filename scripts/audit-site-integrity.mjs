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

const TEMPORARY_HTTP = new Set([429, 502, 503, 504]);
const pause = milliseconds => new Promise(done => setTimeout(done, milliseconds));
function temporaryNetworkError(error) {
  return /^(?:AbortError|TimeoutError)$/.test(error?.name || "")
    || /fetch failed|network|timed?\s*out|timeout|socket|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i
      .test(String(error?.message || "") + " " + String(error?.cause?.code || error?.code || ""));
}
async function releaseBody(response) {
  try { await response?.body?.cancel(); } catch { /* A closed or interrupted body needs no further read. */ }
}

export async function auditOnline(offline, { request = fetch, concurrency = 3, wait = pause, maxRetries = 2 } = {}) {
  const paths = offline.targets;
  const rows = [], errors = [], warnings = []; let cursor = 0;
  const retries = Math.max(0, Math.min(2, Math.floor(Number(maxRetries) || 0)));
  async function inspect(file, url, isHtml) {
    const attempts = [];
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      let response;
      try {
        response = await request(url, {method:"GET",signal:AbortSignal.timeout(15000),redirect:"follow"});
        const observation = {attempt,status:response.status,url:response.url || url};
        attempts.push(observation);
        if (TEMPORARY_HTTP.has(response.status) && attempt <= retries) {
          observation.retryScheduled = true;
          await releaseBody(response);
        } else {
          const body = isHtml && response.ok ? await response.text() : "";
          if (!isHtml || !response.ok) await releaseBody(response);
          return {row:{file,status:response.status,url:response.url || url,attempts},body,ok:response.ok};
        }
      } catch (error) {
        await releaseBody(response);
        let observation = attempts.at(-1);
        if (observation?.attempt !== attempt) {
          observation = {attempt,status:response?.status ?? null,url:response?.url || url};
          attempts.push(observation);
        }
        observation.problem = String(error.message || error);
        if (!temporaryNetworkError(error) || attempt > retries) {
          return {row:{file,status:observation.status,url:observation.url,attempts},problem:"Consulta indisponível: " + observation.problem};
        }
        observation.retryScheduled = true;
      }
      await wait(250 * attempt);
    }
  }
  function recovered(row) {
    if (row.attempts.length > 1) warnings.push({...row,recovered:true,problem:"Disponibilidade recuperada após falha temporária"});
  }
  await Promise.all(Array.from({length: concurrency},async () => {
    while (cursor < paths.length) {
      const file = paths[cursor++];
      const url = SITE + "/" + (file === "index.html" ? "" : file);
      const isHtml = /\.html$/.test(file);
      const {row,body,ok,problem} = await inspect(file,url,isHtml);
      rows.push(row);
      if (problem) errors.push({...row,problem});
      else if (!ok) errors.push({...row,problem:"HTTP não disponível"});
      else if (isHtml && (!body.includes("<") || !/<!doctype\s+html/i.test(body))) errors.push({...row,problem:"Resposta não é a página HTML esperada"});
      else {
        let mismatch = false;
        if (isHtml && file !== "404.html") {
          const expected = offline.html.get(file)?.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
          const actual = body.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
          if (expected && actual !== expected) {
            mismatch = true;
            errors.push({...row,problem:"Canônico publicado diferente do arquivo",expected,actual});
          }
        }
        if (!mismatch) recovered(row);
      }
    }
  }));
  const probe = SITE + "/auditoria-url-inexistente-20261009.html";
  const probeResult = await inspect(probe,probe,false);
  if (probeResult.problem) errors.push({...probeResult.row,problem:probeResult.problem});
  else if (probeResult.row.status !== 404) errors.push({...probeResult.row,problem:"URL inexistente não respondeu 404"});
  else recovered(probeResult.row);
  return { checkedAt: new Date().toISOString(), checked: rows.length,
    requests:rows.reduce((sum,row)=>sum+row.attempts.length,probeResult.row.attempts.length),
    errors, warnings, probe:probeResult.row, rows: rows.sort((a,b)=>a.file.localeCompare(b.file)) };
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
  if(online) console.log("AUDIT_ONLINE " + JSON.stringify({checked:online.checked,requests:online.requests,errors:online.errors,warnings:online.warnings}));
  if(offline.errors.length || online?.errors.length) process.exitCode=1;
}
