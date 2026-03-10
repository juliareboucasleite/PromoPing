/**
 * Avaliações - PromoPing Admin
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
                const text = await response.text();
                throw new Error(`Resposta inválida do servidor (${response.status})`);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error(`Erro:`, error);
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
        if (!rating || rating === 0) return '<span style="color: #666;">Sem avaliação</span>';
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
            'site': 'Site',
            'bot': 'Bot',
            'suporte': 'Suporte'
        };
        return tipos[tipo] || tipo;
    }

    function getTipoColor(tipo) {
        const cores = {
            'site': '#3b82f6',
            'bot': '#8b5cf6',
            'suporte': '#10b981'
        };
        return cores[tipo] || '#666';
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

    async function loadReviews() {
        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;

        try {
            reviewsList.innerHTML = '<div class="loading-state">Carregando avaliações...</div>';

            const response = await fetchAuth('/api/admin/reviews');
            const data = await response.json();

            console.log('[AVALIACOES] Dados recebidos:', data);
            console.log('[AVALIACOES] Primeira review:', data.reviews?.[0]);

            if (!data.reviews || data.reviews.length === 0) {
                reviewsList.innerHTML = `
                    <div class="loading-state">
                        <p>Nenhuma avaliação encontrada.</p>
                        <p style="color: #9ca3af; font-size: 0.9em; margin-top: 0.5em;">
                            As avaliações feitas no Discord aparecerão aqui.
                        </p>
                    </div>
                `;
                return;
            }

            // Estatísticas
            let statsHtml = '';
            if (data.stats && data.stats.length > 0) {
                statsHtml = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                        ${data.stats.map(stat => `
                            <div style="background: #1f2937; padding: 1rem; border-radius: 8px; border-left: 4px solid ${getTipoColor(stat.tipo)};">
                                <div style="font-size: 0.875rem; color: #9ca3af; margin-bottom: 0.5rem;">${getTipoLabel(stat.tipo)}</div>
                                <div style="font-size: 1.5rem; font-weight: 600; color: #fff;">${stat.total}</div>
                                <div style="font-size: 0.875rem; color: #9ca3af; margin-top: 0.25rem;">
                                    Média: ${stat.media_rating ? parseFloat(stat.media_rating).toFixed(1) : 'N/A'} ⭐
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
                            <th>Avaliação</th>
                            <th>Comentário</th>
                            <th>Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.reviews.map(review => `
                            <tr>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        ${(review.is_anonimo == 1 || review.is_anonimo === true) ? 
                                            `<img src="../assets/images/fotodefault.png" alt="Anónimo" onerror="this.src='../assets/images/PromoPing.png'" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">` : 
                                            `<img src="../assets/images/fotodefault.png" alt="${escapeHtml(review.user_nome || review.user_email || 'Utilizador')}" onerror="this.src='../assets/images/PromoPing.png'" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`
                                        }
                                        <span style="color: ${(review.is_anonimo == 1 || review.is_anonimo === true) ? '#9ca3af' : '#fff'};">
                                            ${(review.is_anonimo == 1 || review.is_anonimo === true) ? 'Anónimo' : (escapeHtml(review.user_nome) || escapeHtml(review.user_email) || 'Utilizador')}
                                        </span>
                                    </div>
                                </td>
                                <td>
                                    <span style="background: ${getTipoColor(review.tipo)}20; color: ${getTipoColor(review.tipo)}; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem;">
                                        ${getTipoLabel(review.tipo)}
                                    </span>
                                </td>
                                <td>${(review.tipo === 'suporte' && (review.support_nome || review.support_email)) ? escapeHtml(review.support_nome || review.support_email) : '—'}</td>
                                <td>${generateStarRating(review.rating)}</td>
                                <td style="max-width: 400px; word-wrap: break-word;">${escapeHtml(review.texto || 'Sem comentário')}</td>
                                <td>${formatDateTime(review.created_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ${data.totalPages > 1 ? `
                    <div style="margin-top: 1rem; text-align: center; color: #9ca3af;">
                        Página ${data.page} de ${data.totalPages} (Total: ${data.total} avaliações)
                    </div>
                ` : ''}
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
                showConfirm('Tem certeza que deseja sair?', 'Sair', () => {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                });
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