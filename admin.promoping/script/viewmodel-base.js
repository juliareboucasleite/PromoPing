/**
 * ViewModel Base - PromoPing Admin
 * Classe base para implementar padrão MVVM em vanilla JavaScript
 * 
 * Uso:
 * class MyViewModel extends ViewModel {
 *   constructor() {
 *     super();
 *     this.state = { data: null, loading: false };
 *   }
 *   
 *   async loadData() {
 *     this.setState({ loading: true });
 *     const data = await this.fetchAuth('/api/endpoint');
 *     this.setState({ data, loading: false });
 *   }
 * }
 */

(function() {
    'use strict';

    class ViewModel {
        constructor() {
            // Estado reativo do ViewModel
            this.state = {};
            
            // Observadores que serão notificados quando o estado mudar
            this.observers = [];
            
            // Configuração padrão
            this.config = {
                apiBase: window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000',
                token: localStorage.getItem('PROMOPING_TOKEN')
            };
            
            // Bind de métodos para manter contexto
            this.setState = this.setState.bind(this);
            this.getState = this.getState.bind(this);
        }

        /**
         * Define novo estado e notifica observadores
         * @param {Object} newState - Objeto com propriedades a atualizar
         */
        setState(newState) {
            const oldState = { ...this.state };
            this.state = { ...this.state, ...newState };
            this.notifyObservers(this.state, oldState);
        }

        /**
         * Obtém o estado atual
         * @returns {Object} Estado atual
         */
        getState() {
            return { ...this.state };
        }

        /**
         * Registra um observador que será notificado quando o estado mudar
         * @param {Function} callback - Função chamada quando estado muda
         * @returns {Function} Função para remover o observador
         */
        observe(callback) {
            this.observers.push(callback);
            
            // Retorna função para remover observador
            return () => {
                const index = this.observers.indexOf(callback);
                if (index > -1) {
                    this.observers.splice(index, 1);
                }
            };
        }

        /**
         * Notifica todos os observadores sobre mudança de estado
         * @param {Object} newState - Novo estado
         * @param {Object} oldState - Estado anterior
         */
        notifyObservers(newState, oldState) {
            this.observers.forEach(callback => {
                try {
                    callback(newState, oldState);
                } catch (error) {
                    console.error('[ViewModel] Erro ao notificar observador:', error);
                }
            });
        }

        /**
         * Verifica autenticação
         * @returns {boolean} true se autenticado
         */
        checkAuth() {
            if (!this.config.token) {
                window.location.href = 'login.html';
                return false;
            }
            return true;
        }

        /**
         * Faz requisição autenticada à API
         * @param {string} url - Endpoint da API
         * @param {Object} options - Opções do fetch
         * @returns {Promise<Response>} Resposta da API
         */
        async fetchAuth(url, options = {}) {
            try {
                const safeUrl = window.APIUtils 
                    ? window.APIUtils.buildSafeUrl(url) 
                    : `${this.config.apiBase}${url}`;
                
                const response = await fetch(safeUrl, {
                    ...options,
                    headers: {
                        'Authorization': `Bearer ${this.config.token}`,
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });

                // Verificar se a resposta é JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error(`[ViewModel] Resposta não-JSON de ${url}:`, text.substring(0, 200));
                    throw new Error(`Resposta inválida do servidor (${response.status}): ${text.substring(0, 100)}`);
                }

                // Se não for OK, tentar parsear JSON do erro
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
                }

                return response;
            } catch (error) {
                // Se já for um erro nosso, re-lançar
                if (error.message && error.message.includes('Resposta inválida')) {
                    throw error;
                }
                // Se for erro de rede ou outro tipo
                console.error(`[ViewModel] Erro ao fazer requisição para ${url}:`, error);
                throw new Error(`Erro de conexão: ${error.message}`);
            }
        }

        /**
         * Utilitário: Formatar data
         * @param {string} dateString - Data em formato string
         * @returns {string} Data formatada
         */
        formatDate(dateString) {
            if (!dateString) return 'N/A';
            const date = new Date(dateString);
            const now = new Date();
            const diff = now - date;
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (minutes < 1) return 'Agora';
            if (minutes < 60) return `${minutes}min atrás`;
            if (hours < 24) return `${hours}h atrás`;
            if (days < 7) return `${days}d atrás`;

            return date.toLocaleDateString('pt-PT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }

        /**
         * Utilitário: Escape HTML para prevenir XSS
         * @param {string} text - Texto a ser escapado
         * @returns {string} Texto escapado
         */
        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * Método para inicializar o ViewModel
         * Deve ser sobrescrito pelas classes filhas
         */
        async init() {
            // Implementação padrão vazia
            // Classes filhas devem sobrescrever
        }

        /**
         * Método para limpar recursos quando o ViewModel não é mais necessário
         */
        destroy() {
            this.observers = [];
            this.state = {};
        }
    }

    // Exportar para uso global
    window.ViewModel = ViewModel;

    console.log('[ViewModel] Classe base ViewModel carregada');
})();
