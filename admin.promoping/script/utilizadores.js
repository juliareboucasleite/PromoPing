/**
 * Utilizadores - PromoPing Admin
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
                throw new Error(`Resposta inválida do servidor (${response.status})`);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error(`[UTILIZADORES] Erro:`, error);
            throw error;
        }
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
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

    async function loadUsers() {
        const usersList = document.getElementById('usersList');
        if (!usersList) return;

        try {
            usersList.innerHTML = '<div class="loading-state">Carregando utilizadores...</div>';

            const response = await fetchAuth('/api/admin/users?limit=50');
            const data = await response.json();

            if (!data.users || data.users.length === 0) {
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
            console.error('[UTILIZADORES] Erro ao carregar utilizadores:', error);
            usersList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    function init() {
        if (!checkAuth()) return;

        const refreshBtn = document.getElementById('refreshUsersBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (refreshBtn) refreshBtn.addEventListener('click', loadUsers);
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Tem certeza que deseja sair?')) {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                }
            });
        }

        loadUsers();
        console.log('[UTILIZADORES] Página de utilizadores inicializada');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();