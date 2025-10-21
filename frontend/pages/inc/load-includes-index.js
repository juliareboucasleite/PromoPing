// Script para carregar includes (header e footer) - Versão para index.html
document.addEventListener('DOMContentLoaded', function() {
    // Carregar header
    fetch('/inc/header.html')
        .then(response => response.text())
        .then(data => {
            const headerPlaceholder = document.getElementById('header-placeholder');
            if (headerPlaceholder) {
                headerPlaceholder.innerHTML = data;
            }
        })
        .catch(error => console.error('Erro ao carregar header:', error));

    // Carregar footer
    fetch('/inc/footer.html')
        .then(response => response.text())
        .then(data => {
            const footerPlaceholder = document.getElementById('footer-placeholder');
            if (footerPlaceholder) {
                footerPlaceholder.innerHTML = data;
                // Executar funcionalidades do footer após carregamento
                initializeFooterFunctionality();
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

// Footer functionality initialization
function initializeFooterFunctionality() {
  // Status indicator functionality
  updateServiceStatus();
  
  // Tooltip positioning
  positionTooltips();
  
  // Version check
  checkVersion();
  
  // Smooth scroll for footer links
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

function updateServiceStatus() {
  // Simulate status check
  const statusIndicator = document.querySelector('.status-indicator');
  if (statusIndicator) {
    // In a real application, this would check the actual service status
    const isOnline = Math.random() > 0.1; // 90% chance of being online
    
    if (isOnline) {
      statusIndicator.className = 'status-indicator online';
    } else {
      statusIndicator.className = 'status-indicator maintenance';
    }
  }
}

function positionTooltips() {
  const tooltipLinks = document.querySelectorAll('.footer-link[data-tooltip]');
  tooltipLinks.forEach(link => {
    link.addEventListener('mouseenter', function() {
      // Add positioning logic if needed
    });
  });
}

function checkVersion() {
  // Simulate version check
  const versionBadge = document.querySelector('.version-badge span');
  if (versionBadge) {
    // In a real application, this would check for updates
    const currentVersion = 'v2.0.1';
    versionBadge.textContent = currentVersion;
    
    // Add click handler for version info
    versionBadge.addEventListener('click', function() {
      showVersionInfo();
    });
  }
}

function showVersionInfo() {
  // Create version info modal
  const modal = document.createElement('div');
  modal.className = 'version-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Informações da Versão</h3>
      <p><strong>Versão Atual:</strong> v2.0.1</p>
      <p><strong>Última Atualização:</strong> ${new Date().toLocaleDateString('pt-PT')}</p>
      <p><strong>Status:</strong> <span class="status-online">Online</span></p>
      <button onclick="this.parentElement.parentElement.remove()">Fechar</button>
    </div>
  `;
  
  // Add modal styles
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
