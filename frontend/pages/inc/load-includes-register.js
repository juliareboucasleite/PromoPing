// Script para carregar includes (header e footer) - versão para register.html
document.addEventListener('DOMContentLoaded', function() {
    // Carrega o header específico da página de registro
    makeRequest('../../inc/header-register.html')
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
            console.error('Erro ao carregar header de registro:', error);
            // Fallback estático
            const headerPlaceholder = document.getElementById('header-placeholder');
            if (headerPlaceholder) {
                headerPlaceholder.innerHTML = '<header class="pp-header"><div class="pp-header-container"><a href="../../pages/index.html" class="pp-header-logo"><img src="../../assets/images/PromoPing.png" alt="PromoPing Logo"><span>PromoPing</span></a></div></header>';
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
            console.error('Erro ao carregar footer:', error);
            // Fallback estático
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) {
                footerPlaceholder.innerHTML = '<footer class="pp-footer"><div class="pp-container"><p>&copy; 2024 PromoPing. Todos os direitos reservados.</p></div></footer>';
            }
        });
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
