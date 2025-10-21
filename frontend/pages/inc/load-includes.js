// Script para carregar includes (header e footer)
document.addEventListener('DOMContentLoaded', function() {
    // Carrega o header
    fetch('/inc/header.html')
        .then(response => response.text())
        .then(data => {
            const headerPlaceholder = document.getElementById('header-placeholder');
            if (headerPlaceholder) {
                headerPlaceholder.innerHTML = data;
            }
        })
        .catch(error => console.error('Erro ao carregar header:', error));

    // Carrega o footer
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

// Alterna o menu móvel
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

// Função de alternância de idioma
function toggleLanguage() {
  const langText = document.getElementById('lang-text');
  const currentLang = langText.textContent;
  
  if (currentLang === 'PT') {
    langText.textContent = 'EN';
    // Função para traduzir para inglês não implementada ainda
  } else {
    langText.textContent = 'PT';
    // Função para traduzir para português não implementada ainda
  }
}
