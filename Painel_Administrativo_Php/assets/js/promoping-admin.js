(function (w) {
  async function detectApiBase() {
    const saved = localStorage.getItem('PROMOPING_API');
    if (saved) return saved.replace(/\/+$/,'');
    const candidates = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      window.location.origin
    ];
    for (const base of candidates) {
      try {
        const r = await fetch(`${base.replace(/\/+$/,'')}/api/health`, { method:'GET' });
        if (r.ok) {
          localStorage.setItem('PROMOPING_API', base);
          return base.replace(/\/+$/,'');
        }
      } catch (_) {}
    }
    return 'http://localhost:3000';
  }

  let API_BASE_GLOBAL = null;
  const initApiBasePromise = detectApiBase().then(b => { API_BASE_GLOBAL = b; return b; });

  function getApiBase() {
    return API_BASE_GLOBAL || (localStorage.getItem('PROMOPING_API') || 'http://localhost:3000').replace(/\/+$/,'');
  }
  const TOKEN = localStorage.getItem('PROMOPING_TOKEN') || null;

  async function fetchJSON(path, opts = {}) {
    if (!API_BASE_GLOBAL) await initApiBasePromise;
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
      opts.headers || {}
    );
    const resp = await fetch(`${getApiBase()}${path}`, Object.assign({}, opts, { headers }));
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  }

  async function initDashboard() {
    if (!API_BASE_GLOBAL) await initApiBasePromise;
    try {
      const data = await fetchJSON('/api/status');
      const m = data?.metricas || {};
      const $ = (id) => document.getElementById(id);
      if ($('users-active')) $('users-active').textContent = (m.UtilizadoresAtivos ?? 0).toLocaleString();
      if ($('products-count')) $('products-count').textContent = (m.ProdutosMonitorizados ?? 0).toLocaleString();
      if ($('notifications-today')) $('notifications-today').textContent = (m.NotificacoesEnviadas ?? 0).toLocaleString();
      if ($('uptime')) $('uptime').textContent = (m.UptimeGeral ?? 0).toFixed(2);

      const daily = await fetchJSON('/api/charts/daily?days=7').catch(()=>null);
      if (daily && w.Chart) {
        const ctx = document.getElementById('chart-bars')?.getContext('2d');
        if (ctx) {
          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: daily.labels || ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'],
              datasets: [{
                label: 'Notificações',
                backgroundColor: '#fff',
                data: (daily.series && daily.series.notificacoes) || [0,0,0,0,0,0,0],
                maxBarThickness: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } }
            }
          });
        }
      }

      const overview = await fetchJSON('/api/charts/overview?months=9').catch(()=>null);
      if (overview && w.Chart) {
        const ctx2 = document.getElementById('chart-line')?.getContext('2d');
        if (ctx2) {
          new Chart(ctx2, {
            type: 'line',
            data: {
              labels: overview.labels || [],
              datasets: [
                {
                  label: 'Utilizadores novos',
                  borderColor: '#cb0c9f',
                  backgroundColor: 'rgba(203,12,159,0.2)',
                  fill: true,
                  data: (overview.series && overview.series.utilizadoresNovos) || []
                },
                {
                  label: 'Produtos criados',
                  borderColor: '#3A416F',
                  backgroundColor: 'rgba(20,23,39,0.2)',
                  fill: true,
                  data: (overview.series && overview.series.produtosCriados) || []
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } }
            }
          });
        }
      }
    } catch {
      const $ = (id) => document.getElementById(id);
      if ($('users-active')) $('users-active').textContent = '0';
      if ($('products-count')) $('products-count').textContent = '0';
      if ($('notifications-today')) $('notifications-today').textContent = '0';
      if ($('uptime')) $('uptime').textContent = '99.9';
    }
  }

  function requireAuth(redirectTo = '../pages/sign-in.html') {
    if (!TOKEN) {
      const back = encodeURIComponent(location.pathname + location.search);
      location.href = `${redirectTo}?back=${back}`;
      return false;
    }
    return true;
  }

  async function initTables() {
    if (!API_BASE_GLOBAL) await initApiBasePromise;
    const tbody = document.getElementById('incidentes-body');
    if (!tbody) return;
    try {
      const res = await fetchJSON('/api/incidentes');
      const list = (res && res.incidentes) || [];
      tbody.innerHTML = list.map(inc => `
        <tr>
          <td>${inc.Id}</td>
          <td>${inc.Titulo || '—'}</td>
          <td class="text-sm">${inc.Status}</td>
          <td class="text-sm">${new Date(inc.DataInicio).toLocaleString()}</td>
          <td class="text-end"><a href="javascript:;" class="text-secondary text-xs">Ver</a></td>
        </tr>
      `).join('') || `<tr><td colspan="5" class="text-center text-secondary text-sm">Sem dados</td></tr>`;
    } catch {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger text-sm">Falha ao carregar</td></tr>`;
    }
  }

  async function initProfile() {
    if (!API_BASE_GLOBAL) await initApiBasePromise;
    if (!requireAuth()) return;
    try {
      const res = await fetchJSON('/api/user/me');
      const user = res?.user || {};
      const map = {
        fullName: `${user.nome || user.name || '—'}`,
        email: `${user.email || '—'}`,
        mobile: `${user.telefone || user.phone || '—'}`,
        location: `${user.cidade || user.location || '—'}`
      };
      Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      });
    } catch {
      localStorage.removeItem('PROMOPING_TOKEN');
      requireAuth();
    }
  }

  async function initAuthors() {
    const tbody = document.getElementById('authors-body');
    if (!tbody) return;
    try {
      const res = await fetchJSON('/api/user/admins');
      const list = (res && res.admins) || [];
      const avatar = '../../frontend/assets/images/PromoPing.png';
      tbody.innerHTML = list.map(a => `
        <tr>
          <td>
            <div class="d-flex px-2 py-1">
              <div>
                <img src="${avatar}" class="avatar avatar-sm me-3" alt="admin">
              </div>
              <div class="d-flex flex-column justify-content-center">
                <h6 class="mb-0 text-sm">${a.Nome || '—'}</h6>
                <p class="text-xs text-secondary mb-0">${a.Email || '—'}</p>
              </div>
            </div>
          </td>
          <td>
            <p class="text-xs font-weight-bold mb-0">${a.Perfil || 'Admin'}</p>
            <p class="text-xs text-secondary mb-0">Organization</p>
          </td>
          <td class="align-middle text-center text-sm">
            <span class="badge badge-sm bg-gradient-success">ONLINE</span>
          </td>
          <td class="align-middle text-center">
            <span class="text-secondary text-xs font-weight-bold">${a.DataRegisto ? new Date(a.DataRegisto).toLocaleDateString('pt-BR') : '—'}</span>
          </td>
          <td class="align-middle">
            <a href="javascript:;" class="text-secondary font-weight-bold text-xs">Edit</a>
          </td>
        </tr>
      `).join('') || `<tr><td colspan="5" class="text-center text-secondary text-sm">Sem admins</td></tr>`;
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger text-sm">Falha ao carregar</td></tr>`;
    }
  }

  async function initGithubProjects(options = {}) {
    const container = document.getElementById('github-projects');
    if (!container) return;
    const username = options.user || localStorage.getItem('PROMOPING_GH_USER');
    const org = options.org || localStorage.getItem('PROMOPING_GH_ORG');
    const max = Number(options.max || 6);
    try {
      let repos = [];
      if (Array.isArray(options.repos) && options.repos.length > 0) {
        // Buscar exatamente os repositórios fornecidos; se privado/404, criar card básico
        const fetched = await Promise.all(options.repos.map(async (fullName) => {
          try {
            const resp = await fetch(`https://api.github.com/repos/${fullName}`, { headers: { 'Accept': 'application/vnd.github+json' } });
            if (!resp.ok) {
              const name = fullName.split('/').pop();
              return {
                name,
                html_url: `https://github.com/${fullName}`,
                description: 'Repositório privado',
                language: 'Privado',
                stargazers_count: 0,
                forks_count: 0
              };
            }
            return await resp.json();
          } catch (_) {
            const name = fullName.split('/').pop();
            return {
              name,
              html_url: `https://github.com/${fullName}`,
              description: 'Repositório privado',
              language: 'Privado',
              stargazers_count: 0,
              forks_count: 0
            };
          }
        }));
        repos = fetched;
      } else {
        let url = null;
        if (org) url = `https://api.github.com/orgs/${org}/repos?sort=updated`;
        else if (username) url = `https://api.github.com/users/${username}/repos?sort=updated`;
        else {
          container.innerHTML = '<div class="text-secondary">Configure o GitHub em localStorage: PROMOPING_GH_USER ou PROMOPING_GH_ORG</div>';
          return;
        }
        const resp = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
        const list = await resp.json();
        if (!Array.isArray(list)) throw new Error('Resposta inválida do GitHub');
        repos = list.slice(0, max);
      }

      const items = repos.slice(0, max).map(r => `
        <div class="col-xl-4 col-md-6 mb-xl-0 mb-3 d-flex">
          <div class="card p-3 h-100 d-flex flex-column w-100">
            <p class="text-secondary mb-1 text-xs">${r.language || 'Repo'}</p>
            <a href="${r.html_url}" target="_blank" rel="noopener"><h6 class="font-weight-bolder mb-2">${r.name}</h6></a>
            <p class="mb-3 text-sm flex-grow-1">${(r.description || 'Repositório privado').substring(0,140)}</p>
            <div class="d-flex align-items-center justify-content-between mt-auto">
              <a href="${r.html_url}" target="_blank" class="btn btn-outline-primary btn-sm mb-0">Ver Projeto</a>
              <span class="text-xs text-secondary">★ ${r.stargazers_count || 0} • ⑂ ${r.forks_count || 0}</span>
            </div>
          </div>
        </div>
      `).join('');
      container.innerHTML = `<div class="row">${items}</div>`;
    } catch (e) {
      container.innerHTML = '<div class="text-danger">Falha ao carregar repositórios do GitHub</div>';
    }
  }

  async function initConversations() {
    const listEl = document.getElementById('conversations-list');
    if (!listEl) return;
    if (!requireAuth()) return;
    try {
      const res = await fetchJSON('/api/support/messages?limit=10');
      const items = await Promise.all((res.items || []).map(async (m) => {
        // Carregar thread para verificar se há mensagens não lidas
        const threadMessages = await loadConversationAdmin(m.id);
        // Contar quantas mensagens do usuário existem (respostas que o suporte precisa ver)
        const userMessages = threadMessages.filter(msg => msg.senderType === 'user');
        // Verificar se a última mensagem é do usuário (não respondida pelo suporte)
        const lastMsg = threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : null;
        const hasUnread = lastMsg && lastMsg.senderType === 'user';
        // Contar mensagens do usuário que vieram depois da última resposta do suporte
        const lastSupportMsgIndex = threadMessages.map((msg, idx) => 
          msg.senderType === 'support' ? idx : -1
        ).filter(idx => idx !== -1).pop();
        const unreadCount = lastSupportMsgIndex !== undefined 
          ? threadMessages.slice(lastSupportMsgIndex + 1).filter(msg => msg.senderType === 'user').length
          : userMessages.length;
        const badgeText = unreadCount > 9 ? '9+' : (unreadCount > 0 ? unreadCount.toString() : '');
        
        const messageText = m.message.length > 40 ? m.message.substring(0, 40) + '...' : m.message;
        const displayText = lastMsg && lastMsg.id !== m.id ? 
          (lastMsg.message.length > 40 ? lastMsg.message.substring(0, 40) + '...' : lastMsg.message) : 
          messageText;
        
        return `
        <li class="list-group-item border-0 d-flex align-items-center px-0 mb-2 conversation-item" 
            style="cursor: pointer; transition: background 0.2s; border-radius: 8px; padding: 8px !important;" 
            data-thread-id="${m.id}"
            onmouseover="this.style.background='#f8f9fa'" 
            onmouseout="this.style.background='transparent'">
          <div class="avatar me-3 position-relative">
            <img src="https://github.com/juliareboucasleite.png" alt="avatar" class="border-radius-lg shadow" style="width: 40px; height: 40px;">
            ${hasUnread ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size: 0.65rem; min-width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-weight: 600; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${badgeText}</span>` : ''}
          </div>
          <div class="d-flex align-items-start flex-column justify-content-center flex-grow-1">
            <h6 class="mb-0 text-sm" style="font-weight: ${hasUnread ? '600' : '400'}; color: ${hasUnread ? '#e91e63' : '#344767'};">
              Thread #${m.id} ${hasUnread ? '• Novo' : ''}
            </h6>
            <p class="mb-0 text-xs text-secondary" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayText}</p>
          </div>
          <span class="text-xs text-secondary ms-2" style="white-space: nowrap;">${new Date(m.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </li>
      `;
      }));
      
      listEl.innerHTML = items.join('') || '<li class="list-group-item border-0 px-0 text-secondary">Sem mensagens de suporte.</li>';
      
      // Adicionar event listeners para abrir chat ao clicar
      listEl.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
          const threadId = item.getAttribute('data-thread-id');
          openChatModal(threadId);
          // Atualizar lista após abrir para remover notificação
          setTimeout(() => initConversations(), 500);
        });
      });
    } catch (e) {
      console.error('Erro ao carregar conversas:', e);
      listEl.innerHTML = '<li class="list-group-item border-0 px-0 text-danger">Falha ao carregar conversas.</li>';
    }
  }

  async function loadConversationAdmin(threadId) {
    try {
      const res = await fetchJSON(`/api/support/messages?threadId=${threadId}`);
      return res.items || [];
    } catch (e) {
      console.error('Erro ao carregar conversa:', e);
      return [];
    }
  }

  function renderMessageAdmin(msg) {
    const isUser = msg.senderType === 'user';
    const time = new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(msg.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    // Cores e estilos diferentes para usuário vs suporte
    const userBg = '#f8f9fa';
    const userColor = '#344767';
    const userBorder = '#e9ecef';
    const supportBg = 'linear-gradient(135deg, #f17603 0%, #ff9800 100%)';
    const supportColor = '#ffffff';
    
    return `
      <div class="message-item d-flex justify-content-${isUser ? 'start' : 'end'} mb-4 align-items-end" style="gap: 10px;">
        ${isUser ? `
          <div class="rounded-circle d-flex align-items-center justify-content-center shadow-sm" 
               style="width: 36px; height: 36px; background: linear-gradient(135deg, #f17603 0%, #ff9800 100%); flex-shrink: 0;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="8" r="4" fill="white"/>
              <path d="M6 20C6 16 9 13 12 13C15 13 18 16 18 20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="white"/>
            </svg>
          </div>
        ` : ''}
        <div style="max-width: 70%; display: flex; flex-direction: column; align-items: ${isUser ? 'flex-start' : 'flex-end'};">
          <div class="d-flex align-items-center mb-1" style="gap: 8px; justify-content: ${isUser ? 'flex-start' : 'flex-end'};">
            <span style="font-size: 11px; font-weight: 600; color: #6c757d; text-transform: uppercase;">
              ${isUser ? 'Usuário' : 'Suporte'}
            </span>
            <span style="font-size: 10px; color: #adb5bd;">${date} às ${time}</span>
          </div>
          <div class="rounded-3 p-3 shadow-sm" 
               style="
                 background: ${isUser ? userBg : supportBg};
                 color: ${isUser ? userColor : supportColor};
                 border: 1px solid ${isUser ? userBorder : 'transparent'};
                 word-wrap: break-word;
                 position: relative;
                 ${isUser ? 'border-top-left-radius: 4px;' : 'border-top-right-radius: 4px;'}
               ">
            <div style="font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${msg.message}</div>
          </div>
        </div>
        ${!isUser ? `
          <img src="https://github.com/juliareboucasleite.png" alt="suporte" 
               class="rounded-circle shadow-sm" 
               style="width: 36px; height: 36px; object-fit: cover; flex-shrink: 0; border: 2px solid white;">
        ` : ''}
      </div>
    `;
  }

  async function refreshMessagesAdmin(threadId, container) {
    if (!threadId) return;
    const messages = await loadConversationAdmin(threadId);
    container.innerHTML = messages.map(renderMessageAdmin).join('');
    
    // Adicionar animação suave ao carregar mensagens
    const messageElements = container.querySelectorAll('.message-item');
    messageElements.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      setTimeout(() => {
        el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, index * 50);
    });
    
    // Scroll suave para o final
    setTimeout(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  }

  function openChatModal(threadId) {
    // Remover modal existente se houver
    const existingModal = document.getElementById('chat-modal-support');
    if (existingModal) existingModal.remove();

    // Criar modal de chat
    const modal = document.createElement('div');
    modal.id = 'chat-modal-support';
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered" style="max-width: 700px; width: 90vw;">
        <div class="modal-content shadow-lg" style="height: 85vh; max-height: 800px; display: flex; flex-direction: column; border: none; border-radius: 16px; overflow: hidden;">
          <div class="modal-header border-0" style="background: linear-gradient(135deg, #f17603 0%, #ff9800 100%); padding: 20px 24px;">
            <div class="d-flex align-items-center" style="gap: 12px;">
              <div class="rounded-circle d-flex align-items-center justify-content-center" 
                   style="width: 44px; height: 44px; background: rgba(255,255,255,0.2); backdrop-filter: blur(10px);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="8" r="4" fill="white"/>
                  <path d="M6 20C6 16 9 13 12 13C15 13 18 16 18 20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="white"/>
                </svg>
              </div>
              <div class="flex-grow-1">
                <h5 class="modal-title mb-0 text-white" style="font-weight: 600; font-size: 16px;">Chat de Suporte</h5>
                <small class="text-white-50" style="font-size: 12px;">Thread #${threadId}</small>
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" id="chat-modal-close" style="opacity: 0.8;"></button>
          </div>
          <div class="modal-body p-0" style="flex: 1; overflow: hidden; display: flex; flex-direction: column; background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%);">
            <div id="chat-messages-container" class="p-4" style="flex: 1; overflow-y: auto; background: transparent; scroll-behavior: smooth;">
              <style>
                #chat-messages-container::-webkit-scrollbar {
                  width: 8px;
                }
                #chat-messages-container::-webkit-scrollbar-track {
                  background: #f1f1f1;
                  border-radius: 10px;
                }
                #chat-messages-container::-webkit-scrollbar-thumb {
                  background: linear-gradient(135deg, #f17603 0%, #ff9800 100%);
                  border-radius: 10px;
                }
                #chat-messages-container::-webkit-scrollbar-thumb:hover {
                  background: linear-gradient(135deg, #e06a00 0%, #e68900 100%);
                }
              </style>
              <div class="text-center text-muted py-4">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                Carregando mensagens...
              </div>
            </div>
            <div class="border-top p-3 bg-white" style="box-shadow: 0 -2px 10px rgba(0,0,0,0.05);">
              <div class="d-flex align-items-end" style="gap: 12px;">
                <div class="flex-grow-1">
                  <textarea id="chat-message-input" 
                            class="form-control border-0 shadow-sm" 
                            rows="2" 
                            placeholder="Digite sua resposta..." 
                            style="resize: none; border-radius: 12px; padding: 12px; font-size: 14px; background: #f8f9fa; transition: all 0.2s;"
                            onfocus="this.style.background='#fff'; this.style.boxShadow='0 0 0 2px rgba(241, 118, 3, 0.25)';"
                            onblur="this.style.background='#f8f9fa'; this.style.boxShadow='none';"></textarea>
                </div>
                <button class="btn btn-primary d-flex align-items-center justify-content-center shadow-sm" 
                        id="chat-send-btn" 
                        type="button"
                        style="border-radius: 12px; width: 48px; height: 48px; padding: 0; background: linear-gradient(135deg, #f17603 0%, #ff9800 100%); border: none; transition: all 0.2s; display: flex; align-items: center; justify-content: center;"
                        onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(241, 118, 3, 0.4)';"
                        onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(241, 118, 3, 0.3)';">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));">
                    <path d="M22 2L11 13" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="white" fill-opacity="0.9"/>
                  </svg>
                </button>
              </div>
              <div id="chat-feedback" class="text-xs mt-2 text-center" style="min-height: 18px;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const messagesContainer = modal.querySelector('#chat-messages-container');
    const textEl = modal.querySelector('#chat-message-input');
    const sendBtn = modal.querySelector('#chat-send-btn');
    const feedback = modal.querySelector('#chat-feedback');
    const closeBtn = modal.querySelector('#chat-modal-close');

    // Carregar mensagens
    refreshMessagesAdmin(threadId, messagesContainer);

    // Fechar modal
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Enviar mensagem
    const sendMessage = async () => {
      const text = (textEl.value || '').trim();
      if (!text) return;

      try {
        feedback.textContent = 'Enviando...';
        feedback.className = 'text-xs mt-2 text-center text-secondary';

        const threadMessages = await loadConversationAdmin(threadId);
        const lastMsg = threadMessages.length > 0 
          ? threadMessages[threadMessages.length - 1] 
          : { id: threadId };

        await fetchJSON(`/api/support/messages/${lastMsg.id}/reply`, {
          method: 'POST',
          body: JSON.stringify({ message: text, senderType: 'support' })
        });

        textEl.value = '';
        feedback.textContent = 'Enviado com sucesso!';
        feedback.className = 'text-xs mt-2 text-center text-success';
        setTimeout(() => { feedback.textContent = ''; }, 2000);

        await refreshMessagesAdmin(threadId, messagesContainer);
        initConversations(); // Atualizar lista de conversas
      } catch (e) {
        console.error('Erro ao enviar:', e);
        feedback.textContent = 'Falha ao enviar.';
        feedback.className = 'text-xs mt-2 text-center text-danger';
      }
    };

    sendBtn.addEventListener('click', sendMessage);
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Focar no input
    setTimeout(() => textEl.focus(), 100);
  }

  async function loadThreadsAdmin(selectEl) {
    try {
      const res = await fetchJSON('/api/support/messages?limit=20');
      selectEl.innerHTML = '<option value="">Nova conversa...</option>';
      (res.items || []).forEach(thread => {
        const text = thread.message.length > 50 ? thread.message.substring(0, 50) + '...' : thread.message;
        const replyCount = thread.replyCount || 0;
        selectEl.innerHTML += `<option value="${thread.id}">#${thread.id} - ${text} ${replyCount > 0 ? `(${replyCount} respostas)` : ''}</option>`;
      });
    } catch (e) {
      console.error('Erro ao carregar threads:', e);
    }
  }

  function initSupportWidget() {
    // Botão flutuante
    if (document.getElementById('pp-support-btn')) return; // evita duplicar
    const btn = document.createElement('button');
    btn.id = 'pp-support-btn';
    btn.className = 'btn btn-primary position-fixed';
    btn.style.right = '24px';
    btn.style.bottom = '24px';
    btn.style.zIndex = '1080';
    btn.innerText = 'Suporte';
    document.body.appendChild(btn);

    let currentThreadId = null;

    // Modal maior com histórico
    const modal = document.createElement('div');
    modal.id = 'pp-support-modal';
    modal.className = 'card shadow position-fixed';
    modal.style.right = '24px';
    modal.style.bottom = '80px';
    modal.style.width = '600px';
    modal.style.height = '650px';
    modal.style.maxWidth = '90vw';
    modal.style.maxHeight = '90vh';
    modal.style.display = 'none';
    modal.style.zIndex = '1080';
    modal.style.flexDirection = 'column';
    modal.innerHTML = `
      <div class="card-header py-2 px-3 d-flex justify-content-between align-items-center">
        <strong>Contato de Suporte</strong>
        <button type="button" class="btn btn-sm btn-link text-secondary" id="pp-support-close">✕</button>
      </div>
      <div class="card-body p-3" style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
        <div class="mb-2">
          <label class="form-label small mb-1">Selecionar Conversa:</label>
          <select id="pp-support-thread-select" class="form-select form-select-sm">
            <option value="">Carregando...</option>
          </select>
        </div>
        <div id="pp-support-messages" class="border rounded p-3 mb-2" style="flex: 1; overflow-y: auto; background: #fafafa; min-height: 300px;">
          <div class="text-center text-muted py-4">Selecione uma conversa ou crie uma nova</div>
        </div>
        <div>
          <textarea id="pp-support-text" class="form-control" rows="2" placeholder="Digite sua resposta..." style="resize: none;"></textarea>
          <button id="pp-support-send" class="btn btn-primary btn-sm mt-2 w-100">Enviar Resposta</button>
          <div id="pp-support-feedback" class="text-xs mt-2 text-center"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const messagesContainer = modal.querySelector('#pp-support-messages');
    const textEl = modal.querySelector('#pp-support-text');
    const fb = modal.querySelector('#pp-support-feedback');
    const threadSelect = modal.querySelector('#pp-support-thread-select');

    async function loadThreadData(threadId) {
      if (!threadId) {
        messagesContainer.innerHTML = '<div class="text-center text-muted py-4">Selecione uma conversa ou crie uma nova</div>';
        currentThreadId = null;
        return;
      }
      currentThreadId = threadId;
      messagesContainer.innerHTML = '<div class="text-center text-muted py-2">Carregando...</div>';
      await refreshMessagesAdmin(threadId, messagesContainer);
    }

    btn.addEventListener('click', async () => {
      if (!requireAuth()) return;
      const isOpen = modal.style.display !== 'none';
      modal.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        await loadThreadsAdmin(threadSelect);
      }
    });

    modal.querySelector('#pp-support-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    threadSelect.addEventListener('change', async (e) => {
      const threadId = e.target.value;
      await loadThreadData(threadId);
    });

    modal.querySelector('#pp-support-send').addEventListener('click', async () => {
      if (!requireAuth()) return;
      const text = (textEl.value || '').trim();
      if (!text) { 
        fb.textContent = 'Escreva uma mensagem.'; 
        fb.className = 'text-xs text-warning mt-2'; 
        return; 
      }

      try {
        fb.textContent = 'Enviando...'; 
        fb.className = 'text-xs text-secondary mt-2';
        
        let result;
        if (currentThreadId) {
          // Carrega a thread completa para pegar a última mensagem
          const threadMessages = await loadConversationAdmin(currentThreadId);
          // Pega a última mensagem da thread ou usa o threadId como fallback
          const lastMsg = threadMessages.length > 0 
            ? threadMessages[threadMessages.length - 1] 
            : { id: currentThreadId };
          result = await fetchJSON(`/api/support/messages/${lastMsg.id}/reply`, {
            method: 'POST',
            body: JSON.stringify({ message: text, senderType: 'support' })
          });
        } else {
          // Nova mensagem do suporte (mas normalmente será do usuário)
          result = await fetchJSON('/api/support/messages', { 
            method: 'POST', 
            body: JSON.stringify({ message: text }) 
          });
          currentThreadId = result.threadId || result.id;
          threadSelect.value = currentThreadId;
        }

        textEl.value = '';
        fb.textContent = 'Enviado com sucesso!'; 
        fb.className = 'text-xs text-success mt-2';
        setTimeout(() => { fb.textContent = ''; }, 2000);

        await refreshMessagesAdmin(currentThreadId, messagesContainer);
        // Atualiza lista se estiver no perfil
        if (typeof initConversations === 'function') initConversations();
      } catch (e) {
        console.error('Erro ao enviar:', e);
        fb.textContent = 'Falha ao enviar.'; 
        fb.className = 'text-xs text-danger mt-2';
      }
    });

    // Permitir enviar com Enter
    textEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        modal.querySelector('#pp-support-send').click();
      }
    });
  }

  const API_BASE = getApiBase();
  w.PromoPingAdmin = { fetchJSON, initDashboard, initTables, initAuthors, initProfile, initGithubProjects, initConversations, initSupportWidget, requireAuth, API_BASE, TOKEN };
})(window);


