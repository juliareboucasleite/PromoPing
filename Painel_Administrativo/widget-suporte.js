/**
 * Widget de Suporte PromoPing
 * Integração com Painel Administrativo
 * 
 * Para usar, inclua este script no seu projeto:
 * <script src="http://localhost/Painel_Administrativo/Painel_Administrativo/widget-suporte.js"></script>
 * 
 * Ou configure a API base:
 * <script>
 *   window.PROMOPING_SUPPORT_API = 'http://localhost/Painel_Administrativo/Painel_Administrativo';
 * </script>
 */

(function() {
  'use strict';
  
  // Configuração da API - Detectar automaticamente como o painel administrativo faz
  let API_BASE = null;
  
  async function detectApiBase() {
    // Se já foi detectado, retornar
    if (API_BASE) return API_BASE;
    
    const phpApiBase = window.location.origin;
    
    // 1. Verificar se foi configurado manualmente (mas NUNCA aceitar localhost:3000)
    if (window.PROMOPING_SUPPORT_API) {
      const configuredApi = window.PROMOPING_SUPPORT_API.replace(/\/+$/, '');
      // Se não for Node.js API, usar o configurado
      if (!configuredApi.includes(':3000') && !configuredApi.includes('127.0.0.1:3000')) {
        API_BASE = configuredApi;
        console.log('[Support Widget]  Usando API configurada:', API_BASE);
        return API_BASE;
      } else {
        console.warn('[Support Widget]  API configurada é Node.js, ignorando e tentando PHP...');
      }
    }
    
    // 2. Tentar usar API PHP primeiro (mesmo domínio - prioridade)
    // Tentar diferentes caminhos possíveis
    const possiblePaths = [
      '/Painel_Administrativo/Painel_Administrativo',
      '/Painel_Administrativo',
      '', // Raiz do servidor
    ];
    
    for (const path of possiblePaths) {
      const testPath = path ? `${phpApiBase}${path}` : phpApiBase;
      const testUrl = `${testPath}/api/status.php`;
      
      try {
        console.log('[Support Widget] Testando:', testUrl);
        const r = await fetch(testUrl, { method: 'GET', cache: 'no-cache' });
        if (r.ok) {
          API_BASE = testPath;
          console.log('[Support Widget]  API PHP detectada:', API_BASE);
          // Salvar no localStorage para não precisar detectar novamente
          localStorage.setItem('PROMOPING_SUPPORT_API', API_BASE);
          return API_BASE;
        }
      } catch (e) {
        console.log('[Support Widget]  Falhou:', testUrl, e.message);
      }
    }
    
    // 3. Tentar usar do localStorage se existir (mas não aceitar localhost:3000)
    const savedApi = localStorage.getItem('PROMOPING_SUPPORT_API');
    if (savedApi && !savedApi.includes(':3000')) {
      API_BASE = savedApi.replace(/\/+$/, '');
      console.log('[Support Widget]  Usando API salva:', API_BASE);
      return API_BASE;
    }
    
    // 4. Fallback: usar mesmo domínio como padrão (assumindo estrutura padrão)
    API_BASE = phpApiBase + '/Painel_Administrativo/Painel_Administrativo';
    console.log('[Support Widget]  Usando API padrão (fallback):', API_BASE);
    localStorage.setItem('PROMOPING_SUPPORT_API', API_BASE);
    return API_BASE;
  }
  
  // Estado do widget
  let currentThreadId = null;
  let pollingInterval = null;
  let lastUserId = null; // Rastrear userId anterior para detectar mudanças
  
  // Função para fazer requisições
  async function fetchAPI(endpoint, options = {}) {
    // Garantir que API_BASE está definido
    if (!API_BASE) {
      await detectApiBase();
    }
    
    // VERIFICAÇÃO CRÍTICA: Nunca usar localhost:3000
    if (API_BASE && (API_BASE.includes(':3000') || API_BASE.includes('127.0.0.1:3000'))) {
      console.error('[Support Widget]  ERRO: API_BASE é Node.js! Forçando detecção PHP...');
      API_BASE = null; // Resetar
      localStorage.removeItem('PROMOPING_SUPPORT_API'); // Limpar cache
      await detectApiBase(); // Detectar novamente
    }
    
    // Garantir que endpoint começa com /
    if (!endpoint.startsWith('/')) {
      endpoint = '/' + endpoint;
    }
    
    // Garantir que endpoint tem .php se necessário
    if (endpoint.includes('/api/support/messages') && !endpoint.includes('.php') && !endpoint.includes('/reply')) {
      endpoint = endpoint.replace('/api/support/messages', '/api/support/messages.php');
    }
    if (endpoint.includes('/api/support/messages_reply') && !endpoint.includes('.php')) {
      endpoint = endpoint.replace('/api/support/messages_reply', '/api/support/messages_reply.php');
    }
    // Se for reply com ID, usar o endpoint correto
    if (endpoint.includes('/messages/') && endpoint.includes('/reply') && !endpoint.includes('messages_reply.php')) {
      const match = endpoint.match(/\/messages\/(\d+)\/reply/);
      if (match) {
        const messageId = match[1];
        endpoint = `/api/support/messages_reply.php?id=${messageId}`;
      }
    }
    
    const url = `${API_BASE}${endpoint}`;
    
    // VERIFICAÇÃO FINAL: Nunca fazer requisição para localhost:3000
    if (url.includes(':3000')) {
      console.error('[Support Widget]  ERRO CRÍTICO: Tentando fazer requisição para Node.js API!');
      console.error('[Support Widget] URL:', url);
      throw new Error('Widget não pode usar API Node.js. Configure PROMOPING_SUPPORT_API para a API PHP.');
    }
    
    console.log('[Support Widget] Requisição:', options.method || 'GET', url);
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      cache: 'no-cache' // Evitar cache
    };
    
    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Support Widget]  Erro HTTP:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      console.log('[Support Widget]  Resposta recebida:', data);
      return data;
    } catch (error) {
      console.error('[Support Widget]  Erro na requisição:', error);
      throw error;
    }
  }
  
  // Buscar mensagens de uma thread
  async function loadThreadMessages(threadId) {
    try {
      const messages = await fetchAPI(`/api/support/messages.php?threadId=${threadId}`);
      return Array.isArray(messages) ? messages : [];
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      return [];
    }
  }
  
  // Criar nova mensagem - SEMPRE cria nova thread
  async function createMessage(message, userId = null) {
    try {
      // Garantir que API_BASE está definido
      if (!API_BASE) {
        await detectApiBase();
      }
      
      const body = {
        message: message,
        senderType: 'user',
        createNewThread: true // Forçar criação de nova thread
      };
      
      // IMPORTANTE: Sempre incluir userId se disponível
      if (userId) {
        body.userId = userId;
      }
      
      console.log('[Support Widget] Criando mensagem com body:', body);
      console.log('[Support Widget] Usando API:', API_BASE);
      
      const response = await fetchAPI('/api/support/messages.php', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      
      console.log('[Support Widget]  Resposta da API:', response);
      
      // Garantir que threadId seja o ID da mensagem se não vier na resposta
      if (response && !response.threadId) {
        response.threadId = response.id;
      }
      
      return response;
    } catch (error) {
      console.error('[Support Widget]  Erro ao criar mensagem:', error);
      throw error;
    }
  }
  
  // Renderizar mensagem
  function renderMessage(msg) {
    const isUser = msg.senderType === 'user';
    const time = new Date(msg.createdAt).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const date = new Date(msg.createdAt).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
    
    return `
      <div class="message-item d-flex justify-content-${isUser ? 'end' : 'start'} mb-3" style="gap: 8px;">
        ${!isUser ? `
          <div class="rounded-circle d-flex align-items-center justify-content-center" 
               style="width: 32px; height: 32px; background: linear-gradient(135deg, #f17603 0%, #ff9800 100%); flex-shrink: 0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="8" r="4" fill="white"/>
              <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="white" stroke-width="2"/>
            </svg>
          </div>
        ` : ''}
        <div style="max-width: 70%;">
          <div class="rounded p-3 shadow-sm" 
               style="background: ${isUser ? 'linear-gradient(135deg, #f17603 0%, #ff9800 100%)' : '#f8f9fa'}; 
                      color: ${isUser ? '#ffffff' : '#344767'};">
            <div style="font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(msg.message)}</div>
          </div>
          <small class="text-muted d-block mt-1" style="font-size: 11px;">
            ${isUser ? 'Você' : msg.userName || 'Suporte'} • ${date} ${time}
          </small>
        </div>
        ${isUser ? `
          <div class="rounded-circle d-flex align-items-center justify-content-center" 
               style="width: 32px; height: 32px; background: linear-gradient(135deg, #f17603 0%, #ff9800 100%); flex-shrink: 0;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="8" r="4" fill="white"/>
              <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="white" stroke-width="2"/>
            </svg>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // Escapar HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Atualizar mensagens
  async function refreshMessages(threadId, container) {
    if (!threadId || !container) return;
    const messages = await loadThreadMessages(threadId);
    container.innerHTML = messages.map(renderMessage).join('');
    container.scrollTop = container.scrollHeight;
  }
  
  // Iniciar polling
  function startPolling(threadId, container) {
    stopPolling();
    pollingInterval = setInterval(() => {
      refreshMessages(threadId, container);
    }, 3000);
  }
  
  // Parar polling
  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }
  
  // Função para obter userId de várias fontes
  function getUserId() {
    // 1. Variável global configurada manualmente
    if (window.PROMOPING_USER_ID) {
      return parseInt(window.PROMOPING_USER_ID);
    }
    
    // 2. localStorage
    const storedUserId = localStorage.getItem('PROMOPING_USER_ID');
    if (storedUserId) {
      return parseInt(storedUserId);
    }
    
    // 3. Tentar obter do objeto de usuário logado (se existir)
    if (window.user && window.user.id) {
      return parseInt(window.user.id);
    }
    if (window.currentUser && window.currentUser.id) {
      return parseInt(window.currentUser.id);
    }
    
    // 4. Tentar do localStorage genérico
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.id) return parseInt(user.id);
      } catch (e) {}
    }
    
    // 5. Tentar do sessionStorage
    const sessionUserId = sessionStorage.getItem('PROMOPING_USER_ID') || sessionStorage.getItem('userId');
    if (sessionUserId) {
      return parseInt(sessionUserId);
    }
    
    // 6. Se não encontrar, retornar null (a API aceitará)
    return null;
  }
  
  // Inicializar widget
  async function initSupportWidget() {
    // Verificar se já existe
    if (document.getElementById('pp-support-widget-btn')) return;
    
    // LIMPAR CACHE SE HOUVER localhost:3000
    const cachedApi = localStorage.getItem('PROMOPING_SUPPORT_API');
    if (cachedApi && (cachedApi.includes(':3000') || cachedApi.includes('127.0.0.1:3000'))) {
      console.warn('[Support Widget]  Cache inválido detectado (Node.js API), limpando...');
      localStorage.removeItem('PROMOPING_SUPPORT_API');
      API_BASE = null; // Forçar nova detecção
    }
    
    // Detectar API primeiro
    await detectApiBase();
    console.log('[Support Widget] 🚀 Inicializando com API:', API_BASE);
    
    // Verificação final
    if (API_BASE && (API_BASE.includes(':3000') || API_BASE.includes('127.0.0.1:3000'))) {
      console.error('[Support Widget]  ERRO: Ainda usando Node.js API após detecção!');
      throw new Error('Não foi possível detectar a API PHP. Configure window.PROMOPING_SUPPORT_API manualmente.');
    }
    
    // Obter userId dinamicamente
    let userId = getUserId();
    
    // Log para debug (remover em produção se necessário)
    console.log('[Support Widget] UserID detectado:', userId);
    
    // Criar botão flutuante
    const btn = document.createElement('button');
    btn.id = 'pp-support-widget-btn';
    btn.className = 'btn btn-primary position-fixed';
    btn.style.cssText = `
      right: 24px;
      bottom: 24px;
      z-index: 1080;
      border-radius: 50px;
      padding: 12px 24px;
      box-shadow: 0 4px 12px rgba(241, 118, 3, 0.4);
      background: linear-gradient(135deg, #f17603 0%, #ff9800 100%);
      border: none;
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    `;
    btn.innerText = 'Suporte';
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = '0 6px 16px rgba(241, 118, 3, 0.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 12px rgba(241, 118, 3, 0.4)';
    });
    document.body.appendChild(btn);
    
    // Criar modal
    const modal = document.createElement('div');
    modal.id = 'pp-support-widget-modal';
    modal.style.cssText = `
      position: fixed;
      right: 24px;
      bottom: 100px;
      width: 450px;
      max-width: 90vw;
      height: 600px;
      max-height: 90vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      z-index: 1081;
      display: none;
      flex-direction: column;
      overflow: hidden;
    `;
    modal.innerHTML = `
      <div style="padding: 16px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #f17603 0%, #ff9800 100%); color: white;">
        <strong>Contato de Suporte</strong>
        <button id="pp-support-widget-close" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px;">✕</button>
      </div>
      <div id="pp-support-widget-messages" style="flex: 1; overflow-y: auto; padding: 16px; background: #fafafa;">
        <div class="text-center text-muted py-4">Carregando...</div>
      </div>
      <div style="padding: 16px; border-top: 1px solid #e9ecef; background: white;">
        <div style="display: flex; gap: 8px; margin-bottom: 8px;" id="pp-support-widget-buttons-container">
          <button id="pp-support-widget-new-conversation" 
                  style="flex: 1; padding: 8px; background: #f8f9fa; color: #6c757d; border: 1px solid #dee2e6; border-radius: 8px; font-weight: 500; cursor: pointer; font-size: 12px;"
                  title="Iniciar nova conversa independente">
            ✨ Nova Conversa
          </button>
          <button id="pp-support-widget-clear-history" 
                  style="display: none; padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; font-size: 12px;"
                  title="Limpar histórico desta conversa">
 Limpar
          </button>
        </div>
        <textarea id="pp-support-widget-input" 
                  placeholder="${currentThreadId ? 'Digite sua mensagem...' : 'Digite sua mensagem para iniciar uma nova conversa...'}" 
                  rows="2"
                  style="width: 100%; padding: 12px; border: 1px solid #dee2e6; border-radius: 8px; resize: none; font-size: 14px; margin-bottom: 8px;"></textarea>
        <button id="pp-support-widget-send" 
                style="width: 100%; padding: 10px; background: linear-gradient(135deg, #f17603 0%, #ff9800 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          Enviar
        </button>
        <div id="pp-support-widget-feedback" style="font-size: 12px; margin-top: 8px; text-align: center;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    
    const messagesContainer = modal.querySelector('#pp-support-widget-messages');
    const inputEl = modal.querySelector('#pp-support-widget-input');
    const sendBtn = modal.querySelector('#pp-support-widget-send');
    const closeBtn = modal.querySelector('#pp-support-widget-close');
    const feedbackEl = modal.querySelector('#pp-support-widget-feedback');
    
    // Abrir/fechar modal
    btn.addEventListener('click', async () => {
      const isOpen = modal.style.display !== 'none';
      modal.style.display = isOpen ? 'none' : 'flex';
      
        if (!isOpen) {
        // Atualizar userId ao abrir (pode ter mudado)
        const newUserId = getUserId();
        
        // IMPORTANTE: Se o userId mudou, resetar thread para permitir nova conversa
        if (newUserId !== lastUserId && lastUserId !== null) {
          console.log('[Support Widget]  userId mudou de', lastUserId, 'para', newUserId, '- resetando thread');
          currentThreadId = null;
        }
        
        userId = newUserId;
        lastUserId = userId;
        
        console.log('[Support Widget] Abrindo modal com userId:', userId);
        
        // IMPORTANTE: SEMPRE resetar thread atual ao abrir modal
        // Isso garante que cada abertura do modal permita criar nova conversa
        currentThreadId = null;
        
        // Esconder botão de limpar quando não há thread
        if (clearHistoryBtn) {
          clearHistoryBtn.style.display = 'none';
        }
        
        // Atualizar placeholder
        inputEl.placeholder = 'Digite sua mensagem para iniciar uma nova conversa...';
        
        // Mostrar campo para criar nova conversa
        messagesContainer.innerHTML = '<div class="text-center text-muted py-4">Digite sua mensagem abaixo para iniciar uma nova conversa com o suporte.<br><small>Você pode criar múltiplas conversas independentes.</small></div>';
        inputEl.focus();
      } else {
        stopPolling();
      }
    });
    
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      stopPolling();
    });
    
    // Botão para iniciar nova conversa
    if (newConversationBtn) {
      newConversationBtn.addEventListener('click', () => {
        // IMPORTANTE: Resetar thread para permitir criar nova conversa
        currentThreadId = null;
        stopPolling();
        
        // Limpar mensagens do container
        messagesContainer.innerHTML = '<div class="text-center text-muted py-4">Nova conversa iniciada.<br><small>Digite sua mensagem abaixo para começar uma nova conversa independente.</small></div>';
        
        // Atualizar placeholder
        inputEl.placeholder = 'Digite sua mensagem para iniciar uma nova conversa...';
        inputEl.value = ''; // Limpar input
        
        // Esconder botão de limpar
        if (clearHistoryBtn) {
          clearHistoryBtn.style.display = 'none';
        }
        
        inputEl.focus();
        console.log('[Support Widget] Nova conversa iniciada - thread resetada');
      });
    }
    
    // Botão para limpar histórico da conversa atual
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', async () => {
        if (!currentThreadId) return;
        
        if (!confirm('Tem certeza que deseja limpar o histórico desta conversa? Esta ação não pode ser desfeita.')) {
          return;
        }
        
        try {
          feedbackEl.textContent = 'Limpando histórico...';
          feedbackEl.style.color = '#6c757d';
          
          // Chamar endpoint para deletar mensagens da thread
          await fetchAPI(`/api/support/messages.php?threadId=${currentThreadId}`, {
            method: 'DELETE'
          });
          
          feedbackEl.textContent = 'Histórico limpo com sucesso!';
          feedbackEl.style.color = '#28a745';
          
          // Resetar thread e mostrar mensagem
          currentThreadId = null;
          messagesContainer.innerHTML = '<div class="text-center text-muted py-4">Histórico limpo. Digite uma mensagem para iniciar uma nova conversa.</div>';
          inputEl.placeholder = 'Digite sua mensagem para iniciar uma nova conversa...';
          clearHistoryBtn.style.display = 'none';
          
          setTimeout(() => {
            feedbackEl.textContent = '';
          }, 2000);
        } catch (error) {
          console.error('[Support Widget] Erro ao limpar histórico:', error);
          feedbackEl.textContent = 'Erro ao limpar histórico.';
          feedbackEl.style.color = '#dc3545';
        }
      });
    }
    
    // Enviar mensagem
    const sendMessage = async () => {
      const text = inputEl.value.trim();
      if (!text) return;
      
      // Atualizar userId antes de enviar (pode ter mudado)
      const newUserId = getUserId();
      
      // IMPORTANTE: Se userId mudou, resetar thread para criar nova conversa
      if (newUserId !== lastUserId && lastUserId !== null) {
        console.log('[Support Widget]  userId mudou durante envio de', lastUserId, 'para', newUserId, '- resetando thread');
        currentThreadId = null;
      }
      
      userId = newUserId;
      lastUserId = userId;
      
      console.log('[Support Widget] Enviando mensagem com userId:', userId, '| currentThreadId:', currentThreadId);
      
      feedbackEl.textContent = 'Enviando...';
      feedbackEl.style.color = '#6c757d';
      
      try {
        if (!currentThreadId) {
          // Criar NOVA conversa/thread - SEMPRE cria thread nova e independente
          // Mesmo que seja o mesmo userId, cada mensagem inicial cria nova thread
          console.log('[Support Widget] 🆕 Criando NOVA conversa - currentThreadId é null, userId:', userId);
          
          const response = await createMessage(text, userId);
          
          // IMPORTANTE: Usar o ID da mensagem como threadId (primeira mensagem = thread inicial)
          // Se threadId vier na resposta, usar; senão, usar o ID da mensagem
          currentThreadId = response.threadId || response.id;
          
          console.log('[Support Widget]  Nova conversa criada:', {
            threadId: currentThreadId,
            messageId: response.id,
            userId: userId,
            response: response
          });
          
          inputEl.value = '';
          feedbackEl.textContent = 'Enviado! Nova conversa criada.';
          feedbackEl.style.color = '#28a745';
          
          // Mostrar botão de limpar agora que há thread
          if (clearHistoryBtn) {
            clearHistoryBtn.style.display = 'block';
          }
          
          // Atualizar placeholder
          inputEl.placeholder = 'Digite sua mensagem...';
          
          await refreshMessages(currentThreadId, messagesContainer);
          startPolling(currentThreadId, messagesContainer);
        } else {
          // Responder na thread existente
          const messages = await loadThreadMessages(currentThreadId);
          const lastMsg = messages.length > 0 ? messages[messages.length - 1] : { id: currentThreadId };
          
          // Usar o endpoint de reply
          const replyUrl = `/api/support/messages_reply.php?id=${lastMsg.id}`;
          await fetchAPI(replyUrl, {
            method: 'POST',
            body: JSON.stringify({
              message: text,
              senderType: 'user',
              userId: userId
            })
          });
          
          console.log('[Support Widget] Resposta enviada para thread:', currentThreadId);
          inputEl.value = '';
          feedbackEl.textContent = 'Enviado!';
          feedbackEl.style.color = '#28a745';
          await refreshMessages(currentThreadId, messagesContainer);
          
          // Mostrar botão de limpar quando há thread ativa
          if (clearHistoryBtn && currentThreadId) {
            clearHistoryBtn.style.display = 'block';
          }
          
          // Atualizar placeholder
          inputEl.placeholder = 'Digite sua mensagem...';
        }
        
        setTimeout(() => {
          feedbackEl.textContent = '';
        }, 2000);
      } catch (error) {
        console.error('[Support Widget] Erro ao enviar:', error);
        feedbackEl.textContent = 'Erro ao enviar. Tente novamente.';
        feedbackEl.style.color = '#dc3545';
      }
    };
    
    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  // Exportar para uso global
  window.PromoPingSupport = {
    init: initSupportWidget,
    detectApiBase: detectApiBase,
    get API_BASE() { return API_BASE; }
  };
  
  // Auto-inicializar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSupportWidget();
    });
  } else {
    // DOM já está pronto
    initSupportWidget();
  }
})();

