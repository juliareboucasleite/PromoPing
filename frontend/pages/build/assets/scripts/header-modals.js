// Garantir que as funções estejam no escopo global - tipo window pra não dar merda depois
window.openLoginModal = function() {
  const overlay = document.getElementById('modalOverlay');
  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');
  
  // Se não tiver os elementos essenciais, vaza logo pra não quebrar tudo
  if (!overlay || !loginModal) {
    console.error('Elementos não encontrados:', { overlay, loginModal });
    return;
  }
  
  // Fecha o modal de registro se tiver aberto (não pode ter dois modais abertos ao mesmo tempo)
  if (registerModal) {
    registerModal.style.display = 'none';
  }
  
  // Limpa as mensagens de erro/sucesso anteriores - tipo resetar o estado do modal
  const errorElement = document.getElementById('loginErrorrMessage');
  const successElement = document.getElementById('loginSuccessMessage');
  if (errorElement) {
    errorElement.textContent = '';
    errorElement.style.display = 'none';
  }
  if (successElement) {
    successElement.textContent = '';
    successElement.style.display = 'none';
  }
  // Reset do passo 2FA: mostrar formulário normal, esconder passo de código
  const loginFormReset = document.getElementById('loginForm');
  const step2FA = document.getElementById('login2FAStep');
  const dividerOU = document.getElementById('loginDividerOU');
  const socialOptions = document.querySelector('.social-login-options');
  if (loginFormReset) loginFormReset.style.display = '';
  if (step2FA) { step2FA.style.display = 'none'; delete step2FA.dataset.tempToken; }
  if (dividerOU) dividerOU.style.display = '';
  if (socialOptions) socialOptions.style.display = '';
  const sendEmailBtn = document.getElementById('login2FASendEmail');
  if (sendEmailBtn) sendEmailBtn.textContent = 'Enviar código por email';

  // Mostra o modal e bloqueia o scroll da página (pra não rolar enquanto o modal tá aberto)
  loginModal.style.display = 'block';
  overlay.style.display = 'flex';
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden'; // trava o scroll do body
};

window.openRegisterModal = function() {
  const overlay = document.getElementById('modalOverlay');
  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');
  
  // Se não tiver os elementos essenciais, vaza logo pra não quebrar tudo
  if (!overlay || !registerModal) {
    console.error('Elementos não encontrados:', { overlay, registerModal });
    return;
  }
  
  // Ocultar modal de login
  if (loginModal) {
    loginModal.style.display = 'none';
  }
  
  // Mostrar modal de registro
  registerModal.style.display = 'block';
  overlay.style.display = 'flex';
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Re-inicializa o posicionamento dos tooltips (tem que dar um delayzinho pro DOM renderizar direito)
  setTimeout(() => {
    positionInfoTooltip();
  }, 100);
};

// Funções wrapper pra manter compatibilidade com código antigo que chama direto (sem window.)
function openLoginModal() {
  window.openLoginModal();
}

function openRegisterModal() {
  window.openRegisterModal();
}

// Fecha TODOS os modais de uma vez - tipo reset geral
window.closeModals = function() {
  const overlay = document.getElementById('modalOverlay');
  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');
  const verificationModal = document.getElementById('verificationModal');
  
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'none';
    if (verificationModal) verificationModal.style.display = 'none';
    document.body.style.overflow = ''; // libera o scroll de novo
  }
};

// Modal do QR code pra login: código muda a cada 30s; telemóvel escaneia e confirma.
var qrSessionId = null;
var qrRefreshInterval = null;
var qrPollInterval = null;
var qrImgElement = null;

function stopQRLoginIntervals() {
  if (qrRefreshInterval) {
    clearInterval(qrRefreshInterval);
    qrRefreshInterval = null;
  }
  if (qrPollInterval) {
    clearInterval(qrPollInterval);
    qrPollInterval = null;
  }
  qrSessionId = null;
}

function updateQRCodeImage(dataUrl) {
  var container = document.getElementById('qrCodePlaceholder');
  if (!container) return;
  // Esconde o conteúdo placeholder (svg + texto)
  var placeholderContent = container.querySelector('svg');
  var placeholderText = container.querySelector('.qr-placeholder-text');
  if (placeholderContent) placeholderContent.style.display = 'none';
  if (placeholderText) placeholderText.style.display = 'none';
  // Mostra a imagem do QR
  if (!qrImgElement) {
    qrImgElement = document.createElement('img');
    qrImgElement.alt = 'Código QR para login';
    qrImgElement.className = 'qr-code-image';
    qrImgElement.setAttribute('width', '280');
    qrImgElement.setAttribute('height', '280');
    container.appendChild(qrImgElement);
  }
  qrImgElement.src = dataUrl;
  qrImgElement.style.display = 'block';
}

function resetQRPlaceholder() {
  var container = document.getElementById('qrCodePlaceholder');
  if (!container) return;
  var placeholderContent = container.querySelector('svg');
  var placeholderText = container.querySelector('.qr-placeholder-text');
  if (placeholderContent) placeholderContent.style.display = '';
  if (placeholderText) placeholderText.style.display = '';
  if (qrImgElement) {
    qrImgElement.style.display = 'none';
    qrImgElement.removeAttribute('src');
  }
}

function fetchQRSession(sessionId) {
  var url = '/api/auth/qr-session';
  if (sessionId) url += '?sessionId=' + encodeURIComponent(sessionId);
  var requestFn = (typeof makeRequest === 'function') ? makeRequest : fetch;
  return requestFn(url).then(function (res) { return res.json(); });
}

function pollQRSessionStatus(sessionId) {
  var requestFn = (typeof makeRequest === 'function') ? makeRequest : fetch;
  return requestFn('/api/auth/qr-session/poll?sessionId=' + encodeURIComponent(sessionId))
    .then(function (res) { return res.json(); });
}

window.openQRModal = function() {
  var qrModal = document.getElementById('qrModal');
  if (!qrModal) {
    console.error('Modal QR não encontrado');
    return;
  }

  window.closeModals();
  qrModal.classList.add('show');
  document.body.style.overflow = 'hidden';

  stopQRLoginIntervals();
  resetQRPlaceholder();

  fetchQRSession(null)
    .then(function (data) {
      if (data.status === 'confirmed') return;
      qrSessionId = data.sessionId;
      if (data.qrImageDataUrl) {
        updateQRCodeImage(data.qrImageDataUrl);
      }
      // Atualiza o QR a cada 25s (antes de expirar o código de 30s)
      qrRefreshInterval = setInterval(function () {
        if (!qrSessionId) return;
        fetchQRSession(qrSessionId).then(function (next) {
          if (next.status === 'confirmed') return;
          if (next.qrImageDataUrl) updateQRCodeImage(next.qrImageDataUrl);
        }).catch(function () {});
      }, 25000);
      // Poll a cada 3s para ver se o telemóvel confirmou (evita rate limit)
      qrPollInterval = setInterval(function () {
        if (!qrSessionId) return;
        pollQRSessionStatus(qrSessionId).then(function (status) {
          if (status.status !== 'confirmed') return;
          stopQRLoginIntervals();
          // Só redireciona se tivermos um token válido (evita "jwt malformed" no dashboard)
          var token = status.token && String(status.token).trim();
          if (!token || token.length < 20) {
            var placeholderText = document.querySelector('#qrCodePlaceholder .qr-placeholder-text');
            if (placeholderText) {
              placeholderText.textContent = 'Sessão confirmada mas token em falta. Fecha e tenta outra vez.';
              placeholderText.style.display = 'block';
            }
            return;
          }
          localStorage.setItem('token', token);
          if (status.refreshToken) localStorage.setItem('PROMOPING_TOKEN', status.refreshToken);
          window.closeQRModal();
          window.location.href = '/dashboard';
        }).catch(function (err) {
          if (err && err.message && err.message.indexOf('Rate limit') !== -1) {
            var placeholderText = document.querySelector('#qrCodePlaceholder .qr-placeholder-text');
            if (placeholderText) {
              placeholderText.textContent = 'Muitas tentativas. Espera uns minutos e tenta outra vez.';
              placeholderText.style.display = 'block';
            }
          }
        });
      }, 3000);
    })
    .catch(function (err) {
      console.error('Error ao obter sessão QR:', err);
      var placeholderText = document.querySelector('#qrCodePlaceholder .qr-placeholder-text');
      if (placeholderText) {
        placeholderText.textContent = 'Error ao carregar o código. Tenta novamente.';
        placeholderText.style.display = 'block';
      }
    });
};

window.closeQRModal = function() {
  stopQRLoginIntervals();
  resetQRPlaceholder();
  var qrModal = document.getElementById('qrModal');
  if (qrModal) {
    qrModal.classList.remove('show');
    document.body.style.overflow = '';
  }
};

function openQRModal() {
  window.openQRModal();
}

function closeQRModal() {
  window.closeQRModal();
}

// Abre o modal de verificação de email (quando o user se registra, precisa verificar o email)
window.openVerificationModal = function(email) {
  const overlay = document.getElementById('modalOverlay');
  const verificationModal = document.getElementById('verificationModal');
  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');
  
  if (!overlay || !verificationModal) {
    console.error('Elementos não encontrados:', { overlay, verificationModal });
    return;
  }
  
  // Ocultar outros modais
  if (loginModal) loginModal.style.display = 'none';
  if (registerModal) registerModal.style.display = 'none';
  
  // Mostrar email no modal
  const emailSpan = document.getElementById('verificationEmail');
  if (emailSpan && email) {
    emailSpan.textContent = email;
  }
  
  // Limpa os campos e mensagens anteriores (reset completo)
  const codeInput = document.getElementById('verificationCode');
  if (codeInput) codeInput.value = '';
  
  const errorMsg = document.getElementById('verificationErrorrMessage');
  const successMsg = document.getElementById('verificationSuccessMessage');
  if (errorMsg) errorMsg.textContent = '';
  if (successMsg) successMsg.textContent = '';
  
  // Mostra o modal e trava o scroll
  verificationModal.style.display = 'block';
  overlay.style.display = 'flex';
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Foca no input do código automaticamente (UX melhor - user já pode começar a digitar)
  setTimeout(() => {
    if (codeInput) codeInput.focus();
  }, 100);
};

// Manter compatibilidade
function closeModals() {
  window.closeModals();
}

// Inicializa os modais quando a página carrega - garante que começam todos fechados
function initializeModals() {
  const overlay = document.getElementById('modalOverlay');
  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');
  
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
  if (loginModal) {
    loginModal.style.display = 'none';
  }
  if (registerModal) {
    registerModal.style.display = 'none';
  }
}

// Garante que os modais estejam todos fechados quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
  initializeModals();
  
  // Faz de novo depois de um tempo porque o header pode carregar depois (async loading e essas merdas)
  setTimeout(initializeModals, 500);
});

// Tornar a função disponível globalmente
window.initializeModals = initializeModals;

// Fecha os modais quando o user aperta ESC (padrão de UX - todo mundo espera isso funcionar)
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeModals();
  }
});


// Mostra/esconde a senha no login (aquele olhinho que todo mundo usa)
function toggleLoginPassword() {
  const passwordInput = document.getElementById("loginPassword");
  const toggleBtn = document.querySelector("#loginModal .password-toggle");

  if (passwordInput && toggleBtn) {
    // Se tá escondida, mostra (troca pra text)
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      toggleBtn.innerHTML = `
        <svg aria-hidden="true" aria-label="" class="eye-icon" height="16" role="img" viewBox="0 0 24 24" width="16">
          <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6m11.8 3.4a.9.9 0 0 0 0-.8c-.21-.43-.63-1.19-1.23-2.08C20.77 6.86 17.24 3 12 3 6.65 3 3.1 7.02 1.32 9.69.78 10.5.4 11.19.19 11.6a.9.9 0 0 0 0 .8 23 23 0 0 0 1.24 2.08C3.23 17.14 6.76 21 12 21c5.35 0 8.9-4.02 10.68-6.69m-1.66-1.11a17 17 0 0 1-3.25 3.63A9.2 9.2 0 0 1 12 19a9.2 9.2 0 0 1-5.77-2.17q-.54-.43-1.02-.9c-.93-.92-1.68-1.9-2.23-2.73a2.1 2.1 0 0 1 0-2.4 17 17 0 0 1 3.25-3.63A9.2 9.2 0 0 1 12 5c2.28 0 4.21.92 5.77 2.17q.54.43 1.02.9c.93.92 1.68 1.9 2.23 2.73.49.74.49 1.66 0 2.4"></path>
          <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;
    } else {
      passwordInput.type = "password";
      toggleBtn.innerHTML = `
        <svg aria-hidden="true" aria-label="" class="eye-icon" height="16" role="img" viewBox="0 0 24 24" width="16">
          <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6m11.8 3.4a.9.9 0 0 0 0-.8c-.21-.43-.63-1.19-1.23-2.08C20.77 6.86 17.24 3 12 3 6.65 3 3.1 7.02 1.32 9.69.78 10.5.4 11.19.19 11.6a.9.9 0 0 0 0 .8 23 23 0 0 0 1.24 2.08C3.23 17.14 6.76 21 12 21c5.35 0 8.9-4.02 10.68-6.69m-1.66-1.11a17 17 0 0 1-3.25 3.63A9.2 9.2 0 0 1 12 19a9.2 9.2 0 0 1-5.77-2.17q-.54-.43-1.02-.9c-.93-.92-1.68-1.9-2.23-2.73a2.1 2.1 0 0 1 0-2.4 17 17 0 0 1 3.25-3.63A9.2 9.2 0 0 1 12 5c2.28 0 4.21.92 5.77 2.17q.54.43 1.02.9c.93.92 1.68 1.9 2.23 2.73.49.74.49 1.66 0 2.4"></path>
        </svg>
      `;
    }
  }
}

function toggleRegisterPassword() {
  const passwordInput = document.getElementById("registerPassword");
  const toggleBtn = document.getElementById("toggle-registerPassword");

  if (passwordInput && toggleBtn) {
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      toggleBtn.innerHTML = `
        <svg aria-hidden="true" aria-label="" class="eye-icon" height="16" role="img" viewBox="0 0 24 24" width="16">
          <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6m11.8 3.4a.9.9 0 0 0 0-.8c-.21-.43-.63-1.19-1.23-2.08C20.77 6.86 17.24 3 12 3 6.65 3 3.1 7.02 1.32 9.69.78 10.5.4 11.19.19 11.6a.9.9 0 0 0 0 .8 23 23 0 0 0 1.24 2.08C3.23 17.14 6.76 21 12 21c5.35 0 8.9-4.02 10.68-6.69m-1.66-1.11a17 17 0 0 1-3.25 3.63A9.2 9.2 0 0 1 12 19a9.2 9.2 0 0 1-5.77-2.17q-.54-.43-1.02-.9c-.93-.92-1.68-1.9-2.23-2.73a2.1 2.1 0 0 1 0-2.4 17 17 0 0 1 3.25-3.63A9.2 9.2 0 0 1 12 5c2.28 0 4.21.92 5.77 2.17q.54.43 1.02.9c.93.92 1.68 1.9 2.23 2.73.49.74.49 1.66 0 2.4"></path>
          <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;
    } else {
      passwordInput.type = "password";
      toggleBtn.innerHTML = `
        <svg aria-hidden="true" aria-label="" class="eye-icon" height="16" role="img" viewBox="0 0 24 24" width="16">
          <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6m11.8 3.4a.9.9 0 0 0 0-.8c-.21-.43-.63-1.19-1.23-2.08C20.77 6.86 17.24 3 12 3 6.65 3 3.1 7.02 1.32 9.69.78 10.5.4 11.19.19 11.6a.9.9 0 0 0 0 .8 23 23 0 0 0 1.24 2.08C3.23 17.14 6.76 21 12 21c5.35 0 8.9-4.02 10.68-6.69m-1.66-1.11a17 17 0 0 1-3.25 3.63A9.2 9.2 0 0 1 12 19a9.2 9.2 0 0 1-5.77-2.17q-.54-.43-1.02-.9c-.93-.92-1.68-1.9-2.23-2.73a2.1 2.1 0 0 1 0-2.4 17 17 0 0 1 3.25-3.63A9.2 9.2 0 0 1 12 5c2.28 0 4.21.92 5.77 2.17q.54.43 1.02.9c.93.92 1.68 1.9 2.23 2.73.49.74.49 1.66 0 2.4"></path>
        </svg>
      `;
    }
  }
}

// Verifica a força da senha enquanto o user digita (pra ele saber se a senha é uma merda ou não)
function checkPasswordStrength(password) {
  const indicator = document.getElementById('passwordStrengthIndicator');
  const fill = document.getElementById('passwordStrengthFill');
  const status = document.getElementById('passwordStrengthStatus');

  // Se não tiver os elementos, vaza
  if (!indicator || !fill || !status) return;

  // Se não tiver senha, esconde o indicador
  if (!password || password.length === 0) {
    indicator.style.display = 'none';
    return;
  }

  indicator.style.display = 'block';

  let strength = 0;
  let strengthClass = 'weak';
  let statusText = 'Complica ainda mais';

  // Conta pontos baseado no tamanho (quanto maior, melhor)
  if (password.length >= 8) strength += 1;
  if (password.length >= 12) strength += 1;

  // Conta pontos baseado na variedade de caracteres (tem minúscula? maiúscula? número? símbolo?)
  if (/[a-z]/.test(password)) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 1;

  // Define o nível de força baseado na pontuação (quanto mais pontos, mais forte)
  if (strength <= 2) {
    strengthClass = 'weak'; // senha fraca pra caralho
    statusText = 'Complica ainda mais';
  } else if (strength === 3) {
    strengthClass = 'fair'; // ainda tá fraco
    statusText = 'Complica ainda mais';
  } else if (strength === 4) {
    strengthClass = 'good'; // tá começando a ficar bom
    statusText = 'Está com bom aspeto';
  } else if (strength === 5) {
    strengthClass = 'strong'; // agora sim tá forte
    statusText = 'Está com bom aspeto';
  } else if (strength >= 6) {
    strengthClass = 'perfect'; // perfeito, senha do caralho
    statusText = 'Perfeito!';
  }

  // Atualiza a UI com a classe e texto correspondentes
  fill.className = 'password-strength-fill ' + strengthClass;
  status.textContent = statusText;
}

// Make function globally available
window.checkPasswordStrength = checkPasswordStrength;

// Posiciona os tooltips de forma inteligente pra não causar scroll horizontal (que é uma merda)
function positionInfoTooltip() {
  const iconWrappers = document.querySelectorAll('.info-icon-wrapper');
  
  iconWrappers.forEach(wrapper => {
    const icon = wrapper.querySelector('.info-icon');
    const tooltip = wrapper.querySelector('.info-tooltip');
    
    if (!icon || !tooltip) return;
    
    wrapper.addEventListener('mouseenter', () => {
      const iconRect = icon.getBoundingClientRect();
      const tooltipWidth = 240;
      const spacing = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Calcula a posição ideal (começa tentando colocar à direita do ícone)
      let left = iconRect.right + spacing;
      let top = iconRect.top + (iconRect.height / 2);
      
      // Se não cabe à direita (vai sair da tela), tenta colocar à esquerda
      if (left + tooltipWidth > viewportWidth - 20) {
        left = iconRect.left - tooltipWidth - spacing;
      }
      
      // Se não cabe à esquerda também (tela muito pequena), centraliza na tela
      if (left < 20) {
        left = Math.max(20, (viewportWidth - tooltipWidth) / 2);
      }
      
      // Ajusta verticalmente se o tooltip vai sair da tela em cima ou embaixo
      const tooltipHeight = tooltip.offsetHeight || 100;
      if (top + tooltipHeight / 2 > viewportHeight - 20) {
        top = viewportHeight - tooltipHeight / 2 - 20;
      }
      if (top - tooltipHeight / 2 < 20) {
        top = tooltipHeight / 2 + 20;
      }
      
      tooltip.style.position = 'fixed';
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
      tooltip.style.transform = 'translateY(-50%)';
      tooltip.style.margin = '0';
    });
  });
}

// Initialize tooltip positioning when modals are ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    positionInfoTooltip();
  }, 500);
});

// Re-initialize when register modal opens
window.addEventListener('registerModalOpened', () => {
  setTimeout(() => {
    positionInfoTooltip();
  }, 100);
});

// Toda a lógica de login, registro e verificação fica aqui
document.addEventListener('DOMContentLoaded', function() {
  // Espera o makeRequest estar disponível (pode carregar depois, então tem que esperar)
  function waitForMakeRequest(callback, maxAttempts = 50) {
    if (typeof makeRequest === 'function') {
      callback();
    } else if (maxAttempts > 0) {
      // Tenta de novo depois de 100ms (tipo polling até o script carregar)
      setTimeout(() => waitForMakeRequest(callback, maxAttempts - 1), 100);
    }
  }

  waitForMakeRequest(() => {
    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      // Limpa as mensagens de erro quando o user começa a digitar de novo (UX melhor)
      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');
      const errorElement = document.getElementById('loginErrorrMessage');
      
      // Função pra limpar o erro (reutilizável)
      const clearErrorr = () => {
        if (errorElement) {
          errorElement.textContent = '';
          errorElement.style.display = 'none';
        }
      };
      
      if (emailInput) {
        emailInput.addEventListener('input', clearErrorr);
        emailInput.addEventListener('focus', clearErrorr);
      }
      
      if (passwordInput) {
        passwordInput.addEventListener('input', clearErrorr);
        passwordInput.addEventListener('focus', clearErrorr);
      }
      
      // Handler do submit do formulário de login
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // previne o submit padrão (não queremos reload da página)
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        // Validação básica - se não tiver email ou senha, nem tenta fazer request
        if (!email || !password) {
          return;
        }

        // Desabilita o botão durante o login pra evitar múltiplos submits (que é uma merda)
        const submitButton = loginForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton ? submitButton.querySelector('.button-text')?.textContent : null;
        
        if (submitButton) {
          submitButton.disabled = true;
          if (submitButton.querySelector('.button-text')) {
            submitButton.querySelector('.button-text').textContent = "A iniciar sessão...";
          }
        }

        try {
          // Usa makeRequest se disponível, senão usa fetch normal (fallback)
          const requestFn = (typeof makeRequest === 'function') ? makeRequest : fetch;
          const res = await requestFn("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
          });

          // Tenta fazer parse do JSON (pode dar erro se a resposta não for JSON válido)
          let data;
          try {
            data = await res.json();
          } catch (parseErrorr) {
            console.error("Error ao fazer parse da resposta:", parseErrorr);
            throw new Errorr("Resposta inválida do servidor");
          }

          // Se login exige 2FA, mostrar passo de código (esconder só o form, não o wrapper)
          if (res.ok && data.status === "ok" && data.requires2FA && data.tempToken) {
            const step2FA = document.getElementById("login2FAStep");
            const dividerOU = document.getElementById("loginDividerOU");
            const socialOptions = document.querySelector(".social-login-options");
            loginForm.style.display = "none";
            if (dividerOU) dividerOU.style.display = "none";
            if (socialOptions) socialOptions.style.display = "none";
            if (step2FA) {
              step2FA.style.display = "block";
              step2FA.dataset.tempToken = data.tempToken;
              const codeInput = document.getElementById("login2FACode");
              if (codeInput) codeInput.value = "";
            }
            if (submitButton) submitButton.disabled = false;
            if (submitButton && submitButton.querySelector(".button-text") && originalButtonText) {
              submitButton.querySelector(".button-text").textContent = originalButtonText;
            }
            return;
          }

          // Se deu tudo certo e tem token, salva e redireciona
          if (res.ok && data.status === "ok" && data.token) {
            localStorage.setItem("token", data.token); // salva o token pra usar depois
            // Se a conta foi reativada, marca isso (pra mostrar mensagem no dashboard)
            if (data.accountReactivated) {
              localStorage.setItem("accountReactivated", "true");
            }
            // Redireciona direto pro dashboard (sem notificação chata)
            window.location.href = "/dashboard";
          } else {
            // Se deu erro, mostra a mensagem de erro no modal
            const errorMessage = data.error || data.message || "Incorrect email or password";
            
            const errorElement = document.getElementById('loginErrorrMessage');
            if (errorElement) {
              errorElement.textContent = errorMessage;
              errorElement.style.display = 'block';
            }
          }
        } catch (err) {
          // Error de rede ou qualquer outra merda que deu errado
          console.error("Sign-in error:", err);
          const errorMessage = err.message || "Server connection error";
          
          const errorElement = document.getElementById('loginErrorrMessage');
          if (errorElement) {
            errorElement.textContent = errorMessage;
            errorElement.style.display = 'block';
          }
        } finally {
          // Sempre reabilita o botão, mesmo se deu erro (pra user poder tentar de novo)
          if (submitButton) {
            submitButton.disabled = false;
            if (submitButton.querySelector('.button-text') && originalButtonText) {
              submitButton.querySelector('.button-text').textContent = originalButtonText;
            }
          }
        }
      });
    }

    // 2FA: Verify código após login
    const login2FAVerifyBtn = document.getElementById('login2FAVerify');
    if (login2FAVerifyBtn) {
      login2FAVerifyBtn.addEventListener('click', async () => {
        const stepEl = document.getElementById('login2FAStep');
        const codeInput = document.getElementById('login2FACode');
        if (!stepEl || !codeInput) return;
        const tempToken = stepEl.dataset.tempToken;
        const code = codeInput.value.trim();
        if (!tempToken || !code) {
          const errEl = document.getElementById('loginErrorrMessage');
          if (errEl) { errEl.textContent = 'Enter the code.'; errEl.style.display = 'block'; }
          return;
        }
        login2FAVerifyBtn.disabled = true;
        try {
          const requestFn = (typeof makeRequest === 'function') ? makeRequest : fetch;
          const res = await requestFn('/api/auth/2fa/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempToken, code })
          });
          const data = await res.json();
          if (res.ok && data.status === 'ok' && data.token) {
            localStorage.setItem('token', data.token);
            window.location.href = '/dashboard';
          } else {
            const errEl = document.getElementById('loginErrorrMessage');
            if (errEl) { errEl.textContent = data.error || 'Invalid code.'; errEl.style.display = 'block'; }
            login2FAVerifyBtn.disabled = false;
          }
        } catch (e) {
          const errEl = document.getElementById('loginErrorrMessage');
          if (errEl) { errEl.textContent = 'Connection error.'; errEl.style.display = 'block'; }
          login2FAVerifyBtn.disabled = false;
        }
      });
    }

    // 2FA: Enviar código por email
    const login2FASendEmailBtn = document.getElementById('login2FASendEmail');
    if (login2FASendEmailBtn) {
      login2FASendEmailBtn.addEventListener('click', async () => {
        const stepEl = document.getElementById('login2FAStep');
        if (!stepEl) return;
        const tempToken = stepEl.dataset.tempToken;
        if (!tempToken) return;
        login2FASendEmailBtn.disabled = true;
        try {
          const requestFn = (typeof makeRequest === 'function') ? makeRequest : fetch;
          const res = await requestFn('/api/auth/2fa/send-email-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempToken })
          });
          const data = await res.json();
          if (res.ok && data.sent) {
            const errEl = document.getElementById('loginErrorrMessage');
            if (errEl) { errEl.style.display = 'none'; }
            login2FASendEmailBtn.textContent = 'Code sent. Check your email.';
          }
        } catch (e) {}
        login2FASendEmailBtn.disabled = false;
      });
    }

    // Login com Google - redireciona direto pro endpoint OAuth
    const btnGoogleLogin = document.getElementById('btnGoogleLogin');
    if (btnGoogleLogin) {
      btnGoogleLogin.addEventListener('click', () => {
        window.location.href = "/auth/google";
      });
    }

    // Login com Discord - primeiro verifica se o user já existe, depois redireciona
    const btnDiscordLogin = document.getElementById('btnDiscordLogin');
    if (btnDiscordLogin) {
      btnDiscordLogin.addEventListener('click', async () => {
        try {
          const requestFn = (typeof makeRequest === 'function') ? makeRequest : fetch;
          const response = await requestFn(`/auth/discord/check/916737425978589235`);
          const data = await response.json();

          // Se já existe, faz login direto. Se não, vai pro fluxo de registro
          if (data.exists) {
            window.location.href = "/auth/discord/direct/916737425978589235";
          } else {
            window.location.href = "/auth/discord";
          }
        } catch (error) {
          // Se der erro, tenta o fluxo normal mesmo
          console.error("Error ao verificar usuário Discord:", error);
          window.location.href = "/auth/discord";
        }
      });
    }

    // QR Code Login
    const btnQRCodeLogin = document.getElementById('btnQRCodeLogin');
    if (btnQRCodeLogin) {
      btnQRCodeLogin.addEventListener('click', () => {
        openQRModal();
      });
    }

    // QR Modal Controls
    const qrModalBack = document.getElementById('qrModalBack');
    const qrModalClose = document.getElementById('qrModalClose');
    const qrModal = document.getElementById('qrModal');

    if (qrModalBack) {
      qrModalBack.addEventListener('click', () => {
        closeQRModal();
        openLoginModal();
      });
    }

    if (qrModalClose) {
      qrModalClose.addEventListener('click', () => {
        closeQRModal();
      });
    }

    // Fechar modal QR ao clicar no overlay
    if (qrModal) {
      qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) {
          closeQRModal();
        }
      });
    }

    // Fechar modal QR com ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const qrModal = document.getElementById('qrModal');
        if (qrModal && qrModal.classList.contains('show')) {
          closeQRModal();
        }
      }
    });

    // Register Form
    const regForm = document.getElementById('regForm');
    const registerPasswordInput = document.getElementById('registerPassword');
    
    // Password strength checker
    if (registerPasswordInput) {
      registerPasswordInput.addEventListener('input', (e) => {
        checkPasswordStrength(e.target.value);
      });
    }

    if (regForm) {
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const birthdate = document.getElementById('registerBirthdate').value;
        const nome = document.getElementById('registerNome')?.value.trim() || email.split("@")[0];

        if (!email || !email.includes("@")) {
          if (typeof window.showErrorr === 'function') {
            window.showErrorr("Error", "Please enter a valid email");
          }
          return;
        }

        if (password.length < 8) {
          if (typeof window.showErrorr === 'function') {
            window.showErrorr("Error", "The password must be at least 8 characters long");
          }
          return;
        }

        if (!birthdate) {
          if (typeof window.showErrorr === 'function') {
            window.showErrorr("Error", "Please enter your birth date");
          }
          return;
        }

        // Valida idade mínima (13 anos - GDPR e essas merdas legais)
        const birthDate = new Date(birthdate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        // Ajusta se ainda não fez aniversário esse ano
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }

        // Se for menor de 13, não deixa criar conta
        if (age < 13) {
          if (typeof window.showErrorr === 'function') {
            window.showErrorr("Error", "You must be at least 13 years old to create a PromoPing account");
          }
          if (btnCriar) {
            btnCriar.disabled = false;
            btnCriar.querySelector('.button-text').textContent = "Continue";
          }
          return;
        }

        const btnCriar = document.getElementById('btnCriar');
        if (btnCriar) {
          btnCriar.disabled = true;
          btnCriar.querySelector('.button-text').textContent = "Creating account...";
        }

        try {
          const requestFn = (typeof makeRequest === 'function') ? makeRequest : fetch;
          
          // Se o user veio de OAuth (Google/Discord/GitHub), inclui os dados OAuth no registro
          const registerData = { nome, email, password, telefone: null, data_nascimento: birthdate };
          if (window.oauthTempData) {
            registerData.oauthProvider = window.oauthTempData.provider;
            // Mapeia o ID do OAuth baseado no provider (cada um tem um campo diferente)
            if (window.oauthTempData.provider === 'google') {
              registerData.oauthId = window.oauthTempData.googleId;
            } else if (window.oauthTempData.provider === 'discord') {
              registerData.oauthId = window.oauthTempData.discordId;
            } else if (window.oauthTempData.provider === 'github') {
              registerData.oauthId = window.oauthTempData.githubId;
            }
            registerData.fotoPerfil = window.oauthTempData.fotoPerfil; // foto do perfil do OAuth
          }
          
          const res = await requestFn("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(registerData),
          });
          
          // Limpa os dados OAuth temporários se o registro deu certo (não precisa mais)
          if (res.ok) {
            if (window.oauthTempData) {
              fetch('/api/auth/oauth-temp-data/clear', { method: 'POST' });
              window.oauthTempData = null;
            }
          }

          const data = await res.json();

          if (data.status === "ok") {
            // Fecha o modal de registro e abre o de verificação (user precisa verificar o email)
            closeModals();
            openVerificationModal(email);
          } else {
            if (typeof window.showErrorr === 'function') {
              window.showErrorr("Error", data.error || data.message || "Errorr creating account");
            }
          }
        } catch (error) {
          console.error("Registration error:", error);
          if (typeof window.showErrorr === 'function') {
            window.showErrorr("Error", error.message || "Error de ligação ao servidor");
          }
        } finally {
          if (btnCriar) {
            btnCriar.disabled = false;
            btnCriar.querySelector('.button-text').textContent = "Continue";
          }
        }
      });
    }

    // Google Register
    const btnGoogleRegister = document.getElementById('btnGoogleRegister');
    if (btnGoogleRegister) {
      btnGoogleRegister.addEventListener('click', () => {
        window.location.href = "/auth/google";
      });
    }

    // Verification Form
    const verificationForm = document.getElementById('verificationForm');
    if (verificationForm) {
      verificationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const codeInput = document.getElementById('verificationCode');
        const emailSpan = document.getElementById('verificationEmail');
        const errorMsg = document.getElementById('verificationErrorrMessage');
        const successMsg = document.getElementById('verificationSuccessMessage');
        const btnVerify = document.getElementById('btnVerify');
        
        const codigo = codeInput.value.trim();
        const email = emailSpan ? emailSpan.textContent.trim() : '';
        
        if (!codigo) {
          if (errorMsg) {
            errorMsg.textContent = 'Please enter the verification code';
            errorMsg.style.display = 'block';
          }
          return;
        }
        
        if (btnVerify) {
          btnVerify.disabled = true;
          btnVerify.querySelector('.button-text').textContent = "Verifying...";
        }
        
        if (errorMsg) errorMsg.textContent = '';
        if (successMsg) successMsg.textContent = '';
        
        try {
          const requestFn = (typeof makeRequest === 'function') ? makeRequest : fetch;
          const res = await requestFn("/api/auth/verificar-codigo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, codigo }),
          });
          
          const data = await res.json();
          
          if (data.status === "ok" && data.token) {
            // Salva o token e mostra mensagem de sucesso
            localStorage.setItem("token", data.token);
            
            if (successMsg) {
              successMsg.textContent = "Email verified successfully!";
              successMsg.style.display = 'block';
            }
            
            // Mostra notificação (ainda tem aqui, mas pode remover depois se quiser)
            if (typeof window.showSuccess === 'function') {
              window.showSuccess("Success", "Email verified! Redirecting...");
            }
            
            // Redireciona pro dashboard depois de 1 segundo (dá tempo de ver a mensagem)
            setTimeout(() => {
              window.location.href = "/dashboard";
            }, 1000);
          } else {
            if (errorMsg) {
              errorMsg.textContent = data.error || "Invalid or expired code";
              errorMsg.style.display = 'block';
            }
            if (typeof window.showErrorr === 'function') {
              window.showErrorr("Error", data.error || "Invalid or expired code");
            }
          }
        } catch (error) {
          console.error("Error ao verificar código:", error);
          if (errorMsg) {
            errorMsg.textContent = "Error de ligação ao servidor";
            errorMsg.style.display = 'block';
          }
          if (typeof window.showErrorr === 'function') {
            window.showErrorr("Error", "Error de ligação ao servidor");
          }
        } finally {
          if (btnVerify) {
            btnVerify.disabled = false;
            btnVerify.querySelector('.button-text').textContent = "Verify";
          }
        }
      });
    }

    // Resend code
    const btnResendCode = document.getElementById('btnResendCode');
    if (btnResendCode) {
      btnResendCode.addEventListener('click', async () => {
        const emailSpan = document.getElementById('verificationEmail');
        const errorMsg = document.getElementById('verificationErrorrMessage');
        const successMsg = document.getElementById('verificationSuccessMessage');
        
        const email = emailSpan ? emailSpan.textContent.trim() : '';
        
        if (!email) {
          if (errorMsg) {
            errorMsg.textContent = 'Email not found';
            errorMsg.style.display = 'block';
          }
          return;
        }
        
        btnResendCode.disabled = true;
        btnResendCode.textContent = "Sending...";
        
        if (errorMsg) errorMsg.textContent = '';
        if (successMsg) successMsg.textContent = '';
        
        try {
          // TODO: O backend precisa ter um endpoint pra reenviar código de verdade
          // Por enquanto só mostra uma mensagem pro user (não faz request real)
          if (typeof window.showSuccess === 'function') {
            window.showSuccess("Info", "If the code did not arrive, check your spam folder or try signing in again.");
          }
          if (successMsg) {
            successMsg.textContent = "If you did not receive the code, check your spam folder.";
            successMsg.style.display = 'block';
          }
        } catch (error) {
          console.error("Error ao reenviar código:", error);
          if (errorMsg) {
            errorMsg.textContent = "Error de ligação ao servidor";
            errorMsg.style.display = 'block';
          }
        } finally {
          btnResendCode.disabled = false;
          btnResendCode.textContent = "Resend code";
        }
      });
    }
  });
});
