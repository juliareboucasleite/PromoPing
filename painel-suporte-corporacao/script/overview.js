/**
 * Overview - PromoPing Admin
 * View que conecta o OverviewViewModel ao DOM
 * Implementa padrão MVVM: View conecta ViewModel ao HTML
 */

(function() {
    'use strict';

    let viewModel = null;

    /**
     * Atualiza a View quando o estado do ViewModel muda
     * @param {Object} newState - Novo estado
     * @param {Object} oldState - Estado anterior
     */
    function updateView(newState, oldState) {
        // Atualizar cards de estatísticas
        if (newState.stats) {
            const statUsersEl = document.getElementById('statUsersActive');
            const statProductsEl = document.getElementById('statProductsMonitored');
            const statSupportEl = document.getElementById('statSupportThreads');
            const statBugsEl = document.getElementById('statBugsOpen');

            if (statUsersEl) statUsersEl.textContent = newState.stats.usersActive || 0;
            if (statProductsEl) statProductsEl.textContent = newState.stats.productsMonitored || 0;
            if (statSupportEl) statSupportEl.textContent = newState.stats.supportThreads || 0;
            if (statBugsEl) statBugsEl.textContent = newState.stats.bugsOpen || 0;
        }

        // Atualizar lista de atividade recente
        if (newState.recentActivity !== undefined) {
            renderRecentActivity(newState.recentActivity);
        }
    }

    /**
     * Renderiza a lista de atividade recente
     * @param {Array} activities - Array de atividades
     */
    function renderRecentActivity(activities) {
        const activityList = document.getElementById('recentActivity');
        if (!activityList) return;

        if (activities.length === 0) {
            activityList.innerHTML = '<div class="loading-state">Nenhuma atividade recente</div>';
            return;
        }

        activityList.innerHTML = activities.map(activity => {
            const escapedTitle = viewModel.escapeHtml(activity.title);
            const escapedDescription = viewModel.escapeHtml(activity.description);
            const formattedTime = viewModel.formatDate(activity.time);

            return `
                <div class="activity-item">
                    <div class="activity-icon ${activity.type}">${activity.icon}</div>
                    <div class="activity-content">
                        <h4>${escapedTitle}</h4>
                        <p>${escapedDescription}</p>
                    </div>
                    <div class="activity-time">${formattedTime}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * Inicializa a View e conecta ao ViewModel
     */
    async function init() {
        // Criar instância do ViewModel
        viewModel = new OverviewViewModel();

        // Observar mudanças de estado e atualizar a View automaticamente
        viewModel.observe(updateView);

        // Configurar event listeners
        setupEventListeners();

        // Inicializar ViewModel (carrega dados)
        await viewModel.init();

        // Auto-refresh a cada 60 segundos
        setInterval(() => {
            viewModel.loadOverview();
        }, 60000);

        console.log('[Overview] View inicializada com MVVM');
    }

    /**
     * Configura event listeners da View
     */
    function setupEventListeners() {
        // Botão de refresh
        const refreshBtn = document.getElementById('refreshOverviewBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                viewModel.loadOverview();
            });
        }

        // Botão de logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Tem certeza que deseja sair?')) {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                }
            });
        }
    }

    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Limpar recursos quando a página for descarregada
    window.addEventListener('beforeunload', () => {
        if (viewModel) {
            viewModel.destroy();
        }
    });
})();
