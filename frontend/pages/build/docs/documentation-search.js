// Sistema de Pesquisa para DocumentaÃ§Ã£o PromoPing (versÃ£o endurecida)
class DocumentationSearch {
    constructor() {
        this.searchIndex = [];
        this.currentPage = this.getCurrentPage();
        this.initializeSearch();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        return path === '/docs/' ? '/docs' : (path.replace(/\/$/, '') || '/docs');
    }

    initializeSearch() {
        this.buildSearchIndex();
        this.setupSearchEvents();
        this.setupKeyboardShortcut();
    }

    buildSearchIndex() {
        this.searchIndex = [
            {
                title: "About PromoPing",
                url: "/docs",
                content: "PromoPing is a price monitoring platform that lets users track products across multiple online stores, receive price-drop notifications, and review detailed analytics.",
                keywords: ["about", "promoping", "platform", "price", "monitoring", "stores", "online", "notifications", "analytics"]
            },
            {
                title: "First Launch",
                url: "/docs/FirstLaunch",
                content: "Complete guide to getting started with PromoPing, including system requirements, setup steps, first configuration, and common troubleshooting tips.",
                keywords: ["first", "launch", "getting started", "guide", "installation", "setup", "requirements", "system", "problems", "troubleshooting"]
            },
            {
                title: "Usage Guide",
                url: "/docs/usage-guide",
                content: "Learn how to use all PromoPing features: adding products, configuring alerts, managing tracked items, viewing analytics, and using advanced tools.",
                keywords: ["guide", "usage", "features", "products", "alerts", "analytics", "dashboard", "configuration", "management"]
            },
            {
                title: "API Reference",
                url: "/docs/api-reference",
                content: "Complete PromoPing API documentation covering authentication, profile endpoints, metrics, notifications, preferences, and SDK examples.",
                keywords: ["api", "reference", "documentation", "authentication", "endpoints", "profile", "metrics", "notifications", "preferences", "sdk", "examples"]
            },
            {
                title: "Support",
                url: "/docs/support",
                content: "Help center and technical support resources. Find answers to common questions, contact our support team, and access troubleshooting material.",
                keywords: ["support", "help", "faq", "questions", "contact", "technical", "resources", "problems"]
            },
            {
                title: "Service Status",
                url: "/docs/service-status",
                content: "Monitor the current status of PromoPing services. Review performance metrics, component health, real-time statistics, and recent incidents.",
                keywords: ["status", "service", "monitoring", "metrics", "performance", "components", "real-time", "incidents", "uptime"]
            },
            {
                title: "Incident History",
                url: "/docs/incident-history",
                content: "Complete record of incidents and system updates. Follow the current state of the platform, recent issues, and maintenance changes.",
                keywords: ["incident", "history", "updates", "system", "maintenance", "status", "recent", "log"]
            },
            {
                title: "Terms of Service",
                url: "/docs/terms-of-service",
                content: "Terms and conditions for using PromoPing, including acceptance of terms, service description, user accounts, acceptable use, intellectual property, and liability limits.",
                keywords: ["terms", "service", "conditions", "usage", "acceptance", "account", "user", "intellectual property", "liability"]
            },
            {
                title: "Privacy Policy",
                url: "/docs/privacy-policy",
                content: "Privacy and data protection policy explaining how we collect, use, and protect your personal information in compliance with the GDPR.",
                keywords: ["privacy", "policy", "data", "protection", "gdpr", "information", "personal", "collection", "usage", "security"]
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
    // - valida e sanitiza a query primeiro
    // - escapa todo o texto
    // - aplica <mark> apenas aos termos correspondentes (usando regex seguro)
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
        this.displaySearchResults(results, sanitizedQuery);
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
        countSpan.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} found`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'search-results-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close search results');
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
            if (result.url === this.currentPage) item.classList.add('current-page');

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

        if (results.length === 0) {
            // fallback (nÃ£o deve acontecer porque tratÃ¡mos antes)
            const noRes = document.createElement('div');
            noRes.className = 'search-no-results';
            noRes.innerHTML = `<p>No results found</p>`;
            list.appendChild(noRes);
        }

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
        countSpan.textContent = 'No results found';
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
            <p>No results were found for "<strong>${this.escapeHTML(query)}</strong>"</p>
            <p class="search-suggestions">Try:</p>
            <ul>
                <li>Checking the spelling</li>
                <li>Using broader terms</li>
                <li>Trying different keywords</li>
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
    window.DocumentationSearch = DocumentationSearch; // expÃµe a classe
    new DocumentationSearch();
});
