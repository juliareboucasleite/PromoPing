/**
 * Base para paginas do painel corporativo (PerfilId = 3).
 * Valida o token real no backend e sincroniza o utilizador guardado no browser.
 */
(function() {
    'use strict';

    const TOKEN = localStorage.getItem('PROMOPING_TOKEN');
    const loginPath = '../pages/login.html';
    const supportDashboardPath = '../pages/dashboard.html';
    const apiBase = window.APIUtils
        ? window.APIUtils.getSafeApiBase()
        : (localStorage.getItem('PROMOPING_API') || 'http://localhost:3000');

    let user = null;
    try {
        const raw = localStorage.getItem('PROMOPING_USER');
        if (raw) user = JSON.parse(raw);
    } catch (_) {}

    function clearAuth() {
        localStorage.removeItem('PROMOPING_TOKEN');
        localStorage.removeItem('PROMOPING_REFRESH_TOKEN');
        localStorage.removeItem('PROMOPING_USER');
    }

    function goToLogin(message) {
        clearAuth();
        if (message) {
            sessionStorage.setItem('PROMOPING_LOGIN_MSG', message);
        }
        window.location.replace(loginPath);
    }

    if (!TOKEN) {
        goToLogin('Sessao expirada. Faca login novamente.');
        return;
    }

    window.CorporationAuth = {
        getToken: () => TOKEN,
        getUser: () => user,
        logout: () => goToLogin()
    };

    async function validateSession() {
        try {
            const response = await fetch(`${apiBase}/api/user/me`, {
                headers: {
                    'Authorization': `Bearer ${TOKEN}`
                }
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || data.status !== 'ok' || !data.user) {
                goToLogin('Sessao expirada. Faca login novamente.');
                return;
            }

            const serverUser = data.user;
            const perfilId = serverUser.perfilId !== undefined ? serverUser.perfilId : serverUser.PerfilId;
            if (perfilId === 3) {
                user = { ...serverUser, perfilId: 3, PerfilId: 3 };
                localStorage.setItem('PROMOPING_USER', JSON.stringify(user));
                return;
            }

            if (perfilId === 1) {
                user = { ...serverUser, perfilId: 1, PerfilId: 1 };
                localStorage.setItem('PROMOPING_USER', JSON.stringify(user));
                window.location.replace(supportDashboardPath);
                return;
            }

            goToLogin('A tua sessao nao tem acesso ao painel corporativo.');
        } catch (error) {
            console.error('[CORP-BASE] Falha ao validar sessao:', error);
            goToLogin('Nao foi possivel validar a sessao.');
        }
    }

    validateSession();

    document.addEventListener('DOMContentLoaded', () => {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                showConfirm('Terminar sessao?', 'Sair', () => window.CorporationAuth.logout());
            });
        }
    });
})();
