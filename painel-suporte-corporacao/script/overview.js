/**
 * Overview - PromoPing Admin
 * View que conecta o OverviewViewModel ao DOM
 */

(function() {
    'use strict';

    let viewModel = null;

    function setHero() {
        const userJson = localStorage.getItem('PROMOPING_USER');
        let name = '';
        try {
            const u = userJson ? JSON.parse(userJson) : null;
            name = (u?.nome || u?.Nome || u?.name || '').split(' ')[0] || '';
        } catch (e) {}

        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite';
        const welcomeEl = document.getElementById('heroWelcome');
        if (welcomeEl) welcomeEl.textContent = name ? `${greeting}, ${name}` : greeting;
        const tsEl = document.getElementById('heroTimestamp');
        if (tsEl) {
            tsEl.textContent = new Date().toLocaleDateString('pt-PT', {
                weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
            });
        }
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function formatDateTime(s) {
        if (!s) return '—';
        return new Date(s).toLocaleString('pt-PT', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function updateView(newState) {
        if (newState.stats) {
            const s = newState.stats;
            const set = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };
            set('statUsersActive', s.usersActive ?? 0);
            set('statProductsMonitored', s.productsMonitored ?? 0);
            set('statSupportThreads', s.supportThreads ?? 0);
            set('statBugsOpen', s.bugsOpen ?? 0);
            set('statReviewsTotal', s.reviewsTotal ?? 0);
            set('statIncidentsOpen', s.incidentsOpen ?? 0);

            const avgEl = document.getElementById('statReviewsAvg');
            if (avgEl) {
                if (s.reviewsAvg && !isNaN(s.reviewsAvg)) {
                    avgEl.textContent = `Média: ${s.reviewsAvg.toFixed(1)} ⭐`;
                } else {
                    avgEl.textContent = 'Média: —';
                }
            }
        }

        if (newState.recentActivity !== undefined) {
            renderRecentActivity(newState.recentActivity);
        }
        if (newState.recentBugs !== undefined) {
            renderRecentBugs(newState.recentBugs);
        }
        if (newState.recentIncidents !== undefined) {
            renderRecentIncidents(newState.recentIncidents);
        }
    }

    function renderRecentActivity(activities) {
        const list = document.getElementById('recentActivity');
        const count = document.getElementById('recentActivityCount');
        if (!list) return;

        if (count) count.textContent = activities.length;

        if (!activities.length) {
            list.innerHTML = '<div class="activity-empty">Sem atividade recente.</div>';
            return;
        }

        list.innerHTML = activities.map(a => {
            const color = a.type === 'user' ? '#60a5fa' : a.type === 'product' ? '#4ade80' : '#a78bfa';
            return `
                <div class="activity-mini">
                    <strong style="color:${color}">${escapeHtml(a.title)}</strong>
                    <div style="font-size:0.82rem;color:#9ca3af;margin-top:0.2rem">${escapeHtml(a.description)}</div>
                    <div style="font-size:0.78rem;color:#6b7280;margin-top:0.2rem">${formatDateTime(a.time)}</div>
                </div>
            `;
        }).join('');
    }

    function renderRecentBugs(bugs) {
        const list = document.getElementById('recentBugs');
        const count = document.getElementById('recentBugsCount');
        if (!list) return;

        if (count) count.textContent = bugs.length;

        if (!bugs.length) {
            list.innerHTML = '<div class="activity-empty">Sem bugs recentes.</div>';
            return;
        }

        list.innerHTML = bugs.map(b => {
            const titulo = (window.APIUtils?.stripBracketPrefix?.(b.Titulo)) || b.Titulo || 'Sem título';
            const status = (b.Status || '').toLowerCase();
            const statusColor = status === 'resolvido' || status === 'resolved' || status === 'fechado' || status === 'closed'
                ? '#4ade80' : status === 'em progresso' || status === 'in_progress' ? '#fbbf24' : '#f87171';
            return `
                <div class="activity-mini">
                    <span style="color:#60a5fa;font-weight:600">#${escapeHtml(b.Id ?? '?')}</span>
                    <strong> ${escapeHtml(titulo)}</strong>
                    <div style="font-size:0.78rem;margin-top:0.25rem">
                        <span style="color:${statusColor};font-weight:500">${escapeHtml(b.Status || '—')}</span>
                        ${b.Prioridade ? ` · ${escapeHtml(b.Prioridade)}` : ''}
                    </div>
                    <div style="font-size:0.78rem;color:#6b7280;margin-top:0.2rem">${formatDateTime(b.DataCriacao || b.created_at)}</div>
                </div>
            `;
        }).join('');
    }

    function renderRecentIncidents(incidents) {
        const list = document.getElementById('recentIncidents');
        const count = document.getElementById('recentIncidentsCount');
        if (!list) return;

        if (count) count.textContent = incidents.length;

        if (!incidents.length) {
            list.innerHTML = '<div class="activity-empty">Sem incidentes recentes.</div>';
            return;
        }

        list.innerHTML = incidents.map(i => {
            const titulo = (window.APIUtils?.stripBracketPrefix?.(i.Titulo)) || i.Titulo || i.title || 'Sem título';
            const status = (i.Status || i.status || '—');
            const statusLower = status.toLowerCase();
            const statusColor = statusLower === 'resolved' || statusLower === 'resolvido' ? '#4ade80'
                : statusLower === 'investigating' || statusLower === 'investigando' ? '#fbbf24'
                : '#f87171';
            return `
                <div class="activity-mini">
                    <strong style="color:#fbbf24">${escapeHtml(titulo)}</strong>
                    <div style="font-size:0.78rem;margin-top:0.25rem">
                        <span style="color:${statusColor};font-weight:500">${escapeHtml(status)}</span>
                    </div>
                    <div style="font-size:0.78rem;color:#6b7280;margin-top:0.2rem">${formatDateTime(i.DataCriacao || i.created_at || i.startDate)}</div>
                </div>
            `;
        }).join('');
    }

    async function init() {
        setHero();
        viewModel = new OverviewViewModel();
        viewModel.observe(updateView);
        setupEventListeners();
        await viewModel.init();

        setInterval(() => { viewModel.loadOverview(); }, 60000);
    }

    function setupEventListeners() {
        const refreshBtn = document.getElementById('refreshOverviewBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => viewModel.loadOverview());
        }
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                showConfirm('Tem certeza que deseja sair?', 'Sair', () => {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                });
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('beforeunload', () => {
        if (viewModel) viewModel.destroy();
    });
})();
