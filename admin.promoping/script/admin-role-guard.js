/**
 * Redireciona utilizadores corporativos (PerfilId 3) para o painel corporativo
 * quando tentam aceder às páginas do suporte (pages/).
 */
(function() {
    'use strict';
    var path = window.location.pathname || '';
    if (path.indexOf('pages_corporation') !== -1) return;
    if (path.indexOf('pages') === -1 && path.indexOf('login') === -1) return;
    try {
        var raw = localStorage.getItem('PROMOPING_USER');
        if (!raw) return;
        var user = JSON.parse(raw);
        var perfilId = user.perfilId !== undefined ? user.perfilId : user.PerfilId;
        if (perfilId === 3) {
            window.location.replace('../pages_corporation/dashboard.html');
        }
    } catch (_) {}
})();
