import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

const chrome = process.env.RDC_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const probe = `<script>
const probe = setInterval(() => {
  const details = document.querySelector('[data-buyer-catalog] details.buyer-guidance');
  if (!details) return;
  clearInterval(probe);
  const summary = details.querySelector('summary');
  const closed = !details.open;
  summary.focus();
  const focused = document.activeElement === summary;
  summary.click();
  requestAnimationFrame(() => {
    document.documentElement.dataset.qaResult = [closed, focused, details.open,
      details.querySelectorAll('li').length === 3,
      document.documentElement.scrollWidth <= innerWidth].every(Boolean) ? 'pass' : 'fail';
  });
}, 40);
</script>`;
const types = { '.html':'text/html; charset=utf-8', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };
const server = createServer(async (request, response) => {
  const {pathname,searchParams} = new URL(request.url, 'http://localhost');
  if (pathname === '/qa.html') {
    const width = searchParams.get('width') === '360' ? 360 : 390;
    response.writeHead(200, {'Content-Type':types['.html']}).end(`<!doctype html><iframe title="Comparador" style="width:${width}px;height:844px;border:0" src="/comparar.html"></iframe><script>setInterval(()=>{const f=document.querySelector('iframe');const e=f.contentDocument?.documentElement;if(e?.dataset.qaResult)document.documentElement.dataset.qaResult=f.contentWindow.innerWidth===${width} ? e.dataset.qaResult : 'width-error'},50)</script>`);
    return;
  }
  if (!/^\/[a-zA-Z0-9_.-]+$/.test(pathname)) { response.writeHead(404).end(); return; }
  try {
    const content = await readFile(new URL('..' + pathname, import.meta.url));
    response.writeHead(200, {
      'Content-Type':types[extname(pathname)] || 'application/octet-stream',
      'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'none'; connect-src 'self'"
    }).end(pathname === '/comparar.html' ? content.toString().replace('</body>', probe + '</body>') : content);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  for (const width of [360, 390]) {
    const profile = await mkdtemp(join(tmpdir(), 'rdc-comparator-qa-'));
    try {
      const {stdout} = await promisify(execFile)(chrome, ['--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run',
        '--force-device-scale-factor=1', `--window-size=${width},844`, '--virtual-time-budget=7000',
        `--user-data-dir=${profile}`, '--dump-dom', `http://127.0.0.1:${server.address().port}/qa.html?width=${width}`],
      {timeout:30000,maxBuffer:4*1024*1024});
      assert.equal(stdout.match(/data-qa-result="([^"]+)"/)?.[1], 'pass', `Falha na largura ${width}`);
      console.log(`${width}px: começa recolhido, abre, recebe foco e não causa rolagem horizontal`);
    } finally {
      assert.equal(profile.slice(0, join(tmpdir(), 'rdc-comparator-qa-').length), join(tmpdir(), 'rdc-comparator-qa-'));
      await rm(profile, {recursive:true, force:true, maxRetries:3});
    }
  }
} finally { server.close(); }
