// Script para carregar includes do header e footer na página principal (index.html)
document.addEventListener('DOMContentLoaded', function() {
    // Carrega o header de forma assíncrona para o placeholder adequado
    makeRequest('inc/header.html')
        .then(response => {
            // Clonar a resposta para evitar problemas de stream já lido
            return response.clone().text();
        })
        .then(data => {
            const headerPlaceholder = document.getElementById('header-placeholder');
            if (headerPlaceholder) {
                // Corrige os caminhos das imagens ANTES de inserir o HTML
                const baseTag = document.querySelector('base');
                const baseHref = baseTag ? baseTag.getAttribute('href') : '/';
                // Substitui todos os caminhos relativos de imagens no HTML antes de inserir
                let correctedData = data.replace(/src="assets\//g, `src="${baseHref}assets/`);
                headerPlaceholder.innerHTML = correctedData;
                
                // Garantir que os modais estejam ocultos após inserir o header
                setTimeout(() => {
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
                  
                  // Verificar se as funções estão disponíveis
                  if (typeof window.openLoginModal === 'function' && typeof window.openRegisterModal === 'function') {
                    console.log('✅ Funções de modal disponíveis');
                  } else {
                    console.error('❌ Funções de modal não encontradas!');
                  }
                  
                  // Verificar se os elementos dos modais foram encontrados
                  if (overlay && loginModal && registerModal) {
                    console.log('✅ Elementos dos modais encontrados');
                  } else {
                    console.error('❌ Elementos dos modais não encontrados:', { overlay, loginModal, registerModal });
                  }
                  
                  // Inicializar modais se a função estiver disponível
                  if (typeof window.initializeModals === 'function') {
                    window.initializeModals();
                  }
                  
                  // Os modais já estão no index.html, não precisam ser carregados do header
                }, 200);
            }
        })
        .catch(error => {
            console.warn('Header não encontrado, usando conteúdo estático');
            const headerPlaceholder = document.getElementById('header-placeholder');
            if (headerPlaceholder) {
                headerPlaceholder.innerHTML = `
                    <header class="pp-header">
                        <div class="pp-container">
                            <div class="pp-header-brand">
                                <img src="assets/images/PromoPing.png" alt="PromoPing" class="pp-header-logo">
                                <span class="pp-header-title">PromoPing</span>
                            </div>
                            <nav class="pp-header-nav">
                                <button onclick="window.openLoginModal && window.openLoginModal()" class="pp-header-nav-link" style="background: none; border: none; color: inherit; cursor: pointer;">Entrar</button>
                                <button onclick="window.openRegisterModal && window.openRegisterModal()" class="pp-btn pp-btn-primary" style="border: none; cursor: pointer;">Registar</button>
                            </nav>
                        </div>
                    </header>
                `;
            }
        });

    // Carrega o footer de forma assíncrona e inicializa funcionalidades extras após inserir no DOM
    function loadFooter() {
        const baseTag = document.querySelector('base');
        const baseHref = baseTag ? baseTag.getAttribute('href') : '/';
        const footerPath = baseHref + 'inc/footer.html';
        
        makeRequest(footerPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.clone().text();
            })
            .then(data => {
                const footerPlaceholder = document.getElementById('footer-placeholder');
                if (footerPlaceholder) {
                    // Corrige os caminhos das imagens e links ANTES de inserir o HTML
                    let correctedData = data.replace(/src="assets\//g, `src="${baseHref}assets/`);
                    correctedData = correctedData.replace(/href="pages\//g, `href="${baseHref}pages/`);
                    correctedData = correctedData.replace(/href="#/g, `href="${baseHref}#`);
                    footerPlaceholder.innerHTML = correctedData;
                    // Chama funções adicionais depois do footer carregado
                    if (typeof initializeFooterFunctionality === 'function') {
                        initializeFooterFunctionality();
                    }
                }
            })
            .catch(error => {
                console.warn('Footer não encontrado, usando conteúdo estático:', error);
                const footerPlaceholder = document.getElementById('footer-placeholder');
                if (footerPlaceholder) {
                    footerPlaceholder.innerHTML = `
                        <footer class="pp-footer">
                            <div class="pp-container">
                                <div class="pp-footer-content">
                                    <div class="pp-footer-brand">
                                        <img src="assets/images/PromoPing.png" alt="PromoPing" class="pp-footer-logo">
                                        <span class="pp-footer-title">PromoPing</span>
                                    </div>
                                    <div class="pp-footer-links">
                                        <a href="#sobre" class="pp-footer-link">Sobre</a>
                                        <a href="#contato" class="pp-footer-link">Contato</a>
                                        <a href="#privacidade" class="pp-footer-link">Privacidade</a>
                                    </div>
                                </div>
                                <div class="pp-footer-bottom">
                                    <p>&copy; 2024 PromoPing. Todos os direitos reservados.</p>
                                </div>
                            </div>
                        </footer>
                    `;
                }
            });
    }
    
    // Aguarda um pouco para garantir que o RequestManager está disponível
    if (typeof makeRequest === 'function') {
        loadFooter();
    } else {
        // Se makeRequest não estiver disponível, tenta novamente após um delay
        setTimeout(function() {
            if (typeof makeRequest === 'function') {
                loadFooter();
            } else {
                console.error('makeRequest não está disponível para carregar footer');
            }
        }, 100);
    }
});

// Função para abrir o dropdown de navegação (menu)
// Apenas um dropdown aberto por vez
function openNavigation(button) {
  const navLinks = button.nextElementSibling;
  const isOpen = navLinks.style.display === 'block';
  
  // Fecha todos os outros dropdowns de navegação
  document.querySelectorAll('.pp-header-nav-links').forEach(link => {
    link.style.display = 'none';
  });
  
  // Alterna a exibição do dropdown atual
  navLinks.style.display = isOpen ? 'none' : 'block';
}

// Alterna o menu mobile (hamburguer)
function toggleNavigation() {
  const html = document.documentElement;
  html.classList.toggle('opened-nav');
}

// Fecha os dropdowns do menu de navegação se clicar fora deles
document.addEventListener('click', function(event) {
  if (!event.target.closest('.pp-header-nav-wrapper')) {
    document.querySelectorAll('.pp-header-nav-links').forEach(link => {
      link.style.display = 'none';
    });
  }
});

// Função para alternar o idioma (PT/EN) - apenas simulação visual
function toggleLanguage() {
  const langTextDesktop = document.getElementById('lang-text-desktop');
  const langTextMobile = document.getElementById('lang-text-mobile');
  
  // Usar desktop como referência, ou mobile se desktop não existir
  const langText = langTextDesktop || langTextMobile;
  if (!langText) return;
  
  const currentLang = langText.textContent;
  
  if (currentLang === 'PT') {
    if (langTextDesktop) langTextDesktop.textContent = 'EN';
    if (langTextMobile) langTextMobile.textContent = 'EN';
    // Aqui poderia chamar uma função para traduzir o site para inglês (não implementada)
  } else {
    if (langTextDesktop) langTextDesktop.textContent = 'PT';
    if (langTextMobile) langTextMobile.textContent = 'PT';
    // Aqui poderia chamar uma função para traduzir o site para português (não implementada)
  }
}

// Inicializa funcionalidades do footer: status, tooltips, versão, rolagem suave etc.
function initializeFooterFunctionality() {
  // Atualiza o status visual do serviço no rodapé
  updateServiceStatus();
  
  // Ajusta as tooltips dos links do footer (visual)
  positionTooltips();
  
  // Atualiza e habilita o badge de versão
  checkVersion();
  
  // Aplica rolagem suave para links âncora do footer
  const footerLinks = document.querySelectorAll('.footer-link[href^="#"]');
  footerLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// Simula atualização do status (online/manutenção) do serviço no rodapé
function updateServiceStatus() {
  const statusIndicator = document.querySelector('.status-indicator');
  if (statusIndicator) {
    // Aqui deveria ser feita uma verificação real do backend; agora é simulado
    const isOnline = Math.random() > 0.1; // 90% de chance de mostrar "online"
    
    if (isOnline) {
      statusIndicator.className = 'status-indicator online';
    } else {
      statusIndicator.className = 'status-indicator maintenance';
    }
  }
}

// Função para posicionar (simular) tooltips dos links do footer
function positionTooltips() {
  const tooltipLinks = document.querySelectorAll('.footer-link[data-tooltip]');
  tooltipLinks.forEach(link => {
    link.addEventListener('mouseenter', function() {
      // Poderia inserir posicionamento de tooltip aqui se necessário
    });
  });
}

// Busca a versão mais recente do GitHub Releases API
async function fetchGitHubVersion() {
  const githubOwner = 'juliareboucasleite';
  const githubRepo = 'PromoPing';
  const apiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepo}/releases/latest`;
  
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    const data = await response.json();
    // Extrai a versão do tag_name (remove o 'v' se existir)
    const version = data.tag_name || data.name || 'v2.3.3';
    return version.startsWith('v') ? version : `v${version}`;
  } catch (error) {
    console.warn('Erro ao buscar versão do GitHub:', error);
    // Retorna versão padrão em caso de erro
    return 'v2.3.3';
  }
}

// Atualiza o badge de versão com a versão do GitHub e permite abrir modal com detalhes
async function checkVersion() {
  const versionBadge = document.querySelector('.version-badge span');
  if (versionBadge) {
    // Busca a versão mais recente do GitHub
    const latestVersion = await fetchGitHubVersion();
    versionBadge.textContent = latestVersion;
    
    // Armazena a versão para uso no modal
    versionBadge.dataset.version = latestVersion;
    
    // Ao clicar, mostra informações detalhadas da versão em um modal
    versionBadge.addEventListener('click', function() {
      showVersionInfo(latestVersion);
    });
  }
}

// Cria e exibe um modal simples com informações sobre a versão atual
function showVersionInfo(version = 'v2.3.3') {
  // Cria o elemento do modal
  const modal = document.createElement('div');
  modal.className = 'version-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Informações da Versão</h3>
      <p><strong>Versão Atual:</strong> ${version}</p>
      <p><strong>Última Atualização:</strong> ${new Date().toLocaleDateString('pt-PT')}</p>
      <p><strong>Status:</strong> <span class="status-online">Online</span></p>
      <button onclick="this.parentElement.parentElement.remove()">Fechar</button>
    </div>
  `;
  
  // Adiciona estilos CSS diretamente para o modal (assim não depende de arquivos externos)
  const style = document.createElement('style');
  style.textContent = `
    .version-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .modal-content {
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 400px;
      text-align: center;
    }
    .status-online {
      color: #4CAF50;
      font-weight: bold;
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(modal);
}
