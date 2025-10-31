// Suporte PromoPing - Widget flutuante (frontend)
(function () {
  function getToken() {
    return localStorage.getItem('token') || localStorage.getItem('PROMOPING_TOKEN');
  }

  function getAPIBase() {
    // Tenta encontrar a base da API de diferentes formas
    if (window.API_BASE) return window.API_BASE;
    if (window.PromoPingAdmin && window.PromoPingAdmin.API_BASE) return window.PromoPingAdmin.API_BASE;
    // Fallback para localhost:3000
    return 'http://localhost:3000';
  }

  async function fetchJSON(path, opts) {
    const token = getToken();
    let apiBase = getAPIBase();
    // Garante que apiBase termina sem barra
    apiBase = apiBase.replace(/\/+$/, '');
    // Constrói o caminho completo
    let fullPath;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      fullPath = path;
    } else {
      // Remove barra inicial do path se existir e adiciona
      const cleanPath = path.startsWith('/') ? path : '/' + path;
      fullPath = apiBase + cleanPath;
    }
    console.log('[Support Widget] Enviando para:', fullPath);
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: `Bearer ${token}` } : {},
      (opts && opts.headers) || {}
    );
    const resp = await fetch(fullPath, Object.assign({}, opts, { headers }));
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  }

  async function loadConversation(threadId) {
    try {
      const res = await fetchJSON(`/api/support/messages?threadId=${threadId}`);
      return res.items || [];
    } catch (e) {
      console.error('Erro ao carregar conversa:', e);
      return [];
    }
  }

  function renderMessage(msg) {
    const isUser = msg.senderType === 'user';
    const time = new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(msg.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
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

  async function refreshMessages(threadId, container) {
    if (!threadId) return;
    const messages = await loadConversation(threadId);
    container.innerHTML = messages.map(renderMessage).join('');
    container.scrollTop = container.scrollHeight;
  }

  function initSupportWidgetFront() {
    if (document.getElementById('pp-support-btn')) return;

    let currentThreadId = null;

    const btn = document.createElement('button');
    btn.id = 'pp-support-btn';
    btn.className = 'pp-support-btn';
    Object.assign(btn.style, {
      position: 'fixed', right: '20px', bottom: '20px', zIndex: '1080',
      padding: '10px 14px', border: 'none', borderRadius: '999px',
      background: '#f17603', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,.15)'
    });
    btn.textContent = 'Suporte';
    document.body.appendChild(btn);

    const modal = document.createElement('div');
    modal.id = 'pp-support-modal';
    Object.assign(modal.style, {
      position: 'fixed', right: '20px', bottom: '70px', width: '500px', height: '600px', maxWidth: '90vw', maxHeight: '90vh',
      background: '#fff', borderRadius: '12px', boxShadow: '0 12px 24px rgba(0,0,0,.25)',
      display: 'none', zIndex: '1080', overflow: 'hidden', flexDirection: 'column'
    });
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:#fff;border-bottom:1px solid #eee;flex-shrink:0;">
        <strong style="font-size:16px;">Contato de Suporte</strong>
        <button id="pp-support-close" style="border:none;background:none;color:#777;font-size:20px;cursor:pointer;padding:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
      <div id="pp-support-messages" style="flex:1;overflow-y:auto;padding:16px;background:#fafafa;">
        <div style="text-align:center;color:#999;padding:20px;">Carregando conversas...</div>
      </div>
      <div style="padding:12px 16px;border-top:1px solid #eee;background:#fff;flex-shrink:0;">
        <textarea id="pp-support-text" rows="2" placeholder="Digite sua mensagem..." style="width:100%;border:1px solid #ddd;border-radius:8px;padding:10px;resize:none;font-size:14px;margin-bottom:8px;"></textarea>
        <button id="pp-support-send" style="width:100%;background:#f17603;color:#fff;border:none;border-radius:8px;padding:10px;cursor:pointer;font-size:14px;font-weight:500;">Enviar</button>
        <div id="pp-support-feedback" style="margin-top:6px;font-size:12px;color:#666;text-align:center;"></div>
      </div>`;
    document.body.appendChild(modal);

    const messagesContainer = modal.querySelector('#pp-support-messages');
    const textEl = modal.querySelector('#pp-support-text');
    const fb = modal.querySelector('#pp-support-feedback');

    async function loadLatestThread() {
      try {
        const res = await fetchJSON('/api/support/messages?limit=1');
        if (res.items && res.items.length > 0) {
          currentThreadId = res.items[0].id;
          await refreshMessages(currentThreadId, messagesContainer);
        } else {
          messagesContainer.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">Nenhuma conversa ainda. Envie sua primeira mensagem!</div>';
        }
      } catch (e) {
        console.error('Erro ao carregar thread:', e);
        messagesContainer.innerHTML = '<div style="text-align:center;color:#d32f2f;padding:20px;">Erro ao carregar conversas.</div>';
      }
    }

    btn.addEventListener('click', async () => {
      const token = getToken();
      if (!token) { window.location.href = '/PromoPing/frontend/pages/inc/Login.html'; return; }
      const isOpen = modal.style.display !== 'none';
      modal.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) {
        await loadLatestThread();
      }
    });

    modal.querySelector('#pp-support-close').addEventListener('click', () => { 
      modal.style.display = 'none';
    });

    modal.querySelector('#pp-support-send').addEventListener('click', async () => {
      const token = getToken();
      if (!token) { window.location.href = '/PromoPing/frontend/pages/inc/Login.html'; return; }
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
          // Carrega a thread completa para pegar a última mensagem
          const threadMessages = await loadConversation(currentThreadId);
          // Pega a última mensagem da thread ou usa o threadId como fallback
          const lastMsg = threadMessages.length > 0 
            ? threadMessages[threadMessages.length - 1] 
            : { id: currentThreadId };
          result = await fetchJSON(`/api/support/messages/${lastMsg.id}/reply`, {
            method: 'POST',
            body: JSON.stringify({ message, senderType: 'user' })
          });
        } else {
          // Nova mensagem
          result = await fetchJSON('/api/support/messages', { 
            method: 'POST', 
            body: JSON.stringify({ message }) 
          });
          currentThreadId = result.threadId || result.id;
        }
        
        textEl.value = '';
        fb.textContent = 'Enviado com sucesso!'; 
        fb.style.color = '#2e7d32';
        setTimeout(() => { fb.textContent = ''; }, 2000);
        
        await refreshMessages(currentThreadId, messagesContainer);
      } catch (e) {
        console.error('Erro ao enviar:', e);
        fb.textContent = 'Falha ao enviar. Tente novamente.'; 
        fb.style.color = '#c62828';
      }
    });

    // Permitir enviar com Enter (Ctrl+Enter para nova linha)
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        modal.querySelector('#pp-support-send').click();
      }
    });
  }

  // Expor global
  window.initSupportWidgetFront = initSupportWidgetFront;
})();


