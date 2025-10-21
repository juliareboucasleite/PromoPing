// Sistema de Pesquisa para Documentação PromoPing (versão endurecida)
class DocumentationSearch {
    constructor() {
        this.searchIndex = [];
        this.currentPage = this.getCurrentPage();
        this.initializeSearch();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        return filename || 'docs.html';
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
                url: "docs.html",
                content: "PromoPing é uma plataforma de monitoramento de preços que permite aos utilizadores acompanhar produtos em múltiplas lojas online, receber notificações sobre mudanças de preços e aceder a análises detalhadas.",
                keywords: ["sobre", "promoping", "plataforma", "monitoramento", "preços", "lojas", "online", "notificações", "análises"]
            },
            {
                title: "Primeiro Lançamento",
                url: "FirstLaunch.html",
                content: "Guia completo para começar a usar o PromoPing. Inclui requisitos do sistema, passos de instalação, configuração inicial e resolução de problemas comuns.",
                keywords: ["primeiro", "lançamento", "começar", "guia", "instalação", "configuração", "requisitos", "sistema", "problemas", "troubleshooting"]
            },
            {
                title: "Guia de Utilização",
                url: "usage-guide.html",
                content: "Aprenda a usar todas as funcionalidades do PromoPing: adicionar produtos, configurar alertas, gerir produtos, visualizar análises e utilizar funcionalidades avançadas.",
                keywords: ["guia", "utilização", "funcionalidades", "produtos", "alertas", "análises", "dashboard", "configuração", "gestão"]
            },
            {
                title: "Referência da API",
                url: "api-reference.html",
                content: "Documentação completa da API PromoPing. Inclui autenticação, endpoints para perfil do utilizador, estatísticas, notificações, preferências e exemplos de SDK.",
                keywords: ["api", "referência", "documentação", "autenticação", "endpoints", "perfil", "estatísticas", "notificações", "preferências", "sdk", "exemplos"]
            },
            {
                title: "Suporte",
                url: "support.html",
                content: "Centro de ajuda e suporte técnico. Encontre respostas para perguntas frequentes, contacte a nossa equipa de suporte e aceda a recursos de ajuda.",
                keywords: ["suporte", "ajuda", "faq", "perguntas", "frequentes", "contacto", "técnico", "recursos", "problemas"]
            },
            {
                title: "Status do Serviço",
                url: "service-status.html",
                content: "Monitorize o estado atual dos serviços PromoPing. Visualize métricas de performance, estado dos componentes, estatísticas em tempo real e histórico de incidentes.",
                keywords: ["status", "serviço", "monitorização", "métricas", "performance", "componentes", "tempo", "real", "incidentes", "uptime"]
            },
            {
                title: "Histórico de Incidentes",
                url: "incident-history.html",
                content: "Registo completo de incidentes e atualizações do sistema. Acompanhe o estado atual, incidentes recentes e atualizações de manutenção.",
                keywords: ["histórico", "incidentes", "atualizações", "sistema", "manutenção", "estado", "recentes", "registo"]
            },
            {
                title: "Termos de Serviço",
                url: "terms.html",
                content: "Termos e condições de uso do PromoPing. Inclui aceitação dos termos, descrição do serviço, conta de utilizador, uso aceitável, propriedade intelectual e limitações de responsabilidade.",
                keywords: ["termos", "serviço", "condições", "uso", "aceitação", "conta", "utilizador", "propriedade", "intelectual", "responsabilidade"]
            },
            {
                title: "Política de Privacidade",
                url: "privacy.html",
                content: "Política de privacidade e proteção de dados. Explica como recolhemos, utilizamos e protegemos as suas informações pessoais em conformidade com o RGPD.",
                keywords: ["política", "privacidade", "dados", "proteção", "rgpd", "informações", "pessoais", "recolha", "utilização", "segurança"]
            }
        ];
    }

    /* ---------- UTILITÁRIOS DE SEGURANÇA ---------- */

    // Escapa HTML (usa textContent para evitar XSS)
    escapeHTML(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    // Gera uma versão "highlighted" segura:
    // - escapa todo o texto primeiro
    // - aplica <mark> apenas aos termos correspondentes (usando regex seguro)
    highlightSafe(text, query) {
        if (!query) return this.escapeHTML(text);
        const escapedText = this.escapeHTML(text);
        // Construir regex seguro para palavras (escape dos termos)
        const terms = query.toString().toLowerCase().split(/\s+/).filter(t => t.length > 0);
        if (terms.length === 0) return escapedText;

        // Escape para regex de cada termo
        const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = terms.map(escapeRegex).join('|');
        const regex = new RegExp(`(${pattern})`, 'ig');

        // Substituir no texto escapado. Como o texto está escapado, a substituição é segura.
        return escapedText.replace(regex, '<mark>$1</mark>');
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
        if (!query || String(query).trim().length < 2) {
            this.hideSearchResults();
            return;
        }
        const results = this.searchInIndex(query);
        this.displaySearchResults(results, query);
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
            if (result.url === this.currentPage) item.classList.add('current-page');

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

        if (results.length === 0) {
            // fallback (não deve acontecer porque tratámos antes)
            const noRes = document.createElement('div');
            noRes.className = 'search-no-results';
            noRes.innerHTML = `<p>Nenhum resultado encontrado</p>`;
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
    window.DocumentationSearch = DocumentationSearch; // expõe a classe
    new DocumentationSearch();
});