// script.js para About

// Navegação completa (fallback)
const NAVIGATION_HTML = `
  <aside class="sidebar">
    <nav>
      <ul>
        <li class="sidebar-nav-about">
          <a href="../index.html">PromoPing</a>
        </li>
        <li class="sidebar-nav-section"><span>SOBRE NÓS</span></li>
        <li><a href="alertas.html" class="sidebar-nav-link">O que é o PromoPing?</a></li>
        <li><a href="blog.html" class="sidebar-nav-link">Blog</a></li>
        <li><a href="casos-uso.html" class="sidebar-nav-link">Casos de uso</a></li>
        <li><a href="monitoramento.html" class="sidebar-nav-link">Monitoramento</a></li>
        <li><a href="alertas.html" class="sidebar-nav-link">Alertas</a></li>
        <li><a href="relatorios.html" class="sidebar-nav-link">Relatórios</a></li>
        <li><a href="../docs/privacy.html" class="sidebar-nav-link">Política de cookies</a></li>
      </ul>
    </nav>
    <div class="powered"><p>Made by PromoPing</p></div>
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
    const baseTag = document.querySelector('base');
    const baseHref = baseTag ? baseTag.getAttribute('href') : '/';
    const navPath = baseHref + 'About/nav.html';
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
  const currentFile = currentPath.split("/").pop() || window.location.href.split("/").pop() || "alertas.html";
  
  links.forEach(link => {
    const href = link.getAttribute("href");
    // Remover classe active de todos os links
    link.classList.remove("active");
    
    // Verificar se é a página atual
    if (href === currentFile || 
        href === currentPath ||
        (currentFile === "" && (href === "alertas.html" || href === "#")) ||
        (href && (href === currentFile || href.includes(currentFile)) && currentFile !== "" && href !== "#")) {
      link.classList.add("active");
      // Remover classe inactive se presente
      link.classList.remove("inactive");
    } else if (href && href !== "#" && href !== currentFile) {
      // Adicionar inactive se não for a página atual e não for um link genérico
      if (!link.classList.contains("inactive") && link.closest("li")?.querySelector("svg")) {
        link.classList.add("inactive");
      }
    }
  });
}

// Função para carregar footer dinamicamente - DESATIVADA
/*
async function loadFooter() {
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (!footerPlaceholder) {
    return;
  }
  
  try {
    const baseTag = document.querySelector('base');
    const baseHref = baseTag ? baseTag.getAttribute('href') : '/';
    const footerPath = baseHref + 'inc/footer.html';
    
    const response = await fetch(`${footerPath}?t=${Date.now()}`, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load footer: ${response.status} ${response.statusText}`);
    }
    
    let data = await response.text();
    
    // Corrige os caminhos das imagens e links ANTES de inserir o HTML
    let correctedData = data.replace(/src="assets\//g, `src="${baseHref}assets/`);
    correctedData = correctedData.replace(/href="pages\//g, `href="${baseHref}pages/`);
    correctedData = correctedData.replace(/href="#/g, `href="${baseHref}#`);
    
    footerPlaceholder.innerHTML = correctedData;
  } catch (error) {
    console.warn('Erro ao carregar footer:', error);
    // Fallback estático
    footerPlaceholder.innerHTML = `
      <footer class="pp-footer">
        <div class="pp-container">
          <div class="pp-footer-content">
            <div class="pp-footer-brand">
              <img src="../../assets/images/PromoPing.png" alt="PromoPing" class="pp-footer-logo">
              <span class="pp-footer-title">PromoPing</span>
            </div>
            <div class="pp-footer-links">
              <a href="about.html" class="pp-footer-link">Sobre</a>
              <a href="blog.html" class="pp-footer-link">Blog</a>
              <a href="casos-uso.html" class="pp-footer-link">Casos de uso</a>
            </div>
          </div>
          <div class="pp-footer-bottom">
            <p>&copy; 2024-2025 PromoPing. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    `;
  }
}
*/

// Função de inicialização
function init() {
  // Carregar navegação imediatamente
  loadNavigation();
  
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

  document.addEventListener('keydown', (e) => {
    // Ctrl + K for search
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      searchInput?.focus();
    }
  });
  
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

