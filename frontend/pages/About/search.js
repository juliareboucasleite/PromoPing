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
        return filename || 'about.html';
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
                url: "pages/About/about.html",
                content: "O PromoPing é uma plataforma especializada concebida para o ajudar a monitorizar e comparar preços de produtos num só local. Funciona como uma ferramenta inteligente que recolhe dados de múltiplas lojas online, oferecendo aos utilizadores a capacidade de rastrear preços, receber alertas quando aparecem descontos e tomar decisões de compra mais inteligentes.",
                keywords: ["sobre", "promoping", "plataforma", "monitorizar", "comparar", "preços", "produtos", "lojas", "online", "alertas", "descontos", "compras", "inteligentes", "configurar", "configuração"]
            },
            {
                title: "Alertas Inteligentes",
                url: "pages/About/alertas.html",
                content: "Receba alertas imediatos quando os preços dos produtos que monitora baixam ou quando há novas ofertas disponíveis. Tipos de alertas incluem: alerta de preço, alerta de estoque, alerta de oferta e alerta de novo produto. Nunca perca uma oportunidade de compra e seja sempre o primeiro a saber sobre as melhores ofertas.",
                keywords: ["alertas", "notificações", "preços", "ofertas", "estoque", "produtos", "descontos", "promoções", "avisos", "tempo", "real", "instantâneos", "sms", "email"]
            },
            {
                title: "Blog PromoPing",
                url: "pages/About/blog.html",
                content: "Dicas, truques e insights para maximizar as suas poupanças. Artigos sobre estratégias de poupança, tecnologia, moda, casa e jardim, gaming e entretenimento, livros e educação. Análises mensais de preços, top produtos com maior poupança e previsões para o próximo mês.",
                keywords: ["blog", "dicas", "truques", "poupanças", "artigos", "estratégias", "tecnologia", "moda", "casa", "jardim", "gaming", "livros", "educação", "análises", "tendências", "black", "friday", "promoções"]
            },
            {
                title: "Casos de Uso",
                url: "pages/About/casos-uso.html",
                content: "Descubra como o PromoPing pode transformar a sua experiência de compras. Casos de uso para profissionais de tecnologia, mães de família, estudantes universitários, entusiastas de moda, proprietários de casa e gamers. Cada caso mostra como o PromoPing ajuda a poupar dinheiro e a encontrar as melhores ofertas.",
                keywords: ["casos", "uso", "exemplos", "profissionais", "tecnologia", "família", "estudantes", "moda", "casa", "gaming", "poupanças", "ofertas", "experiência", "compras", "cenários", "aplicações"]
            },
            {
                title: "Monitoramento de Preços",
                url: "pages/About/monitoramento.html",
                content: "Acompanhe produtos em tempo real e nunca perca uma oportunidade de compra. O PromoPing monitora constantemente milhares de produtos em dezenas de lojas online, verificando preços, disponibilidade e ofertas especiais. Suporta mais de 50 lojas portuguesas incluindo PCDiga, Worten, Globaldata, FNAC e muitas outras.",
                keywords: ["monitoramento", "preços", "tempo", "real", "produtos", "lojas", "verificação", "disponibilidade", "ofertas", "pcdiga", "worten", "globaldata", "fnac", "rastreamento", "acompanhamento", "histórico"]
            },
            {
                title: "Relatórios e Análises",
                url: "pages/About/relatorios.html",
                content: "Compreenda os seus padrões de compra e maximize as suas poupanças. Visualize quanto dinheiro poupou com o PromoPing através de gráficos detalhados e estatísticas precisas. Tipos de relatórios incluem: relatório mensal, relatório por categoria, relatório por loja e relatório de tendências.",
                keywords: ["relatórios", "análises", "gráficos", "estatísticas", "poupanças", "padrões", "compras", "dashboard", "visualizações", "insights", "recomendações", "tendências", "mensal", "categoria", "loja"]
            },
            {
                title: "Política de Cookies",
                url: "pages/About/privacy-cookies.html",
                content: "Política de cookies e privacidade do PromoPing. Informações sobre como utilizamos cookies e tecnologias similares para melhorar a sua experiência, recolher dados de utilização e personalizar conteúdo. Conheça os seus direitos e como gerir as preferências de cookies.",
                keywords: ["política", "cookies", "privacidade", "dados", "proteção", "rgpd", "preferências", "configurações", "rastreamento", "análise", "personalização"]
            }
        ];
    }

    /* ---------- UTILITÁRIOS DE SEGURANÇA ---------- */

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

    // Gera uma versão "highlighted" segura:
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
            // Substituir no texto escapado. Como o texto está escapado, a substituição é segura.
            return escapedText.replace(regex, '<mark>$1</mark>');
        } catch (e) {
            // Se regex falhar, retornar texto escapado sem highlight
            console.warn('Regex inválido na pesquisa:', e);
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

    //Renderização segura

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

        // Cabeçalho
        const header = document.createElement('div');
        header.className = 'search-results-header';
        const countSpan = document.createElement('span');
        countSpan.className = 'search-results-count';
        countSpan.textContent = `${results.length} resultado${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'search-results-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Fechar resultados de pesquisa');
        closeBtn.textContent = '×';
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

            // Título (highlight seguro)
            const titleDiv = document.createElement('div');
            titleDiv.className = 'search-result-title';
            titleDiv.innerHTML = this.highlightSafe(result.title, query);

            // Conteúdo (resumo) - limita e highlight
            const excerpt = result.content.length > 120 ? result.content.substring(0, 120) + '...' : result.content;
            const contentDiv = document.createElement('div');
            contentDiv.className = 'search-result-content';
            contentDiv.innerHTML = this.highlightSafe(excerpt, query);

            // URL - como texto simples
            const urlDiv = document.createElement('div');
            urlDiv.className = 'search-result-url';
            urlDiv.textContent = result.url;

            // Evento de clique (navegação) — sem inline JS
            item.addEventListener('click', (ev) => {
                // permite Ctrl/Cmd+click para abrir nova aba
                if (ev.ctrlKey || ev.metaKey) {
                    window.open(result.url, '_blank', 'noopener');
                } else {
                    window.location.href = result.url;
                }
            });

            // Accessibility: tornar clicável com Enter quando focado
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
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => resultsContainer.remove());
        header.appendChild(countSpan);
        header.appendChild(closeBtn);

        const list = document.createElement('div');
        list.className = 'search-results-list';
        const noRes = document.createElement('div');
        noRes.className = 'search-no-results';
        noRes.innerHTML = `
            <p>Não foram encontrados resultados para "<strong>${this.escapeHTML(query)}</strong>"</p>
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
    window.AboutSearch = AboutSearch; // expõe a classe
    new AboutSearch();
});

