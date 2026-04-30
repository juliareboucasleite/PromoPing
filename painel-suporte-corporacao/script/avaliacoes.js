/**
 * Avaliacoes - PromoPing Admin
 */

(function() {
    'use strict';

    const API_BASE = window.APIUtils ? window.APIUtils.getSafeApiBase() : 'http://localhost:3000';
    const TOKEN = localStorage.getItem('PROMOPING_TOKEN');

    function checkAuth() {
        if (!TOKEN) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    async function fetchAuth(url, options = {}) {
        try {
            const safeUrl = window.APIUtils ? window.APIUtils.buildSafeUrl(url) : `${API_BASE}${url}`;
            const response = await fetch(safeUrl, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Resposta invalida do servidor (${response.status})`);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error('[AVALIACOES] Erro:', error);
            throw error;
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function pick(obj, ...keys) {
        for (const key of keys) {
            if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
                return obj[key];
            }
        }
        return null;
    }

    function formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function generateStarRating(rating) {
        if (!rating || rating === 0) return '<span style="color: #666;">Sem avaliacao</span>';
        const filledStar = '⭐';
        const emptyStar = '☆';
        let stars = '';
        for (let i = 0; i < 5; i++) {
            stars += i < rating ? filledStar : emptyStar;
        }
        return `<span style="font-size: 1.2em;">${stars} (${rating}/5)</span>`;
    }

    function getTipoLabel(tipo) {
        const tipos = {
            site: 'Site',
            bot: 'Bot',
            suporte: 'Suporte'
        };
        return tipos[tipo] || tipo || 'N/A';
    }

    function getTipoColor(tipo) {
        const cores = {
            site: '#3b82f6',
            bot: '#8b5cf6',
            suporte: '#10b981'
        };
        return cores[tipo] || '#666';
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').slice(0, 2).map(n => n[0].toUpperCase()).join('');
    }

    function getReviewStars(rating) {
        if (!rating || rating === 0) return { stars: '-', score: 'Sem avaliação' };
        let s = '';
        for (let i = 0; i < 5; i++) s += i < rating ? '⭐' : '☆';
        return { stars: s, score: `${rating}/5` };
    }

    function getReviewDisplayName(review) {
        if (review.is_anonimo == 1 || review.is_anonimo === true) {
            return 'Anonimo';
        }
        return pick(review, 'user_nome', 'user_email', 'discord_username') || 'Utilizador';
    }

    function getReviewAvatar(review) {
        if (review.is_anonimo == 1 || review.is_anonimo === true) {
            return '../assets/images/fotodefault.png';
        }
        return pick(review, 'discord_avatar_url') || '../assets/images/fotodefault.png';
    }

    async function loadReviews() {
        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;

        try {
            reviewsList.innerHTML = '<div class="loading-state">Carregando avaliacoes...</div>';

            const response = await fetchAuth('/api/admin/reviews');
            const data = await response.json();

            if (!data.reviews || data.reviews.length === 0) {
                reviewsList.innerHTML = `
                    <div class="loading-state">
                        <p>Nenhuma avaliacao encontrada.</p>
                        <p style="color: #9ca3af; font-size: 0.9em; margin-top: 0.5rem;">
                            As avaliacoes feitas no Discord aparecerao aqui.
                        </p>
                    </div>
                `;
                return;
            }

            let statsHtml = '';
            if (data.stats && data.stats.length > 0) {
                statsHtml = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                        ${data.stats.map((stat) => `
                            <div style="background: linear-gradient(180deg, #141416 0%, #0f0f10 100%); padding: 1rem; border-radius: 12px; border: 1px solid #27272a; border-left: 4px solid ${getTipoColor(stat.tipo)}; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                                <div style="font-size: 0.875rem; color: #a1a1aa; margin-bottom: 0.5rem;">${getTipoLabel(stat.tipo)}</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: #fafafa;">${stat.total}</div>
                                <div style="font-size: 0.875rem; color: #a1a1aa; margin-top: 0.25rem;">
                                    Media: ${stat.media_rating ? parseFloat(stat.media_rating).toFixed(1) : 'N/A'} ⭐
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            const reviewsHtml = `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 1rem; padding: 0;">
                    ${data.reviews.map((review) => {
                        const displayName = getReviewDisplayName(review);
                        const initials = getInitials(displayName);
                        const tipoLabel = getTipoLabel(review.tipo);
                        const ratingData = getReviewStars(review.rating);
                        const supportName = (review.tipo === 'suporte' && pick(review, 'support_nome', 'support_email')) || null;
                        const supportInfo = supportName ? ` • Fechado por ${escapeHtml(supportName)}` : '';
                        
                        return `
                            <div class="review-card">
                                <div class="review-header">
                                    <div class="review-user">
                                        <div class="review-avatar">${escapeHtml(initials)}</div>
                                        <div class="review-user-info">
                                            <div class="review-user-name">${escapeHtml(displayName)}</div>
                                        </div>
                                    </div>
                                    <span class="review-type-badge ${review.tipo}">${escapeHtml(tipoLabel)}</span>
                                </div>
                                <div class="review-rating">
                                    <span class="review-stars">${ratingData.stars}</span>
                                    <span class="review-score">${ratingData.score}</span>
                                </div>
                                <p class="review-text">${escapeHtml((review.texto || 'Sem comentário').substring(0, 300))}${(review.texto && review.texto.length > 300) ? '...' : ''}</p>
                                <div class="review-footer">
                                    <span class="review-date">${formatDateTime(review.created_at)}</span>
                                </div>
                                ${supportInfo ? `<div class="review-support-info">${escapeHtml(supportInfo)}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;

            reviewsList.innerHTML = statsHtml + reviewsHtml;
        } catch (error) {
            console.error('[AVALIACOES] Erro ao carregar avaliacoes:', error);
            reviewsList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    function init() {
        if (!checkAuth()) return;

        const refreshBtn = document.getElementById('refreshReviewsBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (refreshBtn) refreshBtn.addEventListener('click', loadReviews);
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
        console.log('[AVALIACOES] Pagina de avaliacoes inicializada');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
