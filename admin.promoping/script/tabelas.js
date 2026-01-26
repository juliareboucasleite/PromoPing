/**
 * Tabelas - PromoPing Admin
 * Gerenciamento de Incidentes e Atualizações
 */

(function() {
    'use strict';

    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = localStorage.getItem('PROMOPING_TOKEN');

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
                console.error(`[TABELAS] Resposta não-JSON de ${url}:`, text.substring(0, 200));
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
            console.error(`[TABELAS] Erro ao fazer requisição para ${url}:`, error);
            throw new Error(`Erro de conexão: ${error.message}`);
        }
    }

    /**
     * Formatar data
     */
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
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
     * Carregar incidentes
     */
    async function loadIncidents() {
        const incidentsList = document.getElementById('incidentsList');
        if (!incidentsList) return;

        try {
            incidentsList.innerHTML = '<div class="loading-state">Carregando incidentes...</div>';

            const response = await fetchAuth('/api/admin/incidents');
            const data = await response.json();

            console.log('[TABELAS] Dados de incidentes recebidos:', data);

            if (!data || data.status !== 'ok') {
                throw new Error((data && data.error) ? data.error : 'Erro ao carregar incidentes');
            }

            if (!data.incidents || data.incidents.length === 0) {
                incidentsList.innerHTML = '<div class="loading-state">Nenhum incidente encontrado</div>';
                return;
            }

            incidentsList.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Descrição</th>
                            <th>Componente</th>
                            <th>Status</th>
                            <th>Data Início</th>
                            <th>Data Fim</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.incidents.map(incident => `
                            <tr>
                                <td>${escapeHtml(incident.Titulo || 'N/A')}</td>
                                <td>${escapeHtml((incident.Descricao || '').substring(0, 100))}${incident.Descricao && incident.Descricao.length > 100 ? '...' : ''}</td>
                                <td>${escapeHtml(incident.ComponenteAfetado || 'N/A')}</td>
                                <td>
                                    <span class="bug-status ${incident.Status}">${incident.Status}</span>
                                </td>
                                <td>${formatDate(incident.DataInicio)}</td>
                                <td>${incident.DataFim ? formatDate(incident.DataFim) : 'Em andamento'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            console.error('[TABELAS] Erro ao carregar incidentes:', error);
            incidentsList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    /**
     * Carregar atualizações
     */
    async function loadUpdates() {
        const updatesList = document.getElementById('updatesList');
        if (!updatesList) return;

        try {
            updatesList.innerHTML = '<div class="loading-state">Carregando atualizações...</div>';

            const response = await fetchAuth('/api/admin/updates');
            const data = await response.json();

            if (!data || data.status !== 'ok') {
                throw new Error((data && data.error) ? data.error : 'Erro ao carregar atualizações');
            }

            if (!data.updates || data.updates.length === 0) {
                updatesList.innerHTML = '<div class="loading-state">Nenhuma atualização encontrada</div>';
                return;
            }

            updatesList.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Descrição</th>
                            <th>Tipo</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.updates.map(update => `
                            <tr>
                                <td>${escapeHtml(update.Titulo || 'N/A')}</td>
                                <td>${escapeHtml((update.Descricao || '').substring(0, 150))}${update.Descricao && update.Descricao.length > 150 ? '...' : ''}</td>
                                <td>
                                    <span style="padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.8rem; background: rgba(255, 152, 0, 0.2); color: #fcd34d;">
                                        ${update.Tipo || 'feature'}
                                    </span>
                                </td>
                                <td>${formatDate(update.DataCriacao)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            console.error('[TABELAS] Erro ao carregar atualizações:', error);
            updatesList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    /**
     * Criar incidente
     */
    async function createIncident(formData) {
        try {
            const response = await fetchAuth('/api/admin/incidents', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            alert('Incidente criado com sucesso!');
            closeIncidentModal();
            loadIncidents();
        } catch (error) {
            console.error('[TABELAS] Erro ao criar incidente:', error);
            alert(`Erro ao criar incidente: ${error.message}`);
        }
    }

    /**
     * Criar atualização
     */
    async function createUpdate(formData) {
        try {
            const response = await fetchAuth('/api/admin/updates', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            alert('Atualização criada com sucesso!');
            closeUpdateModal();
            loadUpdates();
        } catch (error) {
            console.error('[TABELAS] Erro ao criar atualização:', error);
            alert(`Erro ao criar atualização: ${error.message}`);
        }
    }

    /**
     * Modais
     */
    function showIncidentModal() {
        const modal = document.getElementById('incidentModal');
        if (modal) modal.classList.add('show');
    }

    function closeIncidentModal() {
        const modal = document.getElementById('incidentModal');
        if (modal) modal.classList.remove('show');
        const form = document.getElementById('incidentForm');
        if (form) form.reset();
    }

    function showUpdateModal() {
        const modal = document.getElementById('updateModal');
        if (modal) modal.classList.add('show');
    }

    function closeUpdateModal() {
        const modal = document.getElementById('updateModal');
        if (modal) modal.classList.remove('show');
        const form = document.getElementById('updateForm');
        if (form) form.reset();
    }

    /**
     * Tabs
     */
    function switchTab(tab) {
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            }
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const content = document.getElementById(`${tab}Tab`);
        if (content) content.classList.add('active');

        if (tab === 'incidents') {
            loadIncidents();
        } else if (tab === 'updates') {
            loadUpdates();
        }
    }

    /**
     * Inicialização
     */
    function init() {
        console.log('[TABELAS] Iniciando sistema de tabelas...');
        if (!checkAuth()) {
            console.log('[TABELAS] Usuário não autenticado, redirecionando...');
            return;
        }

        console.log('[TABELAS] Usuário autenticado, continuando inicialização...');

        // Event listeners
        const newIncidentBtn = document.getElementById('newIncidentBtn');
        const newUpdateBtn = document.getElementById('newUpdateBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const closeIncidentModalBtn = document.getElementById('closeIncidentModal');
        const closeUpdateModalBtn = document.getElementById('closeUpdateModal');
        const cancelIncidentBtn = document.getElementById('cancelIncidentBtn');
        const cancelUpdateBtn = document.getElementById('cancelUpdateBtn');
        const incidentForm = document.getElementById('incidentForm');
        const updateForm = document.getElementById('updateForm');

        if (newIncidentBtn) newIncidentBtn.addEventListener('click', showIncidentModal);
        if (newUpdateBtn) newUpdateBtn.addEventListener('click', showUpdateModal);
        if (refreshBtn) refreshBtn.addEventListener('click', () => {
            const activeTab = document.querySelector('.tab-button.active');
            if (activeTab) switchTab(activeTab.dataset.tab);
        });
        if (logoutBtn) logoutBtn.addEventListener('click', () => {
            if (confirm('Tem certeza que deseja sair?')) {
                localStorage.removeItem('PROMOPING_TOKEN');
                localStorage.removeItem('PROMOPING_USER');
                window.location.href = 'login.html';
            }
        });

        if (closeIncidentModalBtn) closeIncidentModalBtn.addEventListener('click', closeIncidentModal);
        if (closeUpdateModalBtn) closeUpdateModalBtn.addEventListener('click', closeUpdateModal);
        if (cancelIncidentBtn) cancelIncidentBtn.addEventListener('click', closeIncidentModal);
        if (cancelUpdateBtn) cancelUpdateBtn.addEventListener('click', closeUpdateModal);

        if (incidentForm) {
            incidentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = {
                    titulo: document.getElementById('incidentTitle').value,
                    descricao: document.getElementById('incidentDescription').value,
                    componenteAfetado: document.getElementById('incidentComponent').value,
                    status: document.getElementById('incidentStatus').value
                };
                createIncident(formData);
            });
        }

        if (updateForm) {
            updateForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = {
                    titulo: document.getElementById('updateTitle').value,
                    descricao: document.getElementById('updateDescription').value,
                    tipo: document.getElementById('updateType').value
                };
                createUpdate(formData);
            });
        }

        // Tabs
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', () => {
                switchTab(btn.dataset.tab);
            });
        });

        // Carregar dados iniciais
        switchTab('incidents');

        console.log('[TABELAS] Sistema de tabelas inicializado');
    }

    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();