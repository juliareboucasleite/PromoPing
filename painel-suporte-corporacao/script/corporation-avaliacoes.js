(function() {
    'use strict';
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();

    async function fetchAuth(url) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        if (!res.ok) throw new Error('Erro ao carregar avaliações');
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

    function stars(r) {
        if (r == null) return '-';
        let s = '';
        for (let i = 0; i < 5; i++) s += i < r ? '⭐' : '☆';
        return s + ` (${r}/5)`;
    }

    async function load() {
        const el = document.getElementById('reviewsList');
        const tipo = document.getElementById('filterTipo')?.value || '';
        if (!el) return;
        try {
            const url = '/api/corporation/reviews?limit=50' + (tipo ? '&tipo=' + encodeURIComponent(tipo) : '');
            const data = await fetchAuth(url);
            const reviews = data.reviews || [];
            if (reviews.length === 0) {
                el.innerHTML = '<div class="loading-state">Nenhuma avaliação encontrada</div>';
                return;
            }
            el.innerHTML = reviews.map(r => {
                const tipoLabel = r.tipo === 'suporte' ? 'Suporte' : r.tipo === 'site' ? 'Site' : r.tipo === 'bot' ? 'Bot' : r.tipo || '-';
                const userLabel = r.is_anonimo ? 'Anónimo' : (r.user_nome || r.user_email || 'Utilizador');
                const supportInfo = r.support_nome ? ` Fechado por: ${escapeHtml(r.support_nome)}` : (r.tipo === 'suporte' ? ' (suporte não associado)' : '');
                return `
                    <div style="padding: 1rem; border-bottom: 1px solid #232326;">
                        <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                            <strong>${escapeHtml(userLabel)}</strong>
                            <span style="color: #9ca3af;">${tipoLabel}${supportInfo}</span>
                        </div>
                        <div style="margin: 0.5rem 0;">${stars(r.rating)}</div>
                        <p style="margin: 0; color: #d1d5db;">${escapeHtml((r.texto || '').substring(0, 300))}${(r.texto && r.texto.length > 300) ? '...' : ''}</p>
                        <div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem;">${formatDate(r.created_at)}</div>
                    </div>`;
            }).join('');
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        load();
        document.getElementById('refreshReviewsBtn')?.addEventListener('click', load);
        document.getElementById('filterTipo')?.addEventListener('change', load);
    });
})();
