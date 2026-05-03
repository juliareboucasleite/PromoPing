// Sistema de Pesquisa para About PromoPing
class AboutSearch {
    constructor() {
        this.searchIndex = [];
        this.currentPage = this.getCurrentPage();
        this.initializeSearch();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        return filename || 'about-promoping.html';
    }

    initializeSearch() {
        this.buildSearchIndex();
        this.setupSearchEvents();
        this.setupKeyboardShortcut();
    }

    buildSearchIndex() {
        this.searchIndex = [
            {
                title: "Sobre o PromoPing",
                url: "About/about-promoping.html",
                content: "O PromoPing Ã© uma plataforma especializada concebida para o ajudar a monitorizar e comparar preÃ§os de produtos num sÃ³ local. Funciona como uma ferramenta inteligente que recolhe dados de mÃºltiplas lojas online, oferecendo aos utilizadores a capacidade de rastrear preÃ§os, receber alertas quando aparecem descontos e tomar decisÃµes de compra mais inteligentes.",
                keywords: ["sobre", "promoping", "plataforma", "monitorizar", "comparar", "preÃ§os", "produtos", "lojas", "online", "alertas", "descontos", "compras", "inteligentes", "configurar", "configuraÃ§Ã£o"]
            },
            {
                title: "Alertas Inteligentes",
                url: "About/smart-alerts.html",
                content: "Receba alertas imediatos quando os preÃ§os dos produtos que monitora baixam ou quando hÃ¡ novas ofertas disponÃ­veis. Tipos de alertas incluem: alerta de preÃ§o, alerta de estoque, alerta de oferta e alerta de novo produto. Nunca perca uma oportunidade de compra e seja sempre o primeiro a saber sobre as melhores ofertas.",
                keywords: ["alertas", "notificaÃ§Ãµes", "preÃ§os", "ofertas", "estoque", "produtos", "descontos", "promoÃ§Ãµes", "avisos", "tempo", "real", "instantÃ¢neos", "sms", "email"]
            },
            {
                title: "Blog PromoPing",
                url: "About/promoping-blog.html",
                content: "Dicas, truques e insights para maximizar as suas poupanÃ§as. Artigos sobre estratÃ©gias de poupanÃ§a, tecnologia, moda, casa e jardim, gaming e entretenimento, livros e educaÃ§Ã£o. AnÃ¡lises mensais de preÃ§os, top produtos com maior poupanÃ§a e previsÃµes para o prÃ³ximo mÃªs.",
                keywords: ["blog", "dicas", "truques", "poupanÃ§as", "artigos", "estratÃ©gias", "tecnologia", "moda", "casa", "jardim", "gaming", "livros", "educaÃ§Ã£o", "anÃ¡lises", "tendÃªncias", "black", "friday", "promoÃ§Ãµes"]
            },
            {
                title: "Casos de Uso",
                url: "About/use-cases.html",
                content: "Descubra como o PromoPing pode transformar a sua experiÃªncia de compras. Casos de uso para profissionais de tecnologia, mÃ£es de famÃ­lia, estudantes universitÃ¡rios, entusiastas de moda, proprietÃ¡rios de casa e gamers. Cada caso mostra como o PromoPing ajuda a poupar dinheiro e a encontrar as melhores ofertas.",
                keywords: ["casos", "uso", "exemplos", "profissionais", "tecnologia", "famÃ­lia", "estudantes", "moda", "casa", "gaming", "poupanÃ§as", "ofertas", "experiÃªncia", "compras", "cenÃ¡rios", "aplicaÃ§Ãµes"]
            },
            {
                title: "Monitoramento de PreÃ§os",
                url: "About/price-monitoring.html",
                content: "Acompanhe produtos em tempo real e nunca perca uma oportunidade de compra. O PromoPing monitora constantemente milhares de produtos em dezenas de lojas online, verificando preÃ§os, disponibilidade e ofertas especiais. Suporta mais de 50 lojas portuguesas incluindo PCDiga, Worten, Globaldata, FNAC e muitas outras.",
                keywords: ["monitoramento", "preÃ§os", "tempo", "real", "produtos", "lojas", "verificaÃ§Ã£o", "disponibilidade", "ofertas", "pcdiga", "worten", "globaldata", "fnac", "rastreamento", "acompanhamento", "histÃ³rico"]
            },
            {
                title: "RelatÃ³rios e AnÃ¡lises",
                url: "About/reports-and-analytics.html",
                content: "Compreenda os seus padrÃµes de compra e maximize as suas poupanÃ§as. Visualize quanto dinheiro poupou com o PromoPing atravÃ©s de grÃ¡ficos detalhados e estatÃ­sticas precisas. Tipos de relatÃ³rios incluem: relatÃ³rio mensal, relatÃ³rio por categoria, relatÃ³rio por loja e relatÃ³rio de tendÃªncias.",
                keywords: ["relatÃ³rios", "anÃ¡lises", "grÃ¡ficos", "estatÃ­sticas", "poupanÃ§as", "padrÃµes", "compras", "dashboard", "visualizaÃ§Ãµes", "insights", "recomendaÃ§Ãµes", "tendÃªncias", "mensal", "categoria", "loja"]
            },
            {
                title: "PolÃ­tica de Cookies",
                url: "About/cookie-policy.html",
                content: "PolÃ­tica de cookies e privacidade do PromoPing. InformaÃ§Ãµes sobre como utilizamos cookies e tecnologias similares para melhorar a sua experiÃªncia, recolher dados de utilizaÃ§Ã£o e personalizar conteÃºdo. ConheÃ§a os seus direitos e como gerir as preferÃªncias de cookies.",
                keywords: ["polÃ­tica", "cookies", "privacidade", "dados", "proteÃ§Ã£o", "rgpd", "preferÃªncias", "configuraÃ§Ãµes", "rastreamento", "anÃ¡lise", "personalizaÃ§Ã£o"]
            }
        ];
    }

    /* ---------- UTILITÃRIOS DE SEGURANÃ‡A ---------- */

    // Escapa HTML de forma segura (usa textContent para evitar XSS)
    escapeHTML(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    // Valida e sanitiza entrada de pesquisa
    sanitizeQuery(query) {
        if (!query) return '';
        
        // Converter para string e limitar comprimento
        const str = String(query).trim();
        if (str.length > 100) {
            return str.substring(0, 100);
        }
        
        // Remover caracteres perigosos
        return str.replace(/[<>'"&]/g, '');
    }

    // Gera uma versÃ£o "highlighted" segura:
    highlightSafe(text, query) {
        if (!query) return this.escapeHTML(text);
        
        // Sanitizar query primeiro
        const sanitizedQuery = this.sanitizeQuery(query);
        if (!sanitizedQuery) return this.escapeHTML(text);
        
        const escapedText = this.escapeHTML(text);
        
        // Construir regex seguro para palavras (escape dos termos)
        const terms = sanitizedQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0 && t.length <= 50);
        if (terms.length === 0) return escapedText;

        // Escape completo para regex de cada termo
        const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = terms.map(escapeRegex).join('|');
        
        // Limitar tamanho do regex para prevenir ReDoS
        if (pattern.length > 200) {
            return escapedText;
        }
        
        try {
            const regex = new RegExp(`(${pattern})`, 'ig');
            // Substituir no texto escapado. Como o texto estÃ¡ escapado, a substituiÃ§Ã£o Ã© segura.
            return escapedText.replace(regex, '<mark>$1</mark>');
        } catch (e) {
            // Se regex falhar, retornar texto escapado sem highlight
            console.warn('Regex invÃ¡lido na pesquisa:', e);
            return escapedText;
        }
    }

    //Eventos e UI

    setupSearchEvents() {
        const searchInputs = document.querySelectorAll('.search-container input[type="text"], input.search-input');

        searchInputs.forEach(input => {
            let timeout;
            input.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.performSearch(e.target.value);
                }, 300);
            });

            input.addEventListener('focus', (e) => {
                this.showSearchResults(e.target.value);
            });

            // Fecha resultados ao clicar fora (uma vez)
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-container')) {
                    this.hideSearchResults();
                }
            });
        });
    }

    setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                const searchInput = document.querySelector('.search-container input[type="text"], input.search-input');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
            if (e.key === 'Escape') {
                this.hideSearchResults();
            }
        });
    }

    performSearch(query) {
        // Sanitizar query antes de processar
        const sanitizedQuery = this.sanitizeQuery(query);
        if (!sanitizedQuery || sanitizedQuery.length < 2) {
            this.hideSearchResults();
            return;
        }
        const results = this.searchInIndex(sanitizedQuery);
        if (results.length === 0) {
            this.showNoResults(sanitizedQuery);
        } else {
            this.displaySearchResults(results, sanitizedQuery);
        }
    }

    searchInIndex(query) {
        const searchTerms = String(query).toLowerCase().split(/\s+/).filter(t => t.length > 0);

        return this.searchIndex
            .map(item => {
                let score = 0;
                const title = item.title.toLowerCase();
                const content = item.content.toLowerCase();
                const keywords = item.keywords.join(' ').toLowerCase();

                searchTerms.forEach(term => {
                    if (title.includes(term)) score += 10;
                    if (title.startsWith(term)) score += 5;
                    if (content.includes(term)) score += 3;
                    if (keywords.includes(term)) score += 2;
                });

                return { ...item, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
    }

    //RenderizaÃ§Ã£o segura

    removeExistingResults() {
        const existing = document.querySelector('.search-results');
        if (existing) existing.remove();
    }

    displaySearchResults(results, query) {
        this.removeExistingResults();

        const searchContainer = document.querySelector('.search-container');
        if (!searchContainer) return;

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'search-results';

        // CabeÃ§alho
        const header = document.createElement('div');
        header.className = 'search-results-header';
        const countSpan = document.createElement('span');
        countSpan.className = 'search-results-count';
        countSpan.textContent = `${results.length} resultado${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'search-results-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Fechar resultados de pesquisa');
        closeBtn.textContent = 'Ã—';
        closeBtn.addEventListener('click', () => resultsContainer.remove());
        header.appendChild(countSpan);
        header.appendChild(closeBtn);
        resultsContainer.appendChild(header);

        // Lista
        const list = document.createElement('div');
        list.className = 'search-results-list';

        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            if (result.url === this.currentPage || result.url.includes(this.currentPage)) item.classList.add('current-page');

            // TÃ­tulo (highlight seguro)
            const titleDiv = document.createElement('div');
            titleDiv.className = 'search-result-title';
            titleDiv.innerHTML = this.highlightSafe(result.title, query);

            // ConteÃºdo (resumo) - limita e highlight
            const excerpt = result.content.length > 120 ? result.content.substring(0, 120) + '...' : result.content;
            const contentDiv = document.createElement('div');
            contentDiv.className = 'search-result-content';
            contentDiv.innerHTML = this.highlightSafe(excerpt, query);

            // URL - como texto simples
            const urlDiv = document.createElement('div');
            urlDiv.className = 'search-result-url';
            urlDiv.textContent = result.url;

            // Evento de clique (navegaÃ§Ã£o) â€” sem inline JS
            item.addEventListener('click', (ev) => {
                // permite Ctrl/Cmd+click para abrir nova aba
                if (ev.ctrlKey || ev.metaKey) {
                    window.open(result.url, '_blank', 'noopener');
                } else {
                    window.location.href = result.url;
                }
            });

            // Accessibility: tornar clicÃ¡vel com Enter quando focado
            item.tabIndex = 0;
            item.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') {
                    if (ev.ctrlKey || ev.metaKey) {
                        window.open(result.url, '_blank', 'noopener');
                    } else {
                        window.location.href = result.url;
                    }
                }
            });

            item.appendChild(titleDiv);
            item.appendChild(contentDiv);
            item.appendChild(urlDiv);
            list.appendChild(item);
        });

        resultsContainer.appendChild(list);
        searchContainer.appendChild(resultsContainer);
    }

    showNoResults(query) {
        this.removeExistingResults();
        const searchContainer = document.querySelector('.search-container');
        if (!searchContainer) return;

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'search-results';

        const header = document.createElement('div');
        header.className = 'search-results-header';
        const countSpan = document.createElement('span');
        countSpan.className = 'search-results-count';
        countSpan.textContent = 'Nenhum resultado encontrado';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'search-results-close';
        closeBtn.type = 'button';
        closeBtn.textContent = 'Ã—';
        closeBtn.addEventListener('click', () => resultsContainer.remove());
        header.appendChild(countSpan);
        header.appendChild(closeBtn);

        const list = document.createElement('div');
        list.className = 'search-results-list';
        const noRes = document.createElement('div');
        noRes.className = 'search-no-results';
        noRes.innerHTML = `
            <p>NÃ£o foram encontrados resultados para "<strong>${this.escapeHTML(query)}</strong>"</p>
            <p class="search-suggestions">Tente:</p>
            <ul>
                <li>Verificar a ortografia</li>
                <li>Usar termos mais gerais</li>
                <li>Experimentar palavras-chave diferentes</li>
            </ul>
        `;
        list.appendChild(noRes);

        resultsContainer.appendChild(header);
        resultsContainer.appendChild(list);
        searchContainer.appendChild(resultsContainer);
    }

    showSearchResults(query) {
        if (query && query.length >= 2) this.performSearch(query);
    }

    hideSearchResults() {
        this.removeExistingResults();
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.AboutSearch = AboutSearch; // expÃµe a classe
    new AboutSearch();
});



