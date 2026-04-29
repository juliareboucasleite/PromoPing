/**
 * Sugestoes - PromoPing Admin
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
                throw new Error(`Resposta invalida do servidor (${response.status})`);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error('[SUGESTOES] Erro:', error);
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

    function pick(obj, ...keys) {
        for (const key of keys) {
            if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
        }
        return null;
    }

    function getStatusLabel(status) {
        const labels = {
            pendente: 'Pendente',
            'em-analise': 'Em Analise',
            aprovada: 'Aprovada',
            'em-desenvolvimento': 'Em Desenvolvimento',
            implementada: 'Implementada',
            rejeitada: 'Rejeitada'
        };
        return labels[status] || status || 'N/A';
    }

    function getPlataformaLabel(plataforma) {
        const labels = {
            site: 'Site',
            bot: 'Bot Discord',
            ambos: 'Ambos'
        };
        return labels[plataforma] || plataforma || 'N/A';
    }

    let currentSugestaoId = null;
    let currentSugestaoData = null;

    async function loadSugestoes() {
        const sugestoesList = document.getElementById('sugestoesList');
        if (!sugestoesList) return;

        try {
            sugestoesList.innerHTML = '<div class="loading-state">Carregando sugestoes...</div>';

            const response = await fetchAuth('/api/admin/sugestoes');
            const data = await response.json();

            if (!data.sugestoes || data.sugestoes.length === 0) {
                sugestoesList.innerHTML = '<div class="loading-state">Nenhuma sugestao encontrada</div>';
                return;
            }

            sugestoesList.innerHTML = data.sugestoes.map((sugestao) => `
                <div class="bug-item" data-sugestao-id="${pick(sugestao, 'Id', 'id')}" style="cursor: pointer;">
                    <div class="bug-header">
                        <h3 class="bug-title">${escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(pick(sugestao, 'Titulo', 'titulo'))) || pick(sugestao, 'Titulo', 'titulo') || 'Sem titulo')}</h3>
                        <span class="bug-status ${pick(sugestao, 'Status', 'status') || 'pendente'}">${getStatusLabel(pick(sugestao, 'Status', 'status') || 'pendente')}</span>
                    </div>
                    <p class="bug-description">${escapeHtml((pick(sugestao, 'Descricao', 'descricao') || 'Sem descricao').substring(0, 200))}${(pick(sugestao, 'Descricao', 'descricao') || '').length > 200 ? '...' : ''}</p>
                    <div class="bug-meta">
                        <span>Plataforma: ${getPlataformaLabel(pick(sugestao, 'Plataforma', 'plataforma') || 'ambos')}</span>
                        <span>Prioridade: ${pick(sugestao, 'Prioridade', 'prioridade') || 'medium'}</span>
                        <span>Criado: ${formatDate(pick(sugestao, 'DataCriacao', 'datacriacao'))}</span>
                    </div>
                </div>
            `).join('');

            document.querySelectorAll('.bug-item[data-sugestao-id]').forEach((item) => {
                item.addEventListener('click', async (e) => {
                    if (e.target.tagName === 'BUTTON') return;
                    const sugestaoId = item.getAttribute('data-sugestao-id');
                    if (sugestaoId) await viewSugestaoDetails(sugestaoId);
                });
            });
        } catch (error) {
            console.error('[SUGESTOES] Erro ao carregar sugestoes:', error);
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
            showAlert('Erro: Elementos do formulario nao encontrados');
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
            showAlert('Por favor, preencha titulo e descricao');
            return;
        }

        try {
            const response = await fetchAuth('/api/admin/sugestoes', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            await response.json();
            showAlert('Sugestao criada com sucesso!');
            closeSugestaoModal();
            await loadSugestoes();
        } catch (error) {
            console.error('[SUGESTOES] Erro ao criar sugestao:', error);
            showAlert(`Erro ao criar sugestao: ${error.message}`);
        }
    }

    async function viewSugestaoDetails(sugestaoId) {
        try {
            const response = await fetchAuth(`/api/admin/sugestoes/${sugestaoId}`);
            const data = await response.json();

            if (!data.sugestao) {
                showAlert('Sugestao nao encontrada');
                return;
            }

            const sugestao = data.sugestao;
            currentSugestaoId = pick(sugestao, 'Id', 'id');
            currentSugestaoData = sugestao;

            document.getElementById('sugestaoViewModalTitle').textContent = `Sugestao #${pick(sugestao, 'Id', 'id')}`;
            document.getElementById('sugestaoViewTitulo').textContent = pick(sugestao, 'Titulo', 'titulo') || '—';
            document.getElementById('sugestaoViewDescricao').textContent = pick(sugestao, 'Descricao', 'descricao') || '—';
            document.getElementById('sugestaoViewPlataforma').textContent = getPlataformaLabel(pick(sugestao, 'Plataforma', 'plataforma') || 'ambos');
            document.getElementById('sugestaoViewPrioridade').textContent = pick(sugestao, 'Prioridade', 'prioridade') || 'medium';

            const statusEl = document.getElementById('sugestaoViewStatus');
            statusEl.textContent = getStatusLabel(pick(sugestao, 'Status', 'status') || 'pendente');
            statusEl.className = `bug-status ${pick(sugestao, 'Status', 'status') || 'pendente'}`;

            document.getElementById('sugestaoViewData').textContent = formatDate(pick(sugestao, 'DataCriacao', 'datacriacao'));
            document.getElementById('sugestaoViewModal').classList.add('show');
        } catch (error) {
            console.error('[SUGESTOES] Erro ao carregar detalhes da sugestao:', error);
            showAlert(`Erro ao carregar detalhes: ${error.message}`);
        }
    }

    function closeSugestaoViewModal() {
        document.getElementById('sugestaoViewModal').classList.remove('show');
        currentSugestaoData = null;
    }

    function openSugestaoStatusModal() {
        if (!currentSugestaoData) return;
        document.getElementById('sugestaoStatusId').value = pick(currentSugestaoData, 'Id', 'id');
        document.getElementById('sugestaoStatusSelect').value = pick(currentSugestaoData, 'Status', 'status') || 'pendente';
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
                    titulo: (window.APIUtils && window.APIUtils.stripBracketPrefix(pick(currentSugestaoData, 'Titulo', 'titulo'))) || pick(currentSugestaoData, 'Titulo', 'titulo') || '',
                    descricao: pick(currentSugestaoData, 'Descricao', 'descricao') || '',
                    plataforma: pick(currentSugestaoData, 'Plataforma', 'plataforma') || 'ambos',
                    prioridade: pick(currentSugestaoData, 'Prioridade', 'prioridade') || 'medium',
                    status: newStatus
                })
            });

            closeSugestaoStatusModal();
            closeSugestaoViewModal();
            await loadSugestoes();
            showAlert('Estado da sugestao atualizado.');
        } catch (error) {
            console.error('[SUGESTOES] Erro ao atualizar estado:', error);
            showAlert(`Erro: ${error.message}`);
        }
    }

    function openEditSugestaoFromView() {
        if (!currentSugestaoData) return;
        const sugestao = currentSugestaoData;
        closeSugestaoViewModal();

        document.getElementById('sugestaoId').value = pick(sugestao, 'Id', 'id');
        document.getElementById('sugestaoTitle').value = (window.APIUtils && window.APIUtils.stripBracketPrefix(pick(sugestao, 'Titulo', 'titulo'))) || pick(sugestao, 'Titulo', 'titulo') || '';
        document.getElementById('sugestaoDescription').value = pick(sugestao, 'Descricao', 'descricao') || '';
        document.getElementById('sugestaoPlataforma').value = pick(sugestao, 'Plataforma', 'plataforma') || 'ambos';
        document.getElementById('sugestaoPriority').value = pick(sugestao, 'Prioridade', 'prioridade') || 'medium';
        document.getElementById('sugestaoStatus').value = pick(sugestao, 'Status', 'status') || 'pendente';
        document.getElementById('sugestaoModalTitle').textContent = `Editar Sugestao #${pick(sugestao, 'Id', 'id')}`;
        document.getElementById('sugestaoSubmitBtn').textContent = 'Salvar Alteracoes';
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
            showAlert('Por favor, preencha titulo e descricao');
            return;
        }

        try {
            const response = await fetchAuth(`/api/admin/sugestoes/${sugestaoId}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });

            await response.json();
            showAlert('Sugestao atualizada com sucesso!');
            closeSugestaoModal();
            await loadSugestoes();
        } catch (error) {
            console.error('[SUGESTOES] Erro ao atualizar sugestao:', error);
            showAlert(`Erro ao atualizar sugestao: ${error.message}`);
        }
    }

    async function deleteSugestao() {
        const sugestaoId = document.getElementById('sugestaoId').value;
        if (!sugestaoId) return;

        showConfirm(
            'Tem certeza que deseja remover esta sugestao? Esta acao nao pode ser desfeita.',
            { title: 'Remover sugestao', confirmText: 'Remover' },
            async () => {
                try {
                    const response = await fetchAuth(`/api/admin/sugestoes/${sugestaoId}`, {
                        method: 'DELETE'
                    });

                    await response.json();
                    showAlert('Sugestao removida com sucesso!');
                    closeSugestaoModal();
                    await loadSugestoes();
                } catch (error) {
                    console.error('[SUGESTOES] Erro ao remover sugestao:', error);
                    showAlert(`Erro ao remover sugestao: ${error.message}`);
                }
            }
        );
    }

    function closeSugestaoModal() {
        const modal = document.getElementById('sugestaoModal');
        const form = document.getElementById('sugestaoForm');

        if (modal) modal.classList.remove('show');
        if (form) form.reset();

        currentSugestaoId = null;
        document.getElementById('sugestaoId').value = '';
        document.getElementById('sugestaoModalTitle').textContent = 'Nova Sugestao';
        document.getElementById('sugestaoSubmitBtn').textContent = 'Criar Sugestao';
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
        console.log('[SUGESTOES] Pagina de sugestoes inicializada');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
