// Script para carregar includes (header e footer) - Versão para register.html
document.addEventListener('DOMContentLoaded', function() {
    // Carregar header de register
    fetch('/inc/header-register.html')
        .then(response => response.text())
        .then(data => {
            const headerPlaceholder = document.getElementById('header-placeholder');
            if (headerPlaceholder) {
                headerPlaceholder.innerHTML = data;
            }
        })
        .catch(error => console.error('Erro ao carregar header de register:', error));

    // Carregar footer
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

// Navigation dropdown functions
function openNavigation(button) {
  const navLinks = button.nextElementSibling;
  const isOpen = navLinks.style.display === 'block';
  
  // Close all other dropdowns
  document.querySelectorAll('.pp-header-nav-links').forEach(link => {
    link.style.display = 'none';
  });
  
  // Toggle current dropdown
  navLinks.style.display = isOpen ? 'none' : 'block';
}

function toggleNavigation() {
  const html = document.documentElement;
  html.classList.toggle('opened-nav');
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
  if (!event.target.closest('.pp-header-nav-wrapper')) {
    document.querySelectorAll('.pp-header-nav-links').forEach(link => {
      link.style.display = 'none';
    });
  }
});

// Language toggle function
function toggleLanguage() {
  const langText = document.getElementById('lang-text');
  const currentLang = langText.textContent;
  
  if (currentLang === 'PT') {
    langText.textContent = 'EN';
    // translateToEnglish(); // Função não implementada ainda
  } else {
    langText.textContent = 'PT';
    // translateToPortuguese(); // Função não implementada ainda
  }
}
