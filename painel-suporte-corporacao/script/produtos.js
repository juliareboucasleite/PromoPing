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
                throw new Error(`Resposta invalida do servidor (${response.status})`);
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `Erro ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error('[PRODUTOS] Erro:', error);
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

    function pick(obj, ...keys) {
        for (const key of keys) {
            if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
        }
        return null;
    }

    function truncateLink(link, max = 42) {
        if (!link) return 'N/A';
        if (link.length <= max) return link;
        return `${link.slice(0, max)}...`;
    }

    let cachedProducts = [];

    function getDistinctLojas(products) {
        const set = new Set();
        (products || []).forEach((product) => {
            const loja = (pick(product, 'Loja', 'loja') || '').trim();
            if (loja) set.add(loja);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt'));
    }

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

        lojas.forEach((loja) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tab-button' + (currentFilter === loja ? ' active' : '');
            btn.dataset.filter = loja;
            btn.textContent = loja;
            container.appendChild(btn);
        });

        container.querySelectorAll('.tab-button').forEach((btn) => {
            btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
        });
    }

    function filterProducts(products, filterKey) {
        if (!filterKey || filterKey === 'todos') return products;
        return (products || []).filter((product) => (pick(product, 'Loja', 'loja') || '').trim() === filterKey);
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
                        <th>Preco Atual</th>
                        <th>Preco Alvo</th>
                        <th>Loja</th>
                        <th>Link</th>
                        <th>Criado</th>
                        <th>Acoes</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map((product) => {
                        const id = pick(product, 'Id', 'id');
                        const link = pick(product, 'Link', 'link') || '';
                        return `
                        <tr>
                            <td>${escapeHtml(pick(product, 'Nome', 'nome') || 'N/A')}</td>
                            <td>${escapeHtml(pick(product, 'UserName', 'username') || 'N/A')}</td>
                            <td>EUR ${parseFloat(pick(product, 'PrecoAtual', 'precoatual') || 0).toFixed(2)}</td>
                            <td>EUR ${parseFloat(pick(product, 'PrecoAlvo', 'precoalvo') || 0).toFixed(2)}</td>
                            <td>${escapeHtml(pick(product, 'Loja', 'loja') || 'N/A')}</td>
                            <td>
                                ${link
                                    ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(link)}" style="color: #93c5fd; text-decoration: none;">${escapeHtml(truncateLink(link))}</a>`
                                    : 'N/A'}
                            </td>
                            <td>${formatDate(pick(product, 'DataCriacao', 'datacriacao'))}</td>
                            <td>
                                <div class="product-actions">
                                    <button type="button" class="edit-product-btn" data-id="${escapeHtml(String(id))}" title="Editar produto">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                    </button>
                                    <button type="button" class="delete-product-btn" data-id="${escapeHtml(String(id))}" title="Remover produto antigo">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                                            <path d="M10 11v6"></path>
                                            <path d="M14 11v6"></path>
                                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                                        </svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
        `;

        document.querySelectorAll('.edit-product-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                openEditModal(btn.dataset.id, cachedProducts);
            });
        });

        document.querySelectorAll('.delete-product-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                deleteProduct(btn.dataset.id, cachedProducts);
            });
        });
    }

    function applyFilter(filterKey) {
        const filtered = filterProducts(cachedProducts, filterKey);
        renderProductsTable(filtered);

        const container = document.getElementById('productFilterTabs');
        if (container) {
            container.querySelectorAll('.tab-button').forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.filter === filterKey);
            });
        }
    }

    function openEditModal(productId, products) {
        const product = (products || []).find((item) => String(pick(item, 'Id', 'id')) === String(productId));
        if (!product) {
            showAlert('Produto nao encontrado.');
            return;
        }

        document.getElementById('editProductId').value = pick(product, 'Id', 'id') || '';
        document.getElementById('editProductNome').value = pick(product, 'Nome', 'nome') || '';
        document.getElementById('editProductUser').value = pick(product, 'UserName', 'username') || 'N/A';
        document.getElementById('editProductLoja').value = pick(product, 'Loja', 'loja') || 'N/A';
        document.getElementById('editProductLink').value = pick(product, 'Link', 'link') || '';
        document.getElementById('editProductPrecoAtual').value = parseFloat(pick(product, 'PrecoAtual', 'precoatual') || 0).toFixed(2);
        document.getElementById('editProductPrecoAlvo').value = parseFloat(pick(product, 'PrecoAlvo', 'precoalvo') || 0).toFixed(2);

        const modal = document.getElementById('editProductModal');
        if (modal) modal.classList.add('show');
    }

    function closeEditModal() {
        const modal = document.getElementById('editProductModal');
        const form = document.getElementById('editProductForm');
        if (modal) modal.classList.remove('show');
        if (form) form.reset();
    }

    async function updateProduct(event) {
        event.preventDefault();

        const productId = document.getElementById('editProductId').value;
        const link = document.getElementById('editProductLink').value.trim();
        const precoAtual = parseFloat(document.getElementById('editProductPrecoAtual').value);
        const precoAlvo = parseFloat(document.getElementById('editProductPrecoAlvo').value);

        if (!link || !link.startsWith('http')) {
            showAlert('Introduza um link valido (http ou https).');
            return;
        }

        if (!Number.isFinite(precoAtual) || precoAtual < 0) {
            showAlert('Preço atual invalido.');
            return;
        }

        if (!Number.isFinite(precoAlvo) || precoAlvo <= 0) {
            showAlert('Preço alvo invalido.');
            return;
        }

        try {
            const response = await fetchAuth(`/api/admin/products/${productId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    Link: link,
                    PrecoAtual: precoAtual,
                    PrecoAlvo: precoAlvo
                })
            });

            const result = await response.json();
            const emailSent = result?.emailNotification?.sent;
            showAlert(
                emailSent
                    ? 'Produto atualizado com sucesso! O utilizador foi notificado por email sobre o novo preço.'
                    : 'Produto atualizado com sucesso!'
            );
            closeEditModal();
            await loadProducts();
        } catch (error) {
            console.error('[PRODUTOS] Erro ao atualizar produto:', error);
            showAlert(`Erro ao atualizar produto: ${error.message}`);
        }
    }

    function deleteProduct(productId, products) {
        const product = (products || []).find((item) => String(pick(item, 'Id', 'id')) === String(productId));
        const nome = pick(product, 'Nome', 'nome') || 'este produto';
        const user = pick(product, 'UserName', 'username') || 'N/A';

        showConfirm(
            `Remover "${nome}" do utilizador ${user}? Esta acao marca o produto como eliminado e nao pode ser desfeita facilmente.`,
            'Remover produto',
            async () => {
                try {
                    const response = await fetchAuth(`/api/admin/products/${productId}`, {
                        method: 'DELETE'
                    });
                    await response.json();
                    showAlert('Produto removido com sucesso!');
                    await loadProducts();
                } catch (error) {
                    console.error('[PRODUTOS] Erro ao remover produto:', error);
                    showAlert(`Erro ao remover produto: ${error.message}`);
                }
            }
        );
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
        const editForm = document.getElementById('editProductForm');
        const closeModalBtn = document.getElementById('closeEditProductModal');
        const cancelBtn = document.getElementById('cancelEditProductBtn');
        const modal = document.getElementById('editProductModal');

        if (refreshBtn) refreshBtn.addEventListener('click', loadProducts);
        if (editForm) editForm.addEventListener('submit', updateProduct);
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeEditModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeEditModal);
        if (modal) {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) closeEditModal();
            });
        }
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
        console.log('[PRODUTOS] Pagina de produtos inicializada');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
