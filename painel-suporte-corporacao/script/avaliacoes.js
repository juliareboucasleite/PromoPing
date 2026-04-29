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
                            <div style="background: #1f2937; padding: 1rem; border-radius: 8px; border-left: 4px solid ${getTipoColor(stat.tipo)};">
                                <div style="font-size: 0.875rem; color: #9ca3af; margin-bottom: 0.5rem;">${getTipoLabel(stat.tipo)}</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #fff;">${stat.total}</div>
                                <div style="font-size: 0.875rem; color: #9ca3af; margin-top: 0.25rem;">
                                    Media: ${stat.media_rating ? parseFloat(stat.media_rating).toFixed(1) : 'N/A'} ⭐
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            reviewsList.innerHTML = statsHtml + `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Utilizador</th>
                            <th>Tipo</th>
                            <th>Fechado por</th>
                            <th>Avaliacao</th>
                            <th>Comentario</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.reviews.map((review) => `
                            <tr>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <img src="${escapeHtml(getReviewAvatar(review))}" alt="${escapeHtml(getReviewDisplayName(review))}" onerror="this.src='../assets/images/PromoPing.png'" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">
                                        <span style="color: ${(review.is_anonimo == 1 || review.is_anonimo === true) ? '#9ca3af' : '#fff'};">
                                            ${escapeHtml(getReviewDisplayName(review))}
                                        </span>
                                    </div>
                                </td>
                                <td>
                                    <span style="background: ${getTipoColor(review.tipo)}20; color: ${getTipoColor(review.tipo)}; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem;">
                                        ${getTipoLabel(review.tipo)}
                                    </span>
                                </td>
                                <td>${escapeHtml((review.tipo === 'suporte' && pick(review, 'support_nome', 'support_email')) || '—')}</td>
                                <td>${generateStarRating(review.rating)}</td>
                                <td style="max-width: 400px; word-wrap: break-word;">${escapeHtml(review.texto || 'Sem comentario')}</td>
                                <td>${formatDateTime(review.created_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${data.totalPages > 1 ? `
                    <div style="margin-top: 1rem; text-align: center; color: #9ca3af;">
                        Pagina ${data.page} de ${data.totalPages} (Total: ${data.total} avaliacoes)
                    </div>
                ` : ''}
            `;
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
