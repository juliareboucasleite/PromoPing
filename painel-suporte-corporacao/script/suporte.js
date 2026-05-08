/**
 * Suporte - PromoPing Admin
 * Sistema de chat de suporte
 */

(function() {
    'use strict';

    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = localStorage.getItem('PROMOPING_TOKEN');

    let currentThreadId = null;
    let threads = [];
    let messages = [];
    let attachedFiles = [];

    function checkAuth() {
        if (!TOKEN) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    function formatDate(dateString) {
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

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getInitial(name) {
        if (!name) return '?';
        const trimmed = String(name).trim();
        if (!trimmed) return '?';
        const ch = trimmed.charAt(0);
        return ch.toUpperCase();
    }

    function getThreadStageMeta(thread) {
        const stage = String(thread.supportStage || '').toLowerCase();
        if (stage === 'escalated') return { label: 'Escalada', className: 'thread-stage is-escalated' };
        if (stage === 'human_replied') return { label: 'Humano', className: 'thread-stage is-human' };
        if (stage === 'ai_answered') return { label: 'IA', className: 'thread-stage is-ai' };
        return { label: 'Aberta', className: 'thread-stage is-open' };
    }

    async function loadThreads() {
        const threadsList = document.getElementById('threadsList');
        const threadsCount = document.getElementById('threadsCount');
        if (!threadsList) return;

        try {
            threadsList.innerHTML = '<div class="loading-state">Carregando conversas...</div>';

            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl('/api/support/messages/admin?limit=50') : `${API_BASE}/api/support/messages/admin?limit=50`;
            const response = await fetch(safeUrl, {
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('[SUPORTE] Resposta não-JSON:', text.substring(0, 200));
                throw new Error(`Resposta inválida do servidor (${response.status})`);
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    error: 'Erro ao carregar conversas'
                }));
                throw new Error(errorData.error || 'Erro ao carregar conversas');
            }

            const data = await response.json();
            threads = data.items || [];

            renderThreads();
            if (threadsCount) threadsCount.textContent = threads.length;
        } catch (error) {
            console.error('[SUPORTE] Erro ao carregar threads:', error);
            threadsList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    function renderThreads() {
        const threadsList = document.getElementById('threadsList');
        if (!threadsList) return;

        if (threads.length === 0) {
            threadsList.innerHTML = '<div class="loading-state">Nenhuma conversa encontrada</div>';
            return;
        }

        const truncate = (str, max) => (str && str.length > max ? str.slice(0, max).trim() + '…' : (str || ''));
        const stripTitle = (s) => (window.APIUtils && window.APIUtils.stripBracketPrefix(s)) || (s || '');
        threadsList.innerHTML = threads.map(thread => {
            const ref = thread.ReferenciaID ? String(thread.ReferenciaID) : '';
            const preview = truncate(stripTitle(thread.message), 42);
            const userName = thread.userName || 'Usuário';
            const isNew = !(thread.replyCount > 0);
            const stage = getThreadStageMeta(thread);
            return `
            <div class="thread-item ${currentThreadId === thread.id ? 'active' : ''}" data-thread-id="${thread.id}">
                <div class="thread-avatar">${escapeHtml(getInitial(userName))}</div>
                <div class="thread-content">
                    <div class="thread-item-header">
                        <span class="thread-user-name">${escapeHtml(userName)}</span>
                        ${ref ? `<span class="thread-ref">${escapeHtml(ref)}</span>` : ''}
                    </div>
                    ${preview ? `<div class="thread-preview">${escapeHtml(preview)}</div>` : ''}
                    <div class="thread-meta">
                        <span>${formatDate(thread.createdAt)}</span>
                        <span class="${stage.className}">${stage.label}</span>
                        <span class="thread-replies ${isNew ? 'is-new' : ''}">${isNew ? 'Nova' : `${thread.replyCount} respostas`}</span>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        document.querySelectorAll('.thread-item').forEach(item => {
            item.addEventListener('click', () => {
                const threadId = parseInt(item.dataset.threadId);
                selectThread(threadId);
            });
        });
    }

    async function selectThread(threadId) {
        currentThreadId = threadId;
        await loadMessages(threadId);
        renderThreads();
    }

    async function loadMessages(threadId) {
        const chatMessages = document.getElementById('chatMessages');
        const chatHeader = document.getElementById('chatHeader');
        const chatUserName = document.getElementById('chatUserName');
        const chatUserEmail = document.getElementById('chatUserEmail');
        const chatInput = document.getElementById('chatInput');

        if (!chatMessages) return;

        try {
            chatMessages.innerHTML = '<div class="loading-state">Carregando mensagens...</div>';

            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(`/api/support/messages/admin?threadId=${encodeURIComponent(threadId)}`) : `${API_BASE}/api/support/messages/admin?threadId=${threadId}`;
            const response = await fetch(safeUrl, {
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Resposta inválida do servidor (${response.status})`);
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    error: 'Erro ao carregar mensagens'
                }));
                throw new Error(errorData.error || 'Erro ao carregar mensagens');
            }

            messages = await response.json();

            if (messages.length === 0) {
                chatMessages.innerHTML = '<div class="empty-state">Nenhuma mensagem nesta conversa</div>';
                if (chatHeader) chatHeader.style.display = 'none';
                if (chatInput) chatInput.style.display = 'none';
                return;
            }

            const firstMessage = messages[0];
            const displayName = firstMessage.userName || 'Usuário';
            if (chatUserName) chatUserName.textContent = displayName;
            if (chatUserEmail) chatUserEmail.textContent = firstMessage.userEmail || '';
            const chatUserAvatar = document.getElementById('chatUserAvatar');
            if (chatUserAvatar) chatUserAvatar.textContent = getInitial(displayName);
            if (chatHeader) chatHeader.style.display = 'flex';
            if (chatInput) chatInput.style.display = 'flex';

            // Buscar foto do perfil do suporte
            let supportPhoto = '';
            const profileData = localStorage.getItem('PROMOPING_PROFILE');
            if (profileData) {
                try {
                    const profile = JSON.parse(profileData);
                    if (profile.foto) {
                        supportPhoto = profile.foto;
                    }
                } catch (e) {
                    console.error('[SUPORTE] Erro ao carregar foto do perfil:', e);
                }
            }

            const stripTitle = (s) => (window.APIUtils && window.APIUtils.stripBracketPrefix(s)) || (s || '');
            chatMessages.innerHTML = messages.map(msg => {
                // Extrair URLs de imagens/GIFs da mensagem; remover prefixo [Discord]/[Console] e deixar só o título
                let messageText = stripTitle(msg.message || '');
                const imageMatches = messageText.match(/\[(?:GIF|Imagem):\s*([^\]]+)\]/g);
                let imagesHtml = '';
                
                if (imageMatches) {
                    imageMatches.forEach(match => {
                        const url = match.match(/\[(?:GIF|Imagem):\s*([^\]]+)\]/)[1];
                        imagesHtml += `<div class="message-attachment"><img src="${escapeHtml(url)}" alt="Anexo" style="max-width: 300px; border-radius: 8px; margin-top: 0.5rem;"></div>`;
                        messageText = messageText.replace(match, '');
                    });
                    messageText = messageText.trim();
                }

                if (msg.senderType === 'support') {
                    return `
                        <div class="message-wrapper support-message">
                            ${supportPhoto ? `<img src="${escapeHtml(supportPhoto)}" alt="Suporte" class="message-avatar">` : '<div class="message-avatar placeholder">PP</div>'}
                            <div class="message-bubble ${msg.senderType}">
                                <div class="message-sender">Suporte</div>
                                ${messageText ? `<div class="message-text">${escapeHtml(messageText)}</div>` : ''}
                                ${imagesHtml}
                                <div class="message-time">${formatDate(msg.createdAt)}</div>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="message-wrapper user-message">
                            <div class="message-bubble ${msg.senderType}">
                                <div class="message-sender">${escapeHtml(msg.userName || 'Usuário')}</div>
                                ${messageText ? `<div class="message-text">${escapeHtml(messageText)}</div>` : ''}
                                ${imagesHtml}
                                <div class="message-time">${formatDate(msg.createdAt)}</div>
                            </div>
                        </div>
                    `;
                }
            }).join('');

            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch (error) {
            console.error('[SUPORTE] Erro ao carregar mensagens:', error);
            chatMessages.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    async function sendMessage() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput || !currentThreadId) return;

        const message = messageInput.value.trim();
        const hasAttachments = attachedFiles.length > 0;

        if (!message && !hasAttachments) return;

        // Desabilitar input enquanto envia
        messageInput.disabled = true;
        const originalPlaceholder = messageInput.placeholder;
        messageInput.placeholder = 'A enviar...';

        try {
            let messageText = message;
            
            // Adicionar URLs de anexos à mensagem
            if (hasAttachments) {
                const attachmentUrls = attachedFiles.map(file => {
                    if (file.type === 'gif') {
                        return `[GIF: ${file.url}]`;
                    } else if (file.type === 'image') {
                        return `[Imagem: ${file.url}]`;
                    }
                    return `[Anexo: ${file.name}]`;
                }).join(' ');
                messageText = messageText ? `${messageText}\n\n${attachmentUrls}` : attachmentUrls;
            }

            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(`/api/support/messages/${encodeURIComponent(currentThreadId)}/reply`) : `${API_BASE}/api/support/messages/${currentThreadId}/reply`;
            const response = await fetch(safeUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TOKEN}`
                },
                body: JSON.stringify({
                    message: messageText,
                    senderType: 'support',
                    attachments: attachedFiles
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao enviar mensagem');
            }

            messageInput.value = '';
            attachedFiles = [];
            updateAttachedFilesPreview();
            await loadMessages(currentThreadId);
            await loadThreads();
        } catch (error) {
            console.error('[SUPORTE] Erro ao enviar mensagem:', error);
            showAlert(`Erro ao enviar mensagem: ${error.message}`);
        } finally {
            messageInput.disabled = false;
            messageInput.placeholder = originalPlaceholder;
        }
    }

    /**
     * Inicializa o upload de arquivos
     */
    function initFileUpload() {
        const attachBtn = document.getElementById('attachBtn');
        const fileInput = document.getElementById('fileInput');

        if (!attachBtn || !fileInput) return;

        attachBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        attachedFiles.push({
                            type: file.type.startsWith('image/') ? 'image' : 'video',
                            url: event.target.result,
                            name: file.name,
                            file: file
                        });
                        updateAttachedFilesPreview();
                    };
                    reader.readAsDataURL(file);
                } else {
                    showAlert('Apenas imagens e vídeos são suportados');
                }
            });
            fileInput.value = '';
        });
    }

    /**
     * Atualiza o preview dos arquivos anexados
     */
    function updateAttachedFilesPreview() {
        const preview = document.getElementById('attachedFiles');
        if (!preview) return;

        if (attachedFiles.length === 0) {
            preview.innerHTML = '';
            return;
        }

        preview.innerHTML = attachedFiles.map((file, index) => `
            <div class="attached-file-item">
                ${file.type === 'gif' || file.type === 'image' 
                    ? `<img src="${escapeHtml(file.url)}" alt="${escapeHtml(file.name)}">`
                    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#232326;color:#999;font-size:0.75rem;">${escapeHtml(file.name)}</div>`
                }
                <button class="remove-file-btn" data-index="${index}">✕</button>
            </div>
        `).join('');

        // Adicionar event listeners para remover arquivos
        preview.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                attachedFiles.splice(index, 1);
                updateAttachedFilesPreview();
            });
        });
    }

    /**
     * Excluir conversa
     */
    async function deleteThread() {
        if (!currentThreadId) return;

        showConfirm('Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita.', 'Excluir conversa', async () => {
        try {
            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(`/api/support/messages/${encodeURIComponent(currentThreadId)}`) : `${API_BASE}/api/support/messages/${currentThreadId}`;
            const response = await fetch(safeUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao excluir conversa');
            }

            // Limpar estado atual
            currentThreadId = null;
            messages = [];

            // Limpar interface
            const chatMessages = document.getElementById('chatMessages');
            const chatHeader = document.getElementById('chatHeader');
            const chatInput = document.getElementById('chatInput');

            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </div>
                        <p class="empty-state-title">Nenhuma conversa selecionada</p>
                        <p class="empty-state-text">Selecione uma conversa na lista ao lado para ver as mensagens e responder.</p>
                    </div>`;
            }
            if (chatHeader) chatHeader.style.display = 'none';
            if (chatInput) chatInput.style.display = 'none';

            // Recarregar lista de conversas
            await loadThreads();
        } catch (error) {
            console.error('[SUPORTE] Erro ao excluir conversa:', error);
            showAlert(`Erro ao excluir conversa: ${error.message}`);
        }
        });
    }

    function init() {
        if (!checkAuth()) return;

        const messageInput = document.getElementById('messageInput');
        const refreshBtn = document.getElementById('refreshBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const deleteThreadBtn = document.getElementById('deleteThreadBtn');

        initFileUpload();

        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        if (deleteThreadBtn) {
            deleteThreadBtn.addEventListener('click', deleteThread);
        }

        if (refreshBtn) refreshBtn.addEventListener('click', () => {
            loadThreads();
            if (currentThreadId) {
                loadMessages(currentThreadId);
            }
        });

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                showConfirm('Tem certeza que deseja sair?', 'Sair', () => {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                });
            });
        }

        loadThreads();
        setInterval(() => {
            loadThreads();
            if (currentThreadId) {
                loadMessages(currentThreadId);
            }
        }, 30000);

        console.log('[SUPORTE] Sistema de suporte inicializado');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
