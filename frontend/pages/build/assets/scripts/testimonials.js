/**
 * Carrega e exibe depoimentos/testimonials da base de dados
 */

(function() {
  'use strict';

  const API_ENDPOINT = '/api/status/reviews/public';
  const DEFAULT_LIMIT = 4;

  // Traduções para inglês britânico
  const translations = {
    'A carregar depoimentos...': 'Loading testimonials...',
    'Ainda não há depoimentos disponíveis.': 'No testimonials available yet.',
    'Erro ao carregar depoimentos.': 'Error loading testimonials.',
    'Anónimo': 'Anonymous',
    'Utilizador': 'User',
    'Utilizador do Bot': 'Bot User'
  };

  // Verifica se está em inglês
  function isEnglish() {
    const langText = document.getElementById('lang-text');
    return langText && langText.textContent.trim() === 'EN';
  }

  // Traduz texto se estiver em inglês
  function translate(text) {
    if (isEnglish() && translations[text]) {
      return translations[text];
    }
    return text;
  }

  /**
   * Gera estrelas baseado no rating (verdes como no exemplo)
   */
  function generateStars(rating) {
    // Se não houver rating, mostrar 5 estrelas (assumir positivo)
    if (!rating || rating < 1 || rating > 5) {
      return '<span class="star filled">★</span>'.repeat(5);
    }
    const fullStars = Math.floor(rating);
    const emptyStars = 5 - fullStars;
    return '<span class="star filled">★</span>'.repeat(fullStars) + 
           '<span class="star empty">☆</span>'.repeat(emptyStars);
  }

  /**
   * Gera iniciais do nome
   */
  function getInitials(name) {
    const anonymousPT = 'Anónimo';
    const anonymousEN = 'Anonymous';
    const userPT = 'Utilizador';
    const userEN = 'User';
    
    if (!name || name === anonymousPT || name === anonymousEN || name === userPT || name === userEN) {
      return 'U';
    }
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Formata o texto do depoimento (limita tamanho se necessário)
   */
  function formatTestimonialText(text, maxLength = 180) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  /**
   * Cria um card de depoimento
   */
  function createTestimonialCard(review) {
    const card = document.createElement('div');
    card.className = 'testimonial-card';

    // Tratar rating: se for null/undefined, usar 5 estrelas
    const rating = review.rating || null;
    const stars = generateStars(rating);
    const initials = getInitials(review.author.name);
    const text = formatTestimonialText(review.text);
    
    // Determina o nome do autor (com tradução)
    let authorName = review.author.isAnonymous ? 'Anónimo' : (review.author.name || 'Utilizador');
    authorName = translate(authorName);
    
    // Determina o role (com tradução)
    let role = review.type === 'site' ? 'Utilizador' : 
               review.type === 'bot' ? 'Utilizador do Bot' : 
               review.type === 'suporte' ? 'Utilizador' :
               'Utilizador';
    role = translate(role);

    card.innerHTML = `
      <div class="testimonial-stars">
        ${stars}
      </div>
      <div class="testimonial-header">
        <div class="testimonial-author">
          <div class="testimonial-avatar">
            <div class="avatar-placeholder">${initials}</div>
          </div>
          <div class="testimonial-info">
            <div class="testimonial-name">${authorName}</div>
            <div class="testimonial-role">${role}</div>
          </div>
        </div>
        <div class="testimonial-logo">
          <div class="logo-placeholder">PromoPing</div>
        </div>
      </div>
      <div class="testimonial-content">
        <p class="testimonial-text">${text}</p>
      </div>
    `;

    return card;
  }

  /**
   * Carrega e exibe os depoimentos em carrossel horizontal
   */
  async function loadTestimonials() {
    const track = document.getElementById('testimonials-track');
    
    if (!track) {
      console.warn('[TESTIMONIALS] Track não encontrado');
      return;
    }

    try {
      // Mostrar loading state (com tradução)
      const loadingText = translate('A carregar depoimentos...');
      track.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.7); padding: 40px; min-width: 100%;">${loadingText}</div>`;

      // Buscar reviews
      const response = await fetch(`${API_ENDPOINT}?limit=30`);
      
      if (!response.ok) {
        console.error('[TESTIMONIALS] Erro na resposta:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('Dados recebidos:', data);

      if (data.status !== 'ok' || !data.reviews || data.reviews.length === 0) {
        console.warn('[TESTIMONIALS] Nenhuma review encontrada. Status:', data.status, 'Count:', data.count);
        const noTestimonialsText = translate('Ainda não há depoimentos disponíveis.');
        track.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.7); padding: 40px; min-width: 100%;">${noTestimonialsText}</div>`;
        return;
      }

      // Limpar track
      track.innerHTML = '';

      // Criar cards
      const cards = [];
      data.reviews.forEach(review => {
        const card = createTestimonialCard(review);
        cards.push(card);
      });

      // Duplicar cards para criar loop infinito
      [...cards, ...cards].forEach(card => {
        track.appendChild(card.cloneNode(true));
      });

      // Garantir que a animação está aplicada (forçar reflow)
      void track.offsetWidth;
      
      // Remover qualquer estilo inline que possa estar bloqueando
      track.style.animation = '';
      track.style.transform = '';
      
      // Forçar aplicação da animação CSS
      setTimeout(() => {
        track.style.animation = 'scrollLeft 40s linear infinite';
      }, 100);

    } catch (error) {
      console.error('Erro ao carregar depoimentos:', error);
      const errorText = translate('Erro ao carregar depoimentos.');
      track.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.7); padding: 40px; min-width: 100%;">${errorText}</div>`;
    }
  }


  // Inicializar quando o DOM estiver pronto
  function init() {
    console.log('Script carregado, estado:', document.readyState);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded disparado');
        loadTestimonials();
      });
    } else {
      console.log('DOM já pronto, carregando imediatamente');
      // Aguardar um pouco para garantir que todos os scripts estejam carregados
      setTimeout(loadTestimonials, 100);
    }
  }

  init();

  // Recarrega os depoimentos quando o idioma muda (para atualizar traduções)
  function reloadOnLanguageChange() {
    // Observa mudanças no texto do idioma
    const langText = document.getElementById('lang-text');
    if (langText) {
      let lastLang = langText.textContent.trim();
      const observer = new MutationObserver(() => {
        const currentLang = langText.textContent.trim();
        // Só recarrega se o idioma realmente mudou (PT <-> EN)
        if (currentLang !== lastLang && (currentLang === 'PT' || currentLang === 'EN')) {
          lastLang = currentLang;
          // Quando o idioma muda, recarrega os depoimentos para atualizar traduções
          loadTestimonials();
        }
      });
      observer.observe(langText, { childList: true, characterData: true, subtree: true });
    }
  }

  // Inicializa observador de mudança de idioma
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reloadOnLanguageChange);
  } else {
    reloadOnLanguageChange();
  }

  // Expõe função para recarregar manualmente se necessário
  window.loadTestimonials = loadTestimonials;

})();
