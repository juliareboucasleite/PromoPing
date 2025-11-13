// ===== MODAL CONTROL =====
// Garantir que as funções estejam no escopo global
window.openLoginModal = function() {
  const overlay = document.getElementById('modalOverlay');
  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');
  
  if (!overlay || !loginModal) {
    console.error('Elementos não encontrados:', { overlay, loginModal });
    return;
  }
  
  // Ocultar modal de registro
  if (registerModal) {
    registerModal.style.display = 'none';
  }
  
  // Mostrar modal de login
  loginModal.style.display = 'block';
  overlay.style.display = 'flex';
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.openRegisterModal = function() {
  const overlay = document.getElementById('modalOverlay');
  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');
  
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
  
  // Re-initialize tooltip positioning
  setTimeout(() => {
    positionInfoTooltip();
  }, 100);
};

// Manter compatibilidade com chamadas diretas
function openLoginModal() {
  window.openLoginModal();
}

function openRegisterModal() {
  window.openRegisterModal();
}

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
    document.body.style.overflow = '';
  }
};

// ===== QR CODE MODAL =====
window.openQRModal = function() {
  const qrModal = document.getElementById('qrModal');
  if (!qrModal) {
    console.error('Modal QR não encontrado');
    return;
  }
  
  // Fechar outros modais
  window.closeModals();
  
  // Mostrar modal QR
  qrModal.classList.add('show');
  document.body.style.overflow = 'hidden';
};

window.closeQRModal = function() {
  const qrModal = document.getElementById('qrModal');
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

// Abrir modal de verificação
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
  
  // Limpar campos
  const codeInput = document.getElementById('verificationCode');
  if (codeInput) codeInput.value = '';
  
  const errorMsg = document.getElementById('verificationErrorMessage');
  const successMsg = document.getElementById('verificationSuccessMessage');
  if (errorMsg) errorMsg.textContent = '';
  if (successMsg) successMsg.textContent = '';
  
  // Mostrar modal de verificação
  verificationModal.style.display = 'block';
  overlay.style.display = 'flex';
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Focar no input de código
  setTimeout(() => {
    if (codeInput) codeInput.focus();
  }, 100);
};

// Manter compatibilidade
function closeModals() {
  window.closeModals();
}

// Função para inicializar modais quando o header for carregado
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

// Garantir que os modais estejam ocultos ao carregar
document.addEventListener('DOMContentLoaded', function() {
  initializeModals();
  
  // Também inicializar após um delay para garantir que o header foi carregado
  setTimeout(initializeModals, 500);
});

// Tornar a função disponível globalmente
window.initializeModals = initializeModals;

// Fechar modal com ESC
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeModals();
  }
});

// ===== PASSWORD TOGGLE =====
function toggleLoginPassword() {
  const passwordInput = document.getElementById("loginPassword");
  const toggleBtn = document.querySelector("#loginModal .password-toggle");

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

// Password Strength Checker
function checkPasswordStrength(password) {
  const indicator = document.getElementById('passwordStrengthIndicator');
  const fill = document.getElementById('passwordStrengthFill');
  const status = document.getElementById('passwordStrengthStatus');

  if (!indicator || !fill || !status) return;

  if (!password || password.length === 0) {
    indicator.style.display = 'none';
    return;
  }

  indicator.style.display = 'block';

  let strength = 0;
  let strengthClass = 'weak';
  let statusText = 'Complica ainda mais';

  // Length check
  if (password.length >= 8) strength += 1;
  if (password.length >= 12) strength += 1;

  // Character variety checks
  if (/[a-z]/.test(password)) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^a-zA-Z0-9]/.test(password)) strength += 1;

  // Determine strength level
  if (strength <= 2) {
    strengthClass = 'weak';
    statusText = 'Complica ainda mais';
  } else if (strength === 3) {
    strengthClass = 'fair';
    statusText = 'Complica ainda mais';
  } else if (strength === 4) {
    strengthClass = 'good';
    statusText = 'Está com bom aspeto';
  } else if (strength === 5) {
    strengthClass = 'strong';
    statusText = 'Está com bom aspeto';
  } else if (strength >= 6) {
    strengthClass = 'perfect';
    statusText = 'Perfeito!';
  }

  // Update UI
  fill.className = 'password-strength-fill ' + strengthClass;
  status.textContent = statusText;
}

// Make function globally available
window.checkPasswordStrength = checkPasswordStrength;

// Tooltip positioning to prevent horizontal scroll
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
      
      // Calcular posição ideal
      let left = iconRect.right + spacing;
      let top = iconRect.top + (iconRect.height / 2);
      
      // Se não cabe à direita, colocar à esquerda
      if (left + tooltipWidth > viewportWidth - 20) {
        left = iconRect.left - tooltipWidth - spacing;
      }
      
      // Se não cabe à esquerda também, centralizar
      if (left < 20) {
        left = Math.max(20, (viewportWidth - tooltipWidth) / 2);
      }
      
      // Ajustar verticalmente se necessário
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

// ===== LOGIN FUNCTIONALITY =====
document.addEventListener('DOMContentLoaded', function() {
  // Aguardar makeRequest estar disponível
  function waitForMakeRequest(callback, maxAttempts = 50) {
    if (typeof makeRequest === 'function') {
      callback();
    } else if (maxAttempts > 0) {
      setTimeout(() => waitForMakeRequest(callback, maxAttempts - 1), 100);
    }
  }

  waitForMakeRequest(() => {
    // Login Form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
          if (typeof window.showError === 'function') {
            window.showError('Erro', 'Por favor, preencha todos os campos');
          }
          return;
        }

        try {
          const requestFn = (typeof makeRequest === 'function') ? makeRequest : fetch;
          const res = await requestFn("http://127.0.0.1:3000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();

          if (data.status === "ok" && data.token) {
            localStorage.setItem("token", data.token);
            if (typeof window.showSuccess === 'function') {
              window.showSuccess("Bem-vindo!", "Bem-vindo ao PromoPing! Redirecionando...");
            }
            setTimeout(() => {
              window.location.href = "/PromoPing/frontend/pages/dashboard/Painel.html";
            }, 2000);
          } else {
            if (typeof window.showError === 'function') {
              window.showError("Erro de Login", data.error || "Email ou senha incorretos");
            }
          }
        } catch (err) {
          console.error("Erro no login:", err);
          if (typeof window.showError === 'function') {
            window.showError("Erro", "Erro de ligação com o servidor");
          }
        }
      });
    }

    // Google Login
    const btnGoogleLogin = document.getElementById('btnGoogleLogin');
    if (btnGoogleLogin) {
      btnGoogleLogin.addEventListener('click', () => {
        window.location.href = "http://127.0.0.1:3000/api/auth/google";
      });
    }

    // Discord Login
    const btnDiscordLogin = document.getElementById('btnDiscordLogin');
    if (btnDiscordLogin) {
      btnDiscordLogin.addEventListener('click', async () => {
        try {
          const requestFn = (typeof makeRequest === 'function') ? makeRequest : fetch;
          const response = await requestFn(`http://127.0.0.1:3000/api/auth/discord/check/916737425978589235`);
          const data = await response.json();

          if (data.exists) {
            window.location.href = "http://127.0.0.1:3000/api/auth/discord/direct/916737425978589235";
          } else {
            window.location.href = "http://127.0.0.1:3000/auth/discord";
          }
        } catch (error) {
          console.error("Erro ao verificar usuário Discord:", error);
          window.location.href = "http://127.0.0.1:3000/auth/discord";
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
          if (typeof window.showError === 'function') {
            window.showError("Erro", "Por favor, insira um email válido");
          }
          return;
        }

        if (password.length < 8) {
          if (typeof window.showError === 'function') {
            window.showError("Erro", "A palavra-passe deve ter pelo menos 8 caracteres");
          }
          return;
        }

        if (!birthdate) {
          if (typeof window.showError === 'function') {
            window.showError("Erro", "Por favor, insira a sua data de nascimento");
          }
          return;
        }

        const btnCriar = document.getElementById('btnCriar');
        if (btnCriar) {
          btnCriar.disabled = true;
          btnCriar.querySelector('.button-text').textContent = "A criar conta...";
        }

        try {
          const requestFn = (typeof makeRequest === 'function') ? makeRequest : fetch;
          const res = await requestFn("http://127.0.0.1:3000/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, email, password, telefone: null }),
          });

          const data = await res.json();

          if (data.status === "ok") {
            // Fechar modal de registro e abrir modal de verificação
            closeModals();
            openVerificationModal(email);
          } else {
            if (typeof window.showError === 'function') {
              window.showError("Erro", data.error || data.message || "Erro ao criar conta");
            }
          }
        } catch (error) {
          console.error("Erro ao registrar:", error);
          if (typeof window.showError === 'function') {
            window.showError("Erro", error.message || "Erro de ligação ao servidor");
          }
        } finally {
          if (btnCriar) {
            btnCriar.disabled = false;
            btnCriar.querySelector('.button-text').textContent = "Continuar";
          }
        }
      });
    }

    // Google Register
    const btnGoogleRegister = document.getElementById('btnGoogleRegister');
    if (btnGoogleRegister) {
      btnGoogleRegister.addEventListener('click', () => {
        window.location.href = "http://127.0.0.1:3000/auth/google";
      });
    }

    // Verification Form
    const verificationForm = document.getElementById('verificationForm');
    if (verificationForm) {
      verificationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const codeInput = document.getElementById('verificationCode');
        const emailSpan = document.getElementById('verificationEmail');
        const errorMsg = document.getElementById('verificationErrorMessage');
        const successMsg = document.getElementById('verificationSuccessMessage');
        const btnVerificar = document.getElementById('btnVerificar');
        
        const codigo = codeInput.value.trim();
        const email = emailSpan ? emailSpan.textContent.trim() : '';
        
        if (!codigo) {
          if (errorMsg) {
            errorMsg.textContent = 'Por favor, insira o código de verificação';
            errorMsg.style.display = 'block';
          }
          return;
        }
        
        if (btnVerificar) {
          btnVerificar.disabled = true;
          btnVerificar.querySelector('.button-text').textContent = "A verificar...";
        }
        
        if (errorMsg) errorMsg.textContent = '';
        if (successMsg) successMsg.textContent = '';
        
        try {
          const requestFn = (typeof makeRequest === 'function') ? makeRequest : fetch;
          const res = await requestFn("http://127.0.0.1:3000/api/auth/verificar-codigo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, codigo }),
          });
          
          const data = await res.json();
          
          if (data.status === "ok" && data.token) {
            // Salvar token
            localStorage.setItem("token", data.token);
            
            if (successMsg) {
              successMsg.textContent = "Email verificado com sucesso!";
              successMsg.style.display = 'block';
            }
            
            if (typeof window.showSuccess === 'function') {
              window.showSuccess("Sucesso", "Email verificado! Redirecionando...");
            }
            
            // Redirecionar para o dashboard após 1 segundo
            setTimeout(() => {
              window.location.href = "/PromoPing/frontend/pages/dashboard/Painel.html";
            }, 1000);
          } else {
            if (errorMsg) {
              errorMsg.textContent = data.error || "Código inválido ou expirado";
              errorMsg.style.display = 'block';
            }
            if (typeof window.showError === 'function') {
              window.showError("Erro", data.error || "Código inválido ou expirado");
            }
          }
        } catch (error) {
          console.error("Erro ao verificar código:", error);
          if (errorMsg) {
            errorMsg.textContent = "Erro de ligação ao servidor";
            errorMsg.style.display = 'block';
          }
          if (typeof window.showError === 'function') {
            window.showError("Erro", "Erro de ligação ao servidor");
          }
        } finally {
          if (btnVerificar) {
            btnVerificar.disabled = false;
            btnVerificar.querySelector('.button-text').textContent = "Verificar";
          }
        }
      });
    }

    // Reenviar código
    const btnResendCode = document.getElementById('btnResendCode');
    if (btnResendCode) {
      btnResendCode.addEventListener('click', async () => {
        const emailSpan = document.getElementById('verificationEmail');
        const errorMsg = document.getElementById('verificationErrorMessage');
        const successMsg = document.getElementById('verificationSuccessMessage');
        
        const email = emailSpan ? emailSpan.textContent.trim() : '';
        
        if (!email) {
          if (errorMsg) {
            errorMsg.textContent = 'Email não encontrado';
            errorMsg.style.display = 'block';
          }
          return;
        }
        
        btnResendCode.disabled = true;
        btnResendCode.textContent = "A enviar...";
        
        if (errorMsg) errorMsg.textContent = '';
        if (successMsg) successMsg.textContent = '';
        
        try {
          // Nota: O backend precisa ter um endpoint para reenviar código
          // Por enquanto, vamos apenas mostrar uma mensagem
          if (typeof window.showSuccess === 'function') {
            window.showSuccess("Info", "Se o código não chegou, verifica a pasta de spam ou tenta fazer login novamente.");
          }
          if (successMsg) {
            successMsg.textContent = "Se não recebeste o código, verifica a pasta de spam.";
            successMsg.style.display = 'block';
          }
        } catch (error) {
          console.error("Erro ao reenviar código:", error);
          if (errorMsg) {
            errorMsg.textContent = "Erro de ligação ao servidor";
            errorMsg.style.display = 'block';
          }
        } finally {
          btnResendCode.disabled = false;
          btnResendCode.textContent = "Reenviar código";
        }
      });
    }
  });
});

