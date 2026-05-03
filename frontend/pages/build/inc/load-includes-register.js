// Script para carregar includes (header e footer) - versão para register.html
document.addEventListener('DOMContentLoaded', function() {
    // Aguarda o RequestManager estar disponível
    function loadHeader() {
        const baseTag = document.querySelector('base');
        const baseHref = baseTag ? baseTag.getAttribute('href') : '/';
        const headerPath = baseHref + 'inc/header-register.html';
        
        makeRequest(headerPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.clone().text();
            })
            .then(data => {
                // Tenta ambos os placeholders possíveis
                const headerPlaceholder = document.getElementById('header-register-include') || document.getElementById('header-placeholder');
                if (headerPlaceholder) {
                    // Corrige os caminhos das imagens ANTES de inserir o HTML
                    let correctedData = data.replace(/src="assets\//g, `src="${baseHref}assets/`);
                    correctedData = correctedData.replace(/href="pages\//g, `href="${baseHref}pages/`);
                    headerPlaceholder.innerHTML = correctedData;
                }
            })
            .catch(error => {
                console.error('Error loading register header:', error);
                // Fallback estático
                const headerPlaceholder = document.getElementById('header-register-include') || document.getElementById('header-placeholder');
                if (headerPlaceholder) {
                    headerPlaceholder.innerHTML = '<header class="pp-header"><div class="pp-header-container"><a href="index.html" class="pp-header-logo"><img src="assets/images/PromoPing.png" alt="PromoPing Logo"><span>PromoPing</span></a></div></header>';
                }
            });
    }

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
                    // Corrige os caminhos das imagens ANTES de inserir o HTML
                    let correctedData = data.replace(/src="assets\//g, `src="${baseHref}assets/`);
                    correctedData = correctedData.replace(/href="pages\//g, `href="${baseHref}pages/`);
                    footerPlaceholder.innerHTML = correctedData;
                    // Atualiza a versão do GitHub após o footer ser carregado
                    updateVersionFromGitHub();
                }
            })
            .catch(error => {
                console.error('Erro ao carregar footer:', error);
                // Fallback estático
                const footerPlaceholder = document.getElementById('footer-placeholder');
                if (footerPlaceholder) {
                    footerPlaceholder.innerHTML = '<footer class="pp-footer"><div class="pp-container"><p>&copy; 2024 PromoPing. All rights reserved.</p></div></footer>';
                }
            });
    }

    // Aguarda um pouco para garantir que o RequestManager está disponível
    if (typeof makeRequest === 'function') {
        loadHeader();
        loadFooter();
    } else {
        // Se makeRequest não estiver disponível, tenta novamente após um delay
        setTimeout(function() {
            if (typeof makeRequest === 'function') {
                loadHeader();
                loadFooter();
            } else {
                console.error('makeRequest não está disponível');
            }
        }, 100);
    }
});

// Função para abrir o dropdown de navegação
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

// Alterna o menu mobile (hamburguer)
function toggleNavigation() {
  const html = document.documentElement;
  html.classList.toggle('opened-nav');
}

// Fecha os dropdowns ao clicar fora do menu
document.addEventListener('click', function(event) {
  if (!event.target.closest('.pp-header-nav-wrapper')) {
    document.querySelectorAll('.pp-header-nav-links').forEach(link => {
      link.style.display = 'none';
    });
  }
});

// Função para alternar idioma (apenas visual, PT/EN)
function toggleLanguage() {
  const langText = document.getElementById('lang-text');
  const currentLang = langText.textContent;
  
  if (currentLang === 'PT') {
    langText.textContent = 'EN';
    // Aqui poderia chamar uma função para traduzir o site para inglês (não implementada)
  } else {
    langText.textContent = 'PT';
    // Aqui poderia chamar uma função para traduzir o site para português (não implementada)
  }
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
    console.warn('Error fetching GitHub version:', error);
    // Retorna versão padrão em caso de erro
    return 'v2.3.3';
  }
}

// Atualiza o badge de versão com a versão do GitHub
async function updateVersionFromGitHub() {
  const versionBadge = document.querySelector('.version-badge span');
  if (versionBadge) {
    const latestVersion = await fetchGitHubVersion();
    versionBadge.textContent = latestVersion;
  }
}
