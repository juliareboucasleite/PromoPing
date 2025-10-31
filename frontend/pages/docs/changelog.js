// changelog.js - Carrega changelog dinamicamente dos releases do GitHub

const GITHUB_OWNER = 'juliareboucasleite';
const GITHUB_REPO = 'PromoPing';
// Usar o backend da aplicação que tem acesso ao token do GitHub para repositórios privados
const API_BASE_URL = window.location.origin.includes('localhost') 
  ? 'http://127.0.0.1:3000' 
  : window.location.origin;
const GITHUB_API_URL = `${API_BASE_URL}/api/github/releases?owner=${GITHUB_OWNER}&repo=${GITHUB_REPO}&limit=20`;
const MAX_RELEASES = 20; // Limitar a 20 releases mais recentes

// Função para converter markdown básico para HTML
function markdownToHtml(text) {
  if (!text) return '';
  
  return text
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    // Lists
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" style="color: #ff9800;">$1</a>')
    // Code blocks
    .replace(/`([^`]+)`/gim, '<code style="background: #232326; padding: 0.2rem 0.4rem; border-radius: 4px; color: #ff9800;">$1</code>')
    // Line breaks
    .replace(/\n/gim, '<br>');
}

// Função para determinar o tipo de release (major, minor, patch)
function getReleaseType(tagName, body) {
  const tag = tagName.toLowerCase();
  
  if (tag.includes('major') || tag.match(/v\d+\.0\.0/) || body?.toLowerCase().includes('major')) {
    return 'major';
  } else if (tag.includes('minor') || tag.match(/v\d+\.\d+\.0/) || body?.toLowerCase().includes('minor')) {
    return 'minor';
  } else if (tag.includes('patch') || tag.match(/v\d+\.\d+\.\d+/) || body?.toLowerCase().includes('patch')) {
    return 'patch';
  } else if (tag.match(/v1\.0\.0/)) {
    return 'initial';
  }
  
  // Tentar determinar pelo número da versão
  const versionMatch = tag.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (versionMatch) {
    const major = parseInt(versionMatch[1]);
    const minor = parseInt(versionMatch[2]);
    const patch = parseInt(versionMatch[3]);
    
    if (major > 0 && minor === 0 && patch === 0) {
      return 'major';
    } else if (minor > 0 && patch === 0) {
      return 'minor';
    } else {
      return 'patch';
    }
  }
  
  return 'minor';
}

// Função para formatar a data
function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
  return date.toLocaleDateString('pt-PT', options);
}

// Função para obter badge de tipo
function getBadgeClass(type) {
  const badges = {
    'major': 'major',
    'minor': 'minor',
    'patch': 'patch',
    'initial': 'initial',
    'planned': 'planned'
  };
  return badges[type] || 'minor';
}

// Função para processar o corpo do release e extrair categorias
function processReleaseBody(body) {
  if (!body) {
    return {
      features: [],
      improvements: [],
      fixes: [],
      security: [],
      other: []
    };
  }
  
  const sections = {
    features: [],
    improvements: [],
    fixes: [],
    security: [],
    other: []
  };
  
  // Dividir por linhas
  const lines = body.split('\n').filter(line => line.trim());
  
  let currentSection = 'other';
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();
    
    // Detectar seção
    if (lowerLine.includes('nova') || lowerLine.includes('feature') || lowerLine.includes('funcionalidade')) {
      currentSection = 'features';
    } else if (lowerLine.includes('melhoria') || lowerLine.includes('improvement') || lowerLine.includes('melhor')) {
      currentSection = 'improvements';
    } else if (lowerLine.includes('correção') || lowerLine.includes('fix') || lowerLine.includes('bug') || lowerLine.includes('corrig')) {
      currentSection = 'fixes';
    } else if (lowerLine.includes('segurança') || lowerLine.includes('security') || lowerLine.includes('vulnerabilidade')) {
      currentSection = 'security';
    }
    
    // Adicionar item à seção se for uma lista
    if (line.match(/^[\-\*\+]\s+|^\d+\.\s+/)) {
      sections[currentSection].push(line.replace(/^[\-\*\+\d\.]\s+/, '').trim());
    } else if (line.trim() && !line.match(/^#/)) {
      // Linhas de texto normal também vão para "other"
      sections[currentSection].push(line.trim());
    }
  }
  
  return sections;
}

// Função para criar HTML do release
function createReleaseHTML(release) {
  const type = getReleaseType(release.tag_name, release.body);
  const badgeClass = getBadgeClass(type);
  const date = formatDate(release.published_at || release.created_at);
  const sections = processReleaseBody(release.body);
  
  let html = `
    <div class="changelog-version">
      <h2>${release.tag_name} <span class="version-date">- ${date}</span></h2>
      <div class="version-badge ${badgeClass}">${type.toUpperCase()}</div>
  `;
  
  // Adicionar link para o release no GitHub
  if (release.html_url) {
    html += `
      <p style="margin-top: 0.5rem;">
        <a href="${release.html_url}" target="_blank" rel="noopener noreferrer" style="color: #ff9800; text-decoration: none;">
          Ver no GitHub <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline; vertical-align: middle; margin-left: 0.25rem;">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </p>
    `;
  }
  
  // Adicionar seções
  if (sections.features.length > 0) {
    html += '<h3>✨ Novas Funcionalidades</h3><ul>';
    sections.features.forEach(item => {
      html += `<li>${markdownToHtml(item)}</li>`;
    });
    html += '</ul>';
  }
  
  if (sections.improvements.length > 0) {
    html += '<h3>🚀 Melhorias</h3><ul>';
    sections.improvements.forEach(item => {
      html += `<li>${markdownToHtml(item)}</li>`;
    });
    html += '</ul>';
  }
  
  if (sections.security.length > 0) {
    html += '<h3>🔒 Melhorias de Segurança</h3><ul>';
    sections.security.forEach(item => {
      html += `<li>${markdownToHtml(item)}</li>`;
    });
    html += '</ul>';
  }
  
  if (sections.fixes.length > 0) {
    html += '<h3>🐛 Correções</h3><ul>';
    sections.fixes.forEach(item => {
      html += `<li>${markdownToHtml(item)}</li>`;
    });
    html += '</ul>';
  }
  
  // Se não houver seções específicas, usar o corpo completo formatado
  if (sections.features.length === 0 && sections.improvements.length === 0 && 
      sections.security.length === 0 && sections.fixes.length === 0 && sections.other.length === 0 && release.body) {
    html += `<div style="line-height: 1.8; color: #ccc;">${markdownToHtml(release.body)}</div>`;
  } else if (sections.other.length > 0 && sections.features.length === 0 && sections.improvements.length === 0) {
    html += '<h3>📝 Alterações</h3><ul>';
    sections.other.forEach(item => {
      html += `<li>${markdownToHtml(item)}</li>`;
    });
    html += '</ul>';
  }
  
  html += '</div>';
  
  return html;
}

// Função principal para carregar releases
async function loadChangelogFromGitHub() {
  const changelogContainer = document.getElementById('changelog-container');
  if (!changelogContainer) {
    console.error('Container de changelog não encontrado');
    return;
  }
  
  // Mostrar loading
  changelogContainer.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: #ccc;">
      <p>Carregando changelog do GitHub...</p>
      <p style="font-size: 0.9rem; margin-top: 1rem;">Se não carregar, verifique sua conexão com a internet.</p>
    </div>
  `;
  
  try {
    // Tentar buscar releases através do backend (que tem acesso ao token do GitHub)
    const response = await fetch(GITHUB_API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      // Modo cors para permitir requisições cross-origin
      mode: 'cors'
    });
    
    if (!response.ok) {
      // Tentar obter mensagem de erro do backend
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // Se não conseguir parsear JSON, usar mensagem padrão
      }
      
      // Se for 404, o repositório pode não existir, ser privado ou não ter releases
      if (response.status === 404) {
        changelogContainer.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: #f44336;">
            <p>❌ Repositório não encontrado ou sem releases</p>
            <p style="font-size: 0.9rem; margin-top: 1rem; color: #ccc;">
              Não foi possível carregar os releases. Possíveis causas:
            </p>
            <ul style="text-align: left; display: inline-block; margin-top: 1rem; color: #ccc; font-size: 0.9rem;">
              <li>O repositório não existe: <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}" target="_blank" style="color: #ff9800;">github.com/${GITHUB_OWNER}/${GITHUB_REPO}</a></li>
              <li>O repositório é privado e não há token configurado</li>
              <li>Ainda não foram criados releases no GitHub</li>
              <li>Problema de conexão com a API do GitHub</li>
            </ul>
            <p style="font-size: 0.8rem; margin-top: 1rem; color: #888;">
              💡 <strong>Dica:</strong> Se o repositório é privado, configure a variável <code style="background: #232326; padding: 0.2rem 0.4rem; border-radius: 4px;">GITHUB_TOKEN</code> no arquivo <code style="background: #232326; padding: 0.2rem 0.4rem; border-radius: 4px;">.env</code> do backend
            </p>
            <p style="font-size: 0.9rem; margin-top: 1.5rem;">
              <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases" target="_blank" style="color: #ff9800; font-weight: 600;">
                Verificar releases no GitHub →
              </a>
            </p>
          </div>
        `;
        return;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // O backend retorna { status: "ok", releases: [...] }
    const releases = data.releases || data;
    
    // Verificar se há releases
    if (!releases || releases.length === 0) {
      changelogContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: #ccc;">
          <p>Nenhum release encontrado no GitHub.</p>
          <p style="font-size: 0.9rem; margin-top: 1rem;">
            <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases" target="_blank" style="color: #ff9800;">
              Ver releases no GitHub
            </a>
          </p>
          <p style="font-size: 0.8rem; margin-top: 1rem; color: #888;">
            O repositório pode não ter releases ainda. Crie um release no GitHub para que apareça aqui.
          </p>
          ${data.message ? `<p style="font-size: 0.8rem; margin-top: 0.5rem; color: #888;">${data.message}</p>` : ''}
        </div>
      `;
      return;
    }
    
    // Limitar número de releases
    const recentReleases = releases.slice(0, MAX_RELEASES);
    
    // Gerar HTML para cada release
    let html = '';
    recentReleases.forEach(release => {
      html += createReleaseHTML(release);
    });
    
    // Adicionar link para ver todos os releases
    html += `
      <div style="text-align: center; margin-top: 2rem; padding: 1.5rem; background: #18181a; border-radius: 8px; border: 1px solid #232326;">
        <p style="color: #ccc; margin-bottom: 1rem;">Quer ver todos os releases?</p>
        <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases" 
           target="_blank" 
           rel="noopener noreferrer" 
           style="color: #ff9800; text-decoration: none; font-weight: 600;">
          Ver todos os releases no GitHub →
        </a>
      </div>
    `;
    
    changelogContainer.innerHTML = html;
    
  } catch (error) {
    console.error('Erro ao carregar releases do GitHub:', error);
    changelogContainer.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: #f44336;">
        <p>❌ Erro ao carregar changelog do GitHub</p>
        <p style="font-size: 0.9rem; margin-top: 1rem; color: #ccc;">
          Não foi possível carregar os releases automaticamente.
        </p>
        <p style="font-size: 0.9rem; margin-top: 1rem;">
          <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases" target="_blank" style="color: #ff9800;">
            Ver releases no GitHub
          </a>
        </p>
        <p style="font-size: 0.8rem; margin-top: 1rem; color: #888;">
          Detalhes do erro: ${error.message}
        </p>
        <p style="font-size: 0.8rem; margin-top: 0.5rem; color: #888;">
          Verifique se o repositório existe e está acessível: 
          <a href="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}" target="_blank" style="color: #ff9800;">
            github.com/${GITHUB_OWNER}/${GITHUB_REPO}
          </a>
        </p>
      </div>
    `;
  }
}

// Carregar changelog quando a página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadChangelogFromGitHub);
} else {
  loadChangelogFromGitHub();
}

