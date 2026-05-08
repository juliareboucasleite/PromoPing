/* Dashboard Sidebar (Stripe-style) — injects a fixed left nav into every
   dashboard page. Loaded with `defer` from each HTML. */
(function() {
    var SIDEBAR_HTML =
        '<aside class="sidebar-nav" aria-label="Main navigation">' +
            '<a href="/dashboard" class="sidebar-brand">' +
                '<img src="/frontend/pages/build/assets/images/PromoPing.png" alt="PromoPing" class="sidebar-logo" onerror="this.src=\'/assets/images/PromoPing.png\';this.onerror=null;">' +
                '<span class="sidebar-brand-name">PromoPing</span>' +
            '</a>' +
            '<nav class="sidebar-menu">' +
                '<a href="/dashboard" data-match="/dashboard,/dashboard/dashboard-home.html" class="sidebar-item">' +
                    '<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        '<path d="M3 12l9-9 9 9"/>' +
                        '<path d="M5 10v10a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V10"/>' +
                    '</svg>' +
                    'Dashboard' +
                '</a>' +
                '<a href="/dashboard/produtos" data-match="/dashboard/produtos,/dashboard/monitored-products.html" class="sidebar-item">' +
                    '<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' +
                        '<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>' +
                        '<line x1="12" y1="22.08" x2="12" y2="12"/>' +
                    '</svg>' +
                    'Products' +
                '</a>' +
                '<a href="/dashboard/planos" data-match="/dashboard/planos,/dashboard/subscription-plans.html" class="sidebar-item">' +
                    '<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
                    '</svg>' +
                    'Plans' +
                '</a>' +
                '<a href="/dashboard/perfil" data-match="/dashboard/perfil,/dashboard/account-profile.html" class="sidebar-item">' +
                    '<svg class="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
                        '<circle cx="12" cy="7" r="4"/>' +
                    '</svg>' +
                    'Profile' +
                '</a>' +
            '</nav>' +
            '<div class="sidebar-footer">' +
                '<div class="sidebar-user">' +
                    '<span class="sidebar-user-name" id="sidebarUserName">User</span>' +
                    '<span class="sidebar-user-email" id="sidebarUserEmail"></span>' +
                '</div>' +
                '<button type="button" class="sidebar-logout" id="sidebarLogoutBtn" aria-label="Sign out" title="Sign out">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
                        '<polyline points="16 17 21 12 16 7"/>' +
                        '<line x1="21" y1="12" x2="9" y2="12"/>' +
                    '</svg>' +
                '</button>' +
            '</div>' +
        '</aside>';

    function logoFallback() {
        var img = document.querySelector('.sidebar-logo');
        if (!img) return;
        var candidates = [
            '../../assets/images/PromoPing.png',
            '/assets/images/PromoPing.png',
            'assets/images/PromoPing.png'
        ];
        var i = 0;
        img.addEventListener('error', function tryNext() {
            if (i >= candidates.length) {
                img.removeEventListener('error', tryNext);
                return;
            }
            img.src = candidates[i++];
        });
    }

    function markActive() {
        var path = window.location.pathname.replace(/\/$/, '') || '/';
        var items = document.querySelectorAll('.sidebar-item');
        var bestMatch = null;
        var bestLen = -1;
        items.forEach(function(item) {
            var raw = item.getAttribute('data-match') || item.getAttribute('href') || '';
            var matches = raw.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
            matches.forEach(function(m) {
                var normalized = m.replace(/\/$/, '') || '/';
                if (path === normalized || path.indexOf(normalized + '/') === 0 || path.endsWith(m)) {
                    if (m.length > bestLen) {
                        bestMatch = item;
                        bestLen = m.length;
                    }
                }
            });
        });
        if (bestMatch) bestMatch.classList.add('is-active');
    }

    function syncUser() {
        var sidebarName = document.getElementById('sidebarUserName');
        var sidebarEmail = document.getElementById('sidebarUserEmail');
        var topName = document.getElementById('userName');
        var emailField = document.getElementById('email');

        function copy() {
            if (topName && sidebarName && topName.textContent && topName.textContent.trim() !== 'User') {
                sidebarName.textContent = topName.textContent.trim();
            }
            if (emailField && sidebarEmail && emailField.value) {
                sidebarEmail.textContent = emailField.value;
            }
        }
        copy();
        var attempts = 0;
        var iv = setInterval(function() {
            attempts++;
            copy();
            if (attempts > 60) clearInterval(iv); // ~30s
        }, 500);
    }

    function bindLogout() {
        var btn = document.getElementById('sidebarLogoutBtn');
        if (!btn) return;
        btn.addEventListener('click', function() {
            if (typeof window.logout === 'function') {
                window.logout();
                return;
            }
            try { localStorage.removeItem('token'); } catch (e) {}
            window.location.href = '/index.html';
        });
    }

    function inject() {
        if (document.querySelector('.sidebar-nav')) return;
        var wrapper = document.createElement('div');
        wrapper.innerHTML = SIDEBAR_HTML;
        var sidebar = wrapper.firstChild;
        document.body.insertBefore(sidebar, document.body.firstChild);
        document.body.classList.add('has-sidebar');
        logoFallback();
        markActive();
        syncUser();
        bindLogout();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }
})();
