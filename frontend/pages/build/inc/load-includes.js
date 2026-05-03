// Script para carregar includes (header e footer)
document.addEventListener('DOMContentLoaded', function() {
    // Carrega o header
    makeRequest('inc/header.html')
        .then(response => {
            // Clonar a resposta para evitar problemas de stream jÃ¡ lido
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
            }
        })
        .catch(error => {
            console.warn('Header nÃ£o encontrado, usando conteÃºdo estÃ¡tico');
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
                                <a href="/login" class="pp-header-nav-link">Entrar</a>
                                <a href="inc/register.html" class="pp-btn pp-btn-primary">Registar</a>
                            </nav>
                        </div>
                    </header>
                `;
            }
        });

    // Carrega o footer
    makeRequest('inc/footer.html')
        .then(response => {
            // Clonar a resposta para evitar problemas de stream jÃ¡ lido
            return response.clone().text();
        })
        .then(data => {
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) {
                // Corrige os caminhos das imagens ANTES de inserir o HTML
                const baseTag = document.querySelector('base');
                const baseHref = baseTag ? baseTag.getAttribute('href') : '/';
                // Substitui todos os caminhos relativos de imagens no HTML antes de inserir
                let correctedData = data.replace(/src="assets\//g, `src="${baseHref}assets/`);
                footerPlaceholder.innerHTML = correctedData;
                // Atualiza a versÃ£o do GitHub apÃ³s o footer ser carregado
                updateVersionFromGitHub();
            }
        })
        .catch(error => {
            console.warn('Footer nÃ£o encontrado, usando conteÃºdo estÃ¡tico');
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
});

// FunÃ§Ã£o para abrir o dropdown de navegaÃ§Ã£o
function openNavigation(button) {
  const navLinks = button.nextElementSibling;
  const isOpen = navLinks.style.display === 'block';
  
  // Fecha todos os outros dropdowns
  document.querySelectorAll('.pp-header-nav-links').forEach(link => {
    link.style.display = 'none';
  });
  
  // Alterna o dropdown atual
  navLinks.style.display = isOpen ? 'none' : 'block';
}

// Alterna o menu mÃ³vel
function toggleNavigation() {
  const html = document.documentElement;
  html.classList.toggle('opened-nav');
}

// Fecha os dropdowns ao clicar fora
document.addEventListener('click', function(event) {
  if (!event.target.closest('.pp-header-nav-wrapper')) {
    document.querySelectorAll('.pp-header-nav-links').forEach(link => {
      link.style.display = 'none';
    });
  }
});

// FunÃ§Ã£o de alternÃ¢ncia de idioma
function toggleLanguage() {
  const langText = document.getElementById('lang-text');
  const currentLang = langText.textContent;
  
  if (currentLang === 'PT') {
    langText.textContent = 'EN';
    // FunÃ§Ã£o para traduzir para inglÃªs nÃ£o implementada ainda
  } else {
    langText.textContent = 'PT';
    // FunÃ§Ã£o para traduzir para portuguÃªs nÃ£o implementada ainda
  }
}

// Busca a versÃ£o mais recente do GitHub Releases API
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
    // Extrai a versÃ£o do tag_name (remove o 'v' se existir)
    const version = data.tag_name || data.name || 'v2.3.3';
    return version.startsWith('v') ? version : `v${version}`;
  } catch (error) {
    console.warn('Erro ao buscar versÃ£o do GitHub:', error);
    // Retorna versÃ£o padrÃ£o em caso de erro
    return 'v2.3.3';
  }
}

// Atualiza o badge de versÃ£o com a versÃ£o do GitHub
async function updateVersionFromGitHub() {
  const versionBadge = document.querySelector('.version-badge span');
  if (versionBadge) {
    const latestVersion = await fetchGitHubVersion();
    versionBadge.textContent = latestVersion;
  }
}

