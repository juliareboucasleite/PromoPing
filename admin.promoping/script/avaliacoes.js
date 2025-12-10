/**
 * Avaliações - PromoPing Admin
 */

(function() {
    'use strict';

    const API_BASE = (localStorage.getItem('PROMOPING_API') || 'http://localhost:3000').replace(/\/+$/, '');
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
            const response = await fetch(`${API_BASE}${url}`, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Resposta inválida do servidor (${response.status})`);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error(`[AVALIACOES] Erro:`, error);
            throw error;
        }
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function generateStarRating(rating) {
        const filledStar = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#ffd700" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#ffd700" stroke-width="1.5" stroke-linejoin="round"/></svg>';
        const emptyStar = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="#666" stroke-width="1.5" stroke-linejoin="round"/></svg>';
        let stars = '';
        for (let i = 0; i < 5; i++) {
            stars += i < rating ? filledStar : emptyStar;
        }
        return stars;
    }

    async function loadReviews() {
        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;

        try {
            reviewsList.innerHTML = '<div class="loading-state">Carregando avaliações...</div>';

            const response = await fetchAuth('/api/admin/reviews');
            const data = await response.json();

            if (!data.reviews || data.reviews.length === 0) {
                reviewsList.innerHTML = '<div class="loading-state">Sistema de avaliações em desenvolvimento</div>';
                return;
            }

            reviewsList.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Utilizador</th>
                            <th>Avaliação</th>
                            <th>Comentário</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.reviews.map(review => `
                            <tr>
                                <td>${escapeHtml(review.userName || 'N/A')}</td>
                                <td>${generateStarRating(review.rating || 0)}</td>
                                <td>${escapeHtml(review.comment || 'N/A')}</td>
                                <td>${formatDate(review.date)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            console.error('[AVALIACOES] Erro ao carregar avaliações:', error);
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
                if (confirm('Tem certeza que deseja sair?')) {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                }
            });
        }

        loadReviews();
        console.log('[AVALIACOES] Página de avaliações inicializada');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();