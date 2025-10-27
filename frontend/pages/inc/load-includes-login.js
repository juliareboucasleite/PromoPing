// Script para carregar includes (header e footer) - Versão para Login.html
document.addEventListener('DOMContentLoaded', function() {
    // Carrega o header específico da página de login
    makeRequest('../../inc/header-login.html')
        .then(response => {
            // Clonar a resposta para evitar problemas de stream já lido
            return response.clone().text();
        })
        .then(data => {
            const headerPlaceholder = document.getElementById('header-placeholder');
            if (headerPlaceholder) {
                headerPlaceholder.innerHTML = data;
            }
        })
        .catch(error => {
            console.warn('Header de login não encontrado, usando conteúdo estático');
            const headerPlaceholder = document.getElementById('header-placeholder');
            if (headerPlaceholder) {
                headerPlaceholder.innerHTML = `
                    <header class="pp-header">
                        <div class="pp-container">
                            <div class="pp-header-brand">
                                <img src="../../assets/images/PromoPing.png" alt="PromoPing" class="pp-header-logo">
                                <span class="pp-header-title">PromoPing</span>
                            </div>
                            <nav class="pp-header-nav">
                                <a href="../../pages/inc/register.html" class="pp-header-nav-link">Registar</a>
                            </nav>
                        </div>
                    </header>
                `;
            }
        });

    // Carrega o footer padrão
    makeRequest('../../inc/footer.html')
        .then(response => {
            // Clonar a resposta para evitar problemas de stream já lido
            return response.clone().text();
        })
        .then(data => {
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) {
                footerPlaceholder.innerHTML = data;
            }
        })
        .catch(error => {
            console.warn('Footer não encontrado, usando conteúdo estático');
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) {
                footerPlaceholder.innerHTML = `
                    <footer class="pp-footer">
                        <div class="pp-container">
                            <div class="pp-footer-content">
                                <div class="pp-footer-brand">
                                    <img src="../../assets/images/PromoPing.png" alt="PromoPing" class="pp-footer-logo">
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

// Função para abrir o dropdown de navegação no header
function openNavigation(button) {
  const navLinks = button.nextElementSibling;
  const isOpen = navLinks.style.display === 'block';
  
  // Fecha todos os outros dropdowns de navegação
  document.querySelectorAll('.pp-header-nav-links').forEach(link => {
    link.style.display = 'none';
  });
  
  // Alterna o dropdown do botão atual
  navLinks.style.display = isOpen ? 'none' : 'block';
}

// Alterna a navegação mobile (hamburguer)
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

// Função para alternar idioma (apenas visual, PT/EN)
function toggleLanguage() {
  const langText = document.getElementById('lang-text');
  const currentLang = langText.textContent;
  
  if (currentLang === 'PT') {
    langText.textContent = 'EN';
    // Função não implementada ainda
  } else {
    langText.textContent = 'PT';
    // Função não implementada ainda
  }
}
