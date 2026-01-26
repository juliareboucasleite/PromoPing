/**
 * Overview - PromoPing Admin
 * Visão Geral com estatísticas e atividade recente
 */

(function() {
    'use strict';

    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = localStorage.getItem('PROMOPING_TOKEN');

    function checkAuth() {
        if (!TOKEN) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    async function fetchAuth(url, options = {}) {
        try {
            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
            const response = await fetch(safeUrl, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error(`[OVERVIEW] Resposta não-JSON de ${url}:`, text.substring(0, 200));
                throw new Error(`Resposta inválida do servidor (${response.status}): ${text.substring(0, 100)}`);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
            }

            return response;
        } catch (error) {
            if (error.message && error.message.includes('Resposta inválida')) {
                throw error;
            }
            console.error(`[OVERVIEW] Erro ao fazer requisição para ${url}:`, error);
            throw new Error(`Erro de conexão: ${error.message}`);
        }
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

    async function loadOverview() {
        try {
            console.log('[OVERVIEW] Carregando estatísticas...');
            
            // Carregar estatísticas com autenticação
            const [usersRes, productsRes, supportRes, bugsRes] = await Promise.all([
                fetchAuth('/api/admin/users?limit=1').catch(err => {
                    console.error('[OVERVIEW] Erro ao buscar usuários:', err);
                    return null;
                }),
                fetchAuth('/api/admin/products?limit=1').catch(err => {
                    console.error('[OVERVIEW] Erro ao buscar produtos:', err);
                    return null;
                }),
                fetchAuth('/api/support/messages/admin').catch(err => {
                    console.error('[OVERVIEW] Erro ao buscar suporte:', err);
                    return null;
                }),
                fetchAuth('/api/admin/bugs').catch(err => {
                    console.error('[OVERVIEW] Erro ao buscar bugs:', err);
                    return null;
                })
            ]);

            // Processar dados de usuários
            let usersTotal = 0;
            if (usersRes) {
                try {
                    const usersData = await usersRes.json();
                    usersTotal = usersData.total || 0;
                    console.log('[OVERVIEW] Usuários ativos:', usersTotal);
                } catch (err) {
                    console.error('[OVERVIEW] Erro ao processar dados de usuários:', err);
                }
            }

            // Processar dados de produtos
            let productsTotal = 0;
            if (productsRes) {
                try {
                    const productsData = await productsRes.json();
                    productsTotal = productsData.total || 0;
                    console.log('[OVERVIEW] Produtos monitorados:', productsTotal);
                } catch (err) {
                    console.error('[OVERVIEW] Erro ao processar dados de produtos:', err);
                }
            }

            // Processar dados de suporte
            let supportThreads = 0;
            if (supportRes) {
                try {
                    const supportData = await supportRes.json();
                    supportThreads = (supportData.items || []).length;
                    console.log('[OVERVIEW] Conversas de suporte:', supportThreads);
                } catch (err) {
                    console.error('[OVERVIEW] Erro ao processar dados de suporte:', err);
                }
            }

            // Processar dados de bugs
            let bugsOpen = 0;
            if (bugsRes) {
                try {
                    const bugsData = await bugsRes.json();
                    // Contar bugs com status "Aberto" ou "Em Progresso"
                    bugsOpen = (bugsData.bugs || []).filter(b => {
                        const status = (b.Status || '').toLowerCase();
                        return status === 'open' || status === 'aberto' || 
                               status === 'em progresso' || status === 'em_progresso' ||
                               status === 'in progress' || status === 'in_progress';
                    }).length;
                    console.log('[OVERVIEW] Bugs abertos:', bugsOpen);
                } catch (err) {
                    console.error('[OVERVIEW] Erro ao processar dados de bugs:', err);
                }
            }

            // Atualizar cards
            const statUsersEl = document.getElementById('statUsersActive');
            const statProductsEl = document.getElementById('statProductsMonitored');
            const statSupportEl = document.getElementById('statSupportThreads');
            const statBugsEl = document.getElementById('statBugsOpen');

            if (statUsersEl) statUsersEl.textContent = usersTotal;
            if (statProductsEl) statProductsEl.textContent = productsTotal;
            if (statSupportEl) statSupportEl.textContent = supportThreads;
            if (statBugsEl) statBugsEl.textContent = bugsOpen;

            // Carregar atividade recente
            await loadRecentActivity();
        } catch (error) {
            console.error('[OVERVIEW] Erro ao carregar overview:', error);
        }
    }

    async function loadRecentActivity() {
        const activityList = document.getElementById('recentActivity');
        if (!activityList) return;

        try {
            const [usersRes, productsRes] = await Promise.all([
                fetchAuth('/api/admin/users?limit=5').catch(() => null),
                fetchAuth('/api/admin/products?limit=5').catch(() => null)
            ]);

            const usersData = usersRes ? await usersRes.json().catch(() => ({
                users: []
            })) : {
                users: []
            };
            const productsData = productsRes ? await productsRes.json().catch(() => ({
                products: []
            })) : {
                products: []
            };

            const activities = [];

            (usersData.users || []).forEach(user => {
                activities.push({
                    type: 'user',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                    title: 'Novo utilizador registado',
                    description: `${user.Nome} (${user.Email})`,
                    time: user.DataRegisto || user.Data_Registo
                });
            });

            (productsData.products || []).forEach(product => {
                activities.push({
                    type: 'product',
                    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 16V8C20.9996 7.64928 20.9071 7.30481 20.7315 7.00116C20.556 6.69751 20.3037 6.44536 20 6.27L13 2.27C12.696 2.09446 12.3511 2.00205 12 2.00205C11.6489 2.00205 11.304 2.09446 11 2.27L4 6.27C3.69626 6.44536 3.44398 6.69751 3.26846 7.00116C3.09294 7.30481 3.00036 7.64928 3 8V16C3.00036 16.3507 3.09294 16.6952 3.26846 16.9988C3.44398 17.3025 3.69626 17.5546 4 17.73L11 21.73C11.304 21.9055 11.6489 21.9979 12 21.9979C12.3511 21.9979 12.696 21.9055 13 21.73L20 17.73C20.3037 17.5546 20.556 17.3025 20.7315 16.9988C20.9071 16.6952 20.9996 16.3507 21 16Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.27 6.96L12 12.01L20.73 6.96" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 22.08V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
                    title: 'Novo produto monitorizado',
                    description: `${product.Nome} por ${product.UserName || 'Usuário'}`,
                    time: product.DataCriacao
                });
            });

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
            console.error('[OVERVIEW] Erro ao carregar atividade:', error);
            activityList.innerHTML = '<div class="loading-state" style="color: #fca5a5;">Erro ao carregar atividade</div>';
        }
    }

    function init() {
        if (!checkAuth()) return;

        const refreshBtn = document.getElementById('refreshOverviewBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (refreshBtn) refreshBtn.addEventListener('click', loadOverview);
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Tem certeza que deseja sair?')) {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                }
            });
        }

        loadOverview();
        setInterval(loadOverview, 60000);
        console.log('[OVERVIEW] Overview inicializado');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();