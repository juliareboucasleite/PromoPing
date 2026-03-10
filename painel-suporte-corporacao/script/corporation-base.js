/**
 * Base para páginas do painel corporativo (PerfilId = 3).
 * Redireciona para login se não autenticado ou se não for utilizador corporativo.
 */
(function() {
    'use strict';
    const TOKEN = localStorage.getItem('PROMOPING_TOKEN');
    let user = null;
    try {
        const raw = localStorage.getItem('PROMOPING_USER');
        if (raw) user = JSON.parse(raw);
    } catch (_) {}
    const perfilId = user && (user.perfilId !== undefined ? user.perfilId : user.PerfilId);
    const isCorporation = perfilId === 3;
    const loginPath = '../pages/login.html';

    if (!TOKEN || !isCorporation) {
        if (!TOKEN) sessionStorage.setItem('PROMOPING_LOGIN_MSG', 'Sessão expirada. Faça login novamente.');
        window.location.replace(loginPath);
    }

    window.CorporationAuth = {
        getToken: () => TOKEN,
        getUser: () => user,
        logout: () => {
            localStorage.removeItem('PROMOPING_TOKEN');
            localStorage.removeItem('PROMOPING_REFRESH_TOKEN');
            localStorage.removeItem('PROMOPING_USER');
            window.location.replace(loginPath);
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => {
            showConfirm('Terminar sessão?', 'Sair', () => window.CorporationAuth.logout());
        });
    });
})();
