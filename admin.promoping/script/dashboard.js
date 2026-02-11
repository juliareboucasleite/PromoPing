/**
 * Dashboard - PromoPing Admin
 * Sistema completo de administração
 */

(function() {
    'use strict';

    // Configuração - usar APIUtils para validação segura
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = localStorage.getItem('PROMOPING_TOKEN');

    // Estado
    let currentThreadId = null;
    let threads = [];
    let messages = [];
    let currentSection = 'overview';

    /**
     * Verificar autenticação
     */
    function checkAuth() {
        if (!TOKEN) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    /**
     * Requisição autenticada com tratamento de erros
     */
    async function fetchAuth(url, options = {}) {
        try {
            // Usar APIUtils para construir URL de forma segura
            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
            const response = await fetch(safeUrl, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            // Verificar se a resposta é JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error(`[DASHBOARD] Resposta não-JSON de ${url}:`, text.substring(0, 200));
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
            console.error(`[DASHBOARD] Erro ao fazer requisição para ${url}:`, error);
            throw new Error(`Erro de conexão: ${error.message}`);
        }
    }

    /**
     * Formatar data
     */
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

    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Gerar avaliação com estrelas SVG
     */
    function generateStarRating(rating) {
        const filledStar = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#ffd700" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#ffd700" stroke-width="1.5" stroke-linejoin="round"/></svg>';
        const emptyStar = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#666" stroke-width="1.5" stroke-linejoin="round"/></svg>';
        let stars = '';
        for (let i = 0; i < 5; i++) {
            stars += i < rating ? filledStar : emptyStar;
        }
        return stars;
    }

    async function loadOverview() {
        try {
            // Carregar estatísticas
            const [usersRes, productsRes, supportRes, bugsRes, statsRes] = await Promise.all([
                fetchAuth('/api/admin/users?limit=1').catch(() => null),
                fetchAuth('/api/admin/products?limit=1').catch(() => null),
                fetch(window.APIUtils ? window.APIUtils.buildSafeUrl('/api/support/messages/admin') : `${API_BASE}/api/support/messages/admin`, {
                    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
                }).catch(() => null),
                fetchAuth('/api/admin/bugs').catch(() => null),
                fetch(window.APIUtils ? window.APIUtils.buildSafeUrl('/api/stats/users') : `${API_BASE}/api/stats/users`, {
                    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
                }).catch(() => null)
            ]);

            const usersData = usersRes ? await usersRes.json().catch(() => ({
                total: 0
            })) : {
                total: 0
            };
            const productsData = productsRes ? await productsRes.json().catch(() => ({
                total: 0
            })) : {
                total: 0
            };
            const supportData = supportRes ? await supportRes.json().catch(() => ({
                items: []
            })) : {
                items: []
            };
            const bugsData = bugsRes ? await bugsRes.json().catch(() => ({
                bugs: []
            })) : {
                bugs: []
            };
            const statsData = statsRes ? await statsRes.json().catch(() => ({})) : {};

            // Atualizar cards
            document.getElementById('statUsersActive').textContent = usersData.total || 0;
            document.getElementById('statProductsMonitored').textContent = productsData.total || 0;
            document.getElementById('statSupportThreads').textContent = (supportData.items || []).length;
            // Contar bugs com status "Aberto" ou "Em Progresso"
            const bugsOpen = (bugsData.bugs || []).filter(b => {
                const status = (b.Status || '').toLowerCase();
                return status === 'open' || status === 'aberto' || 
                       status === 'em progresso' || status === 'em_progresso' ||
                       status === 'in progress' || status === 'in_progress';
            }).length;
            document.getElementById('statBugsOpen').textContent = bugsOpen;

            // Carregar atividade recente
            await loadRecentActivity();
        } catch (error) {
            console.error('[DASHBOARD] Erro ao carregar overview:', error);
        }
    }

    async function loadRecentActivity() {
        const activityList = document.getElementById('recentActivity');
        if (!activityList) return;

        try {
            const [usersRes, productsRes] = await Promise.all([
                fetchAuth('/api/admin/users?limit=5'),
                fetchAuth('/api/admin/products?limit=5')
            ]);

            const usersData = await usersRes.json();
            const productsData = await productsRes.json();

            const activities = [];

            // Adicionar novos usuários
            (usersData.users || []).forEach(user => {
                activities.push({
                    type: 'user',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                    title: 'Novo utilizador registado',
                    description: `${user.Nome} (${user.Email})`,
                    time: user.Data_Registo
                });
            });

            // Adicionar novos produtos
            (productsData.products || []).forEach(product => {
                activities.push({
                    type: 'product',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 16V8C20.9996 7.64928 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44398 6.69751 3.26846 7.00116C3.09294 7.30481 3.00036 7.64928 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.27 6.96L12 12.01L20.73 6.96" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22.08V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                    title: 'Novo produto monitorizado',
                    description: `${product.Nome} por ${product.UserName || 'Usuário'}`,
                    time: product.DataCriacao
                });
            });

            // Ordenar por data
            activities.sort((a, b) => new Date(b.time) - new Date(a.time));

            if (activities.length === 0) {
                activityList.innerHTML = '<div class="loading-state">Nenhuma atividade recente</div>';
                return;
            }

            activityList.innerHTML = activities.slice(0, 10).map(activity => `
                <div class="activity-item">
                    <div class="activity-icon ${activity.type}">${activity.icon}</div>
                    <div class="activity-content">
                        <h4>${escapeHtml(activity.title)}</h4>
                        <p>${escapeHtml(activity.description)}</p>
                    </div>
                    <div class="activity-time">${formatDate(activity.time)}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('[DASHBOARD] Erro ao carregar atividade:', error);
            activityList.innerHTML = '<div class="loading-state" style="color: #fca5a5;">Erro ao carregar atividade</div>';
        }
    }

    async function loadUsers() {
        const usersList = document.getElementById('usersList');
        if (!usersList) return;

        try {
            usersList.innerHTML = '<div class="loading-state">Carregando utilizadores...</div>';

            const response = await fetchAuth('/api/admin/users?limit=50');
            const data = await response.json();

            if (data.users.length === 0) {
                usersList.innerHTML = '<div class="loading-state">Nenhum utilizador encontrado</div>';
                return;
            }

            usersList.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Registado</th>
                            <th>Produtos</th>
                            <th>Notificações</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.users.map(user => `
                            <tr>
                                <td>${escapeHtml(user.Nome || 'N/A')}</td>
                                <td>${escapeHtml(user.Email || 'N/A')}</td>
                                <td>${formatDate(user.Data_Registo)}</td>
                                <td>${user.produtosCount || 0}</td>
                                <td>${user.notificacoesCount || 0}</td>
                                <td>
                                    <span style="color: ${user.Ativo ? '#86efac' : '#fca5a5'}">
                                        ${user.Ativo ? '✓ Ativo' : '✗ Inativo'}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            console.error('[DASHBOARD] Erro ao carregar utilizadores:', error);
            usersList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    async function loadProducts() {
        const productsList = document.getElementById('productsList');
        if (!productsList) return;

        try {
            productsList.innerHTML = '<div class="loading-state">Carregando produtos...</div>';

            const response = await fetchAuth('/api/admin/products?limit=50');
            const data = await response.json();

            if (data.products.length === 0) {
                productsList.innerHTML = '<div class="loading-state">Nenhum produto encontrado</div>';
                return;
            }

            productsList.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Utilizador</th>
                            <th>Preço Atual</th>
                            <th>Preço Alvo</th>
                            <th>Loja</th>
                            <th>Criado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.products.map(product => `
                            <tr>
                                <td>${escapeHtml(product.Nome || 'N/A')}</td>
                                <td>${escapeHtml(product.UserName || 'N/A')}</td>
                                <td>€${parseFloat(product.PrecoAtual || 0).toFixed(2)}</td>
                                <td>€${parseFloat(product.PrecoAlvo || 0).toFixed(2)}</td>
                                <td>${escapeHtml(product.Loja || 'N/A')}</td>
                                <td>${formatDate(product.DataCriacao)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            console.error('[DASHBOARD] Erro ao carregar produtos:', error);
            productsList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    async function loadReviews() {
        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;

        try {
            reviewsList.innerHTML = '<div class="loading-state">Carregando avaliações...</div>';

            const response = await fetchAuth('/api/admin/reviews');
            const data = await response.json();

            if (data.reviews.length === 0) {
                reviewsList.innerHTML = '<div class="loading-state">Sistema de avaliações em desenvolvimento</div>';
                return;
            }

            reviewsList.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Utilizador</th>
                            <th>Avaliação</th>
                            <th>Comentário</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.reviews.map(review => `
                            <tr>
                                <td>${escapeHtml(review.userName || 'N/A')}</td>
                                <td>${generateStarRating(review.rating || 0)}</td>
                                <td>${escapeHtml(review.comment || 'N/A')}</td>
                                <td>${formatDate(review.date)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            console.error('[DASHBOARD] Erro ao carregar avaliações:', error);
            reviewsList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    async function loadBugs() {
        const bugsList = document.getElementById('bugsList');
        if (!bugsList) return;

        try {
            bugsList.innerHTML = '<div class="loading-state">Carregando bugs e projetos...</div>';

            const response = await fetchAuth('/api/admin/bugs');
            const data = await response.json();

            if (!data.bugs || data.bugs.length === 0) {
                bugsList.innerHTML = '<div class="loading-state">Nenhum bug ou projeto encontrado</div>';
                return;
            }

            bugsList.innerHTML = data.bugs.map(bug => `
                <div class="bug-item">
                    <div class="bug-header">
                        <h3 class="bug-title">${escapeHtml(bug.Titulo || 'Sem título')}</h3>
                        <span class="bug-status ${bug.Status || 'open'}">${bug.Status || 'open'}</span>
                    </div>
                    <p class="bug-description">${escapeHtml(bug.Descricao || 'Sem descrição')}</p>
                    <div class="bug-meta">
                        <span>Tipo: ${bug.Tipo || 'bug'}</span>
                        <span>Prioridade: ${bug.Prioridade || 'medium'}</span>
                        <span>Criado: ${formatDate(bug.DataCriacao)}</span>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('[DASHBOARD] Erro ao carregar bugs:', error);
            bugsList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    /**
     * Criar novo bug
     */
    async function createBug() {
        const bugTitle = document.getElementById('bugTitle');
        const bugDescription = document.getElementById('bugDescription');
        const bugType = document.getElementById('bugType');
        const bugPriority = document.getElementById('bugPriority');
        const bugStatus = document.getElementById('bugStatus');

        if (!bugTitle || !bugDescription || !bugType || !bugPriority || !bugStatus) {
            alert('Erro: Elementos do formulário não encontrados');
            return;
        }

        const formData = {
            titulo: bugTitle.value.trim(),
            descricao: bugDescription.value.trim(),
            tipo: bugType.value,
            prioridade: bugPriority.value,
            status: bugStatus.value
        };

        if (!formData.titulo || !formData.descricao) {
            alert('Por favor, preencha título e descrição');
            return;
        }

        try {
            const response = await fetchAuth('/api/admin/bugs', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao criar bug');
            }

            alert('Bug/Projeto criado com sucesso!');
            closeBugModal();
            await loadBugs(); // Recarregar lista
        } catch (error) {
            console.error('[DASHBOARD] Erro ao criar bug:', error);
            alert(`Erro ao criar bug: ${error.message}`);
        }
    }

    /**
     * Fechar modal de bug
     */
    function closeBugModal() {
        const modal = document.getElementById('bugModal');
        const form = document.getElementById('bugForm');

        if (modal) modal.classList.remove('show');
        if (form) form.reset();
    }

    async function loadThreads() {
        const threadsList = document.getElementById('threadsList');
        const threadsCount = document.getElementById('threadsCount');
        if (!threadsList) return;

        try {
            threadsList.innerHTML = '<div class="loading-state">Carregando conversas...</div>';

            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl('/api/support/messages/admin?limit=50') : `${API_BASE}/api/support/messages/admin?limit=50`;
            const response = await fetch(safeUrl, {
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
            });

            // Verificar se a resposta é JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('[DASHBOARD] Resposta não-JSON de /api/support/messages/admin:', text.substring(0, 200));
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
            console.error('[DASHBOARD] Erro ao carregar threads:', error);
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

            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(`/api/support/messages/admin?threadId=${encodeURIComponent(threadId)}`) : `${API_BASE}/api/support/messages/admin?threadId=${threadId}`;
            const response = await fetch(safeUrl, {
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
            });

            // Verificar se a resposta é JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('[DASHBOARD] Resposta não-JSON de /api/support/messages/admin:', text.substring(0, 200));
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
                chatHeader.style.display = 'none';
                chatInput.style.display = 'none';
                return;
            }

            const firstMessage = messages[0];
            if (chatUserName) chatUserName.textContent = escapeHtml(firstMessage.userName || 'Usuário');
            if (chatUserEmail) chatUserEmail.textContent = escapeHtml(firstMessage.userEmail || '');
            if (chatHeader) chatHeader.style.display = 'flex';
            if (chatInput) chatInput.style.display = 'flex';

            chatMessages.innerHTML = messages.map(msg => `
                <div class="message-bubble ${msg.senderType}">
                    <div class="message-sender">${msg.senderType === 'user' ? escapeHtml(msg.userName || 'Usuário') : 'Suporte'}</div>
                    <div class="message-text">${escapeHtml(msg.message)}</div>
                    <div class="message-time">${formatDate(msg.createdAt)}</div>
                </div>
            `).join('');

            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch (error) {
            console.error('[DASHBOARD] Erro ao carregar mensagens:', error);
            chatMessages.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    async function sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        if (!messageInput || !sendBtn || !currentThreadId) return;

        const message = messageInput.value.trim();
        if (!message) return;

        sendBtn.disabled = true;
        sendBtn.textContent = 'Enviando...';

        try {
            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(`/api/support/messages/${encodeURIComponent(currentThreadId)}/reply`) : `${API_BASE}/api/support/messages/${currentThreadId}/reply`;
            const response = await fetch(safeUrl, {
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
            console.error('[DASHBOARD] Erro ao enviar mensagem:', error);
            alert(`Erro ao enviar mensagem: ${error.message}`);
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Enviar';
        }
    }

    function switchSection(section) {
        currentSection = section;

        // Atualizar nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === section) {
                item.classList.add('active');
            }
        });

        // Mostrar seção
        document.querySelectorAll('.dashboard-section').forEach(sec => {
            sec.classList.remove('active');
        });

        const sectionEl = document.getElementById(`${section}Section`);
        if (sectionEl) {
            sectionEl.classList.add('active');
        }

        // Carregar dados da seção
        switch (section) {
            case 'overview':
                loadOverview();
                break;
            case 'users':
                loadUsers();
                break;
            case 'products':
                loadProducts();
                break;
            case 'reviews':
                loadReviews();
                break;
            case 'support':
                loadThreads();
                break;
            case 'bugs':
                loadBugs();
                break;
        }
    }

    function init() {
        if (!checkAuth()) return;

        // Event listeners
        const sendBtn = document.getElementById('sendBtn');
        const messageInput = document.getElementById('messageInput');
        const refreshBtn = document.getElementById('refreshBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (sendBtn && messageInput) {
            sendBtn.addEventListener('click', sendMessage);
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                switchSection(currentSection);
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Tem certeza que deseja sair?')) {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                }
            });
        }

        // Navegação
        document.querySelectorAll('.nav-item[data-section]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                switchSection(item.dataset.section);
            });
        });

        // Botões de refresh específicos
        const refreshOverviewBtn = document.getElementById('refreshOverviewBtn');
        const refreshUsersBtn = document.getElementById('refreshUsersBtn');
        const refreshProductsBtn = document.getElementById('refreshProductsBtn');
        const refreshReviewsBtn = document.getElementById('refreshReviewsBtn');
        const newBugBtn = document.getElementById('newBugBtn');
        const closeBugModalBtn = document.getElementById('closeBugModal');
        const cancelBugBtn = document.getElementById('cancelBugBtn');
        const bugForm = document.getElementById('bugForm');

        if (refreshOverviewBtn) refreshOverviewBtn.addEventListener('click', () => loadOverview());
        if (refreshUsersBtn) refreshUsersBtn.addEventListener('click', () => loadUsers());
        if (refreshProductsBtn) refreshProductsBtn.addEventListener('click', () => loadProducts());
        if (refreshReviewsBtn) refreshReviewsBtn.addEventListener('click', () => loadReviews());

        // Modal de Bug
        if (newBugBtn) {
            newBugBtn.addEventListener('click', () => {
                const modal = document.getElementById('bugModal');
                if (modal) modal.classList.add('show');
            });
        }

        if (closeBugModalBtn) {
            closeBugModalBtn.addEventListener('click', closeBugModal);
        }

        if (cancelBugBtn) {
            cancelBugBtn.addEventListener('click', closeBugModal);
        }

        // Fechar modal ao clicar fora
        const bugModal = document.getElementById('bugModal');
        if (bugModal) {
            bugModal.addEventListener('click', (e) => {
                if (e.target === bugModal) {
                    closeBugModal();
                }
            });
        }

        if (bugForm) {
            bugForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await createBug();
            });
        }

        // Carregar seção inicial
        switchSection('overview');

        // Auto-refresh a cada 60 segundos
        setInterval(() => {
            switchSection(currentSection);
        }, 60000);

        console.log('[DASHBOARD] Dashboard inicializado');
    }

    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();