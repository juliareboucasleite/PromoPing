// script.js

// Navegação completa (fallback)
const NAVIGATION_HTML = `
  <aside class="sidebar">
    <nav>
      <ul>
        <li class="sidebar-nav-about">
          <a href="/docs">Sobre o PromoPing</a>
        </li>
        <li class="sidebar-nav-section"><span>COMEÇAR</span></li>
        <li><a href="/docs/FirstLaunch" class="sidebar-nav-link">Primeiro Lançamento</a></li>
        <li><a href="/docs/installation" class="sidebar-nav-link">Guia de Instalação</a></li>
        <li><a href="/docs/usage-guide" class="sidebar-nav-link">Guia de Utilização</a></li>
        <li class="sidebar-nav-item"><span>SCRIPTING DA UI</span></li>
        <li><a href="/docs/api-reference" class="sidebar-nav-link inactive">Referência da API <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3" stroke-width="2"><polyline points="9,6 15,12 9,18"></polyline></svg></a></li>
        <li class="sidebar-nav-item"><span>SUPORTE</span></li>
        <li><a href="/docs/support" class="sidebar-nav-link">Suporte</a></li>
        <li><a href="/docs/faq" class="sidebar-nav-link">FAQ</a></li>
        <li><a href="/docs/changelog" class="sidebar-nav-link">Changelog</a></li>
        <li><a href="/docs/service-status" class="sidebar-nav-link">Status do Serviço</a></li>
        <li><a href="/docs/incident-history" class="sidebar-nav-link">Histórico de Incidentes</a></li>
        <li><a href="/docs/terms" class="sidebar-nav-link">Termos de Uso</a></li>
      </ul>
    </nav>
    <div class="powered"><p>Made by PromoPingg</p></div>
  </aside>
`;

// Função para carregar navegação dinamicamente
async function loadNavigation() {
  let sidebarPlaceholder = document.getElementById('sidebar-nav-placeholder');
  
  // Tentar encontrar o placeholder até 10 vezes (1 segundo)
  let attempts = 0;
  while (!sidebarPlaceholder && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 100));
    sidebarPlaceholder = document.getElementById('sidebar-nav-placeholder');
    attempts++;
  }
  
  if (!sidebarPlaceholder) {
    console.error('Placeholder de navegação não encontrado após 1 segundo');
    return;
  }
  
  // Se já tiver conteúdo completo (mais de 100 caracteres), apenas atualizar link ativo
  if (sidebarPlaceholder.innerHTML.trim().length > 100) {
    highlightActiveLink();
    return;
  }
  
  try {
    // Tentar carregar nav.html - sempre do mesmo diretório
    const navPath = 'docs/nav.html';
    const response = await fetch(`${navPath}?t=${Date.now()}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load navigation: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    if (!html || html.trim() === '') {
      throw new Error('Navegação está vazia');
    }
    
    // Limpar placeholder antes de inserir novo conteúdo
    sidebarPlaceholder.innerHTML = '';
    sidebarPlaceholder.innerHTML = html;
    
    // Forçar re-renderização
    sidebarPlaceholder.offsetHeight;
    
    // Após carregar, marcar link ativo com múltiplas tentativas
    setTimeout(() => {
      highlightActiveLink();
    }, 50);
    
    setTimeout(() => {
      highlightActiveLink();
    }, 200);
    
  } catch (error) {
    console.error('Erro ao carregar navegação:', error);
    // Fallback: usar navegação embutida
    sidebarPlaceholder.innerHTML = '';
    sidebarPlaceholder.innerHTML = NAVIGATION_HTML;
    
    // Forçar re-renderização
    sidebarPlaceholder.offsetHeight;
    
    setTimeout(() => {
      highlightActiveLink();
    }, 50);
    
    setTimeout(() => {
      highlightActiveLink();
    }, 200);
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

  // === Copy Button Dropdown Functionality ===
  const copyButtonWrapper = document.querySelector('.copy-button-wrapper');
  const copyButton = document.querySelector('.copy-button');
  
  if (copyButtonWrapper && copyButton) {
    // Toggle dropdown on button click
    copyButton.addEventListener('click', (e) => {
      e.stopPropagation();
      copyButtonWrapper.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!copyButtonWrapper.contains(e.target)) {
        copyButtonWrapper.classList.remove('active');
      }
    });

    // Handle dropdown item clicks
    const copyPageBtn = copyButtonWrapper.querySelector('[data-action="copy-page"]');
    const viewMarkdownBtn = copyButtonWrapper.querySelector('[data-action="view-markdown"]');

    if (copyPageBtn) {
      copyPageBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const content = document.querySelector('.content');
        if (!content) return;

        // Convert HTML to Markdown
        const markdown = htmlToMarkdown(content);
        
        try {
          await navigator.clipboard.writeText(markdown);
          
          // Visual feedback
          const originalText = copyPageBtn.innerHTML;
          copyPageBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
            <div class="copy-dropdown-item-content">
              <span class="copy-dropdown-item-title">Copied!</span>
              <span class="copy-dropdown-item-desc">Page copied as Markdown</span>
            </div>
          `;
          
          setTimeout(() => {
            copyPageBtn.innerHTML = originalText;
            copyButtonWrapper.classList.remove('active');
          }, 2000);
        } catch (err) {
          console.error('Failed to copy: ', err);
        }
      });
    }

    if (viewMarkdownBtn) {
      viewMarkdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const content = document.querySelector('.content');
        if (!content) return;

        // Convert HTML to Markdown
        const markdown = htmlToMarkdown(content);
        
        // Create a new window with the markdown
        const newWindow = window.open('', '_blank');
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${document.title} - Markdown</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                max-width: 800px;
                margin: 40px auto;
                padding: 20px;
                background: #1a1a1a;
                color: #fff;
                line-height: 1.6;
                white-space: pre-wrap;
              }
            </style>
          </head>
          <body>${escapeHtml(markdown)}</body>
          </html>
        `);
        newWindow.document.close();
        copyButtonWrapper.classList.remove('active');
      });
    }
  }

  // Helper function to convert HTML to Markdown
  function htmlToMarkdown(element) {
    let markdown = '';
    const title = document.querySelector('h1')?.textContent || '';
    if (title) {
      markdown += `# ${title}\n\n`;
    }

    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent.trim();
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tagName = node.tagName?.toLowerCase();
      const text = Array.from(node.childNodes).map(processNode).join('').trim();

      switch (tagName) {
        case 'h1':
          return `# ${text}\n\n`;
        case 'h2':
          return `## ${text}\n\n`;
        case 'h3':
          return `### ${text}\n\n`;
        case 'h4':
          return `#### ${text}\n\n`;
        case 'p':
          return `${text}\n\n`;
        case 'strong':
        case 'b':
          return `**${text}**`;
        case 'em':
        case 'i':
          return `*${text}*`;
        case 'ul':
        case 'ol':
          return `${text}\n`;
        case 'li':
          return `- ${text}\n`;
        case 'code':
          return `\`${text}\``;
        case 'a':
          const href = node.getAttribute('href') || '';
          return `[${text}](${href})`;
        default:
          return text;
      }
    };

    const content = document.querySelector('.content');
    if (content) {
      const children = Array.from(content.children);
      // Skip the header and footer
      const mainContent = children.filter(child => 
        !child.classList.contains('content-header') && 
        child.tagName !== 'FOOTER' &&
        !child.classList.contains('next-card')
      );
      
      markdown += mainContent.map(processNode).join('\n');
    }

    return markdown.trim();
  }

  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

// Carregar navegação IMEDIATAMENTE (antes mesmo do DOMContentLoaded)
loadNavigation();

// Carregar assim que o script for executado
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", () => {
    // Carregar navegação novamente caso não tenha carregado
    setTimeout(() => {
      const sidebarPlaceholder = document.getElementById('sidebar-nav-placeholder');
      if (sidebarPlaceholder && sidebarPlaceholder.innerHTML.trim().length < 100) {
        loadNavigation();
      }
      init();
    }, 100);
  });
} else {
  // DOM já carregado
  setTimeout(() => {
    init();
  }, 100);
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
