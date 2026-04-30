(function() {
    'use strict';
    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = window.CorporationAuth && window.CorporationAuth.getToken();

    let allReviews = [];

    async function fetchAuth(url) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const res = await fetch(safeUrl, { headers: { 'Authorization': `Bearer ${TOKEN}` } });
        if (!res.ok) throw new Error('Erro ao carregar avaliações');
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

    function stars(r) {
        if (r == null) return { stars: '—', score: '' };
        let s = '';
        for (let i = 0; i < 5; i++) s += i < r ? '⭐' : '☆';
        return { stars: s, score: `${r}/5` };
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() || '').join('') || '?';
    }

    function getTypeBadgeClass(tipo) {
        return ({ 'suporte': 'suporte', 'site': 'site', 'bot': 'bot' })[tipo] || 'suporte';
    }

    function applyFilters() {
        const tipo = document.getElementById('filterTipo')?.value || '';
        const rating = document.getElementById('filterRating')?.value || '';
        const sort = document.getElementById('filterSort')?.value || 'recent';

        let filtered = [...allReviews];
        if (tipo) filtered = filtered.filter(r => r.tipo === tipo);
        if (rating) filtered = filtered.filter(r => Number(r.rating) === Number(rating));

        filtered.sort((a, b) => {
            if (sort === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
            if (sort === 'rating_high') return (b.rating || 0) - (a.rating || 0);
            if (sort === 'rating_low') return (a.rating || 0) - (b.rating || 0);
            return new Date(b.created_at) - new Date(a.created_at);
        });

        renderReviews(filtered);

        const countEl = document.getElementById('filterCount');
        if (countEl) countEl.textContent = `${filtered.length} de ${allReviews.length}`;
    }

    function renderSummary() {
        const total = allReviews.length;
        const ratings = allReviews.map(r => r.rating).filter(r => typeof r === 'number');
        const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
        const suporte = allReviews.filter(r => r.tipo === 'suporte');
        const suporteRatings = suporte.map(r => r.rating).filter(r => typeof r === 'number');
        const suporteAvg = suporteRatings.length ? suporteRatings.reduce((a, b) => a + b, 0) / suporteRatings.length : null;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recent = allReviews.filter(r => new Date(r.created_at) >= sevenDaysAgo).length;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('summaryTotal', total);
        set('summaryAvg', avg !== null ? avg.toFixed(1) : '—');
        const avgStars = document.getElementById('summaryAvgStars');
        if (avgStars) {
            if (avg !== null) {
                const rounded = Math.round(avg);
                let s = '';
                for (let i = 0; i < 5; i++) s += i < rounded ? '⭐' : '☆';
                avgStars.textContent = s;
            } else avgStars.textContent = '—';
        }
        set('summarySuporte', suporte.length);
        set('summarySuporteAvg', suporteAvg !== null ? `Média: ${suporteAvg.toFixed(1)} ⭐` : 'Média: —');
        set('summaryRecent', recent);
    }

    function renderReviews(reviews) {
        const el = document.getElementById('reviewsList');
        if (!el) return;
        if (!reviews.length) {
            el.innerHTML = '<div class="loading-state">Nenhuma avaliação encontrada</div>';
            return;
        }
        el.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 1rem;">
                ${reviews.map(r => {
                    const tipoLabel = r.tipo === 'suporte' ? 'Suporte' : r.tipo === 'site' ? 'Site' : r.tipo === 'bot' ? 'Bot' : r.tipo || '—';
                    const userLabel = r.is_anonimo ? 'Anónimo' : (r.user_nome || r.user_email || 'Utilizador');
                    const userInitials = getInitials(userLabel);
                    const ratingData = stars(r.rating);
                    const supportInfo = r.support_nome ? `Fechado por ${escapeHtml(r.support_nome)}` : '';
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
                            ${supportInfo ? `<div class="review-support-info">${supportInfo}</div>` : ''}
                        </div>`;
                }).join('')}
            </div>`;
    }

    async function load() {
        const el = document.getElementById('reviewsList');
        if (!el) return;
        try {
            el.innerHTML = '<div class="loading-state">A carregar avaliações...</div>';
            const data = await fetchAuth('/api/corporation/reviews?limit=200');
            allReviews = data.reviews || [];
            renderSummary();
            applyFilters();
        } catch (e) {
            el.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${escapeHtml(e.message)}</div>`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        load();
        document.getElementById('refreshReviewsBtn')?.addEventListener('click', load);
        ['filterTipo', 'filterRating', 'filterSort'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', applyFilters);
        });
    });
})();
