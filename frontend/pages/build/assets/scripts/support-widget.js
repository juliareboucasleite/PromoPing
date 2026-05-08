/**
 * Widget flutuante para suporte ao cliente com sistema de threads.
 * Cada utilizador pode criar múltiplas conversas (threads) distintas.
 * 
 * - Criar nova conversa (nova thread)
 * - Responder à conversa existente
 * - Visualizar histórico de mensagens
 * - Sincronização com API Node.js
 */

(function () {
  'use strict';

  /**
   * Obtém o token JWT do localStorage
   * @returns {string|null} Token JWT ou null se não encontrado
   */
  function getToken() {
    return localStorage.getItem('token') || localStorage.getItem('PROMOPING_TOKEN');
  }

  /** Chave no localStorage para o ID de sessão anónima */
  const ANON_ID_KEY = 'PROMOPING_ANONYMOUS_ID';

  /**
   * Obtém ou cria um ID de sessão para utilizador não logado (anónimo).
   * Quem pede ajuda sem estar logado fica como "unknown" / anónimo.
   * @returns {string} UUID da sessão anónima
   */
  function getOrCreateAnonymousId() {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (id) return id;
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem(ANON_ID_KEY, id);
    return id;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getSupportAvatarUrl() {
    return `${window.location.origin.replace(/\/+$/, '')}/assets/images/fotodefault.png`;
  }

  function parseValidDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function getMessageSenderType(msg) {
    return msg.senderType || msg.sendertype || 'user';
  }

  function getMessageCreatedAt(msg) {
    return msg.createdAt || msg.createdat || null;
  }

  function getMessageUserName(msg) {
    return msg.userName || msg.username || msg.user_name || '';
  }

  const PROFILE_IMAGE_FILES = [
    '0.png',
    'contacts_photoid_animal_list_10.png',
    'contacts_photoid_animal_list_2.png',
    'contacts_photoid_animal_list_3.png',
    'contacts_photoid_animal_list_4.png',
    'contacts_photoid_animal_list_5.png',
    'contacts_photoid_animal_list_6.png',
    'contacts_photoid_animal_list_7.png',
    'contacts_photoid_animal_list_8.png',
    'contacts_photoid_animal_list_9.png',
    'contacts_photoid_lifestyle_list_1.png',
    'contacts_photoid_lifestyle_list_10.png',
    'contacts_photoid_lifestyle_list_2.png',
    'contacts_photoid_lifestyle_list_3.png',
    'contacts_photoid_lifestyle_list_4.png',
    'contacts_photoid_lifestyle_list_5.png',
    'contacts_photoid_lifestyle_list_6.png',
    'contacts_photoid_lifestyle_list_7.png',
    'contacts_photoid_lifestyle_list_8.png',
    'contacts_photoid_lifestyle_list_9.png',
    'contacts_photoid_nature_list_5.png',
    'contacts_photoid_nature_list_6.png',
    'contacts_photoid_nature_list_7.png',
    'contacts_photoid_nature_list_8.png',
    'contacts_photoid_nature_list_9.png',
    'contacts_photoid_object_list_1.png',
    'contacts_photoid_object_list_10.png',
    'contacts_photoid_object_list_2.png',
    'contacts_photoid_object_list_3.png',
    'contacts_photoid_object_list_4.png',
    'contacts_photoid_object_list_5.png',
    'contacts_photoid_object_list_6.png',
    'contacts_photoid_object_list_7.png',
    'contacts_photoid_object_list_9.png',
    'contacts_photoid_person_list_1.png',
    'contacts_photoid_person_list_10.png',
    'contacts_photoid_person_list_2.png',
    'contacts_photoid_person_list_3.png',
    'contacts_photoid_person_list_4.png',
    'contacts_photoid_person_list_5.png',
    'contacts_photoid_person_list_6.png',
    'contacts_photoid_person_list_7.png',
    'contacts_photoid_person_list_8.png',
    'contacts_photoid_person_list_9.png'
  ];

  function hashString(value) {
    const input = String(value || '');
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function getUserAvatarKey(msg) {
    return msg.referenciaId || msg.referenciaID || getMessageUserName(msg) || getToken() || getOrCreateAnonymousId();
  }

  function getCurrentUserAvatarUrl(msg) {
    const key = getUserAvatarKey(msg);
    const index = PROFILE_IMAGE_FILES.length > 0 ? hashString(key) % PROFILE_IMAGE_FILES.length : 0;
    const selectedFile = PROFILE_IMAGE_FILES[index] || '0.png';
    return `${window.location.origin.replace(/\/+$/, '')}/assets/images/Imagens-profile/${selectedFile}`;
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
    // Detectar URL base automaticamente
    return window.location.origin;
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
    const isAnonymous = !token;
    // Sempre ter anonymousId disponível: quando o token está expirado o backend não tem req.user
    // e exige anonymousId; enviando sempre, o suporte funciona logado ou anónimo.
    const anonymousId = getOrCreateAnonymousId();
    let apiBase = getAPIBase().replace(/\/+$/, '');
    
    let urlPath = path.startsWith('http') ? path : (apiBase + (path.startsWith('/') ? path : '/' + path));
    if (anonymousId) {
      const sep = urlPath.includes('?') ? '&' : '?';
      urlPath = urlPath + sep + 'anonymousId=' + encodeURIComponent(anonymousId);
    }
    
    let body = opts.body;
    if (anonymousId && (opts.method === 'POST' || opts.method === 'PUT')) {
      try {
        const parsed = typeof body === 'string' ? JSON.parse(body) : (body || {});
        parsed.anonymousId = anonymousId;
        body = JSON.stringify(parsed);
      } catch (e) {
        body = JSON.stringify({ anonymousId: anonymousId });
      }
    }
    
    console.log(' [Support Widget] Requisição:', opts.method || 'GET', urlPath);
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(opts.headers || {})
    };

    try {
      const resp = await fetch(urlPath, { ...opts, headers, body: body !== undefined ? body : opts.body });
      const responseText = await resp.text();

      if (!resp.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { error: responseText || `HTTP ${resp.status}` };
        }

        // 401: tentar renovar com refresh token e repetir o pedido uma vez
        const refreshToken = localStorage.getItem('PROMOPING_REFRESH_TOKEN');
        const jáTentouRenovar = opts._retriedAfterRefresh === true;

        if (resp.status === 401 && !jáTentouRenovar) {
          if (refreshToken) {
            try {
              const refreshUrl = apiBase + (apiBase.endsWith('/') ? '' : '/') + 'api/auth/refresh';
              const refreshRes = await fetch(refreshUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
              });
              const refreshData = refreshRes.ok ? await refreshRes.json().catch(() => ({})) : {};
              if (refreshData.token) {
                localStorage.setItem('PROMOPING_TOKEN', refreshData.token);
                if (refreshData.refreshToken) {
                  localStorage.setItem('PROMOPING_REFRESH_TOKEN', refreshData.refreshToken);
                }
                return fetchJSON(path, { ...opts, _retriedAfterRefresh: true });
              }
              console.warn(' [Support Widget] Refresh não devolveu token:', refreshRes.status);
            } catch (refreshErr) {
              console.warn(' [Support Widget] Falha ao renovar token:', refreshErr);
            }
          } else if (!isAnonymous) {
            console.warn(' [Support Widget] Token expirado e sem refresh token. Faça login no painel admin nesta mesma origem para renovar a sessão.');
          }
        }

        throw new Error(errorData.error || `HTTP ${resp.status}: ${resp.statusText}`);
      }

      return JSON.parse(responseText);
    } catch (error) {
      console.error(' [Support Widget] Erro na requisição:', error.message);
      throw error;
    }
  }


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
   * @param {boolean} hasUnread - Se há mensagens não lidas (replies do suporte)
   * @returns {string} HTML da thread renderizada
   */
  function renderThread(thread, isActive = false, hasUnread = false) {
    const createdAt = parseValidDate(getMessageCreatedAt(thread));
    const date = createdAt
      ? createdAt.toLocaleDateString('en-US', {
          day: '2-digit',
          month: '2-digit'
        })
      : 'No date';
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
              ${replyCount > 0 ? `<span style="background:#f17603;color:#fff;padding:2px 6px;border-radius:10px;font-size:10px;">${replyCount} replies</span>` : ''}
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
    const senderType = getMessageSenderType(msg);
    const isUser = senderType === 'user';
    const createdAt = parseValidDate(getMessageCreatedAt(msg));
    const time = createdAt
      ? createdAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';
    const date = createdAt
      ? createdAt.toLocaleDateString('en-US', {
          day: '2-digit',
          month: '2-digit'
        })
      : '';
    const supportAvatarUrl = getSupportAvatarUrl();
    const userDisplayName = getMessageUserName(msg).trim();
    const senderLabel = isUser ? (userDisplayName || 'You') : 'Support';
    const dateLabel = date && time ? `${date} at ${time}` : '';
    
    const html = `
      <div style="display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'};margin-bottom:20px;align-items:flex-end;gap:12px;">
        ${!isUser ? `
          <img src="${supportAvatarUrl}" alt="support"
               onerror="this.onerror=null;this.src='${supportAvatarUrl}'"
               style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.15);border:2px solid white;">
        ` : ''}
        <div style="max-width:75%;display:flex;flex-direction:column;align-items:${isUser ? 'flex-end' : 'flex-start'};gap:4px;">
          <div style="display:flex;align-items:center;gap:8px;justify-content:${isUser ? 'flex-end' : 'flex-start'};">
            <span style="font-size:11px;font-weight:600;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px;">${isUser ? 'You' : 'Support'}</span>
            <span style="font-size:10px;color:#adb5bd;">${date} at ${time}</span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:8px;justify-content:${isUser ? 'flex-end' : 'flex-start'};">
            <div style="padding:12px 16px;border-radius:18px;background:${isUser ? 'linear-gradient(135deg, #f17603 0%, #ff9800 100%)' : '#ffffff'};color:${isUser ? '#fff' : '#344767'};word-wrap:break-word;box-shadow:0 2px 12px rgba(0,0,0,0.1);${isUser ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;'};max-width:100%;border:${isUser ? 'none' : '1px solid #e9ecef'};">
              <div style="font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(msg.message)}</div>
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
    return html
      .replace(`>${isUser ? 'You' : 'Support'}</span>`, `>${escapeHtml(senderLabel)}</span>`)
      .replace(
        /<span style="font-size:10px;color:#adb5bd;">.*?<\/span>/,
        dateLabel ? `<span style="font-size:10px;color:#adb5bd;">${dateLabel}</span>` : ''
      );
  }

  function renderSupportMessage(msg) {
    const senderType = getMessageSenderType(msg);
    const isUser = senderType === 'user';
    const isAi = senderType === 'ai';
    const createdAt = parseValidDate(getMessageCreatedAt(msg));
    const time = createdAt
      ? createdAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';
    const date = createdAt
      ? createdAt.toLocaleDateString('en-US', {
          day: '2-digit',
          month: '2-digit'
        })
      : '';
    const supportAvatarUrl = getSupportAvatarUrl();
    const userAvatarUrl = getCurrentUserAvatarUrl(msg);
    const userDisplayName = getMessageUserName(msg).trim();
    const senderLabel = isUser ? (userDisplayName || 'You') : (isAi ? 'PromoPing AI' : 'Support');
    const dateLabel = date && time ? `${date} at ${time}` : '';
    const bubbleBackground = isUser
      ? 'linear-gradient(135deg, #f17603 0%, #ff9800 100%)'
      : (isAi ? 'linear-gradient(135deg, #e8fff5 0%, #d4f7e7 100%)' : '#ffffff');
    const bubbleColor = isUser ? '#fff' : (isAi ? '#174b33' : '#344767');
    const bubbleBorder = isUser ? 'none' : (isAi ? '1px solid #b7ebcf' : '1px solid #e9ecef');

    return `
      <div style="display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'};margin-bottom:20px;align-items:flex-end;gap:12px;">
        ${!isUser ? `
          <img src="${supportAvatarUrl}" alt="support"
               onerror="this.onerror=null;this.src='${supportAvatarUrl}'"
               style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.15);border:2px solid white;">
        ` : ''}
        <div style="max-width:75%;display:flex;flex-direction:column;align-items:${isUser ? 'flex-end' : 'flex-start'};gap:4px;">
          <div style="display:flex;align-items:center;gap:8px;justify-content:${isUser ? 'flex-end' : 'flex-start'};">
            <span style="font-size:11px;font-weight:600;color:#6c757d;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(senderLabel)}</span>
            ${dateLabel ? `<span style="font-size:10px;color:#adb5bd;">${dateLabel}</span>` : ''}
          </div>
          <div style="display:flex;align-items:flex-end;gap:8px;justify-content:${isUser ? 'flex-end' : 'flex-start'};">
            <div style="padding:12px 16px;border-radius:18px;background:${bubbleBackground};color:${bubbleColor};word-wrap:break-word;box-shadow:0 2px 12px rgba(0,0,0,0.1);${isUser ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;'};max-width:100%;border:${bubbleBorder};">
              <div style="font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(msg.message)}</div>
            </div>
            ${isUser ? `
              <img src="${userAvatarUrl}" alt="user"
                   onerror="this.onerror=null;this.src='${supportAvatarUrl}'"
                   style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 2px 8px rgba(241,118,3,0.25);border:2px solid rgba(255,255,255,0.9);">
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
      container.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">No conversation selected.</div>';
      return;
    }
    
    try {
      const messages = await loadConversation(threadId);
      container.innerHTML = messages.length > 0 
        ? messages.map(renderSupportMessage).join('')
        : '<div style="text-align:center;color:#999;padding:20px;">No messages in this conversation.</div>';
      container.scrollTop = container.scrollHeight;
    } catch (error) {
      console.error(' [Support Widget] Error refreshing messages:', error);
      container.innerHTML = '<div style="text-align:center;color:#d32f2f;padding:20px;">Error loading messages.</div>';
    }
  }


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
    let threadEventSource = null;
    let subscribedThreadId = null;
    let refreshTimeoutId = null;
    // Wizard automático: recolher nome, email e problema antes de abrir ticket
    let wizardStep = null; // 0 = nome, 1 = email, 2 = mensagem, null = fora do wizard
    let wizardUserName = '';
    let wizardUserEmail = '';

    // Criar botão flutuante
    const btnWrap = createFloatingButton();
    document.body.appendChild(btnWrap);
    const btn = document.getElementById('pp-support-btn');

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

    function closeThreadStream() {
      if (threadEventSource) {
        threadEventSource.close();
        threadEventSource = null;
      }
      subscribedThreadId = null;
      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId);
        refreshTimeoutId = null;
      }
    }

    function scheduleRealtimeRefresh() {
      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId);
      }
      refreshTimeoutId = setTimeout(async () => {
        refreshTimeoutId = null;
        if (!currentThreadId || modal.style.display === 'none') return;
        await refreshMessages(currentThreadId, messagesContainer);
        await loadAllThreads(currentPage);
      }, 120);
    }

    function ensureThreadStream(threadId) {
      if (!threadId) {
        closeThreadStream();
        return;
      }
      if (subscribedThreadId === threadId && threadEventSource) {
        return;
      }

      closeThreadStream();
      const apiBase = getAPIBase().replace(/\/+$/, '');
      const params = new URLSearchParams({ threadId: String(threadId) });
      const token = getToken();
      const anonymousId = getOrCreateAnonymousId();
      if (token) params.set('token', token);
      if (anonymousId) params.set('anonymousId', anonymousId);

      threadEventSource = new EventSource(`${apiBase}/api/support/stream?${params.toString()}`);
      subscribedThreadId = threadId;

      threadEventSource.addEventListener('support-message', (event) => {
        try {
          const payload = JSON.parse(event.data || '{}');
          if (Number(payload.threadId) === Number(currentThreadId)) {
            scheduleRealtimeRefresh();
          }
        } catch (error) {
          console.error(' [Support Widget] Invalid SSE payload:', error);
        }
      });

      threadEventSource.onerror = () => {
        closeThreadStream();
        setTimeout(() => {
          if (modal.style.display !== 'none' && currentThreadId === threadId) {
            ensureThreadStream(threadId);
          }
        }, 2000);
      };
    }
    
    // Estado das threads e paginação
    let allThreads = [];
    let currentPage = 1;
    let paginationInfo = null;
    const threadsPerPage = 10;


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
     * Mostra o passo atual do wizard (nome, email, mensagem)
     */
    function renderWizardStep() {
      const prompts = [
        'Hi! To help you, tell me your name (or a nickname).',
        'What is your email?',
        'Describe the issue or your message.'
      ];
      const placeholders = ['Your name', 'Your email', 'Describe the issue...'];
      textEl.placeholder = placeholders[wizardStep];
      messagesContainer.innerHTML = `
        <div style="padding:20px;color:#333;">
          <p style="margin:0 0 12px 0;font-size:15px;line-height:1.4;">${prompts[wizardStep]}</p>
          ${wizardStep === 0 && wizardUserName ? '<p style="margin:8px 0 0 0;color:#666;font-size:13px;">Name: ' + escapeHtml(wizardUserName) + '</p>' : ''}
          ${wizardStep === 1 && wizardUserEmail ? '<p style="margin:8px 0 0 0;color:#666;font-size:13px;">Email: ' + escapeHtml(wizardUserEmail) + '</p>' : ''}
        </div>`;
    }

    /**
     * Inicia uma nova conversa (nova thread) — abre o wizard automático
     */
    function startNewConversation() {
      currentThreadId = null;
      closeThreadStream();
      wizardStep = 0;
      wizardUserName = '';
      wizardUserEmail = '';
      textEl.value = '';
      renderWizardStep();
      textEl.focus();
      updateThreadInfo();
      console.log(' [Support Widget] Nova conversa — wizard iniciado');
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
        threadsList.innerHTML = '<div style="text-align:center;color:#d32f2f;padding:20px;font-size:12px;">Error loading conversations.</div>';
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
      pageInfo.textContent = `Page ${paginationInfo.page} of ${paginationInfo.totalPages}`;
      
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
     * Detecta threads com replies do suporte (não lidas)
     */
    function renderThreadsList() {
      if (allThreads.length === 0) {
        threadsList.innerHTML = '<div style="text-align:center;color:#999;padding:20px;font-size:12px;">No conversations yet.</div>';
        return;
      }

      threadsList.innerHTML = allThreads.map(thread => {
        const isActive = thread.id === currentThreadId;
        // Thread tem replies não lidas se:
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
      wizardStep = null;
      textEl.placeholder = 'Type your message...';
      await refreshMessages(threadId, messagesContainer);
      ensureThreadStream(threadId);
      updateThreadInfo();
      renderThreadsList();
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
          const latestThread = allThreads[0];
          currentThreadId = latestThread.id;
          wizardStep = null;
          textEl.placeholder = 'Type your message...';
          await refreshMessages(currentThreadId, messagesContainer);
          ensureThreadStream(currentThreadId);
          updateThreadInfo();
        } else {
          currentThreadId = null;
          closeThreadStream();
          wizardStep = 0;
          wizardUserName = '';
          wizardUserEmail = '';
          renderWizardStep();
          updateThreadInfo();
        }
      } catch (error) {
        console.error(' [Support Widget] Erro ao carregar thread:', error);
        messagesContainer.innerHTML = '<div style="text-align:center;color:#d32f2f;padding:20px;">Error loading conversations.</div>';
        currentThreadId = null;
        updateThreadInfo();
      }
    }

    /**
     * Envia uma mensagem
     * Se estiver no wizard (nome, email, problema), avança passos ou abre o ticket.
     * Senão, cria nova thread ou responde à thread existente.
     */
    async function sendMessage() {
      const message = (textEl.value || '').trim();
      if (!message) {
        fb.textContent = 'Write something to continue.';
        fb.style.color = '#a66';
        return;
      }

      try {
        fb.textContent = '...';
        fb.style.color = '#666';

        // Wizard automático: recolher nome, email e depois abrir ticket
        if (wizardStep === 0) {
          wizardUserName = message;
          wizardStep = 1;
          textEl.value = '';
          renderWizardStep();
          fb.textContent = '';
          return;
        }
        if (wizardStep === 1) {
          wizardUserEmail = message;
          wizardStep = 2;
          textEl.value = '';
          renderWizardStep();
          fb.textContent = '';
          return;
        }
        if (wizardStep === 2) {
          fb.textContent = 'Opening ticket...';
          const result = await fetchJSON('/api/support/messages', {
            method: 'POST',
            body: JSON.stringify({
              message,
              userName: wizardUserName,
              userEmail: wizardUserEmail,
              context: window.location.pathname
            })
          });
          currentThreadId = result.threadId || result.id;
          wizardStep = null;
          wizardUserName = '';
          wizardUserEmail = '';
          textEl.value = '';
          textEl.placeholder = 'Type your message...';
          ensureThreadStream(currentThreadId);
          fb.textContent = result.automation?.status === 'ai_answered'
            ? 'Sent! PromoPing AI replied below.'
            : 'Sent! The team can reply here.';
          fb.style.color = '#2e7d32';
          setTimeout(() => { fb.textContent = ''; }, 2500);
          await refreshMessages(currentThreadId, messagesContainer);
          await loadAllThreads();
          updateThreadInfo();
          return;
        }

        // Fluxo normal: thread existente ou nova conversa sem wizard
        let result;
        if (currentThreadId) {
          const threadMessages = await loadConversation(currentThreadId);
          const lastMsg = threadMessages.length > 0
            ? threadMessages[threadMessages.length - 1]
            : { id: currentThreadId };
          result = await fetchJSON(`/api/support/messages/${lastMsg.id}/reply`, {
            method: 'POST',
            body: JSON.stringify({ message, senderType: 'user', context: window.location.pathname })
          });
        } else {
          result = await fetchJSON('/api/support/messages', {
            method: 'POST',
            body: JSON.stringify({ message, context: window.location.pathname })
          });
          currentThreadId = result.threadId || result.id;
          ensureThreadStream(currentThreadId);
          updateThreadInfo();
        }

        textEl.value = '';
        fb.textContent = result.automation?.status === 'ai_answered'
          ? 'Sent! PromoPing AI replied below.'
          : 'Sent successfully!';
        fb.style.color = '#2e7d32';
        setTimeout(() => { fb.textContent = ''; }, 2000);
        await refreshMessages(currentThreadId, messagesContainer);
        await loadAllThreads();
      } catch (error) {
        console.error(' [Support Widget] Erro ao enviar mensagem:', error);
        fb.textContent = `Failed to send: ${error.message}`;
        fb.style.color = '#c62828';
      }
    }

    // Abrir/fechar widget (funciona logado ou anónimo)
    btn.addEventListener('click', async () => {
      const isOpen = modal.style.display !== 'none';
      modal.style.display = isOpen ? 'none' : 'flex';
      
      if (!isOpen) {
        await loadLatestThread();
      } else {
        closeThreadStream();
      }
    });

    // Fechar modal
    modal.querySelector('#pp-support-close').addEventListener('click', () => {
      modal.style.display = 'none';
      closeThreadStream();
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

    // Send mensagem
    modal.querySelector('#pp-support-send').addEventListener('click', sendMessage);

    // Send com Enter (Ctrl+Enter para nova linha)
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }


  /**
   * Cria o botão flutuante do widget (wrapper com badge "+1" e botão "?")
   * @returns {HTMLDivElement} Wrapper com badge e botão
   */
  function createFloatingButton() {
    const wrap = document.createElement('div');
    wrap.className = 'pp-support-btn-wrap';
    Object.assign(wrap.style, {
      position: 'fixed',
      right: '24px',
      bottom: '24px',
      zIndex: '1080',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px'
    });

    const badge = document.createElement('span');
    badge.className = 'pp-support-badge';
    badge.textContent = '+1';
    badge.setAttribute('aria-hidden', 'true');
    Object.assign(badge.style, {
      display: 'inline-block',
      fontSize: '10px',
      fontWeight: '700',
      color: '#fff',
      background: 'linear-gradient(180deg, #e53935 0%, #c62828 100%)',
      padding: '3px 7px',
      borderRadius: '10px',
      lineHeight: 1.2,
      letterSpacing: '0.02em',
      boxShadow: '0 2px 6px rgba(198, 40, 40, 0.4)',
      border: '1px solid rgba(255,255,255,0.25)',
      marginTop: '4px'
    });

    const btn = document.createElement('button');
    btn.id = 'pp-support-btn';
    btn.className = 'pp-support-btn';
    btn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M4 13v-1a8 8 0 0 1 16 0v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M4 14a2 2 0 0 1 2-2h1a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2v-3z" fill="currentColor"/>
        <path d="M20 14a2 2 0 0 0-2-2h-1a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1a2 2 0 0 0 2-2v-3z" fill="currentColor"/>
        <path d="M20 17v1a3 3 0 0 1-3 3h-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <circle cx="13" cy="21" r="1.2" fill="currentColor"/>
      </svg>`;
    btn.setAttribute('aria-label', 'Open support');
    btn.setAttribute('title', 'Support');
    Object.assign(btn.style, {
      width: '48px',
      height: '48px',
      padding: '0',
      border: '2px solid rgba(255,255,255,0.35)',
      borderRadius: '50%',
      background: 'linear-gradient(180deg, #ff8c42 0%, #f17603 50%, #e06b00 100%)',
      color: '#fff',
      cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(241, 118, 3, 0.4), 0 2px 6px rgba(0,0,0,0.15)',
      fontFamily: 'inherit',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
    });
    btn.addEventListener('mouseenter', function () {
      btn.style.transform = 'scale(1.06)';
      btn.style.boxShadow = '0 6px 20px rgba(241, 118, 3, 0.5), 0 2px 8px rgba(0,0,0,0.2)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 14px rgba(241, 118, 3, 0.4), 0 2px 6px rgba(0,0,0,0.15)';
    });

    wrap.appendChild(badge);
    wrap.appendChild(btn);
    return wrap;
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
        <strong style="font-size:16px;">Support Contact</strong>
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="pp-support-toggle-threads" style="border:1px solid #ddd;background:#fff;color:#666;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;transition:all 0.2s;" title="Show/Hide conversations">Conversations</button>
          <button id="pp-support-new" style="border:1px solid #f17603;background:#fff;color:#f17603;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;font-weight:500;transition:all 0.2s;">New Conversation</button>
          <button id="pp-support-close" style="border:none;background:none;color:#777;font-size:20px;cursor:pointer;padding:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;transition:color 0.2s;">✕</button>
        </div>
      </div>
      <div style="display:flex;flex:1;overflow:hidden;">
        <!-- Sidebar de Threads -->
        <div id="pp-support-threads-sidebar" style="width:250px;border-right:1px solid #eee;background:#fafafa;overflow-y:auto;display:none;flex-shrink:0;flex-direction:column;">
          <div style="padding:12px;border-bottom:1px solid #eee;background:#fff;flex-shrink:0;">
            <div style="font-size:12px;font-weight:600;color:#666;margin-bottom:8px;">YOUR CONVERSATIONS</div>
            <div id="pp-support-threads-list" style="max-height:400px;overflow-y:auto;">
              <div style="text-align:center;color:#999;padding:20px;font-size:12px;">Loading conversations...</div>
            </div>
            <!-- Controles de Paginação -->
            <div id="pp-support-pagination" style="margin-top:8px;padding-top:8px;border-top:1px solid #eee;display:none;gap:4px;justify-content:space-between;align-items:center;">
              <button id="pp-support-prev-page" style="padding:4px 8px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer;font-size:11px;disabled:true;">« Previous</button>
              <span id="pp-support-page-info" style="font-size:11px;color:#666;">Page 1</span>
              <button id="pp-support-next-page" style="padding:4px 8px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer;font-size:11px;">Next »</button>
            </div>
          </div>
        </div>
        <!-- Área de Mensagens -->
        <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
          <div id="pp-support-messages" style="flex:1;overflow-y:auto;padding:16px;background:#fafafa;">
            <div style="text-align:center;color:#999;padding:20px;">Loading conversations...</div>
          </div>
          <div style="padding:12px 16px;border-top:1px solid #eee;background:#fff;flex-shrink:0;">
            <div id="pp-support-thread-info" style="margin-bottom:8px;padding:8px;background:#fff3e0;border-radius:6px;font-size:12px;color:#e65100;display:none;">
              <strong>Replying to conversation:</strong> <span id="pp-support-thread-preview"></span>
            </div>
            <textarea id="pp-support-text" rows="2" placeholder="Type your message..." style="width:90%;border:1px solid #ddd;border-radius:8px;padding:10px;resize:none;font-size:14px;margin-bottom:8px;font-family:inherit;"></textarea>
            <button id="pp-support-send" style="width:100%;background:#f17603;color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:14px;font-weight:500;transition:background 0.2s;">Send</button>
            <div id="pp-support-feedback" style="margin-top:6px;font-size:12px;color:#666;text-align:center;"></div>
          </div>
        </div>
      </div>
    `;

    return modal;
  }


  window.initSupportWidgetFront = initSupportWidgetFront;
})();
