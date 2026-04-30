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
        if (r == null) return { stars: '-', score: '' };
        let s = '';
        for (let i = 0; i < 5; i++) s += i < r ? '⭐' : '☆';
        return { stars: s, score: `${r}/5` };
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').slice(0, 2).map(n => n[0].toUpperCase()).join('');
    }

    function getTypeBadgeClass(tipo) {
        const map = { 'suporte': 'suporte', 'site': 'site', 'bot': 'bot' };
        return map[tipo] || 'suporte';
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
                const userInitials = getInitials(userLabel);
                const ratingData = stars(r.rating);
                const supportInfo = r.support_nome ? ` • Fechado por ${escapeHtml(r.support_nome)}` : '';
                const typeBadgeClass = getTypeBadgeClass(r.tipo);
                return `
                    <div class="review-card">
                        <div class="review-header">
                            <div class="review-user">
                                <div class="review-avatar">${escapeHtml(userInitials)}</div>
                                <div class="review-user-info">
                                    <div class="review-user-name">${escapeHtml(userLabel)}</div>
                                </div>
                            </div>
                            <span class="review-type-badge ${typeBadgeClass}">${escapeHtml(tipoLabel)}</span>
                        </div>
                        <div class="review-rating">
                            <span class="review-stars">${ratingData.stars}</span>
                            <span class="review-score">${ratingData.score}</span>
                        </div>
                        <p class="review-text">${escapeHtml((r.texto || '').substring(0, 300))}${(r.texto && r.texto.length > 300) ? '...' : ''}</p>
                        <div class="review-footer">
                            <span class="review-date">${formatDate(r.created_at)}</span>
                        </div>
                        ${supportInfo ? `<div class="review-support-info">${escapeHtml(supportInfo)}</div>` : ''}
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
