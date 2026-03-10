/**
 * Sugestões - PromoPing Admin
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
            console.error(`[SUGESTOES] Erro:`, error);
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

    function getStatusLabel(status) {
        const labels = {
            'pendente': 'Pendente',
            'em-analise': 'Em Análise',
            'aprovada': 'Aprovada',
            'em-desenvolvimento': 'Em Desenvolvimento',
            'implementada': 'Implementada',
            'rejeitada': 'Rejeitada'
        };
        return labels[status] || status;
    }

    function getPlataformaLabel(plataforma) {
        const labels = {
            'site': 'Site',
            'bot': 'Bot Discord',
            'ambos': 'Ambos'
        };
        return labels[plataforma] || plataforma;
    }

    async function loadSugestoes() {
        const sugestoesList = document.getElementById('sugestoesList');
        if (!sugestoesList) return;

        try {
            sugestoesList.innerHTML = '<div class="loading-state">Carregando sugestões...</div>';

            const response = await fetchAuth('/api/admin/sugestoes');
            const data = await response.json();

            if (!data.sugestoes || data.sugestoes.length === 0) {
                sugestoesList.innerHTML = '<div class="loading-state">Nenhuma sugestão encontrada</div>';
                return;
            }

            sugestoesList.innerHTML = data.sugestoes.map(sugestao => `
                <div class="bug-item" data-sugestao-id="${sugestao.Id}" style="cursor: pointer;">
                    <div class="bug-header">
                        <h3 class="bug-title">${escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(sugestao.Titulo)) || sugestao.Titulo || 'Sem título')}</h3>
                        <span class="bug-status ${sugestao.Status || 'pendente'}">${getStatusLabel(sugestao.Status || 'pendente')}</span>
                    </div>
                    <p class="bug-description">${escapeHtml((sugestao.Descricao || 'Sem descrição').substring(0, 200))}${sugestao.Descricao && sugestao.Descricao.length > 200 ? '...' : ''}</p>
                    <div class="bug-meta">
                        <span>Plataforma: ${getPlataformaLabel(sugestao.Plataforma || 'ambos')}</span>
                        <span>Prioridade: ${sugestao.Prioridade || 'medium'}</span>
                        <span>Criado: ${formatDate(sugestao.DataCriacao)}</span>
                    </div>
                </div>
            `).join('');

            // Adicionar event listeners para clicar nas sugestões
            document.querySelectorAll('.bug-item[data-sugestao-id]').forEach(item => {
                item.addEventListener('click', async (e) => {
                    if (e.target.tagName === 'BUTTON') return;
                    
                    const sugestaoId = item.getAttribute('data-sugestao-id');
                    if (sugestaoId) {
                        await viewSugestaoDetails(sugestaoId);
                    }
                });
            });
        } catch (error) {
            console.error('[SUGESTOES] Erro ao carregar sugestões:', error);
            sugestoesList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    async function createSugestao() {
        const sugestaoTitle = document.getElementById('sugestaoTitle');
        const sugestaoDescription = document.getElementById('sugestaoDescription');
        const sugestaoPlataforma = document.getElementById('sugestaoPlataforma');
        const sugestaoPriority = document.getElementById('sugestaoPriority');
        const sugestaoStatus = document.getElementById('sugestaoStatus');

        if (!sugestaoTitle || !sugestaoDescription || !sugestaoPlataforma || !sugestaoPriority || !sugestaoStatus) {
            showAlert('Erro: Elementos do formulário não encontrados');
            return;
        }

        const formData = {
            titulo: sugestaoTitle.value.trim(),
            descricao: sugestaoDescription.value.trim(),
            plataforma: sugestaoPlataforma.value,
            prioridade: sugestaoPriority.value,
            status: sugestaoStatus.value
        };

        if (!formData.titulo || !formData.descricao) {
            showAlert('Por favor, preencha título e descrição');
            return;
        }

        try {
            const response = await fetchAuth('/api/admin/sugestoes', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            showAlert('Sugestão criada com sucesso!');
            closeSugestaoModal();
            await loadSugestoes();
        } catch (error) {
            console.error('[SUGESTOES] Erro ao criar sugestão:', error);
            showAlert(`Erro ao criar sugestão: ${error.message}`);
        }
    }

    let currentSugestaoId = null;
    /** Dados da sugestão em visualização (para Editar e Atualizar estado) */
    let currentSugestaoData = null;

    /** Abre o modal de visualização (só leitura); ao clicar numa sugestão. */
    async function viewSugestaoDetails(sugestaoId) {
        try {
            const response = await fetchAuth(`/api/admin/sugestoes/${sugestaoId}`);
            const data = await response.json();

            if (!data.sugestao) {
                showAlert('Sugestão não encontrada');
                return;
            }

            const sugestao = data.sugestao;
            currentSugestaoId = sugestao.Id;
            currentSugestaoData = sugestao;

            document.getElementById('sugestaoViewModalTitle').textContent = `Sugestão #${sugestao.Id}`;
            document.getElementById('sugestaoViewTitulo').textContent = sugestao.Titulo || '—';
            document.getElementById('sugestaoViewDescricao').textContent = sugestao.Descricao || '—';
            document.getElementById('sugestaoViewPlataforma').textContent = getPlataformaLabel(sugestao.Plataforma || 'ambos');
            document.getElementById('sugestaoViewPrioridade').textContent = sugestao.Prioridade || 'medium';
            const statusEl = document.getElementById('sugestaoViewStatus');
            statusEl.textContent = getStatusLabel(sugestao.Status || 'pendente');
            statusEl.className = 'bug-status ' + (sugestao.Status || 'pendente');
            document.getElementById('sugestaoViewData').textContent = formatDate(sugestao.DataCriacao);

            document.getElementById('sugestaoViewModal').classList.add('show');
        } catch (error) {
            console.error('[SUGESTOES] Erro ao carregar detalhes da sugestão:', error);
            showAlert(`Erro ao carregar detalhes: ${error.message}`);
        }
    }

    function closeSugestaoViewModal() {
        document.getElementById('sugestaoViewModal').classList.remove('show');
        currentSugestaoData = null;
    }

    /** Abre o modal de atualizar estado (como tabelas/incidentes). */
    function openSugestaoStatusModal() {
        if (!currentSugestaoData) return;
        document.getElementById('sugestaoStatusId').value = currentSugestaoData.Id;
        document.getElementById('sugestaoStatusSelect').value = currentSugestaoData.Status || 'pendente';
        document.getElementById('sugestaoStatusModal').classList.add('show');
    }

    function closeSugestaoStatusModal() {
        document.getElementById('sugestaoStatusModal').classList.remove('show');
    }

    async function submitSugestaoStatus(e) {
        e.preventDefault();
        const id = document.getElementById('sugestaoStatusId').value;
        const newStatus = document.getElementById('sugestaoStatusSelect').value;
        if (!id || !currentSugestaoData) return;
        try {
            await fetchAuth(`/api/admin/sugestoes/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    titulo: (window.APIUtils && window.APIUtils.stripBracketPrefix(currentSugestaoData.Titulo)) || currentSugestaoData.Titulo || '',
                    descricao: currentSugestaoData.Descricao || '',
                    plataforma: currentSugestaoData.Plataforma || 'ambos',
                    prioridade: currentSugestaoData.Prioridade || 'medium',
                    status: newStatus
                })
            });
            closeSugestaoStatusModal();
            closeSugestaoViewModal();
            await loadSugestoes();
            showAlert('Estado da sugestão atualizado.');
        } catch (error) {
            console.error('[SUGESTOES] Erro ao atualizar estado:', error);
            showAlert(`Erro: ${error.message}`);
        }
    }

    /** Abre o modal de edição com os dados da sugestão em visualização. */
    function openEditSugestaoFromView() {
        if (!currentSugestaoData) return;
        const s = currentSugestaoData;
        closeSugestaoViewModal();
        document.getElementById('sugestaoId').value = s.Id;
        document.getElementById('sugestaoTitle').value = (window.APIUtils && window.APIUtils.stripBracketPrefix(s.Titulo)) || s.Titulo || '';
        document.getElementById('sugestaoDescription').value = s.Descricao || '';
        document.getElementById('sugestaoPlataforma').value = s.Plataforma || 'ambos';
        document.getElementById('sugestaoPriority').value = s.Prioridade || 'medium';
        document.getElementById('sugestaoStatus').value = s.Status || 'pendente';
        document.getElementById('sugestaoModalTitle').textContent = `Editar Sugestão #${s.Id}`;
        document.getElementById('sugestaoSubmitBtn').textContent = 'Salvar Alterações';
        document.getElementById('deleteSugestaoBtn').style.display = 'inline-block';
        document.getElementById('sugestaoModal').classList.add('show');
    }

    async function updateSugestao() {
        const sugestaoId = document.getElementById('sugestaoId').value;
        if (!sugestaoId) {
            await createSugestao();
            return;
        }

        const sugestaoTitle = document.getElementById('sugestaoTitle');
        const sugestaoDescription = document.getElementById('sugestaoDescription');
        const sugestaoPlataforma = document.getElementById('sugestaoPlataforma');
        const sugestaoPriority = document.getElementById('sugestaoPriority');
        const sugestaoStatus = document.getElementById('sugestaoStatus');

        const formData = {
            titulo: sugestaoTitle.value.trim(),
            descricao: sugestaoDescription.value.trim(),
            plataforma: sugestaoPlataforma.value,
            prioridade: sugestaoPriority.value,
            status: sugestaoStatus.value
        };

        if (!formData.titulo || !formData.descricao) {
            showAlert('Por favor, preencha título e descrição');
            return;
        }

        try {
            const response = await fetchAuth(`/api/admin/sugestoes/${sugestaoId}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            showAlert('Sugestão atualizada com sucesso!');
            closeSugestaoModal();
            await loadSugestoes();
        } catch (error) {
            console.error('[SUGESTOES] Erro ao atualizar sugestão:', error);
            showAlert(`Erro ao atualizar sugestão: ${error.message}`);
        }
    }

    async function deleteSugestao() {
        const sugestaoId = document.getElementById('sugestaoId').value;
        if (!sugestaoId) return;

        showConfirm('Tem certeza que deseja remover esta sugestão? Esta ação não pode ser desfeita.', { title: 'Remover sugestão', confirmText: 'Remover' }, async () => {
        try {
            const response = await fetchAuth(`/api/admin/sugestoes/${sugestaoId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            showAlert('Sugestão removida com sucesso!');
            closeSugestaoModal();
            await loadSugestoes();
        } catch (error) {
            console.error('[SUGESTOES] Erro ao remover sugestão:', error);
            showAlert(`Erro ao remover sugestão: ${error.message}`);
        }
        });
    }

    function closeSugestaoModal() {
        const modal = document.getElementById('sugestaoModal');
        const form = document.getElementById('sugestaoForm');

        if (modal) modal.classList.remove('show');
        if (form) form.reset();
        
        // Resetar estado
        currentSugestaoId = null;
        document.getElementById('sugestaoId').value = '';
        document.getElementById('sugestaoModalTitle').textContent = 'Nova Sugestão';
        document.getElementById('sugestaoSubmitBtn').textContent = 'Criar Sugestão';
        document.getElementById('deleteSugestaoBtn').style.display = 'none';
    }

    function init() {
        if (!checkAuth()) return;

        const newSugestaoBtn = document.getElementById('newSugestaoBtn');
        const closeSugestaoModalBtn = document.getElementById('closeSugestaoModal');
        const cancelSugestaoBtn = document.getElementById('cancelSugestaoBtn');
        const sugestaoForm = document.getElementById('sugestaoForm');
        const logoutBtn = document.getElementById('logoutBtn');
        const sugestaoModal = document.getElementById('sugestaoModal');
        const sugestaoViewModal = document.getElementById('sugestaoViewModal');
        const sugestaoStatusForm = document.getElementById('sugestaoStatusForm');

        if (newSugestaoBtn) {
            newSugestaoBtn.addEventListener('click', () => {
                closeSugestaoModal();
                closeSugestaoViewModal();
                if (sugestaoModal) sugestaoModal.classList.add('show');
            });
        }

        if (closeSugestaoModalBtn) closeSugestaoModalBtn.addEventListener('click', closeSugestaoModal);
        if (cancelSugestaoBtn) cancelSugestaoBtn.addEventListener('click', closeSugestaoModal);

        if (sugestaoModal) {
            sugestaoModal.addEventListener('click', (e) => {
                if (e.target === sugestaoModal) closeSugestaoModal();
            });
        }

        const closeSugestaoViewModalBtn = document.getElementById('closeSugestaoViewModal');
        const closeSugestaoViewBtn = document.getElementById('closeSugestaoViewBtn');
        const sugestaoViewAtualizarEstadoBtn = document.getElementById('sugestaoViewAtualizarEstadoBtn');
        const sugestaoViewEditarBtn = document.getElementById('sugestaoViewEditarBtn');
        if (closeSugestaoViewModalBtn) closeSugestaoViewModalBtn.addEventListener('click', closeSugestaoViewModal);
        if (closeSugestaoViewBtn) closeSugestaoViewBtn.addEventListener('click', closeSugestaoViewModal);
        if (sugestaoViewAtualizarEstadoBtn) sugestaoViewAtualizarEstadoBtn.addEventListener('click', openSugestaoStatusModal);
        if (sugestaoViewEditarBtn) sugestaoViewEditarBtn.addEventListener('click', openEditSugestaoFromView);
        if (sugestaoViewModal) {
            sugestaoViewModal.addEventListener('click', (e) => {
                if (e.target === sugestaoViewModal) closeSugestaoViewModal();
            });
        }

        const closeSugestaoStatusModalBtn = document.getElementById('closeSugestaoStatusModal');
        const cancelSugestaoStatusBtn = document.getElementById('cancelSugestaoStatusBtn');
        if (closeSugestaoStatusModalBtn) closeSugestaoStatusModalBtn.addEventListener('click', closeSugestaoStatusModal);
        if (cancelSugestaoStatusBtn) cancelSugestaoStatusBtn.addEventListener('click', closeSugestaoStatusModal);
        if (sugestaoStatusForm) sugestaoStatusForm.addEventListener('submit', submitSugestaoStatus);

        if (sugestaoForm) {
            sugestaoForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await updateSugestao();
            });
        }

        const deleteSugestaoBtn = document.getElementById('deleteSugestaoBtn');
        if (deleteSugestaoBtn) {
            deleteSugestaoBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await deleteSugestao();
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                showConfirm('Tem certeza que deseja sair?', 'Sair', () => {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                });
            });
        }

        loadSugestoes();
        console.log('[SUGESTOES] Página de sugestões inicializada');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
