/**
 * Suporte - PromoPing Admin
 * Sistema de chat de suporte
 */

(function() {
    'use strict';

    const API_BASE = (localStorage.getItem('PROMOPING_API') || 'http://localhost:3000').replace(/\/+$/, '');
    const TOKEN = localStorage.getItem('PROMOPING_TOKEN');

    let currentThreadId = null;
    let threads = [];
    let messages = [];

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

    async function loadThreads() {
        const threadsList = document.getElementById('threadsList');
        const threadsCount = document.getElementById('threadsCount');
        if (!threadsList) return;

        try {
            threadsList.innerHTML = '<div class="loading-state">Carregando conversas...</div>';

            const response = await fetch(`${API_BASE}/api/support/messages/admin?limit=50`, {
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

        threadsList.innerHTML = threads.map(thread => `
            <div class="thread-item ${currentThreadId === thread.id ? 'active' : ''}" data-thread-id="${thread.id}">
                <h4>${escapeHtml(thread.userName || 'Usuário Desconhecido')}</h4>
                <p>${escapeHtml(thread.message)}</p>
                <div class="thread-meta">
                    <span>${formatDate(thread.createdAt)}</span>
                    <span>${thread.replyCount > 0 ? `${thread.replyCount} respostas` : 'Nova'}</span>
                </div>
            </div>
        `).join('');

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

            const response = await fetch(`${API_BASE}/api/support/messages/admin?threadId=${threadId}`, {
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
            if (chatUserName) chatUserName.textContent = escapeHtml(firstMessage.userName || 'Usuário');
            if (chatUserEmail) chatUserEmail.textContent = escapeHtml(firstMessage.userEmail || '');
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

            chatMessages.innerHTML = messages.map(msg => {
                if (msg.senderType === 'support') {
                    return `
                        <div class="message-wrapper support-message">
                            ${supportPhoto ? `<img src="${escapeHtml(supportPhoto)}" alt="Suporte" class="message-avatar">` : '<div class="message-avatar placeholder">PP</div>'}
                            <div class="message-bubble ${msg.senderType}">
                                <div class="message-sender">Suporte</div>
                                <div class="message-text">${escapeHtml(msg.message)}</div>
                                <div class="message-time">${formatDate(msg.createdAt)}</div>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="message-wrapper user-message">
                            <div class="message-bubble ${msg.senderType}">
                                <div class="message-sender">${escapeHtml(msg.userName || 'Usuário')}</div>
                                <div class="message-text">${escapeHtml(msg.message)}</div>
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
        if (!message) return;

        // Desabilitar input enquanto envia
        messageInput.disabled = true;
        const originalPlaceholder = messageInput.placeholder;
        messageInput.placeholder = 'Enviando...';

        try {
            const response = await fetch(`${API_BASE}/api/support/messages/${currentThreadId}/reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TOKEN}`
                },
                body: JSON.stringify({
                    message: message,
                    senderType: 'support'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao enviar mensagem');
            }

            messageInput.value = '';
            await loadMessages(currentThreadId);
            await loadThreads();
        } catch (error) {
            console.error('[SUPORTE] Erro ao enviar mensagem:', error);
            alert(`Erro ao enviar mensagem: ${error.message}`);
        } finally {
            messageInput.disabled = false;
            messageInput.placeholder = originalPlaceholder;
        }
    }

    /**
     * Excluir conversa
     */
    async function deleteThread() {
        if (!currentThreadId) return;

        if (!confirm('Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/support/messages/${currentThreadId}`, {
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
                chatMessages.innerHTML = '<div class="empty-state"><p>Selecione uma conversa para visualizar as mensagens</p></div>';
            }
            if (chatHeader) chatHeader.style.display = 'none';
            if (chatInput) chatInput.style.display = 'none';

            // Recarregar lista de conversas
            await loadThreads();
        } catch (error) {
            console.error('[SUPORTE] Erro ao excluir conversa:', error);
            alert(`Erro ao excluir conversa: ${error.message}`);
        }
    }

    function init() {
        if (!checkAuth()) return;

        const messageInput = document.getElementById('messageInput');
        const refreshBtn = document.getElementById('refreshBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const deleteThreadBtn = document.getElementById('deleteThreadBtn');

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
                if (confirm('Tem certeza que deseja sair?')) {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                }
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