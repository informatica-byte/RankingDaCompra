(function () {
    'use strict';

    const SITE_ORIGIN = 'https://rankingdacompra.com.br';
    const SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml`;
    const WORKFLOW_URL = 'https://github.com/informatica-byte/RankingDaCompra/actions/workflows/update-sitemap.yml';
    const SEARCH_CONSOLE_URL = 'https://search.google.com/search-console/inspect?resource_id=sc-domain%3Arankingdacompra.com.br';
    const CENTRAL_ID = 'central-indexacao-dashboard';

    let sitemapCache = null;
    let sitemapCacheAt = 0;

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function normalizeUrl(value) {
        const parsed = new URL(String(value || '').trim(), SITE_ORIGIN);
        if (parsed.origin !== SITE_ORIGIN) {
            throw new Error('Use uma página do domínio rankingdacompra.com.br.');
        }
        parsed.search = '';
        parsed.hash = '';
        return parsed.href;
    }

    function formatDate(value) {
        if (!value) return 'não informada';
        const date = new Date(`${value}T12:00:00`);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date);
    }

    function daysSince(value) {
        if (!value) return null;
        const date = new Date(`${value}T12:00:00`);
        if (Number.isNaN(date.getTime())) return null;
        return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
    }

    async function loadSitemap(force) {
        if (!force && sitemapCache && Date.now() - sitemapCacheAt < 60000) return sitemapCache;
        const response = await fetch(`${SITEMAP_URL}?painel=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`O sitemap respondeu HTTP ${response.status}.`);
        const xmlText = await response.text();
        const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
        if (xml.querySelector('parsererror')) throw new Error('O sitemap publicado está inválido.');
        const entries = Array.from(xml.querySelectorAll('url')).map(node => ({
            loc: (node.querySelector('loc')?.textContent || '').trim(),
            lastmod: (node.querySelector('lastmod')?.textContent || '').trim()
        })).filter(entry => entry.loc);
        sitemapCache = entries;
        sitemapCacheAt = Date.now();
        return entries;
    }

    async function inspectPage(targetUrl, force) {
        const target = normalizeUrl(targetUrl);
        const [entries, pageResponse] = await Promise.all([
            loadSitemap(force),
            fetch(`${target}${target.includes('?') ? '&' : '?'}painel=${Date.now()}`, {
                cache: 'no-store',
                redirect: 'follow'
            }).catch(() => null)
        ]);
        const entry = entries.find(item => normalizeUrl(item.loc) === target);
        let canonical = '';
        let robots = '';
        let pageTitle = '';
        if (pageResponse?.ok) {
            const html = await pageResponse.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            canonical = doc.querySelector('link[rel="canonical"]')?.href || '';
            robots = doc.querySelector('meta[name="robots"]')?.content || '';
            pageTitle = doc.title || '';
        }
        return {
            target,
            online: Boolean(pageResponse?.ok),
            status: pageResponse?.status || 0,
            inSitemap: Boolean(entry),
            lastmod: entry?.lastmod || '',
            daysOld: daysSince(entry?.lastmod),
            indexAllowed: !robots || !/noindex/i.test(robots),
            canonicalOk: !canonical || normalizeUrl(canonical) === target,
            pageTitle,
            sitemapTotal: entries.length
        };
    }

    function renderResult(result) {
        const resultBox = document.getElementById('indexacao-resultado');
        const healthy = result.online && result.inSitemap && result.indexAllowed && result.canonicalOk;
        const freshness = result.daysOld === null
            ? 'sem data de atualização'
            : result.daysOld === 0
                ? 'atualizada hoje'
                : `atualizada há ${result.daysOld} dia(s)`;
        const items = [
            [result.online, result.online ? `Página online (HTTP ${result.status})` : `Página indisponível (HTTP ${result.status || 'sem resposta'})`],
            [result.inSitemap, result.inSitemap ? `Presente no sitemap — ${freshness}` : 'Ainda não está no sitemap'],
            [result.indexAllowed, result.indexAllowed ? 'Indexação permitida pela página' : 'A página contém bloqueio noindex'],
            [result.canonicalOk, result.canonicalOk ? 'Endereço canônico correto' : 'Endereço canônico aponta para outra página']
        ];
        resultBox.className = `indexacao-resultado ${healthy ? 'indexacao-ok' : 'indexacao-alerta'}`;
        resultBox.innerHTML = `
            <strong>${healthy ? '✅ Página preparada para o Google' : '⚠️ Página precisa de atualização'}</strong>
            <div class="indexacao-url">${escapeHtml(result.target)}</div>
            <ul>${items.map(([ok, label]) => `<li>${ok ? '✅' : '⚠️'} ${escapeHtml(label)}</li>`).join('')}</ul>
            <small>O sitemap possui ${result.sitemapTotal} endereços. “Preparada” não significa que o Google já indexou; a confirmação final é feita no Search Console.</small>`;
    }

    function renderError(error) {
        const resultBox = document.getElementById('indexacao-resultado');
        resultBox.className = 'indexacao-resultado indexacao-alerta';
        resultBox.innerHTML = `<strong>⚠️ Não foi possível concluir a verificação.</strong><p>${escapeHtml(error.message || error)}</p>`;
    }

    async function runInspection(force) {
        const input = document.getElementById('indexacao-url');
        const button = document.getElementById('btn-verificar-indexacao');
        const original = button.textContent;
        button.disabled = true;
        button.textContent = '⏳ Verificando...';
        try {
            const result = await inspectPage(input.value, force);
            input.value = result.target;
            localStorage.setItem('ranking-indexacao-url', result.target);
            renderResult(result);
        } catch (error) {
            renderError(error);
        } finally {
            button.disabled = false;
            button.textContent = original;
        }
    }

    async function inspectProduct(productId) {
        const central = document.getElementById(CENTRAL_ID);
        const input = document.getElementById('indexacao-url');
        central.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const button = document.getElementById('btn-verificar-indexacao');
        button.disabled = true;
        button.textContent = '⏳ Localizando página...';
        try {
            const entries = await loadSitemap(true);
            const marker = `/produto/${productId}-`;
            const entry = entries.find(item => item.loc.includes(marker));
            if (!entry) {
                throw new Error('A página deste produto ainda não apareceu no sitemap. Use “Abrir atualização automática” e execute o fluxo do GitHub.');
            }
            input.value = entry.loc;
            const result = await inspectPage(entry.loc, false);
            renderResult(result);
        } catch (error) {
            renderError(error);
        } finally {
            button.disabled = false;
            button.textContent = '🔎 Verificar página e sitemap';
        }
    }

    async function openSearchConsole() {
        const input = document.getElementById('indexacao-url');
        try {
            const target = normalizeUrl(input.value);
            await navigator.clipboard.writeText(target);
            window.open(SEARCH_CONSOLE_URL, '_blank', 'noopener');
            const note = document.getElementById('indexacao-google-nota');
            note.textContent = 'URL copiada. Cole-a na barra “Inspecionar qualquer URL” do Search Console.';
        } catch (error) {
            renderError(error);
        }
    }

    function addProductButtons() {
        document.querySelectorAll('.item-admin').forEach(card => {
            if (card.querySelector('.btn-indexacao-produto')) return;
            const editButton = card.querySelector('[onclick*="editarProduto"]');
            const match = editButton?.getAttribute('onclick')?.match(/editarProduto\(['"]([^'"]+)['"]\)/);
            if (!match) return;
            const actions = card.querySelector('.acoes');
            if (!actions) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn-indexacao-produto';
            button.textContent = '🔎 Página/Google';
            button.addEventListener('click', () => inspectProduct(match[1]));
            actions.prepend(button);
        });
    }

    function mountCentral() {
        if (document.getElementById(CENTRAL_ID)) return;
        const productList = document.querySelector('.lista-admin');
        if (!productList) return;
        const remembered = localStorage.getItem('ranking-indexacao-url') || `${SITE_ORIGIN}/analises.html`;
        const section = document.createElement('section');
        section.id = CENTRAL_ID;
        section.className = 'central-indexacao';
        section.innerHTML = `
            <div class="central-indexacao-cabecalho">
                <div>
                    <span class="central-indexacao-selo">VISIBILIDADE NO GOOGLE</span>
                    <h3>Central de publicação e indexação</h3>
                    <p>Confira se uma página está online, no sitemap e liberada para o Google.</p>
                </div>
            </div>
            <label for="indexacao-url"><strong>Endereço que deseja verificar:</strong></label>
            <input type="url" id="indexacao-url" value="${escapeHtml(remembered)}" spellcheck="false">
            <div class="central-indexacao-acoes">
                <button type="button" id="btn-verificar-indexacao">🔎 Verificar página e sitemap</button>
                <button type="button" id="btn-google-indexacao">🌐 Conferir indexação no Google</button>
                <a href="${WORKFLOW_URL}" target="_blank" rel="noopener">⚙️ Abrir atualização automática</a>
            </div>
            <div id="indexacao-resultado" class="indexacao-resultado" aria-live="polite">Aguardando verificação...</div>
            <p id="indexacao-google-nota" class="indexacao-google-nota">O painel não guarda senhas nem tokens. A confirmação do Google é aberta diretamente no Search Console.</p>`;
        productList.parentNode.insertBefore(section, productList);

        const style = document.createElement('style');
        style.textContent = `
            .central-indexacao{margin:24px 0;padding:20px;border:1px solid #9cc8ff;border-radius:14px;background:#f4f9ff;color:#17365d}
            .central-indexacao-cabecalho h3{margin:4px 0 6px;font-size:22px}.central-indexacao-cabecalho p{margin:0 0 16px}
            .central-indexacao-selo{font-size:12px;font-weight:800;letter-spacing:.08em;color:#075aa8}
            .central-indexacao input{width:100%;box-sizing:border-box;margin:7px 0 12px;padding:12px;border:1px solid #9fb6ce;border-radius:8px;font-size:15px}
            .central-indexacao-acoes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
            .central-indexacao-acoes button,.central-indexacao-acoes a,.btn-indexacao-produto{border:0;border-radius:8px;padding:11px 12px;font-weight:800;cursor:pointer;text-align:center;text-decoration:none}
            #btn-verificar-indexacao{background:#075aa8;color:#fff}#btn-google-indexacao{background:#138a4b;color:#fff}.central-indexacao-acoes a{background:#ffca28;color:#3b2b00}
            .indexacao-resultado{margin-top:14px;padding:14px;border-radius:10px;background:#fff}.indexacao-ok{border-left:5px solid #159447}.indexacao-alerta{border-left:5px solid #e29a00;background:#fff7dc}
            .indexacao-resultado ul{margin:10px 0;padding-left:20px}.indexacao-url{margin-top:5px;font-size:12px;overflow-wrap:anywhere}.indexacao-google-nota{font-size:12px;margin:10px 0 0}
            .btn-indexacao-produto{background:#e4f1ff;color:#075aa8;margin-right:6px}
            @media(max-width:760px){.central-indexacao-acoes{grid-template-columns:1fr}.central-indexacao{padding:15px}.btn-indexacao-produto{width:100%;margin:0 0 6px}}
        `;
        document.head.appendChild(style);

        document.getElementById('btn-verificar-indexacao').addEventListener('click', () => runInspection(true));
        document.getElementById('btn-google-indexacao').addEventListener('click', openSearchConsole);
        document.getElementById('indexacao-url').addEventListener('keydown', event => {
            if (event.key === 'Enter') runInspection(true);
        });

        const observer = new MutationObserver(addProductButtons);
        ['itens-lista', 'itens-revisao', 'itens-indisponiveis'].forEach(id => {
            const node = document.getElementById(id);
            if (node) observer.observe(node, { childList: true, subtree: true });
        });
        addProductButtons();
        runInspection(false);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountCentral, { once: true });
    } else {
        mountCentral();
    }
})();
