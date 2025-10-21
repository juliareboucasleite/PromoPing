// Script para carregar includes (header e footer) - Versão para Login.html
document.addEventListener('DOMContentLoaded', function() {
    // Carrega o header específico da página de login
    fetch('/inc/header-login.html')
        .then(response => response.text())
        .then(data => {
            const headerPlaceholder = document.getElementById('header-placeholder');
            if (headerPlaceholder) {
                headerPlaceholder.innerHTML = data;
            }
        })
        .catch(error => console.error('Erro ao carregar header de login:', error));

    // Carrega o footer padrão
    fetch('/inc/footer.html')
        .then(response => response.text())
        .then(data => {
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) {
                footerPlaceholder.innerHTML = data;
            }
        })
        .catch(error => console.error('Erro ao carregar footer:', error));
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
