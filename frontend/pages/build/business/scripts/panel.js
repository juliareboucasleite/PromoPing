/**
 * PromoPing Business Panel — shared chrome (auth gate, sidebar, common helpers).
 * Runs on every /business/{dashboard,perfil,history} page.
 *
 * Hard rule: only PerfilId 4 may stay on the page. Anything else is bounced to
 * /business/create/login. PerfilId 1/3 are admin/corporate, not business.
 */
(function () {
  const LOGIN_URL = '/business/create/login';
  const BUSINESS_PROFILE_ID = 4;

  function getToken() {
    try {
      return localStorage.getItem('token') || '';
    } catch (_) {
      return '';
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('PROMOPING_TOKEN');
    } catch (_) { /* noop */ }
  }

  function redirectToLogin() {
    window.location.replace(LOGIN_URL);
  }

  function buildAuthHeaders() {
    return {
      'Authorization': 'Bearer ' + getToken(),
      'Content-Type': 'application/json'
    };
  }

  async function fetchJson(url, options = {}) {
    const opts = Object.assign({}, options);
    opts.headers = Object.assign({}, buildAuthHeaders(), options.headers || {});
    const res = await fetch(url, opts);
    let data = {};
    try { data = await res.json(); } catch (_) { data = {}; }
    if (res.status === 401) {
      clearSession();
      redirectToLogin();
      throw new Error('Sessão expirada.');
    }
    if (!res.ok) {
      const message = (data && data.error) || ('HTTP ' + res.status);
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function initials(name) {
    if (!name) return 'B';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function paintIdentity(user, membership) {
    const nameEl = document.getElementById('bpUserName');
    const orgEl = document.getElementById('bpUserOrg');
    const avatarEl = document.getElementById('bpUserAvatar');
    const userName = (user && (user.Nome || user.nome)) || 'Business';
    const orgName = (membership && membership.organization && membership.organization.nomeEmpresa)
      || (user && (user.Email || user.email))
      || 'Sem organização';
    if (nameEl) nameEl.textContent = userName;
    if (orgEl) orgEl.textContent = orgName;
    if (avatarEl) avatarEl.textContent = initials(orgName !== 'Sem organização' ? orgName : userName);
  }

  function highlightActiveNav() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    document.querySelectorAll('[data-bp-nav]').forEach((el) => {
      const href = (el.getAttribute('href') || '').replace(/\/+$/, '');
      if (href && (href === path || path.startsWith(href + '/'))) {
        el.classList.add('is-active');
      }
    });
  }

  function bindLogout() {
    const btn = document.getElementById('bpLogout');
    if (!btn) return;
    btn.addEventListener('click', function () {
      clearSession();
      window.location.replace('/');
    });
  }

  async function bootstrap() {
    const token = getToken();
    if (!token) {
      redirectToLogin();
      return;
    }

    let user = null;
    try {
      const meRes = await fetchJson('/api/user/me');
      user = meRes && meRes.user ? meRes.user : null;
    } catch (err) {
      // 401 already handled; for any other error, send to login as a safe default
      redirectToLogin();
      return;
    }

    const perfilId = user
      ? (user.PerfilId !== undefined ? user.PerfilId : user.perfilId)
      : null;

    if (perfilId !== BUSINESS_PROFILE_ID) {
      // Wrong profile type — push them to the right place.
      if (perfilId === 1 || perfilId === 3) {
        window.location.replace('/painel-suporte-corporacao/pages_corporation/dashboard.html');
      } else {
        redirectToLogin();
      }
      return;
    }

    let businessContext = null;
    try {
      businessContext = await fetchJson('/api/business/me');
    } catch (err) {
      // Even if context fails, we keep the user on the panel and surface the error.
      console.warn('[BP] Falha a carregar contexto business:', err);
    }

    const membership = businessContext ? businessContext.activeMembership : null;
    paintIdentity(user, membership);
    highlightActiveNav();
    bindLogout();

    // Expose minimal API for page scripts.
    window.BusinessPanel = {
      user,
      membership,
      application: businessContext ? businessContext.application : null,
      memberships: businessContext ? (businessContext.memberships || []) : [],
      fetchJson,
      getToken,
      buildAuthHeaders,
      clearSession,
      redirectToLogin,
      formatCurrency: function (amount, currency) {
        if (amount === null || amount === undefined || amount === '') return '—';
        const n = Number(amount);
        if (!Number.isFinite(n)) return '—';
        try {
          return new Intl.NumberFormat('pt-PT', {
            style: 'currency',
            currency: currency || 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(n);
        } catch (_) {
          return '€' + n.toFixed(2);
        }
      },
      formatDate: function (value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        try {
          return new Intl.DateTimeFormat('pt-PT', {
            year: 'numeric', month: 'short', day: '2-digit'
          }).format(d);
        } catch (_) {
          return d.toISOString().slice(0, 10);
        }
      },
      formatDateTime: function (value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        try {
          return new Intl.DateTimeFormat('pt-PT', {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
          }).format(d);
        } catch (_) {
          return d.toISOString().slice(0, 16).replace('T', ' ');
        }
      },
      escapeHtml: function (value) {
        if (value === null || value === undefined) return '';
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
    };

    document.dispatchEvent(new CustomEvent('businesspanel:ready', {
      detail: window.BusinessPanel
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
