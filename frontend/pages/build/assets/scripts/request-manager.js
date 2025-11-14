// ===== REQUEST MANAGER - CONTROLE DE REQUISIÇÕES =====
// Sistema centralizado para evitar rate limiting e múltiplas requisições simultâneas

class RequestManager {
  constructor() {
    this.pendingRequests = new Map();
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.rateLimitInfo = {
      isLimited: false,
      retryAfter: 0,
      lastRequest: 0
    };
    
    // Configurações
    this.config = {
      maxConcurrentRequests: 3,
      requestDelay: 100, // ms entre requisições
      rateLimitRetryAfter: 15 * 60 * 1000, // 15 minutos
      maxRetries: 3
    };
  }

  // Método principal para fazer requisições com controle de rate limiting
  async makeRequest(url, options = {}) {
    const requestId = this.generateRequestId(url, options);
    
    // Verificar se já existe uma requisição pendente para o mesmo endpoint
    if (this.pendingRequests.has(requestId)) {
      console.log(`[RequestManager] Reutilizando requisição pendente para: ${url}`);
      return this.pendingRequests.get(requestId);
    }

    // Verificar rate limiting
    if (this.isRateLimited()) {
      console.warn(`[RequestManager] Rate limit ativo. Aguardando ${this.getRetryAfter()}ms`);
      throw new Error('Rate limit ativo. Tente novamente em alguns minutos.');
    }

    // Adicionar à fila se necessário
    if (this.pendingRequests.size >= this.config.maxConcurrentRequests) {
      return this.queueRequest(url, options);
    }

    return this.executeRequest(url, options, requestId);
  }

  // Executa a requisição real
  async executeRequest(url, options, requestId) {
    const requestPromise = this.performFetch(url, options);
    this.pendingRequests.set(requestId, requestPromise);

    try {
      const response = await requestPromise;
      
      // Verificar se é erro de rate limit
      if (response.status === 429) {
        const errorData = await response.json();
        this.handleRateLimit(errorData.retryAfter || this.config.rateLimitRetryAfter);
        throw new Error('Rate limit atingido. Tente novamente em alguns minutos.');
      }

      this.updateRateLimitInfo();
      return response;
    } catch (error) {
      console.error(`[RequestManager] Erro na requisição ${url}:`, error);
      throw error;
    } finally {
      this.pendingRequests.delete(requestId);
      this.processQueue();
    }
  }

  // Executa o fetch real
  async performFetch(url, options) {
    // Adicionar delay mínimo entre requisições
    const timeSinceLastRequest = Date.now() - this.rateLimitInfo.lastRequest;
    if (timeSinceLastRequest < this.config.requestDelay) {
      await this.delay(this.config.requestDelay - timeSinceLastRequest);
    }

    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    return fetch(url, { ...defaultOptions, ...options });
  }

  // Adiciona requisição à fila
  async queueRequest(url, options) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, options, resolve, reject });
      this.processQueue();
    });
  }

  // Processa a fila de requisições
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.pendingRequests.size < this.config.maxConcurrentRequests) {
      const { url, options, resolve, reject } = this.requestQueue.shift();
      
      try {
        const response = await this.executeRequest(url, options, this.generateRequestId(url, options));
        resolve(response);
      } catch (error) {
        reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  // Gera ID único para a requisição
  generateRequestId(url, options) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  // Verifica se está em rate limit
  isRateLimited() {
    return this.rateLimitInfo.isLimited && Date.now() < this.rateLimitInfo.retryAfter;
  }

  // Retorna tempo restante do rate limit
  getRetryAfter() {
    return Math.max(0, this.rateLimitInfo.retryAfter - Date.now());
  }

  // Manipula rate limiting
  handleRateLimit(retryAfter) {
    this.rateLimitInfo.isLimited = true;
    this.rateLimitInfo.retryAfter = Date.now() + retryAfter;
    console.warn(`[RequestManager] Rate limit ativado. Retry após ${retryAfter}ms`);
  }

  // Atualiza informações de rate limiting
  updateRateLimitInfo() {
    this.rateLimitInfo.lastRequest = Date.now();
    // Reset rate limit após sucesso
    if (this.rateLimitInfo.isLimited && Date.now() > this.rateLimitInfo.retryAfter) {
      this.rateLimitInfo.isLimited = false;
      console.log('[RequestManager] Rate limit resetado');
    }
  }

  // Utilitário para delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Limpa todas as requisições pendentes
  clearPendingRequests() {
    this.pendingRequests.clear();
    this.requestQueue.forEach(({ reject }) => {
      reject(new Error('Requisições canceladas'));
    });
    this.requestQueue = [];
  }

  // Retorna estatísticas do manager
  getStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      queuedRequests: this.requestQueue.length,
      isRateLimited: this.isRateLimited(),
      retryAfter: this.getRetryAfter()
    };
  }
}

// Instância global do RequestManager
window.requestManager = new RequestManager();

// Função helper para facilitar o uso
window.makeRequest = (url, options) => {
  return window.requestManager.makeRequest(url, options);
};

// Log de estatísticas a cada 30 segundos (apenas em desenvolvimento)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  setInterval(() => {
    const stats = window.requestManager.getStats();
    if (stats.pendingRequests > 0 || stats.queuedRequests > 0) {
      console.log('[RequestManager] Stats:', stats);
    }
  }, 30000);
}

console.log('[RequestManager] Sistema de controle de requisições inicializado');
