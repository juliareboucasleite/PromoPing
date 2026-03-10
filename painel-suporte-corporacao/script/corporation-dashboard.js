/**
 * Dashboard do painel corporativo
 */
(function() {
    'use strict';
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();

    async function fetchAuth(url, options = {}) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, {
            ...options,
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Erro ${res.status}`);
        }
        return res.json();
    }

    function escapeHtml(t) {
        if (!t) return '';
        const d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }

    function formatDate(s) {
        if (!s) return 'N/A';
        return new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatDateTime(s) {
        if (!s) return 'N/A';
        return new Date(s).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    async function load() {
        const statStaff = document.getElementById('statStaff');
        const statReviews = document.getElementById('statReviews');
        const statNotif = document.getElementById('statNotif');
        const elIncidentes = document.getElementById('dashboardIncidentes');
        const elProjetos = document.getElementById('dashboardProjetos');
        const elEventos = document.getElementById('dashboardEventos');
        if (!elIncidentes && !elProjetos && !elEventos) return;

        try {
            const [staffRes, reviewsRes, dashboardRes] = await Promise.all([
                fetchAuth('/api/corporation/staff'),
                fetchAuth('/api/corporation/reviews?limit=1'),
                fetchAuth('/api/corporation/dashboard')
            ]);

            if (statStaff) statStaff.textContent = (staffRes.staff && staffRes.staff.length) || 0;
            if (statReviews) statReviews.textContent = (reviewsRes.total !== undefined) ? reviewsRes.total : (reviewsRes.reviews && reviewsRes.reviews.length) || 0;

            const notifs = dashboardRes.notifications || [];
            const atualizacoesSistema = dashboardRes.atualizacoesSistema || [];
            const bugs = dashboardRes.recentBugsProjetos || [];
            const events = dashboardRes.recentEvents || [];
            if (statNotif) statNotif.textContent = notifs.length + atualizacoesSistema.length;

            if (elIncidentes) {
                var incidentItems = notifs.map(n => ({
                    data: n.DataCriacao,
                    html: (function() {
                        var tipo = n.Tipo === 'incident_resolved' ? 'Incidente resolvido' : n.Tipo === 'incident_update' ? 'Atualização de incidente' : 'Atualização do sistema';
                        var data = formatDateTime(n.DataCriacao);
                        var funcionario = escapeHtml(n.author_nome || 'Sistema');
                        return '<div class="activity-item" style="padding: 0.75rem; border-bottom: 1px solid #232326;">' +
                            '<strong>' + escapeHtml(tipo) + '</strong> – ' + escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(n.Titulo)) || n.Titulo || '') +
                            '<div style="font-size: 0.85rem; margin-top: 0.25rem;"><span style="color: #60a5fa; font-weight: 500;">Funcionário: ' + funcionario + '</span> · ' + data + '</div></div>';
                    })()
                }));
                var atualizItems = atualizacoesSistema.map(a => ({
                    data: a.DataCriacao,
                    html: (function() {
                        var tipoLabel = (a.Tipo === 'feature') ? 'Funcionalidade' : (a.Tipo === 'improvement') ? 'Melhoria' : escapeHtml(a.Tipo || 'Atualização');
                        var desc = (a.Descricao || '').substring(0, 120);
                        if ((a.Descricao || '').length > 120) desc += '…';
                        return '<div class="activity-item" style="padding: 0.75rem; border-bottom: 1px solid #232326;">' +
                            '<strong>' + tipoLabel + '</strong> – ' + escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(a.Titulo)) || a.Titulo || '') +
                            (desc ? '<div style="font-size: 0.85rem; color: #9ca3af; margin-top: 0.25rem;">' + escapeHtml(desc) + '</div>' : '') +
                            '<div style="font-size: 0.85rem; margin-top: 0.25rem;">' + formatDateTime(a.DataCriacao) + '</div></div>';
                    })()
                }));
                var combined = incidentItems.concat(atualizItems).sort((x, y) => new Date(y.data) - new Date(x.data));
                if (combined.length === 0) {
                    elIncidentes.innerHTML = '<div class="loading-state">Nenhum incidente ou atualização recente</div>';
                } else {
                    elIncidentes.innerHTML = combined.map(x => x.html).join('');
                }
            }

            if (elProjetos) {
                if (bugs.length === 0) {
                    elProjetos.innerHTML = '<div class="loading-state">Nenhum bug ou projeto recente</div>';
                } else {
                    elProjetos.innerHTML = bugs.map(b => {
                        var prioridade = b.Prioridade ? ', ' + escapeHtml(b.Prioridade) : '';
                        var linhaFunc = b.author_nome ? '<div style="font-size: 0.85rem; margin-top: 0.25rem;"><span style="color: #60a5fa; font-weight: 500;">Funcionário: ' + escapeHtml(b.author_nome) + '</span> · ' + formatDate(b.DataCriacao) + '</div>' : '<div style="font-size: 0.85rem; margin-top: 0.25rem;">' + formatDate(b.DataCriacao) + '</div>';
                        return '<div class="activity-item" style="padding: 0.75rem; border-bottom: 1px solid #232326;">' +
                            '<strong>#' + b.Id + '</strong> ' + escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(b.Titulo)) || b.Titulo || 'Sem título') + ' <span style="color: #9ca3af;">(' + escapeHtml(b.Tipo || '-') + ', ' + escapeHtml(b.Status || '-') + prioridade + ')</span>' +
                            linhaFunc + '</div>';
                    }).join('');
                }
            }

            if (elEventos) {
                if (events.length === 0) {
                    elEventos.innerHTML = '<div class="loading-state">Nenhum evento recente</div>';
                } else {
                    elEventos.innerHTML = events.map(e => {
                        const funcionario = escapeHtml(e.author_nome || '-');
                        return `<div class="activity-item" style="padding: 0.75rem; border-bottom: 1px solid #232326;">
                            <strong>${escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(e.Titulo)) || e.Titulo || 'Sem título')}</strong> <span style="color: #9ca3af;">(${escapeHtml(e.Tipo || '-')}, ${escapeHtml(e.Status || '-')})</span>
                            <div style="font-size: 0.85rem; margin-top: 0.25rem;"><span style="color: #60a5fa; font-weight: 500;">Funcionário: ${funcionario}</span> · ${formatDateTime(e.StartDate)}</div>
                        </div>`;
                    }).join('');
                }
            }
        } catch (e) {
            console.error('[CORPORATION] Erro:', e);
            const errMsg = `<div class="loading-state" style="color: #fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
            if (elIncidentes) elIncidentes.innerHTML = errMsg;
            if (elProjetos) elProjetos.innerHTML = errMsg;
            if (elEventos) elEventos.innerHTML = errMsg;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', load);
    } else {
        load();
    }
})();
