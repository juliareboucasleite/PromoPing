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
                const text = await response.text();
                throw new Error(`Resposta inválida do servidor (${response.status})`);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error(`[BUGS] Erro:`, error);
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
                <div class="bug-item" data-bug-id="${bug.Id}" style="cursor: pointer;">
                    <div class="bug-header">
                        <h3 class="bug-title">${escapeHtml(bug.Titulo || 'Sem título')}</h3>
                        <span class="bug-status ${bug.Status || 'open'}">${bug.Status || 'open'}</span>
                    </div>
                    <p class="bug-description">${escapeHtml((bug.Descricao || 'Sem descrição').substring(0, 200))}${bug.Descricao && bug.Descricao.length > 200 ? '...' : ''}</p>
                    <div class="bug-meta">
                        <span>Tipo: ${bug.Tipo || 'bug'}</span>
                        <span>Prioridade: ${bug.Prioridade || 'medium'}</span>
                        <span>Criado: ${formatDate(bug.DataCriacao)}</span>
                    </div>
                </div>
            `).join('');

            // Adicionar event listeners para clicar nos bugs
            document.querySelectorAll('.bug-item').forEach(item => {
                item.addEventListener('click', async (e) => {
                    // Não abrir se clicar em botões dentro do item
                    if (e.target.tagName === 'BUTTON') return;
                    
                    const bugId = item.getAttribute('data-bug-id');
                    if (bugId) {
                        await viewBugDetails(bugId);
                    }
                });
            });
        } catch (error) {
            console.error('[BUGS] Erro ao carregar bugs:', error);
            bugsList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

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

            alert('Bug/Projeto criado com sucesso!');
            closeBugModal();
            await loadBugs();
        } catch (error) {
            console.error('[BUGS] Erro ao criar bug:', error);
            alert(`Erro ao criar bug: ${error.message}`);
        }
    }

    let currentBugId = null;

    async function viewBugDetails(bugId) {
        try {
            const response = await fetchAuth(`/api/admin/bugs/${bugId}`);
            const data = await response.json();

            if (!data.bug) {
                alert('Bug não encontrado');
                return;
            }

            const bug = data.bug;
            currentBugId = bug.Id;

            // Preencher formulário
            document.getElementById('bugId').value = bug.Id;
            document.getElementById('bugTitle').value = bug.Titulo || '';
            document.getElementById('bugDescription').value = bug.Descricao || '';
            document.getElementById('bugType').value = bug.Tipo || 'bug';
            document.getElementById('bugPriority').value = bug.Prioridade || 'medium';
            document.getElementById('bugStatus').value = bug.Status || 'open';

            // Atualizar título do modal e botões
            document.getElementById('bugModalTitle').textContent = `Editar Bug / Projeto #${bug.Id}`;
            document.getElementById('bugSubmitBtn').textContent = 'Salvar Alterações';
            document.getElementById('deleteBugBtn').style.display = 'inline-block';

            // Mostrar modal
            document.getElementById('bugModal').classList.add('show');
        } catch (error) {
            console.error('[BUGS] Erro ao carregar detalhes do bug:', error);
            alert(`Erro ao carregar detalhes: ${error.message}`);
        }
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

        if (!formData.titulo || !formData.descricao) {
            alert('Por favor, preencha título e descrição');
            return;
        }

        try {
            const response = await fetchAuth(`/api/admin/bugs/${bugId}`, {
                method: 'PUT',
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            alert('Bug/Projeto atualizado com sucesso!');
            closeBugModal();
            await loadBugs();
        } catch (error) {
            console.error('[BUGS] Erro ao atualizar bug:', error);
            alert(`Erro ao atualizar bug: ${error.message}`);
        }
    }

    async function deleteBug() {
        const bugId = document.getElementById('bugId').value;
        if (!bugId) return;

        if (!confirm('Tem certeza que deseja remover este bug/projeto? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            const response = await fetchAuth(`/api/admin/bugs/${bugId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            alert('Bug/Projeto removido com sucesso!');
            closeBugModal();
            await loadBugs();
        } catch (error) {
            console.error('[BUGS] Erro ao remover bug:', error);
            alert(`Erro ao remover bug: ${error.message}`);
        }
    }

    function closeBugModal() {
        const modal = document.getElementById('bugModal');
        const form = document.getElementById('bugForm');

        if (modal) modal.classList.remove('show');
        if (form) form.reset();
        
        // Resetar estado
        currentBugId = null;
        document.getElementById('bugId').value = '';
        document.getElementById('bugModalTitle').textContent = 'Novo Bug / Projeto';
        document.getElementById('bugSubmitBtn').textContent = 'Criar Bug/Projeto';
        document.getElementById('deleteBugBtn').style.display = 'none';
    }

    function init() {
        if (!checkAuth()) return;

        const newBugBtn = document.getElementById('newBugBtn');
        const closeBugModalBtn = document.getElementById('closeBugModal');
        const cancelBugBtn = document.getElementById('cancelBugBtn');
        const bugForm = document.getElementById('bugForm');
        const logoutBtn = document.getElementById('logoutBtn');
        const bugModal = document.getElementById('bugModal');

        if (newBugBtn) {
            newBugBtn.addEventListener('click', () => {
                // Resetar formulário para criar novo bug
                closeBugModal();
                if (bugModal) bugModal.classList.add('show');
            });
        }

        if (closeBugModalBtn) closeBugModalBtn.addEventListener('click', closeBugModal);
        if (cancelBugBtn) cancelBugBtn.addEventListener('click', closeBugModal);

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
                if (confirm('Tem certeza que deseja sair?')) {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                }
            });
        }

        loadBugs();
        console.log('[BUGS] Página de bugs inicializada');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();