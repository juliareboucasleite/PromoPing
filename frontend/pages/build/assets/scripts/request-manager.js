
// Sistema centralizado pra evitar rate limiting e múltiplas requisições simultâneas (que é uma merda quando acontece)

class RequestManager {
  constructor() {
    // Map pra guardar requisições pendentes (evita fazer a mesma requisição 2x)
    this.pendingRequests = new Map();
    // Fila de requisições quando já tem muitas rodando ao mesmo tempo
    this.requestQueue = [];
    // Flag pra saber se já tá processando a fila (evita processar 2x)
    this.isProcessingQueue = false;
    
    // Info sobre rate limit atual (se tá bloqueado e quando pode tentar de novo)
    this.rateLimitInfo = {
      isLimited: false,
      retryAfter: 0,
      lastRequest: 0
    };
    
    // Contador de requisições pra prevenir rate limit (a parte importante do sistema)
    this.requestCounter = {
      count: 0, // quantas requisições já fez na janela atual
      windowStart: Date.now(), // quando começou a janela de 15 minutos
      windowDuration: 15 * 60 * 1000, // 15 minutos (mesma janela do rate limit do backend)
      maxRequests: 500, // Limite do backend (500 requisições por 15 minutos)
      warningThreshold: 0.8, // 80% do limite (400 requisições) - quando chegar aqui, força pausa
      isShowingWarning: false // flag pra não mostrar tela de cooldown 2x
    };
    
    // Configurações gerais do sistema
    this.config = {
      maxConcurrentRequests: 3, // máximo de requisições ao mesmo tempo
      requestDelay: 100, // delay mínimo entre requisições (ms) - ajuda a não sobrecarregar
      rateLimitRetryAfter: 15 * 60 * 1000, // 15 minutos (tempo de espera se tomar rate limit)
      maxRetries: 3, // máximo de tentativas se der erro
      cooldownDuration: 2 * 60 * 1000 // 2 minutos de pausa forçada quando tá perto do limite
    };
    
    // Estado da tela de carregamento forçada (quando precisa fazer pausa preventiva)
    this.cooldownScreen = {
      isActive: false, // se a tela tá ativa
      endTime: 0 // quando a pausa termina
    };
  }

  // Método principal - toda requisição passa por aqui (é tipo um guarda de trânsito)
  async makeRequest(url, options = {}) {
    const requestId = this.generateRequestId(url, options);
    
    // Se já tem uma requisição igual rodando, reutiliza ela (não faz 2x a mesma coisa)
    if (this.pendingRequests.has(requestId)) {
      console.log(`Reutilizando requisição pendente para: ${url}`);
      return this.pendingRequests.get(requestId);
    }

    // Se tá em cooldown forçado (tela de carregamento apareceu), espera terminar
    if (this.isInCooldown()) {
      await this.waitForCooldown();
    }

    // Se tá perto do rate limit (80% do limite), força uma pausa preventiva (a mágica acontece aqui)
    if (this.shouldForceCooldown()) {
      await this.forceCooldown(); // mostra tela e reseta contador
    }

    // Se já tá em rate limit de verdade (tomou o bloqueio), não deixa fazer requisição
    if (this.isRateLimited()) {
      console.warn(`Rate limit ativo. Aguardando ${this.getRetryAfter()}ms`);
      throw new Error('Rate limit ativo. Tente novamente em alguns minutos.');
    }

    // Incrementa o contador (conta quantas requisições já fez)
    this.incrementRequestCount();

    // Se já tem muitas requisições rodando ao mesmo tempo, coloca na fila
    if (this.pendingRequests.size >= this.config.maxConcurrentRequests) {
      return this.queueRequest(url, options);
    }

    // Tudo certo, pode executar a requisição
    return this.executeRequest(url, options, requestId);
  }

  // Executa a requisição de verdade (aqui que faz o fetch)
  async executeRequest(url, options, requestId) {
    const requestPromise = this.performFetch(url, options);
    this.pendingRequests.set(requestId, requestPromise); // marca como pendente

    try {
      const response = await requestPromise;
      
      // Se o servidor retornou 429 (rate limit), marca como bloqueado
      if (response.status === 429) {
        const errorData = await response.json();
        this.handleRateLimit(errorData.retryAfter || this.config.rateLimitRetryAfter);
        throw new Error('Rate limit atingido. Tente novamente em alguns minutos.');
      }

      // Se deu certo, atualiza info de rate limit
      this.updateRateLimitInfo();
      return response;
    } catch (error) {
      console.error(`Erro na requisição ${url}:`, error);
      throw error;
    } finally {
      // Sempre remove da lista de pendentes e processa a fila (pra não travar)
      this.pendingRequests.delete(requestId);
      this.processQueue();
    }
  }

  // Faz o fetch de verdade (com delay mínimo entre requisições pra não sobrecarregar)
  async performFetch(url, options) {
    // Calcula quanto tempo passou desde a última requisição
    const timeSinceLastRequest = Date.now() - this.rateLimitInfo.lastRequest;
    // Se passou menos de 100ms, espera o resto (evita fazer requisições muito rápidas)
    if (timeSinceLastRequest < this.config.requestDelay) {
      await this.delay(this.config.requestDelay - timeSinceLastRequest);
    }

    // Headers padrão (sempre JSON)
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers // permite sobrescrever se necessário
      }
    };

    // Faz o fetch de verdade
    return fetch(url, { ...defaultOptions, ...options });
  }

  // Coloca requisição na fila quando já tem muitas rodando (tipo fila de banco)
  async queueRequest(url, options) {
    return new Promise((resolve, reject) => {
      // Adiciona na fila com callbacks pra resolver/rejeitar depois
      this.requestQueue.push({ url, options, resolve, reject });
      this.processQueue(); // tenta processar a fila
    });
  }

  // Processa a fila de requisições (tira da fila e executa quando tiver espaço)
  async processQueue() {
    // Se já tá processando ou não tem nada na fila, vaza
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true; // marca como processando

    // Enquanto tem coisa na fila E não passou do limite de requisições simultâneas
    while (this.requestQueue.length > 0 && this.pendingRequests.size < this.config.maxConcurrentRequests) {
      const { url, options, resolve, reject } = this.requestQueue.shift(); // tira da fila
      
      try {
        const response = await this.executeRequest(url, options, this.generateRequestId(url, options));
        resolve(response); // deu certo, resolve a promise
      } catch (error) {
        reject(error); // deu erro, rejeita a promise
      }
    }

    this.isProcessingQueue = false; // acabou de processar
  }

  // Gera um ID único pra requisição (pra não fazer a mesma requisição 2x)
  generateRequestId(url, options) {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`; // combina método, URL e body
  }

  // Verifica se tá bloqueado por rate limit (se já tomou o bloqueio de verdade)
  isRateLimited() {
    return this.rateLimitInfo.isLimited && Date.now() < this.rateLimitInfo.retryAfter;
  }

  // Retorna quanto tempo falta pro rate limit acabar (em ms)
  getRetryAfter() {
    return Math.max(0, this.rateLimitInfo.retryAfter - Date.now());
  }

  // Marca como bloqueado por rate limit (quando o servidor retorna 429)
  handleRateLimit(retryAfter) {
    this.rateLimitInfo.isLimited = true;
    this.rateLimitInfo.retryAfter = Date.now() + retryAfter; // calcula quando pode tentar de novo
    console.warn(`Rate limit ativado. Retry após ${retryAfter}ms`);
  }

  // Atualiza info de rate limit (marca última requisição e reseta se já passou o tempo)
  updateRateLimitInfo() {
    this.rateLimitInfo.lastRequest = Date.now();
    // Se já passou o tempo de bloqueio, libera de novo
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
      retryAfter: this.getRetryAfter(),
      requestCount: this.requestCounter.count,
      requestPercentage: (this.requestCounter.count / this.requestCounter.maxRequests * 100).toFixed(1)
    };
  }

  // Incrementa o contador de requisições (a parte que previne rate limit)
  incrementRequestCount() {
    const now = Date.now();
    const timeSinceWindowStart = now - this.requestCounter.windowStart;
    
    // Se passou a janela de 15 minutos, reseta tudo (nova janela, contador volta a zero)
    if (timeSinceWindowStart >= this.requestCounter.windowDuration) {
      this.requestCounter.count = 0;
      this.requestCounter.windowStart = now;
      console.log('[RequestManager] Janela de rate limit resetada');
    }
    
    // Incrementa o contador (mais uma requisição feita)
    this.requestCounter.count++;
    console.log(`[RequestManager] Requisição ${this.requestCounter.count}/${this.requestCounter.maxRequests} na janela atual`);
  }

  // Verifica se tá em cooldown ativo (tela de carregamento apareceu)
  isInCooldown() {
    return this.cooldownScreen.isActive && Date.now() < this.cooldownScreen.endTime;
  }

  // Espera o cooldown terminar (fica esperando até a tela sumir)
  async waitForCooldown() {
    const remaining = this.cooldownScreen.endTime - Date.now();
    if (remaining > 0) {
      await this.delay(remaining); // espera o tempo que falta
    }
  }

  // Verifica se tá perto do rate limit (80% do limite = 400 requisições)
  isNearRateLimit() {
    const threshold = Math.floor(this.requestCounter.maxRequests * this.requestCounter.warningThreshold);
    return this.requestCounter.count >= threshold; // se já fez 400+ requisições
  }

  // Verifica se deve forçar cooldown (a mágica acontece aqui - previne rate limit)
  shouldForceCooldown() {
    // Só força se: tá perto do limite E não tá mostrando warning E não tá em cooldown
    return this.isNearRateLimit() && !this.requestCounter.isShowingWarning && !this.isInCooldown();
  }

  // Força uma pausa preventiva pra evitar rate limit (a parte mais importante do sistema)
  async forceCooldown() {
    // Se já tá em cooldown, vaza (não faz 2x)
    if (this.requestCounter.isShowingWarning || this.isInCooldown()) {
      return;
    }

    // Marca como ativo e calcula quando termina
    this.requestCounter.isShowingWarning = true;
    this.cooldownScreen.isActive = true;
    this.cooldownScreen.endTime = Date.now() + this.config.cooldownDuration;
    
    const threshold = Math.floor(this.requestCounter.maxRequests * this.requestCounter.warningThreshold);
    console.warn(`[RequestManager] Próximo do rate limit (${this.requestCounter.count}/${this.requestCounter.maxRequests}, threshold: ${threshold}). Forçando pausa preventiva de ${this.config.cooldownDuration / 1000}s.`);

    // Mostra a tela de carregamento (user não pode fazer nada, é forçado a esperar)
    this.showCooldownScreen();

    // Espera o tempo de cooldown (2 minutos) - user fica preso na tela
    await this.delay(this.config.cooldownDuration);

    // AQUI É A MÁGICA: reseta o contador e a janela (isso "limpa" o rate limit)
    // Como reseta a janela, o backend vai contar como nova janela e não vai bloquear
    this.requestCounter.count = 0;
    this.requestCounter.windowStart = Date.now();
    this.requestCounter.isShowingWarning = false;
    this.cooldownScreen.isActive = false;
    this.cooldownScreen.endTime = 0;

    // Esconde a tela de carregamento
    this.hideCooldownScreen();

    console.log('[RequestManager] Cooldown concluído. Contador resetado. Rate limit "limpo".');
  }

  // Mostra a tela de carregamento forçada (user não pode fechar, tem que esperar)
  showCooldownScreen() {
    // Cria o overlay se não existir (tela preta que cobre tudo)
    let overlay = document.getElementById('rate-limit-cooldown-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'rate-limit-cooldown-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      
      overlay.innerHTML = `
        <div style="text-align: center; max-width: 500px; padding: 40px;">
          <div style="margin-bottom: 30px;">
            <img src="assets/images/PromoPing.png" alt="PromoPing" style="max-width: 150px; animation: pulse 2s ease-in-out infinite;">
          </div>
          <h2 style="font-size: 24px; margin-bottom: 20px; color: #fff;">A otimizar a ligação...</h2>
          <p style="font-size: 16px; color: rgba(255,255,255,0.8); margin-bottom: 30px; line-height: 1.6;">
            Estamos a fazer uma pausa breve para garantir o melhor desempenho e evitar sobrecarga do servidor.
          </p>
          <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 10px;">Tempo restante:</div>
            <div id="cooldown-timer" style="font-size: 32px; font-weight: bold; color: #FFA54B;">${Math.floor(this.config.cooldownDuration / 60000)}:${((this.config.cooldownDuration % 60000) / 1000).toString().padStart(2, '0')}</div>
          </div>
          <p style="font-size: 14px; color: rgba(255,255,255,0.6);">
            Por favor, aguarde enquanto otimizamos a ligação...
          </p>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.9; }
          }
        </style>
      `;
      
      document.body.appendChild(overlay);
    } else {
      // Se já existe, só mostra de novo
      overlay.style.display = 'flex';
    }

    // Atualiza o timer (mostra quanto tempo falta)
    this.updateCooldownTimer();
  }

  // Atualiza o timer na tela (mostra countdown em tempo real)
  updateCooldownTimer() {
    const timerElement = document.getElementById('cooldown-timer');
    if (!timerElement) return; // se não tem elemento, vaza

    const startTime = Date.now();
    const duration = this.config.cooldownDuration;
    
    // Função recursiva que atualiza o timer a cada segundo
    const updateTimer = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      
      if (timerElement) {
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
      
      // Se ainda tem tempo, atualiza de novo em 1 segundo
      if (remaining > 0) {
        setTimeout(updateTimer, 1000);
      }
    };
    
    updateTimer(); // começa a atualizar
  }

  // Esconde a tela de carregamento (quando o cooldown termina)
  hideCooldownScreen() {
    const overlay = document.getElementById('rate-limit-cooldown-overlay');
    if (overlay) {
      overlay.style.display = 'none'; // esconde o overlay
    }
  }
}

// Cria instância global do RequestManager (fica disponível em qualquer lugar)
window.requestManager = new RequestManager();

// Função helper pra facilitar o uso (ao invés de window.requestManager.makeRequest)
window.makeRequest = (url, options) => {
  return window.requestManager.makeRequest(url, options);
};

// Log de estatísticas a cada 30 segundos (só em desenvolvimento, pra debugar)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  setInterval(() => {
    const stats = window.requestManager.getStats();
    // Só loga se tiver algo rodando (pra não poluir o console)
    if (stats.pendingRequests > 0 || stats.queuedRequests > 0) {
      console.log('[RequestManager] Stats:', stats);
    }
  }, 30000);
}

console.log('Sistema de controle de requisições inicializado');
