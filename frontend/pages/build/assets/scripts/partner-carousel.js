/**
 * Carrossel de parceiros em Canvas – animação contínua sem depender do layout do DOM.
 */
(function() {
  'use strict';

  window.partnerCarousel = window.partnerCarousel || {
    start: function() {},
    pause: function() {},
    resume: function() {},
    destroy: function() {},
    updateDimensions: function() {},
    updateSpeed: function() {}
  };

  const PARTNERS = [
    'Pingo Doce',
    'Continente',
    'Auchan',
    'Worten',
    'FNAC',
    'IKEA',
    'Radio Popular',
    'PcDiga'
  ];

  const CONFIG = {
    speed: 0.4, // pixels por frame (menor = mais lento; loop infinito contínuo)
    pauseOnHover: false,
    autoStart: true,
    textColor: '#ececec',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 22,
    gap: 80
  };

  let canvas = null;
  let ctx = null;
  let wrapper = null;
  let animationFrameId = null;
  let isPaused = false;
  let offsetX = 0;
  let loopWidth = 0;
  let dpr = 1;

  function init() {
    canvas = document.getElementById('partner-carousel-canvas');
    if (!canvas) return;

    wrapper = canvas.closest('.partner-carousel-wrapper');
    if (!wrapper) return;

    ctx = canvas.getContext('2d');
    if (!ctx) return;

    setupResize();
    setupEvents();

    resize();
    window.addEventListener('load', function onLoad() {
      window.removeEventListener('load', onLoad);
      resize();
      if (CONFIG.autoStart && !animationFrameId) start();
    });
    if (CONFIG.autoStart) start();
  }

  function onVisibilityChange() {
    isPaused = document.hidden;
  }

  function setupResize() {
    window.addEventListener('resize', resize);
  }

  function setupEvents() {
    if (CONFIG.pauseOnHover && wrapper) {
      wrapper.addEventListener('mouseenter', function() { isPaused = true; });
      wrapper.addEventListener('mouseleave', function() { isPaused = false; });
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function resize() {
    if (!canvas || !wrapper) return;

    dpr = window.devicePixelRatio || 1;
    const rect = wrapper.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const maxCanvasHeight = 64;
    const h = Math.min(maxCanvasHeight, Math.max(48, Math.floor(rect.height)));

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    loopWidth = measureLoopWidth();
    offsetX = 0;
    draw();
  }

  function measureLoopWidth() {
    ctx.font = CONFIG.fontSize + 'px ' + CONFIG.fontFamily;
    let total = 0;
    for (let i = 0; i < PARTNERS.length; i++) {
      total += ctx.measureText(PARTNERS[i]).width + CONFIG.gap;
    }
    return total;
  }

  function draw() {
    if (!ctx || !canvas) return;

    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);
    ctx.font = CONFIG.fontSize + 'px ' + CONFIG.fontFamily;
    ctx.fillStyle = CONFIG.textColor;
    ctx.textBaseline = 'middle';

    const y = h / 2;

    // Desenha duas cópias para loop infinito
    for (let copy = 0; copy < 2; copy++) {
      let x = copy * loopWidth - offsetX;
      for (let i = 0; i < PARTNERS.length; i++) {
        const text = PARTNERS[i];
        const tw = ctx.measureText(text).width;
        if (x + tw >= -20 && x <= w + 20) {
          ctx.fillText(text, x, y);
        }
        x += tw + CONFIG.gap;
      }
    }
  }

  function animate() {
    if (isPaused || !canvas) {
      animationFrameId = null;
      return;
    }

    offsetX += CONFIG.speed;
    // Loop infinito: quando avança uma volta completa, volta ao início sem saltar
    while (loopWidth > 0 && offsetX >= loopWidth) {
      offsetX -= loopWidth;
    }

    draw();
    animationFrameId = requestAnimationFrame(animate);
  }

  function start() {
    if (animationFrameId) return;
    isPaused = false;
    animate();
  }

  function pause() {
    isPaused = true;
  }

  function resume() {
    if (isPaused) {
      isPaused = false;
      animate();
    }
  }

  function destroy() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    isPaused = true;
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.partnerCarousel = {
    start: start,
    pause: pause,
    resume: resume,
    destroy: destroy,
    updateDimensions: resize,
    updateSpeed: function(speed) {
      CONFIG.speed = speed;
    }
  };
})();
