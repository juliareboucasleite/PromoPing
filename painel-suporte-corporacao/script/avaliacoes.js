/**
 * Avaliacoes - PromoPing Admin
 */

(function() {
    'use strict';

    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = localStorage.getItem('PROMOPING_TOKEN');

    let allReviews = [];
    let allStats = [];

    function checkAuth() {
        if (!TOKEN) { window.location.href = 'login.html'; return false; }
        return true;
    }

    async function fetchAuth(url, options = {}) {
        const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
        const response = await fetch(safeUrl, {
            ...options,
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        const ct = response.headers.get('content-type');
        if (!ct || !ct.includes('application/json')) {
            throw new Error(`Resposta inválida do servidor (${response.status})`);
        }
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
        }
        return response;
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function pick(obj, ...keys) {
        for (const key of keys) {
            if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
        }
        return null;
    }

    function formatDateTime(s) {
        if (!s) return 'N/A';
        return new Date(s).toLocaleString('pt-PT', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function getTipoLabel(tipo) {
        return ({ site: 'Site', bot: 'Bot', suporte: 'Suporte' })[tipo] || tipo || 'N/A';
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() || '').join('') || '?';
    }

    function getReviewStars(rating) {
        if (!rating || rating === 0) return { stars: '—', score: 'Sem avaliação' };
        let s = '';
        for (let i = 0; i < 5; i++) s += i < rating ? '⭐' : '☆';
        return { stars: s, score: `${rating}/5` };
    }

    function getReviewDisplayName(review) {
        if (review.is_anonimo == 1 || review.is_anonimo === true) return 'Anónimo';
        return pick(review, 'user_nome', 'user_email', 'discord_username') || 'Utilizador';
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

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        set('summaryTotal', total);
        set('summaryAvg', avg !== null ? avg.toFixed(1) : '—');
        const avgStars = document.getElementById('summaryAvgStars');
        if (avgStars) {
            if (avg !== null) {
                const rounded = Math.round(avg);
                let s = '';
                for (let i = 0; i < 5; i++) s += i < rounded ? '⭐' : '☆';
                avgStars.textContent = s;
            } else {
                avgStars.textContent = '—';
            }
        }
        set('summarySuporte', suporte.length);
        set('summarySuporteAvg', suporteAvg !== null ? `Média: ${suporteAvg.toFixed(1)} ⭐` : 'Média: —');
        set('summaryRecent', recent);
    }

    function renderReviews(reviews) {
        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;

        if (!reviews.length) {
            reviewsList.innerHTML = `
                <div class="loading-state">
                    <p>Nenhuma avaliação encontrada com os filtros atuais.</p>
                </div>`;
            return;
        }

        const html = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 1rem;">
                ${reviews.map((review) => {
                    const displayName = getReviewDisplayName(review);
                    const initials = getInitials(displayName);
                    const tipoLabel = getTipoLabel(review.tipo);
                    const ratingData = getReviewStars(review.rating);
                    const supportName = (review.tipo === 'suporte' && pick(review, 'support_nome', 'support_email')) || null;
                    const supportInfo = supportName ? `Fechado por ${escapeHtml(supportName)}` : '';

                    return `
                        <div class="review-card">
                            <div class="review-header">
                                <div class="review-user">
                                    <div class="review-avatar">${escapeHtml(initials)}</div>
                                    <div class="review-user-info">
                                        <div class="review-user-name">${escapeHtml(displayName)}</div>
                                    </div>
                                </div>
                                <span class="review-type-badge ${escapeHtml(review.tipo || 'suporte')}">${escapeHtml(tipoLabel)}</span>
                            </div>
                            <div class="review-rating">
                                <span class="review-stars">${ratingData.stars}</span>
                                <span class="review-score">${ratingData.score}</span>
                            </div>
                            <p class="review-text">${escapeHtml((review.texto || 'Sem comentário').substring(0, 300))}${(review.texto && review.texto.length > 300) ? '...' : ''}</p>
                            <div class="review-footer">
                                <span class="review-date">${formatDateTime(review.created_at)}</span>
                            </div>
                            ${supportInfo ? `<div class="review-support-info">${supportInfo}</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>`;
        reviewsList.innerHTML = html;
    }

    async function loadReviews() {
        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;
        try {
            reviewsList.innerHTML = '<div class="loading-state">A carregar avaliações...</div>';
            const response = await fetchAuth('/api/admin/reviews');
            const data = await response.json();
            allReviews = data.reviews || [];
            allStats = data.stats || [];
            renderSummary();
            applyFilters();
        } catch (error) {
            console.error('[AVALIACOES] Erro:', error);
            reviewsList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${escapeHtml(error.message)}</div>`;
        }
    }

    function init() {
        if (!checkAuth()) return;

        const refreshBtn = document.getElementById('refreshReviewsBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (refreshBtn) refreshBtn.addEventListener('click', loadReviews);
        ['filterTipo', 'filterRating', 'filterSort'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', applyFilters);
        });

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                showConfirm('Tem certeza que deseja sair?', 'Sair', () => {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                });
            });
        }

        loadReviews();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
