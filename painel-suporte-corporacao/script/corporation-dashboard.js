/**
 * Dashboard do painel corporativo — visão geral do negócio.
 */
(function() {
    'use strict';
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();

    async function fetchAuth(url) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, {
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Erro ${res.status}`);
        }
        return res.json();
    }

    function escapeHtml(t) {
        if (t === null || t === undefined) return '';
        const d = document.createElement('div');
        d.textContent = String(t);
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

    function fmtEur(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
    }

    function setHero() {
        const user = window.CorporationAuth?.getUser();
        const name = (user?.nome || user?.Nome || '').split(' ')[0] || '';
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite';
        const welcomeEl = document.getElementById('heroWelcome');
        if (welcomeEl) welcomeEl.textContent = name ? `${greeting}, ${name}` : `${greeting}`;
        const tsEl = document.getElementById('heroTimestamp');
        if (tsEl) tsEl.textContent = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }

    async function loadFinancialKpis() {
        try {
            const data = await fetchAuth('/api/corporation/financial/kpis');
            const k = data.kpis || {};
            document.getElementById('kpiMrr').textContent = fmtEur(k.mrr);
            document.getElementById('kpiArr').textContent = `ARR: ${fmtEur(k.arr)}`;
            document.getElementById('kpiRevenue').textContent = fmtEur(k.revenue30d);
            const growthEl = document.getElementById('kpiRevenueGrowth');
            if (k.revenueGrowth === null || k.revenueGrowth === undefined) {
                growthEl.textContent = 'sem dados anteriores';
                growthEl.className = 'kpi-trend';
            } else {
                const sign = k.revenueGrowth >= 0 ? '▲' : '▼';
                growthEl.textContent = `${sign} ${Math.abs(k.revenueGrowth)}% vs. mês anterior`;
                growthEl.className = 'kpi-trend ' + (k.revenueGrowth >= 0 ? 'up' : 'down');
            }
            document.getElementById('kpiActive').textContent = k.activeSubscriptions ?? '—';
            const churnEl = document.getElementById('kpiChurn');
            churnEl.textContent = `Churn 30d: ${k.churnRate ?? 0}%`;
            churnEl.className = 'kpi-trend ' + (k.churnRate > 5 ? 'down' : k.churnRate > 0 ? '' : 'up');
            document.getElementById('kpiBalance').textContent = fmtEur(k.availableBalance);
            document.getElementById('kpiPending').textContent = `Pendente: ${fmtEur(k.pendingBalance)}`;
        } catch (e) {
            console.warn('[DASH] Falha KPIs financeiros:', e);
        }
    }

    function renderIncidentItem(n) {
        const tipo = n.Tipo === 'incident_resolved' ? 'Incidente resolvido'
                   : n.Tipo === 'incident_update'  ? 'Atualização de incidente'
                   : 'Atualização do sistema';
        const data = formatDateTime(n.DataCriacao);
        const funcionario = escapeHtml(n.author_nome || 'Sistema');
        const titulo = escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(n.Titulo)) || n.Titulo || '');
        return `<div class="activity-item">
            <strong style="color:#fbbf24;">${escapeHtml(tipo)}</strong> – ${titulo}
            <div style="font-size: 0.78rem; margin-top: 0.3rem; color: #9ca3af;">
                <span style="color: #60a5fa; font-weight: 500;">${funcionario}</span> · ${data}
            </div>
        </div>`;
    }

    function renderAtualizItem(a) {
        const tipoLabel = a.Tipo === 'feature' ? 'Funcionalidade'
                        : a.Tipo === 'improvement' ? 'Melhoria'
                        : escapeHtml(a.Tipo || 'Atualização');
        let desc = (a.Descricao || '').substring(0, 100);
        if ((a.Descricao || '').length > 100) desc += '…';
        const titulo = escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(a.Titulo)) || a.Titulo || '');
        return `<div class="activity-item">
            <strong style="color:#a78bfa;">${tipoLabel}</strong> – ${titulo}
            ${desc ? `<div style="font-size: 0.8rem; color: #9ca3af; margin-top: 0.25rem;">${escapeHtml(desc)}</div>` : ''}
            <div style="font-size: 0.78rem; margin-top: 0.3rem; color: #6b7280;">${formatDateTime(a.DataCriacao)}</div>
        </div>`;
    }

    function renderBug(b) {
        const titulo = escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(b.Titulo)) || b.Titulo || 'Sem título');
        const meta = `${escapeHtml(b.Tipo || '-')} · ${escapeHtml(b.Status || '-')}${b.Prioridade ? ' · ' + escapeHtml(b.Prioridade) : ''}`;
        const linhaFunc = b.author_nome
            ? `<span style="color: #60a5fa; font-weight: 500;">${escapeHtml(b.author_nome)}</span> · ${formatDate(b.DataCriacao)}`
            : formatDate(b.DataCriacao);
        return `<div class="activity-item">
            <span style="color:#60a5fa; font-weight:600;">#${b.Id}</span> ${titulo}
            <div style="font-size: 0.78rem; margin-top: 0.25rem; color: #9ca3af;">${meta}</div>
            <div style="font-size: 0.78rem; margin-top: 0.2rem; color: #6b7280;">${linhaFunc}</div>
        </div>`;
    }

    function renderEvento(e) {
        const titulo = escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(e.Titulo)) || e.Titulo || 'Sem título');
        const funcionario = escapeHtml(e.author_nome || '-');
        return `<div class="activity-item">
            <strong style="color:#a78bfa;">${titulo}</strong>
            <div style="font-size: 0.78rem; margin-top: 0.25rem; color: #9ca3af;">${escapeHtml(e.Tipo || '-')} · ${escapeHtml(e.Status || '-')}</div>
            <div style="font-size: 0.78rem; margin-top: 0.2rem; color: #6b7280;">
                <span style="color: #60a5fa; font-weight: 500;">${funcionario}</span> · ${formatDateTime(e.StartDate)}
            </div>
        </div>`;
    }

    async function loadActivity() {
        const elIncidentes = document.getElementById('dashboardIncidentes');
        const elProjetos   = document.getElementById('dashboardProjetos');
        const elEventos    = document.getElementById('dashboardEventos');

        try {
            const [staffRes, reviewsRes, dashboardRes] = await Promise.all([
                fetchAuth('/api/corporation/staff'),
                fetchAuth('/api/corporation/reviews?limit=1'),
                fetchAuth('/api/corporation/dashboard')
            ]);

            const statStaff = document.getElementById('statStaff');
            const statReviews = document.getElementById('statReviews');
            if (statStaff) statStaff.textContent = (staffRes.staff && staffRes.staff.length) || 0;
            if (statReviews) statReviews.textContent = (reviewsRes.total !== undefined) ? reviewsRes.total : (reviewsRes.reviews && reviewsRes.reviews.length) || 0;

            const notifs = dashboardRes.notifications || [];
            const atualizacoesSistema = dashboardRes.atualizacoesSistema || [];
            const bugs = dashboardRes.recentBugsProjetos || [];
            const events = dashboardRes.recentEvents || [];

            // Contadores
            document.getElementById('incidentesCount').textContent = notifs.length + atualizacoesSistema.length;
            document.getElementById('bugsCount').textContent = bugs.length;
            document.getElementById('eventosCount').textContent = events.length;

            // Incidentes & atualizações combinadas
            if (elIncidentes) {
                const items = [
                    ...notifs.map(n => ({ data: n.DataCriacao, html: renderIncidentItem(n) })),
                    ...atualizacoesSistema.map(a => ({ data: a.DataCriacao, html: renderAtualizItem(a) }))
                ].sort((x, y) => new Date(y.data) - new Date(x.data));

                elIncidentes.innerHTML = items.length === 0
                    ? '<div class="activity-empty">Sem incidentes ou atualizações recentes.</div>'
                    : items.map(x => x.html).join('');
            }

            // Bugs / projetos
            if (elProjetos) {
                elProjetos.innerHTML = bugs.length === 0
                    ? '<div class="activity-empty">Sem bugs ou projetos recentes.</div>'
                    : bugs.map(renderBug).join('');
            }

            // Eventos calendário
            if (elEventos) {
                elEventos.innerHTML = events.length === 0
                    ? '<div class="activity-empty">Sem eventos recentes.</div>'
                    : events.map(renderEvento).join('');
            }
        } catch (e) {
            console.error('[DASH] Erro:', e);
            const errMsg = `<div class="activity-empty" style="color: #fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
            if (elIncidentes) elIncidentes.innerHTML = errMsg;
            if (elProjetos) elProjetos.innerHTML = errMsg;
            if (elEventos) elEventos.innerHTML = errMsg;
        }
    }

    function init() {
        setHero();
        loadFinancialKpis();
        loadActivity();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
