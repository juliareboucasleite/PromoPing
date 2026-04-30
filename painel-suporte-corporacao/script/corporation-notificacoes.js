(function() {
    'use strict';
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();

    let allNotifs = [];

    async function fetchAuth(url) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        if (!res.ok) throw new Error('Erro ao carregar notificações');
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
        return new Date(s).toLocaleString('pt-PT', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function relativeTime(s) {
        if (!s) return '—';
        const date = new Date(s);
        const diff = Date.now() - date.getTime();
        const min = Math.floor(diff / 60000);
        const h = Math.floor(diff / 3600000);
        const d = Math.floor(diff / 86400000);
        if (min < 1) return 'agora';
        if (min < 60) return `há ${min} min`;
        if (h < 24) return `há ${h}h`;
        if (d < 7) return `há ${d}d`;
        return formatDate(s);
    }

    function tipoLabel(t) {
        if (t === 'incident_resolved') return 'Incidente resolvido';
        if (t === 'incident_update') return 'Atualização de incidente';
        if (t === 'system_update') return 'Atualização do sistema';
        if (t === 'system_maintenance') return 'Manutenção';
        return t || 'Notificação';
    }

    function renderSummary() {
        const total = allNotifs.length;
        const active = allNotifs.filter(n => n.Tipo === 'incident_update').length;
        const resolved = allNotifs.filter(n => n.Tipo === 'incident_resolved').length;
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const today = allNotifs.filter(n => new Date(n.DataCriacao) >= startOfDay).length;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('summaryTotal', total);
        set('summaryActive', active);
        set('summaryResolved', resolved);
        set('summaryToday', today);
    }

    function applyFilters() {
        const tipo = document.getElementById('filterTipo')?.value || '';
        const period = document.getElementById('filterPeriod')?.value || '';
        const search = (document.getElementById('filterSearch')?.value || '').toLowerCase().trim();

        let filtered = [...allNotifs];
        if (tipo) filtered = filtered.filter(n => n.Tipo === tipo);
        if (period) {
            const now = Date.now();
            const cutoff = period === 'today' ? new Date().setHours(0, 0, 0, 0)
                : period === '7d' ? now - 7 * 86400000
                : period === '30d' ? now - 30 * 86400000
                : 0;
            filtered = filtered.filter(n => new Date(n.DataCriacao).getTime() >= cutoff);
        }
        if (search) {
            filtered = filtered.filter(n => {
                const titulo = ((window.APIUtils?.stripBracketPrefix?.(n.Titulo)) || n.Titulo || '').toLowerCase();
                const desc = (n.Descricao || '').toLowerCase();
                return titulo.includes(search) || desc.includes(search);
            });
        }

        renderList(filtered);
        const countEl = document.getElementById('filterCount');
        if (countEl) countEl.textContent = `${filtered.length} de ${allNotifs.length}`;
    }

    function renderList(list) {
        const el = document.getElementById('notifList');
        if (!el) return;
        if (!list.length) {
            el.innerHTML = '<div class="loading-state">Nenhuma notificação encontrada</div>';
            return;
        }
        el.innerHTML = list.map(n => {
            const tipo = n.Tipo || 'default';
            const tagClass = ['incident_resolved', 'incident_update', 'system_update', 'system_maintenance'].includes(tipo) ? tipo : 'default';
            const titulo = (window.APIUtils?.stripBracketPrefix?.(n.Titulo)) || n.Titulo || '';
            return `
                <div class="notif-card type-${escapeHtml(tipo)}">
                    <div class="notif-head">
                        <span class="notif-tag ${escapeHtml(tagClass)}">${escapeHtml(tipoLabel(tipo))}</span>
                        <span class="notif-time" title="${escapeHtml(formatDate(n.DataCriacao))}">${escapeHtml(relativeTime(n.DataCriacao))}</span>
                    </div>
                    <h3 class="notif-title">${escapeHtml(titulo)}</h3>
                    ${n.Descricao ? `<p class="notif-desc">${escapeHtml(n.Descricao)}</p>` : ''}
                    ${n.author_nome ? `<div class="notif-author"><span class="author-dot"></span>Publicado por <strong style="color:#cbd5e1;">${escapeHtml(n.author_nome)}</strong></div>` : ''}
                </div>`;
        }).join('');
    }

    async function load() {
        const el = document.getElementById('notifList');
        if (!el) return;
        try {
            el.innerHTML = '<div class="loading-state">A carregar...</div>';
            const data = await fetchAuth('/api/corporation/notifications?limit=200');
            allNotifs = data.notifications || [];
            renderSummary();
            applyFilters();
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        load();
        document.getElementById('refreshNotifBtn')?.addEventListener('click', load);
        ['filterTipo', 'filterPeriod'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', applyFilters);
        });
        document.getElementById('filterSearch')?.addEventListener('input', applyFilters);
    });
})();
