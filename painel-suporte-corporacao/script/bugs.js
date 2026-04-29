/**
 * Bugs & Projetos - PromoPing Admin
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
            console.error('[BUGS] Erro:', error);
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

    function getTipoLabel(tipo) {
        const labels = {
            bug: 'Bug',
            projeto: 'Projeto Secundario',
            melhoria: 'Melhoria'
        };
        return labels[tipo] || tipo || 'N/A';
    }

    function getStatusLabel(status) {
        const labels = {
            open: 'Aberto',
            'in-progress': 'Em Progresso',
            resolved: 'Resolvido',
            closed: 'Fechado'
        };
        return labels[status] || status || 'N/A';
    }

    let allBugs = [];
    let currentTab = 'bugs';
    let currentBugId = null;
    let currentBugData = null;

    function renderBugList(items, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!items || items.length === 0) {
            container.innerHTML = '<div class="loading-state">Nenhum registo encontrado</div>';
            return;
        }

        container.innerHTML = items.map((bug) => `
            <div class="bug-item" data-bug-id="${bug.Id}" style="cursor: pointer;">
                <div class="bug-header">
                    <h3 class="bug-title">${escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(bug.Titulo)) || bug.Titulo || 'Sem titulo')}</h3>
                    <span class="bug-status ${bug.Status || 'open'}">${getStatusLabel(bug.Status || 'open')}</span>
                </div>
                <p class="bug-description">${escapeHtml((bug.Descricao || 'Sem descricao').substring(0, 200))}${bug.Descricao && bug.Descricao.length > 200 ? '...' : ''}</p>
                <div class="bug-meta">
                    <span>Tipo: ${getTipoLabel(bug.Tipo || 'bug')}</span>
                    <span>Prioridade: ${bug.Prioridade || 'medium'}</span>
                    <span>Criado: ${formatDate(bug.DataCriacao)}</span>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.bug-item[data-bug-id]').forEach((item) => {
            item.addEventListener('click', async (e) => {
                if (e.target.tagName === 'BUTTON') return;
                const bugId = item.getAttribute('data-bug-id');
                if (bugId) await viewBugDetails(bugId);
            });
        });
    }

    function switchTab(tab) {
        currentTab = tab;

        document.querySelectorAll('.tab-button').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        document.querySelectorAll('.tab-content').forEach((content) => {
            content.classList.remove('active');
        });

        const content = document.getElementById(tab === 'bugs' ? 'bugsTab' : 'projetosTab');
        if (content) content.classList.add('active');

        const bugs = allBugs.filter((item) => item.Tipo === 'bug' || item.Tipo === 'melhoria');
        const projetos = allBugs.filter((item) => item.Tipo === 'projeto');
        renderBugList(bugs, 'bugsList');
        renderBugList(projetos, 'projetosList');
    }

    async function loadBugs() {
        const bugsList = document.getElementById('bugsList');
        const projetosList = document.getElementById('projetosList');
        if (!bugsList || !projetosList) return;

        try {
            bugsList.innerHTML = '<div class="loading-state">Carregando bugs...</div>';
            projetosList.innerHTML = '<div class="loading-state">Carregando projetos...</div>';

            const response = await fetchAuth('/api/admin/bugs');
            const data = await response.json();

            allBugs = data.bugs || [];
            switchTab(currentTab);
        } catch (error) {
            console.error('[BUGS] Erro ao carregar bugs:', error);
            bugsList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
            projetosList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    async function createBug() {
        const bugTitle = document.getElementById('bugTitle');
        const bugDescription = document.getElementById('bugDescription');
        const bugType = document.getElementById('bugType');
        const bugPriority = document.getElementById('bugPriority');
        const bugStatus = document.getElementById('bugStatus');

        if (!bugTitle || !bugDescription || !bugType || !bugPriority || !bugStatus) {
            showAlert('Erro: Elementos do formulario nao encontrados');
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
            showAlert('Por favor, preencha titulo e descricao');
            return;
        }

        try {
            const response = await fetchAuth('/api/admin/bugs', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            await response.json();
            showAlert('Bug/Projeto criado com sucesso!');
            closeBugModal();
            await loadBugs();
        } catch (error) {
            console.error('[BUGS] Erro ao criar bug:', error);
            showAlert(`Erro ao criar bug: ${error.message}`);
        }
    }

    async function viewBugDetails(bugId) {
        try {
            const response = await fetchAuth(`/api/admin/bugs/${bugId}`);
            const data = await response.json();

            if (!data.bug) {
                showAlert('Registo nao encontrado');
                return;
            }

            const bug = data.bug;
            currentBugId = bug.Id;
            currentBugData = bug;

            document.getElementById('bugViewModalTitle').textContent = `${bug.Tipo === 'projeto' ? 'Projeto' : 'Bug'} #${bug.Id}`;
            document.getElementById('bugViewTitulo').textContent = (window.APIUtils && window.APIUtils.stripBracketPrefix(bug.Titulo)) || bug.Titulo || '—';
            document.getElementById('bugViewDescricao').textContent = bug.Descricao || '—';
            document.getElementById('bugViewTipo').textContent = getTipoLabel(bug.Tipo || 'bug');
            document.getElementById('bugViewPrioridade').textContent = bug.Prioridade || 'medium';

            const statusEl = document.getElementById('bugViewStatus');
            statusEl.textContent = getStatusLabel(bug.Status || 'open');
            statusEl.className = `bug-status ${bug.Status || 'open'}`;

            document.getElementById('bugViewData').textContent = formatDate(bug.DataCriacao);

            const anexoWrap = document.getElementById('bugViewAnexoWrap');
            const anexoLink = document.getElementById('bugViewAnexo');
            if (bug.AnexoUrl) {
                anexoWrap.style.display = 'block';
                anexoLink.href = bug.AnexoUrl.startsWith('http')
                    ? bug.AnexoUrl
                    : (window.APIUtils ? window.APIUtils.getSafeApiBase() : '') + bug.AnexoUrl;
                anexoLink.textContent = 'Ver anexo';
            } else {
                anexoWrap.style.display = 'none';
            }

            document.getElementById('bugViewModal').classList.add('show');
        } catch (error) {
            console.error('[BUGS] Erro ao carregar detalhes:', error);
            showAlert(`Erro ao carregar detalhes: ${error.message}`);
        }
    }

    function closeBugViewModal() {
        document.getElementById('bugViewModal').classList.remove('show');
        currentBugData = null;
    }

    function openBugStatusModal() {
        if (!currentBugData) return;
        document.getElementById('bugStatusId').value = currentBugData.Id;
        document.getElementById('bugStatusSelect').value = currentBugData.Status || 'open';
        document.getElementById('bugStatusModal').classList.add('show');
    }

    function closeBugStatusModal() {
        document.getElementById('bugStatusModal').classList.remove('show');
    }

    async function submitBugStatus(e) {
        e.preventDefault();
        const id = document.getElementById('bugStatusId').value;
        const newStatus = document.getElementById('bugStatusSelect').value;
        if (!id) return;

        try {
            await fetchAuth(`/api/admin/bugs/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });

            closeBugStatusModal();
            closeBugViewModal();
            await loadBugs();
            showAlert('Estado atualizado.');
        } catch (error) {
            console.error('[BUGS] Erro ao atualizar estado:', error);
            showAlert(`Erro: ${error.message}`);
        }
    }

    function openEditBugFromView() {
        if (!currentBugData) return;

        const bug = currentBugData;
        closeBugViewModal();

        document.getElementById('bugId').value = bug.Id;
        document.getElementById('bugTitle').value = (window.APIUtils && window.APIUtils.stripBracketPrefix(bug.Titulo)) || bug.Titulo || '';
        document.getElementById('bugDescription').value = bug.Descricao || '';
        document.getElementById('bugType').value = bug.Tipo || 'bug';
        document.getElementById('bugPriority').value = bug.Prioridade || 'medium';
        document.getElementById('bugStatus').value = bug.Status || 'open';

        const anexoAtual = document.getElementById('bugAnexoAtual');
        const anexoInput = document.getElementById('bugAnexo');
        if (anexoAtual) anexoAtual.textContent = bug.AnexoUrl ? `Anexo atual: ${bug.AnexoUrl}` : '';
        if (anexoInput) anexoInput.value = '';

        document.getElementById('bugModalTitle').textContent = `Editar Bug / Projeto #${bug.Id}`;
        document.getElementById('bugSubmitBtn').textContent = 'Salvar Alteracoes';
        document.getElementById('deleteBugBtn').style.display = 'inline-block';
        document.getElementById('bugModal').classList.add('show');
    }

    async function updateBug() {
        const bugId = document.getElementById('bugId').value;
        if (!bugId) {
            await createBug();
            return;
        }

        const bugTitle = document.getElementById('bugTitle');
        const bugDescription = document.getElementById('bugDescription');
        const bugType = document.getElementById('bugType');
        const bugPriority = document.getElementById('bugPriority');
        const bugStatus = document.getElementById('bugStatus');

        const formData = {
            titulo: bugTitle.value.trim(),
            descricao: bugDescription.value.trim(),
            tipo: bugType.value,
            prioridade: bugPriority.value,
            status: bugStatus.value
        };

        const anexoInput = document.getElementById('bugAnexo');
        if (anexoInput && anexoInput.files && anexoInput.files[0]) {
            const file = anexoInput.files[0];
            const allowed = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp'
            ];

            if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|jpg|jpeg|png|gif|webp)$/i)) {
                showAlert('Formato nao permitido. Use DOC, DOCX, PDF ou imagem.');
                return;
            }

            try {
                formData.anexo = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                formData.anexoNome = file.name;
            } catch (error) {
                console.error('[BUGS] Erro ao ler anexo:', error);
            }
        }

        if (!formData.titulo || !formData.descricao) {
            showAlert('Por favor, preencha titulo e descricao');
            return;
        }

        try {
            const response = await fetchAuth(`/api/admin/bugs/${bugId}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });

            await response.json();
            showAlert('Bug/Projeto atualizado com sucesso!');
            closeBugModal();
            await loadBugs();
        } catch (error) {
            console.error('[BUGS] Erro ao atualizar bug:', error);
            showAlert(`Erro ao atualizar bug: ${error.message}`);
        }
    }

    async function deleteBug() {
        const bugId = document.getElementById('bugId').value;
        if (!bugId) return;

        showConfirm(
            'Tem certeza que deseja remover este bug/projeto? Esta acao nao pode ser desfeita.',
            { title: 'Remover', confirmText: 'Remover' },
            async () => {
                try {
                    const response = await fetchAuth(`/api/admin/bugs/${bugId}`, {
                        method: 'DELETE'
                    });

                    await response.json();
                    showAlert('Bug/Projeto removido com sucesso!');
                    closeBugModal();
                    await loadBugs();
                } catch (error) {
                    console.error('[BUGS] Erro ao remover bug:', error);
                    showAlert(`Erro ao remover bug: ${error.message}`);
                }
            }
        );
    }

    function closeBugModal() {
        const modal = document.getElementById('bugModal');
        const form = document.getElementById('bugForm');

        if (modal) modal.classList.remove('show');
        if (form) form.reset();

        currentBugId = null;
        document.getElementById('bugId').value = '';
        document.getElementById('bugModalTitle').textContent = 'Novo Bug / Projeto';
        document.getElementById('bugSubmitBtn').textContent = 'Criar Bug/Projeto';
        document.getElementById('deleteBugBtn').style.display = 'none';

        const anexoAtual = document.getElementById('bugAnexoAtual');
        const anexoInput = document.getElementById('bugAnexo');
        if (anexoAtual) anexoAtual.textContent = '';
        if (anexoInput) anexoInput.value = '';
    }

    function init() {
        if (!checkAuth()) return;

        const newBugBtn = document.getElementById('newBugBtn');
        const refreshBugsBtn = document.getElementById('refreshBugsBtn');
        const closeBugModalBtn = document.getElementById('closeBugModal');
        const cancelBugBtn = document.getElementById('cancelBugBtn');
        const bugForm = document.getElementById('bugForm');
        const logoutBtn = document.getElementById('logoutBtn');
        const bugModal = document.getElementById('bugModal');
        const bugViewModal = document.getElementById('bugViewModal');
        const bugStatusForm = document.getElementById('bugStatusForm');

        if (newBugBtn) {
            newBugBtn.addEventListener('click', () => {
                closeBugModal();
                closeBugViewModal();
                if (bugModal) bugModal.classList.add('show');
            });
        }

        if (refreshBugsBtn) refreshBugsBtn.addEventListener('click', loadBugs);

        document.querySelectorAll('.tab-button').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.dataset.tab) switchTab(btn.dataset.tab);
            });
        });

        if (closeBugModalBtn) closeBugModalBtn.addEventListener('click', closeBugModal);
        if (cancelBugBtn) cancelBugBtn.addEventListener('click', closeBugModal);

        if (bugModal) {
            bugModal.addEventListener('click', (e) => {
                if (e.target === bugModal) closeBugModal();
            });
        }

        const closeBugViewModalBtn = document.getElementById('closeBugViewModal');
        const closeBugViewBtn = document.getElementById('closeBugViewBtn');
        const bugViewAtualizarEstadoBtn = document.getElementById('bugViewAtualizarEstadoBtn');
        const bugViewEditarBtn = document.getElementById('bugViewEditarBtn');
        if (closeBugViewModalBtn) closeBugViewModalBtn.addEventListener('click', closeBugViewModal);
        if (closeBugViewBtn) closeBugViewBtn.addEventListener('click', closeBugViewModal);
        if (bugViewAtualizarEstadoBtn) bugViewAtualizarEstadoBtn.addEventListener('click', openBugStatusModal);
        if (bugViewEditarBtn) bugViewEditarBtn.addEventListener('click', openEditBugFromView);

        if (bugViewModal) {
            bugViewModal.addEventListener('click', (e) => {
                if (e.target === bugViewModal) closeBugViewModal();
            });
        }

        const closeBugStatusModalBtn = document.getElementById('closeBugStatusModal');
        const cancelBugStatusBtn = document.getElementById('cancelBugStatusBtn');
        if (closeBugStatusModalBtn) closeBugStatusModalBtn.addEventListener('click', closeBugStatusModal);
        if (cancelBugStatusBtn) cancelBugStatusBtn.addEventListener('click', closeBugStatusModal);
        if (bugStatusForm) bugStatusForm.addEventListener('submit', submitBugStatus);

        if (bugForm) {
            bugForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await updateBug();
            });
        }

        const deleteBugBtn = document.getElementById('deleteBugBtn');
        if (deleteBugBtn) {
            deleteBugBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await deleteBug();
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

        loadBugs();
        console.log('[BUGS] Pagina de bugs inicializada');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
