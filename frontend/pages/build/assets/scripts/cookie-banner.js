(function() {
  'use strict';

  // Verificar se o consentimento já foi dado
  function hasCookieConsent() {
    return localStorage.getItem('cookieConsent') !== null;
  }

  // Salvar preferência de cookies
  function saveCookieConsent(preference) {
    localStorage.setItem('cookieConsent', JSON.stringify({
      preference: preference,
      timestamp: new Date().toISOString()
    }));
  }

  // Mostrar o banner
  function showCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    if (banner) {
      banner.classList.add('show');
    }
  }

  // Esconder o banner
  function hideCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    if (banner) {
      banner.classList.remove('show');
      setTimeout(() => {
        banner.style.display = 'none';
      }, 300);
    }
  }

  // Aceitar todos os cookies
  function acceptAllCookies() {
    saveCookieConsent('accept-all');
    hideCookieBanner();
    console.log('Cookies aceites: todos');
    // Aqui você pode adicionar código para ativar todos os cookies/tracking
  }

  // Rejeitar todos os cookies
  function rejectAllCookies() {
    saveCookieConsent('reject-all');
    hideCookieBanner();
    console.log('Cookies rejeitados: todos');
    // Aqui você pode adicionar código para desativar todos os cookies/tracking
  }

  // Abrir modal de escolha
  function openCookieSettings() {
    const modal = document.getElementById('cookieModal');
    if (modal) {
      modal.classList.add('show');
      // Carregar preferências salvas
      loadCookiePreferences();
    }
  }

  // Fechar modal de preferências
  function closeCookieModal() {
    const modal = document.getElementById('cookieModal');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  // Carregar preferências salvas
  function loadCookiePreferences() {
    const saved = localStorage.getItem('cookiePreferences');
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        // Atualizar toggle de análises
        const analyticsToggle = document.getElementById('cookieAnalytics');
        if (analyticsToggle) {
          analyticsToggle.checked = prefs.analytics || false;
        }
      } catch (e) {
        console.error('Erro ao carregar preferências:', e);
      }
    }
  }

  // Salvar preferências personalizadas
  function saveCookiePreferences() {
    const analyticsToggle = document.getElementById('cookieAnalytics');
    const preferences = {
      analytics: analyticsToggle ? analyticsToggle.checked : false,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
    localStorage.setItem('cookieConsent', JSON.stringify({
      preference: 'custom',
      preferences: preferences,
      timestamp: new Date().toISOString()
    }));

    closeCookieModal();
    hideCookieBanner();
    console.log('Preferências de cookies salvas:', preferences);
  }

  // Aceitar tudo no modal
  function acceptAllInModal() {
    const analyticsToggle = document.getElementById('cookieAnalytics');
    if (analyticsToggle) {
      analyticsToggle.checked = true;
    }
    saveCookiePreferences();
  }

  // Rejeitar tudo no modal
  function rejectAllInModal() {
    const analyticsToggle = document.getElementById('cookieAnalytics');
    if (analyticsToggle) {
      analyticsToggle.checked = false;
    }
    saveCookiePreferences();
  }

  // Inicializar o banner
  function initCookieBanner() {
    // Verificar se já tem consentimento
    if (hasCookieConsent()) {
      return;
    }

    // Aguardar um pouco antes de mostrar o banner
    setTimeout(() => {
      showCookieBanner();
    }, 1000);

    // Adicionar event listeners aos botões
    const acceptBtn = document.getElementById('cookieAcceptAll');
    const rejectBtn = document.getElementById('cookieRejectAll');
    const chooseBtn = document.getElementById('cookieChoose');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', acceptAllCookies);
    }

    if (rejectBtn) {
      rejectBtn.addEventListener('click', rejectAllCookies);
    }

    if (chooseBtn) {
      chooseBtn.addEventListener('click', openCookieSettings);
    }

    // Event listeners do modal
    const modalAcceptAll = document.getElementById('cookieModalAcceptAll');
    const modalRejectAll = document.getElementById('cookieModalRejectAll');
    const modalSave = document.getElementById('cookieModalSave');
    const modalClose = document.getElementById('cookieModalClose');

    if (modalAcceptAll) {
      modalAcceptAll.addEventListener('click', acceptAllInModal);
    }

    if (modalRejectAll) {
      modalRejectAll.addEventListener('click', rejectAllInModal);
    }

    if (modalSave) {
      modalSave.addEventListener('click', saveCookiePreferences);
    }

    if (modalClose) {
      modalClose.addEventListener('click', closeCookieModal);
    }

    // Fechar modal ao clicar no overlay
    const modalOverlay = document.getElementById('cookieModal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
          closeCookieModal();
        }
      });
    }

    // Fechar modal com ESC
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        const modal = document.getElementById('cookieModal');
        if (modal && modal.classList.contains('show')) {
          closeCookieModal();
        }
      }
    });
  }

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieBanner);
  } else {
    initCookieBanner();
  }

  // Tornar funções disponíveis globalmente se necessário
  window.cookieBanner = {
    show: showCookieBanner,
    hide: hideCookieBanner,
    acceptAll: acceptAllCookies,
    rejectAll: rejectAllCookies
  };

})();

