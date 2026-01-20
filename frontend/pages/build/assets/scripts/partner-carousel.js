/**
 * Carrossel de Parceiros - Scroll Automático Infinito
 * Controla o movimento horizontal contínuo das marcas parceiras
 */

(function() {
  'use strict';

  // Configurações do carrossel
  const CONFIG = {
    speed: 1, // pixels por frame (ajuste para velocidade)
    pauseOnHover: true,
    autoStart: true
  };

  let carouselTrack = null;
  let animationFrameId = null;
  let isPaused = false;
  let currentPosition = 0;
  let trackWidth = 0;
  let halfTrackWidth = 0;

  /**
   * Inicializa o carrossel
   */
  function initCarousel() {
    carouselTrack = document.querySelector('.partner-carousel-track');
    if (!carouselTrack) {
      return;
    }

    // Duplica os itens para criar loop infinito
    duplicateItems();

    // Calcula dimensões
    updateDimensions();

    // Adiciona event listeners
    setupEventListeners();

    // Inicia a animação
    if (CONFIG.autoStart) {
      startAnimation();
    }

    // Atualiza dimensões quando a janela redimensiona
    window.addEventListener('resize', handleResize);
  }

  /**
   * Duplica os itens do carrossel para criar loop infinito
   */
  function duplicateItems() {
    const items = carouselTrack.querySelectorAll('.partner-item');
    if (items.length === 0) return;

    // Clona todos os itens
    items.forEach(item => {
      const clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      carouselTrack.appendChild(clone);
    });
  }

  /**
   * Atualiza as dimensões do track
   */
  function updateDimensions() {
    if (!carouselTrack) return;

    // Força reflow para garantir que as dimensões estejam atualizadas
    void carouselTrack.offsetWidth;

    const items = carouselTrack.querySelectorAll('.partner-item');
    if (items.length === 0) return;

    const itemCount = items.length;
    const halfCount = Math.floor(itemCount / 2);

    // Calcula a largura de metade dos itens (primeira metade)
    let width = 0;
    const trackStyle = window.getComputedStyle(carouselTrack);
    const gap = parseFloat(trackStyle.gap) || 0;

    for (let i = 0; i < halfCount; i++) {
      const item = items[i];
      const itemRect = item.getBoundingClientRect();
      width += itemRect.width;
    }

    // Adiciona o gap entre os itens (gap entre n itens = gap * (n-1))
    if (halfCount > 1) {
      width += gap * (halfCount - 1);
    }

    trackWidth = width;
    halfTrackWidth = trackWidth;
  }

  /**
   * Configura os event listeners
   */
  function setupEventListeners() {
    if (!carouselTrack) return;

    const wrapper = carouselTrack.closest('.partner-carousel-wrapper');
    if (!wrapper) return;

    if (CONFIG.pauseOnHover) {
      wrapper.addEventListener('mouseenter', pauseAnimation);
      wrapper.addEventListener('mouseleave', resumeAnimation);
    }

    // Pausa quando a página não está visível (performance)
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        pauseAnimation();
      } else {
        resumeAnimation();
      }
    });
  }

  /**
   * Inicia a animação do carrossel
   */
  function startAnimation() {
    if (animationFrameId) return;
    isPaused = false;
    animate();
  }

  /**
   * Pausa a animação
   */
  function pauseAnimation() {
    isPaused = true;
  }

  /**
   * Retoma a animação
   */
  function resumeAnimation() {
    if (isPaused) {
      isPaused = false;
      animate();
    }
  }

  /**
   * Loop de animação usando requestAnimationFrame
   */
  function animate() {
    if (isPaused || !carouselTrack) {
      animationFrameId = null;
      return;
    }

    // Move o carrossel
    currentPosition -= CONFIG.speed;

    // Quando chega na metade (fim da primeira cópia), reseta para o início
    if (halfTrackWidth > 0 && Math.abs(currentPosition) >= halfTrackWidth) {
      currentPosition = 0;
    }

    // Aplica a transformação sem transição para movimento suave
    carouselTrack.style.transition = 'none';
    carouselTrack.style.transform = `translateX(${currentPosition}px)`;

    // Continua a animação
    animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Manipula o redimensionamento da janela
   */
  function handleResize() {
    updateDimensions();
    // Reseta a posição para evitar problemas visuais
    currentPosition = 0;
    if (carouselTrack) {
      carouselTrack.style.transform = `translateX(0px)`;
    }
  }

  /**
   * Destrói o carrossel (limpeza)
   */
  function destroy() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    isPaused = true;
    window.removeEventListener('resize', handleResize);
  }

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCarousel);
  } else {
    initCarousel();
  }

  // Expõe funções públicas se necessário
  window.partnerCarousel = {
    start: startAnimation,
    pause: pauseAnimation,
    resume: resumeAnimation,
    destroy: destroy,
    updateSpeed: function(speed) {
      CONFIG.speed = speed;
    }
  };

})();
