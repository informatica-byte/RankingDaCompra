(function () {
    'use strict';

    const VERSION = '20260811-1';
    const STORAGE_PREFIX = 'ranking_da_compra_radar_v1_';
    const PAISES = {
        MLB: { nome: 'Brasil', bandeira: '🇧🇷', idioma: 'pt-BR', moeda: 'BRL', dominio: 'mercadolivre.com.br' },
        MLA: { nome: 'Argentina', bandeira: '🇦🇷', idioma: 'es-AR', moeda: 'ARS', dominio: 'mercadolibre.com.ar' },
        MLM: { nome: 'México', bandeira: '🇲🇽', idioma: 'es-MX', moeda: 'MXN', dominio: 'mercadolibre.com.mx' },
        MLC: { nome: 'Chile', bandeira: '🇨🇱', idioma: 'es-CL', moeda: 'CLP', dominio: 'mercadolibre.cl' },
        MCO: { nome: 'Colômbia', bandeira: '🇨🇴', idioma: 'es-CO', moeda: 'COP', dominio: 'mercadolibre.com.co' },
        MLU: { nome: 'Uruguai', bandeira: '🇺🇾', idioma: 'es-UY', moeda: 'UYU', dominio: 'mercadolibre.com.uy' },
        MPE: { nome: 'Peru', bandeira: '🇵🇪', idioma: 'es-PE', moeda: 'PEN', dominio: 'mercadolibre.com.pe' }
    };

    let paisAtual = 'MLB';
    let tendenciasAtuais = [];
    let ultimaOrigem = '';
    let atualizando = false;

    function normalizar(texto) {
        return String(texto || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function escapar(texto) {
        return String(texto ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function palavras(texto) {
        const ignoradas = new Set(['para', 'com', 'sem', 'uma', 'por', 'the', 'del', 'los', 'las', 'con', 'sin', 'and', 'kit', 'novo', 'nova']);
        return normalizar(texto).split(' ').filter(p => p.length > 2 && !ignoradas.has(p));
    }

    function catalogoDoPainel() {
        const mapas = new Map();
        document.querySelectorAll('#itens-lista .item-admin, #itens-revisao .item-admin, #itens-precos .item-admin, #itens-indisponiveis .item-admin').forEach(cartao => {
            const titulo = cartao.querySelector('.item-admin-titulo')?.textContent?.trim();
            if (!titulo) return;
            const categoria = cartao.querySelector('.badge-cat')?.textContent?.trim() || 'Sem categoria';
            const botao = cartao.querySelector('button[onclick*="editarProduto"]');
            const id = botao?.getAttribute('onclick')?.match(/editarProduto\(['"]([^'"]+)/)?.[1] || '';
            const chave = id || normalizar(titulo);
            if (!mapas.has(chave)) mapas.set(chave, { id, titulo, categoria });
        });
        return Array.from(mapas.values());
    }

    function pontuar(tendencia, produto) {
        const termo = normalizar(tendencia.keyword);
        const titulo = normalizar(produto.titulo);
        const categoria = normalizar(produto.categoria);
        const tokens = palavras(termo);
        if (!tokens.length) return 0;
        let pontos = 0;
        if (titulo.includes(termo)) pontos += 75;
        tokens.forEach(token => {
            if (titulo.includes(token)) pontos += 14;
            else if (categoria.includes(token)) pontos += 7;
        });
        const cobertura = tokens.filter(token => titulo.includes(token) || categoria.includes(token)).length / tokens.length;
        pontos += Math.round(cobertura * 25);
        return Math.min(100, pontos);
    }

    function melhorProduto(tendencia, catalogo) {
        return catalogo
            .map(produto => ({ ...produto, pontos: pontuar(tendencia, produto) }))
            .sort((a, b) => b.pontos - a.pontos)[0] || null;
    }

    function chavePais(sufixo) {
        return `${STORAGE_PREFIX}${paisAtual}_${sufixo}`;
    }

    function salvarLocal() {
        try {
            localStorage.setItem(chavePais('tendencias'), JSON.stringify(tendenciasAtuais.slice(0, 50)));
            localStorage.setItem(chavePais('origem'), ultimaOrigem);
            localStorage.setItem(chavePais('atualizado'), new Date().toISOString());
        } catch (_) {}
    }

    function carregarLocal() {
        try {
            const dados = JSON.parse(localStorage.getItem(chavePais('tendencias')) || '[]');
            tendenciasAtuais = Array.isArray(dados) ? dados.filter(item => item && item.keyword).slice(0, 50) : [];
            ultimaOrigem = localStorage.getItem(chavePais('origem')) || '';
        } catch (_) {
            tendenciasAtuais = [];
            ultimaOrigem = '';
        }
    }

    function estilos() {
        if (document.getElementById('radar-internacional-estilos')) return;
        const style = document.createElement('style');
        style.id = 'radar-internacional-estilos';
        style.textContent = `
            #radar-internacional { margin: 28px 0; padding: 24px; border: 1px solid #bdd8cb; border-radius: 18px; background: linear-gradient(135deg,#f7fff9,#f7f5ff); color:#12372a; }
            #radar-internacional * { box-sizing: border-box; }
            .radar-cabecalho { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; flex-wrap:wrap; }
            .radar-selo { font-size:.78rem; font-weight:900; letter-spacing:.12em; color:#087a47; text-transform:uppercase; }
            .radar-titulo { margin:5px 0 6px; font-size:1.65rem; color:#17376e; }
            .radar-subtitulo { margin:0; max-width:720px; color:#52645b; line-height:1.45; }
            .radar-controles { display:grid; grid-template-columns:minmax(200px,1fr) auto; gap:10px; min-width:min(100%,390px); }
            .radar-controles select, .radar-controles button, .radar-manual textarea { font:inherit; }
            .radar-controles select { min-height:46px; padding:0 12px; border:1px solid #b6c6bd; border-radius:10px; background:white; }
            .radar-botao { min-height:46px; border:0; border-radius:10px; padding:0 17px; font-weight:800; cursor:pointer; background:#0b7a46; color:white; }
            .radar-botao:disabled { opacity:.55; cursor:wait; }
            .radar-botao-secundario { background:white; color:#185b3c; border:1px solid #8fb9a3; }
            .radar-aviso { margin:18px 0 0; padding:12px 14px; border-radius:10px; background:#fff5cd; border:1px solid #e8c95e; color:#664e00; line-height:1.4; }
            .radar-status { margin:16px 0; padding:11px 13px; border-radius:10px; background:#eaf7ef; color:#165c37; }
            .radar-status.erro { background:#fff0f0; color:#8b2020; }
            .radar-resumo { display:grid; grid-template-columns:repeat(4,minmax(120px,1fr)); gap:10px; margin:16px 0; }
            .radar-numero { padding:14px; background:white; border:1px solid #dce7e0; border-radius:12px; }
            .radar-numero strong { display:block; font-size:1.5rem; color:#075d36; }
            .radar-numero span { font-size:.86rem; color:#607168; }
            .radar-lista { display:grid; gap:10px; margin-top:14px; }
            .radar-item { display:grid; grid-template-columns:minmax(170px,1.25fr) minmax(210px,1.6fr) auto; gap:14px; align-items:center; padding:14px; border:1px solid #d8e2dc; border-radius:12px; background:white; }
            .radar-posicao { display:inline-grid; place-items:center; min-width:28px; height:28px; margin-right:8px; border-radius:50%; background:#ffe168; color:#4d3b00; font-weight:900; }
            .radar-termo { font-weight:850; color:#17376e; }
            .radar-correspondencia { color:#53635b; line-height:1.35; }
            .radar-correspondencia strong { color:#173f2d; }
            .radar-pontuacao { display:inline-block; margin-top:5px; padding:3px 7px; border-radius:999px; background:#e3f5ea; color:#087344; font-size:.78rem; font-weight:850; }
            .radar-pontuacao.fraca { background:#fff1c7; color:#755600; }
            .radar-acoes { display:flex; gap:7px; flex-wrap:wrap; justify-content:flex-end; }
            .radar-link { display:inline-flex; align-items:center; justify-content:center; min-height:38px; padding:0 11px; border:1px solid #aac3b5; border-radius:8px; color:#075d36; background:white; font-weight:750; text-decoration:none; cursor:pointer; }
            .radar-manual { display:none; margin-top:15px; padding:15px; border:1px dashed #9c78d8; border-radius:12px; background:#fbf8ff; }
            .radar-manual.aberto { display:block; }
            .radar-manual textarea { width:100%; min-height:115px; margin:9px 0; padding:10px; border:1px solid #c7b8df; border-radius:8px; resize:vertical; }
            .radar-vazio { padding:26px; text-align:center; border:1px dashed #aebeb5; border-radius:12px; background:rgba(255,255,255,.7); color:#596a61; }
            @media(max-width:850px){ .radar-resumo{grid-template-columns:repeat(2,1fr)} .radar-item{grid-template-columns:1fr} .radar-acoes{justify-content:flex-start} }
            @media(max-width:540px){ #radar-internacional{padding:17px} .radar-controles{grid-template-columns:1fr} .radar-resumo{grid-template-columns:1fr 1fr} }
        `;
        document.head.appendChild(style);
    }

    function criarInterface() {
        if (document.getElementById('radar-internacional')) return;
        estilos();
        const central = document.getElementById('central-divulgacao');
        const produtos = document.getElementById('produtos-cadastrados') || document.getElementById('itens-lista');
        const ancora = central || produtos;
        if (!ancora) return;

        const section = document.createElement('section');
        section.id = 'radar-internacional';
        section.setAttribute('aria-labelledby', 'radar-internacional-titulo');
        section.innerHTML = `
            <div class="radar-cabecalho">
                <div>
                    <div class="radar-selo">Radar internacional · versão ${VERSION}</div>
                    <h2 class="radar-titulo" id="radar-internacional-titulo">🌎 Produtos em alta no Mercado Livre</h2>
                    <p class="radar-subtitulo">Compara tendências agregadas e anônimas com o catálogo já cadastrado. Este módulo apenas recomenda oportunidades: não altera produtos, preços ou links automaticamente.</p>
                </div>
                <div class="radar-controles">
                    <label class="sr-only" for="radar-pais">País analisado</label>
                    <select id="radar-pais">${Object.entries(PAISES).map(([id,p]) => `<option value="${id}">${p.bandeira} ${p.nome}</option>`).join('')}</select>
                    <button type="button" class="radar-botao" id="radar-atualizar">Atualizar tendências</button>
                    <button type="button" class="radar-botao radar-botao-secundario" id="radar-importar">Importar palavras</button>
                    <button type="button" class="radar-botao radar-botao-secundario" id="radar-copiar">Copiar plano</button>
                </div>
            </div>
            <div class="radar-aviso"><strong>Proteção da sua conta:</strong> use o Radar para escolher produtos e criar conteúdo em canais permitidos. Antes de divulgar fora do Brasil, gere e confirme um link de afiliado válido para o país selecionado.</div>
            <div class="radar-manual" id="radar-manual">
                <strong>Importação alternativa</strong>
                <p>Cole uma pesquisa por linha. Essa opção é usada quando o acesso automático à consulta oficial estiver indisponível.</p>
                <textarea id="radar-palavras" placeholder="Exemplo:\nsmartphone 5g\nfone bluetooth\nair fryer"></textarea>
                <button type="button" class="radar-botao" id="radar-processar">Analisar palavras</button>
            </div>
            <div class="radar-status" id="radar-status">Escolha um país e clique em “Atualizar tendências”.</div>
            <div class="radar-resumo" id="radar-resumo"></div>
            <div class="radar-lista" id="radar-lista"></div>
        `;
        ancora.insertAdjacentElement('afterend', section);

        section.querySelector('#radar-pais').addEventListener('change', evento => {
            paisAtual = evento.target.value;
            carregarLocal();
            renderizar();
        });
        section.querySelector('#radar-atualizar').addEventListener('click', atualizarTendencias);
        section.querySelector('#radar-importar').addEventListener('click', () => section.querySelector('#radar-manual').classList.toggle('aberto'));
        section.querySelector('#radar-processar').addEventListener('click', importarPalavras);
        section.querySelector('#radar-copiar').addEventListener('click', copiarPlano);
        section.addEventListener('click', evento => {
            const botao = evento.target.closest('[data-editar-produto]');
            if (!botao) return;
            const id = botao.dataset.editarProduto;
            const alvo = document.querySelector(`button[onclick*="editarProduto('${CSS.escape(id)}')"]`);
            if (alvo) alvo.click();
        });
        carregarLocal();
        renderizar();
    }

    async function atualizarTendencias() {
        if (atualizando) return;
        atualizando = true;
        const botao = document.getElementById('radar-atualizar');
        const status = document.getElementById('radar-status');
        botao.disabled = true;
        botao.textContent = 'Consultando…';
        status.className = 'radar-status';
        status.textContent = `Consultando tendências agregadas de ${PAISES[paisAtual].nome}…`;
        try {
            const resposta = await fetch(`https://api.mercadolibre.com/trends/${paisAtual}`, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                cache: 'no-store'
            });
            if (!resposta.ok) throw new Error(`consulta oficial respondeu ${resposta.status}`);
            const dados = await resposta.json();
            if (!Array.isArray(dados) || !dados.length) throw new Error('nenhuma tendência foi retornada');
            tendenciasAtuais = dados
                .filter(item => item && item.keyword)
                .map(item => ({ keyword: String(item.keyword).trim(), url: String(item.url || '') }))
                .slice(0, 50);
            ultimaOrigem = 'API oficial do Mercado Livre';
            salvarLocal();
            renderizar();
        } catch (erro) {
            status.className = 'radar-status erro';
            status.textContent = `A consulta automática não ficou disponível (${erro.message}). O catálogo continua intacto. Use “Importar palavras” para analisar uma lista sem depender da API.`;
            document.getElementById('radar-manual').classList.add('aberto');
        } finally {
            atualizando = false;
            botao.disabled = false;
            botao.textContent = 'Atualizar tendências';
        }
    }

    function importarPalavras() {
        const campo = document.getElementById('radar-palavras');
        const unicas = new Set(campo.value.split(/\n|;|,/).map(item => item.trim()).filter(Boolean));
        tendenciasAtuais = Array.from(unicas).slice(0, 50).map(keyword => ({
            keyword,
            url: `https://lista.${PAISES[paisAtual].dominio}/${encodeURIComponent(normalizar(keyword).replace(/\s+/g, '-'))}`
        }));
        if (!tendenciasAtuais.length) {
            document.getElementById('radar-status').className = 'radar-status erro';
            document.getElementById('radar-status').textContent = 'Cole pelo menos uma pesquisa antes de analisar.';
            return;
        }
        ultimaOrigem = 'lista importada manualmente';
        salvarLocal();
        renderizar();
        document.getElementById('radar-manual').classList.remove('aberto');
    }

    function analisar() {
        const catalogo = catalogoDoPainel();
        return tendenciasAtuais.map((tendencia, indice) => ({
            ...tendencia,
            posicao: indice + 1,
            produto: melhorProduto(tendencia, catalogo)
        }));
    }

    function renderizar() {
        const lista = document.getElementById('radar-lista');
        const resumo = document.getElementById('radar-resumo');
        const status = document.getElementById('radar-status');
        if (!lista || !resumo || !status) return;
        if (!tendenciasAtuais.length) {
            resumo.innerHTML = '';
            lista.innerHTML = '<div class="radar-vazio">Nenhuma tendência salva para este país. Atualize a consulta ou importe palavras.</div>';
            return;
        }
        const analise = analisar();
        const fortes = analise.filter(item => item.produto?.pontos >= 60);
        const possiveis = analise.filter(item => item.produto?.pontos >= 35 && item.produto?.pontos < 60);
        const novas = analise.filter(item => !item.produto || item.produto.pontos < 35);
        const catalogo = catalogoDoPainel();
        status.className = 'radar-status';
        status.textContent = `${tendenciasAtuais.length} tendências analisadas em ${PAISES[paisAtual].nome}. Origem: ${ultimaOrigem || 'dados salvos'}. O resultado usa somente informações agregadas.`;
        resumo.innerHTML = `
            <div class="radar-numero"><strong>${tendenciasAtuais.length}</strong><span>tendências analisadas</span></div>
            <div class="radar-numero"><strong>${catalogo.length}</strong><span>produtos comparados</span></div>
            <div class="radar-numero"><strong>${fortes.length}</strong><span>correspondências fortes</span></div>
            <div class="radar-numero"><strong>${novas.length}</strong><span>oportunidades novas</span></div>
        `;
        lista.innerHTML = analise.slice(0, 30).map(item => {
            const produto = item.produto;
            const forte = produto && produto.pontos >= 60;
            const razoavel = produto && produto.pontos >= 35;
            const texto = forte
                ? `<strong>${escapar(produto.titulo)}</strong><br><span>${escapar(produto.categoria)}</span><br><span class="radar-pontuacao">${produto.pontos}% de correspondência</span>`
                : razoavel
                    ? `<strong>${escapar(produto.titulo)}</strong><br><span>Confira se é realmente o mesmo produto.</span><br><span class="radar-pontuacao fraca">${produto.pontos}% de correspondência</span>`
                    : '<strong>Oportunidade ainda não cadastrada</strong><br><span>Procure um anúncio confiável e gere o link de afiliado correto para esse país.</span>';
            const busca = item.url || `https://lista.${PAISES[paisAtual].dominio}/${encodeURIComponent(normalizar(item.keyword).replace(/\s+/g, '-'))}`;
            return `
                <article class="radar-item">
                    <div><span class="radar-posicao">${item.posicao}</span><span class="radar-termo">${escapar(item.keyword)}</span></div>
                    <div class="radar-correspondencia">${texto}</div>
                    <div class="radar-acoes">
                        <a class="radar-link" href="${escapar(busca)}" target="_blank" rel="noopener noreferrer">Pesquisar</a>
                        ${produto?.id && razoavel ? `<button type="button" class="radar-link" data-editar-produto="${escapar(produto.id)}">Abrir cadastro</button>` : ''}
                    </div>
                </article>`;
        }).join('');
    }

    async function copiarPlano() {
        if (!tendenciasAtuais.length) {
            document.getElementById('radar-status').className = 'radar-status erro';
            document.getElementById('radar-status').textContent = 'Atualize ou importe tendências antes de copiar o plano.';
            return;
        }
        const analise = analisar().slice(0, 10);
        const pais = PAISES[paisAtual];
        const linhas = [
            `RADAR INTERNACIONAL — ${pais.nome}`,
            `Atualizado em: ${new Date().toLocaleString('pt-BR')}`,
            `Origem: ${ultimaOrigem || 'dados salvos'}`,
            '',
            ...analise.map(item => `${item.posicao}. ${item.keyword} — ${item.produto?.pontos >= 35 ? `${item.produto.titulo} (${item.produto.pontos}% de correspondência)` : 'buscar produto e gerar link local'}`),
            '',
            'Antes de publicar: confirmar preço, disponibilidade e link de afiliado válido para o país.'
        ];
        try {
            await navigator.clipboard.writeText(linhas.join('\n'));
            document.getElementById('radar-status').className = 'radar-status';
            document.getElementById('radar-status').textContent = 'Plano copiado. Nenhum produto foi alterado.';
        } catch (_) {
            document.getElementById('radar-status').className = 'radar-status erro';
            document.getElementById('radar-status').textContent = 'O navegador não permitiu copiar automaticamente.';
        }
    }

    function iniciar() {
        criarInterface();
        if (!document.getElementById('radar-internacional')) {
            const observador = new MutationObserver(() => {
                criarInterface();
                if (document.getElementById('radar-internacional')) observador.disconnect();
            });
            observador.observe(document.documentElement, { childList: true, subtree: true });
            setTimeout(() => observador.disconnect(), 30000);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    else iniciar();
})();
