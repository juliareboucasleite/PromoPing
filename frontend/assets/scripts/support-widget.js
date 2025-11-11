/**
 * PromoPing Support Widget
 * 
 * Widget flutuante para suporte ao cliente com sistema de threads.
 * Cada utilizador pode criar múltiplas conversas (threads) distintas.
 * 
 * Funcionalidades:
 * - Criar nova conversa (nova thread)
 * - Responder à conversa existente
 * - Visualizar histórico de mensagens
 * - Sincronização com API Node.js
 */

(function () {
  'use strict';

  // ============================================================================
  // CONFIGURAÇÃO E UTILITÁRIOS
  // ============================================================================

  /**
   * Obtém o token JWT do localStorage
   * @returns {string|null} Token JWT ou null se não encontrado
   */
  function getToken() {
    return localStorage.getItem('token') || localStorage.getItem('PROMOPING_TOKEN');
  }

  /**
   * Obtém a URL base da API
   * @returns {string} URL base da API
   */
  function getAPIBase() {
    if (window.API_BASE) return window.API_BASE;
    if (window.PromoPingAdmin && window.PromoPingAdmin.API_BASE) {
      return window.PromoPingAdmin.API_BASE;
    }
    return 'http://localhost:3000';
  }

  /**
   * Faz requisição HTTP para a API com autenticação JWT
   * @param {string} path - Caminho do endpoint (ex: '/api/support/messages')
   * @param {Object} opts - Opções da requisição (method, body, headers, etc)
   * @returns {Promise<Object>} Resposta parseada da API
   * @throws {Error} Se a requisição falhar
   */
  async function fetchJSON(path, opts = {}) {
    const token = getToken();
    let apiBase = getAPIBase().replace(/\/+$/, '');
    
    // Construir URL completa
    const fullPath = path.startsWith('http') 
      ? path 
      : apiBase + (path.startsWith('/') ? path : '/' + path);
    
    console.log(' [Support Widget] Requisição:', opts.method || 'GET', fullPath);
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(opts.headers || {})
    };

    try {
      const resp = await fetch(fullPath, { ...opts, headers });
      const responseText = await resp.text();
      
      if (!resp.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { error: responseText || `HTTP ${resp.status}` };
        }
        throw new Error(errorData.error || `HTTP ${resp.status}: ${resp.statusText}`);
      }

      return JSON.parse(responseText);
    } catch (error) {
      console.error(' [Support Widget] Erro na requisição:', error.message);
      throw error;
    }
  }

  // ============================================================================
  // GESTÃO DE THREADS E MENSAGENS
  // ============================================================================

  /**
   * Carrega todas as mensagens de uma thread específica
   * @param {number} threadId - ID da thread
   * @returns {Promise<Array>} Array de mensagens ordenadas por data
   */
  async function loadConversation(threadId) {
    try {
      const res = await fetchJSON(`/api/support/messages?threadId=${threadId}`);
      return res.items || [];
    } catch (error) {
      console.error(' [Support Widget] Erro ao carregar conversa:', error);
      return [];
    }
  }

  /**
   * Renderiza uma thread na lista lateral
   * @param {Object} thread - Objeto da thread com id, message, createdAt, replyCount, etc
   * @param {boolean} isActive - Se esta thread está atualmente selecionada
   * @param {boolean} hasUnread - Se há mensagens não lidas (respostas do suporte)
   * @returns {string} HTML da thread renderizada
   */
  function renderThread(thread, isActive = false, hasUnread = false) {
    const date = new Date(thread.createdAt).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
    const preview = thread.message.length > 50 
      ? thread.message.substring(0, 50) + '...' 
      : thread.message;
    const replyCount = thread.replyCount || 0;
    
    // Determinar se há mensagens não lidas (se lastReplyAt > createdAt e senderType = 'support')
    const hasSupportReplies = replyCount > 0 && thread.lastReplyAt;
    
    return `
      <div class="pp-thread-item" data-thread-id="${thread.id}" 
           style="padding:12px;border-bottom:1px solid #eee;cursor:pointer;transition:background 0.2s;background:${isActive ? '#fff3e0' : hasUnread || hasSupportReplies ? '#fff8f0' : '#fff'};position:relative;"
           onmouseover="this.style.background='#f5f5f5'" 
           onmouseout="this.style.background='${isActive ? '#fff3e0' : hasUnread || hasSupportReplies ? '#fff8f0' : '#fff'}'">
        ${hasUnread || hasSupportReplies ? '<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#f17603;"></div>' : ''}
        <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <div style="font-size:13px;font-weight:${hasUnread || hasSupportReplies ? '700' : '600'};color:#344767;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                Thread #${thread.id}
              </div>
              ${hasUnread || hasSupportReplies ? '<span style="width:8px;height:8px;background:#f17603;border-radius:50%;flex-shrink:0;"></span>' : ''}
            </div>
            <div style="font-size:12px;color:#666;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${preview}
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#999;">
              <span>${date}</span>
              ${replyCount > 0 ? `<span style="background:#f17603;color:#fff;padding:2px 6px;border-radius:10px;font-size:10px;">${replyCount} respostas</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza uma mensagem individual no formato HTML
   * @param {Object} msg - Objeto da mensagem com senderType, message, createdAt, etc
   * @returns {string} HTML da mensagem renderizada
   */
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
      <div style="display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'};margin-bottom:20px;align-items:flex-end;gap:12px;">
        ${!isUser ? `
          <img src="https://github.com/juliareboucasleite.png" alt="suporte" 
               style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.15);border:2px solid white;">
        ` : ''}
        <div style="max-width:75%;display:flex;flex-direction:column;align-items:${isUser ? 'flex-end' : 'flex-start'};gap:4px;">
          <div style="display:flex;align-items:center;gap:8px;justify-content:${isUser ? 'flex-end' : 'flex-start'};">
            <span style="font-size:11px;font-weight:600;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px;">${isUser ? 'Você' : 'Suporte'}</span>
            <span style="font-size:10px;color:#adb5bd;">${date} às ${time}</span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:8px;justify-content:${isUser ? 'flex-end' : 'flex-start'};">
            <div style="padding:12px 16px;border-radius:18px;background:${isUser ? 'linear-gradient(135deg, #f17603 0%, #ff9800 100%)' : '#ffffff'};color:${isUser ? '#fff' : '#344767'};word-wrap:break-word;box-shadow:0 2px 12px rgba(0,0,0,0.1);${isUser ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;'};max-width:100%;border:${isUser ? 'none' : '1px solid #e9ecef'};">
              <div style="font-size:14px;line-height:1.5;white-space:pre-wrap;">${msg.message}</div>
            </div>
            ${isUser ? `
              <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg, #f17603 0%, #ff9800 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(241,118,3,0.3);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="8" r="3" fill="white"/>
                  <path d="M6 20C6 16 9 13 12 13C15 13 18 16 18 20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="white"/>
                </svg>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Atualiza a interface com as mensagens de uma thread
   * @param {number} threadId - ID da thread a carregar
   * @param {HTMLElement} container - Elemento HTML onde as mensagens serão renderizadas
   */
  async function refreshMessages(threadId, container) {
    if (!threadId) {
      container.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">Nenhuma conversa selecionada.</div>';
      return;
    }
    
    try {
      const messages = await loadConversation(threadId);
      container.innerHTML = messages.length > 0 
        ? messages.map(renderMessage).join('')
        : '<div style="text-align:center;color:#999;padding:20px;">Nenhuma mensagem nesta conversa.</div>';
      container.scrollTop = container.scrollHeight;
    } catch (error) {
      console.error(' [Support Widget] Erro ao atualizar mensagens:', error);
      container.innerHTML = '<div style="text-align:center;color:#d32f2f;padding:20px;">Erro ao carregar mensagens.</div>';
    }
  }

  // ============================================================================
  // WIDGET PRINCIPAL
  // ============================================================================

  /**
   * Inicializa o widget de suporte no frontend
   * Cria o botão flutuante e o modal de conversação
   */
  function initSupportWidgetFront() {
    // Evitar múltiplas inicializações
    if (document.getElementById('pp-support-btn')) {
      console.warn(' [Support Widget] Widget já inicializado');
      return;
    }

    // Estado da thread atual (null = nova conversa, number = thread existente)
    let currentThreadId = null;

    // Criar botão flutuante
    const btn = createFloatingButton();
    document.body.appendChild(btn);

    // Criar modal de conversação
    const modal = createModal();
    document.body.appendChild(modal);

    // Referências aos elementos do DOM
    const messagesContainer = modal.querySelector('#pp-support-messages');
    const textEl = modal.querySelector('#pp-support-text');
    const fb = modal.querySelector('#pp-support-feedback');
    const threadInfo = modal.querySelector('#pp-support-thread-info');
    const threadPreview = modal.querySelector('#pp-support-thread-preview');
    const threadsSidebar = modal.querySelector('#pp-support-threads-sidebar');
    const threadsList = modal.querySelector('#pp-support-threads-list');
    const toggleThreadsBtn = modal.querySelector('#pp-support-toggle-threads');
    const paginationContainer = modal.querySelector('#pp-support-pagination');
    const prevPageBtn = modal.querySelector('#pp-support-prev-page');
    const nextPageBtn = modal.querySelector('#pp-support-next-page');
    const pageInfo = modal.querySelector('#pp-support-page-info');
    
    // Estado das threads e paginação
    let allThreads = [];
    let currentPage = 1;
    let paginationInfo = null;
    const threadsPerPage = 10;

    // ========================================================================
    // FUNÇÕES DE GESTÃO DE THREAD
    // ========================================================================

    /**
     * Atualiza o indicador visual da thread atual
     * Mostra qual thread está sendo usada quando está respondendo
     */
    function updateThreadInfo() {
      if (currentThreadId) {
        threadInfo.style.display = 'block';
        threadPreview.textContent = `Thread #${currentThreadId}`;
      } else {
        threadInfo.style.display = 'none';
      }
    }

    /**
     * Inicia uma nova conversa (nova thread)
     * Limpa o currentThreadId para que a próxima mensagem crie uma nova thread
     */
    function startNewConversation() {
      currentThreadId = null;
      messagesContainer.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">Nova conversa. Envie sua mensagem!</div>';
      textEl.value = '';
      textEl.focus();
      updateThreadInfo();
      console.log(' [Support Widget] Nova conversa iniciada');
    }

    /**
     * Carrega todas as threads do utilizador com paginação
     * @param {number} page - Número da página (começa em 1)
     * @param {number} limit - Número de threads por página
     */
    async function loadAllThreads(page = 1, limit = threadsPerPage) {
      try {
        const res = await fetchJSON(`/api/support/messages?limit=${limit}&page=${page}`);
        allThreads = res.items || [];
        paginationInfo = res.pagination || null;
        currentPage = page;
        
        renderThreadsList();
        updatePaginationControls();
      } catch (error) {
        console.error(' [Support Widget] Erro ao carregar threads:', error);
        threadsList.innerHTML = '<div style="text-align:center;color:#d32f2f;padding:20px;font-size:12px;">Erro ao carregar conversas.</div>';
      }
    }

    /**
     * Atualiza os controles de paginação
     */
    function updatePaginationControls() {
      if (!paginationInfo || paginationInfo.totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
      }

      paginationContainer.style.display = 'flex';
      pageInfo.textContent = `Página ${paginationInfo.page} de ${paginationInfo.totalPages}`;
      
      // Habilitar/desabilitar botões
      prevPageBtn.disabled = !paginationInfo.hasPrev;
      prevPageBtn.style.opacity = paginationInfo.hasPrev ? '1' : '0.5';
      prevPageBtn.style.cursor = paginationInfo.hasPrev ? 'pointer' : 'not-allowed';
      
      nextPageBtn.disabled = !paginationInfo.hasNext;
      nextPageBtn.style.opacity = paginationInfo.hasNext ? '1' : '0.5';
      nextPageBtn.style.cursor = paginationInfo.hasNext ? 'pointer' : 'not-allowed';
    }

    /**
     * Renderiza a lista de threads na sidebar
     * Detecta threads com respostas do suporte (não lidas)
     */
    function renderThreadsList() {
      if (allThreads.length === 0) {
        threadsList.innerHTML = '<div style="text-align:center;color:#999;padding:20px;font-size:12px;">Nenhuma conversa ainda.</div>';
        return;
      }

      threadsList.innerHTML = allThreads.map(thread => {
        const isActive = thread.id === currentThreadId;
        // Thread tem respostas não lidas se:
        // 1. Tem replyCount > 0
        // 2. lastReplyAt existe e é mais recente que createdAt
        // 3. Não está atualmente selecionada (presumimos que se está selecionada, foi lida)
        const hasUnread = !isActive && thread.replyCount > 0 && 
                         thread.lastReplyAt && 
                         new Date(thread.lastReplyAt) > new Date(thread.createdAt);
        
        return renderThread(thread, isActive, hasUnread);
      }).join('');

      // Adicionar event listeners para cada thread
      threadsList.querySelectorAll('.pp-thread-item').forEach(item => {
        item.addEventListener('click', () => {
          const threadId = parseInt(item.dataset.threadId);
          selectThread(threadId);
        });
      });
    }

    /**
     * Seleciona uma thread e carrega suas mensagens
     * @param {number} threadId - ID da thread a selecionar
     */
    async function selectThread(threadId) {
      currentThreadId = threadId;
      await refreshMessages(threadId, messagesContainer);
      updateThreadInfo();
      renderThreadsList(); // Atualiza destaque visual
    }

    /**
     * Carrega a thread mais recente do utilizador
     * Usado quando o widget é aberto pela primeira vez
     */
    async function loadLatestThread() {
      try {
        // Carrega todas as threads primeiro
        await loadAllThreads();
        
        if (allThreads.length > 0) {
          // Carrega a thread mais recente (primeira da lista)
          const latestThread = allThreads[0];
          currentThreadId = latestThread.id;
          await refreshMessages(currentThreadId, messagesContainer);
          updateThreadInfo();
        } else {
          // Nenhuma thread existente - preparar para nova conversa
          currentThreadId = null;
          messagesContainer.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">Nenhuma conversa ainda. Envie sua primeira mensagem!</div>';
          updateThreadInfo();
        }
      } catch (error) {
        console.error(' [Support Widget] Erro ao carregar thread:', error);
        messagesContainer.innerHTML = '<div style="text-align:center;color:#d32f2f;padding:20px;">Erro ao carregar conversas.</div>';
        currentThreadId = null;
        updateThreadInfo();
      }
    }

    /**
     * Envia uma mensagem
     * Cria nova thread se currentThreadId é null, ou responde à thread existente
     */
    async function sendMessage() {
      const token = getToken();
      if (!token) {
        window.location.href = '/PromoPing/frontend/pages/inc/Login.html';
        return;
      }

      const message = (textEl.value || '').trim();
      if (!message) {
        fb.textContent = 'Escreva uma mensagem.';
        fb.style.color = '#a66';
        return;
      }

      try {
        fb.textContent = 'Enviando...';
        fb.style.color = '#666';

        let result;

        if (currentThreadId) {
          // ============================================================
          // RESPOSTA À THREAD EXISTENTE
          // ============================================================
          console.log(' [Support Widget] Respondendo à thread:', currentThreadId);
          
          // Carrega a thread completa para obter a última mensagem
          const threadMessages = await loadConversation(currentThreadId);
          const lastMsg = threadMessages.length > 0 
            ? threadMessages[threadMessages.length - 1] 
            : { id: currentThreadId };

          // Envia resposta à última mensagem da thread
          result = await fetchJSON(`/api/support/messages/${lastMsg.id}/reply`, {
            method: 'POST',
            body: JSON.stringify({ 
              message, 
              senderType: 'user' 
            })
          });

          console.log(' [Support Widget] Resposta enviada à thread:', currentThreadId);
        } else {
          // ============================================================
          // CRIAR NOVA THREAD (NOVA CONVERSA)
          // ============================================================
          console.log(' [Support Widget] Criando nova thread');
          
          result = await fetchJSON('/api/support/messages', {
            method: 'POST',
            body: JSON.stringify({ message })
          });

          // Atualiza o currentThreadId com a nova thread criada
          // IMPORTANTE: threadId pode ser o próprio ID da mensagem (primeira mensagem = thread)
          currentThreadId = result.threadId || result.id;
          console.log(' [Support Widget] Nova thread criada:', currentThreadId);
          updateThreadInfo();
        }

        // Limpar campo e atualizar interface
        textEl.value = '';
        fb.textContent = 'Enviado com sucesso!';
        fb.style.color = '#2e7d32';
        setTimeout(() => { fb.textContent = ''; }, 2000);

        // Atualizar mensagens na interface
        await refreshMessages(currentThreadId, messagesContainer);
        
        // Recarregar lista de threads para atualizar contadores
        await loadAllThreads();
      } catch (error) {
        console.error(' [Support Widget] Erro ao enviar mensagem:', error);
        fb.textContent = `Falha ao enviar: ${error.message}`;
        fb.style.color = '#c62828';
      }
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    // Abrir/fechar widget
    btn.addEventListener('click', async () => {
      const token = getToken();
      if (!token) {
        window.location.href = '/PromoPing/frontend/pages/inc/Login.html';
        return;
      }
      
      const isOpen = modal.style.display !== 'none';
      modal.style.display = isOpen ? 'none' : 'flex';
      
      if (!isOpen) {
        await loadLatestThread();
      }
    });

    // Fechar modal
    modal.querySelector('#pp-support-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    // Nova conversa
    modal.querySelector('#pp-support-new').addEventListener('click', () => {
      startNewConversation();
    });

    // Toggle sidebar de threads
    toggleThreadsBtn.addEventListener('click', () => {
      const isVisible = threadsSidebar.style.display !== 'none';
      threadsSidebar.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        loadAllThreads(); // Recarregar threads quando abrir
      }
    });

    // Navegação de páginas
    prevPageBtn.addEventListener('click', () => {
      if (paginationInfo && paginationInfo.hasPrev) {
        loadAllThreads(currentPage - 1);
      }
    });

    nextPageBtn.addEventListener('click', () => {
      if (paginationInfo && paginationInfo.hasNext) {
        loadAllThreads(currentPage + 1);
      }
    });

    // Enviar mensagem
    modal.querySelector('#pp-support-send').addEventListener('click', sendMessage);

    // Enviar com Enter (Ctrl+Enter para nova linha)
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // ============================================================================
  // FUNÇÕES AUXILIARES DE CRIAÇÃO DE ELEMENTOS
  // ============================================================================

  /**
   * Cria o botão flutuante do widget
   * @returns {HTMLButtonElement} Botão criado
   */
  function createFloatingButton() {
    const btn = document.createElement('button');
    btn.id = 'pp-support-btn';
    btn.className = 'pp-support-btn';
    btn.textContent = 'Suporte';
    
    Object.assign(btn.style, {
      position: 'fixed',
      right: '20px',
      bottom: '20px',
      zIndex: '1080',
      padding: '10px 14px',
      border: 'none',
      borderRadius: '999px',
      background: '#f17603',
      color: '#fff',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,.15)',
      fontFamily: 'inherit',
      fontSize: '14px',
      fontWeight: '500'
    });

    return btn;
  }

  /**
   * Cria o modal de conversação
   * @returns {HTMLDivElement} Modal criado
   */
  function createModal() {
    const modal = document.createElement('div');
    modal.id = 'pp-support-modal';
    
    Object.assign(modal.style, {
      position: 'fixed',
      right: '20px',
      bottom: '70px',
      width: '500px',
      maxWidth: '90vw',
      height: '600px',
      maxHeight: '90vh',
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 12px 24px rgba(0,0,0,.25)',
      display: 'none',
      zIndex: '1080',
      overflow: 'hidden',
      flexDirection: 'column'
    });

    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:#fff;border-bottom:1px solid #eee;flex-shrink:0;">
        <strong style="font-size:16px;">Contato de Suporte</strong>
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="pp-support-toggle-threads" style="border:1px solid #ddd;background:#fff;color:#666;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;transition:all 0.2s;" title="Mostrar/Ocultar conversas">Conversas</button>
          <button id="pp-support-new" style="border:1px solid #f17603;background:#fff;color:#f17603;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:500;transition:all 0.2s;">Nova Conversa</button>
          <button id="pp-support-close" style="border:none;background:none;color:#777;font-size:20px;cursor:pointer;padding:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;transition:color 0.2s;">✕</button>
        </div>
      </div>
      <div style="display:flex;flex:1;overflow:hidden;">
        <!-- Sidebar de Threads -->
        <div id="pp-support-threads-sidebar" style="width:250px;border-right:1px solid #eee;background:#fafafa;overflow-y:auto;display:none;flex-shrink:0;flex-direction:column;">
          <div style="padding:12px;border-bottom:1px solid #eee;background:#fff;flex-shrink:0;">
            <div style="font-size:12px;font-weight:600;color:#666;margin-bottom:8px;">SUAS CONVERSAS</div>
            <div id="pp-support-threads-list" style="max-height:400px;overflow-y:auto;">
              <div style="text-align:center;color:#999;padding:20px;font-size:12px;">Carregando conversas...</div>
            </div>
            <!-- Controles de Paginação -->
            <div id="pp-support-pagination" style="margin-top:8px;padding-top:8px;border-top:1px solid #eee;display:none;gap:4px;justify-content:space-between;align-items:center;">
              <button id="pp-support-prev-page" style="padding:4px 8px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer;font-size:11px;disabled:true;">« Anterior</button>
              <span id="pp-support-page-info" style="font-size:11px;color:#666;">Página 1</span>
              <button id="pp-support-next-page" style="padding:4px 8px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer;font-size:11px;">Próxima »</button>
            </div>
          </div>
        </div>
        <!-- Área de Mensagens -->
        <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
          <div id="pp-support-messages" style="flex:1;overflow-y:auto;padding:16px;background:#fafafa;">
            <div style="text-align:center;color:#999;padding:20px;">Carregando conversas...</div>
          </div>
          <div style="padding:12px 16px;border-top:1px solid #eee;background:#fff;flex-shrink:0;">
            <div id="pp-support-thread-info" style="margin-bottom:8px;padding:8px;background:#fff3e0;border-radius:6px;font-size:12px;color:#e65100;display:none;">
              <strong>Respondendo à conversa:</strong> <span id="pp-support-thread-preview"></span>
            </div>
            <textarea id="pp-support-text" rows="2" placeholder="Digite sua mensagem..." style="width:100%;border:1px solid #ddd;border-radius:8px;padding:10px;resize:none;font-size:14px;margin-bottom:8px;font-family:inherit;"></textarea>
            <button id="pp-support-send" style="width:100%;background:#f17603;color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:14px;font-weight:500;transition:background 0.2s;">Enviar</button>
            <div id="pp-support-feedback" style="margin-top:6px;font-size:12px;color:#666;text-align:center;"></div>
          </div>
        </div>
      </div>
    `;

    return modal;
  }

  // ============================================================================
  // EXPOSIÇÃO GLOBAL
  // ============================================================================

  window.initSupportWidgetFront = initSupportWidgetFront;
})();
