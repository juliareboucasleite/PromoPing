/**
 * Utilizadores - PromoPing Admin
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

    let cachedUsers = [];

    function filterUsers(users, filterKey) {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        switch (filterKey) {
            case 'principais':
                return users.filter(u => (u.produtosCount || 0) >= 3);
            case 'primeira-vez':
                const regPrimeira = users.filter(u => {
                    const reg = u.DataRegisto ? new Date(u.DataRegisto) : null;
                    return reg && reg >= thirtyDaysAgo && (u.produtosCount || 0) <= 1;
                });
                return regPrimeira;
            case 'recorrentes':
                return users.filter(u => (u.produtosCount || 0) >= 2);
            case 'recentes':
                return users.filter(u => {
                    const reg = u.DataRegisto ? new Date(u.DataRegisto) : null;
                    return reg && reg >= sevenDaysAgo;
                });
            case 'todos':
            default:
                return users;
        }
    }

    function renderUsersTable(users) {
        const usersList = document.getElementById('usersList');
        if (!usersList) return;

        if (!users || users.length === 0) {
            usersList.innerHTML = '<div class="loading-state">Nenhum utilizador encontrado</div>';
            return;
        }

        usersList.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Referência</th>
                        <th>Nome</th>
                        <th>Email</th>
                        <th>Registado</th>
                        <th>Produtos</th>
                        <th>Notificações</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td><code style="background: #232326; padding: 0.25rem 0.5rem; border-radius: 4px; color: #ff9800;">${escapeHtml(user.ReferenciaID || 'N/A')}</code></td>
                            <td>${escapeHtml(user.Nome || 'N/A')}</td>
                            <td>${escapeHtml(user.Email || 'N/A')}</td>
                            <td>${formatDate(user.DataRegisto)}</td>
                            <td>${user.produtosCount || 0}</td>
                            <td>${user.notificacoesCount || 0}</td>
                            <td>
                                <span style="color: ${user.Ativo ? '#86efac' : '#fca5a5'}">
                                    ${user.Ativo ? 'Ativo' : 'Inativo'}
                                </span>
                            </td>
                            <td>
                                <button class="edit-user-btn" data-referencia="${escapeHtml(user.ReferenciaID)}" title="Editar utilizador">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const referenciaID = btn.dataset.referencia;
                openEditModal(referenciaID, cachedUsers);
            });
        });
    }

    function applyFilter(filterKey) {
        const filtered = filterUsers(cachedUsers, filterKey);
        renderUsersTable(filtered);

        document.querySelectorAll('.filter-tabs .tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filterKey);
        });
    }

    async function loadUsers() {
        const usersList = document.getElementById('usersList');
        if (!usersList) return;

        try {
            usersList.innerHTML = '<div class="loading-state">Carregando utilizadores...</div>';

            const response = await fetchAuth('/api/admin/users?limit=50');
            const data = await response.json();

            if (!data.users || data.users.length === 0) {
                cachedUsers = [];
                usersList.innerHTML = '<div class="loading-state">Nenhum utilizador encontrado</div>';
                return;
            }

            cachedUsers = data.users;
            const currentFilter = document.querySelector('.filter-tabs .tab-button.active')?.dataset.filter || 'todos';
            applyFilter(currentFilter);
        } catch (error) {
            console.error('Erro ao carregar utilizadores:', error);
            usersList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    function openEditModal(referenciaID, users) {
        const user = users.find(u => u.ReferenciaID === referenciaID);
        if (!user) {
            showAlert('Utilizador não encontrado');
            return;
        }

        document.getElementById('editReferenciaID').value = user.ReferenciaID || '';
        document.getElementById('editNome').value = user.Nome || '';
        document.getElementById('editEmail').value = user.Email || '';
        document.getElementById('editAtivo').value = user.Ativo ? '1' : '0';
        document.getElementById('editEmailVerificado').value = user.EmailVerificado ? '1' : '0';

        const modal = document.getElementById('editUserModal');
        if (modal) modal.classList.add('show');
    }

    function closeEditModal() {
        const modal = document.getElementById('editUserModal');
        const form = document.getElementById('editUserForm');
        if (modal) modal.classList.remove('show');
        if (form) form.reset();
    }

    async function updateUser() {
        const referenciaID = document.getElementById('editReferenciaID').value;
        const nome = document.getElementById('editNome').value.trim();
        const email = document.getElementById('editEmail').value.trim();
        const ativo = document.getElementById('editAtivo').value === '1';
        const emailVerificado = document.getElementById('editEmailVerificado').value === '1';

        if (!nome || !email) {
            showAlert('Por favor, preencha nome e email');
            return;
        }

        try {
            const response = await fetchAuth(`/api/admin/users/${referenciaID}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    Nome: nome,
                    Email: email,
                    Ativo: ativo,
                    EmailVerificado: emailVerificado
                })
            });

            const data = await response.json();

            showAlert('Utilizador atualizado com sucesso!');
            closeEditModal();
            await loadUsers();
        } catch (error) {
            console.error('[UTILIZADORES] Erro ao atualizar utilizador:', error);
            showAlert(`Erro ao atualizar utilizador: ${error.message}`);
        }
    }

    async function exportUsersPDF() {
        try {
            const exportBtn = document.getElementById('exportPDFBtn');
            if (exportBtn) {
                exportBtn.disabled = true;
                exportBtn.textContent = 'Gerando PDF...';
            }

            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl('/api/admin/users/export/pdf') : `${API_BASE}/api/admin/users/export/pdf`;
            const response = await fetch(safeUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${TOKEN}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
                throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
            }

            // Obter o blob do PDF
            const blob = await response.blob();
            
            // Criar link de download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `utilizadores_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            console.log('[UTILIZADORES] PDF exportado com sucesso');
        } catch (error) {
            console.error('[UTILIZADORES] Erro ao exportar PDF:', error);
            showAlert(`Erro ao exportar PDF: ${error.message}`);
        } finally {
            const exportBtn = document.getElementById('exportPDFBtn');
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 0.5rem;">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Exportar PDF
                `;
            }
        }
    }

    function init() {
        if (!checkAuth()) return;

        const refreshBtn = document.getElementById('refreshUsersBtn');
        const exportPDFBtn = document.getElementById('exportPDFBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const editUserForm = document.getElementById('editUserForm');
        const closeEditUserModal = document.getElementById('closeEditUserModal');
        const cancelEditUserBtn = document.getElementById('cancelEditUserBtn');
        const editUserModal = document.getElementById('editUserModal');

        if (refreshBtn) refreshBtn.addEventListener('click', loadUsers);
        if (exportPDFBtn) exportPDFBtn.addEventListener('click', exportUsersPDF);

        document.querySelectorAll('.filter-tabs .tab-button').forEach(btn => {
            btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
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

        if (editUserForm) {
            editUserForm.addEventListener('submit', (e) => {
                e.preventDefault();
                updateUser();
            });
        }

        if (closeEditUserModal) {
            closeEditUserModal.addEventListener('click', closeEditModal);
        }

        if (cancelEditUserBtn) {
            cancelEditUserBtn.addEventListener('click', closeEditModal);
        }

        if (editUserModal) {
            editUserModal.addEventListener('click', (e) => {
                if (e.target === editUserModal) {
                    closeEditModal();
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