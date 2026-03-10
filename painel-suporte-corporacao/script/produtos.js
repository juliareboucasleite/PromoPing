/**
 * Produtos - PromoPing Admin
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
            console.error(`[PRODUTOS] Erro:`, error);
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

    let cachedProducts = [];

    /** Obtém lista de empresas/lojas distintas a partir dos produtos (ordenada). */
    function getDistinctLojas(products) {
        const set = new Set();
        (products || []).forEach(p => {
            const nome = (p.Loja || '').trim();
            if (nome) set.add(nome);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt'));
    }

    /** Atualiza os botões de filtro: Todos + um por cada empresa. */
    function renderFilterTabs(products) {
        const container = document.getElementById('productFilterTabs');
        if (!container) return;

        const lojas = getDistinctLojas(products);
        const currentFilter = container.querySelector('.tab-button.active')?.dataset.filter || 'todos';

        container.innerHTML = '';
        const todosBtn = document.createElement('button');
        todosBtn.type = 'button';
        todosBtn.className = 'tab-button' + (currentFilter === 'todos' ? ' active' : '');
        todosBtn.dataset.filter = 'todos';
        todosBtn.textContent = 'Todos';
        container.appendChild(todosBtn);

        lojas.forEach(loja => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tab-button' + (currentFilter === loja ? ' active' : '');
            btn.dataset.filter = loja;
            btn.textContent = loja;
            container.appendChild(btn);
        });

        container.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
        });
    }

    function filterProducts(products, filterKey) {
        if (!filterKey || filterKey === 'todos') return products;
        return (products || []).filter(p => (p.Loja || '').trim() === filterKey);
    }

    function renderProductsTable(products) {
        const productsList = document.getElementById('productsList');
        if (!productsList) return;

        if (!products || products.length === 0) {
            productsList.innerHTML = '<div class="loading-state">Nenhum produto encontrado</div>';
            return;
        }

        productsList.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Utilizador</th>
                        <th>Preço Atual</th>
                        <th>Preço Alvo</th>
                        <th>Loja</th>
                        <th>Criado</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(product => `
                        <tr>
                            <td>${escapeHtml(product.Nome || 'N/A')}</td>
                            <td>${escapeHtml(product.UserName || 'N/A')}</td>
                            <td>€${parseFloat(product.PrecoAtual || 0).toFixed(2)}</td>
                            <td>€${parseFloat(product.PrecoAlvo || 0).toFixed(2)}</td>
                            <td>${escapeHtml(product.Loja || 'N/A')}</td>
                            <td>${formatDate(product.DataCriacao)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function applyFilter(filterKey) {
        const filtered = filterProducts(cachedProducts, filterKey);
        renderProductsTable(filtered);

        const container = document.getElementById('productFilterTabs');
        if (container) {
            container.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === filterKey);
            });
        }
    }

    async function loadProducts() {
        const productsList = document.getElementById('productsList');
        if (!productsList) return;

        try {
            productsList.innerHTML = '<div class="loading-state">Carregando produtos...</div>';

            const response = await fetchAuth('/api/admin/products?limit=500');
            const data = await response.json();

            if (!data.products || data.products.length === 0) {
                cachedProducts = [];
                renderFilterTabs([]);
                productsList.innerHTML = '<div class="loading-state">Nenhum produto encontrado</div>';
                return;
            }

            cachedProducts = data.products;
            renderFilterTabs(cachedProducts);
            const activeFilter = document.querySelector('#productFilterTabs .tab-button.active')?.dataset.filter || 'todos';
            applyFilter(activeFilter);
        } catch (error) {
            console.error('[PRODUTOS] Erro ao carregar produtos:', error);
            productsList.innerHTML = `<div class="loading-state" style="color: #fca5a5;">Erro: ${error.message}</div>`;
        }
    }

    function init() {
        if (!checkAuth()) return;

        const refreshBtn = document.getElementById('refreshProductsBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (refreshBtn) refreshBtn.addEventListener('click', loadProducts);
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                showConfirm('Tem certeza que deseja sair?', 'Sair', () => {
                    localStorage.removeItem('PROMOPING_TOKEN');
                    localStorage.removeItem('PROMOPING_USER');
                    window.location.href = 'login.html';
                });
            });
        }

        loadProducts();
        console.log('[PRODUTOS] Página de produtos inicializada');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();