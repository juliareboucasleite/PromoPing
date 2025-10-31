// script.js

// Navegação completa (fallback)
const NAVIGATION_HTML = `
  <aside class="sidebar">
    <nav>
      <ul>
        <li class="sidebar-nav-about">
          <a href="docs.html">Sobre o PromoPing</a>
        </li>
        <li class="sidebar-nav-section"><span>COMEÇAR</span></li>
        <li><a href="FirstLaunch.html" class="sidebar-nav-link">Primeiro Lançamento</a></li>
        <li><a href="installation.html" class="sidebar-nav-link">Guia de Instalação</a></li>
        <li><a href="usage-guide.html" class="sidebar-nav-link">Guia de Utilização</a></li>
        <li class="sidebar-nav-item"><span>SCRIPTING DA UI</span></li>
        <li><a href="api-reference.html" class="sidebar-nav-link inactive">Referência da API <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" stroke-width="2"><polyline points="9,6 15,12 9,18"></polyline></svg></a></li>
        <li class="sidebar-nav-item"><span>SUPORTE</span></li>
        <li><a href="support.html" class="sidebar-nav-link">Suporte</a></li>
        <li><a href="faq.html" class="sidebar-nav-link">FAQ</a></li>
        <li><a href="changelog.html" class="sidebar-nav-link">Changelog</a></li>
        <li><a href="service-status.html" class="sidebar-nav-link">Status do Serviço</a></li>
        <li><a href="incident-history.html" class="sidebar-nav-link">Histórico de Incidentes</a></li>
        <li><a href="terms.html" class="sidebar-nav-link">Termos de Uso</a></li>
      </ul>
    </nav>
    <div class="powered"><p>Made by PromoPingg</p></div>
  </aside>
`;

// Função para carregar navegação dinamicamente
async function loadNavigation() {
  const sidebarPlaceholder = document.getElementById('sidebar-nav-placeholder');
  if (!sidebarPlaceholder) {
    // Tentar novamente após um pequeno delay
    setTimeout(() => {
      loadNavigation();
    }, 100);
    return;
  }
  
  // Se já tiver conteúdo, não recarregar
  if (sidebarPlaceholder.innerHTML.trim() !== '') {
    highlightActiveLink();
    return;
  }
  
  try {
    // Tentar carregar nav.html - sempre do mesmo diretório
    const navPath = 'nav.html';
    const response = await fetch(`${navPath}?t=${Date.now()}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load navigation: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    if (!html || html.trim() === '') {
      throw new Error('Navegação está vazia');
    }
    
    sidebarPlaceholder.innerHTML = html;
    
    // Após carregar, marcar link ativo
    setTimeout(() => {
      highlightActiveLink();
    }, 150);
  } catch (error) {
    console.error('Erro ao carregar navegação:', error);
    // Fallback: usar navegação embutida
    sidebarPlaceholder.innerHTML = NAVIGATION_HTML;
    setTimeout(() => {
      highlightActiveLink();
    }, 150);
  }
}

// Função para marcar link ativo
function highlightActiveLink() {
  const links = document.querySelectorAll(".sidebar nav ul li a");
  const currentPath = window.location.pathname;
  const currentFile = currentPath.split("/").pop() || window.location.href.split("/").pop() || "docs.html";
  
  links.forEach(link => {
    const href = link.getAttribute("href");
    // Remover classe active de todos os links
    link.classList.remove("active");
    
    // Verificar se é a página atual
    if (href === currentFile || 
        href === currentPath ||
        (currentFile === "" && (href === "docs.html" || href === "#")) ||
        (href && (href === currentFile || href.includes(currentFile)) && currentFile !== "" && href !== "#")) {
      link.classList.add("active");
      // Remover classe inactive se presente
      link.classList.remove("inactive");
    } else if (href && href !== "#" && href !== currentFile) {
      // Adicionar inactive se não for a página atual e não for um link genérico
      if (!link.classList.contains("inactive") && link.closest("li").querySelector("svg")) {
        link.classList.add("inactive");
      }
    }
  });
}

// Função de inicialização
function init() {
  // Carregar navegação imediatamente
  loadNavigation();
  
  // === Smooth scroll for internal anchors ===
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth"
        });
      }
    });
  });

  // === Copy Button Functionality ===
  const copyButton = document.querySelector('.copy-button');
  if (copyButton) {
    copyButton.addEventListener('click', () => {
      const content = document.querySelector('.content').innerText;
      navigator.clipboard.writeText(content).then(() => {
        // Visual feedback
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
          Copied!
        `;
        copyButton.style.color = '#10b981';
        
        setTimeout(() => {
          copyButton.innerHTML = originalText;
          copyButton.style.color = '#aaa';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    });
  }

  // === Emoji Feedback System ===
  const emojiButtons = document.querySelectorAll('.emoji-btn');
  const thankYouMessage = document.querySelector('.thank-you-message');
  const commentSection = document.querySelector('.comment-section');
  
  emojiButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      emojiButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Get the emoji data
      const emoji = button.getAttribute('data-emoji');
      
      // Show "Thank you!" message
      if (thankYouMessage) {
        thankYouMessage.style.display = 'block';
      }
      
      // Show comment section after a short delay
      if (commentSection) {
        setTimeout(() => {
          commentSection.style.display = 'block';
        }, 500);
      }
      
      // Log feedback
      console.log(`User feedback: ${emoji}`);
      
      // Optional: Send feedback to server
      // sendFeedback(emoji);
    });
  });

  // === Submit Feedback ===
  const submitButton = document.querySelector('.submit-feedback');
  const textarea = document.querySelector('.comment-section textarea');
  
  if (submitButton) {
    submitButton.addEventListener('click', () => {
      const comment = textarea ? textarea.value.trim() : '';
      const selectedEmoji = document.querySelector('.emoji-btn.active');
      
      if (comment) {
        console.log(`Feedback submitted: ${selectedEmoji?.getAttribute('data-emoji')} - ${comment}`);
        
        // Show success message
        submitButton.textContent = 'Submitted!';
        submitButton.style.background = '#10b981';
        
        // Disable form
        if (textarea) {
          textarea.disabled = true;
        }
        submitButton.disabled = true;
        
        // Optional: Send to server
        // sendFeedbackWithComment(selectedEmoji, comment);
      } else if (selectedEmoji) {
        // Just submit emoji feedback
        console.log(`Emoji feedback submitted: ${selectedEmoji.getAttribute('data-emoji')}`);
        submitButton.textContent = 'Submitted!';
        submitButton.style.background = '#10b981';
        submitButton.disabled = true;
      }
    });
  }

  // === Search Functionality ===
  const searchInput = document.querySelector('.search-box input');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
      }
    });
    
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      // Implement search functionality here
      console.log('Searching for:', query);
    });
  }

  // === Keyboard Shortcuts ===
  document.addEventListener('keydown', (e) => {
    // Ctrl + K for search
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      searchInput?.focus();
    }
  });

  // === Scroll to Top Functionality ===
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Add scroll to top button if needed
  const addScrollToTopButton = () => {
    const button = document.createElement('button');
    button.innerHTML = '↑';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #3b82f6;
      color: white;
      border: none;
      cursor: pointer;
      font-size: 18px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    button.addEventListener('click', scrollToTop);
    document.body.appendChild(button);
    
    // Show/hide based on scroll position
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        button.style.opacity = '1';
      } else {
        button.style.opacity = '0';
      }
    });
  };

  // Initialize scroll to top button
  addScrollToTopButton();
  
  // Garantir que a navegação foi carregada após 500ms
  setTimeout(() => {
    const sidebarPlaceholder = document.getElementById('sidebar-nav-placeholder');
    if (sidebarPlaceholder && !sidebarPlaceholder.innerHTML.trim()) {
      console.warn('Navegação não carregada, tentando novamente...');
      loadNavigation();
    }
  }, 500);
}

// Carregar assim que o script for executado
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", init);
} else {
  // DOM já carregado
  init();
}

// === Optional: Send feedback to server ===
function sendFeedback(emoji) {
  // This is a placeholder - implement your feedback system
  fetch('/api/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      emoji: emoji,
      page: window.location.pathname,
      timestamp: new Date().toISOString()
    })
  }).catch(err => {
    console.error('Failed to send feedback:', err);
  });
}
