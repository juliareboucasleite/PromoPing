(function() {
    'use strict';
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();

    async function fetchAuth(url) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        if (!res.ok) throw new Error('Erro ao carregar notificações');
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
        return new Date(s).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function tipoLabel(t) {
        if (t === 'incident_resolved') return 'Incidente resolvido';
        if (t === 'incident_update') return 'Atualização de incidente';
        if (t === 'system_update') return 'Atualização do sistema';
        return t || 'Notificação';
    }

    async function load() {
        const el = document.getElementById('notifList');
        if (!el) return;
        try {
            const data = await fetchAuth('/api/corporation/notifications?limit=100');
            const list = data.notifications || [];
            if (list.length === 0) {
                el.innerHTML = '<div class="loading-state">Nenhuma notificação</div>';
                return;
            }
            el.innerHTML = list.map(n => `
                <div style="padding: 1rem; border-bottom: 1px solid #232326;">
                    <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                        <strong>${escapeHtml(tipoLabel(n.Tipo))}</strong>
                        <span style="color: #9ca3af;">${formatDate(n.DataCriacao)}</span>
                    </div>
                    <h3 style="margin: 0.5rem 0; font-size: 1rem;">${escapeHtml((window.APIUtils && window.APIUtils.stripBracketPrefix(n.Titulo)) || n.Titulo || '')}</h3>
                    <p style="margin: 0; color: #d1d5db; white-space: pre-wrap;">${escapeHtml(n.Descricao || '')}</p>
                    ${n.author_nome ? `<div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem;">Por: ${escapeHtml(n.author_nome)}</div>` : ''}
                </div>
            `).join('');
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        load();
        document.getElementById('refreshNotifBtn')?.addEventListener('click', load);
    });
})();
