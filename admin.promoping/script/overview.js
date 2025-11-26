/**
 * Overview - PromoPing Admin
 * Visão Geral com estatísticas e atividade recente
 */

(function() {
    'use strict';

    const API_BASE = (localStorage.getItem('PROMOPING_API') || 'http://localhost:3000').replace(/\/+$/, '');
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
            const response = await fetch(`${API_BASE}${url}`, {
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
            const [usersRes, productsRes, supportRes, bugsRes] = await Promise.all([
                fetchAuth('/api/admin/users?limit=1').catch(() => null),
                fetchAuth('/api/admin/products?limit=1').catch(() => null),
                fetch(`${API_BASE}/api/support/messages/admin`).catch(() => null),
                fetchAuth('/api/admin/bugs').catch(() => null)
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

            document.getElementById('statUsersActive').textContent = usersData.total || 0;
            document.getElementById('statProductsMonitored').textContent = productsData.total || 0;
            document.getElementById('statSupportThreads').textContent = (supportData.items || []).length;
            document.getElementById('statBugsOpen').textContent = (bugsData.bugs || []).filter(b => b.Status === 'open').length;

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
                    icon: '👤',
                    title: 'Novo utilizador registado',
                    description: `${user.Nome} (${user.Email})`,
                    time: user.Data_Registo
                });
            });

            (productsData.products || []).forEach(product => {
                activities.push({
                    type: 'product',
                    icon: '📦',
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