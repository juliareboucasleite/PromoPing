// Sistema de Pesquisa para Documentação PromoPing
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
        // Indexar todas as páginas de documentação
        this.buildSearchIndex();
        
        // Configurar eventos de pesquisa
        this.setupSearchEvents();
        
        // Configurar atalho de teclado
        this.setupKeyboardShortcut();
    }

    buildSearchIndex() {
        // Dados indexados de todas as páginas de documentação
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

    setupSearchEvents() {
        const searchInputs = document.querySelectorAll('input[type="text"]');
        
        searchInputs.forEach(input => {
            // Evento de digitação com debounce
            let timeout;
            input.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.performSearch(e.target.value);
                }, 300);
            });

            // Evento de foco
            input.addEventListener('focus', (e) => {
                this.showSearchResults(e.target.value);
            });

            // Evento de clique fora para fechar
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-container')) {
                    this.hideSearchResults();
                }
            });
        });
    }

    setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K ou Cmd+K para focar na pesquisa
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.querySelector('input[type="text"]');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }

            // Escape para fechar resultados
            if (e.key === 'Escape') {
                this.hideSearchResults();
            }
        });
    }

    performSearch(query) {
        if (!query || query.length < 2) {
            this.hideSearchResults();
            return;
        }

        const results = this.searchInIndex(query);
        this.displaySearchResults(results, query);
    }

    searchInIndex(query) {
        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
        
        return this.searchIndex
            .map(item => {
                let score = 0;
                const title = item.title.toLowerCase();
                const content = item.content.toLowerCase();
                const keywords = item.keywords.join(' ').toLowerCase();

                // Pesquisar em título (peso maior)
                searchTerms.forEach(term => {
                    if (title.includes(term)) score += 10;
                    if (title.startsWith(term)) score += 5;
                });

                // Pesquisar em conteúdo
                searchTerms.forEach(term => {
                    if (content.includes(term)) score += 3;
                });

                // Pesquisar em keywords
                searchTerms.forEach(term => {
                    if (keywords.includes(term)) score += 2;
                });

                return { ...item, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8); // Máximo 8 resultados
    }

    displaySearchResults(results, query) {
        this.removeExistingResults();

        if (results.length === 0) {
            this.showNoResults(query);
            return;
        }

        const searchContainer = document.querySelector('.search-container');
        if (!searchContainer) return;

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'search-results';
        resultsContainer.innerHTML = `
            <div class="search-results-header">
                <span class="search-results-count">${results.length} resultado${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}</span>
                <button class="search-results-close" onclick="this.closest('.search-results').remove()">×</button>
            </div>
            <div class="search-results-list">
                ${results.map(result => this.createResultItem(result, query)).join('')}
            </div>
        `;

        searchContainer.appendChild(resultsContainer);
    }

    createResultItem(result, query) {
        const isCurrentPage = result.url === this.currentPage;
        const highlightedTitle = this.highlightText(result.title, query);
        const highlightedContent = this.highlightText(result.content.substring(0, 120) + '...', query);

        return `
            <div class="search-result-item ${isCurrentPage ? 'current-page' : ''}" 
                 onclick="window.location.href='${result.url}'">
                <div class="search-result-title">${highlightedTitle}</div>
                <div class="search-result-content">${highlightedContent}</div>
                <div class="search-result-url">${result.url}</div>
            </div>
        `;
    }

    highlightText(text, query) {
        const terms = query.toLowerCase().split(' ').filter(term => term.length > 0);
        let highlightedText = text;

        terms.forEach(term => {
            const regex = new RegExp(`(${term})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
        });

        return highlightedText;
    }

    showNoResults(query) {
        const searchContainer = document.querySelector('.search-container');
        if (!searchContainer) return;

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'search-results';
        resultsContainer.innerHTML = `
            <div class="search-results-header">
                <span class="search-results-count">Nenhum resultado encontrado</span>
                <button class="search-results-close" onclick="this.closest('.search-results').remove()">×</button>
            </div>
            <div class="search-results-list">
                <div class="search-no-results">
                    <p>Não foram encontrados resultados para "<strong>${query}</strong>"</p>
                    <p class="search-suggestions">Tente:</p>
                    <ul>
                        <li>Verificar a ortografia</li>
                        <li>Usar termos mais gerais</li>
                        <li>Experimentar palavras-chave diferentes</li>
                    </ul>
                </div>
            </div>
        `;

        searchContainer.appendChild(resultsContainer);
    }

    showSearchResults(query) {
        if (query && query.length >= 2) {
            this.performSearch(query);
        }
    }

    hideSearchResults() {
        this.removeExistingResults();
    }

    removeExistingResults() {
        const existingResults = document.querySelector('.search-results');
        if (existingResults) {
            existingResults.remove();
        }
    }
}

// Inicializar pesquisa quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    new DocumentationSearch();
});

// Exportar para uso global se necessário
window.DocumentationSearch = DocumentationSearch;
